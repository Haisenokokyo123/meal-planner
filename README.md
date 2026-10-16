# Sakto Meals

A Filipino meal subscription and planning application for **local XAMPP: Apache, PHP 8.2+, and MySQL/MariaDB**, with database management through phpMyAdmin. The React frontend is already compiled in `dist/`; Node.js is only needed when editing and rebuilding the frontend.

## Run on Windows with XAMPP

1. Install XAMPP with PHP 8.2 or newer. Start **Apache** and **MySQL** in its control panel.
2. Download or clone this repository into `C:\xampp\htdocs\meal-planner`. Ensure `index.php` is directly inside that folder, not in a nested `meal-planner-main` directory.
3. Copy `config.example.php` to `config.local.php`. The defaults use database `sakto_meals`, host `127.0.0.1`, port `3306`, username `root`, and an empty password, as in a fresh local XAMPP installation. Adjust them if your MySQL settings differ. Set `APP_URL` to your exact application address, including any custom Apache port or folder name.
4. Double-click **`setup.cmd`**. It creates the database and tables and seeds 24 meals, four packages, and five delivery areas. Existing records and administrator passwords are preserved when rerun.
5. Open `http://localhost/meal-planner` in your browser. Register a customer account, or sign in as the administrator using the generated credentials in `.local\admin-credentials.txt`. Change that password in account settings after signing in.
6. Open `http://localhost/phpmyadmin` to inspect the **sakto_meals** database.

For a custom XAMPP installation path, run this command from the project folder using your PHP executable:

```bat
C:\xampp\php\php.exe scripts\setup.php --admin
```

### Set up entirely through phpMyAdmin

You can use this instead of `setup.cmd`:

1. Start Apache and MySQL in XAMPP, then open `http://localhost/phpmyadmin`.
2. Click the **SQL** tab at the top, as shown on the server overview.
3. Open the repository's root **`database.sql`** file in a text editor. Copy its entire contents into the SQL box, then click **Go**. Alternatively, select **Import**, choose `database.sql`, and click **Go**.
4. The file creates/selects `sakto_meals`, creates all tables, and adds 24 sample meals, packages, delivery areas, and settings. Refresh the left sidebar to see the database. You do not need to import `schema.sql` separately or run the setup script for customer use.
5. Open `http://localhost/meal-planner` and register your account. With the default local XAMPP database credentials, the sample configuration already works. If your connection differs, copy `config.example.php` to `config.local.php` and edit that PHP file in your project folder. PHP configuration code does **not** go in phpMyAdmin's SQL box.

To make your registered account an administrator without running setup: in phpMyAdmin select `sakto_meals` → `users` → **Browse**, find your own email, click **Edit**, change only `role` from `CUSTOMER` to `ADMIN`, and save with **Go**. Sign out and back in to the application. This uses your own registered password; no shared administrator password is included in the SQL file.

`server/schema.sql` is the tables-only source. `database.sql` is the complete import, generated from that schema and the seed catalog with `php scripts/export-sql.php`. Reimporting preserves existing records; it does not reset your data.

No Docker, cloud database, payment account, SMTP account, Composer install, or Node server is required to run the delivered application. Food images and fonts are local assets.

## Features and walkthrough

- Public home, searchable/filterable meal catalog, meal details, packages, about, how it works, contact, and legal pages.
- Registration, sign-in, logout, password changes, password reset, and separate customer/admin access.
- Onboarding captures delivery schedule, preferences, dietary restrictions, allergies, budget, and optional nutrition inputs.
- Generate a week, lock meals, regenerate unlocked selections, compare swaps, undo swaps, change portions, add/remove meals, and save favorites. The server revalidates edits and reports conflicts.
- Review the plan, choose a delivery area, and confirm a **simulated payment**. Orders retain price and meal snapshots, and retrying the same checkout does not duplicate the order.
- Customer dashboard includes orders, subscriptions, nutrition profile, optional weight history, and account deletion.
- Admin workspace includes sales summaries, meal editing and availability, order status changes, kitchen preparation totals, customers, packages, delivery areas, and cutoffs.

For a demonstration: register → complete onboarding → generate a plan → lock a meal and regenerate → swap another meal → review and check out → sign in as admin → update the order to preparing → return to the customer order screen.

Subscriptions describe delivery cycles; future cycles must be planned and confirmed manually. There are no automatic recurring charges. Password-reset messages are written to the private `.local/outbox` directory; read the generated message on your computer and open its reset link. No email is sent externally. Contact messages are stored in the database.

Nutrition values are demonstration estimates, not medical advice. The application withholds automatic calorie targets for minors and profiles requiring professional guidance. Allergy filtering depends on accurate catalog declarations and cannot guarantee kitchen cross-contact safety. See [recommendation methodology](docs/RECOMMENDATIONS.md).

## Local configuration and troubleshooting

`config.local.php`, `.local/`, database files, and credentials are excluded from Git. Keep Apache's document root at `htdocs` and use the project folder as shown above. Root `.htaccess` and `index.php` route requests and prevent web access to private files.

- **Database connection refused:** start XAMPP MySQL and check `DB_HOST` and `DB_PORT`.
- **Access denied:** match the MySQL username/password in `config.local.php` to phpMyAdmin's database server credentials.
- **Could not find driver:** enable `extension=pdo_mysql` in XAMPP's `php.ini` and restart Apache. PHP also needs `mbstring`.
- **404 on pages or API routes:** enable Apache `mod_rewrite` and allow `.htaccess` with `AllowOverride All` for `htdocs`. These are normally enabled in XAMPP. Keep hidden `.htaccess` files when copying the repository.
- **Request origin rejected:** ensure `APP_URL` exactly matches the scheme, host, port, and installation folder you use. `localhost` and `127.0.0.1` are different hosts.
- **Blank page after editing source:** rebuild the frontend; Apache serves `dist/`, not TypeScript source. Confirm `dist/index.html` exists.
- **No plan fits:** relax the budget, schedule, or preference constraints, or ask the admin to add eligible available meals. The system does not bypass allergies to fill a plan.

## Development

Runtime: PHP 8.2+, PDO MySQL, mbstring, Apache 2.4, MariaDB 10.4+ or MySQL 8.0+. Build tools: Node.js 22.12+ and npm.

```sh
npm ci
npm run build
npm run lint
npm test
php server/tests/planner.php
```

Commit `dist/` after frontend changes so XAMPP users can run without build tools. `npm run build` includes TypeScript checking. Backend changes take effect through Apache immediately.

For development without Apache, start MySQL, configure `APP_URL` as `http://127.0.0.1:3100`, and run `php -S 127.0.0.1:3100 index.php`. This serves the compiled app through PHP. The optional Vite server proxies `/api` to that PHP server; use a matching `APP_URL` for whichever origin you access.

Browser/API integration tests:

```sh
npx playwright install chromium
npm run test:e2e
```

These tests require a running local MySQL server and PHP on PATH (or set `PHP_BINARY` to your PHP executable). They **drop and recreate only `sakto_meals_e2e`**, using your configured database connection. Do not use that database name for personal data. The test server uses port 3100; stop any development server on that port first. Test credentials and reports remain ignored locally.

Validated in the development environment: production build, ESLint, 51 TypeScript tests, 97 PHP planner assertions, and seven Chromium/API integration tests. Apache/PHP/MariaDB subfolder serving was also checked. The actual Windows XAMPP installation remains a local setup step.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.php`, `.htaccess` | Apache entry point, routing, and private-file protection |
| `server/` | PHP API, validation, planner, authentication, persistence, initial SQL schema, seed catalog |
| `scripts/setup.php` | Repeatable database initialization and administrator creation |
| `src/` | React customer/public/admin screens, styles, and TypeScript reference planner |
| `public/` | Original local food assets copied into builds |
| `dist/` | Committed production frontend served by PHP/Apache |
| `tests/`, `server/tests/`, `e2e/` | Unit and integrated workflow checks |
| `docs/` | Architecture, API, recommendation methodology, and asset notes |

`server/schema.sql` is the initial schema. Setup creates missing tables but does not perform arbitrary upgrades to existing table definitions; future schema changes need explicit migrations. Prices are integer centavos, operational delivery dates use Asia/Manila, and stored timestamps use UTC.
