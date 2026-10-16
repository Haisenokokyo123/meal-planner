<?php
declare(strict_types=1);

namespace Sakto;

/** Persistent planning and checkout. All stock-changing writers share the settings lock. */
final class Plans
{
    public static function handle(array $segments, string $method, array $user): mixed
    {
        if (count($segments) === 1 && $method === 'GET') {
            $week = $_GET['weekStart'] ?? null;
            if ($week !== null) {
                if (!is_string($week)) {
                    throw new ApiError('Choose a valid meal-plan week.');
                }
                assertWeek($week);
            }
            $row = DB::one(
                'SELECT * FROM plans WHERE userId = ?' . ($week !== null ? ' AND weekStart = ?' : '')
                    . " ORDER BY (status = 'DRAFT') DESC, updatedAt DESC, id DESC LIMIT 1",
                $week === null ? [$user['id']] : [$user['id'], $week]
            );
            return $row ? Models::plan($row) : null;
        }

        if (count($segments) === 1 && $method === 'POST') {
            $body = input();
            $week = null;
            if (array_key_exists('weekStart', $body)) {
                $week = self::text($body, 'weekStart', 10, 10);
                assertWeek($week);
            }
            rateLimit('generate:' . $user['id'], 40);
            return DB::transaction(function () use ($user, $week): array {
                self::lock($user);
                $settings = Models::settings();
                $weekStart = $week ?? nextMonday($settings['cutoffHours']);
                assertWeek($weekStart);
                $existing = DB::one("SELECT * FROM plans WHERE userId = ? AND weekStart = ? AND status = 'DRAFT' ORDER BY updatedAt DESC LIMIT 1", [$user['id'], $weekStart]);
                if ($existing) {
                    return Models::plan($existing);
                }
                $profile = Models::profile($user['id']);
                self::ensureDays($profile, $settings);
                self::cutoff($weekStart, $profile['days'], $settings);
                $catalog = Models::meals();
                $slots = Planner::generate($catalog, $profile, [], self::favorites($user['id']), random_int(0, 2147483647));
                // Generated identities must never collide across plans or users.
                foreach ($slots as &$slot) {
                    $slot['id'] = id();
                }
                unset($slot);
                Planner::validate($slots, $profile, $catalog);
                $planId = id();
                DB::exec(
                    "INSERT INTO plans (id, userId, weekStart, revision, status, profileData, nutritionData, createdAt, updatedAt) VALUES (?, ?, ?, 1, 'DRAFT', ?, ?, NOW(3), NOW(3))",
                    [$planId, $user['id'], $weekStart, self::json($profile), self::json(Planner::nutrition($profile))]
                );
                self::saveSlots($planId, $slots);
                return Models::plan(Models::ownedPlan($planId, $user['id']));
            });
        }

        $planId = $segments[1] ?? '';
        if ($planId === '') {
            throw new ApiError('Route not found.', 404);
        }
        if (count($segments) === 3 && $segments[2] === 'alternatives' && $method === 'GET') {
            $plan = Models::plan(Models::ownedPlan($planId, $user['id']));
            $slotId = $_GET['slotId'] ?? null;
            if (!is_string($slotId) || !in_array($slotId, array_column($plan['slots'], 'id'), true)) {
                throw new ApiError('Choose a meal in your plan.', 404);
            }
            return Planner::alternatives(Models::meals(), Models::profile($user['id']), $plan['slots'], $slotId);
        }
        if (count($segments) === 2 && $method === 'PATCH') {
            $body = self::editInput(input());
            if ($body['action'] === 'regenerate') {
                rateLimit('generate:' . $user['id'], 40);
            }
            return DB::transaction(function () use ($planId, $body, $user): array {
                self::lock($user);
                $stored = Models::ownedPlan($planId, $user['id']);
                if ($stored['status'] !== 'DRAFT') {
                    throw new ApiError('Confirmed plans are read-only. Create a new draft for a future week.', 409);
                }
                if ((int) $stored['revision'] !== $body['revision']) {
                    throw new ApiError('This plan changed in another window. Refresh before editing.', 409);
                }
                $plan = Models::plan($stored);
                $profile = Models::profile($user['id']);
                $settings = Models::settings();
                self::ensureDays($profile, $settings);
                // Check the existing delivery dates too: removing a late meal must not bypass cutoff.
                self::cutoff($plan['weekStart'], count($plan['slots']) ? array_column($plan['slots'], 'day') : $profile['days'], $settings);
                $catalog = Models::meals();
                $slots = $plan['slots'];
                if ($body['action'] === 'regenerate') {
                    $locked = array_values(array_filter($slots, static fn(array $slot): bool => (bool) $slot['locked']));
                    $slots = Planner::generate($catalog, $profile, $locked, self::favorites($user['id']), random_int(0, 2147483647));
                    $lockedIds = array_column($locked, 'id');
                    foreach ($slots as &$slot) {
                        if (!in_array($slot['id'], $lockedIds, true)) {
                            $slot['id'] = id();
                        }
                    }
                    unset($slot);
                } elseif ($body['action'] === 'add') {
                    $slots = self::addSlot($slots, $body, $profile, $catalog, self::favorites($user['id']));
                } else {
                    $index = null;
                    foreach ($slots as $key => $slot) {
                        if ($slot['id'] === ($body['slotId'] ?? null)) {
                            $index = $key;
                            break;
                        }
                    }
                    if ($index === null) {
                        throw new ApiError('Meal slot not found.', 404);
                    }
                    if ($slots[$index]['locked'] && $body['action'] !== 'lock') throw new ApiError('Unlock this meal before changing or removing it.', 409);
                    if ($body['action'] === 'remove') {
                        unset($slots[$index]);
                        $slots = array_values($slots);
                    } elseif ($body['action'] === 'lock') {
                        $slots[$index]['locked'] = $body['locked'] ?? !$slots[$index]['locked'];
                    } elseif ($body['action'] === 'portion') {
                        if (!isset($body['portion']) || !self::hasPortion($slots[$index]['meal'], $body['portion'])) {
                            throw new ApiError('This meal does not support that portion.');
                        }
                        $slots[$index]['portion'] = $body['portion'];
                    } elseif ($body['action'] === 'swap') {
                        $meal = self::findMeal($catalog, $body['mealId'] ?? '');
                        if (!$meal || !self::hasPortion($meal, $slots[$index]['portion']) || !Planner::eligible($meal, $profile, $slots[$index]['slot'])) {
                            throw new ApiError('That replacement does not match your dietary or portion requirements.', 422);
                        }
                        $slots[$index]['mealId'] = $meal['id'];
                        $slots[$index]['meal'] = $meal;
                        $slots[$index]['explanation'] = 'Chosen by you; checked against your dietary requirements and meal budget.';
                    }
                }
                Planner::validate($slots, $profile, $catalog);
                self::cutoff($plan['weekStart'], count($slots) ? array_column($slots, 'day') : $profile['days'], $settings);
                $updated = DB::exec(
                    "UPDATE plans SET revision = revision + 1, profileData = ?, nutritionData = ?, updatedAt = NOW(3) WHERE id = ? AND userId = ? AND revision = ? AND status = 'DRAFT'",
                    [self::json($profile), self::json(Planner::nutrition($profile)), $planId, $user['id'], $body['revision']]
                );
                if ($updated !== 1) {
                    throw new ApiError('This plan changed in another window. Refresh before editing.', 409);
                }
                DB::exec('DELETE FROM plan_slots WHERE planId = ?', [$planId]);
                self::saveSlots($planId, $slots);
                return Models::plan(Models::ownedPlan($planId, $user['id']));
            });
        }
        throw new ApiError('Route not found.', 404);
    }

    public static function checkout(array $user): array
    {
        $body = self::checkoutInput(input());
        // Hash validated, consistently ordered fields, not arbitrary input property order.
        $fingerprint = hash('sha256', self::json($body));
        rateLimit('checkout:' . $user['id'], 30);
        return DB::transaction(function () use ($user, $body, $fingerprint): array {
            self::lock($user);
            $previous = DB::one('SELECT * FROM orders WHERE userId = ? AND idempotencyKey = ?', [$user['id'], $body['idempotencyKey']]);
            if ($previous) {
                if (!hash_equals($previous['payloadHash'], $fingerprint)) {
                    throw new ApiError('This checkout key has already been used for a different request.', 409);
                }
                $subscription = DB::one('SELECT * FROM subscriptions WHERE id = ? AND userId = ?', [$previous['subscriptionId'], $user['id']]);
                if (!$subscription) {
                    throw new ApiError('The saved checkout could not be loaded. Please contact support.', 503);
                }
                return ['order' => Models::order($previous), 'subscription' => Models::subscription($subscription)];
            }
            $stored = Models::ownedPlan($body['planId'], $user['id']);
            if ($stored['status'] !== 'DRAFT') {
                throw new ApiError('This plan has already been confirmed.', 409);
            }
            if ((int) $stored['revision'] !== $body['revision']) {
                throw new ApiError('Your meal plan changed. Review the latest version before checkout.', 409);
            }
            $plan = Models::plan($stored);
            $profile = Models::profile($user['id']);
            $settings = Models::settings();
            self::ensureDays($profile, $settings);
            $zone = DB::one('SELECT * FROM delivery_zones WHERE id = ? AND active = 1', [$body['zoneId']]);
            if (!$zone) {
                throw new ApiError('Choose an available delivery area.');
            }
            $package = DB::one('SELECT * FROM packages WHERE id = ? AND active = 1', [$body['packageId']]);
            if (!$package) {
                throw new ApiError('Choose an available meal package.');
            }
            $slots = $plan['slots'];
            $count = count($slots);
            if ($count < 1 || $count > 21 || ((int) $package['mealCount'] !== 0 && (int) $package['mealCount'] !== $count)) {
                throw new ApiError('Your meal count does not match this package. Choose Custom or update your plan.');
            }
            $catalog = Models::meals();
            Planner::validate($slots, $profile, $catalog);
            // Replace every embedded meal with the live catalog before computing immutable snapshots.
            foreach ($slots as &$slot) {
                $slot['meal'] = self::findMeal($catalog, $slot['mealId']);
            }
            unset($slot);
            $days = array_values(array_unique(array_column($slots, 'day')));
            self::cutoff($plan['weekStart'], $days, $settings);
            $demand = [];
            foreach ($slots as $slot) {
                $date = addDays($plan['weekStart'], $slot['day']);
                $key = $date . ':' . $slot['mealId'];
                if (!isset($demand[$key])) {
                    $demand[$key] = ['meal' => $slot['meal'], 'date' => $date, 'portion' => 0.0];
                }
                $demand[$key]['portion'] += $slot['portion'];
            }
            foreach ($demand as $item) {
                $committed = DB::one("SELECT COALESCE(SUM(i.portion), 0) AS quantity FROM order_items i JOIN orders o ON o.id = i.orderId WHERE i.mealId = ? AND i.deliveryDate = ? AND o.status <> 'CANCELLED'", [$item['meal']['id'], $item['date']]);
                if ((float) $committed['quantity'] + $item['portion'] > (float) $item['meal']['capacity'] + 0.000001) {
                    throw new ApiError($item['meal']['name'] . ' has reached kitchen capacity on ' . $item['date'] . '. Swap it before confirming.', 409);
                }
            }
            $totals = Planner::totals($slots);
            if ($totals['price'] > $profile['budget']) {
                throw new ApiError('Your selected meals exceed your current meal budget.', 409);
            }
            $deliveryFee = (int) $zone['fee'] * count($days);
            $changed = DB::exec("UPDATE plans SET status = 'CONFIRMED', revision = revision + 1, profileData = ?, nutritionData = ?, updatedAt = NOW(3) WHERE id = ? AND userId = ? AND status = 'DRAFT' AND revision = ?", [self::json($profile), self::json(Planner::nutrition($profile)), $plan['id'], $user['id'], $body['revision']]);
            if ($changed !== 1) {
                throw new ApiError('This plan was changed or confirmed in another window.', 409);
            }
            $subscriptionId = id();
            DB::exec("INSERT INTO subscriptions (id, userId, packageId, packageName, status, weekStart, nextCycle, mealCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, NOW(3), NOW(3))", [$subscriptionId, $user['id'], $package['id'], $package['name'], $plan['weekStart'], addDays($plan['weekStart'], 7), $count]);
            $orderId = id();
            DB::exec("INSERT INTO orders (id, userId, planId, subscriptionId, idempotencyKey, payloadHash, status, mealTotal, deliveryFee, total, address, zoneName, paymentMethod, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?, 'SIMULATED_PAID', NOW(3), NOW(3))", [$orderId, $user['id'], $plan['id'], $subscriptionId, $body['idempotencyKey'], $fingerprint, $totals['price'], $deliveryFee, $totals['price'] + $deliveryFee, $body['address'], $zone['name'], $body['paymentMethod']]);
            foreach ($slots as $slot) {
                $meal = $slot['meal'];
                $portion = (float) $slot['portion'];
                DB::exec('INSERT INTO order_items (id, orderId, mealId, name, day, slot, deliveryDate, `portion`, price, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id(), $orderId, $meal['id'], $meal['name'], $slot['day'], $slot['slot'], addDays($plan['weekStart'], $slot['day']), $portion, (int) round($meal['price'] * $portion), round($meal['calories'] * $portion, 1), round($meal['protein'] * $portion, 1), round($meal['carbs'] * $portion, 1), round($meal['fat'] * $portion, 1)]);
            }
            DB::exec("INSERT INTO order_history (id, orderId, status, createdAt) VALUES (?, ?, 'CONFIRMED', NOW(3))", [id(), $orderId]);
            return [
                'order' => Models::order(DB::one('SELECT * FROM orders WHERE id = ?', [$orderId])),
                'subscription' => Models::subscription(DB::one('SELECT * FROM subscriptions WHERE id = ?', [$subscriptionId])),
            ];
        });
    }

    public static function subscription(string $subscriptionId, array $user, bool $admin = false): array
    {
        if ($admin && ($user['role'] ?? '') !== 'ADMIN') {
            throw new ApiError('Administrator access is required.', 403);
        }
        $body = input();
        $action = self::text($body, 'action', 1, 20);
        if (!in_array($action, ['pause', 'resume', 'cancel'], true)) {
            throw new ApiError('Choose pause, resume, or cancel.');
        }
        return DB::transaction(function () use ($subscriptionId, $user, $admin, $action): array {
            self::lock($user);
            $subscription = DB::one('SELECT * FROM subscriptions WHERE id = ?' . ($admin ? '' : ' AND userId = ?'), $admin ? [$subscriptionId] : [$subscriptionId, $user['id']]);
            if (!$subscription) {
                throw new ApiError('Subscription not found.', 404);
            }
            $transitions = ['ACTIVE' => ['pause' => 'PAUSED', 'cancel' => 'CANCELLED'], 'PAUSED' => ['resume' => 'ACTIVE', 'cancel' => 'CANCELLED']];
            $status = $transitions[$subscription['status']][$action] ?? null;
            if ($status === null) {
                throw new ApiError('That change is not available for this subscription state.', 409);
            }
            $settings = Models::settings();
            $nextCycle = $subscription['nextCycle'];
            while ($nextCycle < manilaDate()) {
                $nextCycle = addDays($nextCycle, 7);
            }
            assertCutoff($nextCycle, $settings['cutoffHours']);
            $updated = DB::exec('UPDATE subscriptions SET status = ?, nextCycle = ?, updatedAt = NOW(3) WHERE id = ? AND status = ?', [$status, $nextCycle, $subscriptionId, $subscription['status']]);
            if ($updated !== 1) {
                throw new ApiError('Subscription changed. Refresh and try again.', 409);
            }
            if ($admin) {
                Models::audit($user['id'], 'Subscription ' . $subscriptionId . ': ' . $subscription['status'] . ' → ' . $status);
            }
            // Only future cycle status changes. Confirmed orders and simulated payments are untouched.
            return Models::subscription(array_replace($subscription, ['status' => $status, 'nextCycle' => $nextCycle]));
        });
    }

    private static function lock(array $user): void
    {
        if (!DB::one("SELECT id FROM settings WHERE id = 'main' FOR UPDATE")) {
            throw new ApiError('The meal service needs its initial database setup.', 503);
        }
        if (!DB::one('SELECT id FROM users WHERE id = ? AND deletedAt IS NULL', [$user['id']])) {
            throw new ApiError('Please sign in to continue.', 401);
        }
    }

    private static function ensureDays(array $profile, array $settings): void
    {
        foreach ($profile['days'] as $day) {
            if (!in_array($day, $settings['supportedDays'], true)) {
                throw new ApiError('Your schedule includes an unsupported delivery day. Update your preferences.', 409);
            }
        }
    }

    private static function cutoff(string $week, array $days, array $settings): void
    {
        foreach (array_unique($days) as $day) {
            if (!in_array($day, $settings['supportedDays'], true)) {
                throw new ApiError('Your saved schedule includes an unsupported delivery day. Update your preferences.', 409);
            }
            assertCutoff(addDays($week, (int) $day), $settings['cutoffHours']);
        }
    }

    private static function favorites(string $userId): array
    {
        return array_column(DB::all('SELECT mealId FROM favorites WHERE userId = ?', [$userId]), 'mealId');
    }

    private static function saveSlots(string $planId, array $slots): void
    {
        foreach ($slots as $slot) {
            DB::exec('INSERT INTO plan_slots (id, planId, mealId, day, slot, `portion`, locked, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$slot['id'], $planId, $slot['mealId'], $slot['day'], $slot['slot'], $slot['portion'], (int) $slot['locked'], $slot['explanation']]);
        }
    }

    private static function addSlot(array $slots, array $body, array $profile, array $catalog, array $favorites): array
    {
        if (!isset($body['day'], $body['slot']) || !in_array($body['day'], $profile['days'], true) || !in_array($body['slot'], $profile['slots'], true)) {
            throw new ApiError('Select a day and meal time from your saved schedule.');
        }
        foreach ($slots as $slot) {
            if ($slot['day'] === $body['day'] && $slot['slot'] === $body['slot']) {
                throw new ApiError('This meal time already has a meal.', 409);
            }
        }
        $candidates = array_values(array_filter($catalog, static fn(array $meal): bool => (!isset($body['mealId']) || $meal['id'] === $body['mealId']) && Planner::eligible($meal, $profile, $body['slot'])));
        usort($candidates, static fn(array $left, array $right): int => ((int) in_array($right['id'], $favorites, true) <=> (int) in_array($left['id'], $favorites, true)) ?: ($left['price'] <=> $right['price']));
        foreach ($candidates as $meal) {
            $portion = $body['portion'] ?? 1.0;
            if (!self::hasPortion($meal, $portion)) {
                continue;
            }
            $proposed = ['id' => id(), 'day' => $body['day'], 'slot' => $body['slot'], 'mealId' => $meal['id'], 'meal' => $meal, 'portion' => $portion, 'locked' => false, 'explanation' => 'Added within your dietary preferences and meal budget.'];
            $updated = [...$slots, $proposed];
            try {
                Planner::validate($updated, $profile, $catalog);
                return $updated;
            } catch (ApiError $error) {
                // Try the next dietary-safe choice when a price/capacity constraint fails.
                if ($error->getCode() >= 500) {
                    throw $error;
                }
            }
        }
        throw new ApiError('No eligible meal fits this time, `portion`, and remaining budget. Update your preferences or budget.', 422);
    }

    private static function findMeal(array $catalog, string $mealId): ?array
    {
        foreach ($catalog as $meal) {
            if ($meal['id'] === $mealId) {
                return $meal;
            }
        }
        return null;
    }

    private static function hasPortion(array $meal, float|int $portion): bool
    {
        foreach ($meal['portions'] as $allowed) {
            if ((float) $allowed === (float) $portion) {
                return true;
            }
        }
        return false;
    }

    private static function editInput(array $body): array
    {
        self::revision($body);
        if (!isset($body['action']) || !is_string($body['action']) || !in_array($body['action'], ['regenerate', 'lock', 'swap', 'remove', 'add', 'portion'], true)) {
            throw new ApiError('Choose a valid plan action.');
        }
        foreach (['slotId', 'mealId'] as $key) {
            if (array_key_exists($key, $body)) {
                $body[$key] = self::text($body, $key, 1, 100);
            }
        }
        if (array_key_exists('locked', $body) && !is_bool($body['locked'])) {
            throw new ApiError('Locked must be true or false.');
        }
        if (array_key_exists('day', $body) && (!is_int($body['day']) || $body['day'] < 0 || $body['day'] > 6)) {
            throw new ApiError('Choose a day from Monday to Sunday.');
        }
        if (array_key_exists('slot', $body) && !in_array($body['slot'], ['breakfast', 'lunch', 'dinner'], true)) {
            throw new ApiError('Choose breakfast, lunch, or dinner.');
        }
        if (array_key_exists('portion', $body) && ((!is_int($body['portion']) && !is_float($body['portion'])) || !is_finite((float) $body['portion']) || $body['portion'] < 0.5 || $body['portion'] > 2)) {
            throw new ApiError('Choose a supported portion between 0.5 and 2.');
        }
        return $body;
    }

    private static function checkoutInput(array $body): array
    {
        self::revision($body);
        $clean = [];
        foreach (['planId', 'packageId', 'zoneId'] as $key) {
            $clean[$key] = self::text($body, $key, 1, 100);
        }
        $clean['revision'] = $body['revision'];
        $clean['address'] = self::text($body, 'address', 10, 500);
        $clean['paymentMethod'] = self::text($body, 'paymentMethod', 1, 20);
        if (!in_array($clean['paymentMethod'], ['GCash', 'Maya', 'Card'], true)) {
            throw new ApiError('Choose GCash, Maya, or Card for the simulated payment.');
        }
        $clean['idempotencyKey'] = self::text($body, 'idempotencyKey', 16, 100);
        if (!preg_match('/\A[a-zA-Z0-9_-]+\z/', $clean['idempotencyKey'])) {
            throw new ApiError('Invalid checkout request key. Refresh and try again.');
        }
        return $clean;
    }

    private static function revision(array $body): void
    {
        if (!isset($body['revision']) || !is_int($body['revision']) || $body['revision'] < 1 || $body['revision'] >= 2147483647) {
            throw new ApiError('A valid current plan revision is required.');
        }
    }

    private static function text(array $body, string $key, int $min, int $max): string
    {
        if (!isset($body[$key]) || !is_string($body[$key])) {
            throw new ApiError($key . ' is required.');
        }
        $value = trim($body[$key]);
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        if ($length < $min || $length > $max || str_contains($value, "\0")) {
            throw new ApiError($key . ' must contain between ' . $min . ' and ' . $max . ' characters.');
        }
        return $value;
    }

    private static function json(array $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
