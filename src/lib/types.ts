export type Role = "CUSTOMER" | "ADMIN";
export type MealTime = "breakfast" | "lunch" | "dinner";
export type Goal = "balanced" | "protein" | "maintain" | "manage" | "convenience";
export type Activity = "sedentary" | "light" | "moderate" | "active";
export interface User { id: string; name: string; email: string; role: Role; }
export interface Meal {
  id: string; slug: string; name: string; description: string; category: string;
  price: number; calories: number; protein: number; carbs: number; fat: number;
  servingSize: string; ingredients: string[]; allergens: string[]; tags: string[];
  slots: MealTime[]; image: string; available: boolean; capacity: number;
  portions: number[];
}
export interface Profile {
  age: number; height: number; weight: number; sex: "female" | "male" | "unspecified";
  activity: Activity; goal: Goal; dietary: string[]; allergies: string[];
  dislikes: string[]; preferences: string[]; spice: "mild" | "medium" | "hot";
  days: number[]; slots: MealTime[]; budget: number; calorieTarget: number | null;
  consent: boolean; specialNeeds: boolean;
}
export interface Nutrition {
  bmi: number | null; bmr: number | null; energy: number | null; target: number | null;
  protein: number | null; carbs: number | null; fat: number | null; explanation: string;
}
export interface Totals { price: number; calories: number; protein: number; carbs: number; fat: number; mealCount: number; }
export interface PlanSlot { id: string; day: number; slot: MealTime; mealId: string; meal: Meal; portion: number; locked: boolean; explanation: string; }
export interface Plan {
  id: string; weekStart: string; revision: number; status: "DRAFT" | "CONFIRMED";
  slots: PlanSlot[]; totals: Totals; profile: Profile; nutrition: Nutrition;
}
export interface Package { id: string; name: string; mealCount: number; price: number; description: string; active: boolean; }
export interface DeliveryZone { id: string; name: string; fee: number; active: boolean; }
export interface Settings { cutoffHours: number; deliveryWindow: string; supportedDays: number[]; }
export interface OrderItem { id: string; mealId: string; name: string; day: number; slot: string; deliveryDate: string; portion: number; price: number; calories: number; protein: number; carbs: number; fat: number; }
export type OrderStatus = "CONFIRMED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export interface Order {
  id: string; createdAt: string; status: OrderStatus; mealTotal: number; deliveryFee: number;
  total: number; address: string; zoneName: string; paymentMethod: string; items: OrderItem[];
  user?: User; history?: { status: string; createdAt: string }[]; exceptions?: string[];
}
export interface Subscription { id: string; status: "ACTIVE" | "PAUSED" | "CANCELLED"; packageName: string; weekStart: string; nextCycle: string; mealCount: number; }
export interface Dashboard { user: User; profile: Profile | null; nutrition: Nutrition | null; plans: Plan[]; orders: Order[]; subscriptions: Subscription[]; weights: { id: string; weight: number; date: string }[]; favorites: string[]; }
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const money = (centavos: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: centavos % 100 === 0 ? 0 : 2 }).format(centavos / 100);
