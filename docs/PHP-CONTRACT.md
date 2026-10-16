# PHP architecture

The application runs under Apache with PHP 8.2+ and PDO MySQL. The compiled React frontend in `dist/` needs no Node runtime. Root `index.php` dispatches API requests and serves the frontend beneath the configured installation folder. Apache rewrite rules keep requests behind that router and deny private source/configuration paths.

- `bootstrap.php`: configuration, PDO access, transaction helpers, sessions, origin checks, rate limiting, dates, and structured API errors.
- `Validators.php`: authoritative profile, catalog, package, delivery, and account input validation.
- `Planner.php`: nutrition estimates, dietary/allergen eligibility, whole-week search, budgets, portions, locks, totals, and alternatives.
- `Models.php`: JSON serialization, owned-record lookup, order snapshots, and audit recording.
- `Auth.php`: password hashing, session cookies, registration, authentication, private local reset outbox, password changes, and session revocation.
- `Core.php`: public configuration/contact, customer profiles, favorites, progress, dashboard, and account deletion.
- `Plans.php`: persisted plan edits, optimistic revisions, locked regeneration, checkout, and subscription changes.
- `Admin.php`: role-protected catalog, orders, kitchen totals, operational reporting, packages, and settings.
- `api.php`: route dispatch, authentication/authorization, and consistent error responses.

Mutation transactions use a shared settings-row lock to serialize capacity, checkout, catalog, and plan changes. Checkout rechecks live eligibility, cutoffs, price, and committed capacity, calculates money on the server, and records immutable order-item snapshots. Idempotency keys are scoped to the customer. There is no real payment processing or automated recurring billing.

Database tables use InnoDB with foreign keys and integer-centavo money. JSON lists are serialized in LONGTEXT for MariaDB compatibility. `server/schema.sql` is the initial schema; `scripts/setup.php` applies it and seeds missing records without overwriting user edits. Credentials are supplied through ignored local configuration or environment variables. The setup script generates an administrator password privately when requested; no shared default password is shipped.

See [API contract](API-CONTRACT.md) and [planner methodology](RECOMMENDATIONS.md) for request shapes and algorithm details.
