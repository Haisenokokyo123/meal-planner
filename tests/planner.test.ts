import { describe, expect, it } from "vitest";
import { calculateTotals, generatePlan, getAlternatives, isMealEligible, validatePlan } from "../src/lib/planner";
import type { Meal, PlanSlot, Profile } from "../src/lib/types";

const profile: Profile = {
  age: 30, height: 175, weight: 70, sex: "male", activity: "moderate", goal: "balanced",
  dietary: [], allergies: [], dislikes: [], preferences: [], spice: "mild", days: [0, 1],
  slots: ["lunch", "dinner"], budget: 100000, calorieTarget: null, consent: true, specialNeeds: false,
};
const meal = (id: string, patch: Partial<Meal> = {}): Meal => ({
  id, slug: id, name: id, description: "Filipino meal", category: id,
  price: 20000, calories: 600, protein: 40, carbs: 65, fat: 20,
  servingSize: "one bowl", ingredients: ["Chicken", "rice", "vegetables"], allergens: [],
  tags: ["Filipino", "dairy-free"], slots: ["breakfast", "lunch", "dinner"], image: "",
  available: true, capacity: 20, portions: [1, 1.5], ...patch,
});
const selection = (entry: Meal, patch: Partial<PlanSlot> = {}): PlanSlot => ({
  id: "locked-slot", day: 0, slot: "lunch", mealId: entry.id, meal: entry, portion: 1, locked: true,
  explanation: "Customer selected this meal.", ...patch,
});
const plant = meal("plant", { ingredients: ["Tofu", "coconut milk", "rice", "oyster mushrooms"], allergens: ["soy"], tags: ["plant-based", "gluten-free"] });

describe("hard eligibility filters", () => {
  it("enforces allergy aliases regardless of preference or favorite ranking", () => {
    const peanuts = meal("peanuts", { allergens: ["Peanut"], tags: ["protein"] });
    const plan = generatePlan([peanuts, meal("safe")], { ...profile, allergies: ["peanuts"], preferences: ["peanuts"] }, [], ["peanuts"]);
    expect(plan.every(slot => slot.mealId === "safe")).toBe(true);
  });

  it("checks ingredients defensively as well as declared allergens", () => {
    expect(isMealEligible(meal("hidden", { ingredients: ["Cashew cream"] }), { ...profile, allergies: ["tree-nuts"] })).toBe(false);
    expect(isMealEligible(meal("milk", { allergens: ["MILK"] }), { ...profile, allergies: ["dairy"] })).toBe(false);
    expect(isMealEligible(meal("soy", { ingredients: ["Tofu"] }), { ...profile, allergies: ["soy"] })).toBe(false);
    expect(isMealEligible(meal("sauce", { ingredients: ["Fish sauce"] }), { ...profile, allergies: ["fish"] })).toBe(false);
  });

  it("supports safely labeled plant foods without confusing coconut milk or oyster mushrooms with animal foods", () => {
    expect(isMealEligible(plant, { ...profile, dietary: ["plant-based", "vegetarian", "dairy-free", "gluten-free"], allergies: ["milk", "shellfish"] })).toBe(true);
    expect(isMealEligible(plant, { ...profile, allergies: ["soy"] })).toBe(false);
  });

  it("requires positive dietary labels and rejects contradictory ingredients", () => {
    expect(isMealEligible(meal("chicken"), { ...profile, dietary: ["vegetarian"] })).toBe(false);
    expect(isMealEligible(meal("wrong-tag", { tags: ["plant-based"] }), { ...profile, dietary: ["plant-based"] })).toBe(false);
    expect(isMealEligible(meal("unknown"), { ...profile, dietary: ["halal"] })).toBe(false);
    expect(isMealEligible(meal("gluten", { tags: ["gluten-free"], ingredients: ["Soy sauce"] }), { ...profile, dietary: ["gluten-free"] })).toBe(false);
  });

  it("filters unavailability, slots, malformed data, unavailable portions, and zero capacity", () => {
    expect(isMealEligible(meal("closed", { available: false }), profile)).toBe(false);
    expect(isMealEligible(meal("lunch", { slots: ["lunch"] }), profile, "breakfast")).toBe(false);
    expect(isMealEligible(meal("empty", { portions: [] }), profile)).toBe(false);
    expect(isMealEligible(meal("empty", { capacity: 0 }), profile)).toBe(false);
    expect(isMealEligible(meal("oversized", { capacity: 0.5, portions: [1] }), profile)).toBe(false);
    expect(isMealEligible(meal("bad-price", { price: NaN }), profile)).toBe(false);
    expect(isMealEligible(meal("bad-calories", { calories: -1 }), profile)).toBe(false);
  });
});

describe("complete weekly optimization", () => {
  it("fills every requested position, respects money units, and produces deterministic output", () => {
    const meals = [meal("a"), meal("b"), meal("c")];
    const first = generatePlan(meals, profile, [], [], 7);
    expect(first.map(slot => [slot.day, slot.slot])).toEqual([[0, "lunch"], [0, "dinner"], [1, "lunch"], [1, "dinner"]]);
    expect(calculateTotals(first).price).toBeLessThanOrEqual(profile.budget);
    expect(generatePlan(meals, profile, [], [], 7)).toEqual(first);
    expect(generatePlan([...meals].reverse(), profile, [], [], 7)).toEqual(first);
  });

  it("encourages variety among otherwise comparable choices", () => {
    const plan = generatePlan([meal("a"), meal("b"), meal("c"), meal("d")], { ...profile, budget: 80000 });
    expect(new Set(plan.map(slot => slot.mealId)).size).toBe(4);
  });

  it("uses favorites and disliked ingredients among nutritionally equivalent eligible dishes", () => {
    const single = { ...profile, days: [0], slots: ["lunch"] as const, budget: 20000 };
    expect(generatePlan([meal("a"), meal("b")], { ...single, slots: [...single.slots] }, [], ["b"])[0].mealId).toBe("b");
    expect(generatePlan([meal("a", { ingredients: ["Cilantro"] }), meal("b")], { ...single, slots: [...single.slots], dislikes: ["cilantro"] })[0].mealId).toBe("b");
  });

  it("searches across slots to reserve an affordable scarce meal for the slot that needs it", () => {
    const flexible = meal("flexible", { slots: ["breakfast", "lunch"], capacity: 1, portions: [1], price: 6000 });
    const breakfast = meal("breakfast", { slots: ["breakfast"], portions: [1], price: 9000 });
    const premiumLunch = meal("premium", { slots: ["lunch"], portions: [1], price: 20000 });
    const plan = generatePlan([flexible, breakfast, premiumLunch], { ...profile, days: [0], slots: ["breakfast", "lunch"], budget: 15000 });
    expect(plan.map(slot => slot.mealId)).toEqual(["breakfast", "flexible"]);
    expect(calculateTotals(plan).price).toBe(15000);
  });

  it("accounts for preparation capacity by delivery day and portion units", () => {
    const only = meal("only", { portions: [1], capacity: 2 });
    const plan = generatePlan([only], { ...profile, budget: 80000 });
    expect(plan).toHaveLength(4);
    expect(() => generatePlan([meal("fractional", { portions: [1.5], capacity: 2 })], { ...profile, budget: 200000 })).toThrow(/capacity/);
  });

  it("offers eligible larger portions without silently crossing the exact budget", () => {
    const meals = [meal("a", { price: 10001, portions: [1.5] })];
    const request = { ...profile, days: [0], slots: ["lunch"] as Profile["slots"], budget: 15002 };
    const plan = generatePlan(meals, request);
    expect(plan[0].portion).toBe(1.5);
    expect(calculateTotals(plan).price).toBe(15002);
    expect(() => generatePlan(meals, { ...request, budget: 15001 })).toThrow(/budget/);
  });

  it("returns a clear failure when no safe complete plan exists", () => {
    expect(() => generatePlan([plant], { ...profile, allergies: ["soy"] })).toThrow(/No eligible/);
    expect(() => generatePlan([meal("a")], { ...profile, budget: 79999 })).toThrow(/budget/);
    expect(() => generatePlan([meal("a", { capacity: 1 })], profile)).toThrow(/capacity/);
    expect(() => generatePlan([meal("a")], { ...profile, days: [7] })).toThrow(/Delivery days/);
    expect(() => generatePlan([meal("a")], { ...profile, days: [] })).toThrow(/Choose at least/);
  });

  it("continues preference-only planning for minors without adult calorie calculations", () => {
    const plan = generatePlan([meal("safe")], { ...profile, age: 17 });
    expect(plan).toHaveLength(4);
  });
});

describe("locked selections and manual plan validation", () => {
  it("preserves every locked selection and counts it against the remaining budget", () => {
    const entry = meal("locked", { price: 50000, portions: [1] });
    const locked = selection(entry);
    const before = JSON.stringify(locked);
    const plan = generatePlan([entry, meal("cheap", { price: 10000, portions: [1] })], { ...profile, budget: 80000 }, [locked]);
    expect(plan.find(slot => slot.id === locked.id)).toEqual(locked);
    expect(JSON.stringify(locked)).toBe(before);
    expect(calculateTotals(plan).price).toBe(80000);
  });

  it("regenerates unlocked input selections", () => {
    const old = selection(meal("removed"), { locked: false });
    const plan = generatePlan([meal("new")], profile, [old]);
    expect(plan.every(slot => slot.mealId === "new")).toBe(true);
  });

  it("reports stale availability and dietary conflicts rather than replacing a locked meal", () => {
    const entry = meal("a");
    const lock = selection(entry);
    expect(() => generatePlan([meal("a", { available: false }), meal("b")], profile, [lock])).toThrow(/Locked meal conflict/);
    expect(() => generatePlan([entry, plant], { ...profile, dietary: ["plant-based"] }, [lock])).toThrow(/Locked meal conflict/);
    expect(() => generatePlan([meal("b")], profile, [lock])).toThrow(/Locked meal conflict/);
  });

  it("rejects locked portions and schedule entries that are no longer supported", () => {
    const entry = meal("a");
    expect(() => generatePlan([entry], profile, [selection(entry, { portion: 2 })])).toThrow(/portion/);
    expect(() => generatePlan([entry], { ...profile, days: [1] }, [selection(entry)])).toThrow(/schedule/);
  });

  it("rejects locked meals above the budget and duplicate positions", () => {
    const entry = meal("a");
    expect(() => generatePlan([entry], { ...profile, budget: 10000 }, [selection(entry)])).toThrow(/budget/);
    expect(() => validatePlan([selection(entry), selection(entry, { id: "other" })], profile)).toThrow(/duplicate/);
  });

  it("allows deliberately partial plans and uses the current catalog for validation", () => {
    const entry = meal("a");
    expect(() => validatePlan([selection(entry)], profile, [entry])).not.toThrow();
    expect(() => validatePlan([selection(entry)], { ...profile, budget: 20000 }, [meal("a", { price: 20001 })])).toThrow(/budget/);
  });

  it("filters alternatives by current portion, safety, full-plan budget, and capacity", () => {
    const current = meal("current", { price: 20000 });
    const slots = [selection(current, { locked: false, portion: 1.5 })];
    const options = [current, meal("valid", { price: 10000 }), meal("expensive", { price: 21000 }), meal("portion", { portions: [1] }), meal("allergen", { allergens: ["soy"] }), meal("capacity", { capacity: 1 })];
    expect(getAlternatives(options, { ...profile, allergies: ["soy"], budget: 30000 }, slots, "locked-slot").map(option => option.id)).toEqual(["valid"]);
    expect(getAlternatives(options, profile, [{ ...slots[0], locked: true }], "locked-slot")).toEqual([]);
  });
});

describe("portion, daily, and weekly totals", () => {
  it("computes totals from the displayed stored meal records and fractional portions", () => {
    const entry = meal("dish", { price: 10001, calories: 501, protein: 31.3, carbs: 64.4, fat: 17.7 });
    const slots = [selection(entry, { portion: 1.5 }), selection(entry, { id: "tomorrow", day: 1, portion: 1 })];
    expect(calculateTotals(slots.filter(slot => slot.day === 0))).toEqual({ price: 15002, calories: 751.5, protein: 47, carbs: 96.6, fat: 26.6, mealCount: 1 });
    expect(calculateTotals(slots)).toEqual({ price: 25003, calories: 1252.5, protein: 78.3, carbs: 161, fat: 44.3, mealCount: 2 });
    expect(calculateTotals([])).toEqual({ price: 0, calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
  });

  it("rejects a malformed negative portion instead of lowering the budget total", () => {
    expect(() => calculateTotals([selection(meal("a"), { portion: -1 })])).toThrow(/positive/);
  });
});
