import { describe, expect, it } from "vitest";
import { calculateNutrition } from "../src/lib/nutrition";
import type { Profile } from "../src/lib/types";

const profile: Profile = {
  age: 30, height: 175, weight: 70, sex: "male", activity: "moderate", goal: "balanced",
  dietary: [], allergies: [], dislikes: [], preferences: [], spice: "mild", days: [0, 1],
  slots: ["lunch", "dinner"], budget: 100000, calorieTarget: null, consent: true, specialNeeds: false,
};

describe("adult educational nutrition estimates", () => {
  it("uses centimeter-to-meter conversion for BMI and Mifflin–St Jeor for energy", () => {
    const result = calculateNutrition(profile);
    expect(result.bmi).toBe(22.9);
    expect(result.bmr).toBe(1649);
    expect(result.energy).toBe(2556);
    expect(result.target).toBe(2560);
    expect(result.explanation).toContain("1.55");
  });

  it("uses the declared female equation coefficient transparently", () => {
    const result = calculateNutrition({ ...profile, sex: "female" });
    expect(result.bmr).toBe(1483);
    expect(result.energy).toBe(2298);
    expect(result.explanation).toContain("female physiological coefficient");
  });

  it("does not invent an energy estimate when the optional coefficient is omitted", () => {
    const result = calculateNutrition({ ...profile, sex: "unspecified" });
    expect(result.bmi).toBe(22.9);
    for (const field of ["bmr", "energy", "target", "protein", "carbs", "fat"] as const) expect(result[field]).toBeNull();
  });

  it("supports a manual adult target without requiring the coefficient and computes grams", () => {
    const result = calculateNutrition({ ...profile, sex: "unspecified", calorieTarget: 2000 });
    expect(result.bmr).toBeNull();
    expect(result.target).toBe(2000);
    expect(result.protein).toBe(125);
    expect(result.carbs).toBe(225);
    expect(result.fat).toBe(66.7);
    expect(result.protein! * 4 + result.carbs! * 4 + result.fat! * 9).toBeCloseTo(2000, 0);
  });

  it("uses conservative optional protein guidance without a deficit", () => {
    const result = calculateNutrition({ ...profile, goal: "protein", calorieTarget: 2000 });
    expect(result.protein).toBe(150);
    expect(result.carbs).toBe(200);
    expect(result.fat).toBe(66.7);
    expect(calculateNutrition({ ...profile, goal: "manage" }).target).toBe(calculateNutrition(profile).target);
  });

  it.each([{ age: 17, specialNeeds: false }, { age: 30, specialNeeds: true }])("suppresses every metric, including manual targets, for ineligible profiles: %j", patch => {
    const result = calculateNutrition({ ...profile, ...patch, calorieTarget: 2000 });
    for (const field of ["bmi", "bmr", "energy", "target", "protein", "carbs", "fat"] as const) expect(result[field]).toBeNull();
    expect(result.explanation).toContain("qualified professional");
  });

  it.each([0, -1, NaN, Infinity, 99, 251])("rejects invalid adult height %s", height => {
    expect(() => calculateNutrition({ ...profile, height })).toThrow(/height/);
  });

  it.each([0, -1, NaN, Infinity, 29, 351])("rejects invalid adult weight %s", weight => {
    expect(() => calculateNutrition({ ...profile, weight })).toThrow(/weight/);
  });

  it.each([0, 121, 18.5, NaN])("rejects invalid age %s", age => {
    expect(() => calculateNutrition({ ...profile, age })).toThrow(/age/);
  });

  it.each([0, 1000, 5001, NaN, Infinity])("rejects an invalid manual target %s", calorieTarget => {
    expect(() => calculateNutrition({ ...profile, calorieTarget })).toThrow(/target/);
  });

  it("does not turn an extreme energy estimate into an automatic target", () => {
    const result = calculateNutrition({ ...profile, height: 100, weight: 30, age: 85, sex: "female", activity: "sedentary" });
    expect(result.energy).toBeGreaterThan(0);
    expect(result.target).toBeNull();
    expect(result.protein).toBeNull();
  });
});
