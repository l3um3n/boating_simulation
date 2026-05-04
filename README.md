# Boating Simulator

A 2D top-down sailing simulator. Trim your sail, find the broad reach, and
beat the polar.

- **Goal**: maximise sailboat speed by pointing the sail in a direction
  against the wind.
- **Backend** (Python, FastAPI): owns sailing physics and exposes stateless
  REST endpoints for the polar curve and per-tick state.
- **Frontend** (Next.js + TypeScript + Tailwind): renders a top-down ocean
  view, runs the animation loop locally, and visualises the polar diagram so
  you can see how close you are to the optimal point of sail.

## Architecture

```
+---------+   GET /polar    +-----------+
| Next.js | <-------------- |  FastAPI  |
|   UI    |   POST /step    |  physics  |
+----+----+   POST /simulate+-----------+
     ^
     | requestAnimationFrame
     | uses cached polar curve
     v
   browser canvas (60Hz)
```

The frontend caches the polar curve and runs its own animation loop. When you
change the wind speed, sail size, boat size, or no-go half-angle, it refetches
a fresh polar from the backend.

## Quick start

You need Python 3.11+ and Node 18+.

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs at <http://localhost:8000/docs>. Run `pytest` for the physics test
suite.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The Next.js dev server proxies `/api/*` to the
backend at `http://127.0.0.1:8000`, so no CORS configuration is needed during
development.

## How to play

- Adjust **wind speed/direction**, **sail size**, **boat size**, and the
  **no-go half-angle** (the cone directly upwind in which a sailboat cannot
  make headway).
- Steer with **A / D** (or the heading slider), trim with **Q / E** (or the
  sail-angle slider).
- Watch the **polar diagram**: the yellow dot is your current TWA & speed.
  Push it toward the bulge (~120° TWA) for maximum speed.
- The HUD shows true wind angle, apparent wind, sail-trim quality, and a
  no-go warning when you point too close to the wind.

## Project layout

- [backend/](backend/) - FastAPI service. Run with `uvicorn` for local dev.
  See [backend/README.md](backend/README.md).
- [frontend/](frontend/) - Next.js app. See [frontend/README.md](frontend/README.md).
- [api/index.py](api/index.py) - Vercel serverless entry point that reuses the
  backend router under `/api/*`. Used in production only.

## Deployment (Vercel)

The Next.js frontend and the FastAPI backend deploy to a single Vercel
project. Frontend builds via the Next.js framework preset; the Python file at
`api/index.py` is auto-detected as a serverless function.

1. In the Vercel dashboard, set the project's **Root Directory** to the repo
   root (NOT `frontend/`). Build/install commands are pinned in
   [vercel.json](vercel.json).
2. Vercel auto-installs root [requirements.txt](requirements.txt) for the
   Python function. `uvicorn` and `pytest` are intentionally only in
   [backend/requirements.txt](backend/requirements.txt) since they are not
   needed in the serverless runtime.
3. `/api/*` requests are rewritten to `api/index.py`, where the FastAPI
   router is mounted under `/api`. Same-origin so no CORS config required.

Caveats: Hobby plan caps each request at 10s and 1024 MB. The simulator only
calls `/polar` (cached) and `/step` occasionally, so this is comfortable.
There are no WebSockets and no persistent server state - the design is
already stateless, so this fits the serverless model.

## Physics summary

A simplified-but-physically-reasonable model in
[backend/app/physics.py](backend/app/physics.py):

- A no-go zone directly upwind where boat speed is zero.
- A skewed bell-shaped speed-vs-TWA curve peaking on a broad reach.
- Sail-trim efficiency that peaks at an angle-specific optimum.
- Size scaling: bigger sail = faster, bigger hull = slower.
- Vector apparent wind: `apparent = true_wind - boat_velocity`.

15 unit tests in [backend/tests/test_physics.py](backend/tests/test_physics.py)
cover the qualitative shape of the model (no-go returns 0, broad reach is
fastest, more wind = more speed, optimal trim beats bad trim, apparent wind
math, etc.).
