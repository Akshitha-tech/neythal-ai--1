import type {
  FishingActivitySnapshot,
  FishingDataset,
  FishingVessel,
  OceanCondition,
} from "../../services/fishing/types";
import { demoFishingZones } from "./fishingZones";

const lastUpdated = "2026-10-05T18:00:00.000Z";

export const demoVessels: FishingVessel[] = [
  { id: "demo-vessel-01", latitude: 8.98, longitude: 78.68, heading: 48, speed: 4.2, vesselType: "Fishing vessel", fishingActivity: 86, source: "SIMULATED", confidence: 0.78, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-02", latitude: 9.08, longitude: 78.91, heading: 162, speed: 3.1, vesselType: "Fishing vessel", fishingActivity: 72, source: "SIMULATED", confidence: 0.78, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-03", latitude: 9.23, longitude: 78.77, heading: 226, speed: 2.8, vesselType: "Fishing vessel", fishingActivity: 91, source: "SIMULATED", confidence: 0.78, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-04", latitude: 9.68, longitude: 79.32, heading: 84, speed: 3.5, vesselType: "Fishing vessel", fishingActivity: 64, source: "SIMULATED", confidence: 0.69, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-05", latitude: 9.82, longitude: 79.53, heading: 310, speed: 4.0, vesselType: "Fishing vessel", fishingActivity: 78, source: "SIMULATED", confidence: 0.69, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-06", latitude: 8.46, longitude: 78.31, heading: 132, speed: 2.6, vesselType: "Fishing vessel", fishingActivity: 48, source: "SIMULATED", confidence: 0.62, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-07", latitude: 8.59, longitude: 78.52, heading: 194, speed: 3.3, vesselType: "Fishing vessel", fishingActivity: 55, source: "SIMULATED", confidence: 0.62, timestamp: lastUpdated, lastUpdated },
  { id: "demo-vessel-08", latitude: 9.91, longitude: 79.28, heading: 22, speed: 4.5, vesselType: "Fishing vessel", fishingActivity: 69, source: "SIMULATED", confidence: 0.69, timestamp: lastUpdated, lastUpdated },
];

export const demoOceanConditions: OceanCondition[] = [
  { latitude: 9.04, longitude: 78.79, seaSurfaceTemperature: 28.4, waveHeight: 1.2, windSpeed: 14, windDirection: "NE", windDirectionDegrees: 45, currentSpeed: 0.6, chlorophyll: 0.82, source: "SIMULATED", confidence: 0.78, timestamp: lastUpdated, lastUpdated },
  { latitude: 9.76, longitude: 79.39, seaSurfaceTemperature: 28.1, waveHeight: 1.8, windSpeed: 18, windDirection: "NE", windDirectionDegrees: 45, currentSpeed: 0.8, chlorophyll: 0.64, source: "SIMULATED", confidence: 0.69, timestamp: lastUpdated, lastUpdated },
  { latitude: 8.54, longitude: 78.34, seaSurfaceTemperature: 27.8, waveHeight: 1.4, windSpeed: 12, windDirection: "E", windDirectionDegrees: 90, currentSpeed: 0.5, chlorophyll: 0.53, source: "SIMULATED", confidence: 0.62, timestamp: lastUpdated, lastUpdated },
];

function deterministicValue(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export const demoActivityHistory: FishingActivitySnapshot[] =
  demoFishingZones.flatMap((zone) =>
    Array.from({ length: 25 }, (_, hoursAgo) => {
      const timestamp = new Date(
        Date.parse(lastUpdated) - hoursAgo * 60 * 60 * 1000
      ).toISOString();
      const variation = (deterministicValue(`${zone.id}:${timestamp}`) - 0.5) * 24;
      const currentActivity = Math.max(
        0,
        Math.min(100, Math.round(zone.activityScore + variation))
      );
      const historicalActivity = Math.max(
        0,
        Math.min(
          100,
          Math.round(zone.activityScore + variation * 0.65 - 3)
        )
      );
      const vesselCount = Math.max(
        0,
        Math.round(zone.vesselCount * (0.82 + deterministicValue(`${timestamp}:${zone.id}:count`) * 0.36))
      );

      return {
        zoneId: zone.id,
        timestamp,
        source: "SIMULATED" as const,
        confidence: zone.confidence,
        vesselDensity: Math.min(100, Math.round((vesselCount / 30) * 100)),
        fishingActivityScore: currentActivity,
        historicalActivity,
        currentActivity,
        vesselCount,
      };
    })
  );

export const demoFishingDataset: FishingDataset = {
  metadata: {
    timestamp: lastUpdated,
    source: "SIMULATED",
    providerName: "Deterministic demo dataset",
    confidence: 0.72,
  },
  zones: demoFishingZones,
  vessels: demoVessels,
  oceanConditions: demoOceanConditions,
  activityHistory: demoActivityHistory,
};
