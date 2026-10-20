import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { 
  validateString, 
  validateRating, 
  validateTags, 
  validateSeasonNumber, 
  validateDates, 
  LIMITS 
} from "./validation";
import { buildMediaSnapshot } from "../lib/media-snapshot";
import {
  buildWatchedMap,
  findLatestWatched,
  findNextUp,
  getTrackedSeasons,
  type EpisodeRef,
} from "../lib/episode-tracking";
import {
  applyEpisodeChanges,
  deleteEpisodeWatches,
  ensureEpisodeWatches,
  loadPassWatches,
  readEpisodeWatches,
  stampHistoryPasses,
} from "./episodeTracking";

// Helper function to get user's role in a list
function getUserRole(
  list: {
    ownerId: string;
    members: Array<{ clerkId: string; role: "admin" | "viewer" }>;
  },
  clerkId: string
): "creator" | "admin" | "viewer" | null {
  if (list.ownerId === clerkId) {
    return "creator";
  }
  const member = list.members.find((m) => m.clerkId === clerkId);
  return member ? member.role : null;
}

// Helper function to check if user can edit (creator or admin)
function canEdit(role: "creator" | "admin" | "viewer" | null): boolean {
  return role === "creator" || role === "admin";
}

// Helper function to check if user can view (any role)
function canView(role: "creator" | "admin" | "viewer" | null): boolean {
  return role !== null;
}

export const getListItems = query({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;

    // Verify user has access to this list
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canView(role)) {
      throw new Error("Not authorized to access this list");
    }

    // Get all items for this list
    const items = await ctx.db
      .query("listItems")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    // Fetch media details for each item
    const itemsWithMedia = await Promise.all(
      items.map(async (item) => {
        const media = await ctx.db.get(item.mediaId);
        return {
          ...item,
          media,
        };
      })
    );

    return itemsWithMedia;
  },
});

export const addListItem = mutation({
  args: {
    listId: v.id("lists"),
    mediaId: v.id("media"),
    status: v.optional(
      v.union(
        v.literal("to_watch"),
        v.literal("watching"),
        v.literal("watched"),
        v.literal("dropped")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;

    // Verify user has access to this list
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to add items to this list");
    }

    // Verify media exists
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media not found");
    }

    // Check if item already exists
    const existing = await ctx.db
      .query("listItems")
      .withIndex("by_list_and_media", (q) =>
        q.eq("listId", args.listId).eq("mediaId", args.mediaId)
      )
      .first();

    if (existing) {
      throw new Error("Item already exists in this list");
    }

    // Create list item
    const listItemId = await ctx.db.insert("listItems", {
      listId: args.listId,
      mediaId: args.mediaId,
      status: args.status || "to_watch",
      mediaSnapshot: buildMediaSnapshot(media),
    });

    // Update list's updatedAt timestamp
    await ctx.db.patch(args.listId, {
      updatedAt: Date.now(),
    });

    // For TV shows without episode data yet, schedule a background fetch
    if (media.type === "tv" && !media.episodesPopulated) {
      await ctx.scheduler.runAfter(0, internal.media.fetchAndStoreEpisodes, {
        mediaId: args.mediaId,
        tmdbId: media.tmdbId,
      });
    }

    return listItemId;
  },
});

// Update status (works for both movies and TV shows)
export const updateStatus = mutation({
  args: {
    listItemId: v.id("listItems"),
    status: v.union(
      v.literal("to_watch"),
      v.literal("watching"),
      v.literal("watched"),
      v.literal("dropped")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    // Verify user has access to this list
    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media) {
      throw new Error("Media not found");
    }

    // For movies, "watched" always goes through logWatchEntry so there's
    // a dated diary entry behind it — this mutation only handles the rest.
    if (media.type === "movie") {
      if (args.status === "watched") {
        throw new Error("Use logWatchEntry to mark a movie as watched");
      }
      await ctx.db.patch(args.listItemId, { status: args.status });
    } else {
      // For TV shows, status is calculated from season statuses
      // This function should only be used to set "dropped" status
      // For other statuses, use updateSeasonStatus
      if (args.status === "dropped") {
        // Capture drop position from current episode tracking
        await ctx.db.patch(args.listItemId, {
          status: args.status,
          droppedAtSeason: listItem.currentSeasonNumber,
          droppedAtEpisode: listItem.currentEpisodeNumber,
        });
      } else {
        throw new Error(
          "For TV shows, update season status instead of show status"
        );
      }
    }

    // Update list's updatedAt timestamp
    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update season status for a TV show
export const updateSeasonStatus = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    status: v.union(
      v.literal("to_watch"),
      v.literal("watching"),
      v.literal("watched"),
      v.literal("dropped")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    // Verify user has access to this list
    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    // Verify it's a TV show
    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    validateSeasonNumber(args.seasonNumber);

    const season = getTrackedSeason(media, args.seasonNumber);
    const progress = listItem.seasonProgress ?? [];
    const undropped = progress.map((p) =>
      p.seasonNumber === args.seasonNumber && p.status === "dropped"
        ? { ...p, status: "to_watch" as const }
        : p
    );

    // Season statuses are derived from episode watches — translate the
    // requested status into episode changes (or the sticky "dropped" flag)
    switch (args.status) {
      case "dropped": {
        const hasEntry = progress.some((p) => p.seasonNumber === args.seasonNumber);
        const dropped = hasEntry
          ? progress.map((p) =>
              p.seasonNumber === args.seasonNumber ? { ...p, status: "dropped" as const } : p
            )
          : [...progress, { seasonNumber: args.seasonNumber, status: "dropped" as const }];
        await applyEpisodeChanges(ctx, listItem, media, { seasonProgress: dropped });
        break;
      }
      case "watched": {
        if (!season) throw new Error(`Season ${args.seasonNumber} hasn't aired yet`);
        assertSeasonHasAired(season);
        await applyEpisodeChanges(ctx, listItem, media, {
          mark: seasonEpisodes(season.seasonNumber, season.episodeCount),
          seasonProgress: undropped,
        });
        break;
      }
      case "to_watch": {
        const { rows } = await ensureEpisodeWatches(ctx, listItem, media);
        await applyEpisodeChanges(ctx, listItem, media, {
          unmark: rows.filter((r) => r.seasonNumber === args.seasonNumber),
          seasonProgress: undropped,
        });
        break;
      }
      case "watching": {
        await applyEpisodeChanges(ctx, listItem, media, {
          seasonProgress: undropped,
          inProgress: true,
        });
        break;
      }
    }
  },
});

// Delete a list item
export const deleteListItem = mutation({
  args: {
    listItemId: v.id("listItems"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    // Verify user has access to this list
    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to delete this item");
    }

    await deleteEpisodeWatches(ctx, args.listItemId);
    await ctx.db.delete(args.listItemId);

    // Update list's updatedAt timestamp
    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update overall rating
export const updateRating = mutation({
  args: {
    listItemId: v.id("listItems"),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    // Validate rating
    const validatedRating = validateRating(args.rating, "Rating");

    await ctx.db.patch(args.listItemId, {
      rating: validatedRating,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update overall notes
export const updateNotes = mutation({
  args: {
    listItemId: v.id("listItems"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    // Validate and sanitize notes
    const validatedNotes = validateString(args.notes, {
      fieldName: "Notes",
      required: false,
      maxLength: LIMITS.NOTES_MAX,
    });

    await ctx.db.patch(args.listItemId, {
      notes: validatedNotes,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update priority
export const updatePriority = mutation({
  args: {
    listItemId: v.id("listItems"),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    await ctx.db.patch(args.listItemId, {
      priority: args.priority,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update tags
export const updateTags = mutation({
  args: {
    listItemId: v.id("listItems"),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    // Validate and sanitize tags
    const validatedTags = validateTags(args.tags);

    await ctx.db.patch(args.listItemId, {
      tags: validatedTags,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update dates (startedAt/finishedAt)
// Note: Pass null to explicitly clear a field, undefined to leave it unchanged
export const updateDates = mutation({
  args: {
    listItemId: v.id("listItems"),
    startedAt: v.optional(v.union(v.number(), v.null())),
    finishedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    const updates: {
      startedAt?: number | undefined;
      finishedAt?: number | undefined;
    } = {};
    
    // If startedAt is explicitly passed (not undefined), update it
    // null means clear it (set to undefined in DB), number means set the value
    if (args.startedAt !== undefined) {
      updates.startedAt = args.startedAt === null ? undefined : args.startedAt;
    }
    if (args.finishedAt !== undefined) {
      updates.finishedAt = args.finishedAt === null ? undefined : args.finishedAt;
    }

    // Validate date logic
    // Validate date logic
    validateDates({
      startedAt: updates.startedAt !== undefined ? updates.startedAt : listItem.startedAt,
      finishedAt: updates.finishedAt !== undefined ? updates.finishedAt : listItem.finishedAt,
      allowFuture: false,
    });

    await ctx.db.patch(args.listItemId, updates);

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update season rating
export const updateSeasonRating = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    // Validate season number and rating
    // Validate season number and rating
    validateSeasonNumber(args.seasonNumber);
    const validatedRating = validateRating(args.rating, "Season rating");

    const currentProgress = listItem.seasonProgress || [];
    const seasonIndex = currentProgress.findIndex(
      (p) => p.seasonNumber === args.seasonNumber
    );

    let newProgress: typeof currentProgress;
    if (seasonIndex >= 0) {
      newProgress = [...currentProgress];
      newProgress[seasonIndex] = {
        ...newProgress[seasonIndex],
        rating: validatedRating,
      };
    } else {
      // Season not in progress yet, add it
      newProgress = [
        ...currentProgress,
        {
          seasonNumber: args.seasonNumber,
          status: "to_watch",
          rating: validatedRating,
        },
      ];
    }

    await ctx.db.patch(args.listItemId, {
      seasonProgress: newProgress,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update season notes
export const updateSeasonNotes = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    // Validate season number and notes
    // Validate season number and notes
    validateSeasonNumber(args.seasonNumber);
    const validatedNotes = validateString(args.notes, {
      fieldName: "Season notes",
      required: false,
      maxLength: LIMITS.NOTES_MAX,
    });

    const currentProgress = listItem.seasonProgress || [];
    const seasonIndex = currentProgress.findIndex(
      (p) => p.seasonNumber === args.seasonNumber
    );

    let newProgress: typeof currentProgress;
    if (seasonIndex >= 0) {
      newProgress = [...currentProgress];
      newProgress[seasonIndex] = {
        ...newProgress[seasonIndex],
        notes: validatedNotes,
      };
    } else {
      // Season not in progress yet, add it
      newProgress = [
        ...currentProgress,
        {
          seasonNumber: args.seasonNumber,
          status: "to_watch",
          notes: validatedNotes,
        },
      ];
    }

    await ctx.db.patch(args.listItemId, {
      seasonProgress: newProgress,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

// Update season dates (startedAt/finishedAt)
// Note: Pass null to explicitly clear a field, undefined to leave it unchanged
export const updateSeasonDates = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    startedAt: v.optional(v.union(v.number(), v.null())),
    finishedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) {
      throw new Error("List item not found");
    }

    const list = await ctx.db.get(listItem.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canEdit(role)) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    // Validate season number and dates
    // Validate season number and dates
    validateSeasonNumber(args.seasonNumber);
    
    // Prepare date values for validation
    const startedAtValue = args.startedAt === null ? undefined : args.startedAt;
    const finishedAtValue = args.finishedAt === null ? undefined : args.finishedAt;
    
    validateDates({
      startedAt: startedAtValue,
      finishedAt: finishedAtValue,
      allowFuture: false,
    });

    const currentProgress = listItem.seasonProgress || [];
    const seasonIndex = currentProgress.findIndex(
      (p) => p.seasonNumber === args.seasonNumber
    );

    let newProgress: typeof currentProgress;
    if (seasonIndex >= 0) {
      newProgress = [...currentProgress];
      const updates: {
        startedAt?: number | undefined;
        finishedAt?: number | undefined;
      } = {};
      // null means clear it (set to undefined), number means set the value
      if (args.startedAt !== undefined) {
        updates.startedAt = args.startedAt === null ? undefined : args.startedAt;
      }
      if (args.finishedAt !== undefined) {
        updates.finishedAt = args.finishedAt === null ? undefined : args.finishedAt;
      }
      newProgress[seasonIndex] = {
        ...newProgress[seasonIndex],
        ...updates,
      };
    } else {
      // Season not in progress yet, add it
      newProgress = [
        ...currentProgress,
        {
          seasonNumber: args.seasonNumber,
          status: "to_watch",
          startedAt: args.startedAt === null ? undefined : args.startedAt,
          finishedAt: args.finishedAt === null ? undefined : args.finishedAt,
        },
      ];
    }

    await ctx.db.patch(args.listItemId, {
      seasonProgress: newProgress,
    });

    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
  },
});

async function getEditableTvItem(ctx: MutationCtx, listItemId: Id<"listItems">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const listItem = await ctx.db.get(listItemId);
  if (!listItem) throw new Error("List item not found");

  const list = await ctx.db.get(listItem.listId);
  if (!list) throw new Error("List not found");
  if (!canEdit(getUserRole(list, identity.subject))) throw new Error("Not authorized");

  const media = await ctx.db.get(listItem.mediaId);
  if (!media || media.type !== "tv") throw new Error("Only TV shows support episode tracking");

  return { listItem, media };
}

function getTrackedSeason(media: Doc<"media">, seasonNumber: number) {
  return getTrackedSeasons(media.seasonData).find((s) => s.seasonNumber === seasonNumber);
}

function seasonEpisodes(seasonNumber: number, episodeCount: number): EpisodeRef[] {
  return Array.from({ length: episodeCount }, (_, i) => ({ seasonNumber, episodeNumber: i + 1 }));
}

function assertSeasonHasAired(season: NonNullable<ReturnType<typeof getTrackedSeason>>): void {
  for (let episodeNumber = 1; episodeNumber <= season.episodeCount; episodeNumber++) {
    const airDate = resolveEpisodeAirDate(season, episodeNumber);
    if (airDate) assertEpisodeHasAired(season.seasonNumber, episodeNumber, airDate);
  }
}

function getEpisodeAirDate(
  episodes: Array<{ episodeNumber: number; airDate?: string }> | undefined,
  episodeNumber: number
): string | undefined {
  return episodes?.find((e) => e.episodeNumber === episodeNumber)?.airDate;
}

function resolveEpisodeAirDate(
  season:
    | {
        airDate?: string;
        episodes?: Array<{ episodeNumber: number; airDate?: string }>;
      }
    | undefined,
  episodeNumber: number
): string | undefined {
  if (!season) return undefined;

  const episodeDate = getEpisodeAirDate(season.episodes, episodeNumber);
  if (episodeDate) return episodeDate;

  if (episodeNumber === 1 && season.airDate) return season.airDate;

  return undefined;
}

// Earliest timezone offset (UTC+14). Clients lock episodes until local
// midnight; the server can't know the caller's timezone, so it only rejects
// an episode before it has aired anywhere.
const EARLIEST_TZ_OFFSET_MS = 14 * 60 * 60 * 1000;

function isEpisodeUnreleased(airDate: string | undefined): boolean {
  if (!airDate) return false;
  return new Date(`${airDate}T00:00:00Z`).getTime() - EARLIEST_TZ_OFFSET_MS > Date.now();
}

function assertEpisodeHasAired(
  seasonNumber: number,
  episodeNumber: number,
  airDate: string | undefined
): void {
  if (isEpisodeUnreleased(airDate)) {
    const suffix = airDate ? ` (airs ${airDate})` : "";
    throw new Error(`S${seasonNumber}E${episodeNumber} hasn't aired yet${suffix}`);
  }
}

// Every episode watch for a TV list item (all passes) — the client filters to
// the item's watchPass for the current tracker and uses the rest as history
export const getEpisodeWatches = query({
  args: { listItemId: v.id("listItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) return null;

    const list = await ctx.db.get(listItem.listId);
    if (!list || !canView(getUserRole(list, identity.subject))) {
      throw new Error("Not authorized");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") return null;

    return readEpisodeWatches(ctx, listItem, media);
  },
});

// Mark the next episode (the one after the latest watched) as watched
export const advanceEpisode = mutation({
  args: { listItemId: v.id("listItems") },
  handler: async (ctx, args) => {
    const { listItem, media } = await getEditableTvItem(ctx, args.listItemId);

    const seasons = getTrackedSeasons(media.seasonData);
    if (seasons.length === 0) throw new Error("No season data available");

    const { rows } = await ensureEpisodeWatches(ctx, listItem, media);
    const nextUp = findNextUp(seasons, buildWatchedMap(rows));
    if (!nextUp) return;

    const season = seasons.find((s) => s.seasonNumber === nextUp.seasonNumber);
    assertEpisodeHasAired(
      nextUp.seasonNumber,
      nextUp.episodeNumber,
      resolveEpisodeAirDate(season, nextUp.episodeNumber)
    );

    await applyEpisodeChanges(ctx, listItem, media, { mark: [nextUp] });
  },
});

// Unmark the latest watched episode (undo last advance)
export const rewindEpisode = mutation({
  args: { listItemId: v.id("listItems") },
  handler: async (ctx, args) => {
    const { listItem, media } = await getEditableTvItem(ctx, args.listItemId);

    const seasons = getTrackedSeasons(media.seasonData);
    if (seasons.length === 0) throw new Error("No season data available");

    const { rows } = await ensureEpisodeWatches(ctx, listItem, media);
    const latest = findLatestWatched(seasons, buildWatchedMap(rows));
    if (!latest) return;

    await applyEpisodeChanges(ctx, listItem, media, { unmark: [latest] });
  },
});

// Mark every episode in a season as watched
export const markSeasonWatched = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const { listItem, media } = await getEditableTvItem(ctx, args.listItemId);

    const season = getTrackedSeason(media, args.seasonNumber);
    if (!season) throw new Error(`Season ${args.seasonNumber} hasn't aired yet`);
    assertSeasonHasAired(season);

    await applyEpisodeChanges(ctx, listItem, media, {
      mark: seasonEpisodes(season.seasonNumber, season.episodeCount),
    });
  },
});

// Toggle a single episode in the current pass
export const setEpisodeWatched = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    episodeNumber: v.number(),
    watched: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { listItem, media } = await getEditableTvItem(ctx, args.listItemId);

    const season = getTrackedSeason(media, args.seasonNumber);
    if (!season || args.episodeNumber < 1 || args.episodeNumber > season.episodeCount) {
      throw new Error(`S${args.seasonNumber}E${args.episodeNumber} not found`);
    }

    const ref = { seasonNumber: args.seasonNumber, episodeNumber: args.episodeNumber };
    if (args.watched) {
      assertEpisodeHasAired(
        ref.seasonNumber,
        ref.episodeNumber,
        resolveEpisodeAirDate(season, ref.episodeNumber)
      );
      await applyEpisodeChanges(ctx, listItem, media, { mark: [ref] });
    } else {
      await applyEpisodeChanges(ctx, listItem, media, { unmark: [ref] });
    }
  },
});

// Update sort order for manual reordering
export const updateSortOrder = mutation({
  args: {
    listItemId: v.id("listItems"),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;

    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) throw new Error("Not authorized");

    await ctx.db.patch(args.listItemId, { sortOrder: args.sortOrder });
  },
});

// Export list items for CSV download
export const exportListItems = query({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;

    // Verify user has access to this list
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (!canView(role)) {
      throw new Error("Not authorized to access this list");
    }

    // Get all list items
    const listItems = await ctx.db
      .query("listItems")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    // Fetch media details for each item
    const itemsWithMedia = await Promise.all(
      listItems.map(async (item) => {
        const media = item.mediaId ? await ctx.db.get(item.mediaId) : null;
        
        return {
          title: media?.title || "Unknown",
          type: media?.type || "unknown",
          status: item.status,
          rating: item.rating,
          priority: item.priority,
          tags: item.tags?.join(", ") || "",
          startedAt: item.startedAt,
          finishedAt: item.finishedAt,
          notes: item.notes || "",
          releaseDate: media?.releaseDate || "",
          genres: media?.genres?.map((g) => g.name).join(", ") || "",
          totalSeasons: media?.totalSeasons,
          totalEpisodes: media?.totalEpisodes,
        };
      })
    );

    // Format data for export
    return {
      listName: list.name,
      exportedAt: Date.now(),
      items: itemsWithMedia,
    };
  },
});

// Append a manual watch entry to watchHistory (movies: just dates; TV: dates + optional seasons)
export const logWatchEntry = mutation({
  args: {
    listItemId: v.id("listItems"),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
    seasons: v.optional(
      v.array(
        v.object({
          seasonNumber: v.number(),
          startedAt: v.optional(v.number()),
          finishedAt: v.optional(v.number()),
          rating: v.optional(v.number()),
          notes: v.optional(v.string()),
          episodeDates: v.optional(
            v.array(
              v.object({
                episodeNumber: v.number(),
                watchedAt: v.number(),
              })
            )
          ),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;

    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) throw new Error("Not authorized");

    const validatedRating = validateRating(args.rating, "Rating");

    const entry: {
      startedAt?: number;
      finishedAt?: number;
      rating?: number;
      notes?: string;
      seasons?: typeof args.seasons;
    } = {
      finishedAt: args.finishedAt ?? Date.now(),
      rating: validatedRating,
      notes: args.notes,
      seasons: args.seasons,
    };

    const existing = listItem.watchHistory ?? [];
    const patch: {
      watchHistory: typeof existing;
      status?: "watched";
      finishedAt?: number;
      rating?: number;
    } = {
      watchHistory: [...existing, entry],
    };

    // Movies: every logged watch (first included) marks the item watched and
    // becomes the new "current" watch reflected in the top-level fields.
    const media = await ctx.db.get(listItem.mediaId);
    if (media?.type === "movie") {
      patch.status = "watched";
      patch.finishedAt = entry.finishedAt;
      if (validatedRating !== undefined) {
        patch.rating = validatedRating;
      }
    }

    await ctx.db.patch(args.listItemId, patch);
    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

// Remove a watch history entry by index
export const removeWatchEntry = mutation({
  args: {
    listItemId: v.id("listItems"),
    entryIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;

    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) throw new Error("Not authorized");

    const existing = listItem.watchHistory ?? [];
    if (args.entryIndex < 0 || args.entryIndex >= existing.length) {
      throw new Error("Watch history entry index out of bounds");
    }

    const updated = existing.filter((_, i) => i !== args.entryIndex);
    const patch: {
      watchHistory?: typeof existing;
      status?: "to_watch" | "watched";
      finishedAt?: number;
      rating?: number;
    } = {
      watchHistory: updated.length > 0 ? updated : undefined,
    };

    const media = await ctx.db.get(listItem.mediaId);

    // TV: each entry archives a pass of episode watches — remove those too.
    // Migrate first so legacy passes (numbered by history position) stay put.
    if (media?.type === "tv") {
      const { pass } = await ensureEpisodeWatches(ctx, listItem, media);
      const history = stampHistoryPasses(existing);
      const removedPass = history[args.entryIndex].pass;
      for (const row of await loadPassWatches(ctx, listItem._id, removedPass)) {
        await ctx.db.delete(row._id);
      }
      await ctx.db.patch(args.listItemId, {
        watchPass: pass,
        watchHistory: updated.length > 0 ? history.filter((_, i) => i !== args.entryIndex) : undefined,
      });
      const fresh = await ctx.db.get(args.listItemId);
      await applyEpisodeChanges(ctx, fresh!, media, { preserveDropped: true });
      return;
    }

    // Movies: re-sync the top-level "current watch" fields from what remains.
    if (media?.type === "movie") {
      if (updated.length === 0) {
        patch.status = "to_watch";
        patch.finishedAt = undefined;
        patch.rating = undefined;
      } else {
        const latest = updated[updated.length - 1];
        const lastRated = [...updated].reverse().find((e) => e.rating !== undefined);
        patch.finishedAt = latest.finishedAt;
        patch.rating = lastRated?.rating;
      }
    }

    await ctx.db.patch(args.listItemId, patch);
    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

// Archive the current TV show session to watchHistory and reset the tracker for a rewatch
export const startRewatch = mutation({
  args: { listItemId: v.id("listItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;

    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) throw new Error("Not authorized");

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("startRewatch is only available for TV shows");
    }

    if (listItem.status !== "watched") {
      throw new Error("Can only start a rewatch after completing the show");
    }

    // Episode watches stay in episodeWatches under this pass; the history
    // entry keeps the show/season-level dates, ratings and notes
    const { pass } = await ensureEpisodeWatches(ctx, listItem, media);

    const seasons = (listItem.seasonProgress ?? []).map((p) => ({
      seasonNumber: p.seasonNumber,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      rating: p.rating,
      notes: p.notes,
    }));

    const historyEntry = {
      startedAt: listItem.startedAt,
      finishedAt: listItem.finishedAt,
      rating: listItem.rating,
      notes: listItem.notes,
      pass,
      seasons: seasons.length > 0 ? seasons : undefined,
    };

    await ctx.db.patch(args.listItemId, {
      watchHistory: [...(listItem.watchHistory ?? []), historyEntry],
      startedAt: undefined,
      finishedAt: undefined,
      rating: undefined,
      notes: undefined,
    });

    const reset = await ctx.db.get(args.listItemId);
    await applyEpisodeChanges(ctx, reset!, media, {
      pass: pass + 1,
      seasonProgress: [],
      inProgress: true,
    });
  },
});

export const acknowledgeListUpdates = mutation({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, identity.subject);
    if (!canView(role)) {
      throw new Error("Not authorized");
    }

    const userId = identity.subject;
    const now = Date.now();

    const existing = await ctx.db
      .query("listUpdateAcknowledgments")
      .withIndex("by_user_and_list", (q) =>
        q.eq("userId", userId).eq("listId", args.listId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastAcknowledgedAt: now });
    } else {
      await ctx.db.insert("listUpdateAcknowledgments", {
        userId,
        listId: args.listId,
        lastAcknowledgedAt: now,
      });
    }
  },
});
