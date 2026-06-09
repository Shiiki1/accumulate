# Curator

A minimal private visual inspiration library built with Next.js, TypeScript,
Tailwind CSS, and Supabase.

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_create_items.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Legacy anon keys can be used as `NEXT_PUBLIC_SUPABASE_ANON_KEY` if needed.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase

The migration creates:

- `public.items` with row-level security so each user can only access their own rows.
- Public `item-images` storage bucket for uploaded inspiration images.
- Storage write/delete policies scoped to the authenticated user's folder.
- Explicit authenticated grants for the Supabase Data API.
