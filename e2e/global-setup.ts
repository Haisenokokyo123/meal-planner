import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
export default async function setup() {
  mkdirSync(".local",{recursive:true});
  const password=`Test-${randomBytes(20).toString("hex")}!`;
  writeFileSync(".local/e2e-credentials.json",JSON.stringify({email:"admin@sakto.test",password}),{mode:0o600});
  const env={...process.env,DB_NAME:"sakto_meals_e2e",DEMO_ADMIN_EMAIL:"admin@sakto.test",DEMO_ADMIN_PASSWORD:password};
  const php=process.env.PHP_BINARY||"php";
  execFileSync(php,["scripts/reset-test-db.php"],{env,stdio:"pipe"});
  execFileSync(php,["scripts/setup.php"],{env,stdio:"pipe"});
}
