import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * One-time production migration for the dashboard / episode-tracking overhaul.
 *
 * Dry run (preview only):
 *   npx convex run migrations:previewMigration --prod
 *
 * Apply:
 *   npx convex run migrations:migrateAllListItems --prod
 *
 * After migration, use the dashboard Refresh button on each list to pull
 * latest TMDB season air dates (needed for Awaiting Release).
 *
 * Or refresh all media in one shot:
 *   npx convex run migrations:scheduleAllMediaRefresh --prod
 */

type SeasonProgressEntry = NonNullable<Doc<"listItems">["seasonProgress"]>[number];

type SeasonData = NonNullable<Doc<"media">["seasonData"]>[number];

type MigrationChange = {
  listItemId: Id<"listItems">;
  title: string;
  changes: string[];
};

function getVisibleSeasons(seasonData: SeasonData[] | undefined): SeasonData[] {
  return (seasonData ?? [])
    .filter((s) => s.airDate)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function getSeasonStatus(
  progress: SeasonProgressEntry[],
  seasonNumber: number
): SeasonProgressEntry["status"] {
  return progress.find((p) => p.seasonNumber === seasonNumber)?.status ?? "to_watch";
}

function backfillWatchedSeasonEpisodes(
  seasonEntry: SeasonProgressEntry,
  episodeCount: number,
  fallbackTimestamp: number
): SeasonProgressEntry {
  const watchedAt =
    seasonEntry.finishedAt ?? seasonEntry.startedAt ?? fallbackTimestamp;

  const existingDates = seasonEntry.episodeDates ?? [];
  const existingEpisodes = new Set(existingDates.map((d) => d.episodeNumber));
  const episodeDates = [...existingDates];

  for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber++) {
    if (!existingEpisodes.has(episodeNumber)) {
      episodeDates.push({ episodeNumber, watchedAt });
    }
  }

  episodeDates.sort((a, b) => a.episodeNumber - b.episodeNumber);

  return {
    ...seasonEntry,
    status: "watched",
    episodeDates,
    startedAt: seasonEntry.startedAt ?? watchedAt,
    finishedAt: seasonEntry.finishedAt ?? watchedAt,
  };
}

function deriveCurrentPosition(
  item: Doc<"listItems">,
  progress: SeasonProgressEntry[],
  visibleSeasons: SeasonData[],
  today: string
): { season: number; episode: number } {
  const watchingSeason = progress.find((p) => p.status === "watching");
  if (watchingSeason) {
    const seasonData = visibleSeasons.find(
      (s) => s.seasonNumber === watchingSeason.seasonNumber
    );
    const episodeCount = seasonData?.episodeCount ?? 1;
    const episodeDates = watchingSeason.episodeDates ?? [];

    if (episodeDates.length > 0) {
      const maxWatched = Math.max(...episodeDates.map((d) => d.episodeNumber));
      if (maxWatched >= episodeCount) {
        const nextSeason = visibleSeasons.find(
          (s) => s.seasonNumber > watchingSeason.seasonNumber
        );
        if (nextSeason) {
          return { season: nextSeason.seasonNumber, episode: 1 };
        }
        return { season: watchingSeason.seasonNumber, episode: episodeCount };
      }
      return { season: watchingSeason.seasonNumber, episode: maxWatched + 1 };
    }

    return { season: watchingSeason.seasonNumber, episode: 1 };
  }

  const releasedSeasons = visibleSeasons.filter(
    (s) => s.airDate && s.airDate <= today
  );
  const allReleasedWatched =
    releasedSeasons.length > 0 &&
    releasedSeasons.every(
      (s) => getSeasonStatus(progress, s.seasonNumber) === "watched"
    );

  if (allReleasedWatched) {
    const nextSeason = visibleSeasons.find(
      (s) => getSeasonStatus(progress, s.seasonNumber) !== "watched"
    );
    if (nextSeason) {
      return { season: nextSeason.seasonNumber, episode: 1 };
    }

    const lastReleased = releasedSeasons[releasedSeasons.length - 1];
    return {
      season: lastReleased.seasonNumber,
      episode: lastReleased.episodeCount,
    };
  }

  for (const season of visibleSeasons) {
    if (season.airDate && season.airDate > today) continue;
    const status = getSeasonStatus(progress, season.seasonNumber);
    if (status === "to_watch" || status === "watching") {
      return { season: season.seasonNumber, episode: 1 };
    }
  }

  if (item.status === "to_watch") {
    return { season: 1, episode: 1 };
  }

  if (item.droppedAtSeason && item.droppedAtEpisode) {
    return {
      season: item.droppedAtSeason,
      episode: item.droppedAtEpisode,
    };
  }

  const watchedSeasons = progress
    .filter((p) => p.status === "watched")
    .sort((a, b) => b.seasonNumber - a.seasonNumber);

  if (watchedSeasons.length > 0) {
    const lastWatched = watchedSeasons[0];
    const seasonData = visibleSeasons.find(
      (s) => s.seasonNumber === lastWatched.seasonNumber
    );
    const nextSeason = visibleSeasons.find(
      (s) => s.seasonNumber > lastWatched.seasonNumber
    );
    if (nextSeason) {
      return { season: nextSeason.seasonNumber, episode: 1 };
    }
    return {
      season: lastWatched.seasonNumber,
      episode: seasonData?.episodeCount ?? 1,
    };
  }

  return {
    season: item.currentSeasonNumber ?? 1,
    episode: item.currentEpisodeNumber ?? 1,
  };
}

function migrateShowStatus(
  item: Doc<"listItems">,
  progress: SeasonProgressEntry[],
  visibleSeasons: SeasonData[],
  today: string
): Doc<"listItems">["status"] {
  if (item.status === "dropped") return "dropped";
  if (progress.some((p) => p.status === "dropped")) return "dropped";
  if (progress.some((p) => p.status === "watching")) return "watching";

  const releasedSeasons = visibleSeasons.filter(
    (s) => s.airDate && s.airDate <= today
  );

  if (releasedSeasons.length === 0) {
    return item.status;
  }

  const releasedStatuses = releasedSeasons.map((s) =>
    getSeasonStatus(progress, s.seasonNumber)
  );

  if (releasedStatuses.every((s) => s === "watched")) {
    return "watched";
  }

  if (
    releasedStatuses.some((s) => s === "watched") &&
    releasedStatuses.some((s) => s === "to_watch")
  ) {
    return "watching";
  }

  if (releasedStatuses.every((s) => s === "to_watch")) {
    return "to_watch";
  }

  return item.status;
}

function migrateTvListItem(
  item: Doc<"listItems">,
  media: Doc<"media">,
  today: string
): {
  patch: Partial<Doc<"listItems">>;
  changes: string[];
} {
  const changes: string[] = [];
  const visibleSeasons = getVisibleSeasons(media.seasonData);
  const fallbackTimestamp = item.finishedAt ?? item.startedAt ?? item._creationTime;

  let progress = [...(item.seasonProgress ?? [])];

  for (const season of visibleSeasons) {
    const idx = progress.findIndex((p) => p.seasonNumber === season.seasonNumber);
    if (idx < 0) continue;

    const entry = progress[idx];

    if (entry.status === "watched") {
      const episodeCount = season.episodeCount;
      const hasAllEpisodes =
        (entry.episodeDates?.length ?? 0) >= episodeCount &&
        Array.from({ length: episodeCount }, (_, i) => i + 1).every((ep) =>
          entry.episodeDates?.some((d) => d.episodeNumber === ep)
        );

      if (!hasAllEpisodes) {
        progress[idx] = backfillWatchedSeasonEpisodes(
          entry,
          episodeCount,
          fallbackTimestamp
        );
        changes.push(
          `S${season.seasonNumber}: backfilled ${episodeCount} episode watch dates`
        );
      }
    }
  }

  const position = deriveCurrentPosition(item, progress, visibleSeasons, today);
  const newStatus = migrateShowStatus(item, progress, visibleSeasons, today);

  const patch: Partial<Doc<"listItems">> = {};

  if (JSON.stringify(progress) !== JSON.stringify(item.seasonProgress ?? [])) {
    patch.seasonProgress = progress.length > 0 ? progress : undefined;
  }

  if (
    item.currentSeasonNumber !== position.season ||
    item.currentEpisodeNumber !== position.episode
  ) {
    patch.currentSeasonNumber = position.season;
    patch.currentEpisodeNumber = position.episode;
    changes.push(
      `cursor S${item.currentSeasonNumber ?? "?"}E${item.currentEpisodeNumber ?? "?"} → S${position.season}E${position.episode}`
    );
  } else if (
    item.currentSeasonNumber === undefined ||
    item.currentEpisodeNumber === undefined
  ) {
    patch.currentSeasonNumber = position.season;
    patch.currentEpisodeNumber = position.episode;
    changes.push(`set cursor to S${position.season}E${position.episode}`);
  }

  if (item.status !== newStatus) {
    patch.status = newStatus;
    changes.push(`status ${item.status} → ${newStatus}`);
  }

  return { patch, changes };
}

function migrateMovieListItem(item: Doc<"listItems">): {
  patch: Partial<Doc<"listItems">>;
  changes: string[];
} {
  const changes: string[] = [];
  const patch: Partial<Doc<"listItems">> = {};

  if (item.status === "watched" && !item.finishedAt) {
    patch.finishedAt = item.startedAt ?? item._creationTime;
    changes.push("set movie finishedAt from existing timestamps");
  }

  return { patch, changes };
}

function migrateListItem(
  item: Doc<"listItems">,
  media: Doc<"media"> | null,
  today: string
): {
  patch: Partial<Doc<"listItems">>;
  changes: string[];
} {
  if (!media) {
    return { patch: {}, changes: [] };
  }

  if (media.type === "movie") {
    return migrateMovieListItem(item);
  }

  return migrateTvListItem(item, media, today);
}

export const previewMigration = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);
    const items = await ctx.db.query("listItems").collect();
    const limit = args.limit ?? items.length;

    const previews: MigrationChange[] = [];
    let wouldUpdate = 0;

    for (const item of items.slice(0, limit)) {
      const media = await ctx.db.get(item.mediaId);
      const { patch, changes } = migrateListItem(item, media, today);

      if (changes.length > 0) {
        wouldUpdate++;
        previews.push({
          listItemId: item._id,
          title: media?.title ?? "Unknown",
          changes,
        });
      }

      void patch;
    }

    return {
      totalItems: items.length,
      previewed: Math.min(limit, items.length),
      wouldUpdate,
      previews,
    };
  },
});

export const migrateAllListItems = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);
    const items = await ctx.db.query("listItems").collect();
    const dryRun = args.dryRun ?? false;
    const limit = args.limit ?? items.length;

    let updated = 0;
    let skipped = 0;
    const samples: MigrationChange[] = [];

    for (const item of items.slice(0, limit)) {
      const media = await ctx.db.get(item.mediaId);
      const { patch, changes } = migrateListItem(item, media, today);

      if (changes.length === 0) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        await ctx.db.patch(item._id, patch);
      }

      updated++;
      if (samples.length < 25) {
        samples.push({
          listItemId: item._id,
          title: media?.title ?? "Unknown",
          changes,
        });
      }
    }

    return {
      dryRun,
      totalItems: items.length,
      processed: Math.min(limit, items.length),
      updated,
      skipped,
      samples,
    };
  },
});

export const scheduleAllMediaRefresh = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allMedia = await ctx.db.query("media").collect();

    for (let i = 0; i < allMedia.length; i++) {
      const media = allMedia[i];
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

    return { scheduled: allMedia.length };
  },
});
