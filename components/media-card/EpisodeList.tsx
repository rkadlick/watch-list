"use client";

import { useState } from "react";
import { Lock, Check, X, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import type { EpisodeData, EpisodeWatchLogEntry } from "./types";
import { isEpisodeUnreleasedInGrid } from "@/lib/tv-episodes";

interface EpisodeListProps {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
  episodes?: EpisodeData[];
  isCurrentSeason: boolean;
  isWatched: boolean;
  /** Episodes watched this pass; undefined while loading */
  watchedEpisodes?: Set<number>;
  currentEpisodeNumber?: number;
  canEdit: boolean;
  onMarkSeasonWatched: (seasonNumber: number) => void;
  isMarkingSeasonWatched: boolean;
  /** Makes episodes tappable. `alsoMarkEarlier` fills unwatched episodes before it */
  onSetEpisodeWatched?: (
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    alsoMarkEarlier?: boolean
  ) => Promise<void>;
  /** episodeNumber → every watch of it (current + rewatches), oldest first */
  watchLog?: Map<number, EpisodeWatchLogEntry[]>;
  /** The season is on its own rewatch pass */
  isRewatching?: boolean;
  onLogEpisodeRewatch?: (seasonNumber: number, episodeNumber: number) => Promise<void>;
  onStartSeasonRewatch?: (seasonNumber: number) => Promise<void>;
  onStopSeasonRewatch?: (seasonNumber: number) => Promise<void>;
  isUpdatingSeasonRewatch?: boolean;
}

interface GapPrompt {
  episodeNumber: number;
  gap: number[];
}

function formatWatchDate(timestamp?: number): string {
  if (timestamp === undefined) return "date unknown";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAirDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** [1,2,3,5] → "E1–3, E5" */
function formatEpisodeRanges(episodes: number[]): string {
  const parts: string[] = [];
  let start = episodes[0];
  let prev = episodes[0];
  for (const ep of [...episodes.slice(1), Infinity]) {
    if (ep === prev + 1) {
      prev = ep;
      continue;
    }
    parts.push(start === prev ? `E${start}` : `E${start}–${prev}`);
    start = prev = ep;
  }
  return parts.join(", ");
}

export function EpisodeList({
  seasonNumber,
  episodeCount,
  airDate,
  episodes,
  isCurrentSeason,
  isWatched,
  watchedEpisodes,
  currentEpisodeNumber,
  canEdit,
  onMarkSeasonWatched,
  isMarkingSeasonWatched,
  onSetEpisodeWatched,
  watchLog,
  isRewatching = false,
  onLogEpisodeRewatch,
  onStartSeasonRewatch,
  onStopSeasonRewatch,
  isUpdatingSeasonRewatch = false,
}: EpisodeListProps) {
  const currentEp = currentEpisodeNumber ?? 1;
  // Target state shown immediately while a toggle is in flight
  const [pending, setPending] = useState<Map<number, boolean>>(new Map());
  const [gapPrompt, setGapPrompt] = useState<GapPrompt | null>(null);
  // Watched episode whose actions (rewatch / unmark) are open
  const [selected, setSelected] = useState<number | null>(null);

  // Only toggle against real watch data, not the loading fallback
  const isInteractive = canEdit && !!onSetEpisodeWatched && watchedEpisodes !== undefined;

  // Build a lookup map from the structured episode data
  const episodeMap = new Map<number, EpisodeData>();
  for (const ep of episodes ?? []) {
    episodeMap.set(ep.episodeNumber, ep);
  }

  // Disable "All watched" if any episode in this season hasn't aired yet
  const hasUnreleasedEpisodes = Array.from({ length: episodeCount }, (_, i) => i + 1).some(
    (epNum) => isEpisodeUnreleasedInGrid(episodeMap.get(epNum)?.airDate)
  );

  const isEpisodeWatched = (epNum: number) =>
    pending.get(epNum) ??
    (watchedEpisodes
      ? watchedEpisodes.has(epNum)
      : isWatched || (isCurrentSeason && epNum < currentEp));

  const commit = async (episodeNumbers: number[], watched: boolean, alsoMarkEarlier = false) => {
    if (!onSetEpisodeWatched) return;
    const target = episodeNumbers[episodeNumbers.length - 1];
    setPending((prev) => {
      const next = new Map(prev);
      for (const ep of episodeNumbers) next.set(ep, watched);
      return next;
    });
    try {
      await onSetEpisodeWatched(seasonNumber, target, watched, alsoMarkEarlier);
    } catch {
      // Error toast comes from the mutation hook
    } finally {
      setPending((prev) => {
        const next = new Map(prev);
        for (const ep of episodeNumbers) next.delete(ep);
        return next;
      });
    }
  };

  const handleEpisodeClick = (epNum: number) => {
    setGapPrompt(null);
    if (isEpisodeWatched(epNum)) {
      setSelected(selected === epNum ? null : epNum);
      return;
    }
    setSelected(null);
    const gap = Array.from({ length: epNum - 1 }, (_, i) => i + 1).filter(
      (ep) => !isEpisodeWatched(ep) && !isEpisodeUnreleasedInGrid(episodeMap.get(ep)?.airDate)
    );
    if (gap.length > 0) {
      setGapPrompt({ episodeNumber: epNum, gap });
      return;
    }
    void commit([epNum], true);
  };

  const resolveGapPrompt = (fillGap: boolean) => {
    if (!gapPrompt) return;
    const { episodeNumber, gap } = gapPrompt;
    setGapPrompt(null);
    void commit(fillGap ? [...gap, episodeNumber] : [episodeNumber], true, fillGap);
  };

  const unmarkSelected = () => {
    if (selected === null) return;
    setSelected(null);
    void commit([selected], false);
  };

  const logSelectedRewatch = async () => {
    if (selected === null || !onLogEpisodeRewatch) return;
    const episodeNumber = selected;
    setSelected(null);
    try {
      await onLogEpisodeRewatch(seasonNumber, episodeNumber);
    } catch {
      // Error toast comes from the mutation hook
    }
  };

  const watchedCount = Array.from({ length: episodeCount }, (_, i) => i + 1).filter(
    isEpisodeWatched
  ).length;
  const canStartRewatch = !!onStartSeasonRewatch && isWatched && !isRewatching;
  const canStopRewatch = !!onStopSeasonRewatch && isRewatching;
  const showHeader = canEdit && (!isWatched || canStartRewatch || canStopRewatch);

  const selectedLog = selected !== null ? watchLog?.get(selected) ?? [] : [];
  const selectedCurrent = selectedLog.find((w) => w.isCurrent);

  return (
    <div>
      {/* Season actions: rewatch status, "All watched", start/stop a rewatch */}
      {showHeader && (
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border">
          <div className="flex items-center gap-1.5 min-w-0">
            {isRewatching && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--primary-700)] dark:text-[var(--primary-300)]">
                <Repeat className="h-3 w-3" />
                Rewatching · {watchedCount}/{episodeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canStopRewatch && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={() => void onStopSeasonRewatch!(seasonNumber).catch(() => {})}
                disabled={isUpdatingSeasonRewatch}
                title="Go back to your previous watch of this season. Episodes you rewatched stay in your history."
              >
                Stop rewatch
              </Button>
            )}
            {canStartRewatch && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                    disabled={isUpdatingSeasonRewatch}
                  >
                    <Repeat className="h-3 w-3 mr-1" />
                    Rewatch season
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rewatch Season {seasonNumber}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Its episodes reset to unwatched so you can check them off again. Your
                      previous watch dates are kept in your history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void onStartSeasonRewatch!(seasonNumber).catch(() => {})}
                    >
                      Start rewatch
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {!isWatched && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-[var(--success-700)] dark:hover:text-[var(--success-300)] hover:bg-[var(--success-50)] dark:hover:bg-[var(--success-800)]"
                onClick={() => onMarkSeasonWatched(seasonNumber)}
                disabled={isMarkingSeasonWatched || hasUnreleasedEpisodes}
                title={hasUnreleasedEpisodes ? "Some episodes haven't aired yet" : undefined}
              >
                <Check className="h-3 w-3 mr-1" />
                All watched
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Episode grid */}
      <div className="flex flex-wrap gap-x-2 gap-y-3 justify-center">
        {Array.from({ length: episodeCount }, (_, i) => {
          const epNum = i + 1;
          const epData = episodeMap.get(epNum);
          const unreleased = isEpisodeUnreleasedInGrid(epData?.airDate);
          const isEpWatched = isEpisodeWatched(epNum);
          const isCurrent = isCurrentSeason && epNum === currentEp && !isEpWatched;
          const isPrompting = gapPrompt?.episodeNumber === epNum || selected === epNum;
          const isClickable = isInteractive && (isEpWatched || !unreleased);
          const title = epData?.name
            ? `E${epNum}: ${epData.name}${epData.airDate ? ` · ${formatAirDate(epData.airDate)}` : ""}`
            : `Episode ${epNum}`;
          const Wrapper = isClickable ? "button" : "div";

          return (
            <Wrapper
              key={epNum}
              {...(isClickable && {
                type: "button" as const,
                onClick: () => handleEpisodeClick(epNum),
                "aria-pressed": isEpWatched,
                "aria-label": `${title}${isEpWatched ? " — watched, tap for options" : " — tap to mark watched"}`,
              })}
              className={cn(
                "flex flex-col items-center gap-0.5 w-8 rounded-md py-0.5",
                isClickable && "cursor-pointer hover:bg-muted/60 transition-colors",
                isPrompting && "bg-muted/60"
              )}
              title={title}
            >
              {/* Check circle */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  isEpWatched
                    ? "bg-[var(--success-600)] border-[var(--success-600)] dark:bg-[var(--success-500)] dark:border-[var(--success-500)]"
                    : isCurrent || isPrompting
                      ? "border-[var(--primary-600)] bg-[var(--primary-50)] dark:border-[var(--primary-400)] dark:bg-[var(--primary-800)]"
                      : unreleased
                        ? "border-border bg-muted/40"
                        : "border-border bg-transparent"
                )}
              >
                {isEpWatched && <Check className="h-2.5 w-2.5 text-white" />}
                {!isEpWatched && !unreleased && (watchLog?.get(epNum)?.length ?? 0) > 0 && (
                  // Watched on an earlier pass — rewatch in progress
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-500)]/60" />
                )}
                {!isEpWatched && unreleased && (
                  <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                )}
              </div>

              {/* Episode number label */}
              <span
                className={cn(
                  "text-[10px] tabular-nums leading-none",
                  isEpWatched
                    ? "text-[var(--success-700)] dark:text-[var(--success-300)]"
                    : isCurrent
                      ? "text-[var(--primary-700)] dark:text-[var(--primary-300)] font-semibold"
                      : "text-muted-foreground"
                )}
              >
                E{epNum}
              </span>
            </Wrapper>
          );
        })}
      </div>

      {/* Watched episode — when it was watched, log a rewatch, or unmark */}
      {selected !== null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2">
          <p className="text-xs min-w-0">
            <span className="font-medium">E{selected}</span>
            <span className="text-muted-foreground">
              {" "}· watched {formatWatchDate(selectedCurrent?.watchedAt)}
              {selectedLog.length > 1 && ` · ${selectedLog.length}× total`}
            </span>
          </p>
          <div className="flex items-center gap-1">
            {onLogEpisodeRewatch && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={logSelectedRewatch}
                title="Log that you watched this episode again today"
              >
                <Repeat className="h-3 w-3 mr-1" />
                Rewatched
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-muted-foreground hover:text-[var(--danger-600)] dark:hover:text-[var(--danger-300)]"
              onClick={unmarkSelected}
            >
              Unmark
            </Button>
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Gap prompt — ticking an episode with unwatched ones before it */}
      {gapPrompt && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2">
          <p className="text-xs">
            Also mark {formatEpisodeRanges(gapPrompt.gap)} as watched?
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-6 text-xs px-2" onClick={() => resolveGapPrompt(true)}>
              Mark all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => resolveGapPrompt(false)}
            >
              Just E{gapPrompt.episodeNumber}
            </Button>
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              onClick={() => setGapPrompt(null)}
              aria-label="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
