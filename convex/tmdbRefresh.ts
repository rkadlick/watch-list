/**
 * TMDB Refresh — periodic sync of TMDB data for media on active lists.
 *
 * == Design decisions (locked) ==
 *
 * - Scope: media rows referenced by at least one listItem on an "active" list.
 * - Strategy: latest-wins (no history/snapshot table in v1).
 * - Season visibility: a season UI row appears only when TMDB provides an
 *   airDate. After a refresh inserts/updates seasonData entries, newly aired
 *   seasons become visible to the UI automatically.
 * - Frequency: weekly cron (adjustable). Individual media rows are refreshed
 *   at most once per cycle.
 *
 * == Open questions (to finalize) ==
 *
 * - "Active list" definition: all lists? Recently opened? User toggle?
 *   Current stub: all lists (safe default for ≤10 users).
 *
 * - Ended-show detection: TMDB status field ("Ended" / "Canceled"), or
 *   lastAirDate > N months ago, or manual flag. Ended shows could be
 *   refreshed monthly instead of weekly, or skipped entirely.
 *   Current stub: refresh everything; add backoff later.
 *
 * - Rate limits: TMDB allows ~40 req/10s on the free tier. For small lists
 *   this is not a concern, but the action should batch or throttle if the
 *   media set grows.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

/**
 * Collect distinct media IDs that appear on any list.
 * Future: filter by "active" list criteria.
 */
export const getMediaIdsToRefresh = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allItems = await ctx.db.query("listItems").collect();
    const ids = new Set<string>();
    for (const item of allItems) {
      ids.add(item.mediaId);
    }
    return [...ids];
  },
});

/**
 * Patch a media row with fresh TMDB data. Preserves the existing _id.
 * Only updates fields that TMDB provides; does NOT touch user-facing fields
 * like listItems or seasonProgress.
 */
export const applyRefresh = internalMutation({
  args: {
    mediaId: v.id("media"),
    tmdbData: v.any(),
    watchProviders: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.mediaId);
    if (!existing) return;

    const td = args.tmdbData;

    let seasonData = existing.seasonData;
    let totalSeasons = existing.totalSeasons;
    let totalEpisodes = existing.totalEpisodes;

    if (existing.type === "tv" && td.seasons) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actual = td.seasons.filter((s: any) => s.season_number > 0);
      totalSeasons = td.number_of_seasons ?? actual.length;
      totalEpisodes = actual.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, s: any) => sum + (s.episode_count || 0),
        0
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seasonData = actual.map((s: any) => ({
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        airDate: s.air_date || undefined,
      }));
    }

    const genres =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      td.genres?.map((g: any) => ({ id: g.id, name: g.name })) || existing.genres;

    let watchProviders = existing.watchProviders;
    if (args.watchProviders?.results?.US?.flatrate) {
      watchProviders = args.watchProviders.results.US.flatrate.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => ({
          providerId: p.provider_id,
          providerName: p.provider_name,
          logoPath: p.logo_path || undefined,
          displayPriority: p.display_priority,
        })
      );
    }

    await ctx.db.patch(args.mediaId, {
      title: td.title || td.name || existing.title,
      posterUrl: td.poster_path
        ? `https://image.tmdb.org/t/p/w342${td.poster_path}`
        : existing.posterUrl,
      backdropUrl: td.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${td.backdrop_path}`
        : existing.backdropUrl,
      releaseDate:
        td.release_date || td.first_air_date || existing.releaseDate,
      genres,
      overview: td.overview?.trim() || existing.overview,
      tagline: td.tagline?.trim() || existing.tagline,
      voteAverage: td.vote_average ?? existing.voteAverage,
      lastAirDate:
        existing.type === "tv" ? td.last_air_date ?? existing.lastAirDate : undefined,
      watchProviders,
      tmdbRaw: td,
      totalSeasons,
      totalEpisodes,
      seasonData,
    });
  },
});

/**
 * Fetch fresh data from TMDB for a single media row and apply it.
 */
export const refreshSingleMedia = internalAction({
  args: {
    mediaId: v.id("media"),
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return;

    const endpoint = args.type === "movie" ? "movie" : "tv";
    const url = `${TMDB_API_BASE}/${endpoint}/${args.tmdbId}?api_key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return;
    const tmdbData = await res.json();

    let watchProvidersData: unknown = undefined;
    try {
      const wpRes = await fetch(
        `${TMDB_API_BASE}/${endpoint}/${args.tmdbId}/watch/providers?api_key=${apiKey}`
      );
      if (wpRes.ok) watchProvidersData = await wpRes.json();
    } catch {
      // Non-critical
    }

    await ctx.runMutation(internal.tmdbRefresh.applyRefresh, {
      mediaId: args.mediaId,
      tmdbData,
      watchProviders: watchProvidersData,
    });
  },
});

/**
 * Top-level weekly refresh: gather media ids, then refresh each.
 *
 * Wire this up to a Convex cron once ready:
 *   crons.weekly("refresh TMDB", { hourUTC: 6, minuteUTC: 0 }, internal.tmdbRefresh.refreshAll);
 */
export const refreshAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const mediaIds: string[] = await ctx.runQuery(
      internal.tmdbRefresh.getMediaIdsToRefresh
    );

    for (const id of mediaIds) {
      const media = await ctx.runQuery(internal.tmdbRefresh.getMediaRow, {
        mediaId: id as Id<"media">,
      });
      if (!media) continue;

      await ctx.runAction(internal.tmdbRefresh.refreshSingleMedia, {
        mediaId: media._id,
        tmdbId: media.tmdbId,
        type: media.type,
      });
    }
  },
});

export const getMediaRow = internalQuery({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mediaId);
  },
});
