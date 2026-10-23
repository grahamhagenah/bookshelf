# Working on Stacks

## Shipping changes
- When a change is ready, open a PR into `main` and merge it once TypeScript and Vitest pass. Don't ask first. Merging to `main` deploys to production (bookstacks.app) through `.github/workflows/deploy.yml`. The deploy job waits only for Vitest (and its migrations-match-schema check), not ESLint or TypeScript, so check those on the PR before merging. Stop doing this if the owner says otherwise.
- ESLint passes across the codebase; keep it that way.
- Old addresses (bookstacks.site, www) redirect to bookstacks.app; `SITE_URL` in `app/seo.ts` is the source of truth.

## Database
- Schema changes come with a migration: `npx prisma migrate dev --name what-changed`. CI checks that `prisma/migrations` matches `prisma/schema.prisma`, and production runs `prisma migrate deploy` on start (see `start.sh`).
- A migration that changes data must not be able to fail on production data (a failed migration stops the server starting), e.g. skip rows that would break a unique constraint.
- Emails are stored trimmed and lowercased. Go through the functions in `app/models/user.server.ts`, which call `normalizeEmail`, rather than querying by email directly.

## Local setup
- `cp .env.example .env`, `npm install`, then `npm run setup` (generates the Prisma client, runs migrations and seeds).
- The seeded account is `graham@gmail.com` / `grahamiscool`. `/demo` creates a populated sandbox account. It skips requests whose user agent looks like a bot, including headless browsers, so give test browsers a normal user agent.
- Without `RESEND_API_KEY`, emails aren't sent; confirmation and password-reset links are logged to the server console instead.

## Style
- Tailwind `stone` grays, plus one accent: forest green (`forest-600`), for the main action on a page. Nothing else gets color.
- Profile pictures are line icons from `app/components/avatar.tsx` or initials, never emoji.
- Content sits in one centered `max-w-5xl` column. Breadcrumbs live in the header.
- The sticky header stays opaque: Safari 26 takes the status bar color from it, and shows white for a see-through one.
