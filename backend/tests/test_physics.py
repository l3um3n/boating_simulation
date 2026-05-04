"""Sanity tests for the sailing physics model."""

from __future__ import annotations

import math

import pytest

from app import physics
from app.schemas import BoatParams


def _params(**overrides) -> BoatParams:
    base = dict(
        wind_speed=12.0,
        wind_dir=0.0,
        sail_size=20.0,
        boat_size=8.0,
        no_go_half_angle=40.0,
    )
    base.update(overrides)
    return BoatParams(**base)


class TestTrueWindAngle:
    def test_pointing_into_wind_is_zero(self) -> None:
        # Wind blowing toward 0deg means it comes FROM 180deg. Heading 180deg
        # points into the wind -> TWA == 0.
        assert physics.true_wind_angle(0.0, 180.0) == pytest.approx(0.0)

    def test_pointing_with_wind_is_180(self) -> None:
        # Sailing in the same direction the wind is going -> TWA = 180 (dead
        # downwind).
        assert physics.true_wind_angle(0.0, 0.0) == pytest.approx(180.0)

    def test_beam_reach_is_90(self) -> None:
        assert physics.true_wind_angle(0.0, 90.0) == pytest.approx(90.0)
        assert physics.true_wind_angle(0.0, 270.0) == pytest.approx(90.0)


class TestNoGoZone:
    def test_inside_no_go_returns_zero(self) -> None:
        p = _params(no_go_half_angle=40.0)
        assert physics.boat_speed(p, twa_deg=0.0, sail_angle_deg=20.0) == 0.0
        assert physics.boat_speed(p, twa_deg=20.0, sail_angle_deg=20.0) == 0.0
        assert physics.boat_speed(p, twa_deg=39.0, sail_angle_deg=20.0) == 0.0

    def test_just_outside_no_go_is_small_but_positive(self) -> None:
        p = _params(no_go_half_angle=40.0)
        s = physics.boat_speed(p, twa_deg=46.0, sail_angle_deg=23.0)
        assert s > 0.0
        # Should still be modest compared to a broad reach.
        broad = physics.boat_speed(p, twa_deg=120.0, sail_angle_deg=60.0)
        assert s < broad


class TestPolarShape:
    def test_broad_reach_is_fastest(self) -> None:
        p = _params()
        speeds = {
            twa: physics.boat_speed(p, twa, physics.optimal_sail_angle(twa))
            for twa in (50, 70, 90, 110, 120, 130, 150, 170)
        }
        assert max(speeds, key=speeds.get) in (110, 120, 130)

    def test_optimal_trim_beats_bad_trim(self) -> None:
        p = _params()
        twa = 90.0
        good = physics.boat_speed(p, twa, physics.optimal_sail_angle(twa))
        bad = physics.boat_speed(p, twa, sail_angle_deg=0.0)
        worse = physics.boat_speed(p, twa, sail_angle_deg=85.0)
        assert good > bad
        assert good > worse

    def test_more_wind_means_more_speed(self) -> None:
        slow = physics.boat_speed(_params(wind_speed=5.0), 120.0, 60.0)
        fast = physics.boat_speed(_params(wind_speed=20.0), 120.0, 60.0)
        assert fast > slow

    def test_bigger_sail_is_faster(self) -> None:
        small = physics.boat_speed(_params(sail_size=10.0), 120.0, 60.0)
        big = physics.boat_speed(_params(sail_size=40.0), 120.0, 60.0)
        assert big > small

    def test_bigger_hull_is_slower(self) -> None:
        light = physics.boat_speed(_params(boat_size=6.0), 120.0, 60.0)
        heavy = physics.boat_speed(_params(boat_size=20.0), 120.0, 60.0)
        assert heavy < light


class TestPolarCurve:
    def test_polar_covers_zero_to_180(self) -> None:
        pts = physics.polar_curve(_params(), step_deg=5.0)
        assert pts[0].twa == 0.0
        assert pts[-1].twa == 180.0
        # No-go points should report 0.
        assert pts[0].speed == 0.0


class TestApparentWind:
    def test_no_motion_apparent_equals_true(self) -> None:
        p = _params(wind_speed=10.0, wind_dir=0.0)
        aw = physics.apparent_wind(p, boat_heading_deg=180.0, boat_speed_knots=0.0)
        # Boat pointing into wind, not moving -> apparent wind comes straight
        # at the bow.
        assert aw.speed == pytest.approx(10.0, abs=1e-6)
        assert abs(aw.angle) == pytest.approx(0.0, abs=1e-6)

    def test_moving_into_wind_increases_apparent(self) -> None:
        p = _params(wind_speed=10.0, wind_dir=0.0)
        still = physics.apparent_wind(p, boat_heading_deg=180.0, boat_speed_knots=0.0)
        moving = physics.apparent_wind(p, boat_heading_deg=180.0, boat_speed_knots=4.0)
        assert moving.speed > still.speed
        assert moving.speed == pytest.approx(14.0, abs=1e-6)

    def test_moving_with_wind_decreases_apparent(self) -> None:
        p = _params(wind_speed=10.0, wind_dir=0.0)
        # Heading 0 = sailing in the same direction the wind is blowing toward.
        moving = physics.apparent_wind(p, boat_heading_deg=0.0, boat_speed_knots=4.0)
        assert moving.speed == pytest.approx(6.0, abs=1e-6)

    def test_beam_reach_apparent_shifts_forward(self) -> None:
        p = _params(wind_speed=10.0, wind_dir=0.0)
        # Heading 90 (east), wind blowing toward 0 (north) - from south. So on
        # this heading, true wind is on the starboard quarter (TWA ~90 from
        # behind). Apparent should pull forward as the boat speeds up.
        slow = physics.apparent_wind(p, boat_heading_deg=90.0, boat_speed_knots=0.5)
        fast = physics.apparent_wind(p, boat_heading_deg=90.0, boat_speed_knots=6.0)
        # Apparent angle (signed) should have smaller magnitude when moving
        # faster (wind appears more from ahead).
        assert abs(fast.angle) < abs(slow.angle) or math.isclose(
            abs(fast.angle), abs(slow.angle), abs_tol=1e-3
        )
