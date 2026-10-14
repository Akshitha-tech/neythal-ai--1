"""Bathymetry (water depth) grid for grounding-risk checks.

Source: NOAA NCEI ETOPO 2022 Global Relief Model, 15 arc-second, served by
NOAA CoastWatch ERDDAP (dataset ETOPO_2022_v1_15s). Sampled every second cell
(30 arc-seconds, ~925 m) over the Neythal region.
  https://www.ncei.noaa.gov/products/etopo-global-relief-model
  doi:10.25921/fd45-gt74
Licence: NOAA data, free to use and redistribute; NOAA states it is not
intended for navigation.

Outputs
- public/data/maritime/bathymetry_etopo2022_30s.bin   little-endian int16 elevation (m),
                                                       rows north -> south, columns west -> east
- public/data/maritime/bathymetry_etopo2022_30s.json  grid header (origin, step, shape)
- data/raw/bathymetry/etopo_2022_30s.csv              raw ERDDAP response

Elevation is relative to mean sea level: negative = water depth below sea
level, positive = land height.
"""

from __future__ import annotations

import array
import csv
import sys
from datetime import date

from _common import APP_DATA, RAW, REGION, download, log, write_json

ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.csv"
STRIDE = 2  # 15" native -> 30"
BASENAME = "bathymetry_etopo2022_30s"


def main() -> None:
    query = (
        f"z[({REGION['south']}):{STRIDE}:({REGION['north']})]"
        f"[({REGION['west']}):{STRIDE}:({REGION['east']})]"
    )
    raw = download(f"{ERDDAP}?{query}", RAW / "bathymetry" / "etopo_2022_30s.csv", timeout=600)

    cells: dict[tuple[float, float], int] = {}
    with open(raw, newline="") as handle:
        reader = csv.reader(handle)
        next(reader)  # column names
        next(reader)  # units
        for lat, lon, z in reader:
            cells[(float(lat), float(lon))] = round(float(z))

    lats = sorted({lat for lat, _ in cells}, reverse=True)
    lons = sorted({lon for _, lon in cells})
    grid = array.array("h", (cells[(lat, lon)] for lat in lats for lon in lons))
    if sys.byteorder != "little":
        grid.byteswap()

    APP_DATA.mkdir(parents=True, exist_ok=True)
    (APP_DATA / f"{BASENAME}.bin").write_bytes(grid.tobytes())
    step = (lons[-1] - lons[0]) / (len(lons) - 1)
    sea = sum(1 for z in grid if z < 0)
    write_json(
        APP_DATA / f"{BASENAME}.json",
        {
            "title": "ETOPO 2022 bathymetry/topography, 30 arc-second subset",
            "source": "NOAA NCEI ETOPO 2022 v1 (15 arc-second), via NOAA CoastWatch ERDDAP ETOPO_2022_v1_15s",
            "sourceUrl": "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
            "doi": "10.25921/fd45-gt74",
            "generated": date.today().isoformat(),
            "file": f"{BASENAME}.bin",
            "dtype": "int16 little-endian",
            "units": "metres relative to mean sea level (negative = below sea level)",
            "rows": len(lats),
            "cols": len(lons),
            "northLat": lats[0],
            "southLat": lats[-1],
            "westLon": lons[0],
            "eastLon": lons[-1],
            "stepDeg": step,
            "order": "row-major, first row = northLat, first column = westLon",
            "lookup": "row = round((northLat - lat) / stepDeg); col = round((lon - westLon) / stepDeg)",
            "notForNavigation": True,
            "stats": {"cells": len(grid), "seaCells": sea, "minM": min(grid), "maxM": max(grid)},
        },
        indent=2,
    )
    log(f"  grid {len(lats)} x {len(lons)}, step {step * 3600:.1f} arcsec, {sea} sea cells, depth to {min(grid)} m")


if __name__ == "__main__":
    main()
