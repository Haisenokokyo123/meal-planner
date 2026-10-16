# Recommendation and nutrition methodology

The authoritative implementation is `server/Planner.php`, executed by PHP under XAMPP Apache. Its inputs are the current MySQL meal catalog, the saved customer profile, locked selections, and favorite meal IDs. It makes no external AI or medical-service calls. The TypeScript planner and nutrition modules are a tested reference implementation; PHP server validation determines what can be persisted or ordered.

## Hard constraints

Generation fills every requested day and meal time or reports an actionable failure. Day zero is Monday. An explicitly selected weekly meal budget is a hard limit on meals in integer centavos. Delivery charges are displayed separately at checkout.

Unavailable meals, unsuitable meal times, unsupported portions, invalid nutrition data, and zero capacity are excluded. Allergies and dietary restrictions are checked before scoring. Allergen aliases are normalized; ingredient terms provide an additional defensive check when a catalog label is incomplete. For example, tofu implies soy, milkfish implies fish, and cashew cream implies tree nuts. Coconut milk is not automatically treated as dairy, and oyster mushrooms are not treated as shellfish. This finite vocabulary is an extra safeguard, not a complete ingredient ontology: kitchen staff must maintain accurate ingredient and allergen declarations. Shared-kitchen cross-contact cannot be guaranteed by this prototype.

Dietary choices require affirmative catalog labels and reject contradictory ingredients. Vegetarian and plant-based choices exclude meat and fish; vegan choices also exclude eggs, dairy, and honey. Halal certification is never inferred. Favorites, taste preferences, and nutrition scores cannot override these restrictions.

Preparation capacity is measured in regular-portion units per meal per delivery day. Two 1.5 portions consume three units. The planner validates the customer's complete plan; checkout additionally checks already committed orders in a database transaction.

Locked slots keep their meal, portion, day, time, and persistence ID. Their cost, capacity, and repetition count reduce the remaining choices. A stale locked meal or incompatible changed preference produces a conflict; it is never silently replaced. Manual additions, swaps, and portion changes undergo the same complete-plan checks against current catalog records. Intentionally partial manually edited plans are allowed.

## Ranking and search

This is an explainable product heuristic, not a clinical recommendation or a guarantee of optimal nutrition.

Each eligible meal and supported portion receives a base score:

| Factor | Weight | Calculation |
| --- | ---: | --- |
| Nutrition fit | 35 | Closeness to slot energy and macro estimates, with energy weighted 50%, protein 25%, carbohydrates 12.5%, and fat 12.5% |
| Taste preference | 25 | Matched preference terms increase a neutral score; disliked ingredients and spicy meals for a mild preference decrease it |
| Affordability | 15 | Relative price compared with the weekly budget divided by selected meal count |
| Favorite | 5 | Added when the customer has favorited the dish |

Each closeness calculation is `max(0, 1 - abs(actual - target) / max(target, 1))`. Slot shares are 25% breakfast, 37.5% lunch, and 37.5% dinner. Selecting only lunch does not assign the entire daily calorie estimate to lunch. Missing eligible nutrition estimates produce a neutral nutrition score rather than rewarding low calorie meals.

During search, the first instance of a dish adds 16 variety points; further instances add `16 / (previous instances + 1)`. Categories similarly add up to four points. Repeating a dish on the same day subtracts eight points. Variety is encouraged, never imposed at the expense of hard constraints. Mild spice preferences affect ranking; medium and hot preferences currently carry no separate bonus.

The algorithm considers the whole week, with the most constrained positions first. Each step keeps up to 60 high-scoring states plus 12 low-cost states, removing duplicates. A lower-bound calculation prunes states that cannot afford the remaining schedule. This avoids the common greedy failure in which a flexible breakfast consumes the only affordable lunch option.

If the beam produces no complete plan, budget-first backtracking searches at most 60,000 nodes. Failure reports whether constraints are incompatible or the bounded search ran out of work. It never returns an incomplete or over-budget plan as a successful generated week. The bounded method is not guaranteed to find the mathematically highest-scoring plan or every feasible plan in very large catalogs.

The same profile, catalog, favorites, locks, and seed produce the same selected meals and portions, regardless of catalog order. Newly generated slot IDs are independent random values to avoid collisions between customers and weeks; locked IDs are preserved. A new seed can vary equivalent choices.

## Educational nutrition estimates

The supported adult estimate uses the Mifflin–St Jeor resting-energy formula:

`BMR = 10 × weight_kg + 6.25 × height_cm - 5 × age_years + coefficient`

The optional physiological coefficient is +5 for male or −161 for female. When omitted, the system does not invent BMR or daily energy. Activity factors are 1.2 (sedentary), 1.375 (light), 1.55 (moderate), and 1.725 (active). Daily energy is BMR multiplied by the chosen factor; the default target is maintenance energy rounded to the nearest ten kcal. The weight-management preference does not apply an automatic deficit.

The underlying equation is from Mifflin et al., *A new predictive equation for resting energy expenditure in healthy individuals*, American Journal of Clinical Nutrition (1990), DOI: [10.1093/ajcn/51.2.241](https://doi.org/10.1093/ajcn/51.2.241). The activity multipliers, meal shares, scoring weights, and macro distribution are explicit prototype assumptions, not clinically validated personalization.

Eligible adults can enter an optional manual target of 1,200–5,000 kcal. That accepted input range does not establish suitability for an individual. Automatic estimates outside that range do not become automatic targets. Users under 18 or reporting specialized nutrition needs receive no BMI, BMR, calorie target, or macro target, including no manual target; preference-based meal selection remains available.

BMI is `weight_kg / (height_cm / 100)²`, shown only as limited educational context and never used for ranking. Default optional macro shares are 25% protein, 45% carbohydrate, and 30% fat; the protein preference uses 30%, 40%, and 30%. Grams use four kcal per gram for protein/carbohydrate and nine for fat. All estimates explain their assumptions and limitations. Scheduled or purchased nutrition is never described as confirmed consumption.

Seed meal nutrition is illustrative per regular serving and is not laboratory verified. Portion nutrition scales proportionally. Prices round to centavos per order line; displayed aggregate nutrition rounds to one decimal after summing. Historical orders store their own item names, prices, portions, nutrition, and delivery dates.

## Validation

Run the database-independent suite with `php server/tests/planner.php` from the project directory, or use `C:\xampp\php\php.exe server\tests\planner.php` on Windows. It checks formula arithmetic, input bounds, restricted profiles, allergen aliases and ingredients, dietary contradictions, budget precision, daily fractional capacity, scarcity across slots, repeatable selection, unique IDs, locks, changed catalogs, alternatives, and aggregate rounding. API tests additionally cover persistence, access control, checkout integrity, and database transactions.
