# School POS & Store Management System

A web-based Point of Sale and School Store Management app built with **React + Vite + Supabase**.

## Running the App

The app runs on port 5000 via the **Start application** workflow (`npm run client`).

Open the preview pane to see it live.

## Required Secrets

These must be set as Replit Secrets:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase project's anon/public key |

Find these in your Supabase dashboard under **Project Settings → API**.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Icons**: Lucide React

## Login

- **Cashier**: 4-digit PIN (set up via Admin → User Management)
- **Admin**: Password login (Admin Password tab on login screen)

## Development

```bash
npm run client     # Frontend only (Vite on port 5000)
npm run dev        # Frontend + backend concurrently
```

## User Preferences

<!-- Add user preferences here -->
