"use client";

import type { SimState } from "../lib/simulation";

interface Props {
  state: SimState;
  optimalSailAngle: number;
}

export function Hud({ state, optimalSailAngle }: Props) {
  const trimError = Math.abs(Math.abs(state.sailAngle) - optimalSailAngle);
  const trimQuality = Math.max(0, 1 - trimError / 45);

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm shadow-lg backdrop-blur sm:grid-cols-4">
      <Stat
        label="Boat speed"
        value={`${state.speed.toFixed(1)} kt`}
        accent={state.inNoGo ? "danger" : "primary"}
      />
      <Stat label="Heading" value={`${state.heading.toFixed(0)}°`} />
      <Stat
        label="True wind angle"
        value={`${state.twa.toFixed(0)}° ${state.signedTwa >= 0 ? "S" : "P"}`}
      />
      <Stat
        label="Apparent wind"
        value={`${state.apparentSpeed.toFixed(1)} kt @ ${Math.abs(state.apparentAngle).toFixed(0)}° ${state.apparentAngle >= 0 ? "S" : "P"}`}
      />
      <Stat
        label="Sail angle"
        value={`${state.sailAngle.toFixed(0)}°`}
      />
      <Stat
        label="Optimal sail"
        value={`${optimalSailAngle.toFixed(0)}°`}
      />
      <Stat
        label="Trim quality"
        value={`${(trimQuality * 100).toFixed(0)}%`}
        accent={trimQuality > 0.85 ? "primary" : trimQuality > 0.5 ? "warn" : "danger"}
      />
      <Stat
        label="No-go"
        value={state.inNoGo ? "STALLED" : "clear"}
        accent={state.inNoGo ? "danger" : "muted"}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "muted",
}: {
  label: string;
  value: string;
  accent?: "muted" | "primary" | "warn" | "danger";
}) {
  const color = {
    muted: "text-ocean-foam",
    primary: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-red-400",
  }[accent];
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-ocean-foam/50">
        {label}
      </span>
      <span className={`font-mono text-base ${color}`}>{value}</span>
    </div>
  );
}
