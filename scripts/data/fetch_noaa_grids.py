"""NOAA gridded sea surface temperature and wave fields, 2023-2025.

All three come from NOAA CoastWatch ERDDAP (https://coastwatch.pfeg.noaa.gov/erddap),
subset to the Neythal region. NOAA data: free to use and redistribute; not for navigation.

- OISST v2.1 (NOAA NCEI), daily, 0.25 deg            dataset ncdcOisst21Agg_LonPM180
  Reynolds et al. 2007 / Huang et al. 2021, doi:10.25921/RE9P-PT57
- Coral Reef Watch CoralTemp v3.1 (NOAA), monthly, 5 km  dataset NOAA_DHW_monthly
  https://coralreefwatch.noaa.gov/product/5km/
- WaveWatch III global (NOAA NCEP), 0.5 deg, one sample a day at 12:00 UTC  dataset NWW3_Global_Best
  (the server reads one file per time step, so denser sampling takes hours to subset)
  https://polar.ncep.noaa.gov/waves/

Outputs
- data/processed/sst/noaa_oisst_daily_2023_2025.csv.gz
- data/processed/sst/noaa_coraltemp_monthly_2023_2025.csv.gz
- data/processed/waves/noaa_ww3_daily_2023_2025.csv.gz
- public/data/maritime/sst_monthly_climatology.json     CoralTemp 5 km mean per calendar month
- public/data/maritime/waves_monthly_climatology.json   WW3 wave height mean / p90 per calendar month
- data/raw/noaa_grids/                                   raw ERDDAP responses (one per year)
"""

from __future__ import annotations

import csv
import gzip
import statistics
from collections import defaultdict
from datetime import date

from _common import APP_DATA, PROCESSED, RAW, REGION, download, log, write_json

ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"
YEARS = (2023, 2024, 2025)
S, N, W, E = REGION["south"], REGION["north"], REGION["west"], REGION["east"]

DATASETS = {
    "oisst": {
        "id": "ncdcOisst21Agg_LonPM180",
        "variables": {"sst": "sst_c", "anom": "sst_anomaly_c"},
        "time": lambda y: f"[({y}-01-01T12:00:00Z):1:({y}-12-31T12:00:00Z)]",
        "axes": f"[(0.0)][({S}):1:({N})][({W}):1:({E})]",
        "out": PROCESSED / "sst" / "noaa_oisst_daily_2023_2025.csv.gz",
        "time_column": "date",
        "time_format": lambda t: t[:10],
    },
    "coraltemp": {
        "id": "NOAA_DHW_monthly",
        "variables": {"sea_surface_temperature": "sst_c", "sea_surface_temperature_anomaly": "sst_anomaly_c"},
        "time": lambda y: f"[({y}-01-01T00:00:00Z):1:({y}-12-31T00:00:00Z)]",
        "axes": f"[({N}):1:({S})][({W}):1:({E})]",
        "out": PROCESSED / "sst" / "noaa_coraltemp_monthly_2023_2025.csv.gz",
        "time_column": "month",
        "time_format": lambda t: t[:7],
    },
    "ww3": {
        "id": "NWW3_Global_Best",
        "variables": {
            "Thgt": "wave_height_m", "Tper": "wave_period_s", "Tdir": "wave_direction_deg", "shgt": "swell_height_m",
        },
        # Hourly source; one step a day keeps the server-side subset to minutes.
        "time": lambda y: f"[({y}-01-01T12:00:00Z):24:({y}-12-31T12:00:00Z)]",
        "axes": f"[(0.0)][({S}):1:({N})][({W}):1:({E})]",
        "out": PROCESSED / "waves" / "noaa_ww3_daily_2023_2025.csv.gz",
        "time_column": "time_utc",
        "time_format": lambda t: t,
    },
}


def fetch(name: str) -> list[dict]:
    spec = DATASETS[name]
    rows = []
    for year in YEARS:
        query = ",".join(f"{v}{spec['time'](year)}{spec['axes']}" for v in spec["variables"])
        path = download(f"{ERDDAP}/{spec['id']}.csv?{query}", RAW / "noaa_grids" / f"{name}_{year}.csv", timeout=2400)
        with open(path, newline="") as handle:
            reader = csv.reader(handle)
            header = next(reader)
            next(reader)  # units
            index = {h: i for i, h in enumerate(header)}
            for record in reader:
                values = {
                    column: None if record[index[v]] in ("NaN", "") else round(float(record[index[v]]), 3)
                    for v, column in spec["variables"].items()
                }
                if all(v is None for v in values.values()):
                    continue  # land cell
                rows.append(
                    {
                        spec["time_column"]: spec["time_format"](record[index["time"]]),
                        "lat": round(float(record[index["latitude"]]), 4),
                        "lon": round(float(record[index["longitude"]]), 4),
                    }
                    | values
                )
    spec["out"].parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(spec["out"], "wt", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    log(f"  wrote   {spec['out'].name} ({len(rows):,} rows, {spec['out'].stat().st_size / 1e6:.1f} MB)")
    return rows


def monthly_grid(rows, time_column, value_column, reducers):
    lats = sorted({r["lat"] for r in rows}, reverse=True)
    lons = sorted({r["lon"] for r in rows})
    cells = defaultdict(list)
    for r in rows:
        if r[value_column] is not None:
            cells[(int(r[time_column][5:7]), r["lat"], r["lon"])].append(r[value_column])
    out = {}
    for name, reduce in reducers.items():
        out[name] = {
            str(m): [[reduce(cells[(m, lat, lon)]) if cells.get((m, lat, lon)) else None for lon in lons] for lat in lats]
            for m in range(1, 13)
        }
    return {"lats": lats, "lons": lons}, out


def p90(values):
    values = sorted(values)
    return round(values[min(len(values) - 1, int(0.9 * len(values)))], 2)


def main() -> None:
    today = date.today().isoformat()
    fetch("oisst")
    coraltemp = fetch("coraltemp")
    ww3 = fetch("ww3")

    grid, stats = monthly_grid(coraltemp, "month", "sst_c", {"meanC": lambda v: round(statistics.fmean(v), 2)})
    write_json(
        APP_DATA / "sst_monthly_climatology.json",
        {
            "title": "Sea surface temperature monthly climatology, 2023-2025",
            "source": "NOAA Coral Reef Watch CoralTemp v3.1, 5 km monthly (ERDDAP NOAA_DHW_monthly)",
            "generated": today,
            "units": "degrees C",
            "grid": grid | {"order": "months[m][row][col], row = lats index (north first)"},
            "months": stats["meanC"],
        },
    )
    grid, stats = monthly_grid(
        ww3, "time_utc", "wave_height_m",
        {"meanM": lambda v: round(statistics.fmean(v), 2), "p90M": p90},
    )
    write_json(
        APP_DATA / "waves_monthly_climatology.json",
        {
            "title": "Significant wave height monthly climatology, 2023-2025",
            "source": "NOAA NCEP WaveWatch III global 0.5 deg, daily 12:00 UTC samples (ERDDAP NWW3_Global_Best)",
            "generated": today,
            "units": "metres",
            "note": "0.5 deg cells: coarse for Palk Bay; the Copernicus MFWAM point series in ocean_climatology.json is finer.",
            "grid": grid | {"order": "stat[m][row][col], row = lats index (north first)"},
            "meanM": stats["meanM"],
            "p90M": stats["p90M"],
        },
    )


if __name__ == "__main__":
    main()
