import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Performance testing utility for database queries
 * This helps verify that our indexes are working correctly
 * 
 * NOTE: These tests don't require authentication so they can be run
 * from the Convex Dashboard for testing purposes.
 */

// Test query performance for getMyLists
export const testGetMyListsPerformance = query({
  args: {},
  handler: async (ctx) => {
    // Get first user for testing (or use authenticated user if available)
    const identity = await ctx.auth.getUserIdentity();
    let clerkId: string;

    if (identity) {
      clerkId = identity.subject;
    } else {
      // No auth - use first user in database for testing
      const firstUser = await ctx.db.query("users").first();
      if (!firstUser) {
        return {
          error: "No users in database. Create a user first to test performance.",
        };
      }
      clerkId = firstUser.clerkId;
    }

    const startTime = Date.now();

    // Query using index (optimized)
    const ownedLists = await ctx.db
      .query("lists")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", clerkId))
      .collect();

    const indexQueryTime = Date.now() - startTime;

    // For comparison: full table scan (old method)
    const scanStartTime = Date.now();
    const allLists = await ctx.db.query("lists").collect();
    const userLists = allLists.filter(
      (list) => list.ownerId === clerkId || list.members.some((m) => m.clerkId === clerkId)
    );
    const scanQueryTime = Date.now() - scanStartTime;

    return {
      testUser: clerkId,
      indexedQuery: {
        time: indexQueryTime,
        resultCount: ownedLists.length,
      },
      fullScanQuery: {
        time: scanQueryTime,
        resultCount: userLists.length,
      },
      totalListsInDb: allLists.length,
      speedup: `${(scanQueryTime / Math.max(indexQueryTime, 1)).toFixed(1)}x`,
      improvement: `${Math.round((1 - indexQueryTime / Math.max(scanQueryTime, 1)) * 100)}% faster`,
    };
  },
});

// Test query performance for finding lists containing a media item
export const testFindListsByMediaPerformance = query({
  args: {
    mediaId: v.id("media"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // Query using index (optimized)
    const listItems = await ctx.db
      .query("listItems")
      .withIndex("by_media_id", (q) => q.eq("mediaId", args.mediaId))
      .collect();

    const indexQueryTime = Date.now() - startTime;

    // For comparison: full table scan (old method)
    const scanStartTime = Date.now();
    const allListItems = await ctx.db.query("listItems").collect();
    const matchingItems = allListItems.filter((item) => item.mediaId === args.mediaId);
    const scanQueryTime = Date.now() - scanStartTime;

    return {
      mediaId: args.mediaId,
      indexedQuery: {
        time: indexQueryTime,
        resultCount: listItems.length,
      },
      fullScanQuery: {
        time: scanQueryTime,
        resultCount: matchingItems.length,
      },
      totalListItemsInDb: allListItems.length,
      speedup: `${(scanQueryTime / Math.max(indexQueryTime, 1)).toFixed(1)}x`,
      improvement: `${Math.round((1 - indexQueryTime / Math.max(scanQueryTime, 1)) * 100)}% faster`,
    };
  },
});

// Get all lists that contain a specific media item (uses new index)
export const getListsContainingMedia = query({
  args: {
    mediaId: v.id("media"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Use the new by_media_id index for efficient lookup
    const listItems = await ctx.db
      .query("listItems")
      .withIndex("by_media_id", (q) => q.eq("mediaId", args.mediaId))
      .collect();

    // Get unique list IDs
    const listIds = [...new Set(listItems.map((item) => item.listId))];

    // Fetch list details
    const lists = await Promise.all(
      listIds.map(async (listId) => {
        const list = await ctx.db.get(listId);
        return list;
      })
    );

    // Filter out null values (in case list was deleted)
    return lists.filter((list) => list !== null);
  },
});
