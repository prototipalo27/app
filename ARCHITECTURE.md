# Architecture — Prototipalo

Internal platform for a 3D printing production workshop. Built with Next.js 16 (App Router) + Supabase + Tailwind CSS v4.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, Turbopack, Cache Components)
- **Database**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Language**: TypeScript (strict mode)
- **Deployment**: Vercel (app.prototipalo.es)
- **AI**: Anthropic Claude (classification, estimation, drafting, summarization)

## Folder Structure

```
src/
├── app/
│   ├── dashboard/           # Main authenticated app
│   │   ├── crm/             # Lead pipeline (kanban, list, timeline, commissions)
│   │   ├── projects/        # Project management (detail, queue, checklist)
│   │   ├── printers/        # Bambu Lab printer monitoring (realtime)
│   │   ├── queue/           # Print job queue management
│   │   ├── shipments/       # Shipping (Packlink, GLS, MRW, Cabify)
│   │   ├── equipo/          # Team (employees, overtime, calendar, skills)
│   │   ├── tareas/          # Tasks
│   │   ├── purchases/       # Purchase orders
│   │   ├── suppliers/       # Vendor management
│   │   ├── finanzas/        # Finance (revenue, expenses, taxes, bank statements)
│   │   ├── inversores/      # Investor portal management
│   │   ├── herramientas/    # Tools & resources
│   │   ├── whatsapp/        # WhatsApp business messaging
│   │   ├── contactos/       # Holded contact sync
│   │   ├── control/         # Dashboard analytics
│   │   ├── settings/        # Email snippets, templates, printer config
│   │   └── requests/        # Feature requests / improvements
│   ├── track/[token]/       # Public project tracking portal
│   ├── quote/[token]/       # Public quote acceptance + payment
│   ├── proforma/[token]/    # Public proforma viewer
│   ├── nda/[token]/         # Public NDA signing
│   ├── investors/[token]/   # Public investor dashboard
│   ├── login/               # Auth (email/password + Google OAuth)
│   └── api/                 # API routes (webhooks, cron, integrations)
├── components/              # Shared UI components
└── lib/                     # Business logic & integrations
    ├── supabase/            # Database clients & cached queries
    ├── holded/              # Holded invoicing API
    ├── bambu/               # Bambu Lab printer MQTT + API
    ├── packlink/            # Packlink shipping API
    ├── gls/                 # GLS shipping (SOAP)
    ├── mrw/                 # MRW courier (SOAP)
    ├── cabify/              # Cabify delivery (REST + OAuth2)
    ├── gmail/               # Gmail API (domain-wide delegation)
    ├── google-drive/        # Google Drive file management
    ├── push-notifications/  # Web push (VAPID)
    └── email/               # SMTP sending + status notifications
```

## Authentication & Authorization

- **Auth provider**: Supabase Auth (email/password + Google OAuth)
- **Domain restriction**: Only `@prototipalo.com` emails
- **RBAC**: 4 roles with hierarchy: `super_admin > manager > comercial > employee`
- **Route protection**: Middleware redirects unauthenticated users
- **Impersonation**: Super admins can impersonate other users
- **Public routes**: `/track/*`, `/quote/*`, `/proforma/*`, `/nda/*`, `/investors/*`

## Core Data Flows

### Lead → Quote → Payment → Project

```
Webflow form / WhatsApp / Email / Manual
  → POST /api/crm/webhook (or /api/webhooks/*)
  → Insert lead + auto-tag (AI) + push notification
  → CRM kanban: new → contacted → quoted
  → Create quote_request (Holded proforma + Stripe link)
  → Client pays via /quote/[token] (Stripe Checkout)
  → Stripe webhook → onPaymentConfirmed()
    → Create project + checklist + Google Drive folders
    → Send confirmation email
```

### Project Lifecycle

```
pending → design → printing → post_processing → qc → shipping → delivered

Each transition:
  - Audit trail in project_status_history
  - Client email notification
  - design: Create/sync Google Drive folders
  - printing: Assign to printers via queue
  - shipping: Create shipping_info + carrier API
  - delivered: Close project
```

### Print Queue

```
Project items → print_jobs (batches assigned to printers)
Cron /api/printers/sync (every 5 min):
  → Bambu MQTT sync → update printer status
  → autoTrackPrintJobs(): RUNNING→printing, FINISH→done
  → autoCompleteByKeyword(): filename match → mark complete
  → Update project progress
```

### Email System

```
Outbound: 8am-8pm Madrid time (queue outside hours)
  - Per-user SMTP credentials or global fallback
  - Thread support (In-Reply-To, Message-ID)

Inbound: Gmail API push notifications
  - /api/webhooks/gmail-push
  → Parse email → spam check → match to lead
  → Create lead_activity (email_received)
  → Push notification
```

## External Integrations

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| **Holded** | Invoicing, contacts, proformas | API Key |
| **Stripe** | Payment processing | API Key + Webhook Secret |
| **Bambu Lab** | 3D printer monitoring | MQTT + Cloud Token |
| **Packlink** | Multi-carrier shipping | API Key |
| **GLS** | Spain domestic shipping | UID Cliente (SOAP) |
| **MRW** | Spain courier | Franquicia credentials (SOAP) |
| **Cabify** | Same-day delivery | OAuth2 client_credentials |
| **Gmail API** | Email sync + push | Service Account (domain delegation) |
| **Google Drive** | Project file management | Service Account |
| **WhatsApp** | Business messaging | Evolution API |
| **Claude AI** | Classification, estimation, drafting | API Key |
| **Uploadcare** | File uploads | Public key |
| **Webflow** | Lead form submissions | Webhook secret |

## Caching Strategy

- `"use cache"` + `cacheLife("hours")`: User profiles, base prices, zone assignments
- `"use cache"` + `cacheLife("minutes")`: Leads + activities, task counts, analytics
- `cacheTag()`: All cached functions support manual invalidation via `revalidateTag()`
- Supabase Realtime: Printers, WhatsApp, projects (live updates without polling)

## Key Decisions

1. **Server Components first** — Data fetching in RSC, client components only for interactivity
2. **Suspense streaming** — Heavy sections (email, proforma, activity) load independently
3. **Service Worker** — PWA with push notifications, offline page, network-first caching
4. **No ORM** — Direct Supabase client with generated types
5. **Email scheduling** — Outbound emails queued outside business hours (8am-8pm Madrid)
6. **Multi-carrier shipping** — Abstracted per-carrier API (Packlink/GLS/MRW/Cabify) with unified shipping_info table
