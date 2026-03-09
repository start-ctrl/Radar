# Free Backend Deployment Guide

Deploy your FastAPI backend for free so it works with your Vercel frontend. Here are the best options, from easiest to most flexible.

---

## Quick: Vercel (frontend) + Render (backend)

1. **Backend:** Deploy backend on [Render](https://render.com) (Option 1 below). You’ll get a URL like `https://radar-backend.onrender.com`.
2. **Proxy API through Vercel (recommended):** So your frontend can keep using `/api` without CORS or env changes, add a rewrite in the frontend repo. Create (or update) `frontend/vercel.json`:
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://radar-backend.onrender.com/api/:path*" }
     ]
   }
   ```
   Replace `radar-backend.onrender.com` with your actual Render backend URL. Deploy the frontend to Vercel. Requests to `your-app.vercel.app/api/...` will be proxied to Render; the browser still sees the same origin, so no CORS or `ALLOWED_ORIGINS` needed.
3. **Alternative – call backend directly:** If you prefer not to proxy, set a build-time env var in Vercel (e.g. `VITE_API_URL=https://radar-backend.onrender.com`), update your frontend API client to use that base URL in production, and on Render set `ALLOWED_ORIGINS` to your Vercel URL (e.g. `https://your-app.vercel.app`).

---

## Option 1: Render (Recommended – Easiest)

**Free tier:** 750 hours/month, spins down after 15 min of no traffic (cold start ~30–60 sec on next request).

### Steps

1. **Push your code to GitHub** (if not already).

2. **Create a free PostgreSQL database (optional but recommended for persistence):**
   - Go to [render.com](https://render.com) → Dashboard → **New +** → **PostgreSQL**.
   - Name it e.g. `radar-db`, region closest to you.
   - Create. Copy the **Internal Database URL** (use this in the next step).

3. **Deploy the backend:**
   - **New +** → **Web Service**.
   - Connect your GitHub repo and select the **Linkedin Tool** (or your repo name).
   - **Root Directory:** `backend` (important).
   - **Runtime:** Python 3.
   - **Build Command:**
   ```bash
   pip install -r requirements.txt && alembic upgrade head
   ```
   - **Start Command:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
   - **Instance Type:** Free.

4. **Environment variables** (in Render dashboard → your service → **Environment**):

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | (Internal Database URL from step 2, or leave default for SQLite*) |
   | `APOLLO_API_KEY` | your Apollo key |
   | `RESEND_API_KEY` | your Resend key |
   | `BASIC_AUTH_USERNAME` | admin |
   | `BASIC_AUTH_PASSWORD` | a strong password |
   | `EMAIL_FROM` | your sender email |
   | `EMAIL_TO` | your recipient |
   | `ALLOWED_ORIGINS` | your Vercel app URL, e.g. `https://your-app.vercel.app` (so frontend can call the API) |

   \* If you don’t create PostgreSQL, Render uses ephemeral disk: **data resets on every deploy**. For a real demo, use the free PostgreSQL above.

5. **Deploy** – Render will build and start the service. You’ll get a URL like `https://your-service-name.onrender.com`.

6. **Frontend (Vercel):** Set `VITE_API_URL` (or your API base URL env var) to `https://your-service-name.onrender.com` and redeploy so the frontend calls this backend.

**CORS:** Your FastAPI app already allows origins. If your Vercel domain is different, add it to the CORS list in `backend/app/main.py` (e.g. `https://your-app.vercel.app`).

---

## Option 2: Railway

**Free tier:** $5 credit/month (enough for a demo; no free tier after that).

### Steps

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select your repo.
3. Set **Root Directory** to `backend`.
4. Railway will detect Python. Set:
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add a **PostgreSQL** plugin (optional) and use `DATABASE_URL` from the plugin.
5. In **Variables**, add the same env vars as in Render (e.g. `APOLLO_API_KEY`, `RESEND_API_KEY`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, `DATABASE_URL` if you added PostgreSQL).
6. Deploy. Use the generated URL (e.g. `https://your-app.up.railway.app`) as the backend URL in Vercel.

---

## Option 3: Fly.io

**Free tier:** Small VMs and 3GB persistent volume (good for SQLite).

### Steps

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/) and sign up: `fly auth signup`.
2. In your project root (parent of `backend`), run:
   ```bash
   cd backend
   fly launch
   ```
   - Choose app name and region.
   - Don’t add PostgreSQL yet if you want to try SQLite first.
3. **Persistent volume for SQLite (so data survives deploys):**
   ```bash
   fly volumes create data --size 1 --region <your-region>
   ```
   Then in `fly.toml` (created by `fly launch`) set:
   ```toml
   [mounts]
     source = "data"
     destination = "/data"
   ```
   And set env:
   ```bash
   fly secrets set DATABASE_URL=sqlite:////data/founder_tracker.db
   ```
4. Set other secrets:
   ```bash
   fly secrets set APOLLO_API_KEY=your_key
   fly secrets set RESEND_API_KEY=your_key
   fly secrets set BASIC_AUTH_USERNAME=admin
   fly secrets set BASIC_AUTH_PASSWORD=your_secure_password
   ```
5. **Build/run:** Fly uses a Dockerfile if present. If not, add a `Dockerfile` in `backend` (you already have one) and run:
   ```bash
   fly deploy
   ```
6. Your backend URL will be `https://your-app-name.fly.dev`. Use this in Vercel as the API URL.

---

## Option 4: PythonAnywhere

**Free tier:** One web app, always-on but with limits; SQLite works and persists.

### Steps

1. Sign up at [pythonanywhere.com](https://www.pythonanywhere.com).
2. **Open a Bash console** and clone your repo:
   ```bash
   git clone https://github.com/YourUsername/YourRepo.git
   cd YourRepo/backend
   ```
3. Create a virtualenv and install deps:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
4. Run migrations:
   ```bash
   alembic upgrade head
   ```
5. In the **Web** tab, add a new web app (manual config), point it to your repo and use a **WSGI** file. For FastAPI you need an ASGI server: create e.g. `backend/wsgi.py` that wraps the app (or use a startup script that runs `uvicorn`).  
   **Note:** Free tier is a bit more manual for ASGI. If you’re comfortable with PaaS, Render/Railway/Fly are simpler.

---

## Summary

| Platform      | Best for           | Persistence        | Cold start     |
|---------------|--------------------|--------------------|----------------|
| **Render**    | Easiest, free      | Use free PostgreSQL| ~30–60 s       |
| **Railway**   | Quick demo         | PostgreSQL add-on  | Minimal        |
| **Fly.io**    | SQLite + volume    | Yes (volume)       | Low            |
| **PythonAnywhere** | Simple Python host | SQLite OK      | No             |

**Recommendation:** Use **Render** with the free PostgreSQL database so your backend is free, persistent, and works cleanly with your Vercel frontend. After deploy, set your Vercel app’s API URL to the Render backend URL and add that Vercel URL to CORS in `backend/app/main.py` if needed.
