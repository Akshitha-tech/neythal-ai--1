"""Unit tests for the data pipeline helpers (standard library only).

Run: python3 -m unittest discover -s scripts/data -p "test_*.py"
"""

from __future__ import annotations

import array
import math
import unittest

from _common import (
    NM_M,
    cpa_tcpa,
    distance_to_lines_m,
    distance_to_segment_m,
    haversine_m,
    point_in_polygon,
    segments_cross,
    simplify,
)
from bathymetry import Bathymetry
from fetch_boundaries import TREATY_SEGMENTS, clip_line, clip_ring, dm_to_degrees, great_circle_points
from fetch_ocean_weather import beaufort, sea_state_code
from fetch_osm import assemble_rings
from fetch_weather_stations import decode


class Geometry(unittest.TestCase):
    def test_haversine_one_degree_latitude(self):
        self.assertAlmostEqual(haversine_m(79.0, 9.0, 79.0, 10.0) / 1000, 111.19, delta=0.05)

    def test_distance_to_segment_perpendicular_and_endpoint(self):
        a, b = (79.0, 9.0), (79.0, 10.0)
        east = haversine_m(79.0, 9.5, 79.1, 9.5)
        self.assertAlmostEqual(distance_to_segment_m(79.1, 9.5, a, b), east, delta=east * 0.005)
        self.assertAlmostEqual(distance_to_segment_m(79.0, 10.5, a, b), haversine_m(79, 10, 79, 10.5), delta=100)

    def test_distance_to_lines_takes_minimum(self):
        lines = [[(79.0, 9.0), (79.0, 10.0)], [(80.0, 9.0), (80.0, 10.0)]]
        self.assertLess(distance_to_lines_m(79.9, 9.5, lines), distance_to_lines_m(79.2, 9.5, lines) / 2)

    def test_point_in_polygon_with_hole(self):
        outer = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
        hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
        self.assertTrue(point_in_polygon(2, 2, [outer, hole]))
        self.assertFalse(point_in_polygon(5, 5, [outer, hole]))
        self.assertFalse(point_in_polygon(11, 5, [outer, hole]))

    def test_segments_cross(self):
        self.assertTrue(segments_cross((0, 0), (2, 2), (0, 2), (2, 0)))
        self.assertFalse(segments_cross((0, 0), (1, 1), (2, 0), (3, 1)))

    def test_cpa_head_on(self):
        # Two vessels 2 NM apart, closing head-on at 10 kn each.
        cpa, tcpa = cpa_tcpa((0, 0, 10, 0), (0, 2 * NM_M, 10, 180))
        self.assertAlmostEqual(cpa, 0, delta=1)
        self.assertAlmostEqual(tcpa, 6 * 60, delta=1)

    def test_cpa_diverging_is_in_the_past(self):
        _, tcpa = cpa_tcpa((0, 0, 10, 180), (0, NM_M, 10, 0))
        self.assertLess(tcpa, 0)

    def test_simplify_drops_collinear_points(self):
        line = [[79.0 + i * 0.01, 9.0] for i in range(20)]
        self.assertEqual(len(simplify(line, 10)), 2)


class Boundaries(unittest.TestCase):
    def test_degree_minute_parsing(self):
        self.assertAlmostEqual(dm_to_degrees("09 40.15"), 9 + 40.15 / 60)
        self.assertAlmostEqual(dm_to_degrees("80 03"), 80.05)

    def test_treaty_has_six_palk_strait_positions(self):
        palk = next(s for s in TREATY_SEGMENTS if s["id"] == "palk-strait-1974")
        self.assertEqual([p[0] for p in palk["positions"]], ["1", "2", "3", "4", "5", "6"])

    def test_segments_join_end_to_end(self):
        def point(position):
            return dm_to_degrees(position[1]), dm_to_degrees(position[2])

        by_id = {s["id"]: s["positions"] for s in TREATY_SEGMENTS}
        self.assertEqual(point(by_id["palk-strait-1974"][-1]), point(by_id["gulf-of-mannar-1976"][0]))
        self.assertEqual(point(by_id["palk-strait-1974"][0]), point(by_id["bay-of-bengal-1976"][0]))
        self.assertEqual(point(by_id["gulf-of-mannar-1976"][-1]), point(by_id["gulf-of-mannar-extension-1976"][0]))

    def test_great_circle_keeps_endpoints(self):
        points = great_circle_points((79.5833, 9.95), (79.3767, 9.6692), 500)
        self.assertEqual(points[0], [79.5833, 9.95])
        self.assertAlmostEqual(points[-1][0], 79.3767, places=5)
        self.assertGreater(len(points), 60)

    def test_clip_ring_to_box(self):
        ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
        clipped = clip_ring(ring, (2, 2, 5, 5))
        xs = {p[0] for p in clipped}
        self.assertEqual(min(xs), 2)
        self.assertEqual(max(xs), 5)

    def test_clip_line_splits_at_box(self):
        parts = clip_line([[0, 1], [3, 1], [6, 1]], (1, 0, 4, 2))
        self.assertEqual(parts, [[[1.0, 1.0], [3, 1], [4.0, 1.0]]])


class Scales(unittest.TestCase):
    def test_beaufort_boundaries(self):
        self.assertEqual(beaufort(0.4), 0)
        self.assertEqual(beaufort(3), 1)
        self.assertEqual(beaufort(21), 5)
        self.assertEqual(beaufort(22), 6)
        self.assertEqual(beaufort(64), 12)

    def test_sea_state_code(self):
        self.assertEqual(sea_state_code(0), 0)
        self.assertEqual(sea_state_code(0.05), 1)
        self.assertEqual(sea_state_code(1.25), 3)
        self.assertEqual(sea_state_code(2.6), 5)
        self.assertEqual(sea_state_code(15), 9)


class Osm(unittest.TestCase):
    def test_assemble_rings_handles_reversed_ways(self):
        ways = [[[0, 0], [1, 0]], [[1, 1], [1, 0]], [[1, 1], [0, 1], [0, 0]]]
        rings = assemble_rings(ways)
        self.assertEqual(len(rings), 1)
        self.assertEqual(rings[0][0], rings[0][-1])
        self.assertEqual(len(rings[0]), 5)


class StationDecoding(unittest.TestCase):
    def test_decode_isd_fields(self):
        row = decode(
            {
                "WND": "250,1,N,0062,1", "VIS": "008000,1,9,9", "TMP": "+0285,1", "DEW": "+0241,1",
                "SLP": "10088,1", "AA1": "03,0012,9,1", "OC1": "0110,1", "MW1": "95,1",
            }
        )
        self.assertEqual(row["wind_direction_deg"], 250)
        self.assertAlmostEqual(row["wind_speed_ms"], 6.2)
        self.assertEqual(row["beaufort"], 4)
        self.assertEqual(row["visibility_m"], 8000)
        self.assertEqual(row["fog"], 0)
        self.assertAlmostEqual(row["air_temperature_c"], 28.5)
        self.assertAlmostEqual(row["sea_level_pressure_hpa"], 1008.8)
        self.assertAlmostEqual(row["precip_mm"], 1.2)
        self.assertEqual(row["thunderstorm"], 1)

    def test_decode_missing_and_suspect_values(self):
        row = decode({"WND": "999,9,C,0000,1", "VIS": "999999,9,9,9", "TMP": "+0285,3"})
        self.assertIsNone(row["wind_direction_deg"])
        self.assertEqual(row["wind_speed_ms"], 0.0)
        self.assertIsNone(row["visibility_m"])
        self.assertIsNone(row["air_temperature_c"])


class BathymetryLookup(unittest.TestCase):
    def test_nearest_cell_and_depth(self):
        header = {"rows": 2, "cols": 2, "northLat": 10.0, "westLon": 79.0, "stepDeg": 0.5}
        grid = array.array("h", [-10, 5, -20, -3])
        b = Bathymetry(header, grid)
        self.assertEqual(b.elevation(79.0, 10.0), -10)
        self.assertEqual(b.elevation(79.5, 9.5), -3)
        self.assertEqual(b.depth(79.5, 10.0), 0.0)
        self.assertTrue(b.is_water(79.0, 9.5, min_depth_m=15))
        self.assertIsNone(b.elevation(81.0, 9.5))


if __name__ == "__main__":
    unittest.main()
