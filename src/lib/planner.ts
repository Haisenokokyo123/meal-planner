import { calculateNutrition } from "./nutrition";
import type { Meal, MealTime, PlanSlot, Profile, Totals } from "./types";

const SLOT_ORDER: MealTime[] = ["breakfast", "lunch", "dinner"];
const SLOT_SHARE: Record<MealTime, number> = { breakfast: 0.25, lunch: 0.375, dinner: 0.375 };
const EPSILON = 0.000001;
const BEAM_WIDTH = 72;
const MAX_FALLBACK_NODES = 60_000;
const round = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;
const normal = (text: string) => text.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const ALLERGEN_TERMS: Record<string, string[]> = {
  milk: ["milk", "dairy", "cheese", "butter", "cream", "yogurt", "yoghurt", "whey", "casein"],
  eggs: ["egg", "eggs", "mayonnaise"],
  soy: ["soy", "soya", "soybeans", "soybean", "tofu", "tempeh"],
  wheat: ["wheat", "flour", "breadcrumbs", "bread crumbs", "soy sauce"],
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts"],
  "tree nuts": ["tree nut", "tree nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia"],
  fish: ["fish", "bangus", "tuna", "salmon", "tilapia", "anchovy", "anchovies", "sardines", "patis"],
  shellfish: ["shellfish", "shrimp", "shrimps", "prawn", "prawns", "crab", "lobster", "mussel", "mussels", "oyster", "oysters", "clam", "clams", "squid", "bagoong"],
  sesame: ["sesame", "tahini"],
};
const MEAT = ["chicken", "pork", "beef", "lamb", "duck", "turkey", "bacon", "ham", "sausage", "gelatin", "lard"];

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(text);
}

function allergenGroup(value: string): string {
  const normalized = normal(value);
  return Object.keys(ALLERGEN_TERMS).find(key => ALLERGEN_TERMS[key].includes(normalized)) ?? normalized;
}

function hasAllergen(meal: Meal, allergen: string): boolean {
  const group = allergenGroup(allergen);
  const declared = meal.allergens.map(allergenGroup);
  if (declared.includes(group)) return true;
  const terms = ALLERGEN_TERMS[group] ?? [normal(allergen)];
  return meal.ingredients.some(ingredient => {
    let description = normal(ingredient);
    // Unambiguously named plant ingredients are not dairy or shellfish.
    if (group === "milk") description = description.replace(/\b(?:coconut|almond|soy|soya|oat|rice|cashew|pea|peanut|vegan)\s+(?:milk|cream|butter|cheese)\b/g, "");
    if (group === "shellfish") description = description.replace(/\boyster mushrooms?\b/g, "");
    if (group === "wheat") description = description.replace(/\b(?:rice|corn|chickpea|almond|coconut|cassava|tapioca|buckwheat)\s+flour\b/g, "");
    return terms.some(term => containsTerm(description, term));
  });
}

function matchesDiet(meal: Meal, restriction: string): boolean {
  const tags = new Set(meal.tags.map(normal));
  const diet = normal(restriction);
  const plantBased = tags.has("plant based") || tags.has("vegan");
  const vegetarian = plantBased || tags.has("vegetarian");
  const meat = meal.ingredients.some(ingredient => MEAT.some(term => containsTerm(normal(ingredient), term)));
  if (diet === "plant based" || diet === "vegan") {
    return plantBased && !meat && !["fish", "shellfish", "milk", "eggs"].some(allergen => hasAllergen(meal, allergen));
  }
  if (diet === "vegetarian") return vegetarian && !meat && !hasAllergen(meal, "fish") && !hasAllergen(meal, "shellfish");
  if (diet === "pescatarian") return (vegetarian || tags.has("pescatarian")) && !meat;
  if (diet === "dairy free") return (plantBased || tags.has(diet)) && !hasAllergen(meal, "milk");
  if (diet === "gluten free") {
    return tags.has(diet) && !hasAllergen(meal, "wheat") && !meal.ingredients.some(ingredient => ["barley", "rye", "malt"].some(term => containsTerm(normal(ingredient), term)));
  }
  if (diet === "no pork") return tags.has(diet) && !meal.ingredients.some(ingredient => ["pork", "bacon", "ham", "lard"].some(term => containsTerm(normal(ingredient), term)));
  // Positive labeling is required. In particular, halal is never inferred from an ingredient list.
  return tags.has(diet);
}

/** Hard safety and catalog filters, shared by generation and manual editing. */
export function isMealEligible(meal: Meal, profile: Profile, slot?: MealTime): boolean {
  if (!meal.available || !Number.isFinite(meal.capacity) || meal.capacity <= 0) return false;
  if (!Number.isSafeInteger(meal.price) || meal.price < 0) return false;
  if (![meal.calories, meal.protein, meal.carbs, meal.fat].every(value => Number.isFinite(value) && value >= 0) || meal.calories <= 0) return false;
  if (!meal.portions.some(portion => Number.isFinite(portion) && portion > 0 && portion <= meal.capacity + EPSILON)) return false;
  if (slot && !meal.slots.includes(slot)) return false;
  return !profile.allergies.some(allergen => hasAllergen(meal, allergen)) && profile.dietary.every(diet => matchesDiet(meal, diet));
}

/** Prices are integer centavos, rounded per line; nutrition is rounded only after summing. */
export function calculateTotals(slots: PlanSlot[]): Totals {
  const totals: Totals = { price: 0, calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: slots.length };
  for (const { meal, portion } of slots) {
    if (!Number.isFinite(portion) || portion <= 0) throw new Error("A meal portion must be a positive number.");
    totals.price += Math.round(meal.price * portion);
    totals.calories += meal.calories * portion;
    totals.protein += meal.protein * portion;
    totals.carbs += meal.carbs * portion;
    totals.fat += meal.fat * portion;
  }
  for (const key of ["calories", "protein", "carbs", "fat"] as const) totals[key] = round(totals[key]);
  return totals;
}

function validateSchedule(profile: Profile): void {
  if (!profile.days.length || !profile.slots.length) throw new Error("Choose at least one delivery day and one meal slot.");
  if (new Set(profile.days).size !== profile.days.length || profile.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Delivery days must be unique days from Monday through Sunday.");
  if (new Set(profile.slots).size !== profile.slots.length || profile.slots.some(slot => !SLOT_ORDER.includes(slot))) throw new Error("Choose unique supported breakfast, lunch, or dinner slots.");
  if (!Number.isSafeInteger(profile.budget) || profile.budget < 0) throw new Error("Set a valid weekly meal budget in centavos.");
}

/** Validate a partial or complete plan; pass the live catalog to detect changed meals. */
export function validatePlan(slots: PlanSlot[], profile: Profile, meals?: Meal[]): void {
  validateSchedule(profile);
  const catalog = meals ? new Map(meals.map(meal => [meal.id, meal])) : null;
  const positions = new Set<string>();
  const ids = new Set<string>();
  const quantities = new Map<string, number>();
  const currentSlots: PlanSlot[] = [];
  for (const selection of slots) {
    const meal = catalog ? catalog.get(selection.mealId) : selection.meal;
    const label = selection.locked ? "Locked meal conflict" : "Meal selection conflict";
    if (!profile.days.includes(selection.day) || !profile.slots.includes(selection.slot)) throw new Error(`${label}: the selected delivery day or meal slot is no longer in your schedule.`);
    const position = `${selection.day}:${selection.slot}`;
    if (positions.has(position) || ids.has(selection.id)) throw new Error(`${label}: duplicate meal slots are not allowed.`);
    positions.add(position);
    ids.add(selection.id);
    if (!meal || meal.id !== selection.mealId || !isMealEligible(meal, profile, selection.slot)) throw new Error(`${label}: ${meal?.name ?? "this meal"} is unavailable or conflicts with current allergy, dietary, or meal-slot requirements. Choose another meal or update the conflicting setting.`);
    if (!Number.isFinite(selection.portion) || selection.portion <= 0 || !meal.portions.includes(selection.portion)) throw new Error(`${label}: the selected portion is unavailable for ${meal.name}.`);
    const capacityKey = `${selection.day}:${meal.id}`;
    const quantity = (quantities.get(capacityKey) ?? 0) + selection.portion;
    if (quantity > meal.capacity + EPSILON) throw new Error(`${label}: ${meal.name} exceeds its preparation capacity for this delivery day. Choose another meal or a smaller supported portion.`);
    quantities.set(capacityKey, quantity);
    currentSlots.push({ ...selection, meal });
  }
  if (calculateTotals(currentSlots).price > profile.budget) throw new Error("The selected meals exceed your weekly meal budget. Increase the meal budget, unlock an expensive selection, or choose fewer meals. Delivery fees are separate.");
}

interface Candidate { meal: Meal; portion: number; price: number; baseScore: number }
interface Position { day: number; slot: MealTime; candidates: Candidate[] }
interface SearchState { slots: PlanSlot[]; price: number; score: number; quantities: Record<string, number>; repeats: Record<string, number>; categories: Record<string, number> }

function tieValue(value: string, seed: number): number {
  let hash = seed | 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  return hash >>> 0;
}

function candidateScore(meal: Meal, portion: number, profile: Profile, slot: MealTime, favorites: Set<string>, perMealBudget: number): number {
  const nutrition = calculateNutrition(profile);
  const fit = (actual: number, target: number) => Math.max(0, 1 - Math.abs(actual - target) / Math.max(target, 1));
  // Missing energy inputs produce neutral nutrition scoring; lower energy never means healthier.
  let nutritionFit = 0.5;
  if (nutrition.target !== null && nutrition.protein !== null && nutrition.carbs !== null && nutrition.fat !== null) {
    const share = SLOT_SHARE[slot];
    nutritionFit = fit(meal.calories * portion, nutrition.target * share) * 0.5
      + fit(meal.protein * portion, nutrition.protein * share) * 0.25
      + fit(meal.carbs * portion, nutrition.carbs * share) * 0.125
      + fit(meal.fat * portion, nutrition.fat * share) * 0.125;
  }
  const descriptor = normal([meal.name, meal.category, ...meal.tags, ...meal.ingredients].join(" "));
  const matches = profile.preferences.filter(preference => containsTerm(descriptor, normal(preference))).length;
  const dislikes = profile.dislikes.filter(dislike => meal.ingredients.some(ingredient => containsTerm(normal(ingredient), normal(dislike)))).length;
  const spiceFit = profile.spice === "mild" && meal.tags.some(tag => ["spicy", "hot"].includes(normal(tag))) ? -0.3 : 0;
  const preferenceFit = Math.max(0, Math.min(1, 0.5 + (profile.preferences.length ? matches / profile.preferences.length * 0.5 : 0) - dislikes * 0.5 + spiceFit));
  const affordability = Math.max(0, 1 - Math.round(meal.price * portion) / Math.max(perMealBudget, 1));
  return nutritionFit * 35 + preferenceFit * 25 + affordability * 15 + (favorites.has(meal.id) ? 5 : 0);
}

function canAdd(state: SearchState, position: Position, candidate: Candidate, budget: number): boolean {
  return state.price + candidate.price <= budget && (state.quantities[`${position.day}:${candidate.meal.id}`] ?? 0) + candidate.portion <= candidate.meal.capacity + EPSILON;
}

function append(state: SearchState, position: Position, candidate: Candidate): SearchState {
  const count = state.repeats[candidate.meal.id] ?? 0;
  const categoryCount = state.categories[candidate.meal.category] ?? 0;
  const variety = 16 / (count + 1) + 4 / (categoryCount + 1);
  const dayDuplicate = state.slots.some(slot => slot.day === position.day && slot.mealId === candidate.meal.id);
  const explanation = [
    count === 0 ? "Selected to add variety to your week." : "Selected from meals compatible with your schedule and remaining budget.",
    "Fits your declared allergy and dietary filters and weekly meal budget.",
    "Nutrition values are estimates; kitchen cross-contact cannot be guaranteed.",
  ].join(" ");
  return {
    slots: [...state.slots, { id: `day-${position.day}-${position.slot}`, day: position.day, slot: position.slot, mealId: candidate.meal.id, meal: candidate.meal, portion: candidate.portion, locked: false, explanation }],
    price: state.price + candidate.price,
    score: state.score + candidate.baseScore + variety - (dayDuplicate ? 8 : 0),
    quantities: { ...state.quantities, [`${position.day}:${candidate.meal.id}`]: (state.quantities[`${position.day}:${candidate.meal.id}`] ?? 0) + candidate.portion },
    repeats: { ...state.repeats, [candidate.meal.id]: count + 1 },
    categories: { ...state.categories, [candidate.meal.category]: categoryCount + 1 },
  };
}

function completionLowerBound(state: SearchState, remaining: Position[]): number {
  let required = 0;
  for (const position of remaining) {
    let cheapest = Infinity;
    for (const candidate of position.candidates) {
      if ((state.quantities[`${position.day}:${candidate.meal.id}`] ?? 0) + candidate.portion <= candidate.meal.capacity + EPSILON) cheapest = Math.min(cheapest, candidate.price);
    }
    required += cheapest;
  }
  return required;
}

/** Bounded, deterministic whole-week beam search with a budget-first backtracking fallback. */
export function generatePlan(meals: Meal[], profile: Profile, lockedSlots: PlanSlot[] = [], favorites: string[] = [], seed = 0): PlanSlot[] {
  validateSchedule(profile);
  calculateNutrition(profile); // Validate inputs even if the catalog is empty.
  const catalog = new Map(meals.map(meal => [meal.id, meal]));
  const locked = lockedSlots.filter(slot => slot.locked).map(slot => ({ ...slot, meal: catalog.get(slot.mealId) ?? slot.meal }));
  validatePlan(locked, profile, meals);
  const initial: SearchState = { slots: locked, price: calculateTotals(locked).price, score: 0, quantities: {}, repeats: {}, categories: {} };
  for (const slot of locked) {
    const key = `${slot.day}:${slot.mealId}`;
    initial.quantities[key] = (initial.quantities[key] ?? 0) + slot.portion;
    initial.repeats[slot.mealId] = (initial.repeats[slot.mealId] ?? 0) + 1;
    initial.categories[slot.meal.category] = (initial.categories[slot.meal.category] ?? 0) + 1;
  }
  const favoriteIds = new Set(favorites);
  const positions: Position[] = [];
  const perMealBudget = profile.budget / (profile.days.length * profile.slots.length);
  for (const day of [...profile.days].sort((a, b) => a - b)) {
    for (const slot of SLOT_ORDER.filter(value => profile.slots.includes(value))) {
      if (locked.some(selection => selection.day === day && selection.slot === slot)) continue;
      const candidates = meals.filter(meal => isMealEligible(meal, profile, slot)).flatMap(meal => [...new Set(meal.portions)]
        .filter(portion => Number.isFinite(portion) && portion > 0 && portion <= meal.capacity + EPSILON)
        .map(portion => ({ meal, portion, price: Math.round(meal.price * portion), baseScore: candidateScore(meal, portion, profile, slot, favoriteIds, perMealBudget) })));
      candidates.sort((a, b) => b.baseScore - a.baseScore || tieValue(`${a.meal.id}:${a.portion}`, seed) - tieValue(`${b.meal.id}:${b.portion}`, seed) || a.meal.id.localeCompare(b.meal.id) || a.portion - b.portion);
      if (!candidates.length) throw new Error(`No eligible ${slot} meals are available. Check your allergy and dietary filters, choose another meal slot, or ask the kitchen about availability. Allergies will never be relaxed automatically.`);
      positions.push({ day, slot, candidates });
    }
  }
  // Constrained positions first prevents flexible slots from consuming scarce options.
  positions.sort((a, b) => a.candidates.length - b.candidates.length || a.day - b.day || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const minimumRemainingPrice = completionLowerBound(initial, positions);
  if (!Number.isFinite(minimumRemainingPrice)) throw new Error("The locked meals leave insufficient kitchen capacity for the remaining slots. Unlock a meal or choose fewer slots; locked choices have been preserved.");
  if (initial.price + minimumRemainingPrice > profile.budget) throw new Error("Your weekly meal budget cannot cover the selected schedule and locked meals. Increase the meal budget, choose fewer slots, or unlock expensive meals. Delivery fees are separate.");

  let beam: SearchState[] = [initial];
  for (let index = 0; index < positions.length; index++) {
    const position = positions[index];
    const remaining = positions.slice(index + 1);
    const successors: SearchState[] = [];
    for (const state of beam) {
      for (const candidate of position.candidates) {
        if (!canAdd(state, position, candidate, profile.budget)) continue;
        const next = append(state, position, candidate);
        if (next.price + completionLowerBound(next, remaining) <= profile.budget) successors.push(next);
      }
    }
    if (!successors.length) { beam = []; break; }
    successors.sort((a, b) => b.score - a.score || a.price - b.price);
    // Retain cheap states as well as high-scoring states to preserve future budget choices.
    const best = successors.slice(0, BEAM_WIDTH - 12);
    const cheapest = successors.slice().sort((a, b) => a.price - b.price || b.score - a.score).slice(0, 12);
    beam = [...new Set([...best, ...cheapest])];
  }
  let result: SearchState | undefined = beam.sort((a, b) => b.score - a.score || a.price - b.price)[0];
  let visited = 0;
  let limitHit = false;
  if (!result) {
    const fallback = (state: SearchState, index: number): SearchState | undefined => {
      if (++visited > MAX_FALLBACK_NODES) { limitHit = true; return undefined; }
      if (index === positions.length) return state;
      const position = positions[index];
      const candidates = [...position.candidates].sort((a, b) => a.price - b.price || b.baseScore - a.baseScore);
      for (const candidate of candidates) {
        if (!canAdd(state, position, candidate, profile.budget)) continue;
        const next = append(state, position, candidate);
        if (next.price + completionLowerBound(next, positions.slice(index + 1)) > profile.budget) continue;
        const found = fallback(next, index + 1);
        if (found) return found;
        if (limitHit) break;
      }
      return undefined;
    };
    result = fallback(initial, 0);
  }
  if (!result) throw new Error(limitHit
    ? "The planner reached its search limit without finding a complete safe plan. Try fewer meal slots or unlock some meals; no over-budget or incomplete plan was saved."
    : "No complete plan meets your meal budget, daily kitchen capacity, portions, and locked choices. Try fewer slots, unlock meals, or ask the kitchen about availability. Allergy and dietary restrictions remain enforced.");
  const output = result.slots.sort((a, b) => a.day - b.day || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  validatePlan(output, profile, meals);
  return output;
}

/** Alternatives preserve the current portion and revalidate the entire edited plan. */
export function getAlternatives(meals: Meal[], profile: Profile, currentSlots: PlanSlot[], slotId: string): Meal[] {
  const target = currentSlots.find(slot => slot.id === slotId);
  if (!target) throw new Error("The selected meal slot no longer exists. Refresh your plan.");
  if (target.locked) return [];
  return meals.filter(meal => {
    if (meal.id === target.mealId || !isMealEligible(meal, profile, target.slot) || !meal.portions.includes(target.portion)) return false;
    try {
      validatePlan(currentSlots.map(slot => slot.id === slotId ? { ...slot, mealId: meal.id, meal } : slot), profile, meals);
      return true;
    } catch { return false; }
  }).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}
