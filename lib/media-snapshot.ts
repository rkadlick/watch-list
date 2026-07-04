/**
 * Media snapshot + diff utilities for TMDB refresh change detection.
 */

export type MediaChangeType =
  | "new_season"
  | "season_released"
  | "premiere_date_set"
  | "release_date_changed"
  | "movie_released"
  | "episodes_added";

export interface MediaChange {
  type: MediaChangeType;
  detectedAt: number;
  detail?: string;
}

export interface SeasonSnapshot {
  seasonNumber: number;
  airDate?: string;
  episodeCount: number;
}

export interface MediaSnapshot {
  capturedAt: number;
  releaseDate?: string;
  seasonCount: number;
  seasons: SeasonSnapshot[];
}

interface SeasonDataLike {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
}

interface MediaLike {
  type: "movie" | "tv";
  releaseDate?: string;
  seasonData?: SeasonDataLike[];
}

export function buildMediaSnapshot(media: MediaLike, capturedAt = Date.now()): MediaSnapshot {
  const seasons =
    media.type === "tv"
      ? (media.seasonData ?? [])
          .filter((s) => s.seasonNumber > 0)
          .map((s) => ({
            seasonNumber: s.seasonNumber,
            airDate: s.airDate,
            episodeCount: s.episodeCount,
          }))
          .sort((a, b) => a.seasonNumber - b.seasonNumber)
      : [];

  return {
    capturedAt,
    releaseDate: media.releaseDate,
    seasonCount: seasons.length,
    seasons,
  };
}

function seasonLabel(seasonNumber: number): string {
  return `Season ${seasonNumber}`;
}

export function diffMediaSnapshots(
  previous: MediaSnapshot | undefined,
  current: MediaSnapshot,
  mediaType: "movie" | "tv",
  today: string,
  detectedAt = Date.now()
): MediaChange[] {
  if (!previous) return [];

  const changes: MediaChange[] = [];

  if (mediaType === "movie") {
    const prevDate = previous.releaseDate;
    const curDate = current.releaseDate;

    if (prevDate && curDate && prevDate !== curDate) {
      if (prevDate > today && curDate <= today) {
        changes.push({ type: "movie_released", detectedAt });
      } else {
        changes.push({
          type: "release_date_changed",
          detectedAt,
          detail: curDate,
        });
      }
    } else if (prevDate && prevDate > today && curDate && curDate <= today) {
      changes.push({ type: "movie_released", detectedAt });
    }
    return changes;
  }

  const prevByNum = new Map(previous.seasons.map((s) => [s.seasonNumber, s]));
  const curByNum = new Map(current.seasons.map((s) => [s.seasonNumber, s]));

  for (const season of current.seasons) {
    const prev = prevByNum.get(season.seasonNumber);
    if (!prev) {
      changes.push({
        type: "new_season",
        detectedAt,
        detail: seasonLabel(season.seasonNumber),
      });
      if (season.airDate && season.airDate <= today) {
        changes.push({
          type: "season_released",
          detectedAt,
          detail: seasonLabel(season.seasonNumber),
        });
      }
      continue;
    }

    if (!prev.airDate && season.airDate) {
      changes.push({
        type: "premiere_date_set",
        detectedAt,
        detail: `${seasonLabel(season.seasonNumber)} (${season.airDate})`,
      });
      if (season.airDate <= today) {
        changes.push({
          type: "season_released",
          detectedAt,
          detail: seasonLabel(season.seasonNumber),
        });
      }
    } else if (
      prev.airDate &&
      season.airDate &&
      prev.airDate !== season.airDate
    ) {
      changes.push({
        type: "release_date_changed",
        detectedAt,
        detail: `${seasonLabel(season.seasonNumber)} → ${season.airDate}`,
      });
      if (prev.airDate > today && season.airDate <= today) {
        changes.push({
          type: "season_released",
          detectedAt,
          detail: seasonLabel(season.seasonNumber),
        });
      }
    } else if (
      prev.airDate &&
      prev.airDate > today &&
      season.airDate &&
      season.airDate <= today
    ) {
      changes.push({
        type: "season_released",
        detectedAt,
        detail: seasonLabel(season.seasonNumber),
      });
    }

    if (season.episodeCount > prev.episodeCount) {
      changes.push({
        type: "episodes_added",
        detectedAt,
        detail: `${seasonLabel(season.seasonNumber)} (+${season.episodeCount - prev.episodeCount})`,
      });
    }
  }

  // Season removed from TMDB — ignore for v1
  void curByNum;

  return changes;
}

export function mergePendingChanges(
  existing: MediaChange[] | undefined,
  incoming: MediaChange[]
): MediaChange[] {
  if (incoming.length === 0) return existing ?? [];
  const merged = [...(existing ?? []), ...incoming];
  // Keep last 20 changes per item
  return merged.slice(-20);
}

export function formatMediaChange(type: MediaChangeType, detail?: string): string {
  switch (type) {
    case "new_season":
      return detail ? `${detail} announced` : "New season announced";
    case "season_released":
      return detail ? `${detail} is out` : "New season is out";
    case "premiere_date_set":
      return detail ? `${detail} premiere date set` : "Premiere date set";
    case "release_date_changed":
      return detail ? `Release date updated (${detail})` : "Release date updated";
    case "movie_released":
      return "Now available";
    case "episodes_added":
      return detail ? `${detail} new episodes` : "New episodes added";
  }
}
