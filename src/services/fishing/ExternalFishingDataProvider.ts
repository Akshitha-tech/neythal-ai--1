import type {
  DataSource,
  FishingActivitySnapshot,
  FishingDataProvider,
  FishingVessel,
  FishingZoneGeometry,
  FishingZone,
  OceanCondition,
} from "./types";

const source: DataSource = "LIVE";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseArray<T>(
  value: unknown,
  label: string,
  validate: (item: unknown) => item is T
): T[] {
  if (!Array.isArray(value) || !value.every(validate)) {
    throw new Error(`Live fishing API returned invalid ${label} data.`);
  }

  return value;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isGeoPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isCoordinate(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    isCoordinate(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function isLinearRing(value: unknown): value is [number, number][] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isGeoPosition)) {
    return false;
  }
  const first = value[0];
  const last = value[value.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isPolygonCoordinates(value: unknown): value is [number, number][][] {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing);
}

function isZoneGeometry(value: unknown): value is FishingZoneGeometry {
  if (!isRecord(value) || !Array.isArray(value.coordinates)) return false;
  if (value.type === "Polygon") return isPolygonCoordinates(value.coordinates);
  if (value.type === "MultiPolygon") {
    return (
      value.coordinates.length > 0 &&
      value.coordinates.every(isPolygonCoordinates)
    );
  }
  return false;
}

function withLiveSource<T extends { source: DataSource }>(item: T): T {
  return { ...item, source };
}

export class ExternalFishingDataProvider implements FishingDataProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = import.meta.env.VITE_FISHING_DATA_API_URL?.trim()) {
    this.baseUrl = baseUrl?.replace(/\/+$/, "") ?? "";
  }

  private async getData<T>(
    path: string,
    label: string,
    validate: (item: unknown) => item is T
  ): Promise<T[]> {
    if (!this.baseUrl) {
      throw new Error(
        "Live fishing data is not configured. Set VITE_FISHING_DATA_API_URL to a trusted API proxy."
      );
    }

    const response = await fetch(`${this.baseUrl}/${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(
        `Live fishing API request for ${label} failed (${response.status}).`
      );
    }

    return parseArray(await response.json(), label, validate);
  }

  getFishingZones(): Promise<FishingZone[]> {
    return this.getData("zones", "fishing zones", (item): item is FishingZone => {
      if (!isRecord(item) || !isRecord(item.center)) return false;
      return (
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        isZoneGeometry(item.geometry) &&
        typeof item.center.latitude === "number" &&
        item.center.latitude >= -90 &&
        item.center.latitude <= 90 &&
        typeof item.center.longitude === "number" &&
        item.center.longitude >= -180 &&
        item.center.longitude <= 180 &&
        (item.zoneType === "FISHING" || item.zoneType === "RESTRICTED") &&
        isCoordinate(item.activityScore) &&
        item.activityScore >= 0 &&
        item.activityScore <= 100 &&
        isCoordinate(item.vesselCount) &&
        item.vesselCount >= 0 &&
        isCoordinate(item.confidence) &&
        item.confidence >= 0 &&
        item.confidence <= 1 &&
        isTimestamp(item.timestamp) &&
        isTimestamp(item.lastUpdated) &&
        (item.species === undefined ||
          (Array.isArray(item.species) &&
            item.species.every((species) => typeof species === "string"))) &&
        (item.riskLevel === "LOW" ||
          item.riskLevel === "MODERATE" ||
          item.riskLevel === "HIGH" ||
          item.riskLevel === "CRITICAL")
      );
    }).then((zones) => zones.map(withLiveSource));
  }

  getVessels(): Promise<FishingVessel[]> {
    return this.getData("vessels", "vessel", (item): item is FishingVessel => (
      isRecord(item) &&
      typeof item.id === "string" &&
      isCoordinate(item.latitude) && item.latitude >= -90 && item.latitude <= 90 &&
      isCoordinate(item.longitude) && item.longitude >= -180 && item.longitude <= 180 &&
      (item.heading === undefined || isCoordinate(item.heading)) &&
      (item.speed === undefined || isCoordinate(item.speed)) &&
      (item.fishingActivity === undefined ||
        (isCoordinate(item.fishingActivity) &&
          item.fishingActivity >= 0 &&
          item.fishingActivity <= 100)) &&
      (item.vesselType === undefined || typeof item.vesselType === "string") &&
      isCoordinate(item.confidence) && item.confidence >= 0 && item.confidence <= 1 &&
      isTimestamp(item.timestamp) &&
      isTimestamp(item.lastUpdated)
    )).then((vessels) =>
      vessels.map((vessel) => ({
        ...withLiveSource(vessel),
        fishingActivity:
          vessel.fishingActivity !== undefined && vessel.fishingActivity <= 1
            ? vessel.fishingActivity * 100
            : vessel.fishingActivity,
      }))
    );
  }

  getOceanConditions(): Promise<OceanCondition[]> {
    return this.getData("ocean-conditions", "ocean condition", (item): item is OceanCondition => (
      isRecord(item) &&
      isCoordinate(item.latitude) && item.latitude >= -90 && item.latitude <= 90 &&
      isCoordinate(item.longitude) && item.longitude >= -180 && item.longitude <= 180 &&
      ["seaSurfaceTemperature", "waveHeight", "windSpeed", "windDirectionDegrees", "currentSpeed", "chlorophyll"]
        .every((field) => item[field] === undefined || isCoordinate(item[field])) &&
      (item.windDirection === undefined || typeof item.windDirection === "string") &&
      isCoordinate(item.confidence) && item.confidence >= 0 && item.confidence <= 1 &&
      isTimestamp(item.timestamp) &&
      isTimestamp(item.lastUpdated)
    )).then((conditions) => conditions.map(withLiveSource));
  }

  getFishingActivity(): Promise<FishingActivitySnapshot[]> {
    return this.getData(
      "activity",
      "fishing activity",
      (item): item is FishingActivitySnapshot =>
        isRecord(item) &&
        typeof item.zoneId === "string" &&
        isTimestamp(item.timestamp) &&
        isCoordinate(item.confidence) &&
        item.confidence >= 0 &&
        item.confidence <= 1 &&
        ["vesselDensity", "fishingActivityScore", "historicalActivity", "currentActivity"]
          .every((field) =>
            isCoordinate(item[field]) &&
            item[field] >= 0 &&
            item[field] <= 100
          ) &&
        isCoordinate(item.vesselCount) &&
        item.vesselCount >= 0
    ).then((snapshots) => snapshots.map(withLiveSource));
  }
}
