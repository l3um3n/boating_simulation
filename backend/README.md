# Boating Simulator - Backend

FastAPI service that owns the sailing physics. The Next.js frontend caches the
polar curve from this service and runs its own animation loop.

## Setup

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for interactive API docs.

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

## Deployment

Deploy this service on a host that runs long-lived ASGI processes:
[Render](https://render.com), [Fly.io](https://fly.io),
[Railway](https://railway.app), or similar. The same `uvicorn` command you use
locally works in production - just bind to `0.0.0.0` and the host's `$PORT`:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Build command on every platform: `pip install -r requirements.txt`. Once
deployed, set `BACKEND_URL` on the Vercel frontend project to the resulting
URL so its `/api/*` rewrite points here.

## Physics summary

See [app/physics.py](app/physics.py). It is intentionally a simplified model:

- A no-go zone directly upwind (boat speed = 0).
- A skewed bell-shaped speed-vs-TWA curve peaking on a broad reach (~120deg).
- Sail-trim efficiency that peaks at an angle-specific optimum.
- Size scaling: bigger sail = faster, bigger hull = slower.
- Vector apparent wind: `apparent = true_wind - boat_velocity`.
