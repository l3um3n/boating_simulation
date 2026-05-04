# Boating Simulator - Frontend

Next.js 14 (App Router) + TypeScript + Tailwind. Renders the top-down ocean
view, runs the live animation loop, and visualises the polar diagram.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open <http://localhost:3000>. The frontend proxies `/api/*` to the backend
configured by `BACKEND_URL` (defaults to `http://127.0.0.1:8000`) - see
[next.config.js](next.config.js). The same env var works in production:
deploy the FastAPI backend on Render / Fly / Railway and set `BACKEND_URL`
on the Vercel project to its URL.

## Controls

- Drag sliders for heading, sail angle, wind, and boat parameters.
- Keyboard: `A`/`D` to turn, `Q`/`E` to trim sail.
- "Auto-trim sail" sets the sail to the optimal angle for the current TWA.

## Files of note

- [app/page.tsx](app/page.tsx) - composes everything, owns simulation state.
- [app/lib/simulation.ts](app/lib/simulation.ts) - frame-rate-independent
  physics integration that uses the cached polar.
- [app/lib/api.ts](app/lib/api.ts) - typed fetch client for the backend.
- [app/components/OceanCanvas.tsx](app/components/OceanCanvas.tsx) - top-down
  canvas2d view of the ocean, boat, and no-go wedge.
- [app/components/PolarChart.tsx](app/components/PolarChart.tsx) - SVG polar
  diagram with a marker for the boat's current TWA & speed.
