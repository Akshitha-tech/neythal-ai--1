# Neythal maritime datasets

Real, offline datasets for Palk Strait, Palk Bay and the Gulf of Mannar
(7.5–10.8° N, 77.5–80.6° E), plus model-ready training tables for the
Neythal edge-AI features in the deck: IMBL protection, weather and sea risk,
fishing intelligence and voice safety alerts.

Nothing here is wired into the UI yet. App-ready files sit in
`public/data/maritime/` (listed in `manifest.json`), and typed loaders are in
`src/services/maritime/maritimeDatasets.ts`.

> **Not for navigation.** NOAA, Marine Regions and the treaties themselves say
> these sources are not navigational charts. Use them for awareness, alerts and
> modelling.

## What covers what

| Need (deck / request) | Dataset | Source |
|---|---|---|
| IMBL geofencing, "warn before you cross" (deck slide 4) | `imbl.geojson` | India–Sri Lanka treaties 1974 and 1976, cross-checked with Marine Regions (0.0 m difference at all 18 treaty positions in the region) |
| Restricted / territorial zones | `maritime_zones.geojson`, `osm_protected_areas.geojson` | Marine Regions v12 (12 NM, 24 NM, internal waters, baselines); OpenStreetMap (Gulf of Mannar Marine National Park and others) |
| Ports, harbours, offshore infrastructure | `osm_harbours.geojson`, `osm_hazards.geojson` | OpenStreetMap |
| Bathymetry / grounding risk | `bathymetry_etopo2022_30s.bin` + `.json` | NOAA NCEI ETOPO 2022 |
| Waves (sea-condition risk) | `ocean_weather/hourly_2023_2025.csv.gz`, `ocean_climatology.json`, `waves/noaa_ww3_daily_2023_2025.csv.gz`, `waves_monthly_climatology.json` | Copernicus Marine MFWAM; NOAA WaveWatch III |
| Ocean currents (drift awareness) | `ocean_weather/hourly_2023_2025.csv.gz`, `ocean_climatology.json` | Copernicus Marine SMOC |
| Sea surface temperature (fishing suitability) | `sst/noaa_oisst_daily_2023_2025.csv.gz`, `sst/noaa_coraltemp_monthly_2023_2025.csv.gz`, `sst_monthly_climatology.json`, plus SMOC SST in the hourly series | NOAA OISST v2.1; NOAA Coral Reef Watch CoralTemp; Copernicus Marine |
| Wind | hourly series (ERA5 and GFS columns), station observations | Copernicus ERA5; NOAA GFS; NOAA ISD stations |
| Weather / safety alerts (gusts, visibility, fog, thunderstorms, rain) | `weather_stations/noaa_isd_hourly_2023_2025.csv.gz`, `weather_station_climatology.json`, hourly series | NOAA NCEI ISD (IMD and Sri Lanka Met Dept station reports); NOAA GFS; ERA5 |
| Fishing information | `fisheries/fao_capture_india_srilanka_area57.csv`, `fisheries/seaaroundus_eez_catch.csv`, `fisheries_summary.json`, `chlorophyll/…`, `chlorophyll_monthly_climatology.json` | FAO Global Capture Production; Sea Around Us; NOAA/NASA VIIRS chlorophyll |
| AIS vessel trajectories (pasted list #1, #2) | `ais/noaa_fishing_tracks_1min.csv.gz` | NOAA MarineCadastre AIS (US waters, see gaps) |
| Vessel metadata | `ais/noaa_fishing_vessels.csv` | NOAA MarineCadastre AIS |
| Palk Strait trajectories with risk labels | `synthetic/palk_strait_tracks_1min.csv.gz` | **SIMULATED** from the real data above |
| Collision / near-miss examples (pasted list #6) | `ais/noaa_encounters.csv.gz` | Derived from NOAA AIS (CPA/TCPA) |
| Trajectory prediction training samples | `windows/*_trajectory_windows.csv.gz` (regenerate) | Derived |
| Chatbot answers | `public/neythal_maritime_knowledge.json` (existing, unchanged) | INCOIS, IMD |

Paths without a folder are in `public/data/maritime/`; the others are in
`data/processed/`.

## Datasets

### IMBL — `public/data/maritime/imbl.geojson`
- Four treaty segments as LineStrings: Palk Strait to Adam's Bridge (1974,
  positions 1–6), Gulf of Mannar (1976, 1m–13m), its extension to the
  India–Sri Lanka–Maldives trijunction (Nov 1976, 13m–T), and Bay of Bengal
  (1976, 1b–6b).
- Each feature keeps the treaty positions exactly as written
  (`properties.positions[].asWritten`). The line is densified every 500 m
  along great circles, as the treaties specify "arcs of great circles".
- The six boundary points in `src/MaritimeMap.tsx` are the 1974 treaty
  positions, rounded: each is within 4–89 m of the treaty value (89 m at
  position 4). So the Palk Bay line already in the app is correct. It lacks the
  Gulf of Mannar and Bay of Bengal segments, which are in this file.
- Script: `fetch_boundaries.py`. Treaty PDFs are kept in `data/raw/boundaries/`.

### Maritime zones — `maritime_zones.geojson`
Indian and Sri Lankan 12 NM territorial sea, 24 NM contiguous zone, Indian
internal waters, straight baselines and 200 NM lines, clipped to the region
and simplified to 25 m. Marine Regions Maritime Boundaries v12, CC-BY 4.0.

### Bathymetry — `bathymetry_etopo2022_30s.bin` / `.json`
397 × 373 grid, 30 arc-seconds (~925 m), int16 metres relative to mean sea
level (negative = water depth), rows north to south. The `.json` header has
the lookup formula. The grid cannot resolve small islands or reefs (e.g.
Katchatheevu), so use it with `osm_hazards.geojson`. Script: `fetch_bathymetry.py`.

### OpenStreetMap features
- `osm_harbours.geojson`: harbours, fishing ports, jetties (points with
  `category` fishing / port / jetty / harbour).
- `osm_hazards.geojson`: islands, islets, reefs, shoals, a wreck, lighthouses,
  lights, beacons, submarine cables and pipelines.
- `osm_protected_areas.geojson`: national parks and sanctuaries;
  `extendsOverWater` marks the marine ones (Gulf of Mannar Marine National
  Park, Point Calimere, Wilpattu).
- Coverage is community-mapped. Pamban, Mandapam and Jegathapattinam landing
  centres are not tagged yet. Script: `fetch_osm.py`. © OpenStreetMap
  contributors, ODbL 1.0.

### Hourly ocean and weather series — `data/processed/ocean_weather/hourly_2023_2025.csv.gz`
One row per sample point per UTC hour, 2023-01-01 to 2025-12-31, at 9
offshore points on the Indian side of the IMBL (`ocean_weather_points.geojson`).
Every variable is requested from a named model:

| Columns | Model |
|---|---|
| `wave_*`, `wind_wave_*`, `swell_wave_*` | Copernicus Marine MFWAM (Météo-France), 0.08° |
| `current_speed_ms`, `current_direction_deg`, `sea_surface_temperature_c`, `sea_level_msl_m` | Copernicus Marine SMOC (Météo-France), 0.08° |
| `wind_speed_10m_*`, `wind_direction_10m_deg`, `wind_gusts_10m_kmh`, `precipitation_mm`, `pressure_msl_hpa`, `cloud_cover_pct`, `air_temperature_2m_c`, `relative_humidity_2m_pct` | Copernicus ERA5 reanalysis |
| `gfs_*`, `visibility_m` | NOAA GFS archived forecasts (ERA5 has no visibility) |
| `beaufort` | WMO Beaufort scale from ERA5 wind |
| `sea_state_code` | WMO code table 3700 (Douglas) from wave height |

Fetched through Open-Meteo (CC-BY 4.0). `ocean_climatology.json` summarises
it by point and month (mean/median/p90, share of hours at Beaufort ≥ 6 and at
rough sea or worse). Script: `fetch_ocean_weather.py`.

### NOAA gridded SST and waves — `data/processed/sst/`, `data/processed/waves/`
- OISST v2.1, daily, 0.25°: `sst_c`, `sst_anomaly_c`.
- Coral Reef Watch CoralTemp v3.1, monthly, 5 km: `sst_c`, `sst_anomaly_c`.
  Averaged by calendar month into `sst_monthly_climatology.json`.
- WaveWatch III, 0.5°, one sample a day (12:00 UTC): wave height, period,
  direction and swell height. Averaged into `waves_monthly_climatology.json`. The 0.5° cells
  are coarse for Palk Bay, so prefer the MFWAM series there.
- Script: `fetch_noaa_grids.py`.

### Chlorophyll-a — `data/processed/chlorophyll/viirs_chla_monthly_2023_2025.csv.gz`
NOAA/NASA S-NPP VIIRS science-quality monthly composites, 4 km product sampled
at 0.075°. Cloud-covered cell-months are absent. Monthly averages are in
`chlorophyll_monthly_climatology.json`. Script: `fetch_chlorophyll.py`.

### Coastal weather observations — `data/processed/weather_stations/noaa_isd_hourly_2023_2025.csv.gz`
Station reports (mostly 3-hourly synoptic) from Pamban, Tondi, Adiramapattinam,
Nagapattinam, Tuticorin New Port, Kanyakumari, Jaffna, Mannar and Puttalam,
via NOAA NCEI ISD. Decoded wind, gust, visibility, temperature, dew point,
pressure, precipitation and WMO present-weather code. Flags: `fog`
(visibility < 1000 m) and `thunderstorm` (WMO codes 17, 91–99). Values NOAA
flags as suspect or erroneous are dropped. These are observations, so they
can check the modelled series. Script: `fetch_weather_stations.py`.

### Fisheries — `data/processed/fisheries/`
- `fao_capture_india_srilanka_area57.csv`: official catch reported to FAO by
  India and Sri Lanka in FAO Major Fishing Area 57 (Eastern Indian Ocean, which
  includes Palk Bay and the Gulf of Mannar), 2000–2023, by species. CC BY 4.0.
- `seaaroundus_eez_catch.csv`: Sea Around Us reconstructed catch for "India
  (mainland)" and "Sri Lanka" EEZs, 1950–2019, by taxon, gear and reporting
  status. **CC BY-NC 4.0 (non-commercial only).**
- `fisheries_summary.json`: top species and gear shares for recent years.
- Script: `fetch_fisheries.py`.

### NOAA AIS fishing tracks — `data/processed/ais/`
Three days of NOAA MarineCadastre AIS (10 Jan, 15 Apr, 15 Jul 2023),
vessel type 30 (fishing):
- `noaa_fishing_tracks_1min.csv.gz`: tracks split at gaps > 10 min,
  resampled to one fix per minute. Columns: `track_id, vessel_id, time_utc,
  lat, lon, sog_kn, cog_deg, heading_deg, nav_status, length_m`.
- `noaa_fishing_vessels.csv`: length, width, draft, transceiver class.
- `noaa_encounters.csv.gz`: every time a moving fishing vessel came within
  2 NM of another vessel, with minimum range, the closest point of approach in
  the next 20 minutes (CPA) and time to it (TCPA), and the other vessel's type.
- `fishing_motion_stats.json`: speed and turn-rate distributions by status and
  1,500 replayable 30-minute motion snippets.
- MMSI numbers are replaced by salted hashes.
- Scripts: `fetch_ais_noaa.py`, `process_ais_noaa.py`.

### Simulated Palk Strait trips — `data/processed/synthetic/palk_strait_tracks_1min.csv.gz`
**SIMULATED.** Built because no open AIS exists for Indian waters. Real inputs
only: motion replayed from the NOAA snippets, departures from 17 Indian-side
OSM harbours, fixes kept on water ≥ 1.5 m deep, treaty IMBL, real hourly weather
at the nearest sample point. Labels are computed from geometry:

| Column | Meaning |
|---|---|
| `dist_to_imbl_nm` | distance to the IMBL treaty line |
| `side_of_imbl` | `IN` or `LK` (by line-crossing parity) |
| `minutes_to_imbl_crossing` | minutes until the track crosses into `LK`, if within 60 |
| `crosses_imbl_within_{10,20,30}min` | 1/0 labels for "warn before you cross" (blank once beyond the line) |
| `depth_m`, `min_depth_next_10min_m` | ETOPO depth now and the shallowest in the next 10 minutes |
| `protected_area` | marine protected area the fix is in, if any |
| `nearest_hazard_nm` | nearest reef/shoal/wreck/island vertex within 2 NM |
| weather columns | wave height, sea state, wind, Beaufort, gusts, visibility, current, SST, rain at that hour |

Sampling choices (in the script, not facts about the fleet): from harbours
with such grounds in range, 35% of trips aim for grounds 0.5–6 NM from the
IMBL so crossings are not too rare; trips stay
within 30 NM of home; departure times are uniform over 2023–2025.
`summary.json` has the counts. Script: `generate_palk_tracks.py`.

### Trajectory windows — `data/processed/windows/` (gitignored)
`make_trajectory_windows.py` turns any one-minute track file into
"past 10 fixes → next 20 fixes" samples in metres relative to the current
position (5, 10 and 20-minute horizons included). The Palk Strait file also
carries the labels above. Regenerate in about a minute.

## Columns for the AI models

| Model | Inputs | Target |
|---|---|---|
| Trajectory prediction | `past{1..9}_dx_m, past{1..9}_dy_m, past{0..9}_sog_kn, past{0..9}_cog_sin/cos` (windows) | `future{1..20}_dx_m, future{1..20}_dy_m` |
| IMBL crossing warning | `dist_to_imbl_nm`, recent motion (windows), `sog_kn`, `cog_deg` | `crosses_imbl_within_{10,20,30}min` |
| Dynamic danger zone | predicted positions (trajectory model) + `imbl.geojson` + `maritime_zones.geojson` + `osm_protected_areas.geojson` | polygon swept by the predicted path |
| Weather / sea risk | `wave_height_m, sea_state_code, wind_speed_10m_kn, beaufort, wind_gusts_10m_kmh, visibility_m, current_speed_ms, precipitation_mm` | WMO-scale thresholds the team chooses (see open decisions) |
| Grounding risk | `depth_m, min_depth_next_10min_m, nearest_hazard_nm`, vessel draft | depth vs draft |
| Collision / near miss | `noaa_encounters.csv.gz`: `min_range_nm, min_cpa_nm_next_20min, tcpa_at_min_cpa_min`, speeds, other vessel type | CPA/TCPA thresholds the team chooses |
| Fishing suitability | SST (OISST/CoralTemp/SMOC), chlorophyll-a, wave height, wind, `fisheries_summary.json` species | existing score in `src/utils/fishing/calculateFishingRisk.ts` |

## Gaps and limits

- **No open AIS for Indian waters.** NOAA AIS covers US waters only, so it is
  used for motion behaviour. The Palk Strait tracks are simulated. Real
  regional AIS-derived data exists at Global Fishing Watch
  (https://globalfishingwatch.org/our-apis/), which needs a free account and
  API token that the team must request.
- **No open incident or accident database for this region.** The labels here
  are derived (IMBL crossing from geometry, near misses from CPA/TCPA), not
  real incident records. Real labels would need data from the Indian Coast
  Guard or the Tamil Nadu Fisheries Department.
- **INCOIS Potential Fishing Zone advisories** are published as maps and text
  on incois.gov.in. They are not available as downloadable data, and the
  INCOIS ERDDAP server has no PFZ dataset. Historical PFZ data has to be
  requested from INCOIS.
- **IMD fishermen warnings** have no machine-readable archive.
- ETOPO depth (~925 m cells) misses small islands and reefs. OSM hazard
  coverage is uneven.
- Station observations are mostly 3-hourly, and Tuticorin New Port is sparse.
- Sea Around Us data is non-commercial (CC BY-NC 4.0).

## Open decisions for the team

- **Zone thresholds:** the deck shows 8 / 5 / 2 / < 1 **NM**, while
  `src/MaritimeMap.tsx` uses 10 / 5 / 2 **km** (1 NM = 1.852 km). The datasets
  store raw distances so either choice works.
- Weather-risk and CPA thresholds for SAFE / CAUTION / WARNING / CRITICAL.

## Rebuilding

Python 3.10+ standard library only; no packages to install. Run from the repo root:

```bash
python3 scripts/data/fetch_boundaries.py
python3 scripts/data/fetch_bathymetry.py
python3 scripts/data/fetch_osm.py
python3 scripts/data/fetch_ocean_weather.py
python3 scripts/data/fetch_noaa_grids.py
python3 scripts/data/fetch_chlorophyll.py
python3 scripts/data/fetch_weather_stations.py
python3 scripts/data/fetch_fisheries.py
python3 scripts/data/fetch_ais_noaa.py
python3 scripts/data/process_ais_noaa.py
python3 scripts/data/generate_palk_tracks.py
python3 scripts/data/make_trajectory_windows.py
python3 scripts/data/build_manifest.py
python3 -m unittest discover -s scripts/data -p "test_*.py"
```

Raw downloads go to `data/raw/` (gitignored, about 1.1 GB, mostly the AIS
zips) and are reused if present. The AIS download is the slow step: NOAA
throttles to about 1 MB/s, so three days take 15–40 minutes.

## Attribution

- Marine Regions: Flanders Marine Institute (2023). Maritime Boundaries
  Geodatabase v12. https://www.marineregions.org/ CC-BY 4.0.
- OpenStreetMap: © OpenStreetMap contributors, ODbL 1.0.
- Open-Meteo (https://open-meteo.com/), CC-BY 4.0, with data from Copernicus
  Marine Service (MFWAM, SMOC), Copernicus Climate Change Service (ERA5) and
  NOAA NCEP (GFS).
- NOAA: NCEI ETOPO 2022 (doi:10.25921/fd45-gt74), OISST v2.1, Coral Reef
  Watch CoralTemp, NCEP WaveWatch III, NCEI ISD, MarineCadastre AIS; NOAA/NASA
  VIIRS chlorophyll via CoastWatch ERDDAP.
- FAO. Global Capture Production 1950–2023 (FishStat), CC BY 4.0.
- Sea Around Us: Pauly D., Zeller D., Palomares M.L.D. (Editors), Sea Around Us
  Concepts, Design and Data (www.seaaroundus.org), CC BY-NC 4.0.
