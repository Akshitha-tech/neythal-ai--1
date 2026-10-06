"""Monthly chlorophyll-a (2023-2025), the productivity input to fishing suitability.

Source: NOAA NESDIS / NASA, S-NPP VIIRS chlorophyll-a, science quality, global
4 km, monthly (ERDDAP dataset nesdisVHNSQchlaMonthly on NOAA CoastWatch),
sampled every second cell (0.075 deg, ~8 km).
  https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisVHNSQchlaMonthly.html
Licence: free to use and redistribute (NASA Earth science data policy).
Cells under cloud for a whole month are empty.

Outputs
- data/processed/chlorophyll/viirs_chla_monthly_2023_2025.csv.gz   month, lat, lon, chla_mg_m3
- public/data/maritime/chlorophyll_monthly_climatology.json        mean per calendar month on the grid
- data/raw/chlorophyll/                                             raw ERDDAP response
"""

from __future__ import annotations

import csv
import gzip
import statistics
from collections import defaultdict
from datetime import date

from _common import APP_DATA, PROCESSED, RAW, REGION, download, log, write_json

ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisVHNSQchlaMonthly.csv"
STRIDE = 2
START, END = "2023-01-01", "2025-12-31"


def main() -> None:
    query = (
        f"chlor_a[({START}T00:00:00Z):1:({END}T00:00:00Z)][(0.0)]"
        f"[({REGION['north']}):{STRIDE}:({REGION['south']})]"
        f"[({REGION['west']}):{STRIDE}:({REGION['east']})]"
    )
    raw = download(f"{ERDDAP}?{query}", RAW / "chlorophyll" / "viirs_chla_monthly_2023_2025.csv", timeout=900)

    values = []
    with open(raw, newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        next(reader)  # units
        i_time, i_lat, i_lon, i_chl = (header.index(c) for c in ("time", "latitude", "longitude", "chlor_a"))
        for row in reader:
            if row[i_chl] in ("", "NaN"):
                continue
            values.append((row[i_time][:7], round(float(row[i_lat]), 4), round(float(row[i_lon]), 4), float(row[i_chl])))

    out = PROCESSED / "chlorophyll" / "viirs_chla_monthly_2023_2025.csv.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["month", "lat", "lon", "chla_mg_m3"])
        writer.writerows((m, lat, lon, f"{c:.4f}") for m, lat, lon, c in values)
    log(f"  wrote   {out.name} ({len(values):,} cell-months with data)")

    lats = sorted({v[1] for v in values}, reverse=True)
    lons = sorted({v[2] for v in values})
    by_cell = defaultdict(list)
    for month, lat, lon, chla in values:
        by_cell[(int(month[5:7]), lat, lon)].append(chla)
    months = {
        str(m): [
            [round(statistics.fmean(by_cell[(m, lat, lon)]), 3) if by_cell.get((m, lat, lon)) else None for lon in lons]
            for lat in lats
        ]
        for m in range(1, 13)
    }
    write_json(
        APP_DATA / "chlorophyll_monthly_climatology.json",
        {
            "title": "Chlorophyll-a monthly climatology, 2023-2025",
            "source": "NOAA NESDIS / NASA S-NPP VIIRS chlorophyll-a, science quality, 4 km monthly (ERDDAP nesdisVHNSQchlaMonthly)",
            "generated": date.today().isoformat(),
            "units": "mg m^-3",
            "grid": {"lats": lats, "lons": lons, "order": "months[m][row][col], row = lats index (north first)"},
            "note": "Mean of the available monthly composites per calendar month; null where cloud covered every year.",
            "months": months,
        },
    )


if __name__ == "__main__":
    main()
