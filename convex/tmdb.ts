import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Internal query to check cache
export const getCachedSearch = internalQuery({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedQuery = args.query.toLowerCase().trim();

    const cached = await ctx.db
      .query("searchCache")
      .withIndex("by_query", (q) => q.eq("query", normalizedQuery))
      .first();

    // Return cached results if found and not expired
    if (cached && cached.expiresAt > now) {
      return cached.results;
    }

    return null;
  },
});

// Internal mutation to save search results to cache
export const saveSearchCache = internalMutation({
  args: {
    query: v.string(),
    results: v.any(),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.toLowerCase().trim();
    const expiresAt = Date.now() + CACHE_DURATION_MS;

    // Check if cache entry already exists
    const existing = await ctx.db
      .query("searchCache")
      .withIndex("by_query", (q) => q.eq("query", normalizedQuery))
      .first();

    if (existing) {
      // Update existing cache entry
      await ctx.db.patch(existing._id, {
        results: args.results,
        expiresAt,
      });
    } else {
      // Create new cache entry
      await ctx.db.insert("searchCache", {
        query: normalizedQuery,
        results: args.results,
        expiresAt,
      });
    }
  },
});

// Internal mutation to clean up expired cache entries
export const cleanupExpiredCache = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find all expired entries
    const expired = await ctx.db
      .query("searchCache")
      .withIndex("by_expires")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete expired entries
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }

    return { deletedCount: expired.length };
  },
});

// Main search action with caching
export const searchTMDB = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args): Promise<any[]> => {
    // Check cache first
    const cached: any[] | null = await ctx.runQuery(internal.tmdb.getCachedSearch, {
      query: args.query,
    });

    if (cached !== null) {
      // Return cached results
      return cached;
    }

    // Cache miss - fetch from TMDB API
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const url = `${TMDB_API_BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(args.query)}&include_adult=false`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];

    // Save to cache
    await ctx.runMutation(internal.tmdb.saveSearchCache, {
      query: args.query,
      results,
    });

    // Opportunistically clean up expired cache entries (non-blocking)
    // This runs in the background and doesn't affect the response
    ctx.runMutation(internal.tmdb.cleanupExpiredCache, {}).catch(() => {
      // Silently ignore cleanup errors - not critical
    });

    return results;
  },
});
