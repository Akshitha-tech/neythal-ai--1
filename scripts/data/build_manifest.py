"""Write public/data/maritime/manifest.json: one entry per app-ready dataset.

The app (or a service worker caching for offline use) can read this one file
to discover every dataset, its source, licence and size.
"""

from __future__ import annotations

from datetime import date

from _common import APP_DATA, ROOT, log, read_json, write_json

DATASETS = {
    "imbl.geojson": {
        "use": "IMBL geofencing and distance-to-boundary alerts",
        "source": "India-Sri Lanka boundary treaties 1974 and 1976; cross-checked with Marine Regions v12",
        "licence": "Treaty text (public); Marine Regions CC-BY 4.0",
    },
    "maritime_zones.geojson": {
        "use": "Territorial sea (12 NM), contiguous zone (24 NM), internal waters, baselines",
        "source": "Marine Regions Maritime Boundaries v12 (Flanders Marine Institute)",
        "licence": "CC-BY 4.0",
    },
    "bathymetry_etopo2022_30s.json": {
        "use": "Water depth for grounding risk (header; grid in the .bin file)",
        "source": "NOAA NCEI ETOPO 2022, 30 arc-second subset",
        "licence": "NOAA, free to use; not for navigation",
        "files": ["bathymetry_etopo2022_30s.bin"],
    },
    "osm_harbours.geojson": {
        "use": "Harbours, fishing ports and jetties",
        "source": "OpenStreetMap",
        "licence": "ODbL 1.0, (c) OpenStreetMap contributors",
    },
    "osm_hazards.geojson": {
        "use": "Reefs, shoals, wrecks, islands, lights, cables and pipelines",
        "source": "OpenStreetMap",
        "licence": "ODbL 1.0, (c) OpenStreetMap contributors",
    },
    "osm_protected_areas.geojson": {
        "use": "Marine national park and sanctuaries (restricted-activity zones)",
        "source": "OpenStreetMap",
        "licence": "ODbL 1.0, (c) OpenStreetMap contributors",
    },
    "ocean_weather_points.geojson": {
        "use": "Sample points for the hourly ocean/weather series",
        "source": "Open-Meteo (Copernicus Marine MFWAM and SMOC, ERA5, NOAA GFS)",
        "licence": "CC-BY 4.0",
    },
    "ocean_climatology.json": {
        "use": "Offline sea-state, wind, current, SST and visibility statistics by month",
        "source": "Open-Meteo (Copernicus Marine MFWAM and SMOC, ERA5, NOAA GFS), 2023-2025",
        "licence": "CC-BY 4.0",
    },
    "sst_monthly_climatology.json": {
        "use": "Sea surface temperature map by month (fishing suitability)",
        "source": "NOAA Coral Reef Watch CoralTemp v3.1, 5 km",
        "licence": "NOAA, free to use",
    },
    "chlorophyll_monthly_climatology.json": {
        "use": "Chlorophyll-a map by month (fishing suitability / productivity)",
        "source": "NOAA NESDIS / NASA S-NPP VIIRS, 4 km monthly",
        "licence": "NASA Earth science data policy, free to use",
    },
    "waves_monthly_climatology.json": {
        "use": "Wave height map by month (sea-condition risk)",
        "source": "NOAA NCEP WaveWatch III, 0.5 deg",
        "licence": "NOAA, free to use",
    },
    "weather_stations.geojson": {
        "use": "Coastal weather stations (observations)",
        "source": "NOAA NCEI Integrated Surface Database (IMD and Sri Lanka Met Dept reports)",
        "licence": "NOAA, public domain",
    },
    "weather_station_climatology.json": {
        "use": "Observed wind, fog and thunderstorm frequency by month",
        "source": "NOAA NCEI Integrated Surface Database, 2023-2025",
        "licence": "NOAA, public domain",
    },
    "fisheries_summary.json": {
        "use": "Main species and fishing gears (fishing information)",
        "source": "FAO Global Capture Production 2025.1.0 (Area 57); Sea Around Us EEZ reconstruction",
        "licence": "FAO CC BY 4.0; Sea Around Us CC BY-NC 4.0",
    },
}


def main() -> None:
    entries = []
    for name, info in DATASETS.items():
        path = APP_DATA / name
        if not path.exists():
            raise SystemExit(f"{name} is missing; run the fetch scripts first")
        files = [name, *info.get("files", [])]
        size = sum((APP_DATA / f).stat().st_size for f in files)
        payload = read_json(path)
        generated = (payload.get("metadata") or {}).get("generated") or payload.get("generated")
        entries.append(
            {"id": name.split(".")[0], "files": files, "bytes": size, "generated": generated}
            | {k: v for k, v in info.items() if k != "files"}
        )
    write_json(
        APP_DATA / "manifest.json",
        {
            "title": "Neythal maritime datasets",
            "generated": date.today().isoformat(),
            "basePath": "/data/maritime/",
            "documentation": "data/README.md",
            "notForNavigation": True,
            "datasets": entries,
        },
        indent=2,
    )
    log(f"  {len(entries)} datasets, {sum(e['bytes'] for e in entries) / 1e6:.2f} MB in {APP_DATA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
