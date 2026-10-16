import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 90_000,
  expect: { timeout: 15_000 }, reporter: [["list"], ["html", {open:"never"}]],
  use: {baseURL:"http://127.0.0.1:3100",trace:"retain-on-failure",screenshot:"only-on-failure",launchOptions: {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),args:["--no-sandbox"]}},
  globalSetup: "./e2e/global-setup.ts",
  projects: [{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer: {command:`"${process.env.PHP_BINARY||"php"}" -S 127.0.0.1:3100 index.php`,url:"http://127.0.0.1:3100/api/auth/me",reuseExistingServer:false,timeout:120_000,env:{DB_NAME:"sakto_meals_e2e",APP_URL:"http://127.0.0.1:3100",MAIL_OUTBOX_DIR:".local/e2e-outbox"}}
});
