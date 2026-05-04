"use client";

import { useMemo } from "react";
import type { PolarResponse } from "../lib/api";

interface Props {
  polar: PolarResponse | null;
  /** Boat's current unsigned TWA so we can highlight where it sits. */
  currentTwa: number;
  /** Boat's current speed (knots) for context label. */
  currentSpeed: number;
  /** Mark the wind side - +ve = starboard. */
  signedTwa?: number;
}

/**
 * Half-disc polar diagram (0deg up = directly upwind, 180deg down = downwind).
 * The shaded region is the achievable speed at optimal trim. A dot marks
 * where the boat currently is on the curve.
 */
export function PolarChart({ polar, currentTwa, currentSpeed, signedTwa = 0 }: Props) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const radius = size * 0.42;

  const maxSpeed = useMemo(() => {
    if (!polar || polar.points.length === 0) return 1;
    return Math.max(1, ...polar.points.map((p) => p.speed));
  }, [polar]);

  const path = useMemo(() => {
    if (!polar || polar.points.length === 0) return "";
    // Mirror the curve across the centreline so we get a full bowtie.
    const right = polar.points.map((p) => polarToCart(p.twa, p.speed, maxSpeed, cx, cy, radius));
    const left = polar.points
      .slice()
      .reverse()
      .map((p) => polarToCart(-p.twa, p.speed, maxSpeed, cx, cy, radius));
    const all = [...right, ...left];
    return all
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(" ") + " Z";
  }, [polar, maxSpeed, cx, cy, radius]);

  const marker = useMemo(() => {
    if (!polar) return null;
    const sign = signedTwa < 0 ? -1 : 1;
    return polarToCart(currentTwa * sign, currentSpeed, maxSpeed, cx, cy, radius);
  }, [polar, currentTwa, currentSpeed, signedTwa, maxSpeed, cx, cy, radius]);

  // Speed rings (25%, 50%, 75%, 100% of max)
  const rings = [0.25, 0.5, 0.75, 1].map((f) => ({
    r: radius * f,
    label: `${(maxSpeed * f).toFixed(1)} kt`,
  }));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-ocean-foam">
          Polar diagram
        </h3>
        <span className="font-mono text-xs text-ocean-foam/60">
          peak {maxSpeed.toFixed(1)} kt
        </span>
      </div>
      <svg viewBox={`0 0 ${size} ${size + 16}`} className="h-auto w-full">
        {/* Speed rings */}
        {rings.map((ring) => (
          <circle
            key={ring.r}
            cx={cx}
            cy={cy}
            r={ring.r}
            fill="none"
            stroke="rgba(207,230,255,0.18)"
            strokeDasharray="3 3"
          />
        ))}
        {/* TWA spokes every 30deg */}
        {[0, 30, 60, 90, 120, 150, 180].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          const x1 = cx + Math.cos(a) * (radius + 4);
          const y1 = cy + Math.sin(a) * (radius + 4);
          const x2 = cx - Math.cos(a) * (radius + 4);
          const y2 = cy - Math.sin(a) * (radius + 4);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(207,230,255,0.07)"
            />
          );
        })}
        {/* Wind direction marker (arrow at top) */}
        <text
          x={cx}
          y={cy - radius - 10}
          textAnchor="middle"
          className="fill-ocean-foam/70"
          fontSize="10"
        >
          WIND
        </text>
        <text
          x={cx}
          y={cy + radius + 14}
          textAnchor="middle"
          className="fill-ocean-foam/70"
          fontSize="10"
        >
          DOWNWIND
        </text>
        {/* Polar shape */}
        {path && (
          <path
            d={path}
            fill="rgba(94, 177, 255, 0.18)"
            stroke="#5eb1ff"
            strokeWidth={1.5}
          />
        )}
        {/* TWA labels */}
        {[60, 90, 120, 150].map((deg) => {
          const sign = signedTwa < 0 ? -1 : 1;
          const a = ((deg * sign - 90) * Math.PI) / 180;
          const x = cx + Math.cos(a) * (radius + 14);
          const y = cy + Math.sin(a) * (radius + 14);
          return (
            <text
              key={deg}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-ocean-foam/40"
              fontSize="9"
            >
              {deg}°
            </text>
          );
        })}
        {/* Current boat marker */}
        {marker && (
          <g>
            <circle
              cx={marker.x}
              cy={marker.y}
              r={6}
              fill="#ffd76a"
              stroke="#fff"
              strokeWidth={1.5}
            />
            <line
              x1={cx}
              y1={cy}
              x2={marker.x}
              y2={marker.y}
              stroke="#ffd76a"
              strokeWidth={1.2}
              strokeOpacity={0.6}
            />
          </g>
        )}
      </svg>
      <p className="mt-1 text-xs text-ocean-foam/60">
        Dot = your current TWA & speed. Push it toward the bulge.
      </p>
    </div>
  );
}

function polarToCart(
  twaDegSigned: number,
  speed: number,
  maxSpeed: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number } {
  // 0deg TWA = top of the diagram (upwind), positive TWA -> rotate clockwise
  // (starboard side on the right of the chart).
  const angleRad = ((twaDegSigned - 90) * Math.PI) / 180;
  const r = (speed / maxSpeed) * radius;
  return {
    x: cx + Math.cos(angleRad) * r,
    y: cy + Math.sin(angleRad) * r,
  };
}
