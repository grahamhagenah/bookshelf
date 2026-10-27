import { execSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

// A fresh test database for every run, built by the migrations, the same
// way the live database is. Each test worker works on its own copy of it
// (see setup-test-env.ts), so test files can run side by side.
export function setup() {
  removeTestDatabases();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./vitest.db" },
    stdio: "ignore",
  });
}

export function teardown() {
  removeTestDatabases();
}

// The template and every worker's copy, with SQLite's side files
function removeTestDatabases() {
  for (const file of readdirSync("prisma")) {
    if (file.startsWith("vitest")) rmSync(path.join("prisma", file), { force: true });
  }
}
