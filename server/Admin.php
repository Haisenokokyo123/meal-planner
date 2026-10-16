<?php
declare(strict_types=1);

namespace Sakto;

use DateTimeImmutable;
use DateTimeZone;

/** Operational administration. Nutrition profiles and credential fields never leave this class. */
final class Admin
{
    private const ACTIVE_ORDER_STATUSES = ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
    private const MEAL_FIELDS = [
        'slug', 'name', 'description', 'category', 'price', 'calories', 'protein', 'carbs', 'fat',
        'servingSize', 'ingredients', 'allergens', 'tags', 'slots', 'image', 'available', 'capacity', 'portions',
    ];

    public static function handle(array $segments, string $method, array $user): mixed
    {
        // Deliberately enforce the role here as well as in the HTTP router.
        if (($user['role'] ?? null) !== 'ADMIN' || !empty($user['deletedAt'])) {
            throw new ApiError('Administrator access is required.', 403);
        }
        if (($segments[0] ?? null) !== 'admin') {
            throw new ApiError('Route not found.', 404);
        }
        if (count($segments) === 1 && $method === 'GET') {
            return self::overview();
        }
        $resource = $segments[1] ?? '';
        if ($resource === 'kitchen' && count($segments) === 2 && $method === 'GET') {
            return self::kitchen();
        }
        if ($resource === 'meals' && (($method === 'POST' && count($segments) === 2) || ($method === 'PUT' && count($segments) === 3))) {
            return self::saveMeal($method === 'PUT' ? $segments[2] : null, $user);
        }
        if ($resource === 'orders' && count($segments) === 3 && $method === 'PATCH') {
            return self::changeOrder($segments[2], $user);
        }
        if ($resource === 'subscriptions' && count($segments) === 3 && $method === 'PATCH') {
            return Plans::subscription($segments[2], $user, true);
        }
        if ($resource === 'packages' && count($segments) === 3 && $method === 'PUT') {
            return self::savePackage($segments[2], $user);
        }
        if ($resource === 'settings' && count($segments) === 2 && $method === 'PUT') {
            return self::saveSettings($user);
        }
        throw new ApiError('Route not found.', 404);
    }

    private static function overview(): array
    {
        $from = self::queryDate('from');
        $to = self::queryDate('to');
        if ($from !== null && $to !== null && $from > $to) {
            throw new ApiError('The report start date must precede its end date.');
        }
        $conditions = [];
        $params = [];
        if ($from !== null) {
            $conditions[] = 'createdAt >= ?';
            $params[] = self::utcBoundary($from);
        }
        if ($to !== null) {
            $conditions[] = 'createdAt < ?';
            $params[] = self::utcBoundary(addDays($to, 1));
        }
        $where = $conditions ? ' WHERE '.implode(' AND ', $conditions) : '';
        $orders = array_map(
            static fn (array $row): array => Models::order($row, true),
            DB::all('SELECT * FROM orders'.$where.' ORDER BY createdAt DESC, id DESC', $params)
        );
        $subscriptions = array_map(static function (array $row): array {
            return array_merge(Models::subscription($row), ['user' => publicUser([
                'id' => $row['ownerId'], 'name' => $row['ownerName'],
                'email' => $row['ownerEmail'], 'role' => $row['ownerRole'],
            ])]);
        }, DB::all(
            'SELECT s.*, u.id AS ownerId, u.name AS ownerName, u.email AS ownerEmail, u.role AS ownerRole '
            .'FROM subscriptions s JOIN users u ON u.id = s.userId ORDER BY s.createdAt DESC, s.id DESC'
        ));
        $customers = array_map(static fn (array $row): array => [
            'id' => $row['id'], 'name' => $row['name'], 'email' => $row['email'],
            'orderCount' => (int) $row['orderCount'],
        ], DB::all(
            "SELECT u.id, u.name, u.email, (SELECT COUNT(*) FROM orders o WHERE o.userId = u.id) AS orderCount "
            ."FROM users u WHERE u.role = 'CUSTOMER' AND u.deletedAt IS NULL ORDER BY u.createdAt DESC, u.id DESC"
        ));

        $sales = [];
        $popular = [];
        $saleTotal = 0;
        $scheduledMeals = 0;
        foreach ($orders as $order) {
            if (in_array($order['status'], self::ACTIVE_ORDER_STATUSES, true)) {
                $scheduledMeals += count($order['items']);
            }
            if ($order['status'] === 'CANCELLED') {
                continue;
            }
            // Store UTC, report in Philippine calendar dates, including midnight boundaries.
            $date = (new DateTimeImmutable($order['createdAt']))->setTimezone(new DateTimeZone('Asia/Manila'))->format('Y-m-d');
            $sales[$date] ??= ['date' => $date, 'total' => 0, 'orders' => 0];
            $sales[$date]['total'] += (int) $order['total'];
            $sales[$date]['orders']++;
            $saleTotal += (int) $order['total'];
            foreach ($order['items'] as $item) {
                $popular[$item['mealId']] ??= ['name' => $item['name'], 'quantity' => 0];
                $popular[$item['mealId']]['quantity']++;
            }
        }
        ksort($sales, SORT_STRING);
        $popular = array_values($popular);
        usort($popular, static fn (array $a, array $b): int => ($b['quantity'] <=> $a['quantity']) ?: strcasecmp($a['name'], $b['name']));
        $config = Core::configuration(true);
        return [
            'stats' => [
                'customers' => count($customers),
                'activeSubscriptions' => count(array_filter($subscriptions, static fn (array $row): bool => $row['status'] === 'ACTIVE')),
                'orders' => count($orders), 'scheduledMeals' => $scheduledMeals, 'sales' => $saleTotal,
            ],
            'orders' => $orders,
            'meals' => Models::meals(),
            'packages' => array_map(self::package(...), DB::all('SELECT * FROM packages ORDER BY mealCount, name, id')),
            'zones' => $config['zones'], 'settings' => $config['settings'],
            'subscriptions' => $subscriptions, 'customers' => $customers,
            'sales' => array_values($sales), 'popular' => array_slice($popular, 0, 10),
            'audit' => array_map(static fn (array $row): array => [
                'id' => $row['id'], 'action' => $row['action'], 'createdAt' => isoDate($row['createdAt']),
            ], DB::all('SELECT id, action, createdAt FROM audit_logs ORDER BY createdAt DESC, id DESC LIMIT 100')),
        ];
    }

    private static function kitchen(): array
    {
        $date = self::queryDate('date') ?? manilaDate();
        $items = DB::all(
            'SELECT i.mealId, i.name, i.portion, i.orderId FROM order_items i JOIN orders o ON o.id = i.orderId '
            ."WHERE i.deliveryDate = ? AND o.status IN ('CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY') "
            .'ORDER BY i.name, i.orderId, i.id',
            [$date]
        );
        $meals = [];
        foreach ($items as $item) {
            $mealId = $item['mealId'];
            $meals[$mealId] ??= ['mealId' => $mealId, 'name' => $item['name'], 'quantity' => 0, 'portions' => 0.0, 'orderIds' => []];
            $meals[$mealId]['quantity']++;
            $meals[$mealId]['portions'] += (float) $item['portion'];
            if (!in_array($item['orderId'], $meals[$mealId]['orderIds'], true)) {
                $meals[$mealId]['orderIds'][] = $item['orderId'];
            }
        }
        $meals = array_values($meals);
        usort($meals, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
        return ['date' => $date, 'meals' => $meals];
    }

    private static function saveMeal(?string $mealId, array $user): array
    {
        $data = Validators::meal(input());
        self::assertLocalImage($data['image']);
        foreach (['ingredients', 'allergens', 'tags', 'slots', 'portions'] as $field) {
            $data[$field] = json_encode($data[$field], JSON_THROW_ON_ERROR);
        }
        $data['available'] = (int) $data['available'];

        return DB::transaction(static function () use ($mealId, $data, $user): array {
            self::lockSettings();
            if ($mealId !== null && !DB::one('SELECT id FROM meals WHERE id = ?', [$mealId])) {
                throw new ApiError('Meal not found.', 404);
            }
            $duplicate = DB::one('SELECT id FROM meals WHERE slug = ?', [$data['slug']]);
            if ($duplicate !== null && $duplicate['id'] !== $mealId) {
                throw new ApiError('A meal with this URL slug already exists. Choose another slug.', 409);
            }
            $values = array_map(static fn (string $field): mixed => $data[$field], self::MEAL_FIELDS);
            $id = $mealId ?? id();
            if ($mealId === null) {
                DB::exec(
                    'INSERT INTO meals (id, '.implode(', ', self::MEAL_FIELDS).', createdAt, updatedAt) VALUES ('
                    .implode(', ', array_fill(0, count($values) + 1, '?')).', NOW(3), NOW(3))',
                    array_merge([$id], $values)
                );
            } else {
                DB::exec(
                    'UPDATE meals SET '.implode(', ', array_map(static fn (string $field): string => $field.' = ?', self::MEAL_FIELDS))
                    .', updatedAt = NOW(3) WHERE id = ?',
                    array_merge($values, [$id])
                );
            }
            Models::audit($user['id'], ($mealId === null ? 'Created' : 'Updated').' meal '.$data['name'].(!$data['available'] ? ' (unavailable)' : ''));
            return Models::meal(DB::one('SELECT * FROM meals WHERE id = ?', [$id]));
        });
    }

    private static function changeOrder(string $orderId, array $user): array
    {
        $body = input();
        $status = $body['status'] ?? null;
        if (!is_string($status) || !in_array($status, ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'], true)) {
            throw new ApiError('Choose a valid order status.');
        }
        return DB::transaction(static function () use ($orderId, $status, $user): array {
            self::lockSettings();
            $order = DB::one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$orderId]);
            if ($order === null) {
                throw new ApiError('Order not found.', 404);
            }
            $transitions = [
                'CONFIRMED' => ['PREPARING', 'CANCELLED'], 'PREPARING' => ['OUT_FOR_DELIVERY', 'CANCELLED'],
                'OUT_FOR_DELIVERY' => ['DELIVERED'], 'DELIVERED' => [], 'CANCELLED' => [],
            ];
            if (!in_array($status, $transitions[$order['status']] ?? [], true)) {
                throw new ApiError('That order status transition is not permitted.', 409);
            }
            DB::exec('UPDATE orders SET status = ?, paymentStatus = ?, updatedAt = NOW(3) WHERE id = ?', [
                $status, $status === 'CANCELLED' ? 'SIMULATED_VOID' : $order['paymentStatus'], $orderId,
            ]);
            DB::exec('INSERT INTO order_history (id, orderId, status, createdAt) VALUES (?, ?, ?, NOW(3))', [id(), $orderId, $status]);
            if ($status === 'CANCELLED') {
                // A cancelled paid cycle must not leave its linked subscription appearing active.
                $changed = DB::exec("UPDATE subscriptions SET status = 'CANCELLED', updatedAt = NOW(3) WHERE id = ? AND status <> 'CANCELLED'", [$order['subscriptionId']]);
                if ($changed > 0) {
                    Models::audit($user['id'], 'Cancelled subscription '.$order['subscriptionId'].' with order '.$orderId);
                }
            }
            Models::audit($user['id'], 'Order '.$orderId.': '.$order['status'].' → '.$status);
            return Models::order(DB::one('SELECT * FROM orders WHERE id = ?', [$orderId]), true);
        });
    }

    private static function savePackage(string $packageId, array $user): array
    {
        $data = Validators::package(input());
        return DB::transaction(static function () use ($packageId, $data, $user): array {
            self::lockSettings();
            if (!DB::one('SELECT id FROM packages WHERE id = ?', [$packageId])) {
                throw new ApiError('Package not found.', 404);
            }
            DB::exec('UPDATE packages SET name = ?, mealCount = ?, price = ?, description = ?, active = ? WHERE id = ?', [
                $data['name'], $data['mealCount'], $data['price'], $data['description'], (int) $data['active'], $packageId,
            ]);
            Models::audit($user['id'], 'Updated package '.$data['name'].(!$data['active'] ? ' (inactive)' : ''));
            return self::package(DB::one('SELECT * FROM packages WHERE id = ?', [$packageId]));
        });
    }

    private static function saveSettings(array $user): array
    {
        $body = input();
        if (!isset($body['settings'], $body['zones']) || !is_array($body['settings']) || !is_array($body['zones'])) {
            throw new ApiError('Provide operational settings and delivery areas.');
        }
        $settings = Validators::settings($body['settings']);
        $zones = Validators::zones($body['zones']);
        if (!array_filter($zones, static fn (array $zone): bool => $zone['active'])) {
            throw new ApiError('Keep at least one delivery area active so customers can check out.');
        }
        $zoneIds = array_column($zones, 'id');
        if (count(array_unique(array_map('strtolower', $zoneIds))) !== count($zoneIds)) {
            throw new ApiError('Delivery area IDs must be unique.');
        }
        return DB::transaction(static function () use ($settings, $zones, $zoneIds, $user): array {
            self::lockSettings();
            DB::exec('UPDATE settings SET cutoffHours = ?, deliveryWindow = ?, supportedDays = ? WHERE id = ?', [
                $settings['cutoffHours'], $settings['deliveryWindow'], json_encode($settings['supportedDays'], JSON_THROW_ON_ERROR), 'main',
            ]);
            foreach ($zones as $zone) {
                if (DB::one('SELECT id FROM delivery_zones WHERE id = ?', [$zone['id']])) {
                    DB::exec('UPDATE delivery_zones SET name = ?, fee = ?, active = ? WHERE id = ?', [
                        $zone['name'], $zone['fee'], (int) $zone['active'], $zone['id'],
                    ]);
                } else {
                    DB::exec('INSERT INTO delivery_zones (id, name, fee, active) VALUES (?, ?, ?, ?)', [
                        $zone['id'], $zone['name'], $zone['fee'], (int) $zone['active'],
                    ]);
                }
            }
            DB::exec('UPDATE delivery_zones SET active = 0 WHERE id NOT IN ('.implode(', ', array_fill(0, count($zoneIds), '?')).')', $zoneIds);
            Models::audit($user['id'], 'Updated delivery zones and operational settings');
            return Core::configuration(true);
        });
    }

    private static function package(array $row): array
    {
        return [
            'id' => $row['id'], 'name' => $row['name'], 'mealCount' => (int) $row['mealCount'],
            'price' => (int) $row['price'], 'description' => $row['description'], 'active' => (bool) $row['active'],
        ];
    }

    private static function lockSettings(): void
    {
        if (!DB::one("SELECT id FROM settings WHERE id = 'main' FOR UPDATE")) {
            throw new ApiError('The meal service needs its initial database setup.', 503);
        }
    }

    private static function queryDate(string $key): ?string
    {
        $date = $_GET[$key] ?? null;
        if ($date === null || $date === '') {
            return null;
        }
        if (!is_string($date)) {
            throw new ApiError('Enter a valid calendar date.');
        }
        assertDate($date);
        return $date;
    }

    private static function utcBoundary(string $date): string
    {
        return (new DateTimeImmutable($date.' 00:00:00', new DateTimeZone('Asia/Manila')))
            ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    private static function assertLocalImage(string $image): void
    {
        $directory = realpath(__DIR__.'/../public/images');
        $file = realpath(__DIR__.'/../public'.$image);
        if (!preg_match('~^/images/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$~D', $image)
            || $directory === false || $file === false || dirname($file) !== $directory || !is_file($file)) {
            throw new ApiError('Choose an existing image from the local meal image library.');
        }
    }
}
