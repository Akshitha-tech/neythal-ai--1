import type {
  FishingActivitySnapshot,
  FishingDataset,
  FishingDataProvider,
  FishingVessel,
  FishingZone,
  OceanCondition,
} from "./types";

const CACHE_KEY = "neythal:fishing-intelligence:v1";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheRecord {
  savedAt: number;
  dataset: FishingDataset;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSource(value: unknown): value is "LIVE" | "CACHED" | "SIMULATED" {
  return value === "LIVE" || value === "CACHED" || value === "SIMULATED";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasProvenance(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    isSource(value.source) &&
    isFiniteNumber(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    typeof value.timestamp === "string" &&
    !Number.isNaN(Date.parse(value.timestamp))
  );
}

function isFishingDataset(value: unknown): value is FishingDataset {
  if (
    !isRecord(value) ||
    !isRecord(value.metadata) ||
    !isSource(value.metadata.source) ||
    typeof value.metadata.providerName !== "string" ||
    !isFiniteNumber(value.metadata.confidence) ||
    value.metadata.confidence < 0 ||
    value.metadata.confidence > 1 ||
    typeof value.metadata.timestamp !== "string" ||
    Number.isNaN(Date.parse(value.metadata.timestamp)) ||
    !Array.isArray(value.zones) ||
    !Array.isArray(value.vessels) ||
    !Array.isArray(value.oceanConditions) ||
    !Array.isArray(value.activityHistory)
  ) {
    return false;
  }

  const hasValidZone = (zone: unknown) =>
    hasProvenance(zone) &&
    typeof zone.id === "string" &&
    typeof zone.name === "string" &&
    typeof zone.lastUpdated === "string" &&
    isFiniteNumber(zone.activityScore) &&
    isFiniteNumber(zone.vesselCount) &&
    isRecord(zone.geometry) &&
    (zone.geometry.type === "Polygon" || zone.geometry.type === "MultiPolygon") &&
    isRecord(zone.center);
  const hasValidVessel = (vessel: unknown) =>
    hasProvenance(vessel) &&
    typeof vessel.id === "string" &&
    isFiniteNumber(vessel.latitude) &&
    isFiniteNumber(vessel.longitude) &&
    typeof vessel.lastUpdated === "string";
  const hasValidCondition = (condition: unknown) =>
    hasProvenance(condition) &&
    isFiniteNumber(condition.latitude) &&
    isFiniteNumber(condition.longitude) &&
    typeof condition.lastUpdated === "string";
  const hasValidSnapshot = (snapshot: unknown) =>
    hasProvenance(snapshot) &&
    typeof snapshot.zoneId === "string" &&
    isFiniteNumber(snapshot.vesselDensity) &&
    isFiniteNumber(snapshot.fishingActivityScore) &&
    isFiniteNumber(snapshot.historicalActivity) &&
    isFiniteNumber(snapshot.currentActivity) &&
    isFiniteNumber(snapshot.vesselCount);

  return (
    value.zones.every(hasValidZone) &&
    value.vessels.every(hasValidVessel) &&
    value.oceanConditions.every(hasValidCondition) &&
    value.activityHistory.every(hasValidSnapshot)
  );
}

export class CachedFishingDataProvider implements FishingDataProvider {
  async save(dataset: FishingDataset): Promise<void> {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), dataset } satisfies CacheRecord)
      );
    } catch (error) {
      throw new Error(
        `Unable to save fishing data to browser cache: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async getDataset(): Promise<FishingDataset | null> {
    let serialized: string | null;

    try {
      serialized = localStorage.getItem(CACHE_KEY);
    } catch (error) {
      throw new Error(
        `Unable to read fishing data from browser cache: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    if (!serialized) return null;

    let record: unknown;
    try {
      record = JSON.parse(serialized);
    } catch (error) {
      throw new Error("The cached fishing dataset is invalid JSON.", { cause: error });
    }

    if (
      !isRecord(record) ||
      !isFiniteNumber(record.savedAt) ||
      !isFishingDataset(record.dataset)
    ) {
      throw new Error("The cached fishing dataset has an invalid shape.");
    }

    if (Date.now() - record.savedAt > CACHE_TTL_MS) return null;

    const dataset = record.dataset;
    return {
      metadata: { ...dataset.metadata, source: "CACHED" },
      zones: dataset.zones.map((zone) => ({ ...zone, source: "CACHED" })),
      vessels: dataset.vessels.map((vessel) => ({ ...vessel, source: "CACHED" })),
      oceanConditions: dataset.oceanConditions.map((condition) => ({
        ...condition,
        source: "CACHED",
      })),
      activityHistory: dataset.activityHistory.map((snapshot) => ({
        ...snapshot,
        source: "CACHED",
      })),
    };
  }

  async getFishingZones(): Promise<FishingZone[]> {
    return (await this.getDataset())?.zones ?? [];
  }

  async getVessels(): Promise<FishingVessel[]> {
    return (await this.getDataset())?.vessels ?? [];
  }

  async getOceanConditions(): Promise<OceanCondition[]> {
    return (await this.getDataset())?.oceanConditions ?? [];
  }

  async getFishingActivity(): Promise<FishingActivitySnapshot[]> {
    return (await this.getDataset())?.activityHistory ?? [];
  }
}
