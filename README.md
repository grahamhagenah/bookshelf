# Bookshelf

A social book-sharing app where you can build your personal library and share books with friends.

![Bookshelf preview](bookshelf-preview.webp)

## Features

- **Personal Library** — Search for books via Open Library and add them to your collection
- **Friend Connections** — Add friends by email and send/accept friend requests
- **Book Sharing** — Browse your friends' libraries and discover new reads
- **Notifications** — Get notified when someone wants to connect

## Tech Stack

- **[Remix](https://remix.run)** — Full-stack React framework
- **[Prisma](https://prisma.io)** + **SQLite** — Database and ORM
- **[Tailwind CSS](https://tailwindcss.com)** + **[Material UI](https://mui.com)** — Styling
- **[Fly.io](https://fly.io)** — Deployment

## Getting Started

```sh
# Install dependencies
npm install

# Set up the database
npm run setup

# Start the dev server
npm run dev
```

The app runs at [localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run unit tests |
| `npm run test:e2e:dev` | Run Cypress tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

## Database

Manage the database with Prisma:

```sh
npx prisma studio    # Visual database browser
npx prisma migrate   # Run migrations
```

## Deployment

The app deploys to Fly.io via GitHub Actions. Pushes to `main` deploy to production.

```sh
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app bookshelf-c524
fly volumes create data --size 1 --app bookshelf-c524
```
