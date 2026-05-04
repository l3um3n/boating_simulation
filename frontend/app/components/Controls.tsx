"use client";

import type { BoatParams } from "../lib/api";

interface Props {
  params: BoatParams;
  setParams: (p: BoatParams) => void;
  heading: number;
  setHeading: (h: number) => void;
  sailAngle: number;
  setSailAngle: (s: number) => void;
  onReset: () => void;
  onAutoTrim: () => void;
}

export function Controls({
  params,
  setParams,
  heading,
  setHeading,
  sailAngle,
  setSailAngle,
  onReset,
  onAutoTrim,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg backdrop-blur">
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-ocean-foam">
          Live controls
        </h3>
        <Slider
          label="Heading"
          unit="°"
          min={0}
          max={359}
          step={1}
          value={heading}
          onChange={setHeading}
          hint="A / D to turn"
        />
        <Slider
          label="Sail angle"
          unit="°"
          min={-90}
          max={90}
          step={1}
          value={sailAngle}
          onChange={setSailAngle}
          hint="Q / E to trim"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={onAutoTrim}
            className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/20"
          >
            Auto-trim sail
          </button>
          <button
            onClick={onReset}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-ocean-foam/80 transition hover:bg-white/10"
          >
            Reset position
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-ocean-foam">
          Conditions
        </h3>
        <Slider
          label="Wind speed"
          unit="kt"
          min={0}
          max={40}
          step={1}
          value={params.wind_speed}
          onChange={(v) => setParams({ ...params, wind_speed: v })}
        />
        <Slider
          label="Wind direction"
          unit="°"
          min={0}
          max={359}
          step={1}
          value={params.wind_dir}
          onChange={(v) => setParams({ ...params, wind_dir: v })}
        />
        <Slider
          label="Sail size"
          unit="m²"
          min={5}
          max={80}
          step={1}
          value={params.sail_size}
          onChange={(v) => setParams({ ...params, sail_size: v })}
        />
        <Slider
          label="Boat size"
          unit="m"
          min={3}
          max={25}
          step={0.5}
          value={params.boat_size}
          onChange={(v) => setParams({ ...params, boat_size: v })}
        />
        <Slider
          label="No-go half-angle"
          unit="°"
          min={20}
          max={70}
          step={1}
          value={params.no_go_half_angle}
          onChange={(v) => setParams({ ...params, no_go_half_angle: v })}
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
  hint,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="mb-3 block">
      <div className="mb-1 flex items-baseline justify-between text-xs text-ocean-foam/70">
        <span>
          {label}
          {hint && (
            <span className="ml-2 text-[10px] text-ocean-foam/40">{hint}</span>
          )}
        </span>
        <span className="font-mono text-ocean-foam">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
