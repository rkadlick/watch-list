/**
 * Utility functions for calculating TV show status based on visible seasons
 */

import type { StatusValue, SeasonProgress } from "@/components/media-card/types";

interface SeasonData {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
}

/**
 * Calculates the overall status for a TV show based on visible seasons
 * Only considers seasons that have an air date (released seasons)
 *
 * @param seasonData - All season data from TMDB
 * @param seasonProgress - User's progress on each season
 * @param fallbackStatus - The stored status to use if no visible seasons exist
 * @returns The calculated status for the TV show
 */
export function calculateTVStatus(
  seasonData: SeasonData[] | undefined,
  seasonProgress: SeasonProgress[] | undefined,
  fallbackStatus: StatusValue
): StatusValue {
  // If no season data, use the fallback status
  if (!seasonData || seasonData.length === 0) {
    return fallbackStatus;
  }

  // Filter to only visible seasons (seasons with air dates)
  const visibleSeasons = seasonData.filter(season => season.airDate);

  // If no visible seasons, use the fallback status
  if (visibleSeasons.length === 0) {
    return fallbackStatus;
  }

  // Get the status for each visible season
  const visibleSeasonStatuses = visibleSeasons.map(season => {
    const progress = seasonProgress?.find(p => p.seasonNumber === season.seasonNumber);
    return progress?.status || "to_watch";
  });

  // Count statuses
  const statusCounts = {
    watched: visibleSeasonStatuses.filter(s => s === "watched").length,
    watching: visibleSeasonStatuses.filter(s => s === "watching").length,
    to_watch: visibleSeasonStatuses.filter(s => s === "to_watch").length,
    dropped: visibleSeasonStatuses.filter(s => s === "dropped").length,
  };

  const totalVisible = visibleSeasons.length;

  // Determine overall status based on visible season statuses
  // Priority: dropped > watching > watched/to_watch

  // If any visible season is dropped → series is dropped
  if (statusCounts.dropped > 0) {
    return "dropped";
  }

  // If any visible season is watching → series is watching
  if (statusCounts.watching > 0) {
    return "watching";
  }

  // If all visible seasons are watched → series is watched
  if (statusCounts.watched === totalVisible) {
    return "watched";
  }

  // If all visible seasons are to_watch → series is to_watch
  if (statusCounts.to_watch === totalVisible) {
    return "to_watch";
  }

  // Mixed watched + to_watch → series is to_watch
  if (statusCounts.watched > 0 && statusCounts.to_watch > 0) {
    return "to_watch";
  }

  // Fallback
  return "to_watch";
}
