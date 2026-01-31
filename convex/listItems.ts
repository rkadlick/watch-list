import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    paginationOpts: v.any(),
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

    // Get paginated items for this list (50 items per page)
    const result = await ctx.db
      .query("listItems")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .paginate(args.paginationOpts ?? { numItems: 50 });

    // Fetch media details for each item
    const itemsWithMedia = await Promise.all(
      result.page.map(async (item) => {
        const media = await ctx.db.get(item.mediaId);
        return {
          ...item,
          media,
        };
      })
    );

    return {
      ...result,
      page: itemsWithMedia,
    };
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
    const { validateSeasonNumber } = await import("./validation");
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

    // Calculate overall show status based on season statuses
    const allSeasons = media.seasonData || [];
    const seasonStatuses = allSeasons.map((season) => {
      const progress = newProgress.find(
        (p) => p.seasonNumber === season.seasonNumber
      );
      if (progress?.status === "watched") return "watched";
      if (progress?.status === "watching") return "watching";
      if (progress?.status === "dropped") return "dropped";
      return "to_watch";
    });

    let overallStatus: "to_watch" | "watching" | "watched" | "dropped";
    if (seasonStatuses.some((s) => s === "watching")) {
      overallStatus = "watching";
    } else if (seasonStatuses.every((s) => s === "watched")) {
      overallStatus = "watched";
    } else if (seasonStatuses.every((s) => s === "dropped")) {
      overallStatus = "dropped";
    } else {
      overallStatus = "to_watch";
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
    const { validateRating } = await import("./validation");
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
    const { validateString, LIMITS } = await import("./validation");
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
    const { validateTags } = await import("./validation");
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
    const { validateDates } = await import("./validation");
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
    const { validateSeasonNumber, validateRating } = await import("./validation");
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
    const { validateSeasonNumber, validateString, LIMITS } = await import("./validation");
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
    const { validateSeasonNumber, validateDates } = await import("./validation");
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
