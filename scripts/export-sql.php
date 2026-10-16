<?php
declare(strict_types=1);
// Regenerate the complete phpMyAdmin import without connecting to a database.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__).'/server/bootstrap.php';
require_once dirname(__DIR__).'/server/Validators.php';

function sqlValue(mixed $value): string {
    if (is_array($value)) $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (is_bool($value)) return $value ? '1' : '0';
    if (is_int($value) || is_float($value)) return (string)$value;
    if ($value === null) return 'NULL';
    // Hex literals avoid SQL-mode-dependent backslash escaping. Explicit
    // collation prevents MySQL/XAMPP defaults from conflicting with table keys.
    return "CONVERT(X'".bin2hex((string)$value)."' USING utf8mb4) COLLATE utf8mb4_unicode_ci";
}
function insertMissing(string $table, array $row, string $key = 'id'): string {
    $columns = implode(',', array_map(fn($column) => '`'.$column.'`', array_keys($row)));
    $values = implode(',', array_map('sqlValue', array_values($row)));
    return "INSERT INTO `$table` ($columns) SELECT $values WHERE NOT EXISTS (SELECT 1 FROM `$table` WHERE `$key`=".sqlValue($row[$key]).");\n";
}

$root = dirname(__DIR__);
$seed = json_decode(file_get_contents($root.'/server/seed-data.json'), true, 64, JSON_THROW_ON_ERROR);
$sql = "-- Sakto Meals: complete local phpMyAdmin installation.\n-- Paste this entire file into the SQL tab and click Go, or use Import.\n-- Existing data is preserved. No shared administrator password is installed.\nCREATE DATABASE IF NOT EXISTS `sakto_meals` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE `sakto_meals`;\n\n";
$schema = str_replace('-- Import into a database named sakto_meals in phpMyAdmin, then run scripts/setup.php.', '-- Schema and sample data are both included below.', file_get_contents($root.'/server/schema.sql'));
$sql .= $schema."\nSTART TRANSACTION;\n";
foreach ($seed['meals'] as $meal) $sql .= insertMissing('meals', ['id'=>$meal['id'], ...\Sakto\Validators::meal($meal)], 'slug');
foreach ($seed['packages'] as $package) $sql .= insertMissing('packages', $package);
foreach ($seed['zones'] as $zone) $sql .= insertMissing('delivery_zones', $zone);
$sql .= insertMissing('settings', ['id'=>'main','cutoffHours'=>24,'deliveryWindow'=>'8:00 AM – 12:00 PM','supportedDays'=>[0,1,2,3,4,5,6]]);
$sql .= "COMMIT;\nSELECT 'Database ready' AS result, (SELECT COUNT(*) FROM meals) AS meals;\n";
file_put_contents($root.'/database.sql', $sql);
echo "Created database.sql with schema, meals, packages, delivery areas, and settings.\n";
