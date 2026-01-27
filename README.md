# Stacks

A social book-lending app where you can catalog your personal library, connect with friends, and share books.

**Live:** [bookstacks.site](https://bookstacks.site)

## Features

- **Personal Library** — Search the Open Library catalog and add books to your collection
- **Book Lending** — Request to borrow books from friends, track what you've lent out
- **Friend Connections** — Find friends by name/email, see suggested new members
- **Email Notifications** — Get notified via email when someone requests one of your books
- **Public Sharing** — Generate a shareable link so anyone can browse your bookshelf
- **Notification History** — Track friend requests, book requests, approvals, and returns

## Tech Stack

- **[Remix](https://remix.run)** — Full-stack React framework
- **[Prisma](https://prisma.io)** + **SQLite** — Database and ORM
- **[Tailwind CSS v4](https://tailwindcss.com)** — Styling
- **[Resend](https://resend.com)** — Transactional email
- **[Open Library API](https://openlibrary.org/developers/api)** — Book data and covers
- **[Fly.io](https://fly.io)** — Deployment

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```sh
# Install dependencies
npm install

# Set up the database
npm run setup

# Start the dev server
npm run dev
```

The app runs at [localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL="file:./dev.db"
SESSION_SECRET="your-secret-key-change-in-production"

# Email notifications (optional for dev, required for prod)
RESEND_API_KEY=re_xxxxxxxxxxxx
APP_URL=https://bookstacks.site
FROM_EMAIL=Stacks <no-reply@yourdomain.com>
```

### Variable Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite database path | Yes |
| `SESSION_SECRET` | Secret for session cookies | Yes |
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) | Production |
| `APP_URL` | Your app's public URL | Production |
| `FROM_EMAIL` | Sender address for emails | Production |

## Email Notifications

Email notifications are sent via [Resend](https://resend.com) when:

- Someone requests to borrow one of your books

### Setup

1. Create an account at [resend.com](https://resend.com)
2. Verify your domain (or use their test domain for development)
3. Create an API key
4. Add the environment variables above

Without `RESEND_API_KEY`, the app works normally but emails are logged to console instead of sent.

### Email Format

Book request emails include:
- Book title in the subject line
- Who is requesting the book
- A button linking directly to the notifications page to approve/decline

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm test` | Run unit tests |
| `npm run test:e2e:dev` | Run Cypress tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

## Database

The app uses SQLite with Prisma ORM.

```sh
# Visual database browser
npx prisma studio

# Push schema changes to database
npx prisma db push

# Regenerate Prisma client after schema changes
npx prisma generate

# Reset database (destroys all data)
npx prisma migrate reset
```

### Schema Overview

- **User** — Account info, friend relationships, share token
- **Book** — Library items with Open Library metadata, borrower tracking
- **Notification** — Friend requests, book requests, approvals, returns

## Deployment (Fly.io)

### Initial Setup

```sh
# Create the app
fly launch

# Create a persistent volume for SQLite
fly volumes create data --size 1 --app bookshelf-c524

# Set secrets
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
fly secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
fly secrets set APP_URL=https://bookstacks.site
fly secrets set FROM_EMAIL="Stacks <no-reply@bookstacks.site>"
```

### Deploy

```sh
fly deploy
```

### Useful Commands

```sh
# View logs
fly logs

# SSH into the machine
fly ssh console

# Check app status
fly status

# Update secrets
fly secrets set KEY=value
```

## Project Structure

```
app/
├── components/       # Reusable UI components
├── models/           # Prisma database functions
├── routes/           # Remix routes (pages and API)
├── email.server.ts   # Email sending logic
├── db.server.ts      # Database connection
└── session.server.ts # Authentication
prisma/
├── schema.prisma     # Database schema
└── seed.ts           # Seed data
```

## Key Files

| File | Purpose |
|------|---------|
| `app/models/user.server.ts` | User, friend, and notification functions |
| `app/models/book.server.ts` | Book CRUD and lending functions |
| `app/email.server.ts` | Resend email integration |
| `app/routes/search.tsx` | Open Library search and book adding |
| `app/routes/notifications.tsx` | Handle friend/book requests |
| `app/routes/friends.tsx` | Friend list, suggestions, search |

## Open Library Integration

Books are fetched from the [Open Library API](https://openlibrary.org/developers/api):

- **Search:** `https://openlibrary.org/search.json?q={query}`
- **Work details:** `https://openlibrary.org/works/{key}.json`
- **Covers:** `https://covers.openlibrary.org/b/olid/{cover_id}-L.jpg`

Book metadata includes: title, author, cover, publication date, page count, subjects, publisher, and description.
