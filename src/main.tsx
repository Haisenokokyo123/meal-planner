import { Component, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { UserProvider } from "./lib/client";
import { ScrollToTop } from "./lib/router";
import { SiteShell } from "./components/site-shell";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./styles/globals.css";
const Home=lazy(()=>import('./components/public/home').then(m=>({default:m.Home})));
const Catalog=lazy(()=>import('./components/public/catalog').then(m=>({default:m.MealCatalog})));
const Detail=lazy(()=>import('./components/public/catalog').then(m=>({default:m.MealDetail})));
const Auth=lazy(()=>import('./components/public/auth').then(m=>({default:m.AuthPage})));
const How=lazy(()=>import('./components/public/information').then(m=>({default:m.HowItWorks})));
const Plans=lazy(()=>import('./components/public/information').then(m=>({default:m.PlansPage})));
const About=lazy(()=>import('./components/public/information').then(m=>({default:m.AboutPage})));
const Contact=lazy(()=>import('./components/public/information').then(m=>({default:m.ContactPage})));
const Legal=lazy(()=>import('./components/public/information').then(m=>({default:m.LegalPage})));
const Onboarding=lazy(()=>import('./components/customer/onboarding').then(m=>({default:m.Onboarding})));
const Results=lazy(()=>import('./components/customer/onboarding').then(m=>({default:m.OnboardingResults})));
const Planner=lazy(()=>import('./components/customer/planner').then(m=>({default:m.Planner})));
const Review=lazy(()=>import('./components/customer/planner').then(m=>({default:m.PlanReview})));
const Checkout=lazy(()=>import('./components/customer/checkout').then(m=>({default:m.Checkout})));
const Success=lazy(()=>import('./components/customer/checkout').then(m=>({default:m.CheckoutSuccess})));
const Dashboard=lazy(()=>import('./components/customer/dashboard').then(m=>({default:m.CustomerDashboard})));
const Admin=lazy(()=>import('./components/admin/AdminConsole').then(m=>({default:m.AdminConsole})));
const NotFound=lazy(()=>import('./components/not-found'));
function CustomerRoute(){const {section}=useParams();if(section&&!['subscription','orders','progress','profile','settings'].includes(section))return <NotFound/>;return <Dashboard section={section as 'subscription'|'orders'|'progress'|'profile'|'settings'|undefined}/>;}
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="container section"><h1>Let’s give that another try.</h1><p>We couldn’t load this view. Your saved records are still in your account.</p><button className="button" onClick={()=>window.location.reload()}>Reload page</button></div>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<BrowserRouter basename={window.__SAKTO_BASE__||'/'}><UserProvider><ScrollToTop/><SiteShell><Boundary><Suspense fallback={<div className="container section" role="status">Preparing your page…</div>}><Routes>
<Route path="/" element={<Home/>}/><Route path="/meals" element={<Catalog/>}/><Route path="/meals/:slug" element={<Detail/>}/><Route path="/plans" element={<Plans/>}/><Route path="/how-it-works" element={<How/>}/><Route path="/about" element={<About/>}/><Route path="/contact" element={<Contact/>}/><Route path="/privacy" element={<Legal kind="privacy"/>}/><Route path="/terms" element={<Legal kind="terms"/>}/>
{(['login','register','forgot-password','reset-password'] as const).map(mode=><Route key={mode} path={`/${mode}`} element={<Auth key={mode} mode={mode}/>}/>)}
<Route path="/onboarding" element={<Onboarding/>}/><Route path="/onboarding/results" element={<Results/>}/><Route path="/planner" element={<Planner/>}/><Route path="/planner/review" element={<Review/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/checkout/success" element={<Success/>}/><Route path="/dashboard" element={<CustomerRoute/>}/><Route path="/dashboard/:section" element={<CustomerRoute/>}/><Route path="/admin/*" element={<Admin/>}/><Route path="*" element={<NotFound/>}/>
</Routes></Suspense></Boundary></SiteShell></UserProvider></BrowserRouter>);
