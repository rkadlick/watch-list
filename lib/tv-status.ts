/**
 * TV show status derivation from season-level data.
 *
 * Rules (priority order):
 *
 * SEASON STATUS (per season, only visible seasons — those with an airDate):
 *   1. Explicitly "dropped" by user            → dropped
 *   2. Has any open span (startedAt, no end)   → watching
 *   3. Has at least one closed span            → watched
 *   4. Has legacy startedAt without finishedAt → watching
 *   5. Has legacy finishedAt                   → watched
 *   6. Otherwise                                → to_watch
 *
 * SHOW STATUS (derived from visible-season statuses):
 *   1. Any season dropped                      → dropped
 *   2. Any season watching                     → watching
 *   3. All visible seasons watched             → watched
 *   4. All visible seasons to_watch            → to_watch
 *   5. Mixed watched + to_watch                → to_watch
 *   6. No visible seasons                      → fallbackStatus
 */

import type { StatusValue, SeasonProgress } from "@/components/media-card/types";

interface SeasonData {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
}

/**
 * Derive a single season's status from its progress data, accounting for both
 * the new `spans` array and legacy single startedAt/finishedAt fields.
 */
export function deriveSeasonStatus(progress: SeasonProgress | undefined): StatusValue {
  if (!progress) return "to_watch";

  if (progress.status === "dropped") return "dropped";

  const spans = progress.spans;
  if (spans && spans.length > 0) {
    const hasOpenSpan = spans.some((s) => s.startedAt != null && s.finishedAt == null);
    if (hasOpenSpan) return "watching";
    return "watched";
  }

  if (progress.startedAt != null && progress.finishedAt == null) return "watching";
  if (progress.finishedAt != null) return "watched";

  return progress.status ?? "to_watch";
}

/**
 * Calculates the overall status for a TV show based on visible seasons.
 * Only considers seasons that have an air date (released seasons).
 */
export function calculateTVStatus(
  seasonData: SeasonData[] | undefined,
  seasonProgress: SeasonProgress[] | undefined,
  fallbackStatus: StatusValue
): StatusValue {
  if (!seasonData || seasonData.length === 0) {
    return fallbackStatus;
  }

  const visibleSeasons = seasonData.filter((season) => season.airDate);

  if (visibleSeasons.length === 0) {
    return fallbackStatus;
  }

  const visibleSeasonStatuses = visibleSeasons.map((season) => {
    const progress = seasonProgress?.find((p) => p.seasonNumber === season.seasonNumber);
    return deriveSeasonStatus(progress);
  });

  if (visibleSeasonStatuses.some((s) => s === "dropped")) return "dropped";
  if (visibleSeasonStatuses.some((s) => s === "watching")) return "watching";
  if (visibleSeasonStatuses.every((s) => s === "watched")) return "watched";
  if (visibleSeasonStatuses.every((s) => s === "to_watch")) return "to_watch";

  return "to_watch";
}
