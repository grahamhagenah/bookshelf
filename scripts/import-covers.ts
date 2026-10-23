// One-off: covers saved as links to other sites (pasted before the app
// kept its own copy) are fetched into the cover cache, and the books
// pointed at that copy. Links the app won't fetch from are left as they are.
//
//   npx tsx --tsconfig tsconfig.json scripts/import-covers.ts [--dry-run]

import { importCover, isOpenLibraryCover } from "~/covers.server";
import { prisma } from "~/db.server";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const books = await prisma.book.findMany({
    where: { cover: { startsWith: "http" } },
    select: { id: true, title: true, cover: true },
  });
  const external = books.filter((book) => !isOpenLibraryCover(book.cover));
  console.log(
    `${external.length} of ${books.length} covers are links to other sites`,
  );

  let kept = 0;
  let skipped = 0;
  for (const book of external) {
    const local = await importCover(book.cover);
    if (!local) {
      skipped++;
      console.log(
        `  left as is: ${book.title} (${new URL(book.cover).hostname})`,
      );
      continue;
    }
    kept++;
    if (!dryRun)
      await prisma.book.update({
        where: { id: book.id },
        data: { cover: local },
      });
    console.log(`  ${dryRun ? "would keep" : "kept"}: ${book.title}`);
  }
  console.log(
    `${kept} fetched, ${skipped} left as links${dryRun ? " (dry run, nothing saved)" : ""}`,
  );
}

main().finally(() => prisma.$disconnect());
