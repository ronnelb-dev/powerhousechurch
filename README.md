# Powerhouse Church

Powerhouse Church is a full-stack React Router app for the church’s public website and members portal. It covers public-facing pages, event RSVPs, prayer and contact submissions, visit planning, and authenticated member/admin workflows backed by Prisma.

## Stack

- React 19 + React Router 7
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL/Neon
- Lucia auth
- Vitest
- Resend for transactional email
- Vercel deployment target

## Key Areas

- Public site: home, about, ministries, events, sermons, gallery, giving, contact, prayer request, and plan-your-visit flows
- Members portal: dashboard, profile, directory, engagement, community, attendance
- Admin tools: events, sermons, communications, members, prayers, reports, settings, visit plans
- Operational workflows: email verification, password reset, RSVP confirmations, prayer follow-up, and visit-plan follow-up

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

3. Optional but recommended for full local behavior:

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CHURCH_EMAIL=
APP_URL=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
```

4. Generate Prisma client and apply schema changes:

```bash
npm run db:generate
npm run db:migrate
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
npm run db:migrate
npm run db:deploy
npm run db:seed
```

## Testing

The repo uses Vitest.

Current server-side coverage added around:

- auth login/register decision logic
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
- Email-dependent flows degrade gracefully when `RESEND_API_KEY` is missing.
- Public form submissions rely on request IP headers such as `x-forwarded-for` in production.

## Known Baseline Issues

- `npm run test` passes.
- `npm run typecheck` is currently not clean in the existing repo baseline because of pre-existing generated route type/module-resolution issues and unrelated unused-variable/type errors outside the changes in this task.
