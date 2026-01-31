import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

// Internal mutation to create media record (called from action)
export const createMedia = internalMutation({
  args: {
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
    tmdbData: v.any(),
    watchProviders: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const tmdbData = args.tmdbData;

    // Extract season data for TV shows
    let seasonData = undefined;
    let totalSeasons = undefined;
    let totalEpisodes = undefined;

    if (args.type === "tv" && tmdbData.seasons) {
      // Filter out season 0 (Specials) for actual seasons
      const actualSeasons = tmdbData.seasons.filter(
        (season: any) => season.season_number > 0
      );

      // Use number_of_seasons from API (already excludes season 0)
      // OR use filtered length as fallback
      totalSeasons = tmdbData.number_of_seasons ?? actualSeasons.length;

      // Calculate total episodes from actual seasons
      totalEpisodes = actualSeasons.reduce(
        (sum: number, season: any) => sum + (season.episode_count || 0),
        0
      );

      // Store season data (only actual seasons, not specials)
      seasonData = actualSeasons.map((season: any) => ({
        seasonNumber: season.season_number,
        episodeCount: season.episode_count,
        airDate: season.air_date || undefined,
      }));
    }

    // Extract genres with id and name
    const genres =
      tmdbData.genres?.map((g: any) => ({
        id: g.id,
        name: g.name,
      })) || [];

    // Extract overview (store undefined if empty string)
    const overview =
      tmdbData.overview && tmdbData.overview.trim()
        ? tmdbData.overview
        : undefined;

    // Extract tagline (store undefined if empty string)
    const tagline =
      tmdbData.tagline && tmdbData.tagline.trim()
        ? tmdbData.tagline
        : undefined;

    // Extract vote average
    const voteAverage =
      tmdbData.vote_average !== undefined && tmdbData.vote_average !== null
        ? tmdbData.vote_average
        : undefined;

    // Extract last air date (TV only)
    const lastAirDate =
      args.type === "tv" && tmdbData.last_air_date
        ? tmdbData.last_air_date
        : undefined;

    // Extract watch providers (US flatrate only)
    let watchProviders = undefined;
    if (args.watchProviders?.results?.US?.flatrate) {
      watchProviders = args.watchProviders.results.US.flatrate.map(
        (provider: any) => ({
          providerId: provider.provider_id,
          providerName: provider.provider_name,
          logoPath: provider.logo_path || undefined,
          displayPriority: provider.display_priority,
        })
      );
    }

    // Create media record
    const mediaId = await ctx.db.insert("media", {
      tmdbId: args.tmdbId,
      type: args.type,
      title: tmdbData.title || tmdbData.name,
      posterUrl: tmdbData.poster_path
        ? `https://image.tmdb.org/t/p/w342${tmdbData.poster_path}` // Optimized: 342px instead of 500px
        : undefined,
      backdropUrl: tmdbData.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${tmdbData.backdrop_path}` // Optimized: 780px instead of 1280px
        : undefined,
      releaseDate:
        tmdbData.release_date || tmdbData.first_air_date || undefined,
      genres,
      overview,
      tagline,
      voteAverage,
      lastAirDate,
      watchProviders,
      tmdbRaw: tmdbData,
      totalSeasons,
      totalEpisodes,
      seasonData,
    });

    return mediaId;
  },
});

// Internal query to check if media exists
export const checkMediaExists = internalQuery({
  args: {
    tmdbId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("media")
      .withIndex("by_tmdb_id", (q) => q.eq("tmdbId", args.tmdbId))
      .first();
  },
});

// Action to get or create media (can use fetch)
export const getOrCreateMedia = action({
  args: {
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
  },
  handler: async (ctx, args): Promise<Id<"media">> => {
    // Check if media already exists
    const existing: { _id: Id<"media"> } | null = await ctx.runQuery(
      internal.media.checkMediaExists,
      {
        tmdbId: args.tmdbId,
      }
    );

    if (existing) {
      return existing._id;
    }

    // Fetch from TMDB (actions can use fetch)
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const endpoint = args.type === "movie" ? "movie" : "tv";
    const url = `${TMDB_API_BASE}/${endpoint}/${args.tmdbId}?api_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    const tmdbData = await response.json();

    // Fetch watch providers (non-critical)
    const watchProvidersUrl = `${TMDB_API_BASE}/${endpoint}/${args.tmdbId}/watch/providers?api_key=${apiKey}`;
    let watchProvidersData = undefined;

    try {
      const watchProvidersResponse = await fetch(watchProvidersUrl);
      if (watchProvidersResponse.ok) {
        watchProvidersData = await watchProvidersResponse.json();
      }
      // If this fails, we intentionally continue without watch providers
    } catch {
      // Swallow error intentionally — non-critical
    }

    // Create media record using internal mutation
    const mediaId: Id<"media"> = await ctx.runMutation(
      internal.media.createMedia,
      {
        tmdbId: args.tmdbId,
        type: args.type,
        tmdbData,
        watchProviders: watchProvidersData,
      }
    );

    return mediaId;
  },
});

// Clear all test data (keeps users table untouched)
// Run this to delete all records from media, lists, and listItems tables
export const clearTestData = mutation({
  handler: async (ctx) => {
    // Delete all list items first (they reference lists and media)
    const allListItems = await ctx.db.query("listItems").collect();
    for (const item of allListItems) {
      await ctx.db.delete(item._id);
    }

    // Delete all lists
    const allLists = await ctx.db.query("lists").collect();
    for (const list of allLists) {
      await ctx.db.delete(list._id);
    }

    // Delete all media
    const allMedia = await ctx.db.query("media").collect();
    for (const media of allMedia) {
      await ctx.db.delete(media._id);
    }

    return {
      deletedListItems: allListItems.length,
      deletedLists: allLists.length,
      deletedMedia: allMedia.length,
    };
  },
});
