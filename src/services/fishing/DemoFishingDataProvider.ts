import { demoFishingDataset } from "../../data/fishing/demoFishingData";
import type {
  FishingActivitySnapshot,
  FishingDataProvider,
  FishingVessel,
  FishingZone,
  OceanCondition,
} from "./types";

export class DemoFishingDataProvider implements FishingDataProvider {
  async getFishingZones(): Promise<FishingZone[]> {
    return demoFishingDataset.zones;
  }

  async getVessels(): Promise<FishingVessel[]> {
    return demoFishingDataset.vessels;
  }

  async getOceanConditions(): Promise<OceanCondition[]> {
    return demoFishingDataset.oceanConditions;
  }

  async getFishingActivity(): Promise<FishingActivitySnapshot[]> {
    return demoFishingDataset.activityHistory;
  }
}
