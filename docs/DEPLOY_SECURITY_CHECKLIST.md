# Deployment Security Checklist

Verify these before deploying to production.

## Before Deploy

- [ ] **No secrets in code** – API keys, passwords, and tokens are only in environment variables (Render/Vercel), never committed
- [ ] **Strong password** – Set `BASIC_AUTH_PASSWORD` on Render (never use `changeme`)
- [ ] **Vercel auth env vars** – Set `VITE_AUTH_USERNAME` and `VITE_AUTH_PASSWORD` on Vercel to match the backend
- [ ] **HTTPS only** – Render and Vercel use HTTPS by default

## Backend (Render)

- [ ] `APOLLO_API_KEY` – Set via Render dashboard (sync: false)
- [ ] `RESEND_API_KEY` – Set via Render dashboard (sync: false)
- [ ] `BASIC_AUTH_PASSWORD` – Set a strong password
- [ ] `DATABASE_URL` – Auto-set from Render Postgres (Blueprint)
- [ ] `CORS_ORIGINS` – Add your Vercel URL if calling API directly (optional when using proxy)

## Frontend (Vercel)

- [ ] `VITE_AUTH_USERNAME` – Must match backend (default: admin)
- [ ] `VITE_AUTH_PASSWORD` – Must match backend; do not leave as default `changeme`
- [ ] `VITE_API_URL` – Leave empty when using vercel.json proxy

## After Deploy

- [ ] Test login with your credentials
- [ ] Confirm API calls work (profiles, config, enrichment)
- [ ] Check that `/api` requests are proxied correctly (no CORS errors)

## Notes

- **Basic Auth in frontend**: Credentials are embedded in the client bundle via `VITE_AUTH_*`. Treat this as an internal tool; for public apps, use a proper login flow.
- **Render free tier**: Service sleeps after ~15 min inactivity; first request may be slow.
