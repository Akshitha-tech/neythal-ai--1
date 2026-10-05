export type DataSource = "LIVE" | "CACHED" | "SIMULATED";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type GeoPosition = [longitude: number, latitude: number];

export type FishingZoneGeometry =
  | {
      type: "Polygon";
      coordinates: GeoPosition[][];
    }
  | {
      type: "MultiPolygon";
      coordinates: GeoPosition[][][];
    };

export interface FishingZone {
  id: string;
  name: string;
  geometry: FishingZoneGeometry;
  center: {
    latitude: number;
    longitude: number;
  };
  zoneType: "FISHING" | "RESTRICTED";
  riskLevel: RiskLevel;
  activityScore: number;
  vesselCount: number;
  species?: string[];
  source: DataSource;
  confidence: number;
  timestamp: string;
  lastUpdated: string;
}

export interface FishingVessel {
  id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  vesselType?: string;
  fishingActivity?: number;
  source: DataSource;
  confidence: number;
  timestamp: string;
  lastUpdated: string;
}

export interface OceanCondition {
  latitude: number;
  longitude: number;
  seaSurfaceTemperature?: number;
  waveHeight?: number;
  windSpeed?: number;
  windDirection?: string;
  windDirectionDegrees?: number;
  currentSpeed?: number;
  chlorophyll?: number;
  source: DataSource;
  confidence: number;
  timestamp: string;
  lastUpdated: string;
}

export interface FishingActivitySnapshot {
  zoneId: string;
  timestamp: string;
  source: DataSource;
  confidence: number;
  vesselDensity: number;
  fishingActivityScore: number;
  historicalActivity: number;
  currentActivity: number;
  vesselCount: number;
}

export interface DatasetMetadata {
  timestamp: string;
  source: DataSource;
  providerName: string;
  confidence: number;
}

export interface FishingDataset {
  metadata: DatasetMetadata;
  zones: FishingZone[];
  vessels: FishingVessel[];
  oceanConditions: OceanCondition[];
  activityHistory: FishingActivitySnapshot[];
}

export interface FishingDataProvider {
  getFishingZones(): Promise<FishingZone[]>;
  getVessels(): Promise<FishingVessel[]>;
  getOceanConditions(): Promise<OceanCondition[]>;
  getFishingActivity(): Promise<FishingActivitySnapshot[]>;
}

export type FishingDataMode = DataSource | "LOADING" | "ERROR";

export interface FishingDataResult {
  dataset: FishingDataset;
  source: DataSource;
  notice?: string;
}
