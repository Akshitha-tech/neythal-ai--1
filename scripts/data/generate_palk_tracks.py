"""Simulated AIS-format fishing trips in Palk Bay / Gulf of Mannar with risk labels.

Why simulated: there is no open AIS archive for Indian waters (Global Fishing
Watch needs an account and API token). Everything that can be real is real:
- motion: speed and turn-rate sequences replayed from real NOAA fishing-vessel
  tracks (fishing_motion_stats.json), not hand-made curves
- departures: Indian-side harbours and jetties mapped in OpenStreetMap
- water: every fix is on water at least MIN_DEPTH_M deep in ETOPO 2022
- boundary: the treaty IMBL (imbl.geojson)
- weather/sea state: the real hourly series at the nearest sample point
Labels are computed from geometry, never assigned by hand.

Sampling design choices (not facts about the fleet; change them here):
- TARGET_NEAR_IMBL_SHARE of trips aim for grounds 0.5-6 NM from the IMBL so the
  rare "about to cross" class has enough examples
- trips go at most MAX_RANGE_NM from the home harbour
- departure times are uniform over 2023-2025 (UTC)

Every row is marked source=SIMULATED. Use it for model development and demos,
never as a record of real vessel movements.

Output: data/processed/synthetic/palk_strait_tracks_1min.csv.gz (+ summary.json)
Usage:  python3 scripts/data/generate_palk_tracks.py [--trips N]
"""

from __future__ import annotations

import argparse
import csv
import gzip
import math
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from _common import (
    APP_DATA,
    NM_M,
    PROCESSED,
    REGION,
    distance_to_lines_m,
    from_local_m,
    haversine_m,
    log,
    point_in_geometry,
    read_json,
    segments_cross,
    to_local_m,
    write_json,
)
from bathymetry import Bathymetry

SEED = 2026
N_VESSELS = 120
N_TRIPS = 450
TARGET_NEAR_IMBL_SHARE = 0.35
NEAR_IMBL_BAND_NM = (0.5, 6.0)
MAX_RANGE_NM = 30.0
MIN_DEPTH_M = 1.5
TARGET_MIN_DEPTH_M = 3.0
ARRIVAL_NM = 0.3
MAX_TRIP_MIN = 48 * 60
CROSSING_HORIZONS_MIN = (10, 20, 30)
HAZARD_RANGE_NM = 2.0
HAZARD_CATEGORIES = {"reef", "shoal", "sandbar", "wreck", "rock", "obstruction", "island", "islet", "offshore_platform"}
REFERENCE_INDIA = (78.12, 9.93)  # Madurai, well inland on the Indian side
START = datetime(2023, 1, 1, tzinfo=timezone.utc)
END = datetime(2025, 12, 29, tzinfo=timezone.utc)

WEATHER_COLUMNS = [
    "wave_height_m", "sea_state_code", "wind_speed_10m_kn", "beaufort", "wind_gusts_10m_kmh",
    "visibility_m", "current_speed_ms", "sea_surface_temperature_c", "precipitation_mm",
]

OUT = PROCESSED / "synthetic"


# ------------------------------------------------------------ geometry helpers


def imbl_lines():
    """Straight segments between treaty positions (great-circle bow < 10 m here)."""
    collection = read_json(APP_DATA / "imbl.geojson")
    return [[[p["longitude"], p["latitude"]] for p in f["properties"]["positions"]] for f in collection["features"]]


def crossings(a, b, lines) -> int:
    return sum(segments_cross(a, b, q1, q2) for line in lines for q1, q2 in zip(line, line[1:]))


def indian_side(lon, lat, lines) -> bool:
    return crossings(REFERENCE_INDIA, (lon, lat), lines) % 2 == 0


def bearing_deg(lon1, lat1, lon2, lat2) -> float:
    east, north = to_local_m(lon2, lat2, lon1, lat1)
    return math.degrees(math.atan2(east, north)) % 360


def step(lon, lat, heading, sog_kn, seconds=60):
    """Next position, rounded to the 5 decimals written out so the depth check
    sees exactly the stored coordinates."""
    distance = sog_kn * NM_M / 3600 * seconds
    nlon, nlat = from_local_m(distance * math.sin(math.radians(heading)), distance * math.cos(math.radians(heading)), lon, lat)
    return round(nlon, 5), round(nlat, 5)


def angle_diff(a, b) -> float:
    return (b - a + 540) % 360 - 180


class HazardIndex:
    def __init__(self, features, cell=0.02):
        self.cell = cell
        self.grid = defaultdict(list)
        for feature in features:
            if feature["properties"]["category"] not in HAZARD_CATEGORIES:
                continue
            stack = [feature["geometry"]["coordinates"]]
            while stack:
                item = stack.pop()
                if item and isinstance(item[0], (int, float)):
                    self.grid[(int(item[1] // cell), int(item[0] // cell))].append((item[0], item[1]))
                else:
                    stack.extend(item)

    def nearest_nm(self, lon, lat, max_nm):
        reach = int(math.ceil(max_nm * NM_M / 111_000 / self.cell)) + 1
        cy, cx = int(lat // self.cell), int(lon // self.cell)
        best = math.inf
        for dy in range(-reach, reach + 1):
            for dx in range(-reach, reach + 1):
                for hx, hy in self.grid.get((cy + dy, cx + dx), ()):
                    best = min(best, haversine_m(lon, lat, hx, hy))
        best /= NM_M
        return best if best <= max_nm else None


# ------------------------------------------------------------ trip simulation


class Snippets:
    """Endless stream of real per-minute (sog, turn) pairs from one behaviour group."""

    def __init__(self, snippets, rng):
        self.snippets = snippets
        self.rng = rng
        self.queue = []

    def next(self):
        if not self.queue:
            self.queue = list(self.rng.choice(self.snippets))
        return self.queue.pop(0)


def simulate_trip(rng, home, target, fishing_minutes, motion, bathymetry):
    lon, lat = round(home[0], 5), round(home[1], 5)
    heading = bearing_deg(lon, lat, *target)
    wobble = 0.0
    fixes = []
    phase, fishing_left = "outbound", fishing_minutes
    underway = Snippets(motion["underway"], rng)
    fishing = Snippets(motion["fishing"], rng)
    goal = target
    for minute in range(MAX_TRIP_MIN):
        if phase in ("outbound", "return"):
            sog, turn = underway.next()
            wobble = max(-30.0, min(30.0, 0.7 * wobble + turn))
            desired = bearing_deg(lon, lat, *goal)
            heading = (desired + wobble) % 360
        else:
            sog, turn = fishing.next()
            heading = (heading + turn) % 360
        new_heading, (nlon, nlat) = heading, step(lon, lat, heading, sog)
        if not bathymetry.is_water(nlon, nlat, MIN_DEPTH_M) or not in_bounds(nlon, nlat):
            for offset in (20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150, 180):
                candidate = (heading + offset) % 360
                clon, clat = step(lon, lat, candidate, sog)
                if bathymetry.is_water(clon, clat, MIN_DEPTH_M) and in_bounds(clon, clat):
                    new_heading, (nlon, nlat) = candidate, (clon, clat)
                    break
            else:
                nlon, nlat, sog = lon, lat, 0.0
        heading = new_heading
        lon, lat = nlon, nlat
        fixes.append((minute, lon, lat, sog, heading, phase))

        if phase == "outbound" and haversine_m(lon, lat, *goal) < ARRIVAL_NM * NM_M:
            phase = "fishing"
        elif phase == "fishing":
            fishing_left -= 1
            if fishing_left <= 0:
                phase, goal, wobble = "return", home, 0.0
        elif phase == "return" and haversine_m(lon, lat, *goal) < ARRIVAL_NM * NM_M:
            break
    return fixes


def in_bounds(lon, lat) -> bool:
    return REGION["west"] < lon < REGION["east"] and REGION["south"] < lat < REGION["north"]


def snap_to_water(lon, lat, bathymetry, max_km=5.0):
    step_deg = bathymetry.step
    best = None
    reach = int(max_km / 111 / step_deg) + 1
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            clon, clat = lon + dx * step_deg, lat + dy * step_deg
            if bathymetry.is_water(clon, clat, 2.0):
                d = haversine_m(lon, lat, clon, clat)
                if best is None or d < best[0]:
                    best = (d, clon, clat)
    return None if best is None or best[0] > max_km * 1000 else (best[1], best[2])


# ------------------------------------------------------------ weather join


def load_weather():
    path = PROCESSED / "ocean_weather" / "hourly_2023_2025.csv.gz"
    points_path = APP_DATA / "ocean_weather_points.geojson"
    if not path.exists() or not points_path.exists():
        log("  weather series not found; weather columns left empty")
        return None, []
    points = [(f["id"], *f["geometry"]["coordinates"]) for f in read_json(points_path)["features"]]
    table = {}
    with gzip.open(path, "rt", newline="") as handle:
        for row in csv.DictReader(handle):
            table[(row["point_id"], row["time_utc"][:13])] = [row[c] for c in WEATHER_COLUMNS]
    return table, points


# ------------------------------------------------------------ main


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulated Palk Strait fishing trips")
    parser.add_argument("--trips", type=int, default=N_TRIPS)
    args = parser.parse_args()
    rng = random.Random(SEED)
    bathymetry = Bathymetry.load()
    lines = imbl_lines()
    stats = read_json(PROCESSED / "ais" / "fishing_motion_stats.json")
    # "Under way" status also covers slow trawling; transits replay only the
    # under-way snippets faster than the median speed of status-7 (fishing) fixes.
    transit_floor = stats["speedKn"]["fishing_status"]["percentiles"]["p50"]
    motion = {
        "underway": [s for s in stats["snippets"]["underway_status"] if sum(v for v, _ in s) / len(s) >= transit_floor],
        "fishing": stats["snippets"]["fishing_status"],
    }
    log(f"  transit snippets: {len(motion['underway'])} (mean speed >= {transit_floor} kn), fishing snippets: {len(motion['fishing'])}")
    fishing_runs = [m for m in stats["fishingStatusRunMinutes"]["sample"] if m >= 30]
    hazards = HazardIndex(read_json(APP_DATA / "osm_hazards.geojson")["features"])
    protected = [
        (f["properties"]["name"], f["geometry"])
        for f in read_json(APP_DATA / "osm_protected_areas.geojson")["features"]
        if f["properties"].get("extendsOverWater")
    ]
    weather, weather_points = load_weather()

    harbours = []
    for f in read_json(APP_DATA / "osm_harbours.geojson")["features"]:
        lon, lat = f["geometry"]["coordinates"]
        if not indian_side(lon, lat, lines):
            continue
        water = snap_to_water(lon, lat, bathymetry)
        if water:
            harbours.append((f["properties"]["name"] or f"unnamed {f['properties']['category']} ({f['properties']['osmId']})", water))
    log(f"  {len(harbours)} Indian-side harbours with navigable water nearby")

    candidates = []
    for row in range(bathymetry.rows):
        lat = bathymetry.north - row * bathymetry.step
        for col in range(bathymetry.cols):
            lon = bathymetry.west + col * bathymetry.step
            if bathymetry.is_water(lon, lat, TARGET_MIN_DEPTH_M) and in_bounds(lon, lat) and indian_side(lon, lat, lines):
                candidates.append((lon, lat, distance_to_lines_m(lon, lat, lines) / NM_M))
    reachable = {
        name: [c for c in candidates if haversine_m(home[0], home[1], c[0], c[1]) <= MAX_RANGE_NM * NM_M]
        for name, home in harbours
    }
    harbours = [(name, home) for name, home in harbours if reachable[name]]

    vessels = [(f"SIM-{i:04d}", *rng.choice(harbours)) for i in range(1, N_VESSELS + 1)]
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "palk_strait_tracks_1min.csv.gz"
    header = [
        "track_id", "vessel_id", "home_harbour", "time_utc", "lat", "lon", "sog_kn", "cog_deg", "nav_status", "phase",
        "vessel_type", "source", "depth_m", "min_depth_next_10min_m", "dist_to_imbl_nm", "side_of_imbl",
        "minutes_to_imbl_crossing", *[f"crosses_imbl_within_{h}min" for h in CROSSING_HORIZONS_MIN],
        "protected_area", "nearest_hazard_nm", "weather_point", *WEATHER_COLUMNS,
    ]
    summary = defaultdict(int)
    with gzip.open(out, "wt", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        for trip in range(args.trips):
            vessel_id, home_name, home = rng.choice(vessels)
            pool = reachable[home_name]
            near = [c for c in pool if NEAR_IMBL_BAND_NM[0] <= c[2] <= NEAR_IMBL_BAND_NM[1]]
            target_near = bool(near) and rng.random() < TARGET_NEAR_IMBL_SHARE
            target = rng.choice(near if target_near else pool)[:2]
            start = START + timedelta(minutes=rng.randrange(int((END - START).total_seconds() // 60)))
            fixes = simulate_trip(rng, home, target, rng.choice(fishing_runs), motion, bathymetry)
            rows = label_trip(f"{vessel_id}-{trip:04d}", vessel_id, home_name, start, fixes, lines, bathymetry, hazards, protected, weather, weather_points)
            writer.writerows(rows)
            summary["trips"] += 1
            summary["rows"] += len(rows)
            summary["tripsTargetingNearImbl"] += target_near
            summary["tripsCrossingImbl"] += any(r[15] == "LK" for r in rows)
            summary["rowsBeyondImbl"] += sum(r[15] == "LK" for r in rows)
            for h, column in zip(CROSSING_HORIZONS_MIN, (17, 18, 19)):
                summary[f"rowsCrossingWithin{h}min"] += sum(r[column] == 1 for r in rows)
            for band in (1, 2, 5, 8):
                summary[f"rowsWithin{band}NmOfImbl"] += sum(r[15] == "IN" and r[14] <= band for r in rows)
            if (trip + 1) % 50 == 0:
                log(f"    {trip + 1}/{args.trips} trips, {summary['rows']:,} rows")
    write_json(
        OUT / "summary.json",
        {
            "file": out.name,
            "source": "SIMULATED",
            "seed": SEED,
            "settings": {
                "vessels": N_VESSELS, "trips": args.trips, "targetNearImblShare": TARGET_NEAR_IMBL_SHARE,
                "nearImblBandNm": NEAR_IMBL_BAND_NM, "maxRangeNm": MAX_RANGE_NM, "minDepthM": MIN_DEPTH_M,
            },
            "harbours": [name for name, _ in harbours],
            "counts": dict(summary),
        },
        indent=2,
    )


def label_trip(track_id, vessel_id, home_name, start, fixes, lines, bathymetry, hazards, protected, weather, weather_points):
    side = []
    current = "IN"
    previous = None
    for _, lon, lat, *_ in fixes:
        if previous and crossings(previous, (lon, lat), lines) % 2:
            current = "LK" if current == "IN" else "IN"
        side.append(current)
        previous = (lon, lat)
    next_crossing = [None] * len(fixes)
    upcoming = None
    for k in range(len(fixes) - 1, -1, -1):
        if k + 1 < len(fixes) and side[k] == "IN" and side[k + 1] == "LK":
            upcoming = k + 1
        if side[k] == "LK":
            upcoming = None
        next_crossing[k] = None if upcoming is None else upcoming - k
    depths = [bathymetry.depth(lon, lat) for _, lon, lat, *_ in fixes]

    rows = []
    for k, (minute, lon, lat, sog, heading, phase) in enumerate(fixes):
        when = start + timedelta(minutes=minute)
        nearest_point, values = "", [""] * len(WEATHER_COLUMNS)
        if weather:
            nearest_point = min(weather_points, key=lambda p: haversine_m(lon, lat, p[1], p[2]))[0]
            values = weather.get((nearest_point, when.strftime("%Y-%m-%dT%H")), values)
        area = next((name for name, geometry in protected if point_in_geometry(lon, lat, geometry)), "")
        hazard = hazards.nearest_nm(lon, lat, HAZARD_RANGE_NM)
        to_cross = next_crossing[k]
        rows.append(
            [
                track_id, vessel_id, home_name, when.strftime("%Y-%m-%dT%H:%M:00Z"), round(lat, 5), round(lon, 5),
                round(sog, 1), round(heading, 1), 7 if phase == "fishing" else 0, phase, 30, "SIMULATED",
                depths[k], min(d for d in depths[k:k + 11]), round(distance_to_lines_m(lon, lat, lines) / NM_M, 3), side[k],
                "" if to_cross is None or to_cross > 60 else to_cross,
                *[("" if side[k] == "LK" else int(to_cross is not None and to_cross <= h)) for h in CROSSING_HORIZONS_MIN],
                area, "" if hazard is None else round(hazard, 3), nearest_point, *values,
            ]
        )
    return rows


if __name__ == "__main__":
    main()
