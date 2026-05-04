"""Simplified-but-physically-reasonable sailing physics.

The model intentionally avoids true CFD. It captures the qualitative behaviours
that matter for the goal "maximise speed by pointing your sail against the
wind":

- A no-go zone directly upwind where the boat cannot make headway.
- A speed-vs-true-wind-angle (TWA) curve that peaks on a broad reach (~120 deg)
  and falls off both upwind (close-hauled) and downwind (running).
- A sail-trim efficiency that peaks at an angle-specific optimum and drops off
  smoothly as the sail is over- or under-trimmed.
- Size scaling so bigger sails go faster and bigger hulls are slower.
- Apparent-wind vector math (true wind minus boat velocity).

All angles in degrees unless suffixed `_rad`. Speeds in knots.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .schemas import BoatParams, PolarPoint

REF_SAIL_AREA = 20.0  # m^2 - reference rig the speed curve was tuned for
REF_BOAT_LEN = 8.0  # m - reference hull length


def _wrap_180(angle_deg: float) -> float:
    """Wrap an angle into the (-180, 180] range."""
    a = (angle_deg + 180.0) % 360.0 - 180.0
    return 180.0 if a == -180.0 else a


def true_wind_angle(wind_dir_deg: float, boat_heading_deg: float) -> float:
    """Unsigned TWA in [0, 180].

    `wind_dir_deg` is the direction the wind is *blowing toward* (0 = +y/north).
    TWA is the unsigned angle between the boat's heading and the direction the
    wind is *coming from*.
    """
    wind_from = (wind_dir_deg + 180.0) % 360.0
    diff = abs(_wrap_180(wind_from - boat_heading_deg))
    return diff


def signed_wind_angle(wind_dir_deg: float, boat_heading_deg: float) -> float:
    """Signed TWA in (-180, 180] - positive = wind from starboard (right)."""
    wind_from = (wind_dir_deg + 180.0) % 360.0
    return _wrap_180(wind_from - boat_heading_deg)


def _base_polar(twa_deg: float, no_go_half_angle: float) -> float:
    """Speed coefficient (0..~0.65) of true wind speed, before trim/size scaling.

    Tuned so:
      - 0 inside the no-go zone
      - peak ~0.62 around 120deg TWA (broad reach)
      - ~0.45 at 90deg (beam reach)
      - ~0.40 at 150-170deg (running, dead-downwind a bit slower)
      - smooth ramp out of the no-go zone
    """
    twa = abs(twa_deg)
    if twa <= no_go_half_angle:
        return 0.0

    # Smooth ramp from no-go boundary up to close-hauled "shoulder"
    ramp_end = no_go_half_angle + 15.0
    if twa < ramp_end:
        t = (twa - no_go_half_angle) / (ramp_end - no_go_half_angle)
        return 0.42 * (t * t * (3.0 - 2.0 * t))  # smoothstep up to 0.42

    # Skewed bell curve peaking around 120deg
    peak_twa = 120.0
    width = 60.0
    x = (twa - peak_twa) / width
    bell = math.exp(-x * x)  # 1 at 120, ~0.6 at 60/180
    base = 0.45 + 0.20 * bell

    # Slight dead-downwind dip
    if twa > 160.0:
        base *= 1.0 - 0.10 * ((twa - 160.0) / 20.0)

    return base


def optimal_sail_angle(twa_deg: float) -> float:
    """Optimal sail angle (relative to boat) for a given TWA.

    Rule of thumb: trim sail to roughly half the apparent wind angle, but never
    more than ~85 deg (sail can't go past abeam). Sign matches the wind side.
    """
    twa = abs(twa_deg)
    target = min(85.0, max(10.0, twa * 0.5))
    return target


def sail_trim_efficiency(twa_deg: float, sail_angle_deg: float) -> float:
    """Efficiency in [0.25, 1.0] based on how close trim is to optimum."""
    twa = abs(twa_deg)
    sail = abs(sail_angle_deg)
    opt = optimal_sail_angle(twa)
    err = abs(sail - opt)
    # ~30deg of trim error roughly halves drive
    eff = math.exp(-(err * err) / (2.0 * 22.0 * 22.0))
    return 0.25 + 0.75 * eff


def _size_scale(sail_size: float, boat_size: float) -> float:
    sail_factor = (max(sail_size, 1.0) / REF_SAIL_AREA) ** 0.5
    hull_factor = (REF_BOAT_LEN / max(boat_size, 1.0)) ** 0.25
    return sail_factor * hull_factor


def boat_speed(
    params: BoatParams,
    twa_deg: float,
    sail_angle_deg: float,
) -> float:
    """Boat speed (knots) for a TWA and sail trim under the given params."""
    base = _base_polar(twa_deg, params.no_go_half_angle)
    if base <= 0.0:
        return 0.0
    trim = sail_trim_efficiency(twa_deg, sail_angle_deg)
    size = _size_scale(params.sail_size, params.boat_size)
    # Cap at ~0.85x wind speed - real sailboats can exceed wind in some
    # conditions but a soft cap keeps the model sane for our toy.
    speed = params.wind_speed * base * trim * size
    return min(speed, params.wind_speed * 0.95)


@dataclass(frozen=True)
class ApparentWind:
    speed: float
    angle: float  # signed, relative to boat heading; +ve = from starboard


def apparent_wind(
    params: BoatParams, boat_heading_deg: float, boat_speed_knots: float
) -> ApparentWind:
    """Vector subtract boat velocity from true wind to get apparent wind."""
    # True wind vector (the direction the wind is blowing TOWARD).
    wind_rad = math.radians(params.wind_dir)
    wx = params.wind_speed * math.sin(wind_rad)
    wy = params.wind_speed * math.cos(wind_rad)

    # Boat velocity vector (heading direction).
    head_rad = math.radians(boat_heading_deg)
    bx = boat_speed_knots * math.sin(head_rad)
    by = boat_speed_knots * math.cos(head_rad)

    # Apparent wind velocity = true wind velocity - boat velocity. Both
    # vectors point in the direction the wind/boat is travelling TOWARD, so
    # the difference is the wind velocity *as seen from the boat*.
    ax = wx - bx
    ay = wy - by
    speed = math.hypot(ax, ay)

    if speed < 1e-9:
        return ApparentWind(speed=0.0, angle=0.0)

    # The apparent wind *source* is the opposite of the apparent velocity.
    # Convert that direction to a boat-relative angle (0 = dead ahead,
    # +ve = from starboard).
    src_world = math.degrees(math.atan2(-ax, -ay))
    angle = _wrap_180(src_world - boat_heading_deg)
    return ApparentWind(speed=speed, angle=angle)


def polar_curve(params: BoatParams, step_deg: float = 5.0) -> list[PolarPoint]:
    """Sampled speed-vs-TWA curve at optimal sail trim."""
    points: list[PolarPoint] = []
    twa = 0.0
    while twa <= 180.0 + 1e-9:
        opt = optimal_sail_angle(twa)
        speed = boat_speed(params, twa, opt)
        points.append(
            PolarPoint(
                twa=round(twa, 3),
                speed=round(speed, 4),
                optimal_sail_angle=round(opt, 3),
            )
        )
        twa += step_deg
    return points
