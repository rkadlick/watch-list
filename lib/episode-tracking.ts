/**
 * Episode-level TV tracking. The set of watched episodes for the current pass
 * is the source of truth; season statuses, show status and the "next episode"
 * position are derived from it and cached on the list item.
 */

export type TrackingStatus = "to_watch" | "watching" | "watched" | "dropped";

/** Version stamped on list items whose episode watches live in episodeWatches */
export const EPISODE_TRACKING_VERSION = 2;

export interface TrackedSeason {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
}

export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

export interface EpisodeWatchRow extends EpisodeRef {
  pass: number;
  watchedAt?: number;
}

export interface SeasonProgressLike {
  seasonNumber: number;
  status: TrackingStatus;
  rating?: number;
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
  watchedCount?: number;
  episodeDates?: Array<{ episodeNumber: number; watchedAt: number }>;
}

/** seasonNumber → watched episode numbers */
export type WatchedMap = Map<number, Set<number>>;

/** Seasons that count toward progress: those with an air date, in order. */
export function getTrackedSeasons<T extends TrackedSeason>(
  seasonData: T[] | undefined
): T[] {
  return (seasonData ?? [])
    .filter((s) => s.airDate)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

export function buildWatchedMap(rows: EpisodeRef[]): WatchedMap {
  const map: WatchedMap = new Map();
  for (const row of rows) {
    let set = map.get(row.seasonNumber);
    if (!set) {
      set = new Set();
      map.set(row.seasonNumber, set);
    }
    set.add(row.episodeNumber);
  }
  return map;
}

export function isEpisodeWatched(map: WatchedMap, ref: EpisodeRef): boolean {
  return map.get(ref.seasonNumber)?.has(ref.episodeNumber) ?? false;
}

/** Watched episodes within the season's current episode count */
export function countWatchedInSeason(map: WatchedMap, season: TrackedSeason): number {
  let count = 0;
  for (const ep of map.get(season.seasonNumber) ?? []) {
    if (ep >= 1 && ep <= season.episodeCount) count++;
  }
  return count;
}

function isSeasonComplete(map: WatchedMap, season: TrackedSeason): boolean {
  return season.episodeCount > 0 && countWatchedInSeason(map, season) >= season.episodeCount;
}

/** The furthest-along watched episode, by position. */
export function findLatestWatched(
  seasons: TrackedSeason[],
  map: WatchedMap
): EpisodeRef | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    let max = 0;
    for (const ep of map.get(season.seasonNumber) ?? []) {
      if (ep <= season.episodeCount && ep > max) max = ep;
    }
    if (max > 0) return { seasonNumber: season.seasonNumber, episodeNumber: max };
  }
  return null;
}

/**
 * The episode after the latest watched one. Gaps behind it are ignored, so a
 * skipped episode doesn't pin the position. Null when the show is caught up.
 */
export function findNextUp(seasons: TrackedSeason[], map: WatchedMap): EpisodeRef | null {
  if (seasons.length === 0) return null;

  const latest = findLatestWatched(seasons, map);
  if (!latest) return { seasonNumber: seasons[0].seasonNumber, episodeNumber: 1 };

  const idx = seasons.findIndex((s) => s.seasonNumber === latest.seasonNumber);
  if (latest.episodeNumber < seasons[idx].episodeCount) {
    return { seasonNumber: latest.seasonNumber, episodeNumber: latest.episodeNumber + 1 };
  }

  const nextSeason = seasons[idx + 1];
  return nextSeason ? { seasonNumber: nextSeason.seasonNumber, episodeNumber: 1 } : null;
}

export interface TvDerivation {
  status: TrackingStatus;
  seasonProgress: SeasonProgressLike[];
  /** Next episode to watch; the final episode once caught up */
  position?: EpisodeRef;
  nextUp: EpisodeRef | null;
  complete: boolean;
  totalWatched: number;
}

/**
 * Recompute cached TV state from the watched set.
 *
 * `inProgress` keeps the show "watching" with zero episodes watched — used
 * right after starting a rewatch, before the first episode is checked off.
 */
export function deriveTvState({
  seasons,
  seasonProgress,
  watched,
  fallbackStatus,
  inProgress = false,
}: {
  seasons: TrackedSeason[];
  seasonProgress: SeasonProgressLike[] | undefined;
  watched: WatchedMap;
  fallbackStatus: TrackingStatus;
  inProgress?: boolean;
}): TvDerivation {
  const existing = seasonProgress ?? [];
  const totalWatched = seasons.reduce((sum, s) => sum + countWatchedInSeason(watched, s), 0);
  const complete = seasons.length > 0 && seasons.every((s) => isSeasonComplete(watched, s));
  const nextUp = findNextUp(seasons, watched);
  const anyDropped = seasons.some(
    (s) => existing.find((p) => p.seasonNumber === s.seasonNumber)?.status === "dropped"
  );

  let status: TrackingStatus;
  if (seasons.length === 0) status = fallbackStatus;
  else if (anyDropped) status = "dropped";
  else if (complete) status = "watched";
  else if (totalWatched > 0 || inProgress) status = "watching";
  else status = "to_watch";

  const trackedNumbers = new Set(seasons.map((s) => s.seasonNumber));
  const progress: SeasonProgressLike[] = existing
    .filter((p) => !trackedNumbers.has(p.seasonNumber))
    .map(stripLegacyFields);

  for (const season of seasons) {
    const entry = existing.find((p) => p.seasonNumber === season.seasonNumber);
    const watchedCount = countWatchedInSeason(watched, season);

    let seasonStatus: TrackingStatus;
    if (entry?.status === "dropped") seasonStatus = "dropped";
    else if (isSeasonComplete(watched, season)) seasonStatus = "watched";
    else if (watchedCount > 0) seasonStatus = "watching";
    // The season you're about to start reads as "watching" mid-show
    else if (status === "watching" && nextUp?.seasonNumber === season.seasonNumber) {
      seasonStatus = "watching";
    } else seasonStatus = "to_watch";

    progress.push({
      ...(entry ? stripLegacyFields(entry) : { seasonNumber: season.seasonNumber }),
      status: seasonStatus,
      watchedCount,
    });
  }

  progress.sort((a, b) => a.seasonNumber - b.seasonNumber);

  const lastSeason = seasons[seasons.length - 1];
  const position =
    nextUp ??
    (lastSeason
      ? { seasonNumber: lastSeason.seasonNumber, episodeNumber: lastSeason.episodeCount }
      : undefined);

  return { status, seasonProgress: progress, position, nextUp, complete, totalWatched };
}

function stripLegacyFields(entry: SeasonProgressLike): SeasonProgressLike {
  const { episodeDates: _legacy, ...rest } = entry;
  void _legacy;
  return rest;
}

/** Drop entries that carry nothing beyond a default "to_watch" status. */
export function pruneSeasonProgress(progress: SeasonProgressLike[]): SeasonProgressLike[] {
  return progress.filter(
    (p) =>
      p.status !== "to_watch" ||
      (p.watchedCount ?? 0) > 0 ||
      p.rating !== undefined ||
      p.notes ||
      p.startedAt !== undefined ||
      p.finishedAt !== undefined
  );
}

/**
 * Convert a pre-episodeWatches list item into watch rows.
 *
 * - watchHistory entries (one per startRewatch) become passes 1..n
 * - the active tracker becomes pass n + 1
 * - seasons marked "watched" are filled out to their full episode count, and
 *   episodes before the position marker count as watched — both with unknown
 *   dates when no episodeDates entry exists
 */
export function legacyEpisodeWatches(
  item: {
    status: TrackingStatus;
    seasonProgress?: SeasonProgressLike[];
    watchHistory?: Array<{
      pass?: number;
      seasons?: Array<{
        seasonNumber: number;
        episodeDates?: Array<{ episodeNumber: number; watchedAt: number }>;
      }>;
    }>;
    currentSeasonNumber?: number;
    currentEpisodeNumber?: number;
    watchPass?: number;
  },
  seasonData: TrackedSeason[] | undefined
): { pass: number; rows: EpisodeWatchRow[] } {
  const rows = new Map<string, EpisodeWatchRow>();
  const add = (row: EpisodeWatchRow) => {
    const key = `${row.pass}:${row.seasonNumber}:${row.episodeNumber}`;
    if (!rows.has(key)) rows.set(key, row);
  };

  const history = item.watchHistory ?? [];
  history.forEach((entry, i) => {
    const pass = entry.pass ?? i + 1;
    for (const season of entry.seasons ?? []) {
      for (const d of season.episodeDates ?? []) {
        add({ pass, seasonNumber: season.seasonNumber, episodeNumber: d.episodeNumber, watchedAt: d.watchedAt });
      }
    }
  });

  const pass = item.watchPass ?? history.length + 1;
  const episodeCountOf = (seasonNumber: number) =>
    seasonData?.find((s) => s.seasonNumber === seasonNumber)?.episodeCount;

  for (const entry of item.seasonProgress ?? []) {
    for (const d of entry.episodeDates ?? []) {
      add({ pass, seasonNumber: entry.seasonNumber, episodeNumber: d.episodeNumber, watchedAt: d.watchedAt });
    }

    const episodeCount = episodeCountOf(entry.seasonNumber);
    if (episodeCount === undefined) continue;

    let watchedThrough = 0;
    if (entry.status === "watched") {
      watchedThrough = episodeCount;
    } else if (entry.seasonNumber === item.currentSeasonNumber) {
      watchedThrough = Math.min((item.currentEpisodeNumber ?? 1) - 1, episodeCount);
    }

    for (let ep = 1; ep <= watchedThrough; ep++) {
      add({ pass, seasonNumber: entry.seasonNumber, episodeNumber: ep });
    }
  }

  return { pass, rows: [...rows.values()] };
}
