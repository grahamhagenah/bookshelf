# Working on Stacks

## Shipping changes
- When a change is ready, open a PR into `main` and merge it once TypeScript and Vitest pass. Don't ask first. Merging to `main` deploys to production (bookstacks.site) through `.github/workflows/deploy.yml`. Stop doing this if the owner says otherwise.
- ESLint currently fails on existing `import/order` errors across the codebase. Only new lint errors in changed files should block a merge.

## Local setup
- `cp .env.example .env`, then `npm install`, `npx prisma db push` and `npx prisma db seed`. `npm run setup` fails because `prisma/migrations` is behind the schema. Production also uses `prisma db push` (see `start.sh`).
- The seeded account is `graham@gmail.com` / `grahamiscool`. `/demo` creates a populated sandbox account.

## Style
- Neutral palette only: Tailwind `stone` grays, with near-black primary buttons (white in dark mode). No accent color.
- Profile pictures are line icons from `app/components/avatar.tsx` or initials, never emoji.
- Content sits in one centered `max-w-4xl` column. Breadcrumbs live in the header.
