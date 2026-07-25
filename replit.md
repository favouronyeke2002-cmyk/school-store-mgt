# School POS & Store Management System

A React + Supabase web app for school store point-of-sale and fees management.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL + auth)
- **Charts**: Recharts
- **Icons**: Lucide React

## How to Run

The configured workflow (`Start application`) runs:
```
npm run client
```
This starts the Vite dev server on port 5000.

## Required Secrets

Set these in Replit Secrets before running:
- `VITE_SUPABASE_URL` — your Supabase project URL (Project Settings → API)
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key (Project Settings → API)

## Features

- **Admin view** (password login): Dashboard, Student Management, Inventory, Transaction History, Shift History, User Management, Bulk CSV Import
- **Cashier view** (4-digit PIN): Shift-based POS, store purchases, fee collection, thermal receipt printing

## Project Structure

```
src/renderer/
├── components/
│   ├── admin/      # Admin dashboard panels
│   ├── auth/       # Login screen
│   └── cashier/    # POS interface
├── context/        # AuthContext, ShiftContext
├── lib/
│   ├── api.ts      # All Supabase API calls
│   ├── supabase.ts # Supabase client init
│   └── feeEngine.ts
└── App.tsx
```

## User Preferences
