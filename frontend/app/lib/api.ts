/**
 * Typed wrappers around the FastAPI backend. All requests go through the
 * Next.js rewrite at /api/* so we don't fight CORS in the browser.
 */

export interface BoatParams {
  wind_speed: number;
  wind_dir: number;
  sail_size: number;
  boat_size: number;
  no_go_half_angle: number;
}

export interface PolarPoint {
  twa: number;
  speed: number;
  optimal_sail_angle: number;
}

export interface PolarResponse {
  params: BoatParams;
  points: PolarPoint[];
}

export interface StepResponse {
  twa: number;
  boat_speed: number;
  optimal_sail_angle: number;
  apparent_wind_speed: number;
  apparent_wind_angle: number;
  in_no_go_zone: boolean;
}

const BASE = "/api";

function paramsQuery(p: BoatParams): string {
  const usp = new URLSearchParams({
    wind_speed: String(p.wind_speed),
    wind_dir: String(p.wind_dir),
    sail_size: String(p.sail_size),
    boat_size: String(p.boat_size),
    no_go_half_angle: String(p.no_go_half_angle),
  });
  return usp.toString();
}

export async function fetchPolar(
  p: BoatParams,
  step = 5,
  signal?: AbortSignal,
): Promise<PolarResponse> {
  const res = await fetch(
    `${BASE}/polar?${paramsQuery(p)}&step=${step}`,
    { signal, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`polar request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchStep(
  p: BoatParams,
  boat_heading: number,
  sail_angle: number,
  signal?: AbortSignal,
): Promise<StepResponse> {
  const res = await fetch(`${BASE}/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params: p, boat_heading, sail_angle }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`step request failed: ${res.status}`);
  }
  return res.json();
}
