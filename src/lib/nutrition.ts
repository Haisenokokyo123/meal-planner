import type { Nutrition, Profile } from "./types";

const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 } as const;
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/** Educational adult estimates only. A meal plan is not a record of consumption. */
export function calculateNutrition(profile: Profile): Nutrition {
  if (!Number.isInteger(profile.age) || profile.age < 1 || profile.age > 120) {
    throw new Error("Enter an age between 1 and 120 years.");
  }
  if (profile.age < 18 || profile.specialNeeds) {
    return {
      bmi: null, bmr: null, energy: null, target: null, protein: null, carbs: null, fat: null,
      explanation: "Personalized nutrition calculations are unavailable for people under 18 or those needing specialized nutrition advice. You can still choose meals by ingredients, preferences, and schedule. Ask a qualified professional about individual nutrition needs.",
    };
  }
  if (!Number.isFinite(profile.height) || profile.height < 100 || profile.height > 250) {
    throw new Error("Enter an adult height between 100 and 250 centimeters.");
  }
  if (!Number.isFinite(profile.weight) || profile.weight < 30 || profile.weight > 350) {
    throw new Error("Enter an adult weight between 30 and 350 kilograms.");
  }
  if (!(profile.activity in ACTIVITY_FACTORS)) throw new Error("Select a supported activity level.");
  if (!["female", "male", "unspecified"].includes(profile.sex)) throw new Error("Select a supported optional calculation coefficient.");
  if (profile.calorieTarget !== null && (!Number.isFinite(profile.calorieTarget) || profile.calorieTarget < 1200 || profile.calorieTarget > 5000)) {
    throw new Error("An optional adult calorie target must be between 1,200 and 5,000 kcal. This range does not establish individual suitability.");
  }

  const bmi = oneDecimal(profile.weight / (profile.height / 100) ** 2);
  const coefficient = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : null;
  const rawBmr = coefficient === null ? null : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + coefficient;
  const rawEnergy = rawBmr === null ? null : rawBmr * ACTIVITY_FACTORS[profile.activity];
  const energy = rawEnergy === null ? null : Math.round(rawEnergy);
  const estimatedTarget = rawEnergy === null ? null : Math.round(rawEnergy / 10) * 10;
  const target = profile.calorieTarget ?? (estimatedTarget !== null && estimatedTarget >= 1200 && estimatedTarget <= 5000 ? estimatedTarget : null);
  const proteinShare = profile.goal === "protein" ? 0.3 : 0.25;
  const fatShare = 0.3;
  const explanation = [
    coefficient === null
      ? "No sex-based calculation coefficient was supplied, so resting and daily energy needs are not estimated. Eligible adults can supply an optional manual target."
      : `Mifflin–St Jeor uses weight (kg), height (cm), age, and the optional ${profile.sex} physiological coefficient to estimate resting energy. Daily energy multiplies this estimate by ${ACTIVITY_FACTORS[profile.activity]} for your selected activity.`,
    profile.calorieTarget !== null ? "Your calorie target is the manual value you entered; its suitability has not been clinically assessed."
      : target !== null ? "The default calorie target reflects estimated maintenance energy; no automatic calorie deficit is applied."
        : coefficient !== null ? "This estimate is outside the prototype's supported automatic target range. Discuss an appropriate target with a qualified professional." : "",
    target !== null ? `Optional macro guidance uses ${Math.round(proteinShare * 100)}% protein, ${Math.round((1 - proteinShare - fatShare) * 100)}% carbohydrate, and 30% fat; grams use 4, 4, and 9 kcal per gram respectively.` : "",
    "These are educational estimates, not diagnosis or medical advice. BMI is limited context and is not used to rank meals. Scheduled meal nutrition is not confirmed food intake.",
  ].filter(Boolean).join(" ");

  return {
    bmi,
    bmr: rawBmr === null ? null : Math.round(rawBmr),
    energy,
    target,
    protein: target === null ? null : oneDecimal(target * proteinShare / 4),
    carbs: target === null ? null : oneDecimal(target * (1 - proteinShare - fatShare) / 4),
    fat: target === null ? null : oneDecimal(target * fatShare / 9),
    explanation,
  };
}
