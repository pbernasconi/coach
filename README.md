This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Lift sync and dashboard

The Lift iPhone app (`lift/`) syncs through two routes that follow `lift/SYNC.md`:

- `POST /api/lift/sync/push` and `GET /api/lift/sync/pull`. They're public to Clerk and check their own
  bearer token instead.
- The read-only dashboard is at `/lift`, behind the normal Clerk sign-in.

The code: `src/lib/lift-sync/` holds validation, last-writer-wins, cursors, push/pull orchestration, the
in-memory repository and the Drizzle repository. `src/lib/lift-dashboard/` holds the dashboard queries
and summaries. The tables are defined in `src/db/lift-schema.ts`; migrations create them
(DATABASE.md). The tests are in `scripts/lift-sync.test.mjs` (`npm test`).

Environment variables (set them in Vercel and in `.env.local`, and never commit real values):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (already used by the rest of the app) |
| `LIFT_SYNC_TOKEN` | Long random secret the iPhone sends as `Authorization: Bearer <token>`. If it's unset, every sync request gets `401`. Generate one with `openssl rand -base64 48` |

Production builds apply new migrations by themselves; see DATABASE.md for a new database or a Neon branch.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
