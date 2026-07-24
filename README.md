# Stepscale Sales KPI Tracker

Internal sales dashboard for the Stepscale BD team. Tracks daily activity in real time, visualizes pipeline performance over time, and manages tasks and meetings — all in one place. Built with Next.js 15 and Supabase; deployed on Vercel.

**URL:** Deployed at the Vercel project linked in `.vercel/project.json`
**Local dev:** `npm run dev` → `localhost:3000`

---

## Overview

The app has three tabs accessible from the sticky header:

| Tab | Purpose |
|---|---|
| **Live Tracker** | Real-time activity logging for the current rep; view daily/weekly counts vs targets |
| **Team Performance** | Historical charts, pipeline funnel, MRR trends, show-rate analytics |
| **Task Tracker** | Kanban-style task board + daily workflow checklist |

Authentication is handled by Supabase Auth. Each rep logs in and is automatically identified by matching their Supabase `user_id` to their row in the `reps` table. The current logged-in rep becomes the default rep in the Live Tracker.

---

## Architecture

```
Browser
  │
  ├── Next.js 15 (App Router)
  │     ├── app/page.tsx         ← Server component, fetches initial data
  │     ├── app/actions.ts       ← Server Actions (all DB writes + reads)
  │     └── middleware.ts        ← Supabase session refresh on every request
  │
  ├── Supabase
  │     ├── Auth                 ← Email/password login
  │     ├── Realtime             ← WebSocket subscriptions (activity feed)
  │     └── Postgres             ← Primary database
  │
  └── Drizzle ORM               ← Type-safe SQL queries
        └── db/schema.ts         ← Single source of truth for all tables
```

**Stack:**
- **Framework:** Next.js 15 with React 19, App Router, Server Actions
- **Database:** Supabase Postgres via Drizzle ORM
- **Auth:** Supabase Auth (email/password)
- **Realtime:** Supabase WebSocket channels (Postgres CDC)
- **Deployment:** Vercel

---

## Database Schema

All tables are defined in `db/schema.ts` and managed through Drizzle migrations.

### `reps`
Sales reps. Each row maps to one team member.

| Column | Type | Description |
|---|---|---|
| `id` | `text` PK | Short identifier (e.g. `"timmy"`) |
| `name` | `text` | Full name |
| `initials` | `varchar(4)` | Used in avatars |
| `color` | `varchar(12)` | Hex color for the rep's avatar/chart |
| `role` | `text` | `"SDR"` by default |
| `user_id` | `uuid` unique | Matches Supabase Auth `user.id` |
| `is_active` | `boolean` | Inactive reps are hidden from the UI |
| `joined_date` | `date` | Used for "months active" calculations |

### `activity_log_entries`
Every logged activity tap — the core table. One row per tap.

| Column | Type | Description |
|---|---|---|
| `rep_id` | `text` → `reps.id` | Who logged it |
| `metric_key` | `text` | One of: `dials`, `gk_conv`, `dm_conv`, `vm`, `disc`, `demo`, `closed` |
| `label` | `text` | Human-readable label (e.g. `"Dial"`) |
| `icon` | `text` | Icon name for the feed |
| `color` | `varchar(12)` | Hex color |
| `delta` | `integer` | Always `1` for a tap, can be `-1` if decremented |
| `calendar_id` | `uuid` → `calendar.id` | Links to a scheduled meeting if applicable |
| `logged_at` | `timestamptz` | When it was logged (defaults to now) |

Indexed on `rep_id`, `logged_at`, and `calendar_id`.

### `targets`
Team-wide targets per period. One row per period string (`"daily"`, `"weekly"`, `"monthly"`).

| Column | Type | Description |
|---|---|---|
| `period` | `text` unique | `"daily"` / `"weekly"` / `"monthly"` |
| `dials` | `integer` | Target dial count |
| `dm_conv` | `integer` | Target DM conversations |
| `vm` | `integer` | Target voicemails |
| `disc` | `integer` | Target discoveries booked |
| `demo` | `integer` | Target demos booked |
| `onb` | `integer` | Target onboardings |
| `closed` | `integer` | Target closed deals |

Update targets by running `npx tsx scripts/update-targets.ts` or directly via SQL.

### `clients`
Active and churned client accounts tracked for MRR.

| Column | Type | Description |
|---|---|---|
| `name` | `text` | Company name |
| `plan` | `text` | Plan tier (e.g. `"Starter"`) |
| `mrr` | `integer` | Monthly recurring revenue in dollars |
| `owner_id` | `text` → `reps.id` | Which rep closed this account |
| `since_date` | `date` | When they became a client |
| `cancel_date` | `date` | If set, treated as churned as of this date |
| `status` | `text` | `"active"` or `"churned"` |

MRR shown in the header is computed from clients where `isClientActiveAsOf(today)` is true — i.e. `since_date ≤ today` and (`cancel_date` is null or `cancel_date > today`).

### `calendar`
Pipeline-level calendar: scheduled discoveries, demos, and onboardings.

| Column | Type | Description |
|---|---|---|
| `rep_id` | `text` → `reps.id` | Owning rep |
| `company_name` | `text` | Prospect company |
| `activity_type` | `text` | `"disc"`, `"demo"`, or `"onb"` |
| `scheduled_date` | `date` | When the meeting is scheduled |
| `intent` | `text` | `"high"`, `"medium"`, or `"low"` |
| `status` | `text` | `"scheduled"`, `"completed"`, or `"rescheduled"` |
| `reschedule_count` | `integer` | How many times it's been rescheduled |

Linked to `activity_log_entries.calendar_id` so that logging a `disc` or `demo` activity can be associated with a specific scheduled meeting.

### `closed_deals`
Records of closed-won deals, separate from the `clients` table which tracks ongoing MRR.

| Column | Type | Description |
|---|---|---|
| `rep_id` | `text` → `reps.id` | Who closed it |
| `company_name` | `text` | Company name |
| `monthly_price` | `float` | Deal MRR |
| `closed_date` | `date` | Close date |

### `daily_checklist`
Tracks which checklist items each rep has completed for a given day.

| Column | Type | Description |
|---|---|---|
| `date_key` | `text` | ISO date string (e.g. `"2026-07-21"`) |
| `item_id` | `text` | Matches a hardcoded item ID in `DailyChecklist.tsx` |
| `rep_id` | `text` → `reps.id` | Which rep checked it |
| `checked_at` | `timestamptz` | When they checked it |

### `tasks`
Team task board. Supports kanban statuses, multi-rep assignment, deadlines, and drag-to-reorder.

| Column | Type | Description |
|---|---|---|
| `title` | `text` | Task title |
| `description` | `text` | Optional longer description |
| `status` | `text` | `"todo"`, `"in_progress"`, or `"done"` |
| `assignee_ids` | `text[]` | Array of `reps.id` strings |
| `created_by_id` | `text` → `reps.id` | Creator |
| `deadline` | `date` | Optional due date |
| `position` | `integer` | Sort order within status column |

---

## Live Tracker Tab

The main daily-use screen. When you open it, you are automatically set as the active rep based on your Supabase login.

### What you see
- **Rep selector** — switch between your own view and other reps, or a team aggregate
- **Period selector** — `Day / Week / Month` with back-arrow navigation to view past periods
- **Activity grid** — one button per metric. Tap to log `+1`. Hold Shift or long-press to decrement. Each button shows the current count for the selected period
- **Target bar** — progress toward the daily/weekly/monthly target for key metrics
- **Activity Pipeline Card** — shows the pipeline funnel: Dials → DM Conv → Disc → Demo → Closed. Also shows meeting calendar for the current date range
- **Activity feed** — real-time log of all events (newest first). Displays what was logged, by whom, and how long ago
- **Closed deal modal** — triggered by tapping "Closed won". Records company name, monthly price, and close date; creates a `clients` row and a `closed_deals` row
- **Calendar event modal** — triggered by tapping "Discovery booked" or "Demo booked". Lets you associate the activity with a scheduled meeting in the `calendar` table

### Real-time updates
The Shell subscribes to `activity_log_entries` via Supabase Realtime (Postgres CDC). Every INSERT, UPDATE, and DELETE updates the feed instantly across all connected clients. When a teammate logs an activity, a browser notification fires (if permission is granted) with a different sound for deals vs activity vs tasks.

### Metrics tracked

| Key | Label | Group |
|---|---|---|
| `dials` | Dial | Outreach |
| `gk_conv` | GK Conversation | Outreach |
| `dm_conv` | DM Conversation | Outreach |
| `vm` | Voicemail | Outreach |
| `disc` | Discovery booked | Meetings booked |
| `demo` | Demo booked | Meetings booked |
| `closed` | Closed won | Rescheduled / lost |

---

## Team Performance Tab

Historical analytics. Filters to any range (day / week / month / all-time) with back-navigation.

### Sections

**KPI summary row:** Key metrics with counts and progress bars vs target.

**Activity Pipeline Card:** Funnel view — Dials → DM Conversations → Discoveries → Demos → Closed — with conversion percentages between each stage.

**Charts (via `components/charts/index.tsx`):**
- `LineChart` — trend over time for any metric (weekly buckets)
- `Speedometer` — dial-style gauge showing how close to target a metric is
- `ArrGrowthChart` — monthly ARR growth bar chart based on the `clients` table

**Show-rate analytics:**
- Discovery show rate by hour of day (`getDiscByHourAction`)
- Show rate by day of week (`getDiscShowRateByDowAction`)
- Attended conversion rates (discovery → demo → closed) (`getAttendedConversionsAction`)

**Client table:** All active clients sorted by MRR. Each row shows company name, plan, MRR, owner, and start date. Clicking a row opens `EditClientModal` to update or set a cancel date.

---

## Task Tracker Tab (+ Daily Checklist)

Split layout: Daily Checklist on the left, Task Board on the right.

### Daily Checklist (`DailyChecklist.tsx`)

A hardcoded structured workflow — sections with time blocks and items that reset each day. Items can be:
- `multi` — each rep checks it independently
- `shared` — once any rep checks it, it's checked for everyone
- `assigned` — only specific reps see it

**Sections:**
1. **Lead Management** (9:30–10 AM) — Day-of reminder emails, T-1 reminder emails
2. **Post Sprint Checklist** (10 AM–4:30 PM) — Send discovery bookings, respond to follow-up emails
3. **Prospect Management** (4:30 PM–EOD) — Respond to follow-up emails, assign new prospects

Items are stored in `daily_checklist`. Each morning starts fresh (no rows for today = all unchecked).

### Task Board (`TaskTracker.tsx`)

Three columns: **Todo → In Progress → Done**

Features:
- Create tasks with title, description, deadline, and one or more assignees
- Click the status circle to advance through statuses
- Overdue tasks (deadline passed, not done) are highlighted
- Assignee avatars shown on each card
- Realtime: task updates propagate to all connected clients via Supabase Realtime

---

## Authentication

Supabase Auth with email/password. The `middleware.ts` runs on every request to refresh the session cookie. If no session exists, requests are redirected to `/login`.

`app/login/page.tsx` — login form
`app/auth/callback/route.ts` — OAuth callback handler (used for magic links or OAuth flows if enabled)

**Superuser:** `timmy.ifidon@stepscale.ai` gets `isSuperUser: true` in the Shell, which enables additional controls (e.g. editing other reps' data).

---

## Server Actions (`app/actions.ts`)

All database writes go through Next.js Server Actions. Key actions:

| Action | What it does |
|---|---|
| `getActivityCountsAction(start, end)` | Aggregate activity counts per rep per metric for a date range (ET timezone) |
| `logActivityAction(repId, metricKey, ...)` | Insert one activity log entry |
| `decrementActivityAction(repId, metricKey, ...)` | Delete the most recent entry for a metric in a period |
| `logClosedDealAction(...)` | Insert into `closed_deals` and create/update a `clients` row |
| `logCalendarEventAction(...)` | Insert into `calendar` and link to an activity log entry |
| `getTrendAction(metric, start, end)` | Weekly bucketed trend data for charts |
| `getDiscByHourAction(...)` | Show-rate distribution by hour of day |
| `getDiscShowRateByDowAction(...)` | Show-rate by day of week |
| `getShowRatesAction(...)` | Show/no-show counts for calendar events |
| `getAttendedConversionsAction(...)` | Discovery → demo → closed conversion rates |
| `createTaskAction / updateTaskAction / deleteTaskAction` | Task CRUD |
| `getDailyChecklistAction / checkDailyItemAction / uncheckDailyItemAction` | Checklist state |
| `updateClientCancelDateAction(id, date)` | Mark a client as churned |

---

## File Structure

```
kpi-tracker/
├── app/
│   ├── page.tsx                  # Server component — fetches initial data, renders Shell
│   ├── actions.ts                # All Server Actions (DB reads + writes)
│   ├── globals.css               # Design tokens + global styles
│   ├── layout.tsx                # Root layout with ThemeProvider
│   ├── login/page.tsx            # Login form
│   └── auth/callback/route.ts   # Supabase auth callback
├── components/
│   ├── Shell.tsx                 # Tab nav, header (MRR, bell, theme toggle), realtime
│   ├── LiveTracker.tsx           # Activity grid, feed, period selector
│   ├── TeamPerformance.tsx       # Charts, funnels, client table
│   ├── TaskTracker.tsx           # Kanban task board
│   ├── DailyChecklist.tsx        # Hardcoded daily workflow checklist
│   ├── ActivityPipelineCard.tsx  # Funnel display + meeting calendar
│   ├── AddMeetingModal.tsx       # Schedule a new calendar event
│   ├── CalendarDecrementPicker.tsx # Pick which calendar event to un-log
│   ├── CalendarEventModal.tsx    # Associate an activity with a meeting
│   ├── ClosedDealModal.tsx       # Record a closed deal + create client
│   ├── DayCalendar.tsx           # Day-view calendar of scheduled meetings
│   ├── EditClientModal.tsx       # Edit client details / set cancel date
│   ├── ThemeProvider.tsx         # Light/dark mode context
│   ├── ThemeToggle.tsx           # Toggle button
│   ├── charts/
│   │   └── index.tsx             # LineChart, Speedometer, ArrGrowthChart, Sparkline, etc.
│   └── ui/
│       ├── Avatar.tsx            # Rep initials avatar
│       ├── Icon.tsx              # SVG icon library
│       └── primitives.tsx        # Card, Pill, KPI, TargetBar, Segmented, SectionTitle
├── db/
│   ├── schema.ts                 # Drizzle table definitions (source of truth)
│   ├── index.ts                  # Drizzle client (Postgres connection)
│   ├── migrations/               # SQL migration files
│   └── seed*.ts                  # Seed scripts for reps and historical data
├── hooks/
│   ├── useNotifications.ts       # Browser notification + sound management
│   └── useScheduledNotifications.ts # Scheduled reminders based on calendar
├── lib/
│   ├── types.ts                  # TypeScript types inferred from schema
│   ├── constants.ts              # METRIC_GROUPS, ALL_METRICS, KEY_METRICS
│   └── helpers.ts                # fmtMoney, isClientActiveAsOf, getPeriodBounds, etc.
├── utils/supabase/
│   ├── client.ts                 # Browser Supabase client
│   ├── server.ts                 # Server-side Supabase client
│   └── middleware.ts             # Session refresh logic
├── middleware.ts                 # Next.js middleware — session refresh on every route
├── drizzle.config.ts             # Drizzle Kit config (migration tooling)
└── scripts/
    ├── update-targets.ts         # One-off: update team targets in DB
    └── analytics-queries.sql     # Reference SQL for ad-hoc analysis
```

---

## Local Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in Supabase credentials
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# DATABASE_URL=...

# Run DB migrations (Drizzle against Supabase Postgres)
npm run db:migrate

# Seed the reps table
npm run db:seed

# Start dev server
npm run dev
```

### Database commands

```bash
npm run db:generate       # Generate a new migration from schema changes
npm run db:migrate        # Apply pending migrations
npm run db:push           # Push schema directly (no migration file, use for dev)
npm run db:studio         # Open Drizzle Studio (visual DB browser)
npm run db:seed           # Seed reps
npm run db:seed-historical  # Seed historical activity data
```

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key |
| `DATABASE_URL` | Drizzle (server only) | Direct Postgres connection string |

Both `.env.local` (dev) and `.env.prod` (production Vercel env) are used.

---

## Notifications

The app requests browser notification permission on first load (click the bell icon). Once granted:

- Any teammate's activity fires a browser notification in real time
- Different sounds play for different events:
  - `deal` — when a "Closed won" is logged
  - `activity` — when a discovery or demo is logged
  - `task` — other activities

Sound can be toggled independently from the notification permission using the speaker icon that appears next to the bell.

Scheduled notifications are also supported via `useScheduledNotifications` — this hook can fire reminders based on upcoming calendar events.

---

## Deployment

The app is deployed on Vercel (project linked in `.vercel/project.json`). Production environment variables are set in the Vercel dashboard. Every push to the main branch triggers a deployment.

Supabase Realtime must be enabled on the `activity_log_entries` table (and `tasks` table) for live updates to work. Enable via the Supabase dashboard → Database → Replication.
