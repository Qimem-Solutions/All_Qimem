# All Qimem — Web (Next.js)

Dark, gold-accent UI for **Superadmin**, **Hotel Admin**, **HRRM**, and **HRMS**, aligned with `docs/ALL-QIMEM-ARCHITECTURE.md`.

## Setup

```bash
cd web
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your Supabase project.
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the home page links into each area.

## Routes

| Area | Base path | Notes |
|------|-----------|--------|
| Auth | `/login` | UI ready; wire `signInWithPassword` / OAuth in a Server Action or client handler. |
| Superadmin | `/superadmin/*` | Dashboard, tenants, hotel admins, subscriptions, settings, reports. |
| Hotel Admin | `/hotel/*` | Dashboard, users, reports, settings. |
| HRMS | `/hrms/*` | Dashboard, employees, org structure, scheduling, attendance, HR reports. |
| HRRM | `/hrrm/*` | Dashboard, inventory, rates, reservations, availability, front desk, concierge, housekeeping. |

## Supabase

- **Single migration (run once in SQL editor or `supabase db push`):** `../supabase/migrations/20260414120000_all_qimem_unified.sql` — schema, profile constraint upgrade, signup trigger, profiles RLS, and profile row for superadmin *if* an Auth user with that email already exists.
- **Login user:** SQL cannot create `auth.users` or passwords. To create `superadmin@qimem.com` with a password, add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Dashboard → Settings → API → **service_role** secret), then from `web/` run `npm run seed:superadmin`. Alternatively create the user under **Authentication → Users** in the dashboard.
- Clients: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (Server Components / actions).

## Stack

- Next.js App Router, React 19, Tailwind CSS v4, Lucide icons.
