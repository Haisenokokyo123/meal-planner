"use client";

import { useEffect, useRef } from "react";
import { Inbox } from "lucide-react";
import type { DeliveryZone, Meal, Order, OrderStatus, Package, Settings, Subscription, User } from "@/lib/types";

export interface AdminData {
  stats: { customers: number; activeSubscriptions: number; orders: number; scheduledMeals: number; sales: number };
  orders: Order[];
  meals: Meal[];
  packages: Package[];
  zones: DeliveryZone[];
  settings: Settings;
  subscriptions: (Subscription & { user: User })[];
  customers: { id: string; name: string; email: string; orderCount: number }[];
  sales: { date: string; total: number; orders: number }[];
  popular: { name: string; quantity: number }[];
  audit: { id: string; action: string; createdAt: string }[];
}
export interface KitchenData {
  date: string;
  meals: { mealId: string; name: string; quantity: number; portions: number; orderIds: string[] }[];
}
export type Mutate = <T>(path: string, method: string, body: unknown, success: string) => Promise<T | undefined>;
export const dayToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const dateLabel = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value));
export const timeLabel = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
export const statusLabel = (status: string) => status.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
export const shortId = (id: string) => id.slice(-8).toUpperCase();
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function Status({ value }: { value: string }) {
  const tone = value === "CANCELLED" ? "danger" : value === "PAUSED" || value === "PREPARING" ? "warning" : value === "DELIVERED" ? "muted" : "";
  return <span className={`admin-status ${tone ? `admin-status-${tone}` : ""}`}>{statusLabel(value)}</span>;
}

export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="admin-empty"><Inbox size={32} aria-hidden="true" /><h3>{title}</h3><p>{children}</p></div>;
}

export function Confirmation({ title, message, action, onConfirm, onClose }: { title: string; message: string; action: string; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog className="admin-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="admin-dialog-title">
    <h2 id="admin-dialog-title">{title}</h2><p>{message}</p>
    <div className="admin-dialog-actions"><button type="button" className="button button-secondary" onClick={onClose} autoFocus>Keep as is</button><button type="button" className="button" onClick={() => { onClose(); onConfirm(); }}>{action}</button></div>
  </dialog>;
}
