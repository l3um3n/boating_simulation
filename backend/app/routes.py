"""HTTP routes for the boating simulator."""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query

from . import physics
from .schemas import (
    BoatParams,
    PolarResponse,
    SimulateFrame,
    SimulateRequest,
    SimulateResponse,
    StepRequest,
    StepResponse,
)

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _params_from_query(
    wind_speed: float = Query(12.0, ge=0.0, le=80.0),
    wind_dir: float = Query(0.0, ge=0.0, lt=360.0),
    sail_size: float = Query(20.0, ge=1.0, le=200.0),
    boat_size: float = Query(8.0, ge=2.0, le=50.0),
    no_go_half_angle: float = Query(40.0, ge=10.0, le=80.0),
) -> BoatParams:
    return BoatParams(
        wind_speed=wind_speed,
        wind_dir=wind_dir,
        sail_size=sail_size,
        boat_size=boat_size,
        no_go_half_angle=no_go_half_angle,
    )


@router.get("/polar", response_model=PolarResponse)
def polar(
    params: BoatParams = Depends(_params_from_query),
    step: float = Query(5.0, ge=1.0, le=30.0, description="TWA sampling step (deg)."),
) -> PolarResponse:
    """Return a sampled polar diagram at optimal sail trim.

    Frontend caches this and re-fetches when wind/sail/boat sliders change.
    """
    points = physics.polar_curve(params, step_deg=step)
    return PolarResponse(params=params, points=points)


@router.post("/step", response_model=StepResponse)
def step(req: StepRequest) -> StepResponse:
    """Single-tick physics evaluation for HUD readouts."""
    twa = physics.true_wind_angle(req.params.wind_dir, req.boat_heading)
    speed = physics.boat_speed(req.params, twa, req.sail_angle)
    aw = physics.apparent_wind(req.params, req.boat_heading, speed)
    return StepResponse(
        twa=twa,
        boat_speed=speed,
        optimal_sail_angle=physics.optimal_sail_angle(twa),
        apparent_wind_speed=aw.speed,
        apparent_wind_angle=aw.angle,
        in_no_go_zone=twa <= req.params.no_go_half_angle,
    )


@router.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest) -> SimulateResponse:
    """Run a fixed-heading, fixed-trim simulation server-side.

    Useful for batch experiments and a future replay feature; the live UI runs
    its own loop locally.
    """
    frames: list[SimulateFrame] = []
    x, y = 0.0, 0.0
    heading = req.initial_heading
    sail = req.initial_sail_angle
    # Convert knots to "world units per second" - we treat 1 knot = 1 unit/s for
    # the simulator. The frontend can rescale for display.
    for i in range(req.ticks):
        twa = physics.true_wind_angle(req.params.wind_dir, heading)
        speed = physics.boat_speed(req.params, twa, sail)
        head_rad = math.radians(heading)
        x += speed * math.sin(head_rad) * req.dt
        y += speed * math.cos(head_rad) * req.dt
        frames.append(
            SimulateFrame(
                t=round(i * req.dt, 4),
                x=round(x, 4),
                y=round(y, 4),
                heading=round(heading, 3),
                speed=round(speed, 4),
            )
        )
    return SimulateResponse(frames=frames)
