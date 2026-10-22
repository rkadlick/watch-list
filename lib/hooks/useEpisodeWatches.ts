"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { EpisodeWatch, EpisodeWatchLogEntry } from "@/components/media-card/types";

export interface EpisodeWatchesView {
  /** False until the query resolves (or while disabled) */
  isLoaded: boolean;
  /** Current watches (each season's current pass), ordered by season then episode */
  current: EpisodeWatch[];
  /** Every watch including rewatches, ordered by season, episode, then pass */
  log: EpisodeWatchLogEntry[];
  forSeason: (seasonNumber: number) => EpisodeWatch[];
  watchedInSeason: (seasonNumber: number) => Set<number> | undefined;
  /** episodeNumber → every watch of that episode, oldest first */
  logForSeason: (seasonNumber: number) => Map<number, EpisodeWatchLogEntry[]>;
}

/**
 * Episode watches for a TV list item. Pass `enabled: false` to skip the query
 * until the seasons view is actually open.
 */
export function useEpisodeWatches(
  listItemId: Id<"listItems">,
  enabled: boolean
): EpisodeWatchesView {
  const data = useQuery(api.listItems.getEpisodeWatches, enabled ? { listItemId } : "skip");

  return useMemo(() => {
    const passFor = (seasonNumber: number) =>
      data?.seasonPasses.find((p) => p.seasonNumber === seasonNumber)?.pass ?? data?.pass;

    const sorted = [...(data?.watches ?? [])].sort(
      (a, b) =>
        a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber || a.pass - b.pass
    );
    const log: EpisodeWatchLogEntry[] = sorted.map((w, i) => {
      const prev = sorted[i - 1];
      return {
        _id: w._id,
        seasonNumber: w.seasonNumber,
        episodeNumber: w.episodeNumber,
        watchedAt: w.watchedAt,
        pass: w.pass,
        isCurrent: w.pass === passFor(w.seasonNumber),
        isRewatch:
          prev !== undefined &&
          prev.seasonNumber === w.seasonNumber &&
          prev.episodeNumber === w.episodeNumber,
      };
    });

    const current = log
      .filter((w) => w.isCurrent)
      .map(({ seasonNumber, episodeNumber, watchedAt }) => ({ seasonNumber, episodeNumber, watchedAt }));

    const bySeason = new Map<number, EpisodeWatch[]>();
    for (const watch of current) {
      const list = bySeason.get(watch.seasonNumber) ?? [];
      list.push(watch);
      bySeason.set(watch.seasonNumber, list);
    }

    const logBySeason = new Map<number, Map<number, EpisodeWatchLogEntry[]>>();
    for (const entry of log) {
      const episodes = logBySeason.get(entry.seasonNumber) ?? new Map();
      episodes.set(entry.episodeNumber, [...(episodes.get(entry.episodeNumber) ?? []), entry]);
      logBySeason.set(entry.seasonNumber, episodes);
    }

    const isLoaded = data !== undefined;

    return {
      isLoaded,
      current,
      log,
      forSeason: (seasonNumber) => bySeason.get(seasonNumber) ?? [],
      watchedInSeason: (seasonNumber) =>
        isLoaded
          ? new Set((bySeason.get(seasonNumber) ?? []).map((w) => w.episodeNumber))
          : undefined,
      logForSeason: (seasonNumber) => logBySeason.get(seasonNumber) ?? new Map(),
    };
  }, [data]);
}
