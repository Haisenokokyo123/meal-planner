<?php
declare(strict_types=1);

namespace Sakto;

// These pure-domain tests do not connect to MySQL or require an Apache session.
if (!class_exists(ApiError::class)) {
    class ApiError extends \RuntimeException {
        public function __construct(string $message, public int $status = 400) { parent::__construct($message); }
    }
}
require_once dirname(__DIR__) . '/Planner.php';

$tests = 0;
function check(bool $condition, string $message): void
{
    global $tests;
    $tests++;
    if (!$condition) throw new \RuntimeException('FAILED: ' . $message);
}
function rejects(callable $operation, string $phrase, string $message): void
{
    try { $operation(); } catch (ApiError $error) {
        check($error->status === 422 && str_contains(strtolower($error->getMessage()), strtolower($phrase)), $message . ': ' . $error->getMessage());
        return;
    }
    check(false, $message . ' did not reject');
}
function sampleMeal(string $id, array $patch = []): array
{
    return array_replace(['id' => $id, 'slug' => $id, 'name' => $id, 'description' => 'Filipino meal', 'category' => $id,
        'price' => 20000, 'calories' => 600, 'protein' => 40, 'carbs' => 65, 'fat' => 20, 'servingSize' => 'one bowl',
        'ingredients' => ['Chicken', 'rice', 'vegetables'], 'allergens' => [], 'tags' => ['Filipino', 'dairy-free'],
        'slots' => ['breakfast', 'lunch', 'dinner'], 'image' => '', 'available' => true, 'capacity' => 20, 'portions' => [1, 1.5]], $patch);
}
function selection(array $meal, array $patch = []): array
{
    return array_replace(['id' => 'locked-slot', 'day' => 0, 'slot' => 'lunch', 'mealId' => $meal['id'], 'meal' => $meal, 'portion' => 1,
        'locked' => true, 'explanation' => 'Customer selected this meal.'], $patch);
}
function choices(array $slots): array { return array_map(fn($slot) => [$slot['day'], $slot['slot'], $slot['mealId'], $slot['portion']], $slots); }

$profile = ['age' => 30, 'height' => 175, 'weight' => 70, 'sex' => 'male', 'activity' => 'moderate', 'goal' => 'balanced',
    'dietary' => [], 'allergies' => [], 'dislikes' => [], 'preferences' => [], 'spice' => 'mild', 'days' => [0, 1],
    'slots' => ['lunch', 'dinner'], 'budget' => 100000, 'calorieTarget' => null, 'consent' => true, 'specialNeeds' => false];

$n = Planner::nutrition($profile);
check($n['bmi'] === 22.9 && $n['bmr'] === 1649 && $n['energy'] === 2556 && $n['target'] == 2560, 'BMI conversion and male Mifflin energy');
$female = Planner::nutrition([...$profile, 'sex' => 'female']);
check($female['bmr'] === 1483 && $female['energy'] === 2298, 'female equation coefficient');
$none = Planner::nutrition([...$profile, 'sex' => 'unspecified']);
check($none['bmi'] === 22.9 && $none['energy'] === null && $none['target'] === null, 'optional coefficient remains optional');
$manual = Planner::nutrition([...$profile, 'sex' => 'unspecified', 'calorieTarget' => 2000]);
check($manual['bmr'] === null && $manual['protein'] == 125 && $manual['carbs'] == 225 && $manual['fat'] === 66.7, 'manual target macro grams');
$protein = Planner::nutrition([...$profile, 'goal' => 'protein', 'calorieTarget' => 2000]);
check($protein['protein'] == 150 && $protein['carbs'] == 200, 'protein preference heuristic');
check(Planner::nutrition([...$profile, 'goal' => 'manage'])['target'] === $n['target'], 'no automatic calorie deficit');
foreach ([['age' => 17], ['specialNeeds' => true]] as $patch) {
    $restricted = Planner::nutrition([...$profile, ...$patch, 'calorieTarget' => 2000]);
    foreach (['bmi', 'bmr', 'energy', 'target', 'protein', 'carbs', 'fat'] as $field) check($restricted[$field] === null, 'no adult calculation for restricted profile: ' . $field);
}
foreach ([0, -1, NAN, INF, 99, 251] as $value) rejects(fn() => Planner::nutrition([...$profile, 'height' => $value]), 'height', 'invalid height');
foreach ([0, -1, NAN, INF, 29, 351] as $value) rejects(fn() => Planner::nutrition([...$profile, 'weight' => $value]), 'weight', 'invalid weight');
foreach ([0, 121, 18.5, NAN] as $value) rejects(fn() => Planner::nutrition([...$profile, 'age' => $value]), 'age', 'invalid age');
foreach ([0, 1000, 5001, NAN, INF] as $value) rejects(fn() => Planner::nutrition([...$profile, 'calorieTarget' => $value]), 'target', 'invalid manual target');
rejects(fn() => Planner::nutrition([...$profile, 'activity' => '__proto__']), 'activity', 'invalid activity cannot address inherited keys');
check(Planner::nutrition([...$profile, 'height' => 100, 'weight' => 30, 'age' => 85, 'sex' => 'female', 'activity' => 'sedentary'])['target'] === null, 'extreme estimate does not become target');

$plant = sampleMeal('plant', ['ingredients' => ['Tofu', 'coconut milk', 'rice', 'oyster mushrooms'], 'allergens' => ['soy'], 'tags' => ['plant-based', 'gluten-free']]);
$safe = sampleMeal('safe');
$peanuts = sampleMeal('peanuts', ['allergens' => ['Peanut']]);
$plan = Planner::generate([$peanuts, $safe], [...$profile, 'allergies' => ['peanuts'], 'preferences' => ['peanuts']], [], ['peanuts']);
check(count(array_filter($plan, fn($slot) => $slot['mealId'] !== 'safe')) === 0, 'allergies override favorites and preferences');
foreach ([['Cashew cream', 'tree-nuts'], ['Tofu', 'soy'], ['Fish sauce', 'fish'], ['Grilled milkfish', 'fish']] as [$ingredient, $allergy]) {
    check(!Planner::eligible(sampleMeal('hidden', ['ingredients' => [$ingredient]]), [...$profile, 'allergies' => [$allergy]]), 'defensive ingredient allergen matching: ' . $ingredient);
}
check(!Planner::eligible(sampleMeal('milk', ['allergens' => ['MILK']]), [...$profile, 'allergies' => ['dairy']]), 'allergen aliases and case normalization');
check(Planner::eligible($plant, [...$profile, 'dietary' => ['plant-based', 'vegetarian', 'dairy-free', 'gluten-free'], 'allergies' => ['milk', 'shellfish']]), 'plant milk and oyster mushrooms are not animal ingredients');
check(!Planner::eligible($plant, [...$profile, 'allergies' => ['soy']]), 'plant meal still respects soy exclusion');
check(!Planner::eligible(sampleMeal('wrong-tag', ['tags' => ['plant-based']]), [...$profile, 'dietary' => ['plant-based']]), 'dietary tags cannot override contradictory ingredients');
check(!Planner::eligible(sampleMeal('honey', ['ingredients' => ['Honey', 'rice'], 'tags' => ['vegan']]), [...$profile, 'dietary' => ['vegan']]), 'vegan excludes honey');
check(!Planner::eligible($safe, [...$profile, 'dietary' => ['halal']]), 'halal requires affirmative labeling');
check(!Planner::eligible(sampleMeal('gluten', ['ingredients' => ['Soy sauce'], 'tags' => ['gluten-free']]), [...$profile, 'dietary' => ['gluten-free']]), 'gluten tag cannot override wheat ingredient');
check(Planner::eligible($safe, [...$profile, 'allergies' => ['__proto__']]), 'unknown custom allergy cannot crash matcher');
foreach ([['available' => false], ['portions' => []], ['capacity' => 0], ['capacity' => .5, 'portions' => [1]], ['price' => NAN], ['calories' => -1]] as $patch) check(!Planner::eligible(sampleMeal('invalid', $patch), $profile), 'invalid meal excluded');
check(!Planner::eligible(sampleMeal('lunch', ['slots' => ['lunch']]), $profile, 'breakfast'), 'meal slot eligibility');

$catalog = [sampleMeal('a'), sampleMeal('b'), sampleMeal('c'), sampleMeal('d')];
$first = Planner::generate($catalog, $profile, [], [], 7);
$second = Planner::generate(array_reverse($catalog), $profile, [], [], 7);
check(choices($first) === choices($second), 'same seed reproducible even when catalog order changes');
check(array_column($first, 'id') !== array_column($second, 'id'), 'separate plans have globally unique persistence IDs');
check(array_map(fn($slot) => [$slot['day'], $slot['slot']], $first) === [[0, 'lunch'], [0, 'dinner'], [1, 'lunch'], [1, 'dinner']], 'complete schedule in calendar order');
check(Planner::totals($first)['price'] <= $profile['budget'], 'generated plan stays within integer-centavo budget');
$variety = Planner::generate($catalog, [...$profile, 'budget' => 80000]);
check(count(array_unique(array_column($variety, 'mealId'))) === 4, 'comparable choices encourage variety');
$single = [...$profile, 'days' => [0], 'slots' => ['lunch'], 'budget' => 20000];
check(Planner::generate([sampleMeal('a'), sampleMeal('b')], $single, [], ['b'])[0]['mealId'] === 'b', 'favorite breaks comparable choice');
check(Planner::generate([sampleMeal('a', ['ingredients' => ['Cilantro']]), sampleMeal('b')], [...$single, 'dislikes' => ['cilantro']])[0]['mealId'] === 'b', 'dislike affects ranking');
$flexible = sampleMeal('flexible', ['slots' => ['breakfast', 'lunch'], 'capacity' => 1, 'portions' => [1], 'price' => 6000]);
$breakfast = sampleMeal('breakfast', ['slots' => ['breakfast'], 'portions' => [1], 'price' => 9000]);
$premium = sampleMeal('premium', ['slots' => ['lunch'], 'portions' => [1], 'price' => 20000]);
$scarce = Planner::generate([$flexible, $breakfast, $premium], [...$single, 'slots' => ['breakfast', 'lunch'], 'budget' => 15000]);
check(array_column($scarce, 'mealId') === ['breakfast', 'flexible'] && Planner::totals($scarce)['price'] === 15000, 'whole-week search reserves scarce affordable meal for lunch');
check(count(Planner::generate([sampleMeal('only', ['portions' => [1], 'capacity' => 2])], [...$profile, 'budget' => 80000])) === 4, 'capacity resets each delivery day');
rejects(fn() => Planner::generate([sampleMeal('fractional', ['portions' => [1.5], 'capacity' => 2])], [...$profile, 'budget' => 200000]), 'capacity', 'fractional portions count toward daily capacity');
$fractional = sampleMeal('rounding', ['price' => 10001, 'portions' => [1.5]]);
check(Planner::totals(Planner::generate([$fractional], [...$single, 'budget' => 15002]))['price'] === 15002, 'half-centavo money rounding');
rejects(fn() => Planner::generate([$fractional], [...$single, 'budget' => 15001]), 'budget', 'one-centavo budget shortage rejected');
rejects(fn() => Planner::generate([$plant], [...$profile, 'allergies' => ['soy']]), 'No eligible', 'no safe meals does not relax allergies');
rejects(fn() => Planner::generate([$safe], [...$profile, 'budget' => 79999]), 'budget', 'complete plan failure cannot return partial plan');
rejects(fn() => Planner::generate([$safe], [...$profile, 'days' => [7]]), 'days', 'invalid schedule day');
rejects(fn() => Planner::generate([$safe], [...$profile, 'days' => []]), 'Choose', 'empty schedule');
check(count(Planner::generate([$safe], [...$profile, 'age' => 17])) === 4, 'preference-only planning remains available to minors');

$expensive = sampleMeal('locked', ['price' => 50000, 'portions' => [1]]);
$lock = selection($expensive);
$cheap = sampleMeal('cheap', ['price' => 10000, 'portions' => [1]]);
$lockedPlan = Planner::generate([$expensive, $cheap], [...$profile, 'budget' => 80000], [$lock]);
check($lockedPlan[0] === $lock && Planner::totals($lockedPlan)['price'] === 80000, 'locked meal and ID preserved and charged against remaining budget');
rejects(fn() => Planner::generate([sampleMeal('locked', ['available' => false]), $cheap], $profile, [$lock]), 'Locked meal conflict', 'unavailable locked meal is not silently replaced');
rejects(fn() => Planner::generate([$cheap], $profile, [$lock]), 'Locked meal conflict', 'deleted locked meal rejected');
rejects(fn() => Planner::generate([$safe], $profile, [selection($safe, ['portion' => 2])]), 'portion', 'unsupported locked portion');
rejects(fn() => Planner::generate([$safe], [...$profile, 'days' => [1]], [selection($safe)]), 'schedule', 'locked day absent from schedule');
rejects(fn() => Planner::generate([$safe], [...$profile, 'budget' => 10000], [selection($safe)]), 'budget', 'locked selections cannot exceed budget');
rejects(fn() => Planner::validate([selection($safe), selection($safe, ['id' => 'other'])], $profile), 'duplicate', 'duplicate positions rejected');
rejects(fn() => Planner::validate([selection($safe)], $profile, []), 'unavailable', 'explicit empty catalog does not trust cached meal');
rejects(fn() => Planner::validate([selection($safe)], [...$profile, 'budget' => 20000], [sampleMeal('safe', ['price' => 20001])]), 'budget', 'live catalog price rechecked');
Planner::validate([selection($safe)], $profile, [$safe]);
check(true, 'deliberately partial manual plans are allowed');
$regenerated = Planner::generate([$safe], $profile, [selection(sampleMeal('removed'), ['locked' => false])]);
check(count(array_filter($regenerated, fn($slot) => $slot['mealId'] !== 'safe')) === 0, 'unlocked input selections regenerated');

$current = sampleMeal('current');
$slots = [selection($current, ['locked' => false, 'portion' => 1.5])];
$options = [$current, sampleMeal('valid', ['price' => 10000]), sampleMeal('expensive', ['price' => 21000]), sampleMeal('portion', ['portions' => [1]]), sampleMeal('allergen', ['allergens' => ['soy']]), sampleMeal('capacity', ['capacity' => 1])];
check(array_column(Planner::alternatives($options, [...$profile, 'allergies' => ['soy'], 'budget' => 30000], $slots, 'locked-slot'), 'id') === ['valid'], 'alternatives preserve portion and validate whole-plan safety, budget, capacity');
check(Planner::alternatives($options, $profile, [selection($current)], 'locked-slot') === [], 'locked meal has no replacement suggestions');
rejects(fn() => Planner::alternatives($options, $profile, $slots, 'missing'), 'no longer exists', 'missing alternative slot');

$decimal = sampleMeal('decimal', ['price' => 10001, 'calories' => 501, 'protein' => 31.3, 'carbs' => 64.4, 'fat' => 17.7]);
$total = Planner::totals([selection($decimal, ['portion' => 1.5]), selection($decimal, ['id' => 'tomorrow', 'day' => 1])]);
check($total['price'] === 25003 && $total['calories'] === 1252.5 && $total['protein'] === 78.3 && $total['carbs'] == 161 && $total['fat'] === 44.3 && $total['mealCount'] === 2, 'nutrition rounds after sum while prices round per line');
check(Planner::totals([])['price'] === 0 && Planner::totals([])['mealCount'] === 0, 'empty totals');
rejects(fn() => Planner::totals([selection($safe, ['portion' => -1])]), 'positive', 'negative portions cannot lower total');

fwrite(STDOUT, 'Passed ' . $tests . " PHP nutrition and planner assertions.\n");
