/* =========================================================
   MARITIME DATASETS
   ---------------------------------------------------------
   Typed loaders for the offline datasets in public/data/maritime
   (built by scripts/data, documented in data/README.md).
   Not wired into any component yet: import from here when a
   feature needs real boundary, depth, ocean or fisheries data.
   None of these datasets is approved for navigation.
========================================================= */

import type { GeoPosition } from "../fishing/types";

const BASE_PATH = `${import.meta.env.BASE_URL}data/maritime/`;
const EARTH_RADIUS_M = 6_371_008.8;
const NM_M = 1852;

export interface DatasetManifestEntry {
  id: string;
  files: string[];
  bytes: number;
  generated: string | null;
  use: string;
  source: string;
  licence: string;
}

export interface DatasetManifest {
  title: string;
  generated: string;
  basePath: string;
  notForNavigation: boolean;
  datasets: DatasetManifestEntry[];
}

export interface TreatyPosition {
  id: string;
  latitude: number;
  longitude: number;
  asWritten: string;
}

export interface ImblFeature {
  type: "Feature";
  id: string;
  properties: {
    kind: "IMBL";
    name: string;
    treaty: string;
    signed: string;
    sourceUrl: string;
    positions: TreatyPosition[];
  };
  geometry: { type: "LineString"; coordinates: GeoPosition[] };
}

export interface GeoJsonCollection<P = Record<string, unknown>> {
  type: "FeatureCollection";
  metadata?: Record<string, unknown>;
  features: Array<{
    type: "Feature";
    id?: string;
    properties: P;
    geometry: { type: string; coordinates: unknown };
  }>;
}

export interface BathymetryHeader {
  file: string;
  rows: number;
  cols: number;
  northLat: number;
  westLon: number;
  stepDeg: number;
}

/** Monthly value grid, months keyed "1".."12", rows north to south. */
export interface MonthlyGrid {
  grid: { lats: number[]; lons: number[] };
  months: Record<string, Array<Array<number | null>>>;
}

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(`${BASE_PATH}${name}`).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${name}: ${response.status}`);
        }
        return response.json();
      })
    );
  }
  return cache.get(name) as Promise<T>;
}

export const loadManifest = () => fetchJson<DatasetManifest>("manifest.json");
export const loadImbl = () =>
  fetchJson<GeoJsonCollection & { features: ImblFeature[] }>("imbl.geojson");
export const loadMaritimeZones = () => fetchJson<GeoJsonCollection>("maritime_zones.geojson");
export const loadHarbours = () => fetchJson<GeoJsonCollection>("osm_harbours.geojson");
export const loadHazards = () => fetchJson<GeoJsonCollection>("osm_hazards.geojson");
export const loadProtectedAreas = () => fetchJson<GeoJsonCollection>("osm_protected_areas.geojson");
export const loadOceanWeatherPoints = () => fetchJson<GeoJsonCollection>("ocean_weather_points.geojson");
export const loadOceanClimatology = () => fetchJson<Record<string, unknown>>("ocean_climatology.json");
export const loadWeatherStations = () => fetchJson<GeoJsonCollection>("weather_stations.geojson");
export const loadWeatherStationClimatology = () =>
  fetchJson<Record<string, unknown>>("weather_station_climatology.json");
export const loadFisheriesSummary = () => fetchJson<Record<string, unknown>>("fisheries_summary.json");
export const loadSstClimatology = () => fetchJson<MonthlyGrid>("sst_monthly_climatology.json");
export const loadChlorophyllClimatology = () =>
  fetchJson<MonthlyGrid>("chlorophyll_monthly_climatology.json");
export const loadWavesClimatology = () =>
  fetchJson<{ grid: MonthlyGrid["grid"]; meanM: MonthlyGrid["months"]; p90M: MonthlyGrid["months"] }>(
    "waves_monthly_climatology.json"
  );

/* =========================================================
   BATHYMETRY
========================================================= */

export interface Bathymetry {
  header: BathymetryHeader;
  /** Metres relative to mean sea level (negative = below), or null outside the grid. */
  elevationAt(latitude: number, longitude: number): number | null;
  /** Positive water depth in metres (0 on land), or null outside the grid. */
  depthAt(latitude: number, longitude: number): number | null;
}

let bathymetryPromise: Promise<Bathymetry> | null = null;

export function loadBathymetry(): Promise<Bathymetry> {
  bathymetryPromise ??= (async () => {
    const header = await fetchJson<BathymetryHeader>("bathymetry_etopo2022_30s.json");
    const response = await fetch(`${BASE_PATH}${header.file}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${header.file}: ${response.status}`);
    }
    const view = new DataView(await response.arrayBuffer());

    const elevationAt = (latitude: number, longitude: number) => {
      const row = Math.round((header.northLat - latitude) / header.stepDeg);
      const col = Math.round((longitude - header.westLon) / header.stepDeg);
      if (row < 0 || row >= header.rows || col < 0 || col >= header.cols) {
        return null;
      }
      return view.getInt16((row * header.cols + col) * 2, true);
    };

    return {
      header,
      elevationAt,
      depthAt(latitude, longitude) {
        const elevation = elevationAt(latitude, longitude);
        return elevation === null ? null : Math.max(0, -elevation);
      },
    };
  })();
  return bathymetryPromise;
}

/* =========================================================
   GEOMETRY HELPERS
========================================================= */

function toLocalMetres(longitude: number, latitude: number, originLon: number, originLat: number) {
  const k = (Math.PI / 180) * EARTH_RADIUS_M;
  return [
    (longitude - originLon) * k * Math.cos((originLat * Math.PI) / 180),
    (latitude - originLat) * k,
  ] as const;
}

/** Shortest distance in nautical miles from a point to the IMBL treaty segments. */
export function distanceToImblNm(latitude: number, longitude: number, imbl: ImblFeature[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const feature of imbl) {
    const positions = feature.properties.positions;
    for (let i = 0; i < positions.length - 1; i++) {
      const [ax, ay] = toLocalMetres(positions[i].longitude, positions[i].latitude, longitude, latitude);
      const [bx, by] = toLocalMetres(positions[i + 1].longitude, positions[i + 1].latitude, longitude, latitude);
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best / NM_M;
}

/** Nearest-cell value from a monthly climatology grid, or null outside / no data. */
export function monthlyGridValue(
  data: MonthlyGrid,
  month: number,
  latitude: number,
  longitude: number
): number | null {
  const { lats, lons } = data.grid;
  const nearest = (values: number[], target: number) =>
    values.reduce((best, value, index) => (Math.abs(value - target) < Math.abs(values[best] - target) ? index : best), 0);
  const row = nearest(lats, latitude);
  const col = nearest(lons, longitude);
  const step = Math.abs(lats[1] - lats[0]) || 1;
  if (Math.abs(lats[row] - latitude) > step || Math.abs(lons[col] - longitude) > step) {
    return null;
  }
  return data.months[String(month)]?.[row]?.[col] ?? null;
}
