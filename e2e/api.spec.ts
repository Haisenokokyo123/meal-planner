import { test, expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import type { Dashboard, Meal, Order, Plan, Profile, Subscription } from "../src/lib/types";

const origin = "http://127.0.0.1:3100";
const profile: Profile = {age:26,height:168,weight:65,sex:"female",activity:"moderate",goal:"balanced",dietary:[],allergies:["peanut"],dislikes:[],preferences:["chicken"],spice:"mild",days:[0,1,2,3,4],slots:["lunch"],budget:150000,calorieTarget:null,consent:true,specialNeeds:false};
function futureMonday(){const d=new Date();d.setUTCDate(d.getUTCDate()+14+((8-d.getUTCDay())%7));return d.toISOString().slice(0,10);}
async function data<T>(response:APIResponse):Promise<T>{expect(response.ok(),await response.text()).toBeTruthy();return (await response.json()).data;}
async function register(context:APIRequestContext,suffix:string){return data(await context.post("/api/auth/register",{headers:{Origin:origin},data:{name:"Sakto Test",email:`${suffix}-${Date.now()}@example.test`,password:"TestAccount-Only-42!"}}));}
const headers={Origin:origin};

test("persisted customer → locked planner → idempotent checkout → admin kitchen and delivery",async({request,playwright})=>{
  await register(request,"journey");
  const saved=await data<{profile:Profile;nutrition:{bmi:number}}>(await request.put("/api/profile",{headers,data:profile}));
  expect(saved.nutrition.bmi).toBeCloseTo(23,0);
  const meals=await data<Meal[]>(await request.get("/api/meals"));expect(meals.length).toBeGreaterThanOrEqual(20);
  let plan=await data<Plan>(await request.post("/api/plans",{headers,data:{weekStart:futureMonday()}}));
  expect(plan.slots).toHaveLength(5);expect(plan.totals.price).toBeLessThanOrEqual(profile.budget);
  expect(plan.slots.every(s=>!s.meal.allergens.some(a=>/peanut/i.test(a)))).toBeTruthy();
  const first=plan.slots[0];
  plan=await data<Plan>(await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:"lock",slotId:first.id,locked:true}}));
  const before=plan.revision;
  plan=await data<Plan>(await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:"regenerate"}}));
  expect(plan.slots.find(s=>s.day===first.day&&s.slot===first.slot)?.mealId).toBe(first.mealId);
  expect(plan.slots.find(s=>s.day===first.day&&s.slot===first.slot)?.locked).toBe(true);
  const stale=await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:before,action:"regenerate"}});expect(stale.status()).toBe(409);
  const swapSlot=plan.slots.find(s=>!s.locked)!;
  const alternatives=await data<Meal[]>(await request.get(`/api/plans/${plan.id}/alternatives?slotId=${swapSlot.id}`));
  const alternative=alternatives.find(m=>m.id!==swapSlot.mealId)!;expect(alternative).toBeTruthy();
  plan=await data<Plan>(await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:"swap",slotId:swapSlot.id,mealId:alternative.id}}));
  expect(plan.slots.find(s=>s.id===swapSlot.id)?.mealId).toBe(alternative.id);
  const persisted=await data<Plan>(await request.get(`/api/plans?weekStart=${plan.weekStart}`));expect(persisted.revision).toBe(plan.revision);
  expect(plan.totals.price).toBe(plan.slots.reduce((n,s)=>n+Math.round(s.meal.price*s.portion),0));
  const stranger=await playwright.request.newContext({baseURL:origin});await register(stranger,"stranger");
  expect((await stranger.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:"regenerate"}})).status()).toBe(404);
  expect((await request.get("/api/admin")).status()).toBe(403);
  const packages=await data<{id:string;mealCount:number}[]>(await request.get("/api/packages"));
  const settings=await data<{zones:{id:string;fee:number}[]}>(await request.get("/api/settings"));
  const payload={planId:plan.id,revision:plan.revision,packageId:packages.find(p=>p.mealCount===5)!.id,zoneId:settings.zones[0].id,address:"123 Test Street, Quezon City, Metro Manila",paymentMethod:"GCash",idempotencyKey:crypto.randomUUID()};
  const checkout=await data<{order:Order;subscription:Subscription}>(await request.post("/api/checkout",{headers,data:payload}));
  expect(checkout.order.items).toHaveLength(5);expect(checkout.order.mealTotal).toBe(plan.totals.price);
  expect(checkout.order.deliveryFee).toBe(settings.zones[0].fee*5);
  const duplicate=await data<{order:Order}>(await request.post("/api/checkout",{headers,data:payload}));expect(duplicate.order.id).toBe(checkout.order.id);
  expect((await request.post("/api/checkout",{headers,data:{...payload,address:"Changed delivery address for same key"}})).status()).toBe(409);
  const admin=await playwright.request.newContext({baseURL:origin});const credentials=JSON.parse(readFileSync(".local/e2e-credentials.json","utf8"));
  await data(await admin.post("/api/auth/login",{headers,data:credentials}));
  const kitchen=await data<{meals:{mealId:string;quantity:number;orderIds:string[]}[]}>(await admin.get(`/api/admin/kitchen?date=${checkout.order.items[0].deliveryDate}`));
  expect(kitchen.meals.some(m=>m.orderIds.includes(checkout.order.id))).toBe(true);
  expect((await admin.patch(`/api/admin/orders/${checkout.order.id}`,{headers,data:{status:"DELIVERED"}})).status()).toBe(409);
  for(const status of ["PREPARING","OUT_FOR_DELIVERY","DELIVERED"]){const updated=await data<Order>(await admin.patch(`/api/admin/orders/${checkout.order.id}`,{headers,data:{status}}));expect(updated.status).toBe(status);}
  const dashboard=await data<Dashboard>(await request.get("/api/dashboard"));expect(dashboard.orders.find(o=>o.id===checkout.order.id)?.status).toBe("DELIVERED");
  expect(dashboard.orders.filter(o=>o.id===checkout.order.id)).toHaveLength(1);
  await data(await request.patch(`/api/subscriptions/${checkout.subscription.id}`,{headers,data:{action:"pause"}}));
  await data(await request.patch(`/api/subscriptions/${checkout.subscription.id}`,{headers,data:{action:"resume"}}));
  await data(await request.patch(`/api/subscriptions/${checkout.subscription.id}`,{headers,data:{action:"cancel"}}));
  await stranger.dispose();await admin.dispose();
});

test("authentication, origin checks, privacy controls and safe unsupported nutrition",async({request})=>{
  expect((await request.get("/api/dashboard")).status()).toBe(401);
  expect((await request.post("/api/auth/register",{headers:{Origin:"https://untrusted.example"},data:{name:"Blocked",email:"blocked@example.test",password:"LongEnoughPassword42!"}})).status()).toBe(403);
  await register(request,"privacy");
  expect((await request.put("/api/profile",{headers,data:{...profile,consent:false}})).status()).toBe(400);
  const special=await data<{nutrition:{energy:number|null;target:number|null}}>(await request.put("/api/profile",{headers,data:{...profile,specialNeeds:true}}));
  expect(special.nutrition.energy).toBeNull();expect(special.nutrition.target).toBeNull();
  await data(await request.put("/api/profile",{headers,data:{...profile,budget:100}}));
  const impossible=await request.post("/api/plans",{headers,data:{weekStart:futureMonday()}});expect(impossible.ok()).toBe(false);expect((await impossible.json()).error).toMatch(/budget|cost|afford/i);
  await data(await request.delete("/api/profile",{headers,data:{}}));
  expect((await data<{profile:Profile|null}>(await request.get("/api/profile"))).profile).toBeNull();
  await data(await request.post("/api/auth/logout",{headers,data:{}}));expect((await request.get("/api/dashboard")).status()).toBe(401);
});

test("admin catalog changes invalidate locked meal regeneration",async({request,playwright})=>{
  await register(request,"availability");await data(await request.put("/api/profile",{headers,data:profile}));
  let plan=await data<Plan>(await request.post("/api/plans",{headers,data:{weekStart:futureMonday()}}));
  const meal=plan.slots[0].meal;
  plan=await data<Plan>(await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:"lock",slotId:plan.slots[0].id,locked:true}}));
  const admin=await playwright.request.newContext({baseURL:origin});await data(await admin.post("/api/auth/login",{headers,data:JSON.parse(readFileSync(".local/e2e-credentials.json","utf8"))}));
  await data(await admin.put(`/api/admin/meals/${meal.id}`,{headers,data:{...meal,available:false}}));
  const conflict=await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:"regenerate"}});expect(conflict.ok()).toBe(false);expect((await conflict.json()).error).toMatch(/locked|unavailable|available/i);
  await data(await admin.put(`/api/admin/meals/${meal.id}`,{headers,data:meal}));
  await admin.dispose();
});

test('password reset is private, single-use, revokes sessions and account deletion works',async({request,playwright})=>{
  const email=`reset-${Date.now()}@example.test`;const password='Reset-Original-Only-42!';
  await data(await request.post('/api/auth/register',{headers,data:{name:'Reset Test',email,password}}));
  const other=await playwright.request.newContext({baseURL:origin});await data(await other.post('/api/auth/login',{headers,data:{email,password}}));
  const response=await request.post('/api/auth/forgot-password',{headers,data:{email}});expect(await response.json()).toEqual({data:{ok:true}});
  const message=readdirSync('.local/e2e-outbox').map(file=>JSON.parse(readFileSync(`.local/e2e-outbox/${file}`,'utf8'))).find(m=>m.to===email);
  const token=new URL(message.resetUrl).searchParams.get('token');expect(token).toBeTruthy();
  const nextPassword='Reset-Updated-Only-42!';await data(await request.post('/api/auth/reset-password',{headers,data:{token,password:nextPassword}}));
  expect((await other.get('/api/dashboard')).status()).toBe(401);
  expect((await request.post('/api/auth/reset-password',{headers,data:{token,password:nextPassword}})).status()).toBe(400);
  expect((await request.post('/api/auth/login',{headers,data:{email,password}})).status()).toBe(401);
  await data(await request.post('/api/auth/login',{headers,data:{email,password:nextPassword}}));
  await data(await request.post('/api/auth/change-password',{headers,data:{currentPassword:nextPassword,password:'Changed-Again-Only-42!'}}));
  await data(await request.post('/api/account/delete',{headers,data:{password:'Changed-Again-Only-42!'}}));
  expect((await request.get('/api/dashboard')).status()).toBe(401);await other.dispose();
});

test('admin meal CRUD, delivery settings, packages, validation and snapshots',async({request,playwright})=>{
  const admin=await playwright.request.newContext({baseURL:origin});await data(await admin.post('/api/auth/login',{headers,data:JSON.parse(readFileSync('.local/e2e-credentials.json','utf8'))}));
  const catalog=await data<Meal[]>(await admin.get('/api/meals'));const meal={...catalog[0],slug:`test-dish-${Date.now()}`,name:'Kitchen Test Bowl',price:17500,protein:30,carbs:50,fat:20,calories:500};
  const created=await data<Meal>(await admin.post('/api/admin/meals',{headers,data:meal}));expect(created.id).not.toBe(meal.id);
  expect((await admin.put(`/api/admin/meals/${created.id}`,{headers,data:{...created,calories:10}})).status()).toBe(400);
  await register(request,'snapshot');await data(await request.put('/api/profile',{headers,data:{...profile,days:[0],slots:['lunch']}}));
  let plan=await data<Plan>(await request.post('/api/plans',{headers,data:{weekStart:futureMonday()}}));
  plan=await data<Plan>(await request.patch(`/api/plans/${plan.id}`,{headers,data:{revision:plan.revision,action:'swap',slotId:plan.slots[0].id,mealId:created.id}}));
  const config=await data<{zones:{id:string;fee:number;name:string;active:boolean}[];settings:{cutoffHours:number;deliveryWindow:string;supportedDays:number[]}}>(await admin.get('/api/settings'));
  const checkout=await data<{order:Order}>(await request.post('/api/checkout',{headers,data:{planId:plan.id,revision:plan.revision,packageId:'custom',zoneId:config.zones[0].id,address:'123 Test Street, Makati City',paymentMethod:'Maya',idempotencyKey:crypto.randomUUID()}}));
  await data(await admin.put(`/api/admin/meals/${created.id}`,{headers,data:{...created,price:20000,available:false}}));
  const after=await data<Dashboard>(await request.get('/api/dashboard'));const order=after.orders.find(o=>o.id===checkout.order.id)!;
  expect(order.mealTotal).toBe(checkout.order.mealTotal);expect(order.items[0].price).toBe(checkout.order.items[0].price);expect(order.exceptions?.length).toBe(1);
  await data(await admin.patch(`/api/admin/orders/${order.id}`,{headers,data:{status:'CANCELLED'}}));
  const kitchen=await data<{meals:{orderIds:string[]}[]}>(await admin.get(`/api/admin/kitchen?date=${order.items[0].deliveryDate}`));expect(kitchen.meals.some(m=>m.orderIds.includes(order.id))).toBe(false);
  const changed={...config,settings:{...config.settings,cutoffHours:25}};await data(await admin.put('/api/admin/settings',{headers,data:changed}));
  expect((await data<typeof config>(await admin.get('/api/settings'))).settings.cutoffHours).toBe(25);
  await data(await admin.put('/api/admin/settings',{headers,data:config}));
  await admin.dispose();
});
