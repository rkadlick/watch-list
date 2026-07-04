import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { 
  validateString, 
  validateRating, 
  validateTags, 
  validateSeasonNumber, 
  validateDates, 
  LIMITS 
} from "./validation";
import { buildMediaSnapshot } from "../lib/media-snapshot";

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

    // For movies, update status and auto-set watch date
    if (media.type === "movie") {
      const updates: { status: typeof args.status; finishedAt?: number } = {
        status: args.status,
      };
      if (args.status === "watched") {
        updates.finishedAt = Date.now();
      }
      await ctx.db.patch(args.listItemId, updates);
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

    // Validate season number
    validateSeasonNumber(args.seasonNumber);

    // Handle switching "watching" season — only one allowed at a time
    let currentProgress = listItem.seasonProgress || [];

    if (args.status === "watching") {
      // If another season is currently "watching", reset it to "to_watch"
      currentProgress = currentProgress.map((p) =>
        p.status === "watching" && p.seasonNumber !== args.seasonNumber
          ? { ...p, status: "to_watch" }
          : p
      );
    }

    // Update season progress
    let newProgress = [...currentProgress];

    if (args.status === "to_watch") {
      // Remove from progress if setting to "to_watch"
      newProgress = newProgress.filter(
        (p) => p.seasonNumber !== args.seasonNumber
      );
    } else {
      // Add or update season status
      const existingIndex = newProgress.findIndex(
        (p) => p.seasonNumber === args.seasonNumber
      );
      if (existingIndex >= 0) {
        // Preserve existing fields (rating, notes, dates) when updating status
        newProgress[existingIndex] = {
          ...newProgress[existingIndex],
          status: args.status,
        };
      } else {
        newProgress.push({
          seasonNumber: args.seasonNumber,
          status: args.status,
        });
      }
    }

    // Calculate overall show status based on visible season statuses only
    // (hidden seasons = no airDate = announced but not released yet)
    const allSeasons = media.seasonData || [];
    const visibleSeasons = allSeasons.filter((s) => s.airDate);

    const getSeasonStatus = (seasonNumber: number) => {
      const progress = newProgress.find(
        (p) => p.seasonNumber === seasonNumber
      );
      if (progress?.status === "watched") return "watched";
      if (progress?.status === "watching") return "watching";
      if (progress?.status === "dropped") return "dropped";
      return "to_watch";
    };

    let overallStatus: "to_watch" | "watching" | "watched" | "dropped";

    if (visibleSeasons.length === 0) {
      // No visible seasons — use fallback (stored status or to_watch)
      overallStatus = listItem.status ?? "to_watch";
    } else {
      const visibleStatuses = visibleSeasons.map((s) =>
        getSeasonStatus(s.seasonNumber)
      );

      // Priority: dropped > watching > watched/to_watch
      if (visibleStatuses.some((s) => s === "dropped")) {
        overallStatus = "dropped";
      } else if (visibleStatuses.some((s) => s === "watching")) {
        overallStatus = "watching";
      } else if (visibleStatuses.every((s) => s === "watched")) {
        overallStatus = "watched";
      } else if (visibleStatuses.every((s) => s === "to_watch")) {
        overallStatus = "to_watch";
      } else {
        // Mixed watched + to_watch → to_watch
        overallStatus = "to_watch";
      }
    }

    await ctx.db.patch(args.listItemId, {
      seasonProgress: newProgress.length > 0 ? newProgress : undefined,
      status: overallStatus,
    });

    // Update list's updatedAt timestamp
    await ctx.db.patch(listItem.listId, {
      updatedAt: Date.now(),
    });
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

type SeasonProgressEntry = {
  seasonNumber: number;
  status: "to_watch" | "watching" | "watched" | "dropped";
  rating?: number;
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
  episodeDates?: Array<{ episodeNumber: number; watchedAt: number }>;
};

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

function isEpisodeUnreleased(airDate: string | undefined): boolean {
  if (!airDate) return false;
  return new Date(`${airDate}T00:00:00`).getTime() > Date.now();
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

function recordEpisodeWatch(
  progress: SeasonProgressEntry[],
  seasonNumber: number,
  episodeNumber: number,
  episodeCount: number,
  watchedAt: number
): SeasonProgressEntry[] {
  const next = [...progress];
  const idx = next.findIndex((p) => p.seasonNumber === seasonNumber);
  const seasonEntry: SeasonProgressEntry =
    idx >= 0
      ? { ...next[idx] }
      : { seasonNumber, status: "watching" };

  const existingDates = seasonEntry.episodeDates ?? [];
  if (!existingDates.some((d) => d.episodeNumber === episodeNumber)) {
    seasonEntry.episodeDates = [...existingDates, { episodeNumber, watchedAt }];
  }

  if (episodeNumber === 1 && !seasonEntry.startedAt) {
    seasonEntry.startedAt = watchedAt;
  }
  if (episodeNumber === episodeCount) {
    seasonEntry.finishedAt = watchedAt;
  }

  if (idx >= 0) {
    next[idx] = seasonEntry;
  } else {
    next.push(seasonEntry);
  }

  return next;
}

function getShowDateUpdates(
  visibleSeasons: Array<{ seasonNumber: number; episodeCount: number }>,
  seasonNumber: number,
  episodeNumber: number,
  watchedAt: number,
  existingStartedAt?: number,
  existingFinishedAt?: number
): { startedAt?: number; finishedAt?: number } {
  const sorted = [...visibleSeasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const firstSeason = sorted[0];
  const lastSeason = sorted[sorted.length - 1];
  const updates: { startedAt?: number; finishedAt?: number } = {};

  if (
    firstSeason &&
    seasonNumber === firstSeason.seasonNumber &&
    episodeNumber === 1 &&
    !existingStartedAt
  ) {
    updates.startedAt = watchedAt;
  }

  if (
    lastSeason &&
    seasonNumber === lastSeason.seasonNumber &&
    episodeNumber === lastSeason.episodeCount
  ) {
    updates.finishedAt = watchedAt;
  }

  return updates;
}

function markSeasonEpisodesWatched(
  progress: SeasonProgressEntry[],
  seasonNumber: number,
  episodeCount: number,
  watchedAt: number
): SeasonProgressEntry[] {
  let next = progress;
  for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber++) {
    next = recordEpisodeWatch(next, seasonNumber, episodeNumber, episodeCount, watchedAt);
  }

  const idx = next.findIndex((p) => p.seasonNumber === seasonNumber);
  if (idx >= 0) {
    next[idx] = { ...next[idx], status: "watched" };
  }

  return next;
}

function undoEpisodeWatch(
  progress: SeasonProgressEntry[],
  seasonNumber: number,
  episodeNumber: number,
  episodeCount: number
): SeasonProgressEntry[] {
  const idx = progress.findIndex((p) => p.seasonNumber === seasonNumber);
  if (idx < 0) return progress;

  const seasonEntry = { ...progress[idx] };
  seasonEntry.episodeDates = (seasonEntry.episodeDates ?? []).filter(
    (d) => d.episodeNumber !== episodeNumber
  );

  if (episodeNumber === 1) {
    seasonEntry.startedAt = undefined;
  }
  if (episodeNumber === episodeCount) {
    seasonEntry.finishedAt = undefined;
  }

  if (
    !seasonEntry.startedAt &&
    !seasonEntry.finishedAt &&
    !seasonEntry.notes &&
    !seasonEntry.rating &&
    (!seasonEntry.episodeDates || seasonEntry.episodeDates.length === 0) &&
    seasonEntry.status === "watching"
  ) {
    return progress.filter((p) => p.seasonNumber !== seasonNumber);
  }

  const next = [...progress];
  next[idx] = seasonEntry;
  return next;
}

// Helper: recalculate overall TV show status from seasonProgress
function recalcTVStatus(
  visibleSeasons: Array<{ seasonNumber: number }>,
  seasonProgress: Array<{ seasonNumber: number; status: string }>,
  fallback: string
): "to_watch" | "watching" | "watched" | "dropped" {
  if (visibleSeasons.length === 0) return fallback as "to_watch" | "watching" | "watched" | "dropped";

  const getStatus = (num: number) => {
    const p = seasonProgress.find((s) => s.seasonNumber === num);
    return p?.status ?? "to_watch";
  };

  const statuses = visibleSeasons.map((s) => getStatus(s.seasonNumber));
  if (statuses.some((s) => s === "dropped")) return "dropped";
  if (statuses.some((s) => s === "watching")) return "watching";
  if (statuses.every((s) => s === "watched")) return "watched";
  if (statuses.every((s) => s === "to_watch")) return "to_watch";
  return "to_watch";
}

// Advance episode by one (mark current as watched, move to next)
export const advanceEpisode = mutation({
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
    if (!media || media.type !== "tv") throw new Error("Only TV shows support episode tracking");

    const visibleSeasons = (media.seasonData ?? []).filter((s) => s.airDate);
    if (visibleSeasons.length === 0) throw new Error("No season data available");

    const curSeason = listItem.currentSeasonNumber ?? 1;
    const curEpisode = listItem.currentEpisodeNumber ?? 1;

    const currentSeasonData = visibleSeasons.find((s) => s.seasonNumber === curSeason);
    const episodeCount = currentSeasonData?.episodeCount ?? 1;

    const currentAirDate = resolveEpisodeAirDate(currentSeasonData, curEpisode);
    if (currentAirDate && isEpisodeUnreleased(currentAirDate)) {
      assertEpisodeHasAired(curSeason, curEpisode, currentAirDate);
    }

    const isLastEpisodeOfSeason = curEpisode >= episodeCount;

    let newSeason = curSeason;
    let newEpisode = curEpisode;
    let markCurrentSeasonWatched = false;

    // Record watchedAt for the episode we're leaving (curEpisode is now finished)
    const now = Date.now();
    let progress = recordEpisodeWatch(
      (listItem.seasonProgress ?? []) as SeasonProgressEntry[],
      curSeason,
      curEpisode,
      episodeCount,
      now
    );
    const showDateUpdates = getShowDateUpdates(
      visibleSeasons,
      curSeason,
      curEpisode,
      now,
      listItem.startedAt,
      listItem.finishedAt
    );

    if (isLastEpisodeOfSeason) {
      // End of season — find next visible season
      const sortedSeasons = [...visibleSeasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
      const nextSeason = sortedSeasons.find((s) => s.seasonNumber > curSeason);
      markCurrentSeasonWatched = true;

      if (nextSeason) {
        newSeason = nextSeason.seasonNumber;
        newEpisode = 1;
      } else {
        // Last episode of last season — mark show as watched
        const updatedProgress = progress.map((p) =>
          p.seasonNumber === curSeason ? { ...p, status: "watched" as const } : p
        );
        const hasExisting = updatedProgress.some((p) => p.seasonNumber === curSeason);
        const finalProgress = hasExisting
          ? updatedProgress
          : [...updatedProgress, { seasonNumber: curSeason, status: "watched" as const }];

        await ctx.db.patch(args.listItemId, {
          status: "watched",
          currentSeasonNumber: curSeason,
          currentEpisodeNumber: curEpisode,
          seasonProgress: finalProgress,
          ...showDateUpdates,
        });
        await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
        return;
      }
    } else {
      newEpisode = curEpisode + 1;
    }

    if (markCurrentSeasonWatched) {
      const existingIdx = progress.findIndex((p) => p.seasonNumber === curSeason);
      if (existingIdx >= 0) {
        progress[existingIdx] = { ...progress[existingIdx], status: "watched" };
      } else {
        progress.push({ seasonNumber: curSeason, status: "watched" });
      }
    }

    // Ensure next season is set to "watching" in progress if not already watched
    const nextSeasonInProgress = progress.findIndex((p) => p.seasonNumber === newSeason);
    if (!markCurrentSeasonWatched || newSeason !== curSeason) {
      if (nextSeasonInProgress >= 0) {
        if (progress[nextSeasonInProgress].status !== "watched") {
          progress[nextSeasonInProgress] = { ...progress[nextSeasonInProgress], status: "watching" };
        }
      } else {
        progress.push({ seasonNumber: newSeason, status: "watching" });
      }
    }

    // Recalculate show status
    const newStatus = recalcTVStatus(visibleSeasons, progress, listItem.status);

    await ctx.db.patch(args.listItemId, {
      currentSeasonNumber: newSeason,
      currentEpisodeNumber: newEpisode,
      seasonProgress: progress,
      status: newStatus,
      ...showDateUpdates,
    });

    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

// Rewind episode by one (undo last advance)
export const rewindEpisode = mutation({
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
    if (!media || media.type !== "tv") throw new Error("Only TV shows support episode tracking");

    const visibleSeasons = (media.seasonData ?? []).filter((s) => s.airDate);
    if (visibleSeasons.length === 0) throw new Error("No season data available");

    const curSeason = listItem.currentSeasonNumber ?? 1;
    const curEpisode = listItem.currentEpisodeNumber ?? 1;

    let newSeason = curSeason;
    let newEpisode = curEpisode;

    if (curEpisode <= 1) {
      // Go to previous season
      const sortedSeasons = [...visibleSeasons].sort((a, b) => b.seasonNumber - a.seasonNumber);
      const prevSeason = sortedSeasons.find((s) => s.seasonNumber < curSeason);

      if (!prevSeason) {
        // Already at S1E1 — do nothing
        return;
      }

      newSeason = prevSeason.seasonNumber;
      newEpisode = prevSeason.episodeCount;
    } else {
      newEpisode = curEpisode - 1;
    }

    const unwatchedSeason = newSeason;
    const unwatchedEpisode = newEpisode;
    const unwatchedSeasonData = visibleSeasons.find((s) => s.seasonNumber === unwatchedSeason);
    const unwatchedEpisodeCount = unwatchedSeasonData?.episodeCount ?? 1;

    // Update seasonProgress — reopen previous season to "watching" if we went back
    let progress = undoEpisodeWatch(
      (listItem.seasonProgress ?? []) as SeasonProgressEntry[],
      unwatchedSeason,
      unwatchedEpisode,
      unwatchedEpisodeCount
    );
    if (newSeason !== curSeason) {
      // The season we're rewinding into should become "watching" again
      const prevIdx = progress.findIndex((p) => p.seasonNumber === newSeason);
      if (prevIdx >= 0) {
        progress[prevIdx] = { ...progress[prevIdx], status: "watching" };
      } else {
        progress.push({ seasonNumber: newSeason, status: "watching" });
      }
      // Remove "watching" from current season if it was set
      const curIdx = progress.findIndex((p) => p.seasonNumber === curSeason);
      if (curIdx >= 0 && progress[curIdx].status === "watching") {
        progress = progress.filter((p) => p.seasonNumber !== curSeason);
      }
    }

    const newStatus = recalcTVStatus(visibleSeasons, progress, listItem.status);

    const sortedSeasons = [...visibleSeasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
    const firstSeason = sortedSeasons[0];
    const lastSeason = sortedSeasons[sortedSeasons.length - 1];
    const showDateUpdates: { startedAt?: number; finishedAt?: number } = {};

    if (
      firstSeason &&
      unwatchedSeason === firstSeason.seasonNumber &&
      unwatchedEpisode === 1
    ) {
      showDateUpdates.startedAt = undefined;
    }
    if (
      lastSeason &&
      unwatchedSeason === lastSeason.seasonNumber &&
      unwatchedEpisode === lastSeason.episodeCount
    ) {
      showDateUpdates.finishedAt = undefined;
    }

    await ctx.db.patch(args.listItemId, {
      currentSeasonNumber: newSeason,
      currentEpisodeNumber: newEpisode,
      seasonProgress: progress.length > 0 ? progress : undefined,
      status: newStatus,
      ...showDateUpdates,
    });

    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

// Mark an entire season as watched and advance position to next season
export const markSeasonWatched = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
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

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") throw new Error("Only TV shows support season tracking");

    const visibleSeasons = (media.seasonData ?? []).filter((s) => s.airDate);
    const sortedSeasons = [...visibleSeasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
    const seasonData = visibleSeasons.find((s) => s.seasonNumber === args.seasonNumber);
    const episodeCount = seasonData?.episodeCount ?? 1;

    for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber++) {
      const airDate = resolveEpisodeAirDate(seasonData, episodeNumber);
      if (!airDate) continue;
      if (isEpisodeUnreleased(airDate)) {
        assertEpisodeHasAired(args.seasonNumber, episodeNumber, airDate);
      }
    }

    // Mark every episode in the season as watched with today's date
    const now = Date.now();
    let progress = markSeasonEpisodesWatched(
      (listItem.seasonProgress ?? []) as SeasonProgressEntry[],
      args.seasonNumber,
      episodeCount,
      now
    );

    const showDateUpdates = {
      ...getShowDateUpdates(
        visibleSeasons,
        args.seasonNumber,
        1,
        now,
        listItem.startedAt,
        listItem.finishedAt
      ),
      ...getShowDateUpdates(
        visibleSeasons,
        args.seasonNumber,
        episodeCount,
        now,
        listItem.startedAt,
        listItem.finishedAt
      ),
    };

    // Advance position to start of next season (or stay if last)
    const nextSeason = sortedSeasons.find((s) => s.seasonNumber > args.seasonNumber);
    let newSeason = args.seasonNumber;
    let newEpisode = episodeCount;

    if (nextSeason) {
      newSeason = nextSeason.seasonNumber;
      newEpisode = 1;
      // Set next season to watching
      const nextIdx = progress.findIndex((p) => p.seasonNumber === nextSeason.seasonNumber);
      if (nextIdx >= 0) {
        if (progress[nextIdx].status !== "watched") {
          progress[nextIdx] = { ...progress[nextIdx], status: "watching" };
        }
      } else {
        progress.push({ seasonNumber: nextSeason.seasonNumber, status: "watching" });
      }
    }

    const newStatus = nextSeason
      ? recalcTVStatus(visibleSeasons, progress, listItem.status)
      : "watched";

    await ctx.db.patch(args.listItemId, {
      currentSeasonNumber: newSeason,
      currentEpisodeNumber: newEpisode,
      seasonProgress: progress,
      status: newStatus,
      ...showDateUpdates,
    });

    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
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
    await ctx.db.patch(args.listItemId, {
      watchHistory: [...existing, entry],
    });

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
    await ctx.db.patch(args.listItemId, {
      watchHistory: updated.length > 0 ? updated : undefined,
    });

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

    // Build the history entry from current session state
    const seasons = (listItem.seasonProgress ?? []).map((p) => ({
      seasonNumber: p.seasonNumber,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      rating: p.rating,
      notes: p.notes,
      episodeDates: p.episodeDates,
    }));

    const historyEntry = {
      startedAt: listItem.startedAt,
      finishedAt: listItem.finishedAt,
      rating: listItem.rating,
      notes: listItem.notes,
      seasons: seasons.length > 0 ? seasons : undefined,
    };

    const existing = listItem.watchHistory ?? [];

    await ctx.db.patch(args.listItemId, {
      watchHistory: [...existing, historyEntry],
      // Reset active tracker
      status: "watching",
      currentSeasonNumber: 1,
      currentEpisodeNumber: 1,
      seasonProgress: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      rating: undefined,
      notes: undefined,
    });

    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
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
