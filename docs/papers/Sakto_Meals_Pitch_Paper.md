# SAKTO MEALS
# A Personalized Filipino Meal Planning and Subscription Management System
Venture Pitch Paper
Institution: Mindoro State University
Team: Mark Leonard D. Caunceran; Shana Mamitag; Rinalyn Manlesis
Location: Bansud, Oriental Mindoro
Submission date: [Month Day, Year]
Logo: [Insert approved logo]

## II. Problem Description
The daily meal decision creates a recurring planning burden.

Sakto Meals addresses the difficulty of arranging affordable, preference-aware Filipino meals for a working week. The proposed customer is an adult student or early-career worker who has limited time to shop, cook, and repeatedly compare meal options. The problem is specific: selecting several meals in advance while staying within a budget and maintaining enough variety.

Who experiences the problem and when

A commuter may have a short lunch break, limited kitchen access, and different food preferences from colleagues. Choosing meals one order at a time can make the weekly total difficult to anticipate. A customer with declared allergies or dietary restrictions must also examine each dish rather than rely on its name. These are customer hypotheses for interviews, not findings from a completed survey.

Why it occurs

Meal selection, spending, dietary preferences, and delivery arrangements are often handled as separate decisions. A delivery listing can show available dishes without helping the customer assemble a coherent week. Home cooking requires shopping and preparation time, while a fixed menu can reduce flexibility. The venture proposes a single workflow for planning, reviewing, and confirming meals.

Why the problem matters

Economically, visible weekly totals may help customers compare spending before committing. Socially, familiar Filipino dishes and flexible preferences may make planned meals more acceptable. Operationally, advance order quantities may help a partner kitchen plan purchasing and preparation. Reduced waste is a potential outcome to measure, not a demonstrated environmental benefit.

Illustrative example: one customer selecting lunch and dinner on five weekdays faces 10 meal selections per week. At the model price of PHP 185 per meal, meals total PHP 1,850; five PHP 50 delivery charges add PHP 250. The PHP 2,100 total is an example, not evidence of average customer spending.

Validation will begin with at least 20 interviews about current meal routines, actual receipts where participants consent, acceptable prices, and reasons for abandoning meal plans. Demand and willingness to pay must be established before commercial expansion.

## III. Target Market Segment
Start with one reachable community, then expand only after validation.

Primary customer

The initial segment is adults approximately 18–35 years old who study or work within one proposed service area in Bansud, Oriental Mindoro. They use a smartphone or computer, buy prepared meals several times a week, and value Filipino food, predictable spending, and convenience. Age and purchasing behavior are targeting assumptions, not measured customer demographics.

The proposed beachhead is one reachable campus or office community in Bansud with predictable weekday schedules and clustered delivery addresses. Early adopters are people already buying lunch regularly, sharing meal orders with colleagues, or actively tracking food spending. Customers needing clinical diets are outside the initial service promise.

Illustrative market sizing — replace with verified local counts

Measure | Assumed audience | Illustrative annual meal revenue
TAM: broad opportunity | 100,000 adults in a hypothetical wider regional market | PHP 8.880 billion
SAM: initial reachable areas | 10,000 adults in an assumed Bansud service catchment | PHP 888 million
SOM: year-one target | 100 average active customers | PHP 8.880 million

Each estimate uses the same consumption scenario: 10 meals per week × PHP 185 × 48 active weeks = PHP 88,800 per customer-year. TAM and SAM assume the full audience purchases at that frequency; they are scenario ceilings, not forecasts. SOM assumes 100 customers active on average across all 48 weeks, rather than merely reaching 100 by year-end. Delivery receipts are excluded.

How the assumptions will be checked

The assumed audience sizes are not official population figures for Bansud or Mindoro. Replace audience assumptions using institutional enrollment or workforce counts, geographic delivery coverage, and a screening survey. Estimate the share that actually buys prepared meals and can afford the offer. SOM is subject to kitchen throughput, delivery reliability, retention, and acquisition cost; 100 active customers at 10 meals each require 1,000 meals per week.

Initial pilot target: 20 voluntary adult customers in one service cluster. Neither the 20-customer pilot nor the 100-customer SOM has been achieved. No measured market share or externally sourced population statistic is claimed.

## IV. Solution
A weekly Filipino meal plan that customers can adjust before ordering.

Sakto Meals is a personalized Filipino meal planning and subscription management system. Customers enter their selected days, meal times, food preferences, allergies, and weekly meal budget. The application generates a proposed plan from the available catalog and allows customers to review the result before checkout. The current deliverable is a working local prototype rather than a launched food delivery company.

How the service would work

First, the customer creates an account and completes a profile. Second, the planner proposes meals for the chosen schedule. Third, the customer locks favorites, regenerates unlocked choices, compares swaps, and changes supported portions. Fourth, checkout presents meal and delivery totals. Finally, the customer monitors order status while an administrator manages the catalog, orders, and preparation quantities.

Why customers may prefer it

Alternative | Tradeoff to test | Sakto Meals response
One-off food orders | Repeated decisions; weekly spending assembled afterward | Plan several meals together and review totals before confirmation.
Fixed meal packages | Less control over individual dishes | Keep selected meals, swap others, and choose supported portions.
Home cooking | Shopping and preparation time | Proposed prepared-meal service with advance planning.

These comparisons describe product tradeoffs, not a verified claim that Sakto Meals is cheaper, healthier, or superior to every existing service. Competitor pricing and customer preference testing remain necessary.

Scope of the working prototype

The system runs locally through XAMPP Apache/PHP with MySQL or MariaDB, managed using phpMyAdmin. It includes customer and administrator workflows and a seeded Filipino meal catalog. Seeded delivery zones are demonstration areas outside Bansud; the administrator must configure actual Bansud service zones and fees before a local pilot. Recommendations use a rule-based, explainable search algorithm; no external AI service is required. Payment is simulated, and future subscription cycles require manual planning and confirmation.

Nutrition values are estimates. Allergy filtering relies on accurate ingredient declarations and does not guarantee cross-contact safety. The prototype does not provide clinical diet prescriptions or replace advice from qualified professionals.

## V. Features
Five functions tied to customer and operating benefits.

Core feature | What it does | Customer or business benefit
1. Personalized weekly planning | Uses the selected schedule, budget, declared preferences, and eligible meals to propose a week. | Reduces repeated selection work and makes the planned meal cost visible.
2. Flexible meal control | Supports locking, regeneration, meal comparisons and swaps, supported portions, and favorites. | Customers can keep dishes they like while adjusting the rest of their plan.
3. Catalog and dietary information | Shows meal details and estimated nutrition; filters against declared allergies and restrictions. | Helps customers evaluate choices with clearer information before ordering.
4. Orders and subscription records | Saves confirmed orders, meal/price snapshots, delivery charges, status, and subscription actions. | Creates a consistent record of what was selected and its confirmed cost.
5. Administrator and kitchen workspace | Manages meals, availability, order transitions, preparation totals, delivery areas, and settings. | Supports coordinated preparation and reduces reliance on disconnected order lists.

Reliability built into the workflow

The server checks eligibility, prices, plan revisions, capacity, and cutoffs before confirming an order. Confirmed orders retain their historical item snapshots. Checkout retries with the same idempotency key avoid creating duplicate orders. Customer access and administrator actions are separated by authorization checks.

Designed for accessible local demonstrations

The interface supports desktop and mobile layouts, and local food images and fonts reduce external dependencies. The compiled frontend is included, so the delivered application can run through Apache without a Node server. The database can be installed through a complete SQL import in phpMyAdmin.

Delivery execution, real payment settlement, automatic recurring billing, and verified food-production operations are outside the current prototype. They are implementation and partnership work for a later commercial pilot.

## VI. Business Model
Proposed meal revenue with transparent delivery charges.

How the venture would earn revenue

The proposed model earns revenue from prepared meals sold through weekly plans. Customers may select 5-, 10-, or 15-meal schedules or a custom schedule. Repeated voluntary purchases would provide recurring customer revenue; this is different from automatic recurring payment, which is not implemented. Office or campus group orders are a possible later channel rather than a current revenue stream.

Proposed pricing strategy

Use PHP 185 as the planning price for a regular meal in this financial model. Actual prototype catalog prices range from PHP 120 to PHP 215 and depend on the dish and portion. Checkout calculates the sum of selected items; a package label does not create a flat-price entitlement. Prototype package reference values are demonstration configuration, not validated commercial price quotes.

Illustrative schedule | Meal-only total at PHP 185 | Delivery assumption | Weekly customer total
5 meals / 5 days | PHP 925 | 5 × PHP 50 = PHP 250 | PHP 1,175
10 meals / 5 days | PHP 1,850 | 5 × PHP 50 = PHP 250 | PHP 2,100
15 meals / 5 days | PHP 2,775 | 5 × PHP 50 = PHP 250 | PHP 3,025

Illustrative unit economics

Per-meal variable cost is assumed at PHP 125: ingredients PHP 78, preparation labor PHP 22, packaging PHP 12, kitchen utilities PHP 8, and spoilage allowance PHP 5. At a PHP 185 selling price, contribution is PHP 60 per meal, or 32.4%, before fixed costs, taxes, and other excluded items. These are planning estimates requiring supplier and kitchen quotations.

At assumed fixed operating costs of PHP 30,000 per four-week planning period, break-even is 500 meals (30,000 ÷ 60). A scenario of 20 customers buying 10 meals weekly for four weeks produces 800 meals, PHP 148,000 meal revenue, PHP 100,000 variable costs, and PHP 18,000 operating surplus after that fixed allowance. Delivery charges are treated as pass-through receipts and excluded from this margin.

This surplus is not net profit. The model excludes tax, financing, equipment depreciation, and full founder salaries, and assumes all 20 customers purchase for all four weeks. Delivery fees must cover actual courier costs; otherwise the contribution estimate falls.

## VII. Proposed Use of Funds / Ask
PHP 150,000 in proposed non-equity pilot support.

The venture seeks a proposed PHP 150,000 institutional grant or incubator sponsorship for an eight-week, limited-scale validation pilot. This is a funding proposal, not a claim that funding has been received. The request assumes access to a suitable partner kitchen rather than construction of a new commercial kitchen.

Use of funds | Amount | Purpose
Ingredients / production working capital | PHP 45,000 | Fund initial purchasing and timing gaps before customer receipts.
Food-safety and recipe review | PHP 20,000 | Seek qualified advice on handling, portions, labels, and operating procedures.
Kitchen access and small equipment | PHP 20,000 | Pilot access, basic tools, and food storage arrangements.
Packaging and handling materials | PHP 15,000 | Trial packaging, labels, and handling supplies.
Delivery trial and coordination | PHP 15,000 | Test clustered routes and identify actual delivery cost.
Customer recruitment and feedback | PHP 10,000 | Small outreach activities and structured feedback collection.
Software testing and maintenance | PHP 10,000 | Resolve pilot defects and maintain local demonstration equipment.
Contingency | PHP 15,000 | Unplanned costs, subject to approval and a spending record.
TOTAL | PHP 150,000 | Proposed eight-week pilot allocation.

Milestones linked to spending

Weeks 1–2: recruit and interview prospects, obtain quotations, review food handling, and test the full order workflow. Weeks 3–6: run controlled ordering cycles with a proposed 20-customer cohort and measure delivery, cost, satisfaction, and exceptions. Weeks 7–8: reconcile spending and receipts, review repeat purchases, and decide whether to revise, stop, or expand.

What the funder receives

Under the proposed non-equity arrangement, the funder receives milestone reports, a demonstration, an anonymized pilot-results summary, and an expenditure reconciliation. No equity, guaranteed return, or ownership right is promised. Any future equity investment would require separately agreed terms and a defensible valuation.

The allocation is seed working capital and pilot support, not a complete eight-week profit-and-loss budget. Customer receipts would finance replenishment; ingredient and packaging costs must not be counted twice. The food-service pilot is proposed off-system activity. The software remains locally hosted through XAMPP.

## VIII. Progress / Traction
Working software is established; market traction is still to be earned.

Evidence available now

The current evidence is a functioning local software prototype, its source code, seed catalog, and documented development checks. The user has reported that the corrected phpMyAdmin database import now works. That is evidence of installation progress, not proof of customer demand or commercial delivery performance.

Evidence | Recorded status | What it demonstrates
Seed catalog | 24 meals; 4 package definitions; 5 delivery areas | Enough demonstration data for customer/admin workflows; no service partnerships implied.
TypeScript unit tests | 51 tests passed in development | Reference planner and nutrition behavior under the tested cases.
PHP planner verification | 97 assertions passed in development | Server-side recommendation and constraint behavior under the tested cases.
Browser / API integration | 7 tests passed in development | Tested customer, admin, checkout, authentication, and layout workflows.
Build and local deployment | Production build and Apache subfolder checks recorded | Local application packaging and request routing.

These are previously recorded development results from the project documentation, not an independent audit or a guarantee of defect-free operation. Meals, zones, and package labels are sample configuration; they do not establish actual production capacity or delivery coverage.

Market evidence not yet established

There are no verified paying-customer counts, real revenue records, retention figures, signed kitchen partners, or completed user-study findings available for this paper. The proposal does not invent testimonials or claim that automated tests equal product-market fit.

Proposed pilot scorecard

Interview at least 20 eligible prospects; recruit up to 20 voluntary pilot customers; target at least 90% successful unassisted planning-and-order tasks, at least 90% on-time deliveries, average satisfaction of at least 4/5, at least 50% second-cycle purchase among customers eligible to return, and positive measured meal contribution. Record denominator, cohort, and time window for each result. These thresholds are proposed decision criteria, not achieved outcomes.

Continue only after reviewing safety, actual costs, repeat purchase, and support burden. Obtain consent for feedback and report results in aggregate without disclosing personal nutrition or order details.

## IX. Lean Canvas Model
### Problem
Repeated meal decisions; unclear weekly spending; difficulty coordinating preferences and delivery. Existing alternatives: one-off food orders, fixed menus, and home cooking.

### Customer Segments
Adults roughly 18–35 in a campus or office cluster in Bansud, Oriental Mindoro. Early adopters already buy prepared weekday meals. Local segment demand needs validation.

### Unique Value Proposition
“Your week of Filipino meals, planned around your preferences and budget.” Familiar dishes with flexible control and visible weekly totals.

### Solution
Preference-aware weekly plans; locks and swaps; clear meal/delivery totals; customer order records; coordinated admin and kitchen workspace.

### Channels
Proposed campus/office demonstrations, opt-in community groups, social pages, referral invitations, and later group-order partnerships. No signed channel partners yet.

### Revenue Streams
Proposed prepared-meal sales across 5-, 10-, 15-meal and custom schedules. Delivery charged separately as a pass-through assumption; no live recurring billing.

### Cost Structure
Ingredients, kitchen labor, packaging, utilities, spoilage, delivery, customer acquisition, maintenance, and fixed operations. Model: PHP 125 variable cost per PHP 185 meal.

### Key Metrics
Planning-to-order completion; eligible-customer repeat purchase; contribution per meal; on-time delivery; cancellations/refunds; food waste; acquisition cost.

### Unfair Advantage
None defensible yet. Potential: trusted local distribution relationships and consent-based repeat-order insights. These must be earned; Filipino recipes and personalization alone are replicable.

## Source Notes & Assumptions
This paper is based on the implemented Sakto Meals project and the development record available on 16 October 2026. It is a venture proposal rather than a completed empirical research study. The market model, costs, funding request, and pilot targets were constructed for planning and must be replaced or confirmed through primary research.

Project overview and development evidence

Haisenokokyo123. Sakto Meals repository, README.md. Local deployment, features, limitations, and previously recorded verification. https://github.com/Haisenokokyo123/meal-planner

Planner methodology

Project documentation: docs/RECOMMENDATIONS.md; implementation: server/Planner.php. Sources for the rule-based recommendation scope, constraints, and nutrition limitations.

Pricing and catalog configuration

Project source: server/seed-data.json and server/Plans.php. Sources for sample meal price range, package definitions, delivery areas, and item-based checkout pricing.

Import and installation evidence

Project source: database.sql, scripts/export-sql.php, and server/schema.sql; user-reported successful database import in this project conversation. This does not establish a completed operational pilot.

Verification artifacts

Project source: tests/, server/tests/planner.php, e2e/, and README.md. Reported counts describe development checks recorded before this paper was prepared.

Financial assumptions and checks

All amounts are Philippine pesos (PHP). The model assumes 10 meals per week, 48 active weeks per customer-year, PHP 185 per meal, PHP 125 variable cost per meal, and PHP 50 delivery per delivery day. A four-week operating illustration is distinct from a calendar month. Funding allocations total PHP 150,000; market sizing and pilot outcomes are not measured results.

Before submission

Institution, team members, and Bansud launch area were supplied by the project team. Replace the remaining department, course, instructor, and submission-date placeholders. Confirm commercial assumptions using actual interviews and quotations. Insert the approved logo and any required school citations. Add genuine results only when evidence exists; retain the distinction between implemented software and proposed food-service operations.
