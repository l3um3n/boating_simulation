/**
 * Frontend animation loop. Runs at requestAnimationFrame cadence and looks
 * boat speed up from a backend-provided polar curve. The polar is recomputed
 * server-side whenever wind/sail/boat parameters change.
 */

import type { BoatParams, PolarPoint, PolarResponse } from "./api";

export interface SimState {
  params: BoatParams;
  heading: number; // deg, 0 = +y/north, increases clockwise
  sailAngle: number; // signed deg, sail relative to boat centreline
  x: number;
  y: number;
  speed: number; // knots, derived
  twa: number; // unsigned, deg
  signedTwa: number; // signed, +ve = wind from starboard
  apparentSpeed: number;
  apparentAngle: number; // signed, relative to boat heading
  inNoGo: boolean;
  trail: Array<{ x: number; y: number }>;
}

export const DEFAULT_PARAMS: BoatParams = {
  wind_speed: 14,
  wind_dir: 0,
  sail_size: 22,
  boat_size: 8,
  no_go_half_angle: 40,
};

export function makeInitialState(params: BoatParams = DEFAULT_PARAMS): SimState {
  return {
    params,
    heading: 110, // start on a starboard broad reach for fun
    sailAngle: 55,
    x: 0,
    y: 0,
    speed: 0,
    twa: 0,
    signedTwa: 0,
    apparentSpeed: params.wind_speed,
    apparentAngle: 0,
    inNoGo: false,
    trail: [],
  };
}

export function wrap360(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r === 360 ? 0 : r;
}

export function wrap180(deg: number): number {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
}

export function unsignedTwa(windDir: number, heading: number): number {
  const windFrom = wrap360(windDir + 180);
  return Math.abs(wrap180(windFrom - heading));
}

export function signedTwa(windDir: number, heading: number): number {
  const windFrom = wrap360(windDir + 180);
  return wrap180(windFrom - heading);
}

/**
 * Linearly interpolate the polar curve at a given (unsigned) TWA, returning
 * the optimal-trim speed and the optimal sail angle for that point of sail.
 */
export function interpolatePolar(
  polar: PolarResponse | null,
  twa: number,
): { speed: number; optimalSailAngle: number } {
  if (!polar || polar.points.length === 0) {
    return { speed: 0, optimalSailAngle: 30 };
  }
  const pts = polar.points;
  if (twa <= pts[0].twa) {
    return { speed: pts[0].speed, optimalSailAngle: pts[0].optimal_sail_angle };
  }
  const last = pts[pts.length - 1];
  if (twa >= last.twa) {
    return { speed: last.speed, optimalSailAngle: last.optimal_sail_angle };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (twa >= a.twa && twa <= b.twa) {
      const t = (twa - a.twa) / (b.twa - a.twa || 1);
      return {
        speed: a.speed + (b.speed - a.speed) * t,
        optimalSailAngle:
          a.optimal_sail_angle +
          (b.optimal_sail_angle - a.optimal_sail_angle) * t,
      };
    }
  }
  return { speed: last.speed, optimalSailAngle: last.optimal_sail_angle };
}

/** Trim efficiency mirroring the backend: ~exp(-(err^2)/(2*22^2)). */
function trimEfficiency(
  twa: number,
  sailAngle: number,
  optimalSailAngle: number,
): number {
  const err = Math.abs(Math.abs(sailAngle) - optimalSailAngle);
  const eff = Math.exp(-(err * err) / (2 * 22 * 22));
  return 0.25 + 0.75 * eff;
}

export interface StepInputs {
  state: SimState;
  polar: PolarResponse | null;
  dt: number; // seconds
  trailMaxPoints?: number;
}

/**
 * Advance simulation state by `dt` seconds. Returns a NEW SimState so React
 * re-renders cleanly.
 */
export function stepSimulation({
  state,
  polar,
  dt,
  trailMaxPoints = 600,
}: StepInputs): SimState {
  const twa = unsignedTwa(state.params.wind_dir, state.heading);
  const sTwa = signedTwa(state.params.wind_dir, state.heading);
  const inNoGo = twa <= state.params.no_go_half_angle;

  const { speed: optimalSpeed, optimalSailAngle } = interpolatePolar(polar, twa);
  // Polar is at OPTIMAL trim; scale by current trim efficiency vs that
  // optimum. Inside the no-go zone, optimalSpeed is already 0.
  const eff = trimEfficiency(twa, state.sailAngle, optimalSailAngle);
  // The backend bakes a baseline 0.25 floor into trim efficiency, but at
  // optimal trim eff == 1.0 already corresponds to the polar speed. Renormalise
  // so optimum trim reproduces the polar.
  const trimScale = eff; // 0.25..1.0 - polar already corresponds to eff=1
  const speed = optimalSpeed * trimScale;

  // Apparent wind (mirrors backend math).
  const windRad = (state.params.wind_dir * Math.PI) / 180;
  const wx = state.params.wind_speed * Math.sin(windRad);
  const wy = state.params.wind_speed * Math.cos(windRad);
  const headRad = (state.heading * Math.PI) / 180;
  const bx = speed * Math.sin(headRad);
  const by = speed * Math.cos(headRad);
  const ax = wx - bx;
  const ay = wy - by;
  const apparentSpeed = Math.hypot(ax, ay);
  let apparentAngle = 0;
  if (apparentSpeed > 1e-6) {
    const srcWorld = (Math.atan2(-ax, -ay) * 180) / Math.PI;
    apparentAngle = wrap180(srcWorld - state.heading);
  }

  // Integrate position. We treat 1 knot as 1 world-unit per second, so 14 kt
  // -> 14 units/s. Canvas chooses how many pixels per unit.
  const newX = state.x + bx * dt;
  const newY = state.y + by * dt;

  // Append to trail (down-sample to avoid runaway arrays).
  const trail = state.trail.slice();
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(newX - last.x, newY - last.y) > 0.5) {
    trail.push({ x: newX, y: newY });
    if (trail.length > trailMaxPoints) trail.shift();
  }

  return {
    ...state,
    speed,
    twa,
    signedTwa: sTwa,
    inNoGo,
    apparentSpeed,
    apparentAngle,
    x: newX,
    y: newY,
    trail,
  };
}
