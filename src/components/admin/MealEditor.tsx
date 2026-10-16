"use client";
import { PublicImage } from "@/components/food-image";

import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import type { Meal, MealTime } from "@/lib/types";
import { Confirmation, type Mutate } from "./shared";

const emptyMeal: Omit<Meal, "id"> = {
  name: "", slug: "", description: "", category: "Chicken", price: 18900,
  calories: 500, protein: 30, carbs: 50, fat: 20, servingSize: "1 bowl (350 g)",
  ingredients: [], allergens: [], tags: [], slots: ["lunch", "dinner"],
  image: "", available: true, capacity: 100, portions: [1],
};
const split = (value: string) => [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function MealEditor({ meal, mutate, busy }: { meal?: Meal; mutate: Mutate; busy: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<Meal, "id">>(meal ?? emptyMeal);
  const [price, setPrice] = useState(String((meal?.price ?? emptyMeal.price) / 100));
  const [ingredients, setIngredients] = useState(meal?.ingredients.join(", ") ?? "");
  const [allergens, setAllergens] = useState(meal?.allergens.join(", ") ?? "");
  const [tags, setTags] = useState(meal?.tags.join(", ") ?? "");
  const [portions, setPortions] = useState(meal?.portions.join(", ") ?? "1");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const change = <K extends keyof Omit<Meal, "id">>(key: K, value: Omit<Meal, "id">[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = async () => {
    const parsedPortions = split(portions).map(Number);
    if (!form.slots.length) { setError("Choose at least one meal time."); return; }
    if (!parsedPortions.length || parsedPortions.some((portion) => !Number.isFinite(portion) || portion < 0.5 || portion > 2 || !Number.isInteger(portion * 2)) || !parsedPortions.includes(1)) { setError("Choose portion multipliers from 0.5, 1, 1.5, and 2. Include the standard portion 1."); return; }
    if (!split(ingredients).length) { setError("List the ingredients so customers can make an informed choice."); return; }
    const payload = { ...form, slug: slugify(form.slug || form.name), price: Math.round(Number(price) * 100), ingredients: split(ingredients), allergens: split(allergens).map((item) => item.toLowerCase()), tags: split(tags).map((item) => item.toLowerCase()), portions: parsedPortions };
    const saved = await mutate<Meal>(meal ? `/api/admin/meals/${meal.id}` : "/api/admin/meals", meal ? "PUT" : "POST", payload, meal ? "Meal updated. Future plans will use these details." : "Meal created and added to the catalog.");
    if (saved) router.push("/admin/meals");
  };

  return <>
    <div className="admin-title"><div><Link href="/admin/meals" className="admin-link-button"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: "middle" }} /> All meals</Link><h1>{meal ? "A little recipe refinement." : "Something good is cooking."}</h1><p>{meal ? "Update the catalog, nutrition, and availability. Existing order prices and nutrition stay recorded as purchased." : "Add a Filipino-inspired meal with clear ingredients, reliable nutrition estimates, and a beautiful photo."}</p></div></div>
    <form className="admin-form" onSubmit={(event) => { event.preventDefault(); setError(""); if (meal?.available && !form.available) setConfirm(true); else void save(); }}>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="card"><h2>On the menu</h2><div className="admin-form-grid">
        <label className="field">Meal name<input className="input" value={form.name} onChange={(event) => { change("name", event.target.value); if (!meal && (!form.slug || form.slug === slugify(form.name))) change("slug", slugify(event.target.value)); }} required minLength={3} maxLength={100} placeholder="Chicken Inasal & Red Rice" /></label>
        <label className="field">URL slug<input className="input" value={form.slug} onChange={(event) => change("slug", slugify(event.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} /><small>Used in the public meal link; lowercase words separated by hyphens.</small></label>
        <label className="field admin-full-width">Description<textarea className="input" value={form.description} onChange={(event) => change("description", event.target.value)} required minLength={10} maxLength={1500} placeholder="Tell customers what makes this bowl special." /></label>
        <label className="field">Category<input className="input" list="meal-categories" value={form.category} onChange={(event) => change("category", event.target.value)} required maxLength={50} /><datalist id="meal-categories"><option>Chicken</option><option>Fish</option><option>Plant-based</option><option>Beef</option><option>Pork</option><option>Breakfast</option></datalist></label>
        <label className="field">Base price (₱)<input className="input" type="number" min="1" max="10000" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /><small>The price for one standard portion, in Philippine pesos.</small></label>
        <label className="field admin-full-width">Local meal image path<input className="input" value={form.image} onChange={(event) => change("image", event.target.value)} required maxLength={1000} pattern="/images/[a-zA-Z0-9_-]+[.](webp|png|jpg|jpeg)" placeholder="/images/chicken-inasal.webp" /><small>Use an existing file in public/images, for example /images/chicken-inasal.webp.</small></label>
        {form.image && /^\/images\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(form.image) && <PublicImage className="admin-image-preview" src={form.image} alt={`${form.name || "Meal"} preview`} />}
      </div></section>
      <section className="card"><h2>Nutrition & ingredients</h2><p className="muted">All values describe one standard portion. These are estimates, not laboratory-certified nutrition facts.</p><div className="admin-form-grid">
        <label className="field admin-full-width">Standard serving size<input className="input" value={form.servingSize} onChange={(event) => change("servingSize", event.target.value)} required maxLength={100} placeholder="1 bowl (350 g)" /></label>
        {([ ["calories", "Calories (kcal)"], ["protein", "Protein (g)"], ["carbs", "Carbohydrates (g)"], ["fat", "Fat (g)"] ] as const).map(([key, label]) => <label className="field" key={key}>{label}<input className="input" type="number" min={key === "calories" ? "1" : "0"} max={key === "calories" ? "3000" : key === "carbs" ? "500" : "300"} step={key === "calories" ? "1" : "0.1"} inputMode="decimal" value={form[key]} onChange={(event) => change(key, Number(event.target.value))} required /></label>)}
        <label className="field admin-full-width">Ingredients<textarea className="input" value={ingredients} onChange={(event) => setIngredients(event.target.value)} required maxLength={3000} placeholder="Chicken breast, red rice, lemongrass, calamansi, garlic" /><small>Separate each ingredient with a comma.</small></label>
        <label className="field">Allergens<input className="input" value={allergens} onChange={(event) => setAllergens(event.target.value)} maxLength={500} placeholder="soy, wheat, fish" /><small>Comma-separated. Declare every known allergen; leave blank only if none are present.</small></label>
        <label className="field">Dietary tags<input className="input" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={500} placeholder="high-protein, dairy-free" /><small>Supported preferences include vegetarian, vegan, pescatarian, gluten-free, and dairy-free. Only add claims the recipe satisfies.</small></label>
      </div></section>
      <section className="card"><h2>Kitchen & availability</h2><div className="admin-form-grid">
        <label className="field">Daily preparation capacity<input className="input" type="number" min="0" max="10000" step="1" value={form.capacity} onChange={(event) => change("capacity", Number(event.target.value))} required /><small>Maximum meal units across confirmed orders for one delivery date.</small></label>
        <label className="field">Available portion multipliers<input className="input" value={portions} onChange={(event) => setPortions(event.target.value)} required placeholder="0.5, 1, 1.5, 2" /><small>Choose from 0.5, 1, 1.5, and 2, separated by commas. Include 1. Price and nutrition scale with each multiplier.</small></label>
        <fieldset className="admin-full-width" style={{ border: 0, padding: 0 }}><legend className="admin-detail-label">Available meal times</legend><div className="admin-checkbox-group">{(["breakfast", "lunch", "dinner"] as MealTime[]).map((slot) => <label key={slot} className="admin-checkbox"><input type="checkbox" checked={form.slots.includes(slot)} onChange={(event) => change("slots", event.target.checked ? [...form.slots, slot] : form.slots.filter((item) => item !== slot))} />{slot[0].toUpperCase() + slot.slice(1)}</label>)}</div></fieldset>
        <label className="admin-checkbox admin-full-width"><input type="checkbox" checked={form.available} onChange={(event) => change("available", event.target.checked)} />Available for new plans and orders</label>
        {!form.available && <div className="admin-warning admin-full-width">This meal will be excluded from new plans and checkout. Existing confirmed orders containing it will be flagged for review; their meals are never automatically substituted.</div>}
      </div></section>
      <div className="admin-form-footer"><p>Nutrition and prices apply to the standard portion.</p><Link href="/admin/meals" className="button button-secondary">Cancel</Link><button className="button" type="submit" disabled={busy}><Save size={16} />{busy ? "Saving…" : meal ? "Save meal" : "Create meal"}</button></div>
    </form>
    {confirm && <Confirmation title="Make this meal unavailable?" message="It will be excluded from new plans. Confirmed orders containing this meal will be flagged so your team can contact the customer and resolve fulfillment." action="Save & mark unavailable" onConfirm={() => void save()} onClose={() => setConfirm(false)} />}
  </>;
}
