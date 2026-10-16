"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "@/lib/router";
import { useParams } from "@/lib/router";
import { ArrowLeft, ArrowRight, Check, Heart, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import { api, useUser } from "@/lib/client";
import { DAYS, money, type Dashboard, type Meal, type MealTime, type Plan } from "@/lib/types";
import { DataError, MealCard, PublicImage, PublicPageHeader, SectionTitle, usePublicData } from "./shared";

export function MealCatalog() {
  const { data, error, retry } = usePublicData<Meal[]>("/api/meals");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [filter, setFilter] = useState("All meals");
  const [slot, setSlot] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const available = (data || []).filter(meal => meal.available);
  const categories = [...new Set(available.map(meal => meal.category))].sort();
  const allergens = [...new Set(available.flatMap(meal => meal.allergens))].sort();
  const meals = useMemo(() => (data || []).filter(meal => meal.available)
    .filter(meal => `${meal.name} ${meal.description} ${meal.ingredients.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(meal => !category || meal.category === category)
    .filter(meal => !slot || meal.slots.includes(slot as MealTime))
    .filter(meal => !excluded.some(allergen => meal.allergens.includes(allergen)))
    .filter(meal => filter === "High protein" ? meal.protein >= 30 : filter === "Plant based" ? meal.tags.some(tag => /vegan|vegetarian|plant/i.test(tag)) : true)
    .sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "protein" ? b.protein - a.protein : sort === "calories" ? a.calories - b.calories : a.name.localeCompare(b.name)), [data, query, category, slot, excluded, filter, sort]);
  function clear() { setQuery(""); setCategory(""); setSort("name"); setFilter("All meals"); setSlot(""); setExcluded([]); }

  return <div className="public-page"><PublicPageHeader eyebrow="GOOD FOOD. PLENTY OF POSSIBILITIES." title="Find your next favorite."><p>Familiar Filipino flavors, with a little thoughtful planning. Explore the menu and make room for something delicious.</p></PublicPageHeader><section className="container public-catalog" aria-label="Meal catalog">
    <div className="public-catalog-controls"><div className="field"><label htmlFor="meal-search">Search the menu</label><div className="public-search-input"><Search size={19} /><input id="meal-search" type="search" placeholder="Try adobo, tofu, or an ingredient…" value={query} onChange={event => setQuery(event.target.value)} /></div></div><div className="field"><label htmlFor="meal-category">Category</label><select id="meal-category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="meal-sort">Sort by</label><select id="meal-sort" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name, A to Z</option><option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option><option value="protein">Protein, high to low</option><option value="calories">Calories, low to high</option></select></div></div>
    <div className="public-filter-tabs" aria-label="Dietary filters">{["All meals", "High protein", "Plant based"].map(item => <button key={item} className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <details className="public-catalog-more"><summary><SlidersHorizontal size={16} />Meal time & allergen exclusions{excluded.length > 0 && <span className="badge">{excluded.length} excluded</span>}</summary><div className="public-catalog-more-content"><div className="field"><label htmlFor="meal-time">Meal time</label><select id="meal-time" value={slot} onChange={event => setSlot(event.target.value)}><option value="">Any time</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></div><fieldset><legend>Exclude declared allergens</legend><div className="public-allergen-options">{allergens.map(item => <label className="checkbox-label" key={item}><input type="checkbox" checked={excluded.includes(item)} onChange={event => setExcluded(previous => event.target.checked ? [...previous, item] : previous.filter(value => value !== item))} /><span>{item}</span></label>)}</div><p className="public-fineprint">Filters use declared ingredients. This prototype cannot guarantee freedom from cross-contact.</p></fieldset></div></details>
    {error ? <DataError error={error} retry={retry} /> : !data ? <div className="public-loading" role="status">Getting the menu ready…</div> : <><div className="public-catalog-result-bar"><p className="public-catalog-count" role="status">{meals.length} {meals.length === 1 ? "meal" : "meals"} to make your week a little better</p><button onClick={clear} className="public-text-link public-reset-button">Reset filters</button></div>{meals.length ? <div className="public-meal-grid">{meals.map(meal => <MealCard meal={meal} key={meal.id} />)}</div> : <div className="public-empty"><h2>No matches just yet.</h2><p>Try another ingredient or fewer filters to see more of the menu.</p><button className="button-secondary" onClick={clear}>Clear filters</button></div>}</>}
    <p className="public-fineprint">Nutrition figures and recipe photography are illustrative. Check each meal’s ingredients and declared allergens before selecting it. Prices are for the local capstone demonstration.</p>
  </section></div>;
}

function MealPlanAction({ meal }: { meal: Meal }) {
  const { user, loading } = useUser();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selection, setSelection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function loadPlan() {
    setOpen(true); setBusy(true); setError(""); setMessage("");
    try { const result = await api<Plan | null>("/api/plans"); setPlan(result); setSelection(""); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!plan || !selection || busy) return;
    const [day, slot] = selection.split(":");
    const existing = plan.slots.find(item => item.day === Number(day) && item.slot === slot);
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await api<Plan>(`/api/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ revision: plan.revision, action: existing ? "swap" : "add", ...(existing ? { slotId: existing.id } : { day: Number(day), slot }), mealId: meal.id }) });
      setPlan(updated); setMessage(`${meal.name} is saved for ${DAYS[Number(day)]} ${slot}. Your weekly meal total is now ${money(updated.totals.price)}.`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  if (!meal.available) return <div className="notice">This meal is currently unavailable. <Link href="/meals">Explore available meals →</Link></div>;
  if (loading) return <p className="public-fineprint" role="status">Checking your account…</p>;
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/meals/${meal.slug}`)}`} className="button">Log in to add to my week<ArrowRight size={18} /></Link>;
  return <div className="public-add-plan"><button type="button" className="button" onClick={loadPlan} disabled={busy}>{busy ? <LoaderCircle className="spinner" size={18} /> : <ArrowRight size={18} />}Add or swap in my week</button>
    {open && <div className="public-plan-picker">{error && <div className="public-form-message" data-error="true" role="alert">{error}<button type="button" className="public-text-link" onClick={loadPlan} disabled={busy}>Refresh my draft</button></div>}{message && <div className="public-form-message" role="status"><Check size={16} /> {message} <Link href="/planner">View my planner →</Link></div>}
      {!busy && !error && (!plan || plan.status !== "DRAFT") && <p>Create an editable weekly plan first, then add your favorite meals. <Link className="public-text-link" href="/planner">Open my planner<ArrowRight size={16} /></Link></p>}
      {plan?.status === "DRAFT" && <form onSubmit={save}><div className="field"><label htmlFor="detail-plan-slot">Choose a place in your week</label><select id="detail-plan-slot" value={selection} onChange={event => { setSelection(event.target.value); setMessage(""); }} required><option value="">Select a day and meal time</option>{plan.profile.days.flatMap(day => plan.profile.slots.filter(slot => meal.slots.includes(slot)).map(slot => { const current = plan.slots.find(item => item.day === day && item.slot === slot); return <option key={`${day}:${slot}`} value={`${day}:${slot}`} disabled={current?.locked}>{DAYS[day]} {slot}{current ? ` · ${current.locked ? "Locked: " : "Replace "}${current.meal.name}` : " · Empty"}</option>; }))}</select></div><p className="public-fineprint">Replacing a meal updates your saved draft. Locked meals stay protected. Your preferences, declared allergens, meal slots, and budget are checked before saving.</p><button type="submit" className="button-secondary" disabled={busy || !selection}>{busy ? "Saving…" : "Save this meal to my week"}</button></form>}
    </div>}
  </div>;
}

function FavoriteAction({ meal }: { meal: Meal }) {
  const { user } = useUser();
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (user) api<Dashboard>("/api/dashboard").then(result => { if (live) setFavorite(result.favorites.includes(meal.id)); }).catch(() => { if (live) setFavorite(null); });
    return () => { live = false; };
  }, [user, meal.id]);
  if (!user) return null;
  async function toggle() { setBusy(true); setError(""); try { const result = await api<string[]>("/api/favorites", { method: "POST", body: JSON.stringify({ mealId: meal.id }) }); setFavorite(result.includes(meal.id)); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }
  return <div className="public-favorite"><button type="button" className="public-text-link public-reset-button" onClick={toggle} aria-pressed={favorite === true} disabled={busy}><Heart size={18} fill={favorite ? "currentColor" : "none"} />{busy ? "Saving…" : favorite ? "Saved to favorites" : favorite === null ? "Toggle favorite" : "Save as a favorite"}</button>{error && <p role="alert">{error}</p>}</div>;
}

export function MealDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data: meal, error, retry } = usePublicData<Meal>(`/api/meals/${encodeURIComponent(slug || "")}`);
  const { data: allMeals } = usePublicData<Meal[]>("/api/meals");
  const related = (allMeals || []).filter(item => item.available && item.id !== meal?.id && (item.category === meal?.category || item.tags.some(tag => meal?.tags.includes(tag)))).slice(0, 3);
  return <div className="public-page"><div className="container"><Link href="/meals" className="public-back-link"><ArrowLeft size={15} />Back to the menu</Link>
    {error ? <div className="section-sm"><DataError error={error} retry={retry} /></div> : !meal ? <div className="public-loading" role="status">Setting the table…</div> : <article className="public-meal-detail"><div className="public-detail-image"><PublicImage src={meal.image} alt={meal.name} width={900} height={900} priority /><p className="public-fineprint">Recipe image is illustrative. Actual demonstration portions and presentation may differ.</p></div><div className="public-detail-copy"><span className="public-eyebrow"><span />{meal.category.toUpperCase()}</span><h1>{meal.name}</h1><p>{meal.description}</p><div className="public-detail-tags">{meal.tags.map(tag => <span key={tag}>{tag}</span>)}<span>{meal.available ? "Available to plan" : "Currently unavailable"}</span></div><div className="public-detail-price"><strong>{money(meal.price)}</strong><span>per standard serving · {meal.servingSize}</span></div><div className="public-nutrition-grid" aria-label="Estimated nutrition per standard serving"><div><strong>{meal.calories}</strong><span>kcal</span></div><div><strong>{meal.protein}g</strong><span>protein</span></div><div><strong>{meal.carbs}g</strong><span>carbs</span></div><div><strong>{meal.fat}g</strong><span>fat</span></div></div><MealPlanAction meal={meal} /><FavoriteAction meal={meal} />
      <section className="public-detail-section"><h2>What’s on your plate</h2><p>{meal.ingredients.join(", ") || "Ingredient information has not been provided."}</p></section><section className="public-detail-section"><h2>Declared allergens</h2><p>{meal.allergens.length ? meal.allergens.join(", ") : "No listed allergens in the demonstration recipe."}</p><p className="public-detail-note">Shared preparation areas may introduce cross-contact. This local prototype does not verify kitchen allergy controls.</p></section><section className="public-detail-section"><h2>Make it fit your day</h2><p>Suitable for {meal.slots.join(", ")}. Available portion multipliers: {meal.portions.map(portion => `${portion}×`).join(", ")}. Adjust supported portions in your weekly planner.</p></section><p className="public-fineprint">Calories and macros are recipe estimates for the standard serving. They are planning aids and are not a medical prescription or laboratory analysis.</p></div></article>}
    {!!related.length && <section className="public-related"><SectionTitle eyebrow="MORE TO LOVE" title="Keep exploring the table." link={{ href: "/meals", label: "See all meals" }} /><div className="public-meal-grid">{related.map(item => <MealCard key={item.id} meal={item} />)}</div></section>}
  </div></div>;
}
