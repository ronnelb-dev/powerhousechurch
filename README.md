# Powerhouse Church

Powerhouse Church is a full-stack React Router app for the church’s public website. It covers public pages, guest event RSVPs, prayer and contact submissions, visit planning, and public content backed by Prisma.

## Stack

- React 19 + React Router 7
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL/Neon
- Vitest
- Vercel deployment target

## Key Areas

- Public site: home, about, ministries, events, sermons, gallery, giving, contact, prayer request, and plan-your-visit flows
- Public submissions: guest event RSVPs, prayer requests, contact messages, and visit plans
- Content data: sermons, events, ministries, blog posts, cell groups, and site settings

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a working `.env` with at least:

```bash
DATABASE_URL=
DATABASE_URL_UNPOOLED=
```

3. Optional environment variables:

```bash
APP_URL=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
CHURCH_EMAIL=
```

4. Generate Prisma Client and apply the existing migration history:

```bash
npm run db:generate
npm run db:deploy
```

5. Start the app:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run test
npm run test:watch
npm run test:coverage
npm run lint
npm run typecheck
npm run db:generate
npm run db:deploy
npm run db:seed
```

## Testing

The repo uses Vitest.

Current server-side coverage added around:

- event RSVP handling
- public visitor submissions
- in-memory public submission rate limiting

Run the suite with:

```bash
npm run test
```

## Public Submission Protection

Public write endpoints now use a lightweight in-memory rate limiter keyed by client IP:

- `/contact`
- `/prayer-request`
- `/new-here`
- `/events` RSVP submissions

This is a practical first layer for spam reduction and abuse control. Because it is in-memory, limits are instance-local in serverless environments; if you need cross-instance enforcement later, move the limiter to shared storage like Redis or Upstash.

## Deployment Notes

- Production is configured for Neon/PostgreSQL through Prisma.
- The app no longer sends outbound email; visitor workflows still save records locally.
- Public form submissions rely on request IP headers such as `x-forwarded-for` in production.
- There is no administration UI. Until a separate CMS is approved, public content changes require Prisma Studio or direct database operations by an authorized operator.
- Portal tables remain physically present until the separately approved retirement procedure in [`docs/portal-data-retirement.md`](docs/portal-data-retirement.md) is executed.
- Do not run `prisma migrate dev` against this schema until that retirement plan is approved; Prisma would infer destructive drops for the intentionally unmodeled portal tables.
