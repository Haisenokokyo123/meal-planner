"use client";

import { useState, type FormEvent } from "react";
import { PublicImage as Image } from "@/components/food-image";
import Link from "@/lib/router";
import { useRouter } from "@/lib/router";
import { ArrowRight, Eye, EyeOff, Leaf, LoaderCircle } from "lucide-react";
import { api, useUser } from "@/lib/client";
import type { User } from "@/lib/types";
import "./public.css";

type AuthMode = "login" | "register" | "forgot-password" | "reset-password";
const copy: Record<AuthMode, { eyebrow: string; title: string; description: string; button: string }> = {
  login: { eyebrow: "YOUR SEAT AT THE TABLE", title: "Welcome back.", description: "A delicious week is waiting. Let’s pick up where you left off.", button: "Log in" },
  register: { eyebrow: "A FRESH START", title: "Make room for good food.", description: "Create your account, then build a week around your taste, goals, and everyday life.", button: "Create my account" },
  "forgot-password": { eyebrow: "LET’S GET YOU BACK", title: "Forgot your password?", description: "Enter your account email and we’ll prepare a password reset link.", button: "Request reset link" },
  "reset-password": { eyebrow: "A LITTLE RESET", title: "A fresh password.", description: "Choose a new password to keep your meal plans and personal information protected.", button: "Save new password" },
};

function PasswordField({ id, label, value, onChange, isNew = false, forgot = false }: { id: string; label: string; value: string; onChange: (value: string) => void; isNew?: boolean; forgot?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="field"><div className="public-auth-password-label"><label htmlFor={id}>{label}</label>{forgot && <Link href="/forgot-password">Forgot password?</Link>}</div><div className="public-password-input"><input id={id} type={visible ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} autoComplete={isNew ? "new-password" : "current-password"} minLength={isNew ? 10 : 1} maxLength={200} required aria-describedby={isNew ? `${id}-hint` : undefined} /><button type="button" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{isNew && <small id={`${id}-hint`}>At least 10 characters. A unique passphrase works well.</small>}</div>;
}

function returnPath(fallback: string) {
  const next = new URLSearchParams(window.location.search).get("next");
  // Restrict redirects to app paths and exclude browser-normalized external URLs.
  return next && /^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(next) && !next.startsWith("/api/") ? next : fallback;
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, refresh } = useUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const item = copy[mode];
  const hasPassword = mode !== "forgot-password";
  const isNew = mode === "register" || mode === "reset-password";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setSuccess("");
    if (isNew && password !== confirmation) { setError("Your passwords don’t match. Please check both fields."); return; }
    if (isNew && new TextEncoder().encode(password).length > 72) { setError("Your password must fit within 72 UTF-8 bytes. Please use a shorter passphrase."); return; }
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (mode === "reset-password" && !token) { setError("This reset link is incomplete. Request a new link using Forgot password."); return; }
    setBusy(true);
    try {
      if (mode === "login" || mode === "register") {
        const result = await api<User>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ ...(mode === "register" ? { name: name.trim() } : {}), email: email.trim(), password }) });
        await refresh();
        router.push(returnPath(result.role === "ADMIN" ? "/admin" : mode === "register" ? "/onboarding" : "/dashboard"));
      } else if (mode === "forgot-password") {
        await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
        setSuccess("If an account matches that email, a reset link has been prepared. In this local demonstration, the project operator can retrieve it from the private mail outbox described in the setup guide.");
      } else {
        await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
        setPassword(""); setConfirmation(""); await refresh();
        setSuccess("Your password has been updated. Log in with your new password to continue.");
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="public-page public-auth"><aside className="public-auth-story"><div><span className="public-eyebrow"><span />MADE FOR YOUR KIND OF WEEK</span><h2>A little planning.<br />A lot of sarap.</h2></div><p>Comforting Filipino flavors. Thoughtful portions. More room for the things you love.</p><div className="public-auth-food"><Image src="/images/chicken-inasal.webp" alt="Chicken inasal with rice and colorful vegetables" width={600} height={600} priority /></div><div className="public-auth-story-bottom"><Leaf size={19} />Your meals. Your rhythm. Sakto.</div></aside>
    <section className="public-auth-form-wrap"><div className="public-auth-form"><span className="public-eyebrow"><span />{item.eyebrow}</span><h1>{item.title}</h1><p>{item.description}</p>
      {user && (mode === "login" || mode === "register") && <div className="public-auth-callout">You’re currently signed in as {user.name}. <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"}>Open your dashboard →</Link></div>}
      {error && <div className="public-form-message" data-error="true" role="alert">{error}</div>}
      {success && <div className="public-form-message" role="status">{success}</div>}
      {!(mode === "reset-password" && success) && <form onSubmit={submit} aria-busy={busy}>
        {mode === "register" && <div className="field"><label htmlFor="auth-name">Your name</label><input id="auth-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required /></div>}
        {mode !== "reset-password" && <div className="field"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required placeholder="you@example.com" /></div>}
        {hasPassword && <PasswordField id="auth-password" label={mode === "reset-password" ? "New password" : "Password"} value={password} onChange={setPassword} isNew={isNew} forgot={mode === "login"} />}
        {isNew && <PasswordField id="auth-confirm" label="Confirm password" value={confirmation} onChange={setConfirmation} isNew />}
        {mode === "register" && <label className="checkbox-label public-auth-consent"><input type="checkbox" required /><span>I agree to the <Link href="/terms">terms of service</Link> and have read the <Link href="/privacy">privacy policy</Link>.</span></label>}
        <button className="button" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={18} className="spinner" />Please wait…</> : <>{item.button}<ArrowRight size={18} /></>}</button>
      </form>}
      {mode === "login" && <p className="public-auth-bottom">New to the table? <Link href="/register">Create an account</Link></p>}
      {mode === "register" && <p className="public-auth-bottom">Already part of the table? <Link href="/login">Log in</Link></p>}
      {(mode === "forgot-password" || mode === "reset-password") && <p className="public-auth-bottom"><Link href="/login">Back to log in</Link>{mode === "reset-password" && <> · <Link href="/forgot-password">Request another link</Link></>}</p>}
      <p className="public-auth-terms">Your profile belongs to you. You can review, update, or remove personal information in your account settings.</p>
    </div></section>
  </div>;
}
