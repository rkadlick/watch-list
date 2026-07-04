import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  buildMediaSnapshot,
  diffMediaSnapshots,
  mergePendingChanges,
  type MediaSnapshot,
} from "../lib/media-snapshot";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function getHighestWatchedSeasonNumber(
  seasonProgress: Array<{ seasonNumber: number; status: string }> | undefined
): number {
  const watched = (seasonProgress ?? []).filter((p) => p.status === "watched");
  if (watched.length === 0) return 0;
  return Math.max(...watched.map((p) => p.seasonNumber));
}

export const reconcileListItemsAfterMediaUpdate = internalMutation({
  args: {
    mediaId: v.id("media"),
    previousSnapshot: v.optional(
      v.object({
        capturedAt: v.number(),
        releaseDate: v.optional(v.string()),
        seasonCount: v.number(),
        seasons: v.array(
          v.object({
            seasonNumber: v.number(),
            airDate: v.optional(v.string()),
            episodeCount: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) return;

    const currentSnapshot = buildMediaSnapshot(media);
    const previousSnapshot = args.previousSnapshot as MediaSnapshot | undefined;
    const today = todayUtc();
    const detectedAt = Date.now();

    const listItems = await ctx.db
      .query("listItems")
      .withIndex("by_media_id", (q) => q.eq("mediaId", args.mediaId))
      .collect();

    for (const item of listItems) {
      const baseline = item.mediaSnapshot ?? previousSnapshot;
      const changes = diffMediaSnapshots(
        baseline,
        currentSnapshot,
        media.type,
        today,
        detectedAt
      );

      const patch: Record<string, unknown> = {
        mediaSnapshot: currentSnapshot,
      };

      if (changes.length > 0) {
        patch.pendingChanges = mergePendingChanges(item.pendingChanges, changes);
      }

      // Finished TV show: advance position to next pending season
      if (
        media.type === "tv" &&
        item.status === "watched" &&
        changes.some((c) => c.type === "new_season" || c.type === "season_released")
      ) {
        const highestWatched = getHighestWatchedSeasonNumber(item.seasonProgress);
        const nextSeason = (media.seasonData ?? [])
          .filter((s) => s.seasonNumber > 0 && s.seasonNumber > highestWatched)
          .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];

        if (nextSeason) {
          patch.currentSeasonNumber = nextSeason.seasonNumber;
          patch.currentEpisodeNumber = 1;
        }
      }

      await ctx.db.patch(item._id, patch);
    }
  },
});

export const initializeMediaSnapshot = internalMutation({
  args: {
    listItemId: v.id("listItems"),
    mediaId: v.id("media"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.listItemId);
    if (!item || item.mediaSnapshot) return;

    const media = await ctx.db.get(args.mediaId);
    if (!media) return;

    await ctx.db.patch(args.listItemId, {
      mediaSnapshot: buildMediaSnapshot(media),
    });
  },
});
