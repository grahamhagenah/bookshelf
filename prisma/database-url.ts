import path from "node:path";

// The SQLite file DATABASE_URL names, as an absolute path. Prisma always
// read a relative one ("file:./data.db") from the prisma folder, and the
// app and the Prisma CLI both keep to that, so they open the same file.
// Options after "?" were for Prisma's old engine and are left off.
export function databaseFile(url: string) {
  const file = url.replace(/^file:/, "").split("?")[0];
  return path.isAbsolute(file) ? file : path.resolve("prisma", file);
}
