# Deployment Guide

## Architecture

| Component | Where | Why |
|---|---|---|
| **Frontend** (React + Vite) | Vercel (free) | Static SPA, perfect for Vercel |
| **Backend** (NestJS) | Render / Railway / Fly.io | Long-running server (Vercel serverless cap = 10s, won't fit) |
| **Database** (CockroachDB) | cockroachlabs.cloud (already done) | Postgres-compatible, 5GB free |

---

## Frontend → Vercel

### 1. Push code to GitHub
```bash
git add -A
git commit -m "feat: production-ready CRM"
git push origin main
```

### 2. Vercel setup
1. Go to https://vercel.com → Sign in with GitHub
2. **Add New → Project** → select `jinuchiha/TEST_USHI`
3. Vercel auto-detects Vite. Settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables:**
   - `VITE_API_URL` = `https://your-backend-url.com` (after backend deployed)
5. **Deploy**

### 3. After backend deployed
- Vercel → Project → Settings → Environment Variables
- Update `VITE_API_URL` to backend's public URL
- Redeploy (auto on next push, or manual "Redeploy" button)

---

## Backend → Render (recommended free option)

### 1. Render setup
1. https://render.com → Sign up
2. **New → Web Service** → Connect GitHub repo
3. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
   - **Plan:** Free
4. **Environment Variables** (copy from local `.env`):
   - `DB_HOST` = your CockroachDB host
   - `DB_PORT` = 26257
   - `DB_NAME` = defaultdb (or recovery_crm)
   - `DB_USER` = your user
   - `DB_PASSWORD` = your password
   - `DB_SSL` = `true`
   - `DB_SSL_MODE` = `require`
   - `DB_SYNC` = `false` (DO NOT set true in production)
   - `JWT_SECRET` = random 32+ char string
   - `JWT_ACCESS_EXPIRY` = `15m`
   - `JWT_REFRESH_EXPIRY` = `7d`
   - `PORT` = `3000`
   - `CORS_ORIGIN` = `https://your-frontend.vercel.app`
   - `NODE_ENV` = `production`
5. **Create Web Service**

Render gives you URL like `https://your-backend.onrender.com`.

Set this URL in Vercel as `VITE_API_URL`.

### Alternative: Railway / Fly.io
- **Railway:** $5/mo trial credit, similar setup
- **Fly.io:** Free tier, requires Dockerfile (already exists in `server/`)

---

## Production checklist

Before going live:
- [ ] `DB_SYNC=false` in backend env (use migrations only)
- [ ] Strong `JWT_SECRET` (32+ random chars)
- [ ] CORS only allows production frontend domain (not wildcard)
- [ ] Database backups configured in CockroachDB dashboard
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS only (Vercel + Render do this automatically)
- [ ] Frontend points to production backend URL via `VITE_API_URL`

---

## Local dev still works

Same code. Local dev:
- Backend: `npm run start:dev` (server folder)
- Frontend: `npm run dev` (root)
- Frontend uses `VITE_API_URL=http://localhost:3000` (default)
