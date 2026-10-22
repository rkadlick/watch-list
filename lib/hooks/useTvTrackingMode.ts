"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_TV_TRACKING_MODE, type TvTrackingMode } from "@/lib/episode-tracking";

/**
 * The signed-in user's TV tracking mode (season vs episode). Every card can
 * call this — Convex shares one subscription for identical queries.
 */
export function useTvTrackingMode(): {
  mode: TvTrackingMode;
  setMode: (mode: TvTrackingMode) => Promise<void>;
} {
  const prefs = useQuery(api.users.getMyPreferences);
  const setTvTrackingMode = useMutation(api.users.setTvTrackingMode).withOptimisticUpdate(
    (store, { mode }) => {
      const current = store.getQuery(api.users.getMyPreferences, {});
      if (current) {
        store.setQuery(api.users.getMyPreferences, {}, { ...current, tvTrackingMode: mode });
      }
    }
  );

  return {
    mode: prefs?.tvTrackingMode ?? DEFAULT_TV_TRACKING_MODE,
    setMode: async (mode) => {
      await setTvTrackingMode({ mode });
    },
  };
}
