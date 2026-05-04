# Boating Simulator - Backend

FastAPI service that owns the sailing physics. The Next.js frontend caches the
polar curve from this service and runs its own animation loop.

This directory lives under `frontend/` so it ships in the same Vercel project.
Locally it runs as a normal `uvicorn` process; in production
[../api/index.py](../api/index.py) imports `app.routes:router` and mounts it
under `/api/*` on the Vercel serverless function. `uvicorn` is **not** used in
production - Vercel provides the ASGI runtime.

## Setup

```bash
# from frontend/server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for interactive API docs. In local dev,
routes live at the root (`/polar`, `/step`, ...) and the Next.js dev server
rewrites `/api/*` -> `http://127.0.0.1:8000/*`, so the frontend can use the
same `/api/...` URLs in dev and production.

## Tests

```bash
pytest
```

## Endpoints

- `GET /health` - liveness probe.
- `GET /polar?wind_speed=&wind_dir=&sail_size=&boat_size=&no_go_half_angle=&step=`
  - returns a sampled polar (TWA -> speed at optimal trim).
- `POST /step` - one physics tick: TWA, boat speed, optimal trim, apparent wind.
- `POST /simulate` - server-side replay of N ticks at fixed heading + trim.

## Physics summary

See [app/physics.py](app/physics.py). It is intentionally a simplified model:

- A no-go zone directly upwind (boat speed = 0).
- A skewed bell-shaped speed-vs-TWA curve peaking on a broad reach (~120deg).
- Sail-trim efficiency that peaks at an angle-specific optimum.
- Size scaling: bigger sail = faster, bigger hull = slower.
- Vector apparent wind: `apparent = true_wind - boat_velocity`.
