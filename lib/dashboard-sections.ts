/**
 * Classifies list items into dashboard tabs and Current-tab sub-sections.
 */

import type { Id } from "@/convex/_generated/dataModel";
import type { SeasonProgress, StatusValue } from "@/components/media-card/types";

export type DashboardTab = "current" | "havent_started" | "finished";

/** Days after season premiere to treat as "newly released" */
const RECENT_RELEASE_DAYS = 30;

interface SeasonData {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
}

export interface DashboardListItem {
  _id: Id<"listItems">;
  _creationTime: number;
  status: StatusValue;
  seasonProgress?: SeasonProgress[];
  currentSeasonNumber?: number;
  currentEpisodeNumber?: number;
  media: {
    type: "movie" | "tv";
    title: string;
    releaseDate?: string;
    seasonData?: SeasonData[];
  } | null;
}

export interface AwaitingReleaseEntry<T> {
  item: T;
  newlyReleased: boolean;
  sortDate: string;
}

export interface DashboardSections<T> {
  watchingNow: T[];
  awaitingRelease: AwaitingReleaseEntry<T>[];
  haventStarted: T[];
  finished: T[];
}

function getSeasonsWithAirDate(seasonData: SeasonData[] | undefined): SeasonData[] {
  return (seasonData ?? [])
    .filter((s) => s.airDate)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function getUpcomingSeasons(seasonData: SeasonData[] | undefined, today: string): SeasonData[] {
  return getSeasonsWithAirDate(seasonData).filter((s) => s.airDate! > today);
}

function getReleasedSeasons(seasonData: SeasonData[] | undefined, today: string): SeasonData[] {
  return getSeasonsWithAirDate(seasonData).filter((s) => s.airDate! <= today);
}

function allReleasedSeasonsWatched(
  item: DashboardListItem,
  today: string
): boolean {
  const released = getReleasedSeasons(item.media?.seasonData, today);
  if (released.length === 0) return false;

  return released.every((s) => {
    const prog = item.seasonProgress?.find((p) => p.seasonNumber === s.seasonNumber);
    return prog?.status === "watched";
  });
}

function isNewlyReleasedSeason(season: SeasonData, today: string): boolean {
  if (!season.airDate || season.airDate > today) return false;
  const air = new Date(`${season.airDate}T00:00:00`).getTime();
  const now = Date.now();
  const daysSince = (now - air) / (1000 * 60 * 60 * 24);
  return daysSince >= 0 && daysSince <= RECENT_RELEASE_DAYS;
}

function isAtSeasonStartWithoutProgress(item: DashboardListItem): boolean {
  const curSeason = item.currentSeasonNumber ?? 1;
  const curEpisode = item.currentEpisodeNumber ?? 1;
  if (curEpisode !== 1) return false;

  const seasonProgress = item.seasonProgress?.find((p) => p.seasonNumber === curSeason);
  return !seasonProgress?.episodeDates?.length;
}

function classifyAwaitingRelease(
  item: DashboardListItem,
  today: string
): { awaiting: boolean; newlyReleased: boolean; sortDate?: string } {
  const seasonData = item.media?.seasonData;
  const upcoming = getUpcomingSeasons(seasonData, today);
  const allReleasedWatched = allReleasedSeasonsWatched(item, today);

  // Fully caught up on aired seasons; next season not out yet
  if (item.status === "watched" && upcoming.length > 0) {
    return {
      awaiting: true,
      newlyReleased: false,
      sortDate: upcoming[0].airDate!,
    };
  }

  if (!allReleasedWatched) {
    return { awaiting: false, newlyReleased: false };
  }

  const curSeason = item.currentSeasonNumber ?? 1;
  const seasons = getSeasonsWithAirDate(seasonData);
  const curSeasonData = seasons.find((s) => s.seasonNumber === curSeason);

  // Positioned at the next season premiere, haven't started it yet
  if (curSeasonData && isAtSeasonStartWithoutProgress(item)) {
    const isFuture = curSeasonData.airDate! > today;
    const isReleased = curSeasonData.airDate! <= today;

    if (isFuture) {
      return {
        awaiting: true,
        newlyReleased: false,
        sortDate: curSeasonData.airDate!,
      };
    }

    if (isReleased) {
      return {
        awaiting: true,
        newlyReleased: isNewlyReleasedSeason(curSeasonData, today),
        sortDate: curSeasonData.airDate!,
      };
    }
  }

  return { awaiting: false, newlyReleased: false };
}

function classifyTVItem(
  item: DashboardListItem,
  today: string
): "watchingNow" | "awaitingRelease" | "haventStarted" | "finished" {
  const awaiting = classifyAwaitingRelease(item, today);
  if (awaiting.awaiting) return "awaitingRelease";

  if (item.status === "watching") return "watchingNow";

  if (item.status === "to_watch") {
    const curSeason = item.currentSeasonNumber ?? 1;
    const curEpisode = item.currentEpisodeNumber ?? 1;
    if (curSeason === 1 && curEpisode === 1) return "haventStarted";
    // Unusual state — treat as haven't started
    return "haventStarted";
  }

  if (item.status === "dropped") return "finished";

  if (item.status === "watched") {
    const upcoming = getUpcomingSeasons(item.media?.seasonData, today);
    return upcoming.length === 0 ? "finished" : "awaitingRelease";
  }

  return "finished";
}

function sortAwaitingRelease<T>(
  entries: AwaitingReleaseEntry<T>[]
): AwaitingReleaseEntry<T>[] {
  return [...entries].sort((a, b) => {
    if (a.newlyReleased !== b.newlyReleased) {
      return a.newlyReleased ? -1 : 1;
    }
    if (a.newlyReleased && b.newlyReleased) {
      return b.sortDate.localeCompare(a.sortDate);
    }
    return a.sortDate.localeCompare(b.sortDate);
  });
}

export function classifyDashboardItems<T extends DashboardListItem>(
  items: T[],
  today: string
): DashboardSections<T> {
  const watchingNow: T[] = [];
  const awaitingRelease: AwaitingReleaseEntry<T>[] = [];
  const haventStarted: T[] = [];
  const finished: T[] = [];

  for (const item of items) {
    if (!item.media) continue;

    if (item.media.type === "movie") {
      if (item.status === "watched" || item.status === "dropped") {
        finished.push(item);
      } else {
        haventStarted.push(item);
      }
      continue;
    }

    const bucket = classifyTVItem(item, today);

    switch (bucket) {
      case "watchingNow":
        watchingNow.push(item);
        break;
      case "awaitingRelease": {
        const meta = classifyAwaitingRelease(item, today);
        awaitingRelease.push({
          item,
          newlyReleased: meta.newlyReleased,
          sortDate: meta.sortDate ?? today,
        });
        break;
      }
      case "haventStarted":
        haventStarted.push(item);
        break;
      case "finished":
        finished.push(item);
        break;
    }
  }

  return {
    watchingNow,
    awaitingRelease: sortAwaitingRelease(awaitingRelease),
    haventStarted,
    finished,
  };
}

export function getDefaultDashboardTab<T>(
  sections: DashboardSections<T>
): DashboardTab {
  if (sections.watchingNow.length + sections.awaitingRelease.length > 0) {
    return "current";
  }
  if (sections.haventStarted.length > 0) return "havent_started";
  return "finished";
}
