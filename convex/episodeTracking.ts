import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  EPISODE_TRACKING_VERSION,
  buildWatchedMap,
  deriveTvState,
  getTrackedSeasons,
  isEpisodeWatched,
  legacyEpisodeWatches,
  pruneSeasonProgress,
  seasonPass,
  selectCurrentWatches,
  type EpisodeMark,
  type EpisodeRef,
  type EpisodeWatchRow,
  type SeasonProgressLike,
  type TvDerivation,
} from "../lib/episode-tracking";

type ListItem = Doc<"listItems">;
type Media = Doc<"media">;

export function isMigratedToEpisodeWatches(item: ListItem): boolean {
  return item.trackingVersion === EPISODE_TRACKING_VERSION;
}

export async function loadPassWatches(
  ctx: QueryCtx,
  listItemId: Id<"listItems">,
  pass: number
): Promise<Doc<"episodeWatches">[]> {
  return ctx.db
    .query("episodeWatches")
    .withIndex("by_list_item", (q) => q.eq("listItemId", listItemId).eq("pass", pass))
    .collect();
}

export async function loadAllWatches(
  ctx: QueryCtx,
  listItemId: Id<"listItems">
): Promise<Doc<"episodeWatches">[]> {
  return ctx.db
    .query("episodeWatches")
    .withIndex("by_list_item", (q) => q.eq("listItemId", listItemId))
    .collect();
}

export async function deleteEpisodeWatches(
  ctx: MutationCtx,
  listItemId: Id<"listItems">
): Promise<void> {
  for (const row of await loadAllWatches(ctx, listItemId)) {
    await ctx.db.delete(row._id);
  }
}

/**
 * Every watch row for a list item, converting legacy (episodeDates/pointer)
 * data on the fly for items the migration hasn't reached yet.
 */
export async function readEpisodeWatches(
  ctx: QueryCtx,
  item: ListItem,
  media: Media
): Promise<{
  pass: number;
  /** Seasons on their own rewatch pass; every other season uses `pass` */
  seasonPasses: Array<{ seasonNumber: number; pass: number }>;
  watches: Array<EpisodeWatchRow & { _id?: Id<"episodeWatches"> }>;
}> {
  if (isMigratedToEpisodeWatches(item)) {
    const rows = await loadAllWatches(ctx, item._id);
    return {
      pass: item.watchPass ?? 1,
      seasonPasses: (item.seasonProgress ?? []).flatMap((p) =>
        p.pass === undefined ? [] : [{ seasonNumber: p.seasonNumber, pass: p.pass }]
      ),
      watches: rows.map(({ _id, pass, seasonNumber, episodeNumber, watchedAt }) => ({
        _id,
        pass,
        seasonNumber,
        episodeNumber,
        watchedAt,
      })),
    };
  }
  const legacy = legacyEpisodeWatches(item, media.seasonData);
  return { pass: legacy.pass, seasonPasses: [], watches: legacy.rows };
}

/** Give legacy history entries the pass number they were converted under. */
export function stampHistoryPasses<T extends { pass?: number }>(
  history: T[]
): Array<T & { pass: number }> {
  return history.map((entry, i) => ({ ...entry, pass: entry.pass ?? i + 1 }));
}

/**
 * Current rows for a list item (each season's current pass) plus every row,
 * writing legacy data into episodeWatches first if the item hasn't been
 * migrated. The caller's patch must then stamp trackingVersion —
 * applyEpisodeChanges does.
 */
export async function ensureEpisodeWatches(
  ctx: MutationCtx,
  item: ListItem,
  media: Media
): Promise<{ pass: number; rows: Doc<"episodeWatches">[]; all: Doc<"episodeWatches">[] }> {
  if (isMigratedToEpisodeWatches(item)) {
    const pass = item.watchPass ?? 1;
    const all = await loadAllWatches(ctx, item._id);
    return { pass, rows: selectCurrentWatches(all, item.seasonProgress, pass), all };
  }

  const legacy = legacyEpisodeWatches(item, media.seasonData);
  const alreadyWritten = await ctx.db
    .query("episodeWatches")
    .withIndex("by_list_item", (q) => q.eq("listItemId", item._id))
    .first();

  if (!alreadyWritten) {
    for (const row of legacy.rows) {
      await ctx.db.insert("episodeWatches", { listItemId: item._id, ...row });
    }
  }
  const all = await loadAllWatches(ctx, item._id);
  return { pass: legacy.pass, rows: all.filter((r) => r.pass === legacy.pass), all };
}

/**
 * The single write path for TV progress: mark/unmark episodes in each
 * season's current pass, then recompute and cache season statuses, show
 * status, position and auto-tracked dates on the list item.
 */
export async function applyEpisodeChanges(
  ctx: MutationCtx,
  item: ListItem,
  media: Media,
  {
    mark = [],
    unmark = [],
    seasonProgress = item.seasonProgress,
    inProgress = false,
    pass: passOverride,
    preserveDropped = false,
    touchList = true,
    keepShowDates = false,
  }: {
    mark?: EpisodeMark[];
    unmark?: EpisodeRef[];
    /** Season entries to derive from, when the caller changed them (e.g. dropped flags) */
    seasonProgress?: SeasonProgressLike[];
    inProgress?: boolean;
    /** Switch to a new pass (startRewatch) */
    pass?: number;
    /** Keep a show-level "dropped" status (recomputes that aren't user progress) */
    preserveDropped?: boolean;
    /** Bump the list's updatedAt (off for background migrations) */
    touchList?: boolean;
    /** Leave existing show-level dates alone (starting/stopping season rewatches) */
    keepShowDates?: boolean;
  } = {}
): Promise<TvDerivation> {
  const now = Date.now();
  const seasons = getTrackedSeasons(media.seasonData);
  const current = await ensureEpisodeWatches(ctx, item, media);
  const pass = passOverride ?? current.pass;
  // A new pass or season passes change which rows count as current
  const rows = selectCurrentWatches(current.all, seasonProgress, pass);

  const before = deriveTvState({
    seasons,
    seasonProgress,
    watched: buildWatchedMap(current.rows),
    fallbackStatus: item.status,
  });

  const watched = buildWatchedMap(rows);
  for (const ref of mark) {
    if (isEpisodeWatched(watched, ref)) continue;
    await ctx.db.insert("episodeWatches", {
      listItemId: item._id,
      pass: seasonPass(seasonProgress, pass, ref.seasonNumber),
      seasonNumber: ref.seasonNumber,
      episodeNumber: ref.episodeNumber,
      watchedAt: ref.watchedAt === null ? undefined : ref.watchedAt ?? now,
    });
    let set = watched.get(ref.seasonNumber);
    if (!set) watched.set(ref.seasonNumber, (set = new Set()));
    set.add(ref.episodeNumber);
  }
  for (const ref of unmark) {
    for (const row of rows) {
      if (row.seasonNumber === ref.seasonNumber && row.episodeNumber === ref.episodeNumber) {
        await ctx.db.delete(row._id);
      }
    }
    watched.get(ref.seasonNumber)?.delete(ref.episodeNumber);
  }

  // Watching an episode un-drops its season
  const markedSeasons = new Set(mark.map((r) => r.seasonNumber));
  const progressInput = (seasonProgress ?? []).map((p) =>
    p.status === "dropped" && markedSeasons.has(p.seasonNumber) ? { ...p, status: "to_watch" as const } : p
  );

  const after = deriveTvState({
    seasons,
    seasonProgress: progressInput,
    watched,
    fallbackStatus: item.status,
    inProgress,
  });

  // Auto-tracked season dates follow the transitions this change caused
  const progress = after.seasonProgress.map((entry) => {
    const prev = before.seasonProgress.find((p) => p.seasonNumber === entry.seasonNumber);
    const prevCount = prev?.watchedCount ?? 0;
    const count = entry.watchedCount ?? 0;
    const next = { ...entry };

    if (count > 0 && prevCount === 0 && next.startedAt === undefined) next.startedAt = now;
    if (count === 0 && prevCount > 0) next.startedAt = undefined;
    if (entry.status === "watched" && prev?.status !== "watched" && next.finishedAt === undefined) {
      next.finishedAt = now;
    }
    if (entry.status !== "watched" && prev?.status === "watched") next.finishedAt = undefined;

    return next;
  });

  const patch: Partial<ListItem> = {
    trackingVersion: EPISODE_TRACKING_VERSION,
    watchPass: pass,
    status: preserveDropped && item.status === "dropped" ? "dropped" : after.status,
    seasonProgress: pruneSeasonProgress(progress),
  };
  if (!isMigratedToEpisodeWatches(item) && item.watchHistory) {
    patch.watchHistory = stampHistoryPasses(item.watchHistory);
  }
  if (patch.seasonProgress!.length === 0) patch.seasonProgress = undefined;

  if (after.position) {
    patch.currentSeasonNumber = after.position.seasonNumber;
    patch.currentEpisodeNumber = after.position.episodeNumber;
  }

  if (after.totalWatched > 0 && before.totalWatched === 0 && item.startedAt === undefined) {
    patch.startedAt = now;
  }
  if (after.totalWatched === 0 && before.totalWatched > 0 && !keepShowDates) {
    patch.startedAt = undefined;
  }
  if (after.complete && !before.complete) {
    // Finishing a season rewatch doesn't move the show's finish date
    const newlyFinished = after.seasonProgress.filter(
      (p) =>
        p.status === "watched" &&
        before.seasonProgress.find((b) => b.seasonNumber === p.seasonNumber)?.status !== "watched"
    );
    const onlyRewatches = newlyFinished.every((p) => p.pass !== undefined);
    if (item.finishedAt === undefined || !(onlyRewatches || keepShowDates)) patch.finishedAt = now;
  }
  if (!after.complete && before.complete && !keepShowDates) patch.finishedAt = undefined;

  await ctx.db.patch(item._id, patch);
  if (touchList) await ctx.db.patch(item.listId, { updatedAt: now });

  return after;
}
