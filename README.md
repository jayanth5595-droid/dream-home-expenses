# Dream Home — Expense Tracker

GitHub repository: jayanth5595-droid/dream-home-expenses
GitHub Pages URL: https://jayanth5595-droid.github.io/dream-home-expenses/

## Local setup

1. Install Node.js LTS.
2. Copy `.env.local.example` to `.env.local`.
3. Put your Supabase project URL and browser-safe publishable/anon key in `.env.local`.
4. Run `npm install`.
5. Run `npm run dev`.
6. Test the app locally.
7. Run `npm run build` before publishing.

## GitHub setup

Add these repository Actions secrets:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Then go to Settings → Pages and set Source to GitHub Actions.

Every push to `main` will build and deploy the site.

## Supabase

This frontend expects the existing Dream Home Supabase tables/RPCs:

- app_settings
- categories
- expenses
- owner_create
- owner_login
- owner_add_expense
- owner_update_expense
- owner_delete_expense
- owner_add_category

Never put a Supabase service-role/secret key in the frontend or GitHub Actions secrets used by the browser build.
