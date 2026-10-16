"use client";
import { PublicImage } from "@/components/food-image";

import Link from "@/lib/router";
import { useParams } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, CalendarDays, ChefHat, ClipboardList, LayoutDashboard, LoaderCircle, Package, Plus, RefreshCw, Settings, ShoppingBag, Users, UtensilsCrossed, Wallet } from "lucide-react";
import { api, useUser } from "@/lib/client";
import { DAYS, money, type Meal, type Order, type OrderStatus } from "@/lib/types";
import { MealEditor } from "./MealEditor";
import { SettingsEditor } from "./SettingsEditor";
import { Confirmation, dateLabel, dayToday, Empty, nextStatuses, shortId, Status, statusLabel, timeLabel, type AdminData, type KitchenData, type Mutate } from "./shared";
import "./admin.css";

const navigation = [
  { name: "Overview", path: "", icon: LayoutDashboard },
  { name: "Meals", path: "meals", icon: UtensilsCrossed },
  { name: "Orders", path: "orders", icon: ShoppingBag },
  { name: "Kitchen", path: "kitchen", icon: ChefHat },
  { name: "Subscriptions", path: "subscriptions", icon: Package },
  { name: "Customers", path: "customers", icon: Users },
  { name: "Reports", path: "reports", icon: BarChart3 },
  { name: "Settings", path: "settings", icon: Settings },
];

export function AdminConsole() {
  const params = useParams<{ section?: string[] }>();
  const route = params.section ?? [];
  const section = route[0] ?? "";
  const { user, loading } = useUser();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(() => `${dayToday().slice(0, 7)}-01`);
  const [to, setTo] = useState(dayToday);
  const [range, setRange] = useState(() => ({ from: `${dayToday().slice(0, 7)}-01`, to: dayToday() }));
  const [kitchen, setKitchen] = useState<KitchenData | null>(null);
  const [kitchenDate, setKitchenDate] = useState(dayToday);
  const [kitchenError, setKitchenError] = useState("");
  const [kitchenLoading, setKitchenLoading] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    try { const result = await api<AdminData>(`/api/admin?from=${range.from}&to=${range.to}`); setData(result); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "We could not load the operations dashboard."); }
    finally { setFetching(false); }
  }, [range]);

  useEffect(() => { if (!loading && user?.role === "ADMIN") void load(); }, [loading, user?.role, load]);
  useEffect(() => {
    if (loading || user?.role !== "ADMIN") return;
    let active = true;
    setKitchenLoading(true);
    setKitchenError("");
    api<KitchenData>(`/api/admin/kitchen?date=${kitchenDate}`).then((result) => { if (active) setKitchen(result); }).catch((cause) => { if (active) { setKitchen(null); setKitchenError(cause instanceof Error ? cause.message : "Could not load the kitchen schedule."); } }).finally(() => { if (active) setKitchenLoading(false); });
    return () => { active = false; };
  }, [loading, user?.role, kitchenDate, data]);

  const mutate: Mutate = async <T,>(path: string, method: string, body: unknown, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<T>(path, { method, body: JSON.stringify(body) });
      await load();
      setNotice(success);
      return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That change could not be saved. Please try again."); return undefined; }
    finally { setBusy(false); }
  };

  if (loading) return <div className="admin-loading" role="status"><LoaderCircle size={25} />Opening the kitchen door…</div>;
  if (!user) return <section className="container section"><Empty title="Sign in to your team account">Your administrator account gives you access to meals, orders, and kitchen operations.</Empty><div style={{ textAlign: "center" }}><Link className="button" href="/login?next=%2Fadmin">Sign in to continue <ArrowRight size={16} /></Link></div></section>;
  if (user.role !== "ADMIN") return <section className="container section"><Empty title="This area is for the Sakto team">You&apos;re signed in as a customer. Your meals, subscriptions, and deliveries are available in your dashboard.</Empty><div style={{ textAlign: "center" }}><Link className="button" href="/dashboard">Go to my dashboard <ArrowRight size={16} /></Link></div></section>;

  const showFilters = ["", "orders", "reports", "customers", "subscriptions"].includes(section) && !route[1];
  return <div className="admin-shell">
    <aside className="admin-sidebar"><div className="admin-brand"><span>Behind the good food</span><strong>The Sakto kitchen.</strong></div><nav className="admin-nav" aria-label="Administration">{navigation.map((item) => <Link key={item.path} href={`/admin${item.path ? `/${item.path}` : ""}`} aria-current={section === item.path ? "page" : undefined}><item.icon size={18} aria-hidden="true" />{item.name}</Link>)}</nav><div className="admin-side-note">Signed in as<br /><strong>{user.name}</strong><br />All schedules follow Philippine time.</div></aside>
    <main className="admin-content">
      {error && <div className="error admin-announcement" role="alert">{error} <button className="admin-link-button" onClick={() => void load()} disabled={fetching}>Retry loading</button></div>}
      {notice && <div className="success admin-announcement" role="status">{notice}</div>}
      {!data ? <div className="admin-loading" role="status">{fetching ? <><LoaderCircle size={25} />Loading your operations…</> : "Dashboard data is unavailable. Use Retry loading above to reconnect."}</div> : <>
        {showFilters && <form className="admin-date-filter" onSubmit={(event) => { event.preventDefault(); if (from > to) { setError("The start date must be on or before the end date."); return; } setError(""); setRange({ from, to }); }}>
          <label>From<input className="input" aria-label="Filter start date" type="date" required value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Through<input className="input" aria-label="Filter end date" type="date" required value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="button button-secondary" disabled={fetching} type="submit">{fetching ? "Loading…" : "Apply dates"}</button><p className="admin-filter-caption">Orders & sales by order date. Customer and subscription totals are current.</p>
        </form>}
        {section === "" && <Overview data={data} kitchen={kitchen} kitchenLoading={kitchenLoading} kitchenError={kitchenError} refresh={() => void load()} fetching={fetching} />}
        {section === "meals" && !route[1] && <MealList data={data} mutate={mutate} busy={busy} />}
        {section === "meals" && route[1] === "new" && <MealEditor key="new-meal" mutate={mutate} busy={busy} />}
        {section === "meals" && route[1] && route[1] !== "new" && (data.meals.find((meal) => meal.id === route[1]) ? <MealEditor key={route[1]} meal={data.meals.find((meal) => meal.id === route[1])} mutate={mutate} busy={busy} /> : <Empty title="Meal not found">This meal may no longer exist. Return to the <Link href="/admin/meals">meal catalog</Link>.</Empty>)}
        {section === "orders" && <Orders data={data} orderId={route[1]} mutate={mutate} busy={busy} />}
        {section === "kitchen" && <Kitchen data={kitchen} date={kitchenDate} onDateChange={setKitchenDate} loading={kitchenLoading} error={kitchenError} />}
        {section === "subscriptions" && <Subscriptions data={data} mutate={mutate} busy={busy} />}
        {section === "customers" && <Customers data={data} />}
        {section === "reports" && <Reports data={data} />}
        {section === "settings" && <SettingsEditor key={JSON.stringify([data.settings, data.zones, data.packages])} data={data} mutate={mutate} busy={busy} />}
        {!navigation.some((item) => item.path === section) && <Empty title="This page is not on the menu">Choose an area from the team navigation to continue.</Empty>}
      </>}
    </main>
  </div>;
}

function PageTitle({ eyebrow, title, text, children }: { eyebrow?: string; title: string; text: string; children?: React.ReactNode }) {
  return <div className="admin-title"><div><span className="eyebrow">{eyebrow ?? "Sakto team workspace"}</span><h1>{title}</h1><p>{text}</p></div>{children && <div className="admin-title-actions">{children}</div>}</div>;
}

function Overview({ data, kitchen, kitchenLoading, kitchenError, refresh, fetching }: { data: AdminData; kitchen: KitchenData | null; kitchenLoading: boolean; kitchenError: string; refresh: () => void; fetching: boolean }) {
  const attention = data.orders.filter((order) => order.status === "CONFIRMED" || (order.status !== "CANCELLED" && order.status !== "DELIVERED" && order.exceptions?.length));
  const cards = [
    { label: "Demo sales", value: money(data.stats.sales), icon: Wallet, note: "Non-cancelled demo transactions", accent: true },
    { label: "Orders", value: data.stats.orders, icon: ShoppingBag, note: `${attention.length} need attention in this period` },
    { label: "Active subscriptions", value: data.stats.activeSubscriptions, icon: Package, note: "Current subscriptions" },
    { label: "Scheduled meals", value: data.stats.scheduledMeals, icon: UtensilsCrossed, note: "From selected orders" },
    { label: "Customers", value: data.stats.customers, icon: Users, note: "Registered customer accounts" },
  ];
  return <>
    <PageTitle eyebrow="A good day starts in the kitchen" title="Good food. In good hands." text="A clear picture of the meals, people, and little details that keep the week running smoothly."><button className="button button-secondary" onClick={refresh} disabled={fetching}><RefreshCw size={15} />{fetching ? "Refreshing…" : "Refresh"}</button></PageTitle>
    <div className="admin-stats">{cards.map((card) => <article className={`admin-stat ${card.accent ? "admin-stat-accent" : ""}`} key={card.label}><div className="admin-stat-icon"><card.icon size={18} aria-hidden="true" /></div><span className="admin-stat-label">{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}</div>
    <div className="admin-two-col admin-section"><section className="card"><h2>A little momentum</h2><SalesChart sales={data.sales} /><Link className="admin-link-button" href="/admin/reports">Explore sales reports →</Link></section><section className="card"><h2>Today&apos;s kitchen, {dateLabel(dayToday())}</h2>{kitchenLoading ? <p role="status" className="muted">Checking the preparation schedule…</p> : kitchenError ? <p className="error" role="alert">{kitchenError}</p> : kitchen?.meals.length ? <><div className="admin-mini-stats"><div><strong>{kitchen.meals.reduce((total, meal) => total + meal.quantity, 0)}</strong><small>meal units</small></div><div><strong>{kitchen.meals.length}</strong><small>different dishes</small></div></div><PopularList items={kitchen.meals.slice(0, 4).map((meal) => ({ name: meal.name, quantity: meal.quantity }))} /></> : <Empty title="A quiet kitchen today">There are no eligible orders scheduled for preparation today.</Empty>}<Link className="admin-link-button" href="/admin/kitchen">Open preparation schedule →</Link></section></div>
    <section className="admin-section"><h2>Orders to take care of</h2><OrderTable orders={attention.slice(0, 6)} empty="All caught up for this period. New confirmed orders and fulfillment exceptions will appear here." /><div style={{ marginTop: 14 }}><Link className="admin-link-button" href="/admin/orders">View all orders →</Link></div></section>
    <div className="admin-two-col admin-section"><section className="card"><h2>The crowd favorites</h2><PopularList items={data.popular.slice(0, 6)} /></section><section className="card"><h2>Recent team activity</h2>{data.audit.length ? <ul className="admin-audit">{data.audit.slice(0, 6).map((item) => <li key={item.id}><span>{item.action}</span><time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time></li>)}</ul> : <Empty title="A fresh start">Significant administrative updates will appear here once the team starts making changes.</Empty>}</section></div>
  </>;
}

function SalesChart({ sales }: { sales: AdminData["sales"] }) {
  if (!sales.length) return <Empty title="Your next chapter starts with an order">Sales trends will appear here as customers confirm their first demo subscriptions.</Empty>;
  const visible = sales.slice(-14);
  const max = Math.max(...visible.map((day) => day.total), 1);
  return <><div className="admin-chart" role="img" aria-label={`Daily demo sales for the latest ${visible.length} recorded days. ${visible.map((day) => `${dateLabel(day.date)}: ${money(day.total)}`).join("; ")}`}>{visible.map((day) => <div className="admin-chart-col" key={day.date} title={`${dateLabel(day.date)} · ${money(day.total)} · ${day.orders} orders`}><div className="admin-chart-bar" style={{ height: `${Math.max(2, day.total / max * 100)}%` }} /><span>{new Date(`${day.date}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })}</span></div>)}</div><p className="muted" style={{ fontSize: ".75rem" }}>Actual stored demo transactions · Philippine pesos · Cancelled orders excluded</p></>;
}

function PopularList({ items }: { items: { name: string; quantity: number }[] }) {
  if (!items.length) return <Empty title="Waiting for the first favorites">Meal demand appears once eligible orders are placed.</Empty>;
  const max = Math.max(...items.map((item) => item.quantity), 1);
  return <div className="admin-bar-list">{items.map((item) => <div key={item.name}><div className="admin-bar-head"><span>{item.name}</span><strong>{item.quantity}</strong></div><div className="admin-bar-track" aria-hidden="true"><div className="admin-bar-fill" style={{ width: `${item.quantity / max * 100}%` }} /></div></div>)}</div>;
}

function MealList({ data, mutate, busy }: { data: AdminData; mutate: Mutate; busy: boolean }) {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");
  const [archiving, setArchiving] = useState<Meal | null>(null);
  const meals = data.meals.filter((meal) => `${meal.name} ${meal.category} ${meal.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase()) && (availability === "all" || meal.available === (availability === "available")));
  return <><PageTitle title="The good-food collection." text="Thoughtful recipes, transparent nutrition, and plenty of Filipino flavor. Every change here shapes future meal plans."><Link className="button" href="/admin/meals/new"><Plus size={16} />Add a meal</Link></PageTitle>
    <div className="admin-search-row"><input className="input" aria-label="Search meals" placeholder="Search dishes, categories, or dietary tags…" value={search} onChange={(event) => setSearch(event.target.value)} /><select className="select" aria-label="Filter meal availability" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All availability</option><option value="available">Available</option><option value="unavailable">Unavailable / archived</option></select></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Meal</th><th>Price / serving</th><th>Nutrition</th><th>Availability</th><th>Manage</th></tr></thead><tbody>{meals.map((meal) => <tr key={meal.id}><td><div className="admin-meal-cell"><PublicImage src={meal.image} alt="" width={54} height={54} /><div><span className="admin-cell-main">{meal.name}</span><small>{meal.category} · {meal.servingSize}</small></div></div></td><td>{money(meal.price)}<small>{meal.capacity} / day capacity</small></td><td>{meal.calories} kcal<small>{meal.protein}g P · {meal.carbs}g C · {meal.fat}g F</small></td><td><span className={`admin-status ${meal.available ? "" : "admin-status-muted"}`}>{meal.available ? "Available" : "Unavailable"}</span><small>{meal.slots.join(", ")}</small></td><td><div className="admin-row-actions"><Link className="button button-secondary" href={`/admin/meals/${meal.id}`}>Edit</Link><button className="admin-link-button" disabled={busy} onClick={() => { if (meal.available) setArchiving(meal); else void mutate(`/api/admin/meals/${meal.id}`, "PUT", { ...meal, available: true }, `${meal.name} is available again.`); }}>{meal.available ? "Archive" : "Make available"}</button></div></td></tr>)}</tbody></table>{!meals.length && <Empty title="No meals match this search">Try another name or change the availability filter.</Empty>}</div>
    {archiving && <Confirmation title={`Archive ${archiving.name}?`} message="The meal will no longer appear in new plans or be accepted at checkout. Existing orders are preserved and any affected active orders will be flagged for your team." action="Archive meal" onConfirm={() => void mutate(`/api/admin/meals/${archiving.id}`, "PUT", { ...archiving, available: false }, "Meal archived. Review affected active orders for fulfillment exceptions.")} onClose={() => setArchiving(null)} />}
  </>;
}

function OrderTable({ orders, empty }: { orders: Order[]; empty?: string }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Meals / total</th><th>Status</th><th>Delivery</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link className="admin-cell-main" href={`/admin/orders/${order.id}`}>#{shortId(order.id)}</Link><small>{dateLabel(order.createdAt)}</small></td><td><span className="admin-cell-main">{order.user?.name ?? "Customer"}</span><small>{order.user?.email}</small></td><td>{money(order.total)}<small>{order.items.length} meals</small></td><td><Status value={order.status} />{!!order.exceptions?.length && <small style={{ color: "#9a362a" }}>⚠ {order.exceptions.length} fulfillment issue{order.exceptions.length > 1 ? "s" : ""}</small>}</td><td>{order.zoneName}<small>{order.items.length ? dateLabel([...order.items].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))[0].deliveryDate) : "No schedule"}</small></td></tr>)}</tbody></table>{!orders.length && <Empty title="No orders to show">{empty ?? "Try a different date range or status. New customer orders will appear here after checkout."}</Empty>}</div>;
}

function Orders({ data, orderId, mutate, busy }: { data: AdminData; orderId?: string; mutate: Mutate; busy: boolean }) {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [cancel, setCancel] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailError, setDetailError] = useState("");
  const order = data.orders.find((item) => item.id === orderId) ?? detailOrder;
  useEffect(() => {
    setSelectedStatus(""); setDetailOrder(null); setDetailError("");
    if (!orderId || data.orders.some((item) => item.id === orderId)) return;
    let active = true;
    api<AdminData>("/api/admin").then((result) => { if (active) { const found = result.orders.find((item) => item.id === orderId); if (found) setDetailOrder(found); else setDetailError("This order could not be found."); } }).catch((cause) => { if (active) setDetailError(cause instanceof Error ? cause.message : "Could not load this order."); });
    return () => { active = false; };
  }, [orderId, data.orders]);
  const update = (target: Order, next: OrderStatus) => void mutate<Order>(`/api/admin/orders/${target.id}`, "PATCH", { status: next }, `Order #${shortId(target.id)} is now ${statusLabel(next).toLowerCase()}.`).then((result) => { if (result) { setSelectedStatus(""); setDetailOrder(result); } });
  if (orderId) {
    if (!order) return <><Link href="/admin/orders" className="admin-link-button">← All orders</Link>{detailError ? <p className="error" role="alert">{detailError}</p> : <p role="status" className="admin-loading">Loading this order…</p>}</>;
    const availableStatuses = nextStatuses[order.status] ?? [];
    return <><Link href="/admin/orders" className="admin-link-button">← All orders</Link><PageTitle eyebrow={`Order #${shortId(order.id)}`} title="Every detail, taken care of." text={`Placed ${timeLabel(order.createdAt)}. This order uses a simulated payment; no money was charged.`}><Status value={order.status} /></PageTitle>
      {!!order.exceptions?.length && <div className="admin-warning"><strong>Fulfillment needs a closer look.</strong><ul>{order.exceptions.map((exception, index) => <li key={`${exception}-${index}`}>{exception}</li>)}</ul>Contact the customer to agree on a resolution. The system does not substitute meals automatically.</div>}
      <section className="card"><dl className="admin-order-summary"><div><dt>Customer</dt><dd><strong>{order.user?.name ?? "Customer"}</strong><br />{order.user?.email ?? "Contact details unavailable"}</dd></div><div><dt>Delivery address</dt><dd>{order.address}<br /><strong>{order.zoneName}</strong></dd></div><div><dt>Payment</dt><dd>{order.paymentMethod} · demo transaction<br />{order.items.length} scheduled meals</dd></div></dl>
      {availableStatuses.length > 0 && <form className="admin-search-row" onSubmit={(event) => { event.preventDefault(); if (!selectedStatus) return; if (selectedStatus === "CANCELLED") setCancel(order); else update(order, selectedStatus); }}><label className="field" htmlFor="order-next-status">Move this order forward</label><select id="order-next-status" className="select" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as OrderStatus)} required><option value="">Choose next status</option>{availableStatuses.map((next) => <option key={next} value={next}>{statusLabel(next)}</option>)}</select><button type="submit" className="button" disabled={busy || !selectedStatus}>{busy ? "Updating…" : "Update status"}</button></form>}
      {!availableStatuses.length && <p className="admin-muted-box">This order is {statusLabel(order.status).toLowerCase()} and its status is final.</p>}</section>
      <section className="admin-section"><h2>The meals & delivery schedule</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Meal</th><th>Delivery</th><th>Portion</th><th>Nutrition</th><th>Price</th></tr></thead><tbody>{[...order.items].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.slot.localeCompare(b.slot)).map((item) => <tr key={item.id}><td className="admin-cell-main">{item.name}</td><td>{dateLabel(item.deliveryDate)}<small>{DAYS[item.day]} · {statusLabel(item.slot)}</small></td><td>{item.portion}×</td><td>{item.calories} kcal<small>{item.protein}g P · {item.carbs}g C · {item.fat}g F</small></td><td>{money(item.price)}</td></tr>)}</tbody></table></div></section>
      <div className="admin-two-col admin-section"><section className="card"><h2>Order history</h2>{order.history?.length ? <ol className="admin-timeline">{order.history.map((event, index) => <li key={`${event.createdAt}-${index}`}>{statusLabel(event.status)}<time dateTime={event.createdAt}>{timeLabel(event.createdAt)}</time></li>)}</ol> : <p className="muted">Order created {timeLabel(order.createdAt)}.</p>}</section><section className="card"><h2>Order totals</h2><div className="admin-order-total"><span>Meals</span><span>{money(order.mealTotal)}</span></div><div className="admin-order-total"><span>Delivery</span><span>{money(order.deliveryFee)}</span></div><div className="admin-order-total"><span>Demo total</span><span>{money(order.total)}</span></div></section></div>
      {cancel && <Confirmation title={`Cancel order #${shortId(cancel.id)}?`} message="This removes its meals from active kitchen preparation demand and cancels the linked subscription. The order record is kept for reporting. No real payment has been collected or refunded." action="Cancel order" onConfirm={() => update(cancel, "CANCELLED")} onClose={() => setCancel(null)} />}
    </>;
  }
  const orders = data.orders.filter((item) => (status === "ALL" || item.status === status) && `${item.id} ${item.user?.name ?? ""} ${item.user?.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle title="From our kitchen to their week." text="Track customer orders, review delivery details, and keep every meal moving in the right direction." /><div className="admin-search-row"><input className="input" aria-label="Search orders" placeholder="Search order ID, customer name, or email…" value={search} onChange={(event) => setSearch(event.target.value)} /><select className="select" aria-label="Filter order status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{Object.keys(nextStatuses).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div><OrderTable orders={orders} /></>;
}

function Kitchen({ data, date, onDateChange, loading, error }: { data: KitchenData | null; date: string; onDateChange: (value: string) => void; loading: boolean; error: string }) {
  return <><PageTitle eyebrow="Prep with a little more peace of mind" title="Today&apos;s good-food game plan." text="Preparation quantities come directly from eligible customer orders. Cancelled orders are excluded; each meal links back to the orders that need it." /><div className="admin-date-filter"><label>Preparation / delivery date<input className="input" type="date" value={date} onChange={(event) => { if (event.target.value) onDateChange(event.target.value); }} /></label><p className="admin-filter-caption">All dates follow Asia/Manila.</p></div>{error && <p className="error" role="alert">{error}</p>}{loading ? <div className="admin-loading" role="status"><LoaderCircle size={24} />Counting the meals for this date…</div> : data?.meals.length ? <><div className="admin-mini-stats"><div><strong>{data.meals.reduce((total, meal) => total + meal.quantity, 0)}</strong><small>individual meals</small></div><div><strong>{Math.round(data.meals.reduce((total, meal) => total + meal.portions, 0) * 100) / 100}</strong><small>standard portion equivalents</small></div><div><strong>{new Set(data.meals.flatMap((meal) => meal.orderIds)).size}</strong><small>contributing orders</small></div></div><div className="admin-kitchen-list">{data.meals.map((meal) => <article className="admin-kitchen-row" key={meal.mealId}><div><h3>{meal.name}</h3><small>{meal.portions} standard portions across {meal.orderIds.length} order{meal.orderIds.length === 1 ? "" : "s"}</small></div><div><strong>{meal.quantity}</strong><small style={{ display: "block", textAlign: "right" }}>meal units</small></div><details className="admin-kitchen-orders"><summary>View contributing orders</summary><ul>{meal.orderIds.map((orderId) => <li key={orderId}><Link href={`/admin/orders/${orderId}`}>#{shortId(orderId)}</Link></li>)}</ul></details></article>)}</div></> : !error && <section className="card"><Empty title="Nothing on the prep list for this date">Select another delivery date. Confirmed, preparing, and out-for-delivery orders supply the active kitchen schedule.</Empty></section>}</>;
}

function Subscriptions({ data, mutate, busy }: { data: AdminData; mutate: Mutate; busy: boolean }) {
  const [filter, setFilter] = useState("ALL");
  const [cancel, setCancel] = useState<AdminData["subscriptions"][number] | null>(null);
  const subscriptions = data.subscriptions.filter((subscription) => filter === "ALL" || subscription.status === filter);
  return <><PageTitle title="Good weeks, on repeat." text="A current view of customer subscriptions, upcoming cycles, and the packages that fit their routines."><Link href="/admin/settings" className="button button-secondary">Manage packages</Link></PageTitle><div className="admin-muted-box" style={{ marginBottom: 20 }}>This prototype confirms one paid demo cycle at a time. Renewal dates are a scheduling reference; no automatic charge or recurring delivery is created. Changes remain subject to the delivery cutoff.</div><div className="admin-search-row"><select className="select" aria-label="Filter subscriptions" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All subscriptions</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="CANCELLED">Cancelled</option></select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Package</th><th>Schedule</th><th>Status</th><th>Manage</th></tr></thead><tbody>{subscriptions.map((subscription) => <tr key={subscription.id}><td className="admin-cell-main">{subscription.user?.name ?? "Customer"}<small>{subscription.user?.email}</small></td><td>{subscription.packageName}<small>{subscription.mealCount} meals</small></td><td>Week of {dateLabel(subscription.weekStart)}<small>Next cycle: {dateLabel(subscription.nextCycle)}</small></td><td><Status value={subscription.status} /></td><td><div className="admin-row-actions">{subscription.status !== "CANCELLED" && <><button className="button button-secondary" disabled={busy} onClick={() => void mutate(`/api/admin/subscriptions/${subscription.id}`, "PATCH", { action: subscription.status === "ACTIVE" ? "pause" : "resume" }, `Subscription ${subscription.status === "ACTIVE" ? "paused" : "resumed"}.`)}>{subscription.status === "ACTIVE" ? "Pause" : "Resume"}</button><button className="admin-link-button" disabled={busy} onClick={() => setCancel(subscription)}>Cancel</button></>}<Link className="admin-link-button" href="/admin/orders">Order schedules</Link></div></td></tr>)}</tbody></table>{!subscriptions.length && <Empty title="No subscriptions in this view">Subscriptions appear after a customer confirms a meal plan at checkout.</Empty>}</div>{cancel && <Confirmation title="Cancel this subscription?" message={`Cancel ${cancel.user?.name ?? "this customer"}'s ${cancel.packageName} subscription. The server checks delivery cutoffs before applying the change. This action cannot be undone.`} action="Cancel subscription" onConfirm={() => void mutate(`/api/admin/subscriptions/${cancel.id}`, "PATCH", { action: "cancel" }, "Subscription cancelled.")} onClose={() => setCancel(null)} />}</>;
}

function Customers({ data }: { data: AdminData }) {
  const [search, setSearch] = useState("");
  const customers = data.customers.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle title="The people around our table." text="Customer contact details and order counts for everyday operations. Personal nutrition profiles and body measurements stay private." /><div className="admin-search-row"><input className="input" aria-label="Search customers" placeholder="Find a customer by name or email…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Subscription</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td className="admin-cell-main">{customer.name}</td><td>{customer.email}</td><td>{customer.orderCount}</td><td>{data.subscriptions.some((subscription) => subscription.user?.id === customer.id && subscription.status === "ACTIVE") ? <Status value="ACTIVE" /> : <span className="muted">No active subscription</span>}</td></tr>)}</tbody></table>{!customers.length && <Empty title="No matching customers">Try another name or email address.</Empty>}</div></>;
}

function Reports({ data }: { data: AdminData }) {
  const byPackage = data.subscriptions.reduce<Record<string, { count: number; active: number }>>((result, subscription) => { const entry = result[subscription.packageName] ?? { count: 0, active: 0 }; entry.count++; if (subscription.status === "ACTIVE") entry.active++; result[subscription.packageName] = entry; return result; }, {});
  const demand = data.orders.filter((order) => order.status !== "CANCELLED").flatMap((order) => order.items).reduce<Record<string, number>>((result, item) => { result[item.deliveryDate] = (result[item.deliveryDate] ?? 0) + 1; return result; }, {});
  return <><PageTitle title="A clearer picture of good food." text="Understand demand and follow the rhythm of the business. Every number comes from stored customer activity and simulated transactions." />
    <div className="admin-stats"><article className="admin-stat admin-stat-accent"><div className="admin-stat-icon"><Wallet size={18} /></div><span className="admin-stat-label">Total demo sales</span><strong>{money(data.stats.sales)}</strong><small>Selected order period</small></article><article className="admin-stat"><div className="admin-stat-icon"><ClipboardList size={18} /></div><span className="admin-stat-label">Orders in period</span><strong>{data.stats.orders}</strong><small>All recorded statuses</small></article><article className="admin-stat"><div className="admin-stat-icon"><Activity size={18} /></div><span className="admin-stat-label">Active subscriptions</span><strong>{data.stats.activeSubscriptions}</strong><small>Current total</small></article></div>
    <section className="card admin-section"><h2>Sales over time</h2><SalesChart sales={data.sales} />{data.sales.length > 0 && <details><summary className="admin-link-button">Read sales as a table</summary><div className="admin-table-wrap" style={{ marginTop: 14 }}><table className="admin-table"><thead><tr><th>Date</th><th>Orders</th><th>Demo sales</th></tr></thead><tbody>{data.sales.map((day) => <tr key={day.date}><td>{dateLabel(day.date)}</td><td>{day.orders}</td><td>{money(day.total)}</td></tr>)}</tbody></table></div></details>}</section>
    <div className="admin-two-col admin-section"><section className="card"><h2>Most-loved meals</h2><PopularList items={data.popular} /></section><section className="card"><h2>Subscription mix</h2>{Object.keys(byPackage).length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Package</th><th>Total</th><th>Active</th></tr></thead><tbody>{Object.entries(byPackage).map(([name, counts]) => <tr key={name}><td>{name}</td><td>{counts.count}</td><td>{counts.active}</td></tr>)}</tbody></table></div> : <Empty title="No subscriptions yet">Package trends will appear after the first customer checkout.</Empty>}</section></div>
    <section className="card admin-section"><h2><CalendarDays size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }} />Meal demand by delivery date</h2><p className="muted" style={{ fontSize: ".83rem" }}>Non-cancelled orders placed within the selected period, including completed deliveries.</p>{Object.keys(demand).length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Delivery date</th><th>Scheduled meal units</th></tr></thead><tbody>{Object.entries(demand).sort(([a], [b]) => a.localeCompare(b)).map(([date, quantity]) => <tr key={date}><td>{dateLabel(date)}</td><td>{quantity}</td></tr>)}</tbody></table></div> : <Empty title="No scheduled meal demand">Select a period with confirmed customer orders to explore the delivery workload.</Empty>}</section>
  </>;
}
