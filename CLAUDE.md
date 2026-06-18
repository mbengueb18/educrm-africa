# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TalibCRM** (package name `educrm-africa`) is a multi-tenant SaaS CRM built for private higher-education schools in French-speaking sub-Saharan Africa. The product domain, UI copy, comments, and most string literals are in **French** — match this when writing user-facing text, error messages, and comments.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml` / `pnpm-workspace.yaml`).

```bash
pnpm dev              # Next.js dev server with Turbopack
pnpm build            # Production build (runs prisma generate via postinstall)
pnpm start            # Serve production build
pnpm lint             # ESLint (eslint-config-next)

pnpm db:generate      # prisma generate (regenerate client after schema changes)
pnpm db:push          # Push schema to DB without a migration (used in dev)
pnpm db:migrate       # prisma migrate dev (note: prisma/migrations/ is gitignored)
pnpm db:seed          # Seed dev data via prisma/seed.ts (tsx)
pnpm db:studio        # Prisma Studio
```

There is **no test framework** configured in this repo — do not assume `pnpm test` exists. After changing the Prisma schema, run `pnpm db:generate` so `@prisma/client` types stay in sync.

## Stack

- **Next.js 15** App Router (`src/app`), **React 19**, **TypeScript** (strict). Import alias `@/*` → `src/*`.
- **Prisma 6** + **PostgreSQL**. Single schema at `prisma/schema.prisma`.
- **NextAuth v5** (beta) with JWT sessions, Credentials provider only (email + bcrypt).
- **Tailwind CSS 3**. Deployed on **Vercel** (`vercel.json` defines cron jobs).

## Architecture

### Multi-tenancy (critical)
The app is multi-tenant with a **shared database / shared schema** model. Tenant isolation is **not enforced by the database** — it is the caller's responsibility. Nearly every model carries an `organizationId`, and **every query must be scoped to the current user's `organizationId`**. The org comes from the session: `(await auth()).user.organizationId`. Forgetting this scope leaks data across tenants. Some users are further scoped to a `campusId`.

### Auth & session
`src/lib/auth.ts` configures NextAuth. The JWT/session is extended (see the `declare module "next-auth"`) to carry `id`, `role` (`UserRole`), `organizationId`, `organizationSlug`, and `campusId`. Always read these from `auth()` rather than re-querying.

`src/middleware.ts` runs on every non-static request and does two things: (1) routes between the marketing site `talibcrm.com` and the app subdomain `app.talibcrm.com`, and (2) gates authenticated routes by checking the session cookie, redirecting to `/login` when absent. It is a lightweight cookie check, **not** full authorization — real authz happens in server actions/pages.

### Server Actions are the primary data layer
Most mutations and many reads live in colocated `actions.ts` files (`"use server"`) next to the route that uses them. The standard shape:

```ts
"use server";
export async function doThing(...) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  // ...query/mutate ALWAYS filtered by session.user.organizationId...
  revalidatePath("/relevant-path");
}
```

Page components (`page.tsx`) are async Server Components that call `auth()`, query Prisma directly, and pass data into a client component (`*-client.tsx`). The split is consistent: `page.tsx` (server, data fetching) → `*-client.tsx` (interactivity).

### Route groups (`src/app`)
- `(auth)` — `/login`, `/signup` (public).
- `(dashboard)` — the authenticated CRM. `(dashboard)/layout.tsx` enforces auth, loads task notifications, and wraps children in `PermissionProvider`. Feature areas include `pipeline`, `leads`, `tasks`, `calls`, `appointments`, `calendar`, `inbox`, `students`, `payments`, `campaigns`, `whatsapp-campaigns`, `audiences`, `workflows`, `analytics`, and `settings/*`.
- Public-facing flows (outside both groups): `candidat/[token]` (candidate portal), `inscription/[slug]`, `orientation/[slug]`.
- `api/` — REST handlers for things that can't be server actions: webhooks (`webhooks/brevo`, `whatsapp/[orgId]`, `resend-inbound`), web-tracking pixel/script (`t/*`), embeddable widget/chatbot (`widget/*`, `chatbot/*`), public lead ingestion (`leads/ingest`), file uploads, OAuth callbacks (`integrations/google`), and Vercel **cron** endpoints (`cron/sequences`, `cron/workflows`).

### Permissions (RBAC) — `src/lib/permissions.ts`
Two parallel access systems exist; do not confuse them.

1. **Role-based permissions** gate *what a user can do*. `ROLE_PERMISSIONS` maps each `Role` (`SUPER_ADMIN`, `ADMIN`, `COMMERCIAL`, `TEACHER`, `ACCOUNTANT`, `VIEWER`) to per-`Permission` config with a `scope` of `all` / `own` / `none`. A `own` scope means the user only sees records they own (e.g. a `COMMERCIAL` sees only their assigned leads) — you must apply this scope in your query's `where` clause.
   - Server side: `requirePermission(role, permission)` (throws), `hasPermission`, `getScope`.
   - Client side: `usePermissions()` hook (`src/hooks/use-permissions.ts`) backed by `PermissionContext`/`PermissionProvider` — use `can(...)`, `scope(...)`, `isAdmin`, etc. to show/hide UI.

2. **Plan/billing limits** gate *what the organization's subscription allows* — see below.

### Plans & billing — `src/lib/plans/`
`config.ts` (`PLAN_LIMITS`) is the **single source of truth** for every plan's limits, prices, and feature flags, keyed by the `Plan` enum (`ESSENTIEL`, etc.). To gate a feature or quota in a server action, call the `assertCanXxx(orgId, ...)` helpers from `checks.ts` (e.g. `assertCanAddUser`, `assertCanCreatePipeline`, `assertCanSendEmail`, `assertCanUseAI`, `assertCanAccessFeature`). They throw typed errors from `errors.ts` (`PlanLimitError`, `QuotaExceededError`, `FeatureNotAvailableError`) which the UI catches to show upgrade prompts. `usage.ts` does the live counting; `client-helpers.ts` exposes plan info to the client. Prices are in FCFA (XOF).

### Background jobs
Vercel cron (`vercel.json`) hits `GET /api/cron/sequences` (daily 09:00) and `GET /api/cron/workflows` (daily 10:00). Both verify a `Bearer ${CRON_SECRET}` auth header, iterate over orgs, and run scheduled email sequences / automation workflows. They use `runtime = "nodejs"` and a raised `maxDuration`.

### Integrations (`src/lib/`)
- **AI**: `gemini.ts` (Google Gemini) and DeepSeek — used by the lead AI assistant, classification, message generation. AI usage is metered against plan quotas (`canUseAI`).
- **Email**: `email.ts` with Resend and/or Brevo; inbound replies handled via webhooks. Rich email composition uses `email-blocks.ts`.
- **WhatsApp**: `src/lib/whatsapp/` (`integration.ts`, `send.ts`, `templates.ts`) for WhatsApp Business API, plus per-org webhook `api/webhooks/whatsapp/[orgId]`.
- **Google Calendar**: `google-calendar.ts` + OAuth flow under `api/integrations/google/*`.
- **Storage**: `supabase-storage.ts` (Supabase) for document/file uploads.
- **Custom fields**: `custom-fields.ts` / `custom-fields-constants.ts` / `field-properties.ts` let orgs define extra lead/student fields stored as JSON.

## Conventions

- **`var` is used pervasively** in server actions, components, and `permissions.ts`/`use-permissions.ts` (not just `const`/`let`). Match the surrounding file's style rather than "modernizing" it.
- Validation uses **zod** (`form-schemas.ts` and inline schemas).
- Error messages thrown to users are in French (e.g. `"Non authentifié"`, `"Accès refusé..."`).
- `revalidatePath` after mutations to refresh Server Component data.
- Server Action body size limit is raised to 2mb (`next.config.ts`).

## Environment variables

Read from `process.env` across the codebase (no `.env` is committed; all `.env*` are gitignored):
`DATABASE_URL`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `RESEND_API_KEY`, `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `INBOUND_REPLY_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## Notes

- `prisma/migrations/` and various backup/destructive `scripts/` patterns are gitignored — schema changes in dev typically go through `db:push`, not committed migrations.
- `prisma/seed.ts` creates a realistic demo org ("Institut Supérieur de Management de Dakar") with campuses, programs, users, and leads — useful reference for model relationships and required fields.
