import type {
  FishingActivitySnapshot,
  FishingVessel,
  FishingZone,
  OceanCondition,
  RiskLevel,
} from "../../services/fishing/types";

export interface FishingIntelligence {
  activityScore: number;
  vesselActivity: number;
  historicalActivity: number;
  vesselDensity: number;
  vesselCount: number;
  environmentalScore: number;
  oceanConditionsScore: number;
  riskLevel: RiskLevel;
  confidence: number;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isPointInRing(
  longitude: number,
  latitude: number,
  ring: [number, number][]
): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInZone(vessel: FishingVessel, zone: FishingZone): boolean {
  const polygons =
    zone.geometry.type === "Polygon"
      ? [zone.geometry.coordinates]
      : zone.geometry.coordinates;

  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return (
      isPointInRing(vessel.longitude, vessel.latitude, outerRing) &&
      !holes.some((hole) =>
        isPointInRing(vessel.longitude, vessel.latitude, hole)
      )
    );
  });
}

function nearestOceanCondition(
  zone: FishingZone,
  conditions: OceanCondition[]
): OceanCondition | undefined {
  return conditions.reduce<OceanCondition | undefined>((nearest, condition) => {
    if (!nearest) return condition;
    const distance = Math.hypot(
      condition.latitude - zone.center.latitude,
      condition.longitude - zone.center.longitude
    );
    const nearestDistance = Math.hypot(
      nearest.latitude - zone.center.latitude,
      nearest.longitude - zone.center.longitude
    );
    return distance < nearestDistance ? condition : nearest;
  }, undefined);
}

function suitability(value: number | undefined, optimal: number, tolerance: number) {
  return value === undefined
    ? 50
    : clamp(100 - (Math.abs(value - optimal) / tolerance) * 100);
}

function riskLevel(score: number): RiskLevel {
  if (score <= 25) return "LOW";
  if (score <= 50) return "MODERATE";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

export function calculateFishingIntelligence(
  zone: FishingZone,
  vessels: FishingVessel[],
  conditions: OceanCondition[],
  activitySnapshot?: FishingActivitySnapshot
): FishingIntelligence {
  const vesselsInZone = vessels.filter((vessel) => isPointInZone(vessel, zone));
  const vesselCount = activitySnapshot?.vesselCount ?? vesselsInZone.length;
  const vesselDensity =
    activitySnapshot?.vesselDensity ??
    clamp(Math.round((vesselCount / 12) * 100));
  const condition = nearestOceanCondition(zone, conditions);

  const vesselActivity =
    activitySnapshot?.fishingActivityScore ??
    activitySnapshot?.currentActivity ??
    (vesselsInZone.length
      ? clamp(
          Math.round(
            vesselsInZone.reduce(
              (sum, vessel) => sum + (vessel.fishingActivity ?? 50),
              0
            ) / vesselsInZone.length
          )
        )
      : clamp(zone.activityScore));
  const historicalActivity = clamp(
    activitySnapshot?.historicalActivity ?? zone.activityScore
  );

  const temperatureSuitability = suitability(
    condition?.seaSurfaceTemperature,
    28,
    4
  );
  const chlorophyllSuitability = suitability(condition?.chlorophyll, 0.7, 1.2);
  const environmentalScore = Math.round(
    (temperatureSuitability + chlorophyllSuitability) / 2
  );

  const waveSuitability = condition?.waveHeight === undefined
    ? 50
    : clamp(100 - (condition.waveHeight / 5) * 100);
  const windSuitability = condition?.windSpeed === undefined
    ? 50
    : clamp(100 - (condition.windSpeed / 60) * 100);
  const currentSuitability = condition?.currentSpeed === undefined
    ? 50
    : clamp(100 - (Math.abs(condition.currentSpeed - 0.6) / 2) * 100);
  const oceanConditionsScore = Math.round(
    (waveSuitability + windSuitability + currentSuitability) / 3
  );

  const activityScore = Math.round(
    clamp(
      vesselActivity * 0.3 +
        historicalActivity * 0.2 +
        environmentalScore * 0.2 +
        vesselDensity * 0.15 +
        oceanConditionsScore * 0.15
    )
  );
  const confidence = Math.round(
    clamp(
      ((zone.confidence +
        (activitySnapshot?.confidence ?? zone.confidence) +
        (condition?.confidence ?? zone.confidence)) /
        3) *
        100
    )
  );

  return {
    activityScore,
    vesselActivity,
    historicalActivity,
    vesselDensity,
    vesselCount,
    environmentalScore,
    oceanConditionsScore,
    riskLevel: riskLevel(activityScore),
    confidence,
  };
}

export function countVesselsInZone(
  zone: FishingZone,
  vessels: FishingVessel[]
): number {
  return vessels.filter((vessel) => isPointInZone(vessel, zone)).length;
}
