"""Turn NOAA AIS daily files into fishing-vessel training data.

Inputs: data/raw/ais/noaa/AIS_YYYY_MM_DD.zip (fetch_ais_noaa.py)
Usage:  python3 scripts/data/process_ais_noaa.py [YYYY-MM-DD ...]   (default: all downloaded days)

Outputs (data/processed/ais/)
- noaa_fishing_tracks_1min.csv.gz  fishing-vessel (AIS type 30) tracks, split at gaps and
                                   resampled to one fix per minute
- noaa_fishing_vessels.csv         vessel metadata (length, width, draft, transceiver class)
- noaa_encounters.csv.gz           fishing vessel <-> other vessel encounters within 2 NM,
                                   with closest point of approach (CPA) and time to CPA (TCPA)
- fishing_motion_stats.json        speed / turn-rate distributions and replayable motion
                                   snippets, used by generate_palk_tracks.py

MMSI numbers are replaced with salted hashes: the models only need a stable
per-vessel id, not the real identity.

Source: NOAA Office for Coastal Management / BOEM, MarineCadastre.gov AIS,
public domain. Not intended for navigation.
"""

from __future__ import annotations

import bisect
import csv
import gzip
import hashlib
import io
import math
import random
import statistics
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone

from _common import NM_M, PROCESSED, RAW, cpa_tcpa, log, to_local_m, write_json

FISHING_TYPE = 30
GAP_S = 10 * 60  # split a track when fixes are more than 10 minutes apart
MAX_JUMP_KN = 40.0  # implied speed above this between fixes = bad fix
MIN_SEGMENT_MIN = 30
ENCOUNTER_RANGE_M = 2 * NM_M
ENCOUNTER_CELL_DEG = 0.05  # > 2 NM at these latitudes, so neighbours cover the range
MOVING_KN = 1.0
SNIPPET_MIN = 30
SNIPPETS_PER_GROUP = 1500
SALT = "neythal-noaa-ais"

OUT = PROCESSED / "ais"


def vessel_id(mmsi: str) -> str:
    return "US-" + hashlib.sha1(f"{SALT}:{mmsi}".encode()).hexdigest()[:10]


def number(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def epoch(stamp: str) -> int:
    return int(datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc).timestamp())


def iso(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def vessel_group(vessel_type: int | None) -> str:
    if vessel_type is None:
        return "unknown"
    if vessel_type == 30:
        return "fishing"
    if vessel_type in (31, 32, 52):
        return "towing/tug"
    if vessel_type in (36, 37):
        return "sailing/pleasure"
    if 60 <= vessel_type <= 69:
        return "passenger"
    if 70 <= vessel_type <= 79:
        return "cargo"
    if 80 <= vessel_type <= 89:
        return "tanker"
    return "other"


def rows(path):
    with zipfile.ZipFile(path) as archive:
        name = archive.namelist()[0]
        with archive.open(name) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            header = next(reader)
            index = {name: i for i, name in enumerate(header)}
            for row in reader:
                yield row, index


def cell_key(minute: int, lat: float, lon: float, dy: int = 0, dx: int = 0) -> tuple:
    return (minute, math.floor(lat / ENCOUNTER_CELL_DEG) + dy, math.floor(lon / ENCOUNTER_CELL_DEG) + dx)


# ------------------------------------------------------------ pass 1


def read_fishing(path):
    fixes = defaultdict(list)
    meta = {}
    keys = set()
    total = 0
    for row, i in rows(path):
        total += 1
        vessel_type = number(row[i["VesselType"]])
        if vessel_type != FISHING_TYPE:
            continue
        lat, lon, sog = number(row[i["LAT"]]), number(row[i["LON"]]), number(row[i["SOG"]])
        if lat is None or lon is None or sog is None or not (-90 <= lat <= 90 and -180 <= lon <= 180) or sog > 60:
            continue
        mmsi = row[i["MMSI"]]
        t = epoch(row[i["BaseDateTime"]])
        cog = number(row[i["COG"]])
        heading = number(row[i["Heading"]])
        status = number(row[i["Status"]])
        fixes[mmsi].append(
            (t, lat, lon, sog, None if cog is None or cog >= 360 else cog,
             None if heading is None or heading >= 360 else heading,
             None if status is None else int(status))
        )
        m = meta.setdefault(mmsi, {"length_m": None, "width_m": None, "draft_m": None, "transceiver": None})
        for key, column in (("length_m", "Length"), ("width_m", "Width"), ("draft_m", "Draft")):
            value = number(row[i[column]])
            if value and value > 0:
                m[key] = value
        m["transceiver"] = row[i["TransceiverClass"]] or m["transceiver"]
        if sog >= MOVING_KN:
            minute = t // 60
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    keys.add(cell_key(minute, lat, lon, dy, dx))
    return fixes, meta, keys, total


# ------------------------------------------------------------ tracks


def segment(points):
    points = sorted(set(points))
    segments, current = [], []
    for p in points:
        if current:
            q = current[-1]
            dt = p[0] - q[0]
            if dt <= 0:
                continue
            jump_kn = (math.dist(to_local_m(p[2], p[1], q[2], q[1]), (0, 0)) / dt) * 3600 / NM_M
            if dt > GAP_S or jump_kn > MAX_JUMP_KN:
                segments.append(current)
                current = []
        current.append(p)
    if current:
        segments.append(current)
    return [s for s in segments if s[-1][0] - s[0][0] >= MIN_SEGMENT_MIN * 60]


def circular_mix(a: float, b: float, w: float) -> float:
    delta = (b - a + 540) % 360 - 180
    return (a + w * delta) % 360


def resample(points):
    times = [p[0] for p in points]
    out = []
    start = -(-times[0] // 60) * 60
    for t in range(start, times[-1] + 1, 60):
        j = bisect.bisect_left(times, t)
        if times[j] == t:
            a = b = points[j]
            w = 0.0
        else:
            a, b = points[j - 1], points[j]
            w = (t - a[0]) / (b[0] - a[0])
        lat = a[1] + w * (b[1] - a[1])
        lon = a[2] + w * (b[2] - a[2])
        sog = a[3] + w * (b[3] - a[3])
        if a[4] is not None and b[4] is not None:
            cog = circular_mix(a[4], b[4], w)
        else:
            cog = a[4] if a[4] is not None else b[4]
        heading = a[5] if w < 0.5 else b[5]
        status = a[6] if w < 0.5 else b[6]
        out.append([t, lat, lon, sog, cog, heading, status])
    # Fill missing course from displacement.
    for k, p in enumerate(out):
        if p[4] is None and len(out) > 1:
            q = out[k + 1] if k + 1 < len(out) else out[k - 1]
            east, north = to_local_m(q[2], q[1], p[2], p[1])
            if k + 1 >= len(out):
                east, north = -east, -north
            p[4] = math.degrees(math.atan2(east, north)) % 360
    return out


def turn(a: float, b: float) -> float:
    return (b - a + 540) % 360 - 180


# ------------------------------------------------------------ pass 2: encounters


def collect_neighbours(path, keys):
    by_minute = defaultdict(list)
    for row, i in rows(path):
        lat, lon = number(row[i["LAT"]]), number(row[i["LON"]])
        if lat is None or lon is None:
            continue
        t = epoch(row[i["BaseDateTime"]])
        if cell_key(t // 60, lat, lon) not in keys:
            continue
        sog = number(row[i["SOG"]]) or 0.0
        cog = number(row[i["COG"]])
        vessel_type = number(row[i["VesselType"]])
        length = number(row[i["Length"]])
        by_minute[t // 60].append(
            (row[i["MMSI"]], t, lat, lon, min(sog, 60.0), 0.0 if cog is None or cog >= 360 else cog,
             None if vessel_type is None else int(vessel_type), length if length and length > 0 else None)
        )
    return by_minute


def encounters(by_minute, fishing_mmsi):
    """Group per-minute proximity into events; a pair apart for > 3 minutes starts a new event."""
    open_events, closed = {}, []
    seen = set()
    for minute in sorted(by_minute):
        entries = by_minute[minute]
        latest = {}
        for e in entries:
            if e[0] not in latest or e[1] > latest[e[0]][1]:
                latest[e[0]] = e
        vessels = list(latest.values())
        for own in vessels:
            if own[0] not in fishing_mmsi or own[4] < MOVING_KN:
                continue
            for other in vessels:
                if other[0] == own[0]:
                    continue
                pair = tuple(sorted((own[0], other[0])))
                if other[0] in fishing_mmsi and (minute, pair) in seen:
                    continue
                dt = own[1] - other[1]
                ox, oy = to_local_m(other[3], other[2], own[3], own[2])
                speed = other[4] * NM_M / 3600
                ox += speed * math.sin(math.radians(other[5])) * dt
                oy += speed * math.cos(math.radians(other[5])) * dt
                distance = math.hypot(ox, oy)
                if distance > ENCOUNTER_RANGE_M:
                    continue
                seen.add((minute, pair))
                cpa, tcpa = cpa_tcpa((0.0, 0.0, own[4], own[5]), (ox, oy, other[4], other[5]))
                key = (own[0], other[0])
                event = open_events.get(key)
                if event and minute - event["last_minute"] > 3:
                    closed.append(open_events.pop(key))
                    event = None
                if not event:
                    event = open_events[key] = {
                        "own": own[0], "other": other[0], "start": own[1], "end": own[1],
                        "minutes": 0, "min_range_m": distance, "min_cpa_m": math.inf, "tcpa_at_min_cpa_s": None,
                        "own_sog": own[4], "other_sog": other[4], "other_type": other[6],
                        "other_length": other[7], "lat": own[2], "lon": own[3], "last_minute": minute,
                    }
                event["end"] = own[1]
                event["minutes"] += 1
                event["last_minute"] = minute
                if distance < event["min_range_m"]:
                    event.update(min_range_m=distance, lat=own[2], lon=own[3], own_sog=own[4], other_sog=other[4])
                if 0 <= tcpa <= 20 * 60 and cpa < event["min_cpa_m"]:
                    event["min_cpa_m"], event["tcpa_at_min_cpa_s"] = cpa, tcpa
    return closed + list(open_events.values())


# ------------------------------------------------------------ main


def main() -> None:
    names = sys.argv[1:]
    folder = RAW / "ais" / "noaa"
    days = [folder / f"AIS_{d.replace('-', '_')}.zip" for d in names] or sorted(folder.glob("AIS_*.zip"))
    if not days:
        raise SystemExit("No AIS files. Run fetch_ais_noaa.py first.")
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(42)

    track_rows = 0
    vessels = {}
    groups = {"fishing_status": [], "underway_status": [], "all_moving": []}
    all_snippets = {name: [] for name in groups}
    lengths = []
    fishing_runs = []

    tracks_out = gzip.open(OUT / "noaa_fishing_tracks_1min.csv.gz", "wt", newline="", encoding="utf-8")
    encounters_out = gzip.open(OUT / "noaa_encounters.csv.gz", "wt", newline="", encoding="utf-8")
    tracks = csv.writer(tracks_out)
    tracks.writerow(["track_id", "vessel_id", "time_utc", "lat", "lon", "sog_kn", "cog_deg", "heading_deg", "nav_status", "length_m"])
    enc = csv.writer(encounters_out)
    enc.writerow([
        "day", "fishing_vessel_id", "other_vessel_id", "other_vessel_group", "other_length_m", "start_utc", "end_utc",
        "minutes_within_2nm", "min_range_nm", "min_cpa_nm_next_20min", "tcpa_at_min_cpa_min",
        "fishing_sog_kn", "other_sog_kn", "lat", "lon",
    ])

    for path in days:
        day = path.stem.removeprefix("AIS_").replace("_", "-")
        log(f"  {day}: pass 1 (fishing vessels)")
        fixes, meta, keys, total = read_fishing(path)
        log(f"  {day}: {total:,} rows, {sum(map(len, fixes.values())):,} fishing fixes, {len(fixes)} vessels")

        for mmsi, points in fixes.items():
            vid = vessel_id(mmsi)
            info = vessels.setdefault(vid, meta[mmsi] | {"vessel_id": vid, "days": 0, "fixes": 0})
            info["days"] += 1
            info["fixes"] += len(points)
            for k, segment_points in enumerate(segment(points)):
                series = resample(segment_points)
                if statistics.median(p[3] for p in series) < 0.5:
                    continue  # moored or drifting in harbour all along
                track_id = f"{vid}-{day}-{k}"
                for p in series:
                    tracks.writerow([
                        track_id, vid, iso(p[0]), f"{p[1]:.5f}", f"{p[2]:.5f}", f"{p[3]:.1f}",
                        f"{p[4]:.1f}" if p[4] is not None else "", f"{p[5]:.0f}" if p[5] is not None else "",
                        "" if p[6] is None else p[6], meta[mmsi]["length_m"] or "",
                    ])
                track_rows += len(series)
                motion = [(series[j][3], turn(series[j - 1][4], series[j][4]), series[j][6]) for j in range(1, len(series))]
                run = 0
                for sog, _, status in motion:
                    if status == 7:
                        run += 1
                    elif run:
                        fishing_runs.append(run)
                        run = 0
                if run:
                    fishing_runs.append(run)
                for start in range(0, len(motion) - SNIPPET_MIN, SNIPPET_MIN):
                    window = motion[start:start + SNIPPET_MIN]
                    statuses = {s for *_, s in window}
                    snippet = [[round(s, 1), round(t, 1)] for s, t, _ in window]
                    if statistics.fmean(s for s, *_ in window) < MOVING_KN:
                        continue
                    all_snippets["all_moving"].append(snippet)
                    if statuses == {7}:
                        all_snippets["fishing_status"].append(snippet)
                    elif statuses == {0}:
                        all_snippets["underway_status"].append(snippet)
                for sog, t, status in motion:
                    if sog >= MOVING_KN:
                        groups["all_moving"].append((sog, t))
                        if status == 7:
                            groups["fishing_status"].append((sog, t))
                        elif status == 0:
                            groups["underway_status"].append((sog, t))
            if meta[mmsi]["length_m"]:
                lengths.append(meta[mmsi]["length_m"])

        log(f"  {day}: pass 2 (encounters)")
        by_minute = collect_neighbours(path, keys)
        fishing_mmsi = set(fixes)
        events = encounters(by_minute, fishing_mmsi)
        for e in events:
            enc.writerow([
                day, vessel_id(e["own"]), vessel_id(e["other"]),
                "fishing" if e["other"] in fishing_mmsi else vessel_group(e["other_type"]),
                e["other_length"] or "", iso(e["start"]), iso(e["end"]), e["minutes"],
                f"{e['min_range_m'] / NM_M:.3f}",
                "" if math.isinf(e["min_cpa_m"]) else f"{e['min_cpa_m'] / NM_M:.3f}",
                "" if e["tcpa_at_min_cpa_s"] is None else f"{e['tcpa_at_min_cpa_s'] / 60:.1f}",
                f"{e['own_sog']:.1f}", f"{e['other_sog']:.1f}", f"{e['lat']:.4f}", f"{e['lon']:.4f}",
            ])
        log(f"  {day}: {len(events):,} encounter events")

    tracks_out.close()
    encounters_out.close()

    with open(OUT / "noaa_fishing_vessels.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["vessel_id", "length_m", "width_m", "draft_m", "transceiver", "days", "fixes"])
        writer.writeheader()
        for info in sorted(vessels.values(), key=lambda v: v["vessel_id"]):
            writer.writerow({k: info[k] for k in writer.fieldnames})

    write_json(OUT / "fishing_motion_stats.json", motion_stats(groups, all_snippets, lengths, fishing_runs, days, rng))
    log(f"  tracks: {track_rows:,} one-minute fixes from {len(vessels)} vessels")


def histogram(values, low, high, width):
    bins = int(round((high - low) / width))
    counts = [0] * bins
    for v in values:
        k = int((v - low) // width)
        if 0 <= k < bins:
            counts[k] += 1
    return {"low": low, "high": high, "width": width, "counts": counts}


def percentiles(values, ps=(5, 25, 50, 75, 95)):
    values = sorted(values)
    if not values:
        return None
    return {f"p{p}": round(values[min(len(values) - 1, int(p / 100 * len(values)))], 2) for p in ps}


def motion_stats(groups, snippets, lengths, fishing_runs, days, rng):
    return {
        "title": "Fishing-vessel motion statistics from NOAA AIS",
        "source": "NOAA MarineCadastre AIS, AIS vessel type 30 (fishing), US waters",
        "days": [p.stem for p in days],
        "sampling": "one fix per minute after resampling; turn = change in course over ground per minute (deg)",
        "groups": {
            "fishing_status": "fixes reporting navigational status 7 (engaged in fishing)",
            "underway_status": "fixes reporting navigational status 0 (under way using engine)",
            "all_moving": f"all fishing-vessel fixes with SOG >= {MOVING_KN} kn regardless of status",
        },
        "speedKn": {name: {"n": len(v), "percentiles": percentiles([s for s, _ in v]), "histogram": histogram([s for s, _ in v], 0, 20, 0.5)} for name, v in groups.items()},
        "turnDegPerMin": {name: {"n": len(v), "percentiles": percentiles([t for _, t in v]), "histogram": histogram([t for _, t in v], -90, 90, 2)} for name, v in groups.items()},
        "fishingStatusRunMinutes": {
            "n": len(fishing_runs),
            "percentiles": percentiles(fishing_runs),
            "sample": rng.sample(fishing_runs, min(2000, len(fishing_runs))),
        },
        "vesselLengthM": {"n": len(lengths), "percentiles": percentiles(lengths)},
        "snippetMinutes": SNIPPET_MIN,
        "snippetFormat": "[[sog_kn, turn_deg_per_min], ...] one entry per minute",
        "snippets": {name: rng.sample(v, min(SNIPPETS_PER_GROUP, len(v))) for name, v in snippets.items()},
    }


if __name__ == "__main__":
    main()
