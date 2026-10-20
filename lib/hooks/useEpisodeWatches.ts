"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { EpisodeWatch } from "@/components/media-card/types";

export interface EpisodeWatchesView {
  /** False until the query resolves (or while disabled) */
  isLoaded: boolean;
  /** Current-pass watches, ordered by season then episode */
  current: EpisodeWatch[];
  forSeason: (seasonNumber: number) => EpisodeWatch[];
  watchedInSeason: (seasonNumber: number) => Set<number> | undefined;
}

/**
 * Episode watches for a TV list item's current pass. Pass `enabled: false` to
 * skip the query until the seasons view is actually open.
 */
export function useEpisodeWatches(
  listItemId: Id<"listItems">,
  enabled: boolean
): EpisodeWatchesView {
  const data = useQuery(api.listItems.getEpisodeWatches, enabled ? { listItemId } : "skip");

  return useMemo(() => {
    const current = (data?.watches ?? [])
      .filter((w) => w.pass === data?.pass)
      .map(({ seasonNumber, episodeNumber, watchedAt }) => ({ seasonNumber, episodeNumber, watchedAt }))
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);

    const bySeason = new Map<number, EpisodeWatch[]>();
    for (const watch of current) {
      const list = bySeason.get(watch.seasonNumber) ?? [];
      list.push(watch);
      bySeason.set(watch.seasonNumber, list);
    }

    const isLoaded = data !== undefined;

    return {
      isLoaded,
      current,
      forSeason: (seasonNumber) => bySeason.get(seasonNumber) ?? [],
      watchedInSeason: (seasonNumber) =>
        isLoaded
          ? new Set((bySeason.get(seasonNumber) ?? []).map((w) => w.episodeNumber))
          : undefined,
    };
  }, [data]);
}
