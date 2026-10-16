<?php
declare(strict_types=1);
namespace Sakto;

final class Validators
{
    public static function text(mixed $value, string $field, int $min = 1, int $max = 100): string
    {
        if (!is_string($value)) throw new ApiError("$field must be text.");
        $value = trim($value);
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : preg_match_all('/./us', $value);
        if ($length === false || $length < $min || $length > $max) throw new ApiError("$field must contain $min–$max characters.");
        return $value;
    }
    public static function number(mixed $value, string $field, float $min, float $max, bool $integer = false): int|float
    {
        if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < $min || $value > $max || ($integer && floor($value) !== (float) $value)) throw new ApiError("$field must be " . ($integer ? 'an integer' : 'a number') . " between $min and $max.");
        return $integer ? (int) $value : $value;
    }
    public static function boolean(mixed $value, string $field): bool
    {
        if (!is_bool($value)) throw new ApiError("$field must be true or false.");
        return $value;
    }
    public static function choice(mixed $value, string $field, array $allowed): string
    {
        if (!is_string($value) || !in_array($value, $allowed, true)) throw new ApiError("Choose a valid $field.");
        return $value;
    }
    public static function list(mixed $value, string $field, int $min = 0, int $max = 30): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) < $min || count($value) > $max) throw new ApiError("$field must contain $min–$max items.");
        return $value;
    }
    private static function strings(mixed $value, string $field, int $min = 0): array
    {
        return array_map(fn($item) => self::text($item, $field, 1, 100), self::list($value, $field, $min));
    }
    private static function days(mixed $value): array
    {
        $days = array_map(fn($day) => self::number($day, 'Delivery day', 0, 6, true), self::list($value, 'Delivery days', 1, 7));
        if (count(array_unique($days)) !== count($days)) throw new ApiError('Delivery days must be unique.');
        sort($days);
        return $days;
    }
    private static function slots(mixed $value): array
    {
        $slots = array_map(fn($slot) => self::choice($slot, 'meal time', ['breakfast', 'lunch', 'dinner']), self::list($value, 'Meal times', 1, 3));
        if (count(array_unique($slots)) !== count($slots)) throw new ApiError('Meal times must be unique.');
        return $slots;
    }
    public static function email(string $value): string
    {
        $value = strtolower(trim($value));
        if (strlen($value) > 254 || !filter_var($value, FILTER_VALIDATE_EMAIL)) throw new ApiError('Enter a valid email address.');
        return $value;
    }
    public static function password(string $value): string
    {
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : preg_match_all('/./us', $value);
        if ($length === false || $length < 10 || strlen($value) > 72 || str_contains($value, "\0")) throw new ApiError('Use a password of at least 10 characters and at most 72 UTF-8 bytes.');
        return $value;
    }
    public static function profile(array $data): array
    {
        $result = [];
        foreach (['age' => [1, 120, true], 'height' => [100, 250, false], 'weight' => [30, 350, false], 'budget' => [100, 10000000, true]] as $key => $range) $result[$key] = self::number($data[$key] ?? null, $key, ...$range);
        $result['sex'] = self::choice($data['sex'] ?? null, 'sex', ['female', 'male', 'unspecified']);
        $result['activity'] = self::choice($data['activity'] ?? null, 'activity level', ['sedentary', 'light', 'moderate', 'active']);
        $result['goal'] = self::choice($data['goal'] ?? null, 'goal', ['balanced', 'protein', 'maintain', 'manage', 'convenience']);
        foreach (['dietary', 'allergies', 'dislikes', 'preferences'] as $key) $result[$key] = self::strings($data[$key] ?? null, $key);
        $result['spice'] = self::choice($data['spice'] ?? null, 'spice level', ['mild', 'medium', 'hot']);
        $result['days'] = self::days($data['days'] ?? null);
        $result['slots'] = self::slots($data['slots'] ?? null);
        if (!array_key_exists('calorieTarget', $data)) throw new ApiError('calorieTarget must be a number or null.');
        $result['calorieTarget'] = $data['calorieTarget'] === null ? null : self::number($data['calorieTarget'], 'Calorie target', 1200, 5000);
        if (($data['consent'] ?? null) !== true) throw new ApiError('Consent is required to save a nutrition profile.');
        $result['consent'] = true;
        $result['specialNeeds'] = self::boolean($data['specialNeeds'] ?? null, 'specialNeeds');
        return $result;
    }
    public static function meal(array $data): array
    {
        $result = [];
        foreach (['slug' => [1, 100], 'name' => [2, 100], 'description' => [10, 1500], 'category' => [2, 50], 'servingSize' => [2, 150], 'image' => [1, 160]] as $key => $range) $result[$key] = self::text($data[$key] ?? null, $key, ...$range);
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $result['slug'])) throw new ApiError('Use a lowercase slug with letters, numbers and hyphens.');
        if (!preg_match('~^/images/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$~D', $result['image'])) throw new ApiError('Choose an image in /images.');
        foreach (['price' => [1, 100000000, true], 'calories' => [1, 3000, true], 'protein' => [0, 300, false], 'carbs' => [0, 500, false], 'fat' => [0, 300, false], 'capacity' => [0, 10000, true]] as $key => $range) $result[$key] = self::number($data[$key] ?? null, $key, ...$range);
        $macroEnergy = $result['protein'] * 4 + $result['carbs'] * 4 + $result['fat'] * 9;
        if ($macroEnergy <= 0 || abs($macroEnergy - $result['calories']) > max(75, $result['calories'] * 0.2)) throw new ApiError('Calories and macronutrients are inconsistent. Check the values per regular serving.');
        foreach (['ingredients', 'allergens', 'tags'] as $key) $result[$key] = self::strings($data[$key] ?? null, $key, $key === 'ingredients' ? 1 : 0);
        $result['slots'] = self::slots($data['slots'] ?? null);
        $result['available'] = self::boolean($data['available'] ?? null, 'available');
        $result['portions'] = array_map(fn($portion) => self::number($portion, 'Portion', 0.5, 2), self::list($data['portions'] ?? null, 'Portions', 1, 4));
        foreach ($result['portions'] as $portion) if (floor($portion * 2) !== $portion * 2.0) throw new ApiError('Portions must increase in half-serving steps.');
        if (!in_array(1, $result['portions']) || count(array_unique($result['portions'])) !== count($result['portions'])) throw new ApiError('Portions must be unique and include a regular portion.');
        return $result;
    }
    public static function package(array $data): array
    {
        return [
            'name' => self::text($data['name'] ?? null, 'Package name', 2, 80),
            'mealCount' => self::number($data['mealCount'] ?? null, 'Meal count', 0, 21, true),
            'price' => self::number($data['price'] ?? null, 'Price', 0, 100000000, true),
            'description' => self::text($data['description'] ?? null, 'Description', 3, 500),
            'active' => self::boolean($data['active'] ?? null, 'active'),
        ];
    }
    public static function settings(array $data): array
    {
        return ['cutoffHours' => self::number($data['cutoffHours'] ?? null, 'Cutoff hours', 1, 168, true), 'deliveryWindow' => self::text($data['deliveryWindow'] ?? null, 'Delivery window', 3, 100), 'supportedDays' => self::days($data['supportedDays'] ?? null)];
    }
    public static function zones(array $data): array
    {
        $result = [];
        foreach (self::list($data, 'Delivery zones', 1, 30) as $zone) {
            if (!is_array($zone)) throw new ApiError('Each delivery zone must be an object.');
            $id = self::text($zone['id'] ?? null, 'Zone ID', 1, 100);
            if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $id)) throw new ApiError('Invalid delivery zone ID.');
            if (isset($result[$id])) throw new ApiError('Delivery zone IDs must be unique.');
            $result[$id] = ['id' => $id, 'name' => self::text($zone['name'] ?? null, 'Zone name', 2, 100), 'fee' => self::number($zone['fee'] ?? null, 'Delivery fee', 0, 100000000, true), 'active' => self::boolean($zone['active'] ?? null, 'active')];
        }
        return array_values($result);
    }
}
