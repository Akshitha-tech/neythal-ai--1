import { DemoFishingDataProvider } from "./DemoFishingDataProvider";
import { CachedFishingDataProvider } from "./CachedFishingDataProvider";
import { ExternalFishingDataProvider } from "./ExternalFishingDataProvider";
import type {
  DataSource,
  FishingDataset,
  FishingDataProvider,
  FishingDataResult,
} from "./types";

async function loadDataset(provider: FishingDataProvider): Promise<FishingDataset> {
  const [zones, vessels, oceanConditions, activityHistory] = await Promise.all([
    provider.getFishingZones(),
    provider.getVessels(),
    provider.getOceanConditions(),
    provider.getFishingActivity(),
  ]);
  const timestamp = [
    ...zones.map((zone) => Date.parse(zone.timestamp)),
    ...vessels.map((vessel) => Date.parse(vessel.timestamp)),
    ...oceanConditions.map((condition) => Date.parse(condition.timestamp)),
    ...activityHistory.map((snapshot) => Date.parse(snapshot.timestamp)),
  ].filter(Number.isFinite).sort((a, b) => b - a)[0];
  const confidenceValues = [
    ...zones.map((zone) => zone.confidence),
    ...vessels.map((vessel) => vessel.confidence),
    ...oceanConditions.map((condition) => condition.confidence),
    ...activityHistory.map((snapshot) => snapshot.confidence),
  ];
  const dataSource =
    zones[0]?.source ??
    vessels[0]?.source ??
    oceanConditions[0]?.source ??
    activityHistory[0]?.source ??
    "SIMULATED";

  return {
    metadata: {
      timestamp:
        timestamp !== undefined
          ? new Date(timestamp).toISOString()
          : new Date(0).toISOString(),
      source: dataSource,
      providerName:
        dataSource === "LIVE"
          ? "Configured external fishing API"
          : dataSource === "SIMULATED"
            ? "Deterministic demo dataset"
            : "Fishing data provider",
      confidence: confidenceValues.length
        ? confidenceValues.reduce((total, value) => total + value, 0) /
          confidenceValues.length
        : 0,
    },
    zones,
    vessels,
    oceanConditions,
    activityHistory,
  };
}

function withSource(dataset: FishingDataset, source: DataSource): FishingDataset {
  return {
    metadata: { ...dataset.metadata, source },
    zones: dataset.zones.map((zone) => ({ ...zone, source })),
    vessels: dataset.vessels.map((vessel) => ({ ...vessel, source })),
    oceanConditions: dataset.oceanConditions.map((condition) => ({
      ...condition,
      source,
    })),
    activityHistory: dataset.activityHistory.map((snapshot) => ({
      ...snapshot,
      source,
    })),
  };
}

export class HybridFishingDataProvider {
  private readonly liveProvider: FishingDataProvider;
  private readonly cacheProvider: CachedFishingDataProvider;
  private readonly demoProvider: FishingDataProvider;

  constructor(
    liveProvider = new ExternalFishingDataProvider(),
    cacheProvider = new CachedFishingDataProvider(),
    demoProvider = new DemoFishingDataProvider()
  ) {
    this.liveProvider = liveProvider;
    this.cacheProvider = cacheProvider;
    this.demoProvider = demoProvider;
  }

  async load(): Promise<FishingDataResult> {
    let liveNotice: string;

    try {
      const liveDataset = await loadDataset(this.liveProvider);
      let cacheNotice: string | undefined;

      try {
        await this.cacheProvider.save(liveDataset);
      } catch (error) {
        cacheNotice = error instanceof Error ? error.message : String(error);
      }

      return {
        dataset: withSource(liveDataset, "LIVE"),
        source: "LIVE",
        notice: cacheNotice,
      };
    } catch (error) {
      liveNotice = error instanceof Error ? error.message : String(error);
    }

    let cacheNotice: string | undefined;
    try {
      const cachedDataset = await this.cacheProvider.getDataset();
      if (cachedDataset && cachedDataset.zones.length > 0) {
        return {
          dataset: withSource(cachedDataset, "CACHED"),
          source: "CACHED",
          notice: `Live data unavailable: ${liveNotice}`,
        };
      }
    } catch (error) {
      cacheNotice = error instanceof Error ? error.message : String(error);
    }

    const demoDataset = await loadDataset(this.demoProvider);
    return {
      dataset: withSource(demoDataset, "SIMULATED"),
      source: "SIMULATED",
      notice: [
        `Live data unavailable: ${liveNotice}`,
        cacheNotice ? `Cached data unavailable: ${cacheNotice}` : undefined,
        "Fishing intelligence is currently operating in simulated mode.",
      ].filter(Boolean).join(" "),
    };
  }
}
