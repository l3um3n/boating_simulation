"use client";

import { useEffect, useRef } from "react";
import type { SimState } from "../lib/simulation";

interface Props {
  state: SimState;
  /** Pixels per world unit (1 unit = 1 knot-second). */
  pxPerUnit?: number;
}

/**
 * Top-down ocean view. The boat stays centred; the world scrolls beneath it.
 * Renders directly via canvas2d every animation frame.
 */
export function OceanCanvas({ state, pxPerUnit = 6 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    function resize() {
      if (!canvas) return;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const s = stateRef.current;

      // Ocean background gradient.
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.1,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      grad.addColorStop(0, "#1a4675");
      grad.addColorStop(1, "#06122a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Convert world coords to canvas coords. World +y = north. Canvas +y is
      // down, so we negate y. Boat sits at canvas centre.
      const cx = w / 2;
      const cy = h / 2;
      const scale = pxPerUnit * dpr;
      const worldToCanvas = (wx: number, wy: number): [number, number] => [
        cx + (wx - s.x) * scale,
        cy - (wy - s.y) * scale,
      ];

      // Wave grid - draw lines aligned with true wind so motion is obvious.
      drawWaveGrid(ctx, w, h, scale, s);

      // Boat trail / wake.
      if (s.trail.length > 1) {
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = "rgba(207, 230, 255, 0.4)";
        ctx.beginPath();
        for (let i = 0; i < s.trail.length; i++) {
          const [px, py] = worldToCanvas(s.trail[i].x, s.trail[i].y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // No-go zone wedge (centred on the wind source).
      drawNoGoZone(ctx, cx, cy, dpr, s);

      // Boat itself - centred and rotated.
      drawBoat(ctx, cx, cy, dpr, s);

      // Wind compass / direction arrow in the corner.
      drawWindCompass(ctx, w, h, dpr, s);

      // North indicator
      drawNorth(ctx, w, h, dpr);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [pxPerUnit]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full rounded-2xl border border-white/10 shadow-2xl"
      aria-label="Top-down ocean view of the sailboat"
    />
  );
}

function drawWaveGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
  s: SimState,
) {
  // World-space cell size in units; scrolls with boat position.
  const cell = 8;
  const offsetX = ((s.x % cell) + cell) % cell;
  const offsetY = ((s.y % cell) + cell) % cell;
  const startX = -offsetX * scale + (w / 2) % (cell * scale);
  const startY = offsetY * scale + (h / 2) % (cell * scale);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX - cell * scale * 4; x < w + cell * scale * 4; x += cell * scale) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = startY - cell * scale * 4; y < h + cell * scale * 4; y += cell * scale) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Faint wave streaks aligned with the true wind.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((s.params.wind_dir * Math.PI) / 180);
  ctx.strokeStyle = "rgba(207,230,255,0.07)";
  ctx.lineWidth = 1.5;
  const reach = Math.max(w, h);
  for (let y = -reach; y <= reach; y += 36) {
    ctx.beginPath();
    ctx.moveTo(-reach, y);
    ctx.lineTo(reach, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNoGoZone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dpr: number,
  s: SimState,
) {
  const radius = Math.min(cx, cy) * 0.92;
  // The wedge spans from the wind SOURCE direction (in world frame) out to
  // ±no_go_half_angle.
  const windFromWorld = (s.params.wind_dir + 180) % 360;
  // Convert world deg (0 = +y/north, clockwise) to canvas-space radians where
  // 0 rad is +x and angles grow CCW. world 0deg -> -pi/2 in canvas.
  const worldToCanvasRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const half = (s.params.no_go_half_angle * Math.PI) / 180;
  const center = worldToCanvasRad(windFromWorld);
  const start = center - half;
  const end = center + half;

  ctx.save();
  ctx.translate(cx, cy);
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grd.addColorStop(0, "rgba(255, 86, 86, 0.25)");
  grd.addColorStop(1, "rgba(255, 86, 86, 0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 120, 120, 0.4)";
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
  ctx.restore();
}

function drawBoat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dpr: number,
  s: SimState,
) {
  ctx.save();
  ctx.translate(cx, cy);
  // Rotate so boat heading points toward canvas-up. World 0deg = +y/north,
  // canvas-up corresponds to negative y. We rotate the whole boat by heading
  // (clockwise positive in world == clockwise positive in canvas if we treat
  // canvas y-down).
  ctx.rotate((s.params.wind_dir * 0) + (s.heading * Math.PI) / 180);

  const lengthPx = Math.max(28, s.params.boat_size * 4) * dpr;
  const beamPx = lengthPx * 0.32;

  // Hull (pointed forward = -y in local canvas)
  ctx.fillStyle = "#f5efe0";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1.2 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, -lengthPx * 0.55);
  ctx.quadraticCurveTo(beamPx * 0.95, -lengthPx * 0.05, beamPx * 0.7, lengthPx * 0.45);
  ctx.lineTo(-beamPx * 0.7, lengthPx * 0.45);
  ctx.quadraticCurveTo(-beamPx * 0.95, -lengthPx * 0.05, 0, -lengthPx * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cockpit
  ctx.fillStyle = "#0b1f3a";
  ctx.beginPath();
  ctx.ellipse(0, lengthPx * 0.18, beamPx * 0.35, lengthPx * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mast (small dot near middle-front)
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(0, -lengthPx * 0.05, 3 * dpr, 0, Math.PI * 2);
  ctx.fill();

  // Sail - rotated by sail angle relative to boat. Sail "boom" extends aft
  // from the mast to one side or the other.
  const sailRad = (s.sailAngle * Math.PI) / 180;
  const sailLen = lengthPx * 0.55;
  ctx.save();
  ctx.translate(0, -lengthPx * 0.05);
  ctx.rotate(sailRad);
  // Curved sail (a quadratic curve bulging downwind)
  const bellyDir = s.signedTwa >= 0 ? 1 : -1; // wind from starboard -> sail blown to port
  ctx.strokeStyle = "#cdc4ad";
  ctx.fillStyle = "rgba(245, 239, 224, 0.85)";
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(bellyDir * sailLen * 0.25, sailLen * 0.5, 0, sailLen);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Boom
  ctx.strokeStyle = "#3a3a3a";
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, sailLen);
  ctx.stroke();
  ctx.restore();

  // Heading marker (forward fin)
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, -lengthPx * 0.55);
  ctx.lineTo(0, -lengthPx * 0.85);
  ctx.stroke();

  ctx.restore();
}

function drawWindCompass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  s: SimState,
) {
  const r = 56 * dpr;
  const margin = 18 * dpr;
  const cx = w - r - margin;
  const cy = r + margin;

  ctx.save();
  ctx.translate(cx, cy);

  // Background disc
  ctx.fillStyle = "rgba(7, 20, 42, 0.7)";
  ctx.strokeStyle = "rgba(207,230,255,0.25)";
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tick marks
  ctx.strokeStyle = "rgba(207,230,255,0.4)";
  for (let a = 0; a < 360; a += 30) {
    const rad = ((a - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rad) * (r - 6 * dpr), Math.sin(rad) * (r - 6 * dpr));
    ctx.lineTo(Math.cos(rad) * r, Math.sin(rad) * r);
    ctx.stroke();
  }

  // Wind arrow points from source TOWARD the centre - i.e. arrow visualises
  // the direction the wind is BLOWING.
  const windRad = ((s.params.wind_dir - 90) * Math.PI) / 180;
  ctx.save();
  ctx.rotate(windRad);
  ctx.fillStyle = "#5eb1ff";
  ctx.strokeStyle = "#5eb1ff";
  ctx.lineWidth = 3 * dpr;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.7, 0);
  ctx.lineTo(r * 0.5, -8 * dpr);
  ctx.lineTo(r * 0.5, 8 * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label
  ctx.fillStyle = "#cfe6ff";
  ctx.font = `${12 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("WIND", 0, -r - 6 * dpr);
  ctx.fillText(`${s.params.wind_speed.toFixed(0)} kt`, 0, r + 16 * dpr);

  ctx.restore();
}

function drawNorth(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(207,230,255,0.55)";
  ctx.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("N", 14 * dpr, 22 * dpr);
  ctx.strokeStyle = "rgba(207,230,255,0.4)";
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(20 * dpr, 36 * dpr);
  ctx.lineTo(20 * dpr, 56 * dpr);
  ctx.stroke();
  // arrow
  ctx.beginPath();
  ctx.moveTo(20 * dpr, 30 * dpr);
  ctx.lineTo(16 * dpr, 38 * dpr);
  ctx.lineTo(24 * dpr, 38 * dpr);
  ctx.closePath();
  ctx.fillStyle = "rgba(207,230,255,0.6)";
  ctx.fill();
  ctx.restore();
}
