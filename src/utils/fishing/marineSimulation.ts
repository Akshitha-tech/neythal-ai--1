import type { OceanCondition } from "../../services/fishing/types";

export type MarineAdvisoryKey =
  | "favorable"
  | "stable"
  | "waves"
  | "wind"
  | "improving"
  | "caution";

export interface MarineEnvironment {
  seaSurfaceTemperature: number;
  waveHeight: number;
  waveTurbulence: number;
  windSpeed: number;
  windDirectionDegrees: number;
  windDirection: string;
  windGradient: number;
  oceanCurrent: number;
  chlorophyll: number;
}

export interface MarineMetricScores {
  seaTemperature: number;
  waveHeight: number;
  waveTurbulence: number;
  windSpeed: number;
  windDirection: number;
  windGradient: number;
  oceanCurrent: number;
  chlorophyll: number;
  productivity: number;
}

export interface MarineSimulationState extends MarineEnvironment {
  vesselActivity: number;
  historicalActivity: number;
  vesselDensity: number;
  environmentalSuitability: number;
  oceanConditions: number;
  metricScores: MarineMetricScores;
  fishingSuitability: number;
  confidence: number;
  baselineConfidence: number;
  baselineEnvironmentalSuitability: number;
  baselineTurbulence: number;
  baselineVesselActivity: number;
  baselineHistoricalActivity: number;
  baselineVesselDensity: number;
  previousScore: number;
  trend: number;
  targetSpecies: string[];
  advisoryKey: MarineAdvisoryKey;
  updatedAt: number;
  revision: number;
}

export interface MarineSimulationSeed {
  condition?: OceanCondition;
  windGradient: number;
  vesselActivity: number;
  historicalActivity: number;
  vesselDensity: number;
  confidence: number;
  species: string[];
  timestamp: number;
}

const TARGET_SPECIES = ["Tuna", "Mackerel", "Sardine", "Seer Fish", "Anchovy"];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundTo(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function directionLabel(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % directions.length];
}

function suitability(value: number, ideal: number, tolerance: number) {
  return clamp(100 - (Math.abs(value - ideal) / tolerance) * 100, 0, 100);
}

function deriveMetricScores(environment: MarineEnvironment): MarineMetricScores {
  const temperatureScore = suitability(
    environment.seaSurfaceTemperature,
    28,
    4
  );
  const chlorophyllScore = suitability(environment.chlorophyll, 0.7, 1.2);
  const gradientScore = clamp(100 - environment.windGradient * 2, 0, 100);
  const turbulenceScore = clamp(100 - environment.waveTurbulence * 0.55, 0, 100);
  const waveScore = clamp(100 - (environment.waveHeight / 5) * 100, 0, 100);
  const windScore = clamp(100 - (environment.windSpeed / 60) * 100, 0, 100);
  const currentScore = clamp(
    100 - (Math.abs(environment.oceanCurrent - 0.6) / 2) * 100,
    0,
    100
  );
  const windDirectionDifference = Math.abs(
    ((environment.windDirectionDegrees - 45 + 540) % 360) - 180
  );

  return {
    seaTemperature: Math.round(temperatureScore),
    waveHeight: Math.round(waveScore),
    waveTurbulence: Math.round(turbulenceScore),
    windSpeed: Math.round(windScore),
    windDirection: Math.round(clamp(100 - windDirectionDifference * 0.75, 0, 100)),
    windGradient: Math.round(gradientScore),
    oceanCurrent: Math.round(currentScore),
    chlorophyll: Math.round(chlorophyllScore),
    productivity: Math.round(chlorophyllScore),
  };
}

function deriveScores(environment: MarineEnvironment) {
  const metrics = deriveMetricScores(environment);
  return {
    environmentalSuitability: Math.round(
      metrics.seaTemperature * 0.3 +
        metrics.chlorophyll * 0.35 +
        metrics.windGradient * 0.15 +
        metrics.waveTurbulence * 0.2
    ),
    oceanConditions: Math.round(
      (metrics.waveHeight + metrics.windSpeed + metrics.oceanCurrent) / 3
    ),
    metricScores: metrics,
  };
}

function deriveSuitabilityScore(
  vesselActivity: number,
  historicalActivity: number,
  environmentalSuitability: number,
  vesselDensity: number,
  oceanConditions: number
) {
  return Math.round(
    vesselActivity * 0.3 +
      historicalActivity * 0.2 +
      environmentalSuitability * 0.2 +
      vesselDensity * 0.15 +
      oceanConditions * 0.15
  );
}

function calculateTurbulence(waveHeight: number, windSpeed: number, windGradient: number) {
  return roundTo(
    clamp(waveHeight * 15 + windSpeed * 0.45 + windGradient * 0.8, 0, 100),
    1
  );
}

function normalizeSpecies(species: string[]) {
  const normalized = species.filter((name) => TARGET_SPECIES.includes(name));
  return normalized.length ? normalized.slice(0, 3) : TARGET_SPECIES.slice(0, 3);
}

function chooseSpecies(
  environment: MarineEnvironment,
  previous: string[],
  baseSpecies: string[]
) {
  const pelagicWasSelected = previous.includes("Seer Fish");
  const coastalWasSelected = previous.includes("Anchovy");

  if (pelagicWasSelected) {
    if (environment.chlorophyll >= 0.72 && environment.oceanCurrent >= 0.4) {
      return ["Tuna", "Seer Fish", "Mackerel"];
    }
  } else if (coastalWasSelected) {
    if (environment.waveHeight >= 1.15 || environment.windSpeed >= 15) {
      return ["Mackerel", "Sardine", "Anchovy"];
    }
  } else if (environment.chlorophyll >= 0.84 && environment.oceanCurrent >= 0.58) {
    return ["Tuna", "Seer Fish", "Mackerel"];
  } else if (environment.waveHeight >= 1.7 || environment.windSpeed >= 18) {
    return ["Mackerel", "Sardine", "Anchovy"];
  }

  return normalizeSpecies(baseSpecies);
}

function chooseAdvisory(
  state: Pick<MarineSimulationState, "waveHeight" | "windSpeed" | "fishingSuitability" | "trend">,
  previous?: MarineSimulationState
): MarineAdvisoryKey {
  if (state.windSpeed >= 17 || (previous?.advisoryKey === "wind" && state.windSpeed >= 16)) {
    return "wind";
  }
  if (state.waveHeight >= 1.5 || (previous?.advisoryKey === "waves" && state.waveHeight >= 1.3)) {
    return "waves";
  }
  if (previous && state.trend >= 2) {
    return "improving";
  }
  if (
    previous?.advisoryKey === "wind" &&
    state.windSpeed < 16 &&
    state.waveHeight <= 1.4 &&
    state.fishingSuitability >= 75
  ) {
    return "stable";
  }
  if (state.fishingSuitability >= 75 && state.waveHeight <= 1.6 && state.windSpeed <= 18) {
    return "stable";
  }
  return state.fishingSuitability >= 65 ? "favorable" : "caution";
}

function buildState(
  environment: MarineEnvironment,
  values: Pick<MarineSimulationState,
    | "vesselActivity"
    | "historicalActivity"
    | "vesselDensity"
    | "confidence"
    | "baselineConfidence"
    | "baselineEnvironmentalSuitability"
    | "baselineTurbulence"
    | "baselineVesselActivity"
    | "baselineHistoricalActivity"
    | "baselineVesselDensity"
    | "previousScore"
    | "targetSpecies"
    | "updatedAt"
    | "revision"
  >,
  previous?: MarineSimulationState
): MarineSimulationState {
  const scores = deriveScores(environment);
  const fishingSuitability = deriveSuitabilityScore(
    values.vesselActivity,
    values.historicalActivity,
    scores.environmentalSuitability,
    values.vesselDensity,
    scores.oceanConditions
  );
  const partial = {
    ...environment,
    ...values,
    ...scores,
    fishingSuitability,
    trend: 0,
    advisoryKey: "stable" as MarineAdvisoryKey,
  };

  return {
    ...partial,
    advisoryKey: chooseAdvisory(partial, previous),
  };
}

export function createMarineSimulationState(seed: MarineSimulationSeed): MarineSimulationState {
  const condition = seed.condition;
  const seaSurfaceTemperature = condition?.seaSurfaceTemperature ?? 28.4;
  const waveHeight = condition?.waveHeight ?? 1.2;
  const windSpeed = condition?.windSpeed ?? 14;
  const windDirectionDegrees = ((condition?.windDirectionDegrees ?? 45) + 360) % 360;
  const windGradient = roundTo(clamp(seed.windGradient, 2, 16), 1);
  const oceanCurrent = condition?.currentSpeed ?? 0.6;
  const chlorophyll = condition?.chlorophyll ?? 0.82;
  const environment: MarineEnvironment = {
    seaSurfaceTemperature,
    waveHeight,
    waveTurbulence: calculateTurbulence(waveHeight, windSpeed, windGradient),
    windSpeed,
    windDirectionDegrees,
    windDirection: directionLabel(windDirectionDegrees),
    windGradient,
    oceanCurrent,
    chlorophyll,
  };
  const initialValues = {
    vesselActivity: seed.vesselActivity,
    historicalActivity: seed.historicalActivity,
    vesselDensity: seed.vesselDensity,
    confidence: seed.confidence,
    baselineConfidence: seed.confidence,
    baselineEnvironmentalSuitability: 0,
    baselineTurbulence: 0,
    baselineVesselActivity: seed.vesselActivity,
    baselineHistoricalActivity: seed.historicalActivity,
    baselineVesselDensity: seed.vesselDensity,
    previousScore: 0,
    targetSpecies: normalizeSpecies(seed.species),
    updatedAt: seed.timestamp,
    revision: 0,
  };
  const initialState = buildState(environment, initialValues);
  const initialConfidence = Math.round(clamp(seed.confidence, 55, 98));
  return {
    ...initialState,
    baselineConfidence: initialConfidence,
    baselineEnvironmentalSuitability: initialState.environmentalSuitability,
    baselineTurbulence: initialState.waveTurbulence,
    previousScore: initialState.fishingSuitability,
    trend: 0,
    confidence: initialConfidence,
    advisoryKey: chooseAdvisory(initialState),
  };
}

function chooseStep(random: () => number, steps: number[]) {
  return steps[Math.floor(random() * steps.length)];
}

function vary(
  value: number,
  steps: number[],
  minimum: number,
  maximum: number,
  digits: number,
  random: () => number,
  baseline: number
) {
  return roundTo(
    clamp(value + chooseStep(random, steps) + (baseline - value) * 0.18, minimum, maximum),
    digits
  );
}

export function advanceMarineSimulationState(
  current: MarineSimulationState,
  baseSpecies: string[],
  random: () => number,
  updatedAt: number
): MarineSimulationState {
  const windSpeed = vary(current.windSpeed, [-1, 0, 1], 8, 26, 0, random, 14);
  const windGradient = vary(current.windGradient, [-0.5, 0, 0.5], 2, 16, 1, random, 6);
  const waveHeight = vary(current.waveHeight, [-0.1, 0, 0.1], 0.6, 2.5, 1, random, 1.2);
  const windDirectionDegrees = (current.windDirectionDegrees + chooseStep(random, [-15, -10, 10, 15]) + 360) % 360;
  const oceanCurrent = vary(current.oceanCurrent, [-0.05, 0, 0.05], 0.25, 1.1, 2, random, 0.6);
  const chlorophyll = vary(current.chlorophyll, [-0.02, 0, 0.02], 0.35, 1.25, 2, random, 0.82);
  const seaSurfaceTemperature = vary(
    current.seaSurfaceTemperature,
    [-0.1, 0, 0.1],
    27.3,
    30.2,
    1,
    random,
    28.4
  );
  const environment: MarineEnvironment = {
    seaSurfaceTemperature,
    waveHeight,
    waveTurbulence: calculateTurbulence(waveHeight, windSpeed, windGradient),
    windSpeed,
    windDirectionDegrees,
    windDirection: directionLabel(windDirectionDegrees),
    windGradient,
    oceanCurrent,
    chlorophyll,
  };
  const nextScores = deriveScores(environment);
  const vesselActivity = Math.round(
    clamp(
      current.vesselActivity + chooseStep(random, [-2, -1, 0, 1, 2]) +
        (nextScores.environmentalSuitability - current.environmentalSuitability) * 0.12 +
        (current.baselineVesselActivity - current.vesselActivity) * 0.18,
      0,
      100
    )
  );
  const historicalActivity = Math.round(
    clamp(
      current.historicalActivity + chooseStep(random, [-1, 0, 0, 1]) +
        (current.baselineHistoricalActivity - current.historicalActivity) * 0.12,
      0,
      100
    )
  );
  const vesselDensity = Math.round(
    clamp(
      current.vesselDensity + chooseStep(random, [-2, -1, 0, 1, 2]) +
        (vesselActivity - current.vesselActivity) * 0.35 +
        (current.baselineVesselDensity - current.vesselDensity) * 0.18,
      0,
      100
    )
  );
  const rawScore = deriveSuitabilityScore(
    vesselActivity,
    historicalActivity,
    nextScores.environmentalSuitability,
    vesselDensity,
    nextScores.oceanConditions
  );
  const confidence = Math.round(
    clamp(
      current.baselineConfidence +
        (nextScores.environmentalSuitability - current.baselineEnvironmentalSuitability) * 0.45 -
        (environment.waveTurbulence - current.baselineTurbulence) * 0.08,
      55,
      98
    )
  );
  const nextValues = {
    vesselActivity,
    historicalActivity,
    vesselDensity,
    confidence,
    baselineConfidence: current.baselineConfidence,
    baselineEnvironmentalSuitability: current.baselineEnvironmentalSuitability,
    baselineTurbulence: current.baselineTurbulence,
    baselineVesselActivity: current.baselineVesselActivity,
    baselineHistoricalActivity: current.baselineHistoricalActivity,
    baselineVesselDensity: current.baselineVesselDensity,
    previousScore: current.fishingSuitability,
    targetSpecies: chooseSpecies(environment, current.targetSpecies, baseSpecies),
    updatedAt,
    revision: current.revision + 1,
  };
  const nextState = buildState(environment, nextValues, current);

  return {
    ...nextState,
    fishingSuitability: rawScore,
    trend: Math.round(
      ((rawScore - current.fishingSuitability) / Math.max(1, current.fishingSuitability)) * 100
    ),
    advisoryKey: chooseAdvisory({
      ...nextState,
      fishingSuitability: rawScore,
      trend: Math.round(
        ((rawScore - current.fishingSuitability) / Math.max(1, current.fishingSuitability)) * 100
      ),
    }, current),
  };
}