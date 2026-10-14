import type { FishingActivitySnapshot } from "../../services/fishing/types";

export function getActivitySnapshot(
  zoneId: string,
  activityHistory: FishingActivitySnapshot[],
  hoursBack: number,
  currentTimestamp: string
): FishingActivitySnapshot | undefined {
  const targetTimestamp =
    Date.parse(currentTimestamp) - hoursBack * 60 * 60 * 1000;

  return activityHistory
    .filter((snapshot) => snapshot.zoneId === zoneId)
    .reduce<FishingActivitySnapshot | undefined>((nearest, snapshot) => {
      if (!nearest) return snapshot;
      return Math.abs(Date.parse(snapshot.timestamp) - targetTimestamp) <
        Math.abs(Date.parse(nearest.timestamp) - targetTimestamp)
        ? snapshot
        : nearest;
    }, undefined);
}
