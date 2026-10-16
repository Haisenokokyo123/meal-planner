# Shared API contract

All success JSON is `{ data: ... }`, errors `{ error: string }` with non-2xx status. Types in `src/lib/types.ts` are the shared contract. Money is integer centavos. Day 0 is Monday. dates are YYYY-MM-DD (Manila calendar). All mutating requests use JSON and same-origin session cookies. API must enforce Origin and ownership. UI helper throws on errors.

- GET /api/auth/me -> User|null
- POST /api/auth/register {name,email,password} -> User; creates cookie
- POST /api/auth/login {email,password} -> User
- POST /api/auth/logout {} -> {ok:true}
- POST /api/auth/forgot-password {email} -> {ok:true}; local dev outbox, generic response
- POST /api/auth/reset-password {token,password} -> {ok:true}
- POST /api/auth/change-password {currentPassword,password} -> {ok:true}
- GET /api/meals -> Meal[]; GET /api/meals/:slug -> Meal
- GET /api/packages -> Package[]
- GET /api/settings -> {zones:DeliveryZone[],settings:Settings}
- GET /api/profile -> {profile:Profile|null,nutrition:Nutrition|null}
- PUT /api/profile Profile -> {profile:Profile,nutrition:Nutrition}
- GET /api/plans?weekStart=YYYY-MM-DD -> Plan|null (default latest draft or latest)
- POST /api/plans {weekStart?:string} -> Plan; generate from saved profile. Existing draft regeneration requires revision through PATCH.
- PATCH /api/plans/:id {revision:number,action:'regenerate'|'lock'|'swap'|'remove'|'add'|'portion',slotId?:string,locked?:boolean,mealId?:string,day?:number,slot?:MealTime,portion?:number} -> Plan. All edits persistent, optimistic revision required; locked preserve on regenerate.
- GET /api/plans/:id/alternatives?slotId=... -> Meal[] (safety + budget eligible)
- POST /api/favorites {mealId:string} -> string[] toggles favorite
- POST /api/checkout {planId,revision,packageId,zoneId,address,paymentMethod:'GCash'|'Maya'|'Card',idempotencyKey} -> {order:Order,subscription:Subscription}. Server prices, delivery fee per delivery day, revalidate budget/eligibility/schedule, transaction and idempotency.
- GET /api/dashboard -> Dashboard
- PATCH /api/subscriptions/:id {action:'pause'|'resume'|'cancel'} -> Subscription
- POST /api/weights {weight:number,date:YYYY-MM-DD} -> dashboard weights
- DELETE /api/weights/:id -> {ok:true}
- DELETE /api/profile -> {ok:true} removes sensitive nutrition fields and draft plans
- POST /api/account/delete {password} -> {ok:true}; anonymize operational records, delete profile/sessions, prohibit outstanding orders.
- POST /api/contact {name,email,message} -> {ok:true}; persisted support inquiry.

## Admin (ADMIN only)
- GET /api/admin?from=YYYY-MM-DD&to=YYYY-MM-DD -> {stats:{customers,activeSubscriptions,orders,scheduledMeals,sales},orders:Order[],meals:Meal[],packages:Package[],zones:DeliveryZone[],settings:Settings,subscriptions:(Subscription&{user:User})[],customers:{id,name,email,orderCount}[],sales:{date,total,orders}[],popular:{name,quantity}[],audit:{id,action,createdAt}[]}
- POST /api/admin/meals Meal without id -> Meal
- PUT /api/admin/meals/:id Meal -> Meal (archive via available:false; preserve historical prices in OrderItem)
- PATCH /api/admin/orders/:id {status:OrderStatus} -> Order; valid forward transitions or pre-delivery cancel.
- PUT /api/admin/packages/:id Package -> Package
- PUT /api/admin/settings {settings:Settings,zones:DeliveryZone[]} -> {settings,zones}
- GET /api/admin/kitchen?date=YYYY-MM-DD -> {date,meals:{mealId,name,quantity,portions,orderIds:string[]}[]}
