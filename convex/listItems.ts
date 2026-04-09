import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { 
  validateString, 
  validateRating, 
  validateTags, 
  validateSeasonNumber, 
  validateDates, 
  LIMITS 
} from "./validation";

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

type Status = "to_watch" | "watching" | "watched" | "dropped";

interface SeasonDataEntry {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
}

interface SeasonProgressEntry {
  seasonNumber: number;
  status: Status;
  rating?: number;
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
  spans?: Array<{ startedAt?: number; finishedAt?: number }>;
}

function deriveSeasonStatusFromProgress(
  progress: SeasonProgressEntry | undefined
): Status {
  if (!progress) return "to_watch";
  if (progress.status === "dropped") return "dropped";

  const spans = progress.spans;
  if (spans && spans.length > 0) {
    if (spans.some((s) => s.startedAt != null && s.finishedAt == null)) {
      return "watching";
    }
    return "watched";
  }

  if (progress.startedAt != null && progress.finishedAt == null) {
    return "watching";
  }
  if (progress.finishedAt != null) return "watched";

  return progress.status ?? "to_watch";
}

function deriveOverallTVStatus(
  seasonData: SeasonDataEntry[],
  seasonProgress: SeasonProgressEntry[],
  fallback: Status
): Status {
  const visible = seasonData.filter((s) => s.airDate);
  if (visible.length === 0) return fallback;

  const statuses = visible.map((s) => {
    const p = seasonProgress.find((sp) => sp.seasonNumber === s.seasonNumber);
    return deriveSeasonStatusFromProgress(p);
  });

  if (statuses.some((s) => s === "dropped")) return "dropped";
  if (statuses.some((s) => s === "watching")) return "watching";
  if (statuses.every((s) => s === "watched")) return "watched";
  if (statuses.every((s) => s === "to_watch")) return "to_watch";
  return "to_watch";
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
    });

    // Update list's updatedAt timestamp
    await ctx.db.patch(args.listId, {
      updatedAt: Date.now(),
    });

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

    // For movies, just update status
    if (media.type === "movie") {
      await ctx.db.patch(args.listItemId, {
        status: args.status,
      });
    } else {
      // For TV shows, status is calculated from season statuses
      // This function should only be used to set "dropped" status
      // For other statuses, use updateSeasonStatus
      if (args.status === "dropped") {
        await ctx.db.patch(args.listItemId, {
          status: args.status,
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

    const overallStatus = deriveOverallTVStatus(
      media.seasonData || [],
      newProgress,
      listItem.status ?? "to_watch"
    );

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

// ---------------------------------------------------------------------------
// Movie watch dates
// ---------------------------------------------------------------------------

export const addMovieWatchDate = mutation({
  args: {
    listItemId: v.id("listItems"),
    watchedOn: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "movie") {
      throw new Error("This function is only for movies");
    }

    const dates = [...(listItem.movieWatchDates ?? []), args.watchedOn].sort(
      (a, b) => a - b
    );

    await ctx.db.patch(args.listItemId, {
      movieWatchDates: dates,
      status: "watched",
      lastWatchedAt: Math.max(...dates),
    });

    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

export const removeMovieWatchDate = mutation({
  args: {
    listItemId: v.id("listItems"),
    dateIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) {
      throw new Error("Not authorized to update this item");
    }

    const dates = [...(listItem.movieWatchDates ?? [])];
    if (args.dateIndex < 0 || args.dateIndex >= dates.length) {
      throw new Error("Invalid date index");
    }
    dates.splice(args.dateIndex, 1);

    const updates: Record<string, unknown> = {
      movieWatchDates: dates.length > 0 ? dates : undefined,
      lastWatchedAt: dates.length > 0 ? Math.max(...dates) : undefined,
    };
    if (dates.length === 0) {
      updates.status = "to_watch";
    }

    await ctx.db.patch(args.listItemId, updates);
    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// Season spans (TV rewatches)
// ---------------------------------------------------------------------------

export const addSeasonSpan = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    validateSeasonNumber(args.seasonNumber);

    const progress = [...(listItem.seasonProgress ?? [])];
    const idx = progress.findIndex((p) => p.seasonNumber === args.seasonNumber);

    const newSpan = { startedAt: args.startedAt ?? Date.now(), finishedAt: undefined };

    if (idx >= 0) {
      const existing = progress[idx];
      const spans = [...(existing.spans ?? []), newSpan];
      progress[idx] = { ...existing, spans, status: "watching" };
    } else {
      progress.push({
        seasonNumber: args.seasonNumber,
        status: "watching",
        spans: [newSpan],
      });
    }

    const overallStatus = deriveOverallTVStatus(
      media.seasonData || [],
      progress,
      listItem.status ?? "to_watch"
    );

    await ctx.db.patch(args.listItemId, {
      seasonProgress: progress,
      status: overallStatus,
    });
    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

export const updateSeasonSpan = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    spanIndex: v.number(),
    startedAt: v.optional(v.union(v.number(), v.null())),
    finishedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    validateSeasonNumber(args.seasonNumber);

    const progress = [...(listItem.seasonProgress ?? [])];
    const seasonIdx = progress.findIndex(
      (p) => p.seasonNumber === args.seasonNumber
    );
    if (seasonIdx < 0) throw new Error("Season not found in progress");

    const season = { ...progress[seasonIdx] };
    const spans = [...(season.spans ?? [])];
    if (args.spanIndex < 0 || args.spanIndex >= spans.length) {
      throw new Error("Invalid span index");
    }

    const span = { ...spans[args.spanIndex] };
    if (args.startedAt !== undefined) {
      span.startedAt = args.startedAt === null ? undefined : args.startedAt;
    }
    if (args.finishedAt !== undefined) {
      span.finishedAt = args.finishedAt === null ? undefined : args.finishedAt;
    }
    spans[args.spanIndex] = span;
    season.spans = spans;

    const derived = deriveSeasonStatusFromProgress(season);
    if (season.status !== "dropped") {
      season.status = derived;
    }
    progress[seasonIdx] = season;

    const overallStatus = deriveOverallTVStatus(
      media.seasonData || [],
      progress,
      listItem.status ?? "to_watch"
    );

    const lastWatched = computeLastWatchedTV(progress);

    await ctx.db.patch(args.listItemId, {
      seasonProgress: progress,
      status: overallStatus,
      lastWatchedAt: lastWatched,
    });
    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

export const removeSeasonSpan = mutation({
  args: {
    listItemId: v.id("listItems"),
    seasonNumber: v.number(),
    spanIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const listItem = await ctx.db.get(args.listItemId);
    if (!listItem) throw new Error("List item not found");

    const list = await ctx.db.get(listItem.listId);
    if (!list) throw new Error("List not found");
    if (!canEdit(getUserRole(list, clerkId))) {
      throw new Error("Not authorized to update this item");
    }

    const media = await ctx.db.get(listItem.mediaId);
    if (!media || media.type !== "tv") {
      throw new Error("This function is only for TV shows");
    }

    validateSeasonNumber(args.seasonNumber);

    const progress = [...(listItem.seasonProgress ?? [])];
    const seasonIdx = progress.findIndex(
      (p) => p.seasonNumber === args.seasonNumber
    );
    if (seasonIdx < 0) throw new Error("Season not found in progress");

    const season = { ...progress[seasonIdx] };
    const spans = [...(season.spans ?? [])];
    if (args.spanIndex < 0 || args.spanIndex >= spans.length) {
      throw new Error("Invalid span index");
    }
    spans.splice(args.spanIndex, 1);
    season.spans = spans.length > 0 ? spans : undefined;

    const derived = deriveSeasonStatusFromProgress(season);
    if (season.status !== "dropped") {
      season.status = derived;
    }
    progress[seasonIdx] = season;

    const overallStatus = deriveOverallTVStatus(
      media.seasonData || [],
      progress,
      listItem.status ?? "to_watch"
    );

    const lastWatched = computeLastWatchedTV(progress);

    await ctx.db.patch(args.listItemId, {
      seasonProgress: progress,
      status: overallStatus,
      lastWatchedAt: lastWatched,
    });
    await ctx.db.patch(listItem.listId, { updatedAt: Date.now() });
  },
});

function computeLastWatchedTV(
  progress: SeasonProgressEntry[]
): number | undefined {
  let latest: number | undefined;
  for (const season of progress) {
    for (const span of season.spans ?? []) {
      const d = span.finishedAt ?? span.startedAt;
      if (d != null && (latest == null || d > latest)) latest = d;
    }
    const legacyD = season.finishedAt ?? season.startedAt;
    if (legacyD != null && (latest == null || legacyD > latest)) latest = legacyD;
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Backfill: migrate legacy single dates → new arrays/spans
// ---------------------------------------------------------------------------

export const backfillWatchHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allItems = await ctx.db.query("listItems").collect();
    let migrated = 0;

    for (const item of allItems) {
      const media = await ctx.db.get(item.mediaId);
      if (!media) continue;

      const updates: Record<string, unknown> = {};

      if (media.type === "movie") {
        if (!item.movieWatchDates && item.finishedAt) {
          updates.movieWatchDates = [item.finishedAt];
          updates.lastWatchedAt = item.finishedAt;
        }
      } else {
        const progress = item.seasonProgress ?? [];
        let changed = false;
        const newProgress = progress.map((sp) => {
          if (!sp.spans && (sp.startedAt || sp.finishedAt)) {
            changed = true;
            return {
              ...sp,
              spans: [{ startedAt: sp.startedAt, finishedAt: sp.finishedAt }],
            };
          }
          return sp;
        });
        if (changed) {
          updates.seasonProgress = newProgress;
          updates.lastWatchedAt = computeLastWatchedTV(newProgress);
        }
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(item._id, updates);
        migrated++;
      }
    }
    return { migrated, total: allItems.length };
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
          movieWatchDates: item.movieWatchDates,
          lastWatchedAt: item.lastWatchedAt,
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
