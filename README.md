# HALIYA POS

A Point of Sale application for **HALIYA POS**, built with **Next.js 16**, **Supabase**, and **Tailwind CSS**. Features role-based access control (RBAC) with **Owner** and **Cashier** roles.

## Supabase Project

Create a project at [supabase.com](https://supabase.com) and copy your project URL and API keys into `.env.local`.

## Features

### Owner (Admin)
- Dashboard with revenue, sales count, and low-stock alerts
- Product & category management (CRUD)
- Sales history across all cashiers
- User management — create Owner/Cashier accounts, activate/deactivate users
- Access to POS terminal

### Cashier
- POS checkout interface
- Product search and category filtering
- Cart management with quantity controls
- Cash and card payment processing
- Automatic stock deduction on sale

### Security
- Supabase Auth with email/password login
- Row Level Security (RLS) policies on all tables
- Middleware route protection by role
- Server-side role validation on all actions

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Icons:** Lucide React

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your **Project URL** and **anon key** from Settings → API
3. Copy your **service role key** (needed for owner user creation)

### 2. Run Database Schema

Schema is defined in `supabase/schema.sql`. To apply on a fresh database:

```bash
npm run db:setup
```

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials (see `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_CODE=your-admin-code
DATABASE_POOLER_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres
```

Get the **service role key** from Supabase → Settings → API (needed for creating cashier accounts from the app).

### 4. Create the First Owner

`npm run db:setup` creates a default owner automatically:

| Field | Default |
|-------|---------|
| Email | `admin@haliya.com` |
| Password | `HALIYA@121` |
| Admin code (register) | `GEODEV` (set `ADMIN_CODE` in `.env.local`) |

Override with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_FULL_NAME` in `.env.local`, or run:

```bash
npm run admin:create
```

To promote a different existing user:

```bash
node scripts/set-owner.mjs your-email@example.com
```

### 5. Run the App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your owner account.

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated routes (shared layout)
│   │   ├── owner/          # Owner-only pages
│   │   │   ├── dashboard/
│   │   │   ├── products/
│   │   │   ├── sales/
│   │   │   └── users/
│   │   └── pos/            # POS terminal (Owner + Cashier)
│   ├── login/
│   └── actions.ts          # Server actions
├── components/
│   ├── layout/             # Sidebar navigation
│   ├── owner/              # Owner management components
│   ├── pos/                # POS terminal
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── auth.ts             # Auth helpers & RBAC
│   ├── supabase/           # Supabase clients
│   └── utils.ts
├── middleware.ts            # Route protection
└── types/
    └── database.ts
```

## Roles & Access

| Route | Owner | Cashier |
|-------|-------|---------|
| `/login` | ✅ | ✅ |
| `/owner/dashboard` | ✅ | ❌ |
| `/owner/products` | ✅ | ❌ |
| `/owner/sales` | ✅ | ❌ |
| `/owner/users` | ✅ | ❌ |
| `/pos` | ✅ | ✅ |

## Creating Cashier Accounts

1. Sign in as Owner
2. Go to **Users** → **Add User**
3. Fill in name, email, password, and select **Cashier** role
4. The cashier can now sign in and use the POS terminal

## Database Schema

- **profiles** — User roles and status (extends auth.users)
- **categories** — Product categories
- **products** — Inventory items with pricing and stock
- **sales** — Transaction records
- **sale_items** — Line items per sale

Sales are processed atomically via the `process_sale()` PostgreSQL function, which validates stock, creates the sale, and deducts inventory in a single transaction.
