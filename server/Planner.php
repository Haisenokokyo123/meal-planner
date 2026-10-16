<?php
declare(strict_types=1);

namespace Sakto;

/** Pure recommendation domain. Money is integer centavos; day zero is Monday. */
final class Planner
{
    private const ACTIVITY = ['sedentary' => 1.2, 'light' => 1.375, 'moderate' => 1.55, 'active' => 1.725];
    private const SLOTS = ['breakfast', 'lunch', 'dinner'];
    private const SHARE = ['breakfast' => .25, 'lunch' => .375, 'dinner' => .375];
    private const EPSILON = .000001;
    private const ALLERGENS = [
        'milk' => ['milk', 'dairy', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'whey', 'casein'],
        'eggs' => ['egg', 'eggs', 'mayonnaise'],
        'soy' => ['soy', 'soya', 'soybeans', 'soybean', 'tofu', 'tempeh'],
        'wheat' => ['wheat', 'flour', 'breadcrumbs', 'bread crumbs', 'soy sauce'],
        'peanuts' => ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
        'tree nuts' => ['tree nut', 'tree nuts', 'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia'],
        'fish' => ['fish', 'milkfish', 'bangus', 'tuna', 'salmon', 'tilapia', 'anchovy', 'anchovies', 'sardines', 'mackerel', 'patis'],
        'shellfish' => ['shellfish', 'shrimp', 'shrimps', 'prawn', 'prawns', 'crab', 'lobster', 'mussel', 'mussels', 'oyster', 'oysters', 'clam', 'clams', 'squid', 'bagoong'],
        'sesame' => ['sesame', 'tahini'],
    ];
    private const MEAT = ['chicken', 'pork', 'beef', 'lamb', 'duck', 'turkey', 'bacon', 'ham', 'sausage', 'gelatin', 'lard'];

    private static function fail(string $message): never { throw new ApiError($message, 422); }
    private static function finite(mixed $number): bool { return (is_int($number) || is_float($number)) && is_finite((float)$number); }
    private static function normal(string $text): string { return trim(preg_replace('/\s+/', ' ', str_replace(['_', '-'], ' ', strtolower($text)))); }
    private static function contains(string $text, string $term): bool { return $term !== '' && preg_match('/(^|[^a-z])' . preg_quote($term, '/') . '([^a-z]|$)/i', $text) === 1; }
    private static function totalEmpty(): array { return ['price' => 0, 'calories' => 0, 'protein' => 0, 'carbs' => 0, 'fat' => 0, 'mealCount' => 0]; }
    private static function portionSupported(array $meal, mixed $portion): bool
    {
        return self::finite($portion) && $portion > 0 && count(array_filter($meal['portions'], fn($allowed) => self::finite($allowed) && abs($allowed - $portion) < self::EPSILON)) > 0;
    }

    /** Educational adult estimates, never a diagnosis or an automatic deficit. */
    public static function nutrition(array $profile): array
    {
        $age = $profile['age'] ?? null;
        if (!self::finite($age) || floor($age) != $age || $age < 1 || $age > 120) self::fail('Enter an age between 1 and 120 years.');
        if ($age < 18 || ($profile['specialNeeds'] ?? false)) {
            return ['bmi' => null, 'bmr' => null, 'energy' => null, 'target' => null, 'protein' => null, 'carbs' => null, 'fat' => null,
                'explanation' => 'Personalized nutrition calculations are unavailable for people under 18 or those needing specialized nutrition advice. You can still choose meals by ingredients, preferences, and schedule. Ask a qualified professional about individual nutrition needs.'];
        }
        $height = $profile['height'] ?? null;
        $weight = $profile['weight'] ?? null;
        if (!self::finite($height) || $height < 100 || $height > 250) self::fail('Enter an adult height between 100 and 250 centimeters.');
        if (!self::finite($weight) || $weight < 30 || $weight > 350) self::fail('Enter an adult weight between 30 and 350 kilograms.');
        $activity = $profile['activity'] ?? '';
        $sex = $profile['sex'] ?? '';
        if (!array_key_exists($activity, self::ACTIVITY)) self::fail('Select a supported activity level.');
        if (!in_array($sex, ['male', 'female', 'unspecified'], true)) self::fail('Select a supported optional calculation coefficient.');
        $manual = $profile['calorieTarget'] ?? null;
        if ($manual !== null && (!self::finite($manual) || $manual < 1200 || $manual > 5000)) self::fail('An optional adult calorie target must be between 1,200 and 5,000 kcal. This range does not establish individual suitability.');
        $coefficient = $sex === 'male' ? 5 : ($sex === 'female' ? -161 : null);
        $bmr = $coefficient === null ? null : 10 * $weight + 6.25 * $height - 5 * $age + $coefficient;
        $energy = $bmr === null ? null : $bmr * self::ACTIVITY[$activity];
        $estimated = $energy === null ? null : round($energy / 10) * 10;
        $target = $manual ?? ($estimated !== null && $estimated >= 1200 && $estimated <= 5000 ? $estimated : null);
        $protein = ($profile['goal'] ?? '') === 'protein' ? .3 : .25;
        $explanation = [$coefficient === null
            ? 'No sex-based calculation coefficient was supplied, so resting and daily energy needs are not estimated. Eligible adults can supply an optional manual target.'
            : 'Mifflin–St Jeor uses weight (kg), height (cm), age, and the optional ' . $sex . ' physiological coefficient to estimate resting energy. Daily energy multiplies this estimate by ' . self::ACTIVITY[$activity] . ' for your selected activity.'];
        if ($manual !== null) $explanation[] = 'Your calorie target is the manual value you entered; its suitability has not been clinically assessed.';
        elseif ($target !== null) $explanation[] = 'The default calorie target reflects estimated maintenance energy; no automatic calorie deficit is applied.';
        elseif ($coefficient !== null) $explanation[] = 'This estimate is outside the prototype\'s supported automatic target range. Discuss an appropriate target with a qualified professional.';
        if ($target !== null) $explanation[] = 'Optional macro guidance uses ' . round($protein * 100) . '% protein, ' . round((.7 - $protein) * 100) . '% carbohydrate, and 30% fat; grams use 4, 4, and 9 kcal per gram respectively.';
        $explanation[] = 'These are educational estimates, not diagnosis or medical advice. BMI is limited context and is not used to rank meals. Scheduled meal nutrition is not confirmed food intake.';
        return ['bmi' => round($weight / ($height / 100) ** 2, 1), 'bmr' => $bmr === null ? null : (int)round($bmr), 'energy' => $energy === null ? null : (int)round($energy), 'target' => $target,
            'protein' => $target === null ? null : round($target * $protein / 4, 1), 'carbs' => $target === null ? null : round($target * (.7 - $protein) / 4, 1), 'fat' => $target === null ? null : round($target * .3 / 9, 1), 'explanation' => implode(' ', $explanation)];
    }

    private static function allergenGroup(string $allergen): string
    {
        $normal = self::normal($allergen);
        foreach (self::ALLERGENS as $group => $terms) if (in_array($normal, $terms, true)) return $group;
        return $normal;
    }

    private static function hasAllergen(array $meal, string $allergen): bool
    {
        $group = self::allergenGroup($allergen);
        foreach ($meal['allergens'] as $declared) if (self::allergenGroup($declared) === $group) return true;
        $terms = self::ALLERGENS[$group] ?? [self::normal($allergen)];
        foreach ($meal['ingredients'] as $ingredient) {
            $description = self::normal($ingredient);
            if ($group === 'milk') $description = preg_replace('/\b(?:coconut|almond|soy|soya|oat|rice|cashew|pea|peanut|vegan)\s+(?:milk|cream|butter|cheese)\b/', '', $description);
            if ($group === 'shellfish') $description = preg_replace('/\boyster mushrooms?\b/', '', $description);
            if ($group === 'wheat') $description = preg_replace('/\b(?:rice|corn|chickpea|almond|coconut|cassava|tapioca|buckwheat)\s+flour\b/', '', $description);
            foreach ($terms as $term) if (self::contains($description, $term)) return true;
        }
        return false;
    }

    private static function matchesDiet(array $meal, string $restriction): bool
    {
        $tags = array_map(self::normal(...), $meal['tags']);
        $diet = self::normal($restriction);
        $plant = in_array('plant based', $tags, true) || in_array('vegan', $tags, true);
        $vegetarian = $plant || in_array('vegetarian', $tags, true);
        $meat = false;
        foreach ($meal['ingredients'] as $ingredient) foreach (self::MEAT as $term) if (self::contains(self::normal($ingredient), $term)) $meat = true;
        if (in_array($diet, ['plant based', 'vegan'], true)) {
            if (!$plant || $meat) return false;
            foreach (['fish', 'shellfish', 'milk', 'eggs'] as $allergen) if (self::hasAllergen($meal, $allergen)) return false;
            foreach ($meal['ingredients'] as $ingredient) if (self::contains(self::normal($ingredient), 'honey')) return false;
            return true;
        }
        if ($diet === 'vegetarian') return $vegetarian && !$meat && !self::hasAllergen($meal, 'fish') && !self::hasAllergen($meal, 'shellfish');
        if ($diet === 'pescatarian') return ($vegetarian || in_array('pescatarian', $tags, true)) && !$meat;
        if ($diet === 'dairy free') return ($plant || in_array($diet, $tags, true)) && !self::hasAllergen($meal, 'milk');
        if ($diet === 'gluten free') {
            if (!in_array($diet, $tags, true) || self::hasAllergen($meal, 'wheat')) return false;
            foreach ($meal['ingredients'] as $ingredient) foreach (['barley', 'rye', 'malt'] as $term) if (self::contains(self::normal($ingredient), $term)) return false;
            return true;
        }
        if ($diet === 'no pork') {
            if (!in_array($diet, $tags, true)) return false;
            foreach ($meal['ingredients'] as $ingredient) foreach (['pork', 'bacon', 'ham', 'lard'] as $term) if (self::contains(self::normal($ingredient), $term)) return false;
            return true;
        }
        // Never infer halal certification from an ingredient list.
        return in_array($diet, $tags, true);
    }

    public static function eligible(array $meal, array $profile, ?string $slot = null): bool
    {
        if (!($meal['available'] ?? false) || !self::finite($meal['capacity'] ?? null) || $meal['capacity'] <= 0) return false;
        if (!self::finite($meal['price'] ?? null) || floor($meal['price']) != $meal['price'] || $meal['price'] < 0) return false;
        foreach (['calories', 'protein', 'carbs', 'fat'] as $field) if (!self::finite($meal[$field] ?? null) || $meal[$field] < 0) return false;
        if ($meal['calories'] <= 0 || !array_filter($meal['portions'], fn($portion) => self::finite($portion) && $portion > 0 && $portion <= $meal['capacity'] + self::EPSILON)) return false;
        if ($slot !== null && !in_array($slot, $meal['slots'], true)) return false;
        foreach ($profile['allergies'] as $allergen) if (self::hasAllergen($meal, $allergen)) return false;
        foreach ($profile['dietary'] as $restriction) if (!self::matchesDiet($meal, $restriction)) return false;
        return true;
    }

    /** Round money per line, nutrition after aggregation. */
    public static function totals(array $slots): array
    {
        $totals = self::totalEmpty();
        $totals['mealCount'] = count($slots);
        foreach ($slots as $slot) {
            $portion = $slot['portion'];
            if (!self::finite($portion) || $portion <= 0) self::fail('A meal portion must be a positive number.');
            $totals['price'] += (int)round($slot['meal']['price'] * $portion);
            foreach (['calories', 'protein', 'carbs', 'fat'] as $field) $totals[$field] += $slot['meal'][$field] * $portion;
        }
        foreach (['calories', 'protein', 'carbs', 'fat'] as $field) $totals[$field] = round($totals[$field], 1);
        return $totals;
    }

    private static function schedule(array $profile): void
    {
        if (!$profile['days'] || !$profile['slots']) self::fail('Choose at least one delivery day and one meal slot.');
        if (count(array_unique($profile['days'])) !== count($profile['days'])) self::fail('Delivery days must be unique days from Monday through Sunday.');
        foreach ($profile['days'] as $day) if (!is_int($day) || $day < 0 || $day > 6) self::fail('Delivery days must be unique days from Monday through Sunday.');
        if (count(array_unique($profile['slots'])) !== count($profile['slots']) || array_diff($profile['slots'], self::SLOTS)) self::fail('Choose unique supported breakfast, lunch, or dinner slots.');
        if (!is_int($profile['budget']) || $profile['budget'] < 0) self::fail('Set a valid weekly meal budget in centavos.');
    }

    public static function validate(array $slots, array $profile, array $meals = []): void
    {
        self::schedule($profile);
        // Omitted catalog means use embedded records; an explicitly empty live catalog means no meals.
        $useCatalog = func_num_args() >= 3;
        $catalog = array_column($meals, null, 'id');
        $positions = $ids = $quantities = $current = [];
        foreach ($slots as $selection) {
            $meal = $useCatalog ? ($catalog[$selection['mealId']] ?? null) : $selection['meal'];
            $label = $selection['locked'] ? 'Locked meal conflict' : 'Meal selection conflict';
            if (!in_array($selection['day'], $profile['days'], true) || !in_array($selection['slot'], $profile['slots'], true)) self::fail($label . ': the selected delivery day or meal slot is no longer in your schedule.');
            $position = $selection['day'] . ':' . $selection['slot'];
            if (isset($positions[$position]) || isset($ids[$selection['id']])) self::fail($label . ': duplicate meal slots are not allowed.');
            $positions[$position] = $ids[$selection['id']] = true;
            if (!$meal || $meal['id'] !== $selection['mealId'] || !self::eligible($meal, $profile, $selection['slot'])) self::fail($label . ': ' . ($meal['name'] ?? 'this meal') . ' is unavailable or conflicts with current allergy, dietary, or meal-slot requirements. Choose another meal or update the conflicting setting.');
            if (!self::portionSupported($meal, $selection['portion'])) self::fail($label . ': the selected portion is unavailable for ' . $meal['name'] . '.');
            $key = $selection['day'] . ':' . $meal['id'];
            $quantity = ($quantities[$key] ?? 0) + $selection['portion'];
            if ($quantity > $meal['capacity'] + self::EPSILON) self::fail($label . ': ' . $meal['name'] . ' exceeds its preparation capacity for this delivery day. Choose another meal or a smaller supported portion.');
            $quantities[$key] = $quantity;
            $current[] = [...$selection, 'meal' => $meal];
        }
        if (self::totals($current)['price'] > $profile['budget']) self::fail('The selected meals exceed your weekly meal budget. Increase the meal budget, unlock an expensive selection, or choose fewer meals. Delivery fees are separate.');
    }

    private static function score(array $meal, float $portion, array $profile, string $slot, array $favorites, float $budget, array $nutrition): float
    {
        $fit = static fn(float $actual, float $target): float => max(0, 1 - abs($actual - $target) / max($target, 1));
        $nutritionFit = .5;
        if ($nutrition['target'] !== null) {
            $share = self::SHARE[$slot];
            $nutritionFit = $fit($meal['calories'] * $portion, $nutrition['target'] * $share) * .5
                + $fit($meal['protein'] * $portion, $nutrition['protein'] * $share) * .25
                + $fit($meal['carbs'] * $portion, $nutrition['carbs'] * $share) * .125
                + $fit($meal['fat'] * $portion, $nutrition['fat'] * $share) * .125;
        }
        $descriptor = self::normal(implode(' ', [$meal['name'], $meal['category'], ...$meal['tags'], ...$meal['ingredients']]));
        $matches = count(array_filter($profile['preferences'], fn($preference) => self::contains($descriptor, self::normal($preference))));
        $dislikes = 0;
        foreach ($profile['dislikes'] as $dislike) {
            foreach ($meal['ingredients'] as $ingredient) if (self::contains(self::normal($ingredient), self::normal($dislike))) { $dislikes++; break; }
        }
        $spice = ($profile['spice'] === 'mild' && array_intersect(array_map(self::normal(...), $meal['tags']), ['spicy', 'hot'])) ? -.3 : 0;
        $preferenceFit = max(0, min(1, .5 + ($profile['preferences'] ? $matches / count($profile['preferences']) * .5 : 0) - $dislikes * .5 + $spice));
        $affordability = max(0, 1 - round($meal['price'] * $portion) / max($budget, 1));
        return $nutritionFit * 35 + $preferenceFit * 25 + $affordability * 15 + (in_array($meal['id'], $favorites, true) ? 5 : 0);
    }

    private static function canAdd(array $state, array $position, array $candidate, int $budget): bool
    {
        return $state['price'] + $candidate['price'] <= $budget && ($state['quantities'][$position['day'] . ':' . $candidate['meal']['id']] ?? 0) + $candidate['portion'] <= $candidate['meal']['capacity'] + self::EPSILON;
    }

    private static function append(array $state, array $position, array $candidate): array
    {
        $meal = $candidate['meal'];
        $count = $state['repeats'][$meal['id']] ?? 0;
        $categoryCount = $state['categories'][$meal['category']] ?? 0;
        $sameDay = false;
        foreach ($state['slots'] as $slot) if ($slot['day'] === $position['day'] && $slot['mealId'] === $meal['id']) { $sameDay = true; break; }
        // Search uses deterministic temporary position IDs. Persisted IDs are allocated once after selection.
        $state['slots'][] = ['id' => 'generated-' . $position['day'] . '-' . $position['slot'], 'day' => $position['day'], 'slot' => $position['slot'], 'mealId' => $meal['id'], 'meal' => $meal, 'portion' => $candidate['portion'], 'locked' => false,
            'explanation' => ($count === 0 ? 'Selected to add variety to your week.' : 'Selected from meals compatible with your schedule and remaining budget.') . ' Fits your declared allergy and dietary filters and weekly meal budget. Nutrition values are estimates; kitchen cross-contact cannot be guaranteed.'];
        $state['price'] += $candidate['price'];
        $state['score'] += $candidate['baseScore'] + 16 / ($count + 1) + 4 / ($categoryCount + 1) - ($sameDay ? 8 : 0);
        $key = $position['day'] . ':' . $meal['id'];
        $state['quantities'][$key] = ($state['quantities'][$key] ?? 0) + $candidate['portion'];
        $state['repeats'][$meal['id']] = $count + 1;
        $state['categories'][$meal['category']] = $categoryCount + 1;
        return $state;
    }

    private static function lowerBound(array $state, array $remaining): float
    {
        $required = 0;
        foreach ($remaining as $position) {
            $cheapest = INF;
            foreach ($position['candidates'] as $candidate) if (($state['quantities'][$position['day'] . ':' . $candidate['meal']['id']] ?? 0) + $candidate['portion'] <= $candidate['meal']['capacity'] + self::EPSILON) $cheapest = min($cheapest, $candidate['price']);
            $required += $cheapest;
        }
        return $required;
    }

    /** Bounded whole-week beam search with a budget-first backtracking fallback. */
    public static function generate(array $meals, array $profile, array $locked = [], array $favorites = [], int $seed = 0): array
    {
        self::schedule($profile);
        $nutrition = self::nutrition($profile);
        $catalog = array_column($meals, null, 'id');
        $locked = array_values(array_filter($locked, fn($slot) => $slot['locked']));
        foreach ($locked as &$slot) $slot['meal'] = $catalog[$slot['mealId']] ?? $slot['meal'];
        unset($slot);
        self::validate($locked, $profile, $meals);
        $initial = ['slots' => $locked, 'price' => self::totals($locked)['price'], 'score' => 0, 'quantities' => [], 'repeats' => [], 'categories' => []];
        $lockedPositions = [];
        foreach ($locked as $slot) {
            $key = $slot['day'] . ':' . $slot['mealId'];
            $initial['quantities'][$key] = ($initial['quantities'][$key] ?? 0) + $slot['portion'];
            $initial['repeats'][$slot['mealId']] = ($initial['repeats'][$slot['mealId']] ?? 0) + 1;
            $category = $slot['meal']['category'];
            $initial['categories'][$category] = ($initial['categories'][$category] ?? 0) + 1;
            $lockedPositions[$slot['day'] . ':' . $slot['slot']] = true;
        }
        $positions = [];
        $perMealBudget = $profile['budget'] / (count($profile['days']) * count($profile['slots']));
        $days = $profile['days']; sort($days);
        foreach ($days as $day) foreach (self::SLOTS as $slot) {
            if (!in_array($slot, $profile['slots'], true) || isset($lockedPositions[$day . ':' . $slot])) continue;
            $candidates = [];
            foreach ($meals as $meal) {
                if (!self::eligible($meal, $profile, $slot)) continue;
                foreach (array_unique($meal['portions']) as $portion) {
                    if (!self::finite($portion) || $portion <= 0 || $portion > $meal['capacity'] + self::EPSILON) continue;
                    $candidates[] = ['meal' => $meal, 'portion' => $portion, 'price' => (int)round($meal['price'] * $portion), 'baseScore' => self::score($meal, (float)$portion, $profile, $slot, $favorites, $perMealBudget, $nutrition), 'tie' => sprintf('%u', crc32($seed . ':' . $meal['id'] . ':' . $portion))];
                }
            }
            usort($candidates, fn($a, $b) => $b['baseScore'] <=> $a['baseScore'] ?: (float)$a['tie'] <=> (float)$b['tie'] ?: strcmp($a['meal']['id'], $b['meal']['id']) ?: $a['portion'] <=> $b['portion']);
            if (!$candidates) self::fail('No eligible ' . $slot . ' meals are available. Check your allergy and dietary filters, choose another meal slot, or ask the kitchen about availability. Allergies will never be relaxed automatically.');
            $positions[] = ['day' => $day, 'slot' => $slot, 'candidates' => $candidates];
        }
        usort($positions, fn($a, $b) => count($a['candidates']) <=> count($b['candidates']) ?: $a['day'] <=> $b['day'] ?: array_search($a['slot'], self::SLOTS) <=> array_search($b['slot'], self::SLOTS));
        $minimum = self::lowerBound($initial, $positions);
        if (!is_finite($minimum)) self::fail('The locked meals leave insufficient kitchen capacity for the remaining slots. Unlock a meal or choose fewer slots; locked choices have been preserved.');
        if ($initial['price'] + $minimum > $profile['budget']) self::fail('Your weekly meal budget cannot cover the selected schedule and locked meals. Increase the meal budget, choose fewer slots, or unlock expensive meals. Delivery fees are separate.');
        $bestFirst = static fn($a, $b) => $b['score'] <=> $a['score'] ?: $a['price'] <=> $b['price'];
        $cheapFirst = static fn($a, $b) => $a['price'] <=> $b['price'] ?: $b['score'] <=> $a['score'];
        $beam = [$initial];
        foreach ($positions as $index => $position) {
            $remaining = array_slice($positions, $index + 1);
            $successors = [];
            foreach ($beam as $state) foreach ($position['candidates'] as $candidate) {
                if (!self::canAdd($state, $position, $candidate, $profile['budget'])) continue;
                $next = self::append($state, $position, $candidate);
                if ($next['price'] + self::lowerBound($next, $remaining) <= $profile['budget']) $successors[] = $next;
            }
            if (!$successors) { $beam = []; break; }
            usort($successors, $bestFirst);
            $best = array_slice($successors, 0, 60);
            usort($successors, $cheapFirst);
            $beam = [...$best, ...array_slice($successors, 0, 12)];
            // Do not spend the beam twice on states appearing in both shortlists.
            $seen = []; $unique = [];
            foreach ($beam as $state) {
                $key = implode('|', array_map(fn($selection) => $selection['day'] . ':' . $selection['slot'] . ':' . $selection['mealId'] . ':' . $selection['portion'], $state['slots']));
                if (!isset($seen[$key])) { $seen[$key] = true; $unique[] = $state; }
            }
            $beam = $unique;
        }
        usort($beam, $bestFirst);
        $result = $beam[0] ?? null;
        $visited = 0; $limitHit = false;
        if ($result === null) {
            $fallback = function(array $state, int $index) use (&$fallback, &$visited, &$limitHit, $positions, $profile): ?array {
                if (++$visited > 60000) { $limitHit = true; return null; }
                if ($index === count($positions)) return $state;
                $position = $positions[$index];
                $candidates = $position['candidates'];
                usort($candidates, fn($a, $b) => $a['price'] <=> $b['price'] ?: $b['baseScore'] <=> $a['baseScore']);
                foreach ($candidates as $candidate) {
                    if (!self::canAdd($state, $position, $candidate, $profile['budget'])) continue;
                    $next = self::append($state, $position, $candidate);
                    if ($next['price'] + self::lowerBound($next, array_slice($positions, $index + 1)) > $profile['budget']) continue;
                    $found = $fallback($next, $index + 1);
                    if ($found !== null) return $found;
                    if ($limitHit) break;
                }
                return null;
            };
            $result = $fallback($initial, 0);
        }
        if ($result === null) self::fail($limitHit
            ? 'The planner reached its search limit without finding a complete safe plan. Try fewer meal slots or unlock some meals; no over-budget or incomplete plan was saved.'
            : 'No complete plan meets your meal budget, daily kitchen capacity, portions, and locked choices. Try fewer slots, unlock meals, or ask the kitchen about availability. Allergy and dietary restrictions remain enforced.');
        $output = $result['slots'];
        foreach ($output as &$slot) if (!$slot['locked']) $slot['id'] = bin2hex(random_bytes(16));
        unset($slot);
        usort($output, fn($a, $b) => $a['day'] <=> $b['day'] ?: array_search($a['slot'], self::SLOTS) <=> array_search($b['slot'], self::SLOTS));
        self::validate($output, $profile, $meals);
        return $output;
    }

    public static function alternatives(array $meals, array $profile, array $slots, string $slotId): array
    {
        $target = null;
        foreach ($slots as $slot) if ($slot['id'] === $slotId) { $target = $slot; break; }
        if ($target === null) self::fail('The selected meal slot no longer exists. Refresh your plan.');
        if ($target['locked']) return [];
        $options = [];
        foreach ($meals as $meal) {
            if ($meal['id'] === $target['mealId'] || !self::eligible($meal, $profile, $target['slot']) || !self::portionSupported($meal, $target['portion'])) continue;
            $proposed = array_map(fn($slot) => $slot['id'] === $slotId ? [...$slot, 'mealId' => $meal['id'], 'meal' => $meal] : $slot, $slots);
            try { self::validate($proposed, $profile, $meals); $options[] = $meal; } catch (ApiError) { /* This candidate breaks a hard constraint. */ }
        }
        usort($options, fn($a, $b) => $a['price'] <=> $b['price'] ?: strcmp($a['name'], $b['name']));
        return $options;
    }
}
