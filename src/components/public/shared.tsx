"use client";

import { useEffect, useState } from "react";
import { PublicImage as Image } from "@/components/food-image";
import Link from "@/lib/router";
import { ArrowUpRight, ArrowRight, Check, Leaf } from "lucide-react";
import { api } from "@/lib/client";
import { Meal, Package, money } from "@/lib/types";
import "./public.css";

export function usePublicData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api<T>(path).then(result => { if (live) { setData(result); setError(""); } }).catch((error: Error) => { if (live) setError(error.message); });
    return () => { live = false; };
  }, [path, attempt]);
  return { data, error, retry: () => setAttempt(x => x + 1) };
}

export function DataError({ error, retry }: { error: string; retry: () => void }) {
  return <div className="public-data-error" role="alert"><p>{error}</p><button className="button-secondary" onClick={retry}>Try again</button></div>;
}

export function MealCard({ meal }: { meal: Meal }) {
  return <article className="public-meal-card">
    <Link href={`/meals/${meal.slug}`} className="public-meal-photo" aria-label={`View ${meal.name}`}>
      <Image src={meal.image} alt={meal.name} width={640} height={480} sizes="(max-width: 640px) 95vw, (max-width: 1000px) 48vw, 25vw" />
      <span className="public-photo-tag">{meal.tags[0] || meal.category}</span>
      <span className="public-photo-arrow"><ArrowUpRight size={19} /></span>
    </Link>
    <div className="public-meal-body"><div className="public-meal-title"><h3><Link href={`/meals/${meal.slug}`}>{meal.name}</Link></h3><strong>{money(meal.price)}</strong></div>
      <p>{meal.description}</p>
      <div className="public-meal-macros"><span><strong>{meal.calories}</strong> kcal</span><span><strong>{meal.protein}g</strong> protein</span><span>{meal.carbs}g carbs</span><span>{meal.fat}g fat</span></div>
    </div>
  </article>;
}

export function SectionTitle({ eyebrow, title, text, link }: { eyebrow: string; title: string; text?: string; link?: { href: string; label: string } }) {
  return <div className="public-section-heading"><div><span className="public-eyebrow"><span />{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>{link && <Link href={link.href} className="public-text-link">{link.label}<ArrowUpRight size={19} /></Link>}</div>;
}

export function Packages({ compact = false }: { compact?: boolean }) {
  const { data, error, retry } = usePublicData<Package[]>("/api/packages");
  if (error) return <DataError error={error} retry={retry} />;
  if (!data) return <div className="public-loading" role="status">Preparing the menu of possibilities…</div>;
  const packages = data.filter(p => p.active);
  return <><div className={`public-packages ${compact ? "public-packages-compact" : ""}`}>
    {packages.map((pack, index) => <article className={`public-package ${index === 1 ? "public-package-featured" : ""}`} key={pack.id}>
      <div className="public-package-top"><span className="public-package-index">0{index + 1}</span>{index === 1 && <span className="public-package-pick">A little of everything</span>}</div>
      <h3>{pack.name}</h3><p>{pack.description}</p><div className="public-package-price">{money(pack.price)}<span>guide / week</span></div>
      <ul><li><Check size={16} />{pack.mealCount > 0 ? `${pack.mealCount} meals in your week` : "Your choice of meals & days"}</li><li><Check size={16} />Personalized meal selection</li><li><Check size={16} />Swap meals before checkout</li><li><Check size={16} />Clear calories & macros</li></ul>
      <Link className={index === 1 ? "button public-yellow-button" : "button-secondary"} href="/onboarding">Choose {pack.name}<ArrowUpRight size={17} /></Link>
    </article>)}
  </div><p className="public-fineprint">Capstone demo pricing. Package prices are guides; your selected meals and delivery days determine the final total. All payments are simulated.</p></>;
}

export const faqs = [
  ["Can I choose and swap my own meals?", "Absolutely. Start with a suggested week, then swap meals, adjust available portions, remove selections, or add a meal. Lock your favorites before regenerating to keep them in place. Your draft saves to your account."],
  ["How are nutrition targets calculated?", "For eligible adults, we estimate energy needs from the Mifflin–St Jeor equation and your activity level. BMI and meal nutrition are estimates, not a diagnosis or medical prescription. You can review the calculation in your profile. Seek qualified advice for specialized dietary needs."],
  ["What if I have a food allergy?", "Declared allergens are excluded from personalized recommendations. Each meal lists its ingredients and allergens. This academic prototype cannot guarantee kitchen cross-contact controls, so it is not suitable for making real-world allergy safety decisions."],
  ["How do subscriptions and delivery work?", "Choose your meals and supported delivery days, then select an available delivery zone at checkout. The current delivery window, cutoff, and fees are shown before confirmation. This prototype records the schedule; no real meals are dispatched."],
  ["Can I pause or cancel my subscription?", "Yes. You can pause, resume, or cancel a subscription from your dashboard. These actions change future renewal status; they do not cancel an already confirmed order. There is no automatic billing in the prototype."],
  ["Will I be charged at checkout?", "No. GCash, Maya, and card selections are simulated for the capstone demonstration. No real payment is processed, and you should never enter real card or wallet credentials. A successful demo checkout creates an order and subscription in the application."]
];

export function FAQ() {
  return <section className="public-section public-faq-section"><div className="container public-faq-layout"><div><span className="public-eyebrow"><span />GOOD QUESTIONS</span><h2>A little clarity,<br />before you dig in.</h2><p>Everything you need to make the week your own.</p><Link href="/contact" className="public-text-link">Still curious? Talk to us<ArrowUpRight size={18} /></Link></div><div className="public-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>;
}

export function FinalCTA() {
  return <section className="public-final-cta"><div className="container"><Leaf size={33} strokeWidth={1.5} /><p className="public-eyebrow">A LITTLE PLANNING. A LOT OF SARAP.</p><h2>Your next delicious<br />week starts here.</h2><Link href="/onboarding" className="button public-yellow-button">Let’s build my week<ArrowRight size={19} /></Link><p>Made for your taste. Planned around your life.</p></div><span className="public-cta-circle public-cta-circle-one" /><span className="public-cta-circle public-cta-circle-two" /></section>;
}

export function PublicPageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <header className="public-page-header container"><span className="public-eyebrow"><span />{eyebrow}</span><h1>{title}</h1>{children && <div className="public-page-intro">{children}</div>}</header>;
}

export { PublicImage } from "@/components/food-image";
