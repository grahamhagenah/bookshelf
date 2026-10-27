import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// A fresh test database for every run, built by the migrations, the same
// way the live database is
export function setup() {
  removeTestDatabase();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./vitest.db" },
    stdio: "ignore",
  });
}

export function teardown() {
  removeTestDatabase();
}

function removeTestDatabase() {
  for (const file of ["vitest.db", "vitest.db-journal", "vitest.db-wal", "vitest.db-shm"]) {
    rmSync(path.join("prisma", file), { force: true });
  }
}
