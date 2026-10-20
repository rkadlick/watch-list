/**
 * Classifies list items into dashboard tabs and Current-tab sub-sections.
 */

import type { Id } from "@/convex/_generated/dataModel";
import type { SeasonProgress, StatusValue } from "@/components/media-card/types";
import { daysBetweenISODates } from "@/lib/dates";

export type DashboardTab = "current" | "havent_started" | "finished";

/** Days after a returning show's season premiere to flag it as a new season */
const NEW_SEASON_DAYS = 7;

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
    totalSeasons?: number;
  } | null;
}

export interface WatchingNowEntry<T> {
  item: T;
  /** Returning show whose next season premiered within NEW_SEASON_DAYS */
  newSeason: boolean;
}

export interface AwaitingReleaseEntry<T> {
  item: T;
  sortDate: string;
}

export interface ComingSoonEntry<T> {
  item: T;
  sortDate: string;
}

export interface DashboardSections<T> {
  watchingNow: WatchingNowEntry<T>[];
  awaitingRelease: AwaitingReleaseEntry<T>[];
  haventStartedReady: T[];
  haventStartedComingSoon: ComingSoonEntry<T>[];
  finished: T[];
}

function getAllSeasons(seasonData: SeasonData[] | undefined): SeasonData[] {
  return (seasonData ?? [])
    .filter((s) => s.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function getSeasonsWithAirDate(seasonData: SeasonData[] | undefined): SeasonData[] {
  return getAllSeasons(seasonData).filter((s) => s.airDate);
}

function getUpcomingSeasons(seasonData: SeasonData[] | undefined, today: string): SeasonData[] {
  return getSeasonsWithAirDate(seasonData).filter((s) => s.airDate! > today);
}

function getReleasedSeasons(seasonData: SeasonData[] | undefined, today: string): SeasonData[] {
  return getSeasonsWithAirDate(seasonData).filter((s) => s.airDate! <= today);
}

function getHighestWatchedSeasonNumber(seasonProgress: SeasonProgress[] | undefined): number {
  const watched = (seasonProgress ?? []).filter((p) => p.status === "watched");
  if (watched.length === 0) return 0;
  return Math.max(...watched.map((p) => p.seasonNumber));
}

function getPendingNextSeasons(
  item: DashboardListItem,
  seasonData: SeasonData[] | undefined
): SeasonData[] {
  const allSeasons = getAllSeasons(seasonData);
  const highestWatched = getHighestWatchedSeasonNumber(item.seasonProgress);
  return allSeasons.filter((s) => s.seasonNumber > highestWatched);
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

function isAtSeasonStartWithoutProgress(item: DashboardListItem): boolean {
  const curSeason = item.currentSeasonNumber ?? 1;
  const curEpisode = item.currentEpisodeNumber ?? 1;
  if (curEpisode !== 1) return false;

  const seasonProgress = item.seasonProgress?.find((p) => p.seasonNumber === curSeason);
  return !seasonProgress?.episodeDates?.length;
}

function sortDateForSeason(season: SeasonData): string {
  return season.airDate ?? "9999-12-31";
}

/**
 * For a viewer who has finished at least one season, the next season they
 * haven't started yet (dated or not). Undefined when they're mid-season or
 * have nothing left to start.
 */
function getNextSeasonToStart(
  item: DashboardListItem,
  today: string
): SeasonData | undefined {
  const seasonData = item.media?.seasonData;
  const highestWatched = getHighestWatchedSeasonNumber(item.seasonProgress);
  if (highestWatched === 0) return undefined;

  if (item.status === "watched") {
    return getPendingNextSeasons(item, seasonData)[0];
  }

  if (!isAtSeasonStartWithoutProgress(item)) return undefined;

  const curSeason = item.currentSeasonNumber ?? 1;
  if (curSeason <= highestWatched) return undefined;

  const season = getSeasonsWithAirDate(seasonData).find(
    (s) => s.seasonNumber === curSeason
  );
  if (!season) return undefined;

  // Only "waiting" if there's nothing aired left to catch up on
  if (season.airDate! > today && !allReleasedSeasonsWatched(item, today)) {
    return undefined;
  }

  return season;
}

/**
 * Next season for a returning viewer that has already premiered.
 * Used by cards to offer "start next season" on a finished show.
 */
export function getReleasedNextSeason(
  item: DashboardListItem,
  today: string
): SeasonData | undefined {
  const next = getNextSeasonToStart(item, today);
  return next?.airDate && next.airDate <= today ? next : undefined;
}

type TVClassification =
  | { bucket: "watchingNow"; newSeason: boolean }
  | { bucket: "awaitingRelease"; sortDate: string }
  | { bucket: "haventStarted" }
  | { bucket: "finished" };

function classifyTVItem(item: DashboardListItem, today: string): TVClassification {
  if (item.status === "dropped") return { bucket: "finished" };

  const next = getNextSeasonToStart(item, today);
  if (next) {
    // Next season is out — back to Watching Now, flagged for the first week
    if (next.airDate && next.airDate <= today) {
      return {
        bucket: "watchingNow",
        newSeason: daysBetweenISODates(next.airDate, today) < NEW_SEASON_DAYS,
      };
    }
    return { bucket: "awaitingRelease", sortDate: sortDateForSeason(next) };
  }

  // Caught up on aired content with an announced-but-undated season
  if (allReleasedSeasonsWatched(item, today)) {
    const pendingUndated = getPendingNextSeasons(item, item.media?.seasonData).filter(
      (s) => !s.airDate
    );
    if (pendingUndated.length > 0) {
      return { bucket: "awaitingRelease", sortDate: "9999-12-31" };
    }
  }

  if (item.status === "watching") return { bucket: "watchingNow", newSeason: false };
  if (item.status === "to_watch") return { bucket: "haventStarted" };
  return { bucket: "finished" };
}

function classifyComingSoon(
  item: DashboardListItem,
  today: string
): { comingSoon: boolean; sortDate: string } {
  const media = item.media;
  if (!media) return { comingSoon: false, sortDate: today };

  if (media.type === "movie") {
    if (media.releaseDate && media.releaseDate > today) {
      return { comingSoon: true, sortDate: media.releaseDate };
    }
    return { comingSoon: false, sortDate: today };
  }

  // TV show in haven't-started territory
  if (media.releaseDate && media.releaseDate > today) {
    return { comingSoon: true, sortDate: media.releaseDate };
  }

  const released = getReleasedSeasons(media.seasonData, today);
  if (released.length > 0) {
    return { comingSoon: false, sortDate: today };
  }

  const allSeasons = getAllSeasons(media.seasonData);
  if (allSeasons.length === 0) {
    return { comingSoon: true, sortDate: "9999-12-31" };
  }

  const datedUpcoming = getUpcomingSeasons(media.seasonData, today);
  if (datedUpcoming.length > 0) {
    return { comingSoon: true, sortDate: datedUpcoming[0].airDate! };
  }

  const undated = allSeasons.filter((s) => !s.airDate);
  if (undated.length > 0) {
    return { comingSoon: true, sortDate: "9999-12-31" };
  }

  return { comingSoon: false, sortDate: today };
}

/** New seasons pinned to the top; everything else keeps the list's sort order. */
function sortWatchingNow<T>(entries: WatchingNowEntry<T>[]): WatchingNowEntry<T>[] {
  return [
    ...entries.filter((e) => e.newSeason),
    ...entries.filter((e) => !e.newSeason),
  ];
}

function sortBySortDate<T extends { sortDate: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.sortDate.localeCompare(b.sortDate));
}

export function classifyDashboardItems<T extends DashboardListItem>(
  items: T[],
  today: string
): DashboardSections<T> {
  const watchingNow: WatchingNowEntry<T>[] = [];
  const awaitingRelease: AwaitingReleaseEntry<T>[] = [];
  const haventStartedReady: T[] = [];
  const haventStartedComingSoon: ComingSoonEntry<T>[] = [];
  const finished: T[] = [];

  const pushHaventStarted = (item: T) => {
    const comingSoon = classifyComingSoon(item, today);
    if (comingSoon.comingSoon) {
      haventStartedComingSoon.push({ item, sortDate: comingSoon.sortDate });
    } else {
      haventStartedReady.push(item);
    }
  };

  for (const item of items) {
    if (!item.media) continue;

    if (item.media.type === "movie") {
      if (item.status === "watched" || item.status === "dropped") {
        finished.push(item);
      } else {
        pushHaventStarted(item);
      }
      continue;
    }

    const result = classifyTVItem(item, today);

    switch (result.bucket) {
      case "watchingNow":
        watchingNow.push({ item, newSeason: result.newSeason });
        break;
      case "awaitingRelease":
        awaitingRelease.push({ item, sortDate: result.sortDate });
        break;
      case "haventStarted":
        pushHaventStarted(item);
        break;
      case "finished":
        finished.push(item);
        break;
    }
  }

  return {
    watchingNow: sortWatchingNow(watchingNow),
    awaitingRelease: sortBySortDate(awaitingRelease),
    haventStartedReady,
    haventStartedComingSoon: sortBySortDate(haventStartedComingSoon),
    finished,
  };
}

export function getDefaultDashboardTab<T>(
  sections: DashboardSections<T>,
  typeFilter: "movie" | "tv"
): DashboardTab {
  if (typeFilter !== "movie") {
    if (sections.watchingNow.length + sections.awaitingRelease.length > 0) {
      return "current";
    }
  }
  const haventStartedCount =
    sections.haventStartedReady.length + sections.haventStartedComingSoon.length;
  if (haventStartedCount > 0) return "havent_started";
  return "finished";
}

/** @deprecated Use haventStartedReady + haventStartedComingSoon */
export function getHaventStartedCount<T>(sections: DashboardSections<T>): number {
  return sections.haventStartedReady.length + sections.haventStartedComingSoon.length;
}
