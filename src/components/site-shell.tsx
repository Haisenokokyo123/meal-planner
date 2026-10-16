"use client";
import Link from "@/lib/router";
import { usePathname, useRouter } from "@/lib/router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Leaf, Menu, X, LogOut } from "lucide-react";
import { api, useUser } from "@/lib/client";

export function SiteShell({children}: {children: ReactNode}) {
  const pathname = usePathname(); const router = useRouter();
  const {user, refresh} = useUser(); const [open,setOpen] = useState(false); const [error,setError] = useState("");
  useEffect(() => {setOpen(false);}, [pathname]);
  const workspace = pathname.startsWith("/admin") || pathname.startsWith("/planner");
  async function logout() { try {await api("/api/auth/logout",{method:"POST",body:"{}"});await refresh();router.push("/");} catch(e) {setError((e as Error).message);} }
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header"><div className="nav-wrap">
      <Link href="/" className="brand" aria-label="Sakto Meals home"><span className="brand-mark"><Leaf size={25} strokeWidth={2.6}/></span>sakto<span className="brand-sub">meals</span><span className="brand-dot">.</span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {[["/meals","Our meals"],["/how-it-works","How it works"],["/plans","Meal plans"]].map(([href,label])=><Link key={href} className={pathname===href?"active":""} href={href}>{label}</Link>)}
        {user && <Link href={user.role==="ADMIN"?"/admin":"/dashboard"}>{user.role==="ADMIN"?"Admin":"My account"}</Link>}
      </nav>
      <div className="nav-actions">{user ? <button onClick={logout} className="nav-login" aria-label="Log out"><LogOut size={18}/><span>Log out</span></button> : <Link href="/login" className="nav-login">Log in</Link>}
        <Link href={user?"/planner":"/onboarding"} className="button nav-cta">Build my week <ArrowUpRight size={17}/></Link>
        <button className="mobile-toggle" aria-label={open?"Close menu":"Open menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
      </div>
    </div>{open&&<nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation"><Link href="/">Home</Link><Link href="/meals">Our meals</Link><Link href="/how-it-works">How it works</Link><Link href="/plans">Meal plans</Link><Link href={user?"/dashboard":"/login"}>{user?"My dashboard":"Log in"}</Link>{user?.role==="ADMIN"&&<Link href="/admin">Administration</Link>}<Link href="/onboarding">Build my week</Link></nav>}
    </header>
    {error&&<div role="alert" className="error container">{error}</div>}
    <main id="main-content" tabIndex={-1}>{children}</main>
    {!workspace&&<footer className="site-footer"><div className="container footer-grid"><div><Link href="/" className="brand"><Leaf size={27}/> sakto meals.</Link><p>Sarap sa kain. Sakto sa goals.</p><p className="muted">Thoughtfully planned.<br/>Deliciously Filipino.</p></div><div><strong>A little more Sakto</strong><Link href="/meals">Explore the menu</Link><Link href="/plans">Our meal plans</Link><Link href="/about">Our story</Link><Link href="/contact">Get in touch</Link></div><div><strong>Good to know</strong><Link href="/how-it-works">How it works</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of service</Link></div><div className="footer-note"><span className="badge">Made for a delicious week</span><p>An academic capstone prototype. Pricing, payments, and deliveries are for demonstration. Nutrition values are estimates.</p></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Sakto Meals. An original capstone experience.</span><span>Made with care, inspired by home.</span></div></footer>}
  </>;
}
