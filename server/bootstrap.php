<?php
declare(strict_types=1);

namespace Sakto;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use RuntimeException;
use Throwable;

date_default_timezone_set('UTC');

final class ApiError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

function config(string $name, mixed $default = null): mixed
{
    static $values;
    if ($values === null) {
        $values = require dirname(__DIR__) . '/config.example.php';
        $local = dirname(__DIR__) . '/config.local.php';
        if (is_file($local)) {
            $overrides = require $local;
            if (!is_array($overrides)) throw new RuntimeException('Invalid local configuration.');
            $values = array_replace($values, $overrides);
        }
    }
    $environment = getenv($name);
    return $environment !== false ? $environment : ($values[$name] ?? $default);
}

final class DB
{
    private static ?PDO $connection = null;

    public static function pdo(): PDO
    {
        if (self::$connection === null) {
            $database = (string) config('DB_NAME');
            if (!preg_match('/^[A-Za-z0-9_]+$/D', $database)) throw new RuntimeException('Invalid database name.');
            $socket = config('DB_SOCKET');
            $dsn = $socket ? 'mysql:unix_socket=' . $socket : 'mysql:host=' . config('DB_HOST') . ';port=' . (int) config('DB_PORT', 3306);
            self::$connection = new PDO($dsn . ';dbname=' . $database . ';charset=utf8mb4', (string) config('DB_USER'), (string) config('DB_PASSWORD', ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
            self::$connection->exec("SET time_zone = '+00:00'");
        }
        return self::$connection;
    }

    public static function all(string $sql, array $params = []): array
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    public static function exec(string $sql, array $params = []): int
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        return $statement->rowCount();
    }

    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) return $fn();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
}

function id(): string { return bin2hex(random_bytes(16)); }
function jsonEncode(mixed $value): string { return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function isoDate(string $value): string { return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'); }

function input(): array
{
    static $body;
    if ($body !== null) return $body;
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) throw new ApiError('Send this request as JSON.', 415);
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) throw new ApiError('Request is too large.', 413);
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if ($raw === false || strlen($raw) > 32768) throw new ApiError('Request is too large.', 413);
    try { $parsed = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (\JsonException) { throw new ApiError('Invalid JSON request.'); }
    if (!$parsed instanceof \stdClass) throw new ApiError('A JSON object is required.');
    $body = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    return $body;
}

function respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo jsonEncode(['data' => $data]);
    exit;
}

function currentUser(): ?array
{
    $token = $_COOKIE['sakto_session'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) return null;
    return DB::one('SELECT u.* FROM sessions s JOIN users u ON u.id = s.userId WHERE s.tokenHash = ? AND s.expiresAt > UTC_TIMESTAMP(3) AND u.deletedAt IS NULL', [hash('sha256', $token)]);
}

function requireUser(bool $admin = false): array
{
    $user = currentUser();
    if (!$user) throw new ApiError('Sign in to continue.', 401);
    if ($admin && $user['role'] !== 'ADMIN') throw new ApiError('Administrator access is required.', 403);
    return $user;
}

function publicUser(array $row): array
{
    return array_intersect_key($row, array_flip(['id', 'name', 'email', 'role']));
}

function appUrl(): string
{
    return rtrim((string) config('APP_URL', 'http://localhost/meal-planner'), '/');
}

function assertSameOrigin(): void
{
    $url = parse_url(appUrl());
    if (!$url || !isset($url['scheme'], $url['host'])) throw new RuntimeException('APP_URL must be an absolute URL.');
    $expected = strtolower($url['scheme'] . '://' . $url['host']) . (isset($url['port']) && !(($url['scheme'] === 'http' && $url['port'] === 80) || ($url['scheme'] === 'https' && $url['port'] === 443)) ? ':' . $url['port'] : '');
    $origin = strtolower($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== $expected || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') throw new ApiError('This request must come from the Sakto Meals website.', 403);
}

function rateLimit(string $key, int $limit, int $minutes = 15): void
{
    $digest = hash('sha256', $key);
    $expires = gmdate('Y-m-d H:i:s', time() + $minutes * 60);
    // A single row lock makes the increment atomic across PHP/Apache workers.
    $count = DB::transaction(function () use ($digest, $expires) {
        DB::exec('INSERT INTO rate_limits (`key`, `count`, expiresAt) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE `count` = IF(expiresAt <= UTC_TIMESTAMP(3), 1, `count` + 1), expiresAt = IF(expiresAt <= UTC_TIMESTAMP(3), VALUES(expiresAt), expiresAt)', [$digest, $expires]);
        return (int) DB::one('SELECT `count` FROM rate_limits WHERE `key` = ? FOR UPDATE', [$digest])['count'];
    });
    if ($count > $limit) throw new ApiError('Too many attempts. Please try again in a few minutes.', 429);
}

function authRateLimit(string $action, string $identifier, int $limit = 10): void
{
    rateLimit($action . ':account:' . strtolower($identifier), $limit);
    // REMOTE_ADDR comes from Apache. Do not trust a client-controlled forwarding header.
    rateLimit($action . ':network:' . ($_SERVER['REMOTE_ADDR'] ?? 'local'), $limit * 5);
}

function assertDate(string $date): void
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) throw new ApiError('Enter a valid calendar date (YYYY-MM-DD).');
}
function addDays(string $date, int $days): string
{
    assertDate($date);
    return (new DateTimeImmutable($date, new DateTimeZone('UTC')))->modify(($days >= 0 ? '+' : '') . $days . ' days')->format('Y-m-d');
}
function manilaDate(): string { return (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d'); }
function nextMonday(int $cutoffHours = 24): string
{
    $today = manilaDate();
    $weekday = (int) (new DateTimeImmutable($today, new DateTimeZone('UTC')))->format('N');
    $start = addDays($today, 8 - $weekday);
    while (strtotime($start . 'T00:00:00Z') <= time() + $cutoffHours * 3600) $start = addDays($start, 7);
    return $start;
}
function assertWeek(string $date): void
{
    assertDate($date);
    if ((new DateTimeImmutable($date, new DateTimeZone('UTC')))->format('N') !== '1') throw new ApiError('A meal-plan week must start on Monday.');
    if ($date > addDays(manilaDate(), 366)) throw new ApiError('Choose a week within the next year.');
}
function assertCutoff(string $deliveryDate, int $hours): void
{
    assertDate($deliveryDate);
    if (strtotime($deliveryDate . 'T08:00:00+08:00') <= time() + $hours * 3600) throw new ApiError("Changes close $hours hours before 8:00 AM Manila on the delivery date. Choose a later week.", 409);
}
