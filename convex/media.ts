import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const REFRESH_COOLDOWN_MS = 60_000;

type MediaType = "movie" | "tv";

function getUserRole(
  list: {
    ownerId: string;
    members: Array<{ clerkId: string; role: "admin" | "viewer" }>;
  },
  clerkId: string
): "creator" | "admin" | "viewer" | null {
  if (list.ownerId === clerkId) return "creator";
  const member = list.members.find((m) => m.clerkId === clerkId);
  return member ? member.role : null;
}

function canViewList(role: "creator" | "admin" | "viewer" | null): boolean {
  return role !== null;
}

function extractMediaFields(args: {
  type: MediaType;
  tmdbData: any;
  watchProviders?: any;
}) {
  const { type, tmdbData } = args;

  let seasonData = undefined;
  let totalSeasons = undefined;
  let totalEpisodes = undefined;

  if (type === "tv" && tmdbData.seasons) {
    const actualSeasons = tmdbData.seasons.filter(
      (season: any) => season.season_number > 0
    );

    totalSeasons = tmdbData.number_of_seasons ?? actualSeasons.length;
    totalEpisodes = actualSeasons.reduce(
      (sum: number, season: any) => sum + (season.episode_count || 0),
      0
    );

    seasonData = actualSeasons.map((season: any) => ({
      seasonNumber: season.season_number,
      episodeCount: season.episode_count,
      airDate: season.air_date || undefined,
    }));
  }

  const genres =
    tmdbData.genres?.map((g: any) => ({
      id: g.id,
      name: g.name,
    })) || [];

  const overview =
    tmdbData.overview && tmdbData.overview.trim()
      ? tmdbData.overview
      : undefined;

  const tagline =
    tmdbData.tagline && tmdbData.tagline.trim()
      ? tmdbData.tagline
      : undefined;

  const voteAverage =
    tmdbData.vote_average !== undefined && tmdbData.vote_average !== null
      ? tmdbData.vote_average
      : undefined;

  const lastAirDate =
    type === "tv" && tmdbData.last_air_date
      ? tmdbData.last_air_date
      : undefined;

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

  return {
    title: tmdbData.title || tmdbData.name,
    posterUrl: tmdbData.poster_path
      ? `https://image.tmdb.org/t/p/w342${tmdbData.poster_path}`
      : undefined,
    backdropUrl: tmdbData.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${tmdbData.backdrop_path}`
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
  };
}

async function fetchTmdbMedia(type: MediaType, tmdbId: number, apiKey: string) {
  const endpoint = type === "movie" ? "movie" : "tv";
  const url = `${TMDB_API_BASE}/${endpoint}/${tmdbId}?api_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }

  const tmdbData = await response.json();

  let watchProvidersData = undefined;
  try {
    const watchProvidersUrl = `${TMDB_API_BASE}/${endpoint}/${tmdbId}/watch/providers?api_key=${apiKey}`;
    const watchProvidersResponse = await fetch(watchProvidersUrl);
    if (watchProvidersResponse.ok) {
      watchProvidersData = await watchProvidersResponse.json();
    }
  } catch {
    // Non-critical
  }

  return { tmdbData, watchProvidersData };
}

function mergeSeasonData(
  incoming:
    | Array<{
        seasonNumber: number;
        episodeCount: number;
        airDate?: string;
        episodes?: Array<{
          episodeNumber: number;
          name: string;
          airDate?: string;
          overview?: string;
        }>;
      }>
    | undefined,
  existing:
    | Array<{
        seasonNumber: number;
        episodeCount: number;
        airDate?: string;
        episodes?: Array<{
          episodeNumber: number;
          name: string;
          airDate?: string;
          overview?: string;
        }>;
      }>
    | undefined
) {
  if (!incoming) return incoming;
  if (!existing) return incoming;

  return incoming.map((season) => {
    const previous = existing.find((s) => s.seasonNumber === season.seasonNumber);
    if (previous?.episodes) {
      return { ...season, episodes: previous.episodes };
    }
    return season;
  });
}

// Internal mutation to create media record (called from action)
export const createMedia = internalMutation({
  args: {
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
    tmdbData: v.any(),
    watchProviders: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const fields = extractMediaFields({
      type: args.type,
      tmdbData: args.tmdbData,
      watchProviders: args.watchProviders,
    });

    const mediaId = await ctx.db.insert("media", {
      tmdbId: args.tmdbId,
      type: args.type,
      ...fields,
    });

    return mediaId;
  },
});

export const updateMediaFromTmdb = internalMutation({
  args: {
    mediaId: v.id("media"),
    type: v.union(v.literal("movie"), v.literal("tv")),
    tmdbData: v.any(),
    watchProviders: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.mediaId);
    if (!existing) return;

    const fields = extractMediaFields({
      type: args.type,
      tmdbData: args.tmdbData,
      watchProviders: args.watchProviders,
    });

    await ctx.db.patch(args.mediaId, {
      ...fields,
      seasonData: mergeSeasonData(fields.seasonData, existing.seasonData),
    });
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

export const getMediaById = internalQuery({
  args: {
    mediaId: v.id("media"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mediaId);
  },
});

export const getListMediaForRefresh = internalQuery({
  args: {
    listId: v.id("lists"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, args.clerkId);
    if (!canViewList(role)) {
      throw new Error("Not authorized to access this list");
    }

    const items = await ctx.db
      .query("listItems")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    const mediaIds = [...new Set(items.map((item) => item.mediaId))];
    const mediaRecords = (
      await Promise.all(mediaIds.map((mediaId) => ctx.db.get(mediaId)))
    ).filter((media): media is NonNullable<typeof media> => media !== null);

    return mediaRecords.map((media) => ({
      _id: media._id,
      tmdbId: media.tmdbId,
      type: media.type,
    }));
  },
});

export const assertRefreshAllowed = internalMutation({
  args: {
    userId: v.string(),
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tmdbRefreshCooldowns")
      .withIndex("by_user_and_list", (q) =>
        q.eq("userId", args.userId).eq("listId", args.listId)
      )
      .first();

    const now = Date.now();
    if (existing && now - existing.lastRefreshAt < REFRESH_COOLDOWN_MS) {
      const retryAfterMs = REFRESH_COOLDOWN_MS - (now - existing.lastRefreshAt);
      throw new Error(
        `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before refreshing again`
      );
    }

    if (existing) {
      await ctx.db.patch(existing._id, { lastRefreshAt: now });
    } else {
      await ctx.db.insert("tmdbRefreshCooldowns", {
        userId: args.userId,
        listId: args.listId,
        lastRefreshAt: now,
      });
    }
  },
});

export const getRefreshCooldown = query({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { lastRefreshAt: null, cooldownMs: REFRESH_COOLDOWN_MS };
    }

    const list = await ctx.db.get(args.listId);
    if (!list) {
      return { lastRefreshAt: null, cooldownMs: REFRESH_COOLDOWN_MS };
    }

    const role = getUserRole(list, identity.subject);
    if (!canViewList(role)) {
      return { lastRefreshAt: null, cooldownMs: REFRESH_COOLDOWN_MS };
    }

    const existing = await ctx.db
      .query("tmdbRefreshCooldowns")
      .withIndex("by_user_and_list", (q) =>
        q.eq("userId", identity.subject).eq("listId", args.listId)
      )
      .first();

    return {
      lastRefreshAt: existing?.lastRefreshAt ?? null,
      cooldownMs: REFRESH_COOLDOWN_MS,
    };
  },
});

// Action to get or create media (can use fetch)
export const getOrCreateMedia = action({
  args: {
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
  },
  handler: async (ctx, args): Promise<Id<"media">> => {
    const existing: { _id: Id<"media"> } | null = await ctx.runQuery(
      internal.media.checkMediaExists,
      {
        tmdbId: args.tmdbId,
      }
    );

    if (existing) {
      return existing._id;
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const { tmdbData, watchProvidersData } = await fetchTmdbMedia(
      args.type,
      args.tmdbId,
      apiKey
    );

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

export const refreshListMedia = action({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args): Promise<{ scheduled: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.runMutation(internal.media.assertRefreshAllowed, {
      userId: identity.subject,
      listId: args.listId,
    });

    const mediaRecords: Array<{
      _id: Id<"media">;
      tmdbId: number;
      type: MediaType;
    }> = await ctx.runQuery(internal.media.getListMediaForRefresh, {
      listId: args.listId,
      clerkId: identity.subject,
    });

    for (let i = 0; i < mediaRecords.length; i++) {
      const media = mediaRecords[i];
      await ctx.scheduler.runAfter(
        i * 200,
        internal.media.refreshSingleMediaFromTmdb,
        {
          mediaId: media._id,
          tmdbId: media.tmdbId,
          type: media.type,
        }
      );
    }

    return { scheduled: mediaRecords.length };
  },
});

export const refreshSingleMediaFromTmdb = internalAction({
  args: {
    mediaId: v.id("media"),
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return;

    try {
      const { tmdbData, watchProvidersData } = await fetchTmdbMedia(
        args.type,
        args.tmdbId,
        apiKey
      );

      await ctx.runMutation(internal.media.updateMediaFromTmdb, {
        mediaId: args.mediaId,
        type: args.type,
        tmdbData,
        watchProviders: watchProvidersData,
      });

      if (args.type === "tv") {
        await ctx.scheduler.runAfter(0, internal.media.fetchAndStoreEpisodes, {
          mediaId: args.mediaId,
          tmdbId: args.tmdbId,
          force: true,
        });
      }
    } catch {
      // Skip individual failures — other titles still refresh
    }
  },
});

// Internal mutation to patch a media record with per-episode data for all seasons
export const updateSeasonEpisodes = internalMutation({
  args: {
    mediaId: v.id("media"),
    seasonEpisodes: v.array(
      v.object({
        seasonNumber: v.number(),
        episodes: v.array(
          v.object({
            episodeNumber: v.number(),
            name: v.string(),
            airDate: v.optional(v.string()),
            overview: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media || !media.seasonData) return;

    const updatedSeasonData = media.seasonData.map((season) => {
      const fetched = args.seasonEpisodes.find(
        (s) => s.seasonNumber === season.seasonNumber
      );
      if (!fetched) return season;
      return { ...season, episodes: fetched.episodes };
    });

    // Include episode data for any new seasons added during metadata refresh
    for (const fetched of args.seasonEpisodes) {
      if (
        !updatedSeasonData.some((season) => season.seasonNumber === fetched.seasonNumber)
      ) {
        updatedSeasonData.push({
          seasonNumber: fetched.seasonNumber,
          episodeCount: fetched.episodes.length,
          episodes: fetched.episodes,
        });
      }
    }

    updatedSeasonData.sort((a, b) => a.seasonNumber - b.seasonNumber);

    await ctx.db.patch(args.mediaId, {
      seasonData: updatedSeasonData,
      episodesPopulated: true,
    });
  },
});

// Internal action to fetch per-episode air dates from TMDB for all seasons of a TV show
export const fetchAndStoreEpisodes = internalAction({
  args: {
    mediaId: v.id("media"),
    tmdbId: v.number(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const media = await ctx.runQuery(internal.media.getMediaById, {
      mediaId: args.mediaId,
    });
    if (!media || !media.seasonData) return;
    if (media.episodesPopulated && !args.force) return;

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return;

    const seasons = media.seasonData ?? [];
    const seasonEpisodes: Array<{
      seasonNumber: number;
      episodes: Array<{
        episodeNumber: number;
        name: string;
        airDate?: string;
        overview?: string;
      }>;
    }> = [];

    for (const season of seasons) {
      try {
        const url = `${TMDB_API_BASE}/tv/${args.tmdbId}/season/${season.seasonNumber}?api_key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();
        const episodes = (
          (data.episodes as Array<{
            episode_number: number;
            name?: string;
            air_date?: string;
            overview?: string;
          }>) ?? []
        ).map((ep) => ({
          episodeNumber: ep.episode_number,
          name: ep.name ?? "",
          airDate: ep.air_date ?? undefined,
          overview: ep.overview?.trim() ? ep.overview.slice(0, 500) : undefined,
        }));

        seasonEpisodes.push({ seasonNumber: season.seasonNumber, episodes });
      } catch {
        // Skip this season on error — partial data is fine
      }
    }

    if (seasonEpisodes.length > 0) {
      await ctx.runMutation(internal.media.updateSeasonEpisodes, {
        mediaId: args.mediaId,
        seasonEpisodes,
      });
    }
  },
});

// Clear all test data (keeps users table untouched)
// Run this to delete all records from media, lists, and listItems tables
export const clearTestData = mutation({
  handler: async (ctx) => {
    const allListItems = await ctx.db.query("listItems").collect();
    for (const item of allListItems) {
      await ctx.db.delete(item._id);
    }

    const allLists = await ctx.db.query("lists").collect();
    for (const list of allLists) {
      await ctx.db.delete(list._id);
    }

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
