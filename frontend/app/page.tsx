"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { Hud } from "./components/Hud";
import { OceanCanvas } from "./components/OceanCanvas";
import { PolarChart } from "./components/PolarChart";
import {
  type BoatParams,
  type PolarResponse,
  fetchPolar,
} from "./lib/api";
import {
  DEFAULT_PARAMS,
  type SimState,
  interpolatePolar,
  makeInitialState,
  stepSimulation,
  wrap360,
} from "./lib/simulation";

export default function Page() {
  const [params, setParams] = useState<BoatParams>(DEFAULT_PARAMS);
  const [state, setState] = useState<SimState>(() => makeInitialState(DEFAULT_PARAMS));
  const stateRef = useRef(state);
  stateRef.current = state;

  const [polar, setPolar] = useState<PolarResponse | null>(null);
  const [polarError, setPolarError] = useState<string | null>(null);

  // Refetch polar whenever the wind/sail/boat parameters change. We debounce
  // lightly so dragging a slider doesn't spam the backend.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchPolar(params, 5, ctrl.signal)
        .then((p) => {
          setPolar(p);
          setPolarError(null);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setPolarError(
            "Backend unreachable. Start it with `uvicorn app.main:app --reload --port 8000` in /backend.",
          );
        });
    }, 120);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [params]);

  // Keep params in sync inside the live state (so the animation loop uses
  // the latest values without restarting).
  useEffect(() => {
    setState((prev) => ({ ...prev, params }));
  }, [params]);

  // requestAnimationFrame loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setState((prev) => stepSimulation({ state: prev, polar, dt }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [polar]);

  // Keyboard controls: A/D to turn, Q/E to trim sail, R to reset.
  useEffect(() => {
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const turnRate = 70; // deg / sec
      const trimRate = 50; // deg / sec
      setState((prev) => {
        let { heading, sailAngle } = prev;
        if (keys.has("a") || keys.has("arrowleft")) heading = wrap360(heading - turnRate * dt);
        if (keys.has("d") || keys.has("arrowright")) heading = wrap360(heading + turnRate * dt);
        if (keys.has("q")) sailAngle = clamp(sailAngle - trimRate * dt, -90, 90);
        if (keys.has("e")) sailAngle = clamp(sailAngle + trimRate * dt, -90, 90);
        return { ...prev, heading, sailAngle };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const setHeading = useCallback((h: number) => {
    setState((prev) => ({ ...prev, heading: wrap360(h) }));
  }, []);
  const setSailAngle = useCallback((s: number) => {
    setState((prev) => ({ ...prev, sailAngle: clamp(s, -90, 90) }));
  }, []);
  const onReset = useCallback(() => {
    setState((prev) => ({ ...prev, x: 0, y: 0, trail: [] }));
  }, []);

  const optimalSailAngle = useMemo(() => {
    return interpolatePolar(polar, state.twa).optimalSailAngle;
  }, [polar, state.twa]);

  const onAutoTrim = useCallback(() => {
    setState((prev) => {
      const opt = interpolatePolar(polar, prev.twa).optimalSailAngle;
      const sign = prev.signedTwa >= 0 ? 1 : -1;
      return { ...prev, sailAngle: opt * sign };
    });
  }, [polar]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ocean-foam">
            Boating Simulator
          </h1>
          <p className="text-sm text-ocean-foam/60">
            Find the broad reach. Trim the sail. Don&apos;t stall in the no-go zone.
          </p>
        </div>
        {polarError && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {polarError}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="aspect-[16/10] w-full">
            <OceanCanvas state={state} />
          </div>
          <Hud state={state} optimalSailAngle={optimalSailAngle} />
        </div>
        <div className="flex flex-col gap-4">
          <Controls
            params={params}
            setParams={setParams}
            heading={state.heading}
            setHeading={setHeading}
            sailAngle={state.sailAngle}
            setSailAngle={setSailAngle}
            onReset={onReset}
            onAutoTrim={onAutoTrim}
          />
          <PolarChart
            polar={polar}
            currentTwa={state.twa}
            currentSpeed={state.speed}
            signedTwa={state.signedTwa}
          />
        </div>
      </div>
    </main>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
