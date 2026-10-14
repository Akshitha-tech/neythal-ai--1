"""Hourly ocean and weather history (2023-2025) at fishing-ground sample points.

Every variable comes from a named model, requested explicitly through Open-Meteo
(https://open-meteo.com/, data CC-BY 4.0):
- Copernicus Marine Service global wave model MFWAM (Meteo-France), 0.08 deg:
    significant wave height, wind waves, swell (height, direction, period)
- Copernicus Marine Service global ocean SMOC currents and SST (Meteo-France), 0.08 deg:
    surface current speed/direction, sea surface temperature, sea level incl. tide
- Copernicus Climate Change Service ERA5 reanalysis (ECMWF), 0.25 deg:
    10 m wind, gusts, precipitation, pressure, cloud, air temperature, humidity
- NOAA NCEP GFS (archived forecasts), 0.25 deg:
    10 m wind, gusts, precipitation, visibility (ERA5 has no visibility)

Derived columns use published WMO scales, not tuned thresholds:
- beaufort        WMO Beaufort force from ERA5 10 m mean wind (knots)
- sea_state_code  WMO code table 3700 (Douglas sea state) from significant wave height

Outputs
- data/processed/ocean_weather/hourly_2023_2025.csv.gz   one row per point per UTC hour
- public/data/maritime/ocean_weather_points.geojson      the sample points and model cells used
- public/data/maritime/ocean_climatology.json            monthly statistics per point (offline cache)
- data/raw/ocean_weather/                                 raw API responses
"""

from __future__ import annotations

import csv
import gzip
import statistics
import time
from collections import defaultdict
from datetime import date

from _common import APP_DATA, NM_M, PROCESSED, RAW, build_url, download, log, read_json, write_json
from bathymetry import Bathymetry

YEARS = (2023, 2024, 2025)

# Offshore sample points on the Indian side of the IMBL, named after the
# nearest landmark. Each is checked against the bathymetry grid below.
POINTS = [
    ("palk_strait_point_calimere", "Palk Strait, south-east of Point Calimere", 10.10, 79.70),
    ("palk_bay_kottaipattinam", "Palk Bay, off Kottaipattinam", 9.90, 79.35),
    ("palk_bay_imbl_west", "Palk Bay, west of IMBL position 3", 9.62, 79.30),
    ("palk_bay_rameswaram_north", "Palk Bay, north of Rameswaram", 9.45, 79.33),
    ("palk_bay_katchatheevu_west", "Palk Bay, west of Katchatheevu", 9.40, 79.45),
    ("gulf_of_mannar_pamban_south", "Gulf of Mannar, south of Pamban", 9.10, 79.25),
    ("gulf_of_mannar_central", "Gulf of Mannar, off Keelakarai", 8.95, 78.75),
    ("gulf_of_mannar_tuticorin", "Gulf of Mannar, off Thoothukudi", 8.75, 78.35),
    ("gulf_of_mannar_imbl_south", "Gulf of Mannar, west of IMBL position 7m", 8.40, 78.85),
]

MARINE = "https://marine-api.open-meteo.com/v1/marine"

# name -> (endpoint, Open-Meteo model id, variables, source description)
APIS = {
    "waves": (
        MARINE,
        "meteofrance_wave",
        [
            "wave_height", "wave_direction", "wave_period",
            "wind_wave_height", "wind_wave_direction", "wind_wave_period",
            "swell_wave_height", "swell_wave_direction", "swell_wave_period",
        ],
        "Copernicus Marine Service MFWAM global wave model (Meteo-France)",
    ),
    "currents": (
        MARINE,
        "meteofrance_currents",
        ["ocean_current_velocity", "ocean_current_direction", "sea_surface_temperature", "sea_level_height_msl"],
        "Copernicus Marine Service SMOC global currents and SST (Meteo-France)",
    ),
    "era5": (
        "https://archive-api.open-meteo.com/v1/archive",
        "era5",
        [
            "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
            "precipitation", "pressure_msl", "cloud_cover",
            "temperature_2m", "relative_humidity_2m",
        ],
        "Copernicus Climate Change Service ERA5 reanalysis (ECMWF)",
    ),
    "gfs": (
        "https://historical-forecast-api.open-meteo.com/v1/forecast",
        "gfs_seamless",
        ["wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "precipitation", "visibility"],
        "NOAA NCEP Global Forecast System (archived forecasts)",
    ),
}

# Output column -> (api, variable, conversion). Units are in the column name.
COLUMNS = {
    "wave_height_m": ("waves", "wave_height", None),
    "wave_direction_deg": ("waves", "wave_direction", None),
    "wave_period_s": ("waves", "wave_period", None),
    "wind_wave_height_m": ("waves", "wind_wave_height", None),
    "wind_wave_direction_deg": ("waves", "wind_wave_direction", None),
    "wind_wave_period_s": ("waves", "wind_wave_period", None),
    "swell_wave_height_m": ("waves", "swell_wave_height", None),
    "swell_wave_direction_deg": ("waves", "swell_wave_direction", None),
    "swell_wave_period_s": ("waves", "swell_wave_period", None),
    "current_speed_ms": ("currents", "ocean_current_velocity", lambda v: v / 3.6),
    "current_direction_deg": ("currents", "ocean_current_direction", None),
    "sea_surface_temperature_c": ("currents", "sea_surface_temperature", None),
    "sea_level_msl_m": ("currents", "sea_level_height_msl", None),
    "wind_speed_10m_kmh": ("era5", "wind_speed_10m", None),
    "wind_speed_10m_kn": ("era5", "wind_speed_10m", lambda v: v * 1000 / NM_M),
    "wind_direction_10m_deg": ("era5", "wind_direction_10m", None),
    "wind_gusts_10m_kmh": ("era5", "wind_gusts_10m", None),
    "precipitation_mm": ("era5", "precipitation", None),
    "pressure_msl_hpa": ("era5", "pressure_msl", None),
    "cloud_cover_pct": ("era5", "cloud_cover", None),
    "air_temperature_2m_c": ("era5", "temperature_2m", None),
    "relative_humidity_2m_pct": ("era5", "relative_humidity_2m", None),
    "gfs_wind_speed_10m_kmh": ("gfs", "wind_speed_10m", None),
    "gfs_wind_direction_10m_deg": ("gfs", "wind_direction_10m", None),
    "gfs_wind_gusts_10m_kmh": ("gfs", "wind_gusts_10m", None),
    "gfs_precipitation_mm": ("gfs", "precipitation", None),
    "visibility_m": ("gfs", "visibility", None),
}

# WMO Beaufort scale, lower bound of each force in knots (force 1..12).
BEAUFORT_KN = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64]
# WMO code table 3700, upper bound of significant wave height (m) for codes 1..8.
SEA_STATE_M = [0.1, 0.5, 1.25, 2.5, 4.0, 6.0, 9.0, 14.0]


def beaufort(speed_kn: float) -> int:
    return sum(round(speed_kn) >= bound for bound in BEAUFORT_KN)


def sea_state_code(height_m: float) -> int:
    if height_m == 0:
        return 0
    return 1 + sum(height_m > bound for bound in SEA_STATE_M)


def fetch(api: str, point_id: str, lat: float, lon: float, year: int) -> dict:
    base, model, variables, _ = APIS[api]
    url = build_url(
        base,
        {
            "models": model,
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(variables),
            "start_date": f"{year}-01-01",
            "end_date": f"{year}-12-31",
            "timezone": "GMT",
        },
    )
    path = RAW / "ocean_weather" / f"{api}_{point_id}_{year}.json"
    fresh = not path.exists()
    payload = read_json(download(url, path, timeout=180))
    if "error" in payload or payload.get("reason"):
        path.unlink()
        raise SystemExit(f"{api} {point_id} {year}: {payload}")
    if fresh:
        time.sleep(1.5)  # stay well inside Open-Meteo's free-tier rate limits
    return payload


def main() -> None:
    bathymetry = Bathymetry.load()
    for point_id, _, lat, lon in POINTS:
        depth = bathymetry.depth(lon, lat)
        if not depth or depth < 3:
            raise SystemExit(f"{point_id} ({lat}, {lon}) is not open water in ETOPO (depth {depth})")

    rows = []
    snapped = {}
    for point_id, _, lat, lon in POINTS:
        for year in YEARS:
            series = {}
            for api in APIS:
                payload = fetch(api, point_id, lat, lon, year)
                snapped[(point_id, api)] = (payload["latitude"], payload["longitude"])
                hourly = payload["hourly"]
                series[api] = {name: dict(zip(hourly["time"], values)) for name, values in hourly.items() if name != "time"}
            for stamp in sorted(series["era5"]["wind_speed_10m"]):
                row = {"point_id": point_id, "time_utc": stamp + ":00Z"}
                for column, (api, variable, convert) in COLUMNS.items():
                    value = series[api][variable].get(stamp)
                    if value is not None and convert:
                        value = convert(value)
                    row[column] = None if value is None else round(value, 3)
                row["beaufort"] = None if row["wind_speed_10m_kn"] is None else beaufort(row["wind_speed_10m_kn"])
                row["sea_state_code"] = None if row["wave_height_m"] is None else sea_state_code(row["wave_height_m"])
                rows.append(row)
        log(f"  {point_id}: {sum(r['point_id'] == point_id for r in rows)} hours")

    out = PROCESSED / "ocean_weather" / "hourly_2023_2025.csv.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    log(f"  wrote   {out.relative_to(PROCESSED.parent.parent)} ({out.stat().st_size / 1e6:.1f} MB, {len(rows)} rows)")

    today = date.today().isoformat()
    write_json(
        APP_DATA / "ocean_weather_points.geojson",
        {
            "type": "FeatureCollection",
            "metadata": {
                "title": "Ocean/weather sample points",
                "generated": today,
                "models": {spec[1]: spec[3] for spec in APIS.values()},
            },
            "features": [
                {
                    "type": "Feature",
                    "id": point_id,
                    "properties": {
                        "name": name,
                        "depthM": bathymetry.depth(lon, lat),
                        "modelCell": {APIS[api][1]: snapped[(point_id, api)] for api in APIS},
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                }
                for point_id, name, lat, lon in POINTS
            ],
        },
    )
    write_json(APP_DATA / "ocean_climatology.json", climatology(rows, today))


def climatology(rows, today):
    groups = defaultdict(list)
    for row in rows:
        groups[(row["point_id"], int(row["time_utc"][5:7]))].append(row)

    def stats(values, digits=2):
        values = sorted(v for v in values if v is not None)
        if not values:
            return None
        p90 = values[min(len(values) - 1, int(0.9 * len(values)))]
        return {"mean": round(statistics.fmean(values), digits), "p50": round(statistics.median(values), digits), "p90": round(p90, digits)}

    def share(values, test):
        values = [v for v in values if v is not None]
        return round(sum(map(test, values)) / len(values), 4) if values else None

    points = {}
    for (point_id, month), group in sorted(groups.items()):
        points.setdefault(point_id, {})[str(month)] = {
            "hours": len(group),
            "waveHeightM": stats([r["wave_height_m"] for r in group]),
            "windSpeedKmh": stats([r["wind_speed_10m_kmh"] for r in group], 1),
            "windGustKmh": stats([r["wind_gusts_10m_kmh"] for r in group], 1),
            "currentSpeedMs": stats([r["current_speed_ms"] for r in group]),
            "seaSurfaceTemperatureC": stats([r["sea_surface_temperature_c"] for r in group]),
            "visibilityM": stats([r["visibility_m"] for r in group], 0),
            "precipitationMm": stats([r["precipitation_mm"] for r in group]),
            "shareBeaufort6Plus": share([r["beaufort"] for r in group], lambda b: b >= 6),
            "shareSeaStateRoughPlus": share([r["sea_state_code"] for r in group], lambda c: c >= 5),
        }
    return {
        "title": "Monthly ocean and weather climatology, 2023-2025",
        "source": "; ".join(f"{name}: {spec[3]}" for name, spec in APIS.items()) + " (via Open-Meteo, CC-BY 4.0)",
        "generated": today,
        "years": list(YEARS),
        "months": "1 = January, UTC hours",
        "definitions": {
            "shareBeaufort6Plus": "fraction of hours with WMO Beaufort force >= 6 (strong breeze, >= 22 kn)",
            "shareSeaStateRoughPlus": "fraction of hours with WMO sea state code >= 5 (rough, wave height > 2.5 m)",
        },
        "points": points,
    }


if __name__ == "__main__":
    main()
