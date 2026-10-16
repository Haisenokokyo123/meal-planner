"use client";

import { useState, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { DAYS, type DeliveryZone, type Package, type Settings } from "@/lib/types";
import { type AdminData, type Mutate } from "./shared";

export function SettingsEditor({ data, mutate, busy }: { data: AdminData; mutate: Mutate; busy: boolean }) {
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [zones, setZones] = useState<DeliveryZone[]>(data.zones);
  const [error, setError] = useState("");

  function updateZone(id: string, values: Partial<DeliveryZone>) {
    setZones(current => current.map(zone => zone.id === id ? { ...zone, ...values } : zone));
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!settings.supportedDays.length) {
      setError("Select at least one supported delivery day.");
      return;
    }
    if (!zones.some(zone => zone.active)) {
      setError("Keep at least one delivery area active so customers can check out.");
      return;
    }
    if (zones.some(zone => zone.name.trim().length < 2 || !Number.isFinite(zone.fee) || zone.fee < 0)) {
      setError("Give every delivery area a name and a valid non-negative fee.");
      return;
    }
    await mutate("/api/admin/settings", "PUT", {
      settings: { ...settings, supportedDays: [...settings.supportedDays].sort((a, b) => a - b) },
      zones: zones.map(zone => ({ ...zone, name: zone.name.trim() })),
    }, "Delivery settings saved. Existing order prices and schedules are preserved.");
  }

  return <>
    <div className="admin-title"><div><span className="eyebrow">The details behind a good week</span><h1>Make the routine work.</h1><p>Manage delivery areas, order cutoffs, and weekly packages. Changes apply to new selections and checkout.</p></div></div>
    <form className="admin-form" onSubmit={saveSettings}>
      <section className="card"><h2>Delivery rhythm</h2><div className="admin-form-grid">
        <label className="field">Order cutoff (hours before delivery)<input className="input" type="number" required min="1" max="168" step="1" value={settings.cutoffHours} disabled={busy} onChange={event => setSettings(current => ({ ...current, cutoffHours: Number(event.target.value) }))} /><small>Measured before 8:00 AM Philippine time on the delivery date.</small></label>
        <label className="field">Delivery window<input className="input" required minLength={3} maxLength={100} value={settings.deliveryWindow} disabled={busy} onChange={event => setSettings(current => ({ ...current, deliveryWindow: event.target.value }))} placeholder="8:00 AM – 12:00 PM" /></label>
        <fieldset className="admin-full-width"><legend className="admin-detail-label">Supported delivery days</legend><div className="admin-checkbox-group">{DAYS.map((day, index) => <label className="admin-checkbox" key={day}><input type="checkbox" checked={settings.supportedDays.includes(index)} disabled={busy} onChange={event => setSettings(current => ({ ...current, supportedDays: event.target.checked ? [...current.supportedDays, index] : current.supportedDays.filter(value => value !== index) }))} />{day}</label>)}</div></fieldset>
      </div></section>
      <section className="card"><h2>Delivery areas</h2><p className="muted">Fees are charged once per delivery day. Deactivate an area to stop new orders there while retaining order history.</p>
        {zones.map(zone => <div className="admin-zone" key={zone.id}>
          <label className="field">Area name<input className="input" required minLength={2} maxLength={100} value={zone.name} disabled={busy} onChange={event => updateZone(zone.id, { name: event.target.value })} /></label>
          <label className="field">Fee per day (₱)<input className="input" type="number" inputMode="decimal" required min="0" max="1000000" step="0.01" value={zone.fee / 100} disabled={busy} onChange={event => updateZone(zone.id, { fee: Math.round(Number(event.target.value) * 100) })} /></label>
          <label className="admin-checkbox"><input type="checkbox" checked={zone.active} disabled={busy} onChange={event => updateZone(zone.id, { active: event.target.checked })} />Active</label>
        </div>)}
        <button className="button button-secondary button-sm" type="button" disabled={busy} onClick={() => setZones(current => [...current, { id: `zone-${crypto.randomUUID()}`, name: "", fee: 0, active: true }])}><Plus size={16} />Add delivery area</button>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="admin-form-footer"><p>All schedules use Asia/Manila time.</p><button className="button" disabled={busy} type="submit"><Save size={16} />{busy ? "Saving…" : "Save delivery settings"}</button></div>
    </form>
    <section className="admin-section"><h2>Weekly packages</h2><p className="muted">A package defines the number of meals in a weekly order. A flexible package uses zero; customers pay the actual total of their selected meals.</p><div className="admin-package-grid">{data.packages.map(item => <PackageEditor key={item.id} item={item} mutate={mutate} busy={busy} />)}</div></section>
  </>;
}

function PackageEditor({ item, mutate, busy }: { item: Package; mutate: Mutate; busy: boolean }) {
  const [form, setForm] = useState(item);
  const [price, setPrice] = useState(String(item.price / 100));
  async function save(event: FormEvent) {
    event.preventDefault();
    await mutate(`/api/admin/packages/${item.id}`, "PUT", { ...form, price: Math.round(Number(price) * 100) }, `${form.name} package saved.`);
  }
  return <form className="admin-package-form" onSubmit={save}>
    <h3>{item.name}</h3>
    <label className="field">Package name<input className="input" required minLength={2} maxLength={80} disabled={busy} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
    <label className="field">Description<textarea className="input" required minLength={3} maxLength={500} disabled={busy} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
    <div className="admin-form-grid"><label className="field">Meals per week<input className="input" required type="number" min="0" max="21" step="1" disabled={busy} value={form.mealCount} onChange={event => setForm(current => ({ ...current, mealCount: Number(event.target.value) }))} /><small>Zero allows a flexible meal count.</small></label>
    <label className="field">Starting price (₱)<input className="input" required type="number" min="0" max="1000000" step="0.01" disabled={busy} value={price} onChange={event => setPrice(event.target.value)} /><small>Display reference; checkout uses the selected meal total.</small></label></div>
    <label className="admin-checkbox"><input type="checkbox" checked={form.active} disabled={busy} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} />Available for new subscriptions</label>
    <button className="button button-secondary" disabled={busy} type="submit"><Save size={16} />Save package</button>
  </form>;
}
