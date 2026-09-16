# GolfClub

A subscription-driven web app for golf performance tracking, charity-hosted tournaments, and a monthly draw reward engine. Built with Next.js and Supabase. The public surface is cinematic and editorial on purpose — not a traditional clubhouse site.

## Roles

1. **Public visitor** — browse charities, upcoming boards, and the monthly draw. No account.
2. **Subscribed user** — register, choose a charity, enter that house’s 5 / 4 / 3-number matches, lock a target score, upload a scorecard image after the event. Admin review gates money.
3. **Administrator** — publish tournaments, add/remove subscribers, verify cards, allow rewards, run the monthly draw.

## Setup

### 1. App

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with the project URL and anon key from Supabase → Settings → API.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Supabase

1. Create a project.
2. Authentication → Providers → Email: for local use, turn **off** “Confirm email” so sign-up lands in a session immediately.
3. SQL Editor: run `supabase/schema.sql` (tables, RLS, storage bucket `scorecards`, seed charities, sample boards, current-month draw).
4. Sign up once in the app, then promote yourself:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

## Product flow

- Subscriber picks one **charity** (tournament organising company).
- Locker shows that charity’s **5-number, 4-number, and 3-number** matches.
- Player sets a **target score**, plays, then uploads a **score image**.
- Admin verifies the card and **allows a monetary reward**.
- Verified cards in the month are tickets in the **monthly draw**.

## Stack

- Next.js App Router + Tailwind CSS v4
- Supabase Auth, Postgres, Storage, RLS
