"""Cut one-minute tracks into trajectory-prediction training samples.

Each sample is "past 10 positions -> next 20 positions" (so the 5, 10 and 20
minute horizons are all included), expressed in metres east/north of the
vessel's current position. Relative coordinates let a model trained on NOAA
tracks (US waters) be applied in Palk Bay.

Inputs (one-minute tracks)
- data/processed/ais/noaa_fishing_tracks_1min.csv.gz          real (NOAA AIS)
- data/processed/synthetic/palk_strait_tracks_1min.csv.gz     simulated Palk Strait, with labels

Outputs (regenerate any time; gitignored because of size)
- data/processed/windows/noaa_trajectory_windows.csv.gz
- data/processed/windows/palk_strait_trajectory_windows.csv.gz
  The Palk Strait file also carries the risk labels at the current fix:
  distance to IMBL, crosses_imbl_within_{10,20,30}min, depth, hazard distance,
  sea state and weather.

Usage: python3 scripts/data/make_trajectory_windows.py [--stride MINUTES]
"""

from __future__ import annotations

import argparse
import csv
import gzip
import math
from datetime import datetime

from _common import PROCESSED, log, to_local_m

PAST = 10
FUTURE = 20
LABEL_COLUMNS = [
    "dist_to_imbl_nm", "side_of_imbl", "minutes_to_imbl_crossing",
    "crosses_imbl_within_10min", "crosses_imbl_within_20min", "crosses_imbl_within_30min",
    "depth_m", "min_depth_next_10min_m", "nearest_hazard_nm", "protected_area",
    "wave_height_m", "sea_state_code", "wind_speed_10m_kn", "beaufort", "wind_gusts_10m_kmh",
    "visibility_m", "current_speed_ms",
]

SOURCES = {
    "noaa": PROCESSED / "ais" / "noaa_fishing_tracks_1min.csv.gz",
    "palk_strait": PROCESSED / "synthetic" / "palk_strait_tracks_1min.csv.gz",
}


def tracks(path):
    """Yield (track_id, [row, ...]) for each track in a file sorted by track then time."""
    with gzip.open(path, "rt", newline="") as handle:
        reader = csv.DictReader(handle)
        current, rows = None, []
        for row in reader:
            if row["track_id"] != current:
                if rows:
                    yield current, rows
                current, rows = row["track_id"], []
            rows.append(row)
        if rows:
            yield current, rows


def minute(stamp: str) -> int:
    return int(datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()) // 60


def header(with_labels: bool):
    cols = ["source", "track_id", "time_utc", "lat", "lon"]
    for k in range(PAST - 1, -1, -1):
        if k:
            cols += [f"past{k}_dx_m", f"past{k}_dy_m"]
        cols += [f"past{k}_sog_kn", f"past{k}_cog_sin", f"past{k}_cog_cos"]
    for h in range(1, FUTURE + 1):
        cols += [f"future{h}_dx_m", f"future{h}_dy_m"]
    return cols + (LABEL_COLUMNS if with_labels else [])


def windows(source, track_id, rows, stride, with_labels):
    times = [minute(r["time_utc"]) for r in rows]
    for t in range(PAST - 1, len(rows) - FUTURE, stride):
        span = times[t - PAST + 1 : t + FUTURE + 1]
        if span[-1] - span[0] != PAST + FUTURE - 1:
            continue  # gap inside the window
        now = rows[t]
        lon0, lat0 = float(now["lon"]), float(now["lat"])
        out = [source, track_id, now["time_utc"], now["lat"], now["lon"]]
        for k in range(PAST - 1, -1, -1):
            r = rows[t - k]
            if k:
                dx, dy = to_local_m(float(r["lon"]), float(r["lat"]), lon0, lat0)
                out += [round(dx, 1), round(dy, 1)]
            cog = float(r["cog_deg"]) if r["cog_deg"] else 0.0
            out += [r["sog_kn"], round(math.sin(math.radians(cog)), 4), round(math.cos(math.radians(cog)), 4)]
        for h in range(1, FUTURE + 1):
            r = rows[t + h]
            dx, dy = to_local_m(float(r["lon"]), float(r["lat"]), lon0, lat0)
            out += [round(dx, 1), round(dy, 1)]
        if with_labels:
            out += [now.get(c, "") for c in LABEL_COLUMNS]
        yield out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--stride", type=int, default=5, help="minutes between window starts (default 5)")
    args = parser.parse_args()
    for source, path in SOURCES.items():
        if not path.exists():
            log(f"  {path.name} missing; skipped")
            continue
        with_labels = source == "palk_strait"
        out = PROCESSED / "windows" / f"{source}_trajectory_windows.csv.gz"
        out.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with gzip.open(out, "wt", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(header(with_labels))
            for track_id, rows in tracks(path):
                for window in windows(source, track_id, rows, args.stride, with_labels):
                    writer.writerow(window)
                    count += 1
        log(f"  wrote   {out.name} ({count:,} windows, {out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
