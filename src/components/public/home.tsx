"use client";

import { useEffect, useRef, useState } from "react";
import { PublicImage as Image } from "@/components/food-image";
import Link from "@/lib/router";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Flame, Heart, Leaf, RefreshCw, SlidersHorizontal, Sparkles, Sprout, Utensils } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Meal, money } from "@/lib/types";
import { DataError, FAQ, FinalCTA, MealCard, Packages, SectionTitle, usePublicData } from "./shared";

const choices = ["All favorites", "High protein", "Plant based"];
export function matchesMeal(meal: Meal, filter: string) {
  if (filter === "High protein") return meal.protein >= 30;
  if (filter === "Plant based") return meal.tags.some(tag => /vegan|vegetarian|plant/i.test(tag));
  return true;
}

export function Home() {
  const root = useRef<HTMLDivElement>(null);
  const { data: meals, error, retry } = usePublicData<Meal[]>("/api/meals");
  const [filter, setFilter] = useState(choices[0]);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro.from(".public-hero-line > span", { yPercent: 105, duration: 1, stagger: .1 })
          .from(".public-hero-copy .public-hero-enter", { y: 18, opacity: 0, duration: .7, stagger: .1 }, .25)
          .from(".public-hero-plate", { opacity: 0, scale: .84, y: 55, rotation: -8, duration: 1.25, stagger: .12 }, .2)
          .from(".public-floating-card, .public-hero-doodle", { scale: .8, opacity: 0, y: 22, duration: .7, stagger: .1 }, .9);
        gsap.utils.toArray<HTMLElement>(".public-reveal").forEach(section => {
          gsap.from(section, { y: 35, opacity: 0, duration: .8, scrollTrigger: { trigger: section, start: "top 92%", once: true } });
        });
        if (window.innerWidth > 900) gsap.to(".public-hero-composition", { y: 45, ease: "none", scrollTrigger: { trigger: ".public-hero", start: "top top", end: "bottom top", scrub: 1.5 } });
      }, root);
      return () => ctx.revert();
    });
    return () => media.revert();
  }, []);
  const featured = (meals || []).filter(m => m.available && matchesMeal(m, filter)).slice(0, 4);
  return <div className="public-home" ref={root}>
    <section className="public-hero">
      <div className="container public-hero-grid">
        <div className="public-hero-copy"><div className="public-hero-enter public-hero-eyebrow"><span className="public-mini-sun">✳</span> GOOD FOOD. YOUR KIND OF WEEK.</div>
          <h1><span className="public-hero-line"><span>Your week,</span></span><span className="public-hero-line"><span>made</span></span><span className="public-hero-line"><span className="public-delicious">delicious<span className="public-period">.</span></span></span></h1>
          <p className="public-hero-enter public-hero-description">Fresh Filipino-inspired meals, personalized to your goals, taste, schedule, and budget.</p>
          <div className="public-hero-enter public-hero-actions"><Link href="/onboarding" className="button">Build my week<ArrowUpRight size={21} /></Link><Link href="/meals" className="public-text-link">Explore the menu<ArrowRight size={18} /></Link></div>
          <div className="public-hero-enter public-hero-promises"><span><Check size={15} />Your meals, your way</span><span><Check size={15} />Filipino favorites</span></div>
        </div>
        <div className="public-hero-composition" aria-label="A spread of Filipino favorites: chicken inasal, adobo, grilled bangus, and tofu sisig">
          <div className="public-hero-orbit" />
          <div className="public-hero-plate public-plate-adobo"><Image src="/images/chicken-adobo.webp" alt="Tender chicken adobo with rice" width={500} height={500} sizes="(max-width: 700px) 36vw, 260px" priority /></div>
          <div className="public-hero-plate public-plate-bangus"><Image src="/images/grilled-bangus.webp" alt="Grilled bangus and colorful vegetables" width={500} height={500} sizes="(max-width: 700px) 32vw, 235px" priority /></div>
          <div className="public-hero-plate public-plate-inasal"><Image src="/images/chicken-inasal.webp" alt="Golden chicken inasal, garlic rice, and fresh vegetables" width={800} height={800} sizes="(max-width: 700px) 65vw, 430px" priority /></div>
          <div className="public-hero-plate public-plate-tofu"><Image src="/images/tofu-sisig.webp" alt="Golden tofu sisig with vegetables" width={400} height={400} sizes="(max-width: 700px) 32vw, 210px" /></div>
          <div className="public-floating-card public-float-top"><span className="public-float-icon"><Leaf size={21} /></span><div><strong>Fresh Filipino favorites</strong><span>A little taste of home.</span></div></div>
          <div className="public-floating-card public-float-bottom"><span className="public-float-icon public-float-icon-yellow"><SlidersHorizontal size={21} /></span><div><strong>Made to fit your life</strong><span>Your taste. Your pace. Your plan.</span></div></div>
          <span className="public-hero-doodle public-doodle-one" aria-hidden="true">✳</span><span className="public-hero-doodle public-doodle-two" aria-hidden="true">✧</span>
          <div className="public-sarap-stamp">Sarap sa kain.<br /><strong>Sakto sa goals.</strong><Heart size={17} /></div>
        </div>
      </div>
      <div className="public-hero-bottom container"><span>LESS “ANO’NG KAKAININ?”<br /><strong>MORE LOOKING FORWARD TO LUNCH.</strong></span><a href="#why-sakto" className="public-scroll-link">A fresh way to plan<span>↓</span></a><span className="public-hero-note">Thoughtfully planned.<br />Deliciously Filipino.</span></div>
    </section>
    <div className="public-ticker" aria-label="Sarap sa kain. Sakto sa goals."><div><span>SARAP SA KAIN</span><Sprout size={23} /><span>SAKTO SA GOALS</span><Sprout size={23} /><span>A WEEK THAT FEELS LIKE YOU</span><Sprout size={23} /><span>SARAP SA KAIN</span><Sprout size={23} /><span>SAKTO SA GOALS</span></div></div>
    <section className="public-section" id="why-sakto"><div className="container public-reveal"><SectionTitle eyebrow="THE SAKTO WAY" title="Good food. Less overthinking." text="Life is full. Your plate should feel just right." />
      <div className="public-values-grid">{[
        { icon: <SlidersHorizontal />, n: "01", title: "Personal to your plate.", copy: "Your goals, preferences, and appetite guide a plan that makes sense for you.", color: "green" },
        { icon: <CalendarDays />, n: "02", title: "A week with wiggle room.", copy: "Swap a meal, keep a favorite, change your days. A little structure, a lot of freedom.", color: "yellow" },
        { icon: <Utensils />, n: "03", title: "Comfort food. Fresh thinking.", copy: "Filipino-inspired dishes you know and love, with the nutrition details in plain sight.", color: "pink" }
      ].map(value => <article className="public-value-card" key={value.n}><div className="public-value-top"><span className={`public-value-icon public-${value.color}`}>{value.icon}</span><span>{value.n}</span></div><h3>{value.title}</h3><p>{value.copy}</p></article>)}</div>
    </div></section>
    <section className="public-section public-meals-section"><div className="container public-reveal"><SectionTitle eyebrow="MEET YOUR NEW FAVORITES" title="Familiar flavors. Fresh possibilities." text="The meals you crave, with a little more thought in every bite." link={{ href: "/meals", label: "See the whole menu" }} />
      <div className="public-filter-tabs" aria-label="Filter featured meals">{choices.map(choice => <button key={choice} className={filter === choice ? "active" : ""} onClick={() => setFilter(choice)} aria-pressed={filter === choice}>{choice === "Plant based" && <Leaf size={15} />}{choice}</button>)}</div>
      {error ? <DataError error={error} retry={retry} /> : !meals ? <div className="public-loading" role="status">Good things are on the menu…</div> : featured.length ? <div className="public-meal-grid">{featured.map(meal => <MealCard meal={meal} key={meal.id} />)}</div> : <p className="public-empty">No meals in this category today. Explore the full menu for more choices.</p>}
      <p className="public-fineprint">Nutrition values are estimated per standard serving. Always check ingredients and allergens.</p>
    </div></section>
    <section className="public-section public-how-section"><div className="container public-reveal"><SectionTitle eyebrow="THREE LITTLE STEPS" title="From “what’s for lunch?” to all sorted." link={{ href: "/how-it-works", label: "Here’s how it works" }} /><div className="public-steps-grid">{[
      ["01", "Tell us about you.", "A few preferences, your goals, and the days you need a little help."],
      ["02", "Meet your delicious week.", "Get a balanced suggestion of meals that fits your taste and budget."],
      ["03", "Make it yours. Dig in.", "Swap, customize, and confirm. Your week is looking pretty good."]
    ].map(([number, title, copy]) => <article key={number}><span className="public-step-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <SamplePlanner meals={(meals || []).filter(m => m.available)} />
    <Lifestyle meals={(meals || []).filter(m => m.available)} />
    <section className="public-section public-pricing-section"><div className="container public-reveal"><SectionTitle eyebrow="A LITTLE OR A WHOLE LOT" title="There’s a plan for your kind of week." text="Start small, fill the week, or find your own rhythm." /><Packages compact /></div></section>
    <FAQ /><FinalCTA />
  </div>;
}

function SamplePlanner({ meals }: { meals: Meal[] }) {
  const [day, setDay] = useState(0);
  const [swaps, setSwaps] = useState<Record<number, number>>({});
  const [started, setStarted] = useState(false);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const selected = meals.length ? [meals[(day * 2 + (swaps[day] || 0)) % meals.length], meals[(day * 2 + 1 + (swaps[day] || 0)) % meals.length]] : [];
  const total = selected.reduce((sum, meal) => sum + meal.calories, 0);
  const weeklyCost = meals.length ? days.reduce((sum, _, i) => sum + meals[(i * 2 + (swaps[i] || 0)) % meals.length].price + meals[(i * 2 + 1 + (swaps[i] || 0)) % meals.length].price, 0) : 0;
  const protein = selected.reduce((sum, meal) => sum + meal.protein, 0);
  return <section className="public-section public-planner-section" id="sample-plan"><div className="container public-planner-layout public-reveal"><div className="public-planner-copy"><span className="public-eyebrow"><span />A SMARTER KIND OF MEAL PREP</span><h2>A week of good<br />decisions.<br /><span>Already made.</span></h2><p>Meet the planner that puts your preferences first. A whole week of Filipino favorites, with room to make it yours.</p><ul className="public-check-list"><li><Check />Meals matched to your goals</li><li><Check />Easy swaps. No second-guessing.</li><li><Check />Your budget, always in view</li></ul><Link href="/onboarding" className="button">Create my meal plan<ArrowUpRight size={18} /></Link><p className="public-fineprint">The preview uses current catalog meals. Create an account for a personalized, saved plan.</p></div>
    <div className="public-planner-demo"><div className="public-planner-demo-heading"><div><span className="public-demo-label"><span />LIVE CATALOG PREVIEW</span><h3>Your delicious week</h3></div><CalendarDays size={23} /></div><div className="public-demo-days" aria-label="Preview day">{days.map((label, i) => <button aria-pressed={day === i} className={day === i ? "active" : ""} key={label} onClick={() => { setDay(i); setStarted(true); }}><span>{label}</span><span className="public-day-dot" /></button>)}</div>
      {selected.length ? <><div className="public-demo-cards">{selected.map((meal, i) => <div key={`${day}-${i}-${meal.id}`} className="public-demo-card"><div className="public-demo-photo"><Image src={meal.image} alt={meal.name} width={400} height={300} sizes="(max-width: 700px) 45vw, 260px" /><span>{i === 0 ? "LUNCH" : "DINNER"}</span></div><h4>{meal.name}</h4><span>{meal.calories} kcal <span aria-hidden="true">·</span> {meal.protein}g protein</span></div>)}</div><div className="public-demo-summary"><span><Flame size={17} /><strong>{total}</strong> kcal<span className="public-summary-extra"> for this day</span></span><span><strong>{protein}g</strong> protein</span></div><div className="public-demo-budget"><span>5 days · 10 sample meals</span><strong>{money(weeklyCost)}</strong></div><div className="public-demo-bottom"><span role="status">{started ? "Looking good. Keep exploring!" : "A little preview. A lot of possibility."}</span><button onClick={() => { setSwaps(s => ({ ...s, [day]: (s[day] || 0) + 1 })); setStarted(true); }} aria-label={`Swap ${days[day]} sample meals`}><RefreshCw size={15} />Try a swap</button></div></> : <p className="public-loading">The sample appears when the menu is available.</p>}
      <p className="public-demo-disclaimer">Demo only · excludes delivery · not a full daily diet or personalized recommendation.</p>
    </div></div></section>;
}

const lifestyles = [
  { label: "Balanced eating", icon: <Leaf size={18} />, title: "A little of everything. A lot to love.", copy: "Colorful vegetables, satisfying proteins, and familiar flavors. Find your everyday balance without overthinking every bite.", tag: "balanced", cta: "Find my balance" },
  { label: "More protein", icon: <Flame size={18} />, title: "A satisfying plate for your active days.", copy: "Explore protein-rich favorites with clear macros. Tell us your routine and let your meals fit into it.", tag: "protein", cta: "Explore protein-focused meals" },
  { label: "Everyday convenience", icon: <CalendarDays size={18} />, title: "One less thing on your to-do list.", copy: "Between classes, commutes, and everything else, make space for a good meal. Plan ahead and take lunch off your mind.", tag: "convenience", cta: "Make my week easier" },
  { label: "Mindful portions", icon: <Heart size={18} />, title: "Your goals. A kinder approach.", copy: "Understand what’s on your plate and choose portions that suit you. Flexible planning, without extremes or food guilt.", tag: "manage", cta: "Plan with intention" }
];

function Lifestyle({ meals }: { meals: Meal[] }) {
  const [selected, setSelected] = useState(0);
  const current = lifestyles[selected];
  const relevant = selected === 1 ? [...meals].sort((a, b) => b.protein - a.protein) : selected === 3 ? [...meals].sort((a, b) => a.calories - b.calories) : meals;
  const meal = relevant[(selected === 2 ? 1 : 0) % (relevant.length || 1)];
  return <section className="public-section"><div className="container public-reveal"><SectionTitle eyebrow="MADE FOR REAL LIFE" title="Different goals. Same love for good food." /><div className="public-lifestyle-layout"><div><div className="public-lifestyle-tabs" aria-label="Choose a lifestyle">{lifestyles.map((life, index) => <button key={life.label} className={selected === index ? "active" : ""} aria-pressed={selected === index} onClick={() => setSelected(index)}>{life.icon}<span>{life.label}</span><ArrowUpRight size={17} /></button>)}</div><div className="public-lifestyle-copy" key={selected}><h3>{current.title}</h3><p>{current.copy}</p><Link className="public-text-link" href="/onboarding">{current.cta}<ArrowRight size={17} /></Link></div></div><div className="public-lifestyle-photo">{meal && <><Image src={meal.image} alt={meal.name} width={800} height={640} sizes="(max-width: 768px) 95vw, 50vw" /><div className="public-lifestyle-caption"><span><Sparkles size={16} />ON THE MENU</span><Link href={`/meals/${meal.slug}`}>{meal.name}<ArrowUpRight size={22} /></Link></div></>}{!meal && <div className="public-lifestyle-fallback"><Sprout size={80} /><p>A fresh start to your week.</p></div>}<span className="public-lifestyle-stamp">GOOD FOOD<br /><Heart size={24} /><br />GOOD MOOD</span></div></div></div></section>;
}
