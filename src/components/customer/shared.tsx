"use client";
import { ReactNode, useEffect, useId, useRef } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useRouter } from "@/lib/router";
import { useUser } from "@/lib/client";
import { DAYS, Plan, money } from "@/lib/types";
import "./customer.css";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname.slice((window.__SAKTO_BASE__||"").length)+window.location.search)}`); }, [loading, user, router]);
  if (loading || !user) return <Loading text="Opening your space…" />;
  return <>{children}</>;
}
export function Loading({ text = "Gathering the good stuff…" }: { text?: string }) { return <div className="customer-loading" role="status"><LoaderCircle size={28} className="spin" /><p>{text}</p></div>; }
export function ErrorMessage({ error }: { error: string }) { return error ? <div className="customer-alert error" role="alert">{error}</div> : null; }
export function SuccessMessage({ message }: { message: string }) { return message ? <div className="customer-alert success" role="status">{message}</div> : null; }
export function getError(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="customer-field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>; }
export function Drawer({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId=useId();
  useEffect(() => { const el = dialog.current; const prev = document.activeElement as HTMLElement | null; el?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = old; el?.close(); prev?.focus(); }; }, []);
  return <dialog ref={dialog} className={`customer-drawer ${wide ? "wide" : ""}`} aria-labelledby={titleId} onCancel={e => {e.preventDefault(); onClose();}} onClick={e => {if (e.target === e.currentTarget) onClose();}}><div className="drawer-inner"><div className="drawer-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={22}/></button></div>{children}</div></dialog>;
}
export function NutritionNumbers({ values, compact = false }: { values: { calories: number; protein: number; carbs: number; fat: number }; compact?: boolean }) { return <div className={`nutrition-numbers ${compact ? "compact" : ""}`}>{[[Math.round(values.calories), "kcal"], [Math.round(values.protein), "g protein"], [Math.round(values.carbs), "g carbs"], [Math.round(values.fat), "g fat"]].map(([n, name]) => <div key={name}><strong>{n}</strong><span>{name}</span></div>)}</div>; }
export function PlanTable({ plan }: { plan: Plan }) { return <div className="table-wrap"><table className="customer-table"><thead><tr><th>Day & meal</th><th>Your selection</th><th>Portion</th><th>Energy</th><th>Price</th></tr></thead><tbody>{[...plan.slots].sort((a,b) => a.day-b.day || ["breakfast","lunch","dinner"].indexOf(a.slot)-["breakfast","lunch","dinner"].indexOf(b.slot)).map(s => <tr key={s.id}><td>{DAYS[s.day]}<small className="muted capitalize">{s.slot}</small></td><td>{s.meal.name}</td><td>{s.portion}×</td><td>{Math.round(s.meal.calories*s.portion)} kcal</td><td>{money(Math.round(s.meal.price*s.portion))}</td></tr>)}</tbody></table></div>; }
export function calendarDate(date: string, offset = 0) { const value = new Date(date.slice(0,10) + "T00:00:00+08:00"); value.setUTCDate(value.getUTCDate()+offset); return value.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }); }
export function nextWeek(date: string, offset: number) { const value = new Date(date.slice(0,10) + "T12:00:00Z"); value.setUTCDate(value.getUTCDate()+offset*7); return value.toISOString().slice(0,10); }
export function manilaToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export const goalNames: Record<string,string> = { balanced: "Balanced eating", protein: "Protein focused", maintain: "Maintain my weight", manage: "Mindful weight management", convenience: "Make my week easier" };
