"""Pydantic schemas for the sailing simulator API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BoatParams(BaseModel):
    """Static-ish parameters describing the boat and its environment."""

    wind_speed: float = Field(
        12.0, ge=0.0, le=80.0, description="True wind speed in knots."
    )
    wind_dir: float = Field(
        0.0,
        ge=0.0,
        lt=360.0,
        description="True wind direction in degrees (0 = wind blowing toward +y / 'north').",
    )
    sail_size: float = Field(
        20.0, ge=1.0, le=200.0, description="Sail area in square meters."
    )
    boat_size: float = Field(
        8.0, ge=2.0, le=50.0, description="Boat length in meters."
    )
    no_go_half_angle: float = Field(
        40.0,
        ge=10.0,
        le=80.0,
        description="Half-angle of the no-sail zone (degrees from directly upwind).",
    )


class PolarPoint(BaseModel):
    twa: float = Field(..., description="True wind angle in degrees (0..180).")
    speed: float = Field(..., description="Boat speed in knots at optimal sail trim.")
    optimal_sail_angle: float = Field(
        ..., description="Sail angle relative to boat heading that maximises speed."
    )


class PolarResponse(BaseModel):
    params: BoatParams
    points: list[PolarPoint]


class StepRequest(BaseModel):
    params: BoatParams
    boat_heading: float = Field(
        ..., ge=0.0, lt=360.0, description="Boat heading in degrees."
    )
    sail_angle: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Sail angle relative to boat centreline (degrees, signed).",
    )


class StepResponse(BaseModel):
    twa: float = Field(..., description="True wind angle relative to the boat (deg).")
    boat_speed: float = Field(..., description="Resulting boat speed in knots.")
    optimal_sail_angle: float = Field(
        ..., description="Optimal sail angle for this TWA."
    )
    apparent_wind_speed: float = Field(..., description="Apparent wind speed (knots).")
    apparent_wind_angle: float = Field(
        ...,
        description="Apparent wind angle relative to boat heading (deg, signed).",
    )
    in_no_go_zone: bool


class SimulateRequest(BaseModel):
    params: BoatParams
    initial_heading: float = Field(90.0, ge=0.0, lt=360.0)
    initial_sail_angle: float = Field(30.0, ge=-90.0, le=90.0)
    ticks: int = Field(120, ge=1, le=10_000)
    dt: float = Field(0.1, gt=0.0, le=1.0, description="Seconds per tick.")


class SimulateFrame(BaseModel):
    t: float
    x: float
    y: float
    heading: float
    speed: float


class SimulateResponse(BaseModel):
    frames: list[SimulateFrame]
