"""Observed hourly weather at coastal stations around Palk Strait and the Gulf of Mannar.

Source: NOAA NCEI Integrated Surface Database (ISD) "global-hourly", which
archives the synoptic/METAR reports of the India Meteorological Department and
the Sri Lanka Department of Meteorology stations below. Public domain (NOAA).
  https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database
Field decoding follows the ISD format document (ISD Format Document, NCEI);
values flagged suspect or erroneous (quality codes 2, 3, 6, 7) are dropped.

These are observations, so they also serve as ground truth for the modelled
wind/visibility series in fetch_ocean_weather.py.

Derived columns use WMO standards:
- beaufort              WMO Beaufort force from mean wind
- fog                   visibility < 1000 m (WMO definition of fog)
- thunderstorm          present-weather code 17 or 91-99 (WMO code table 4677)

Outputs
- data/processed/weather_stations/noaa_isd_hourly_2023_2025.csv.gz
- public/data/maritime/weather_stations.geojson
- public/data/maritime/weather_station_climatology.json   monthly statistics per station
- data/raw/weather_stations/                               raw ISD CSV per station-year
"""

from __future__ import annotations

import csv
import gzip
import statistics
import urllib.error
from collections import defaultdict
from datetime import date

from _common import APP_DATA, NM_M, PROCESSED, RAW, download, log, write_json
from fetch_ocean_weather import beaufort

BASE = "https://www.ncei.noaa.gov/data/global-hourly/access"
YEARS = (2023, 2024, 2025)

# Coastal stations inside the region (ISD station history, isd-history.csv).
# Vedaranyam (43349099999) is left out: it has 2 observations in 2023-2025.
STATIONS = {
    "43363099999": "Pamban",
    "43361099999": "Tondi",
    "43348099999": "Adiramapattinam",
    "43347099999": "Nagapattinam",
    "43379099999": "Tuticorin New Port",
    "43377099999": "Kanyakumari",
    "43404099999": "Jaffna",
    "43413099999": "Mannar",
    "43424099999": "Puttalam",
}

BAD_QUALITY = {"2", "3", "6", "7"}
THUNDER_CODES = {17} | set(range(91, 100))


def parts(value: str) -> list[str]:
    return value.split(",") if value else []


def scaled(raw: str, quality: str, missing: str, scale: float) -> float | None:
    if not raw or raw.lstrip("+-") == missing.lstrip("+-") or quality in BAD_QUALITY:
        return None
    return int(raw) / scale


def decode(record: dict) -> dict:
    wnd = parts(record.get("WND", ""))
    direction = speed = None
    if len(wnd) == 5:
        if wnd[1] not in BAD_QUALITY and wnd[0] != "999":
            direction = int(wnd[0])
        speed = scaled(wnd[3], wnd[4], "9999", 10)
        if wnd[2] == "C" and speed is None:
            speed = 0.0
    vis = parts(record.get("VIS", ""))
    tmp = parts(record.get("TMP", ""))
    dew = parts(record.get("DEW", ""))
    slp = parts(record.get("SLP", ""))
    aa1 = parts(record.get("AA1", ""))
    oc1 = parts(record.get("OC1", ""))
    mw1 = parts(record.get("MW1", ""))
    visibility = scaled(vis[0], vis[1], "999999", 1) if len(vis) == 4 else None
    weather = int(mw1[0]) if len(mw1) == 2 and mw1[1] not in BAD_QUALITY else None
    return {
        "wind_direction_deg": direction,
        "wind_speed_ms": speed,
        "wind_speed_kn": None if speed is None else round(speed * 3600 / NM_M, 1),
        "beaufort": None if speed is None else beaufort(speed * 3600 / NM_M),
        "wind_gust_ms": scaled(oc1[0], oc1[1], "9999", 10) if len(oc1) == 2 else None,
        "visibility_m": visibility,
        "fog": None if visibility is None else int(visibility < 1000),
        "air_temperature_c": scaled(tmp[0], tmp[1], "+9999", 10) if len(tmp) == 2 else None,
        "dew_point_c": scaled(dew[0], dew[1], "+9999", 10) if len(dew) == 2 else None,
        "sea_level_pressure_hpa": scaled(slp[0], slp[1], "99999", 10) if len(slp) == 2 else None,
        "precip_period_h": int(aa1[0]) if len(aa1) == 4 and aa1[0] != "99" else None,
        "precip_mm": scaled(aa1[1], aa1[3], "9999", 10) if len(aa1) == 4 else None,
        "present_weather_code": weather,
        "thunderstorm": None if weather is None else int(weather in THUNDER_CODES),
    }


def main() -> None:
    rows = []
    stations = {}
    for station, name in STATIONS.items():
        seen = set()
        for year in YEARS:
            try:
                path = download(f"{BASE}/{year}/{station}.csv", RAW / "weather_stations" / f"{station}_{year}.csv")
            except urllib.error.HTTPError as error:
                log(f"  {name} {year}: not available ({error.code})")
                continue
            with open(path, newline="", encoding="utf-8") as handle:
                for record in csv.DictReader(handle):
                    stamp = record["DATE"][:16]
                    if stamp in seen:
                        continue  # same hour reported twice (SYNOP + METAR)
                    seen.add(stamp)
                    info = stations.setdefault(
                        station,
                        {"name": name, "isdName": record["NAME"], "lat": float(record["LATITUDE"]),
                         "lon": float(record["LONGITUDE"]), "elevationM": float(record["ELEVATION"]),
                         "first": stamp, "last": stamp, "observations": 0},
                    )
                    info["last"] = max(info["last"], stamp)
                    info["first"] = min(info["first"], stamp)
                    info["observations"] += 1
                    rows.append({"station_id": station, "station": name, "time_utc": stamp + ":00Z", "report_type": record["REPORT_TYPE"].strip()} | decode(record))
        log(f"  {name}: {stations.get(station, {}).get('observations', 0):,} observations")

    rows.sort(key=lambda r: (r["station_id"], r["time_utc"]))
    out = PROCESSED / "weather_stations" / "noaa_isd_hourly_2023_2025.csv.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wt", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    log(f"  wrote   {out.name} ({len(rows):,} rows, {out.stat().st_size / 1e6:.1f} MB)")

    today = date.today().isoformat()
    write_json(
        APP_DATA / "weather_stations.geojson",
        {
            "type": "FeatureCollection",
            "metadata": {"title": "Coastal weather stations (observations)", "source": "NOAA NCEI ISD global-hourly", "generated": today},
            "features": [
                {
                    "type": "Feature",
                    "id": station,
                    "properties": {k: v for k, v in info.items() if k not in ("lat", "lon")},
                    "geometry": {"type": "Point", "coordinates": [info["lon"], info["lat"]]},
                }
                for station, info in stations.items()
            ],
        },
    )
    write_json(APP_DATA / "weather_station_climatology.json", climatology(rows, stations, today))


def climatology(rows, stations, today):
    groups = defaultdict(list)
    for r in rows:
        groups[(r["station_id"], int(r["time_utc"][5:7]))].append(r)

    def mean(values, digits=1):
        values = [v for v in values if v is not None]
        return round(statistics.fmean(values), digits) if values else None

    def share(values):
        values = [v for v in values if v is not None]
        return round(sum(values) / len(values), 4) if values else None

    out = {}
    for (station, month), group in sorted(groups.items()):
        winds = sorted(r["wind_speed_kn"] for r in group if r["wind_speed_kn"] is not None)
        out.setdefault(station, {"name": stations[station]["name"], "months": {}})["months"][str(month)] = {
            "observations": len(group),
            "windMeanKn": mean(winds),
            "windP90Kn": winds[int(0.9 * (len(winds) - 1))] if winds else None,
            "shareBeaufort6Plus": share([None if r["beaufort"] is None else int(r["beaufort"] >= 6) for r in group]),
            "shareFog": share([r["fog"] for r in group]),
            "shareThunderstorm": share([r["thunderstorm"] for r in group]),
            "airTemperatureMeanC": mean([r["air_temperature_c"] for r in group]),
        }
    return {
        "title": "Observed monthly weather statistics at coastal stations, 2023-2025",
        "source": "NOAA NCEI Integrated Surface Database (ISD) global-hourly",
        "generated": today,
        "definitions": {
            "shareBeaufort6Plus": "fraction of observations with WMO Beaufort force >= 6",
            "shareFog": "fraction of observations with visibility < 1000 m (WMO fog definition)",
            "shareThunderstorm": "fraction of observations with present weather 17 or 91-99 (WMO 4677)",
        },
        "stations": out,
    }


if __name__ == "__main__":
    main()
