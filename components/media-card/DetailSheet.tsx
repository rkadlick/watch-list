"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { TrackingForm } from "./TrackingForm";
import { SeasonEditForm } from "./SeasonEditForm";
import { UserRatingPopover } from "./UserRatingPopover";
import { PrioritySelector } from "./PrioritySelector";
import {
  statusLabels,
  SeasonProgress,
  StatusValue,
  PriorityValue,
  WatchHistoryEntry,
  EpisodeData,
  EpisodeWatch,
} from "./types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tv, MapPin, History, Trash2, ChevronRight, Check, XCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEpisodeWatches } from "@/lib/hooks/useEpisodeWatches";
import type { Id } from "@/convex/_generated/dataModel";
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

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  listItem: {
    _id: Id<"listItems">;
    status: StatusValue;
    rating?: number;
    notes?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    startedAt?: number;
    finishedAt?: number;
    seasonProgress?: SeasonProgress[];
    currentSeasonNumber?: number;
    currentEpisodeNumber?: number;
    droppedAtSeason?: number;
    droppedAtEpisode?: number;
    watchHistory?: WatchHistoryEntry[];
  };
  media: {
    type: "movie" | "tv";
    title: string;
    posterUrl?: string;
    seasonData?: Array<{
      seasonNumber: number;
      episodeCount: number;
      airDate?: string;
      episodes?: EpisodeData[];
    }>;
    totalSeasons?: number;
    totalEpisodes?: number;
  };
  // Handlers
  handleStatusChange: (status: StatusValue) => Promise<void>;
  handleRatingChange: (rating: number | undefined) => Promise<void>;
  handlePriorityChange: (priority: PriorityValue) => Promise<void>;
  handleNotesChange: (notes: string) => Promise<void>;
  handleTagsChange: (tags: string[]) => Promise<void>;
  handleDatesChange: (startedAt?: number | null, finishedAt?: number | null) => Promise<void>;
  handleSeasonStatusChange: (seasonNumber: number, status: StatusValue) => Promise<void>;
  handleSeasonRatingChange: (seasonNumber: number, rating: number | undefined) => Promise<void>;
  handleSeasonNotesChange: (seasonNumber: number, notes: string) => Promise<void>;
  handleSeasonDatesChange: (seasonNumber: number, startedAt?: number | null, finishedAt?: number | null) => Promise<void>;
  handleMarkSeasonWatched: (seasonNumber: number) => Promise<void>;
  handleStartRewatch: () => Promise<void>;
  handleLogWatchEntry: (entry: { startedAt?: number; finishedAt?: number; rating?: number; notes?: string }) => Promise<void>;
  handleRemoveWatchEntry: (entryIndex: number) => Promise<void>;
  getSeasonStatus: (seasonNumber: number) => StatusValue;
  getSeasonProgress: (seasonNumber: number) => SeasonProgress | undefined;
  formatDate: (timestamp?: number) => string | null;
  // Loading flags
  isUpdatingStatus: boolean;
  isUpdatingRating: boolean;
  isUpdatingPriority: boolean;
  isUpdatingNotes: boolean;
  isUpdatingTags: boolean;
  isUpdatingDates: boolean;
  isUpdatingSeasonStatus: boolean;
  isUpdatingSeasonRating: boolean;
  isUpdatingSeasonNotes: boolean;
  isUpdatingSeasonDates: boolean;
  isMarkingSeasonWatched: boolean;
  isStartingRewatch: boolean;
  isLoggingWatchEntry: boolean;
  isRemovingWatchEntry: boolean;
}

function formatDateStr(timestamp?: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TvWatchDatesSection({
  episodeWatchDates,
}: {
  episodeWatchDates: EpisodeWatch[];
}) {
  if (episodeWatchDates.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Watch dates
        <Badge className="h-4 px-1.5 text-[10px] bg-muted text-muted-foreground ml-1">
          {episodeWatchDates.length} ep{episodeWatchDates.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {episodeWatchDates.map((entry) => (
          <div
            key={`${entry.seasonNumber}-${entry.episodeNumber}`}
            className="flex items-center justify-between text-xs bg-muted/40 rounded-md px-2.5 py-1.5"
          >
            <span className="font-medium text-foreground tabular-nums">
              S{String(entry.seasonNumber).padStart(2, "0")} E{String(entry.episodeNumber).padStart(2, "0")}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {entry.watchedAt === undefined ? "Date unknown" : formatDateStr(entry.watchedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WatchHistorySection({
  watchHistory,
  canEdit,
  onRemoveEntry,
  isRemovingWatchEntry,
}: {
  watchHistory?: WatchHistoryEntry[];
  canEdit: boolean;
  onRemoveEntry: (index: number) => Promise<void>;
  isRemovingWatchEntry: boolean;
}) {
  const entries = (watchHistory ?? [])
    .map((entry, historyIndex) => ({ entry, historyIndex }))
    .filter(({ entry }) => entry.finishedAt)
    .reverse(); // most recent watch first

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Watch History
        <Badge className="h-4 px-1.5 text-[10px] bg-muted text-muted-foreground ml-1">
          {entries.length}×
        </Badge>
      </div>

      <div className="space-y-1.5">
        {entries.map(({ entry, historyIndex }) => (
          <div
            key={historyIndex}
            className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded-md px-2.5 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-foreground tabular-nums">
                {formatDateStr(entry.finishedAt!)}
                {entry.rating !== undefined && (
                  <span className="flex items-center gap-0.5 font-normal text-[var(--rating-500)]">
                    <Star className="h-3 w-3 fill-[var(--rating-400)]" />
                    {entry.rating}
                  </span>
                )}
              </div>
              {entry.notes && (
                <div className="text-muted-foreground mt-0.5 line-clamp-2">{entry.notes}</div>
              )}
            </div>
            {canEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-[var(--danger-600)] dark:hover:text-[var(--danger-300)] transition-colors"
                    disabled={isRemovingWatchEntry}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this watch entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this watch from your history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRemoveEntry(historyIndex)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSheet({
  open,
  onOpenChange,
  canEdit,
  listItem,
  media,
  handleStatusChange,
  handleRatingChange,
  handlePriorityChange,
  handleNotesChange,
  handleTagsChange,
  handleDatesChange,
  handleSeasonStatusChange,
  handleSeasonRatingChange,
  handleSeasonNotesChange,
  handleSeasonDatesChange,
  handleMarkSeasonWatched,
  handleStartRewatch,
  handleLogWatchEntry,
  handleRemoveWatchEntry,
  getSeasonStatus,
  getSeasonProgress,
  formatDate,
  isUpdatingStatus,
  isUpdatingRating,
  isUpdatingPriority,
  isUpdatingNotes,
  isUpdatingTags,
  isUpdatingDates,
  isUpdatingSeasonStatus,
  isUpdatingSeasonRating,
  isUpdatingSeasonNotes,
  isUpdatingSeasonDates,
  isMarkingSeasonWatched,
  isStartingRewatch,
  isLoggingWatchEntry,
  isRemovingWatchEntry,
}: DetailSheetProps) {
  const [openSeason, setOpenSeason] = useState<string | undefined>(undefined);
  const episodeWatches = useEpisodeWatches(listItem._id, open && media.type === "tv");

  const visibleSeasons = (media.seasonData ?? [])
    .filter((s) => s.airDate)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  const curSeason = listItem.currentSeasonNumber ?? 1;
  const visibleSeasonNumbers = new Set(visibleSeasons.map((s) => s.seasonNumber));
  const allEpisodeWatchDates =
    media.type === "tv"
      ? episodeWatches.current.filter((w) => visibleSeasonNumbers.has(w.seasonNumber))
      : [];

  // Dropped location display
  const droppedDisplay = (() => {
    if (listItem.status !== "dropped") return null;
    if (!listItem.droppedAtSeason) return null;
    const season = media.seasonData?.find((s) => s.seasonNumber === listItem.droppedAtSeason);
    const wasAtEnd = listItem.droppedAtEpisode && season && listItem.droppedAtEpisode >= season.episodeCount;
    if (wasAtEnd) return `Dropped after Season ${listItem.droppedAtSeason}`;
    if (listItem.droppedAtEpisode) return `Dropped at S${listItem.droppedAtSeason} E${listItem.droppedAtEpisode}`;
    return `Dropped during Season ${listItem.droppedAtSeason}`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height so the sheet doesn't resize as seasons expand — body scrolls */}
      <DialogContent className="w-full sm:max-w-xl h-[90vh] sm:h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 pr-12 border-b border-border">
          <DialogTitle className="text-left">{media.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {/* Rating + Priority + Drop row */}
          <div className="flex items-center gap-3 flex-wrap">
            {!canEdit && (
              <Badge variant="secondary" className="text-xs">
                {statusLabels[listItem.status]}
              </Badge>
            )}

            {/* Movies: rating lives on each watch-history entry instead — see Watch History below */}
            {canEdit && media.type === "tv" && (
              <UserRatingPopover
                rating={listItem.rating}
                onRatingChange={handleRatingChange}
                size="sm"
                disabled={isUpdatingRating}
              />
            )}

            {canEdit && (
              <PrioritySelector
                priority={listItem.priority}
                onPriorityChange={handlePriorityChange}
                size="sm"
                disabled={isUpdatingPriority}
              />
            )}

            {canEdit && listItem.status !== "dropped" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-[var(--danger-600)] dark:text-[var(--danger-400)] hover:bg-[var(--danger-50)] dark:hover:bg-[var(--danger-950)]"
                onClick={() => handleStatusChange("dropped")}
                disabled={isUpdatingStatus}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Drop
              </Button>
            )}
          </div>

          {/* Dropped location */}
          {droppedDisplay && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md",
              "bg-[var(--danger-50)] dark:bg-[var(--danger-950)] text-[var(--danger-700)] dark:text-[var(--danger-300)]"
            )}>
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {droppedDisplay}
            </div>
          )}

          {/* Tracking form (tags, notes, dates) */}
          <TrackingForm
            canEdit={canEdit}
            startedAt={listItem.startedAt}
            finishedAt={listItem.finishedAt}
            tags={listItem.tags}
            notes={listItem.notes}
            mediaTitle={media.title}
            mediaType={media.type}
            tagsNotesFirst
            hideDates
            onDatesChange={handleDatesChange}
            onTagsChange={handleTagsChange}
            onNotesChange={handleNotesChange}
            onDelete={() => Promise.resolve()}
            isUpdatingNotes={isUpdatingNotes}
            isUpdatingTags={isUpdatingTags}
            isUpdatingDates={isUpdatingDates}
          />

          {/* Movie watch history */}
          {media.type === "movie" && (
            <WatchHistorySection
              watchHistory={listItem.watchHistory}
              canEdit={canEdit}
              onRemoveEntry={handleRemoveWatchEntry}
              isRemovingWatchEntry={isRemovingWatchEntry}
            />
          )}

          {/* TV: all episode watch dates */}
          {media.type === "tv" && (
            <TvWatchDatesSection episodeWatchDates={allEpisodeWatchDates} />
          )}

          {/* TV: Seasons */}
          {media.type === "tv" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Tv className="h-3.5 w-3.5" />
                Seasons
              </div>
              <div className="space-y-1.5">
                {visibleSeasons.map((season) => {
                  const seasonStatus = getSeasonStatus(season.seasonNumber);
                  const seasonProgress = getSeasonProgress(season.seasonNumber);
                  const watchedCount =
                    seasonProgress?.watchedCount ?? seasonProgress?.episodeDates?.length ?? 0;
                  const isSeasonWatched = seasonStatus === "watched";
                  const isCurrentSeason = season.seasonNumber === curSeason;
                  const seasonKey = `season-${season.seasonNumber}`;
                  const isSeasonExpanded = openSeason === seasonKey;

                  return (
                    <div key={seasonKey} className="rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                          isCurrentSeason && "bg-[var(--primary-50)] dark:bg-[var(--primary-800)]"
                        )}
                        onClick={() => setOpenSeason(isSeasonExpanded ? undefined : seasonKey)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium",
                            isSeasonWatched && "text-[var(--success-600)] dark:text-[var(--success-400)]"
                          )}>
                            Season {season.seasonNumber}
                          </span>
                          {isCurrentSeason && !isSeasonWatched && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-[var(--primary-100)] dark:bg-[var(--primary-800)] text-[var(--primary-700)] dark:text-[var(--primary-200)] border-0">
                              Watching
                            </Badge>
                          )}
                          {isSeasonWatched && (
                            <Check className="h-3.5 w-3.5 text-[var(--success-500)]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {watchedCount > 0 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {watchedCount}/{season.episodeCount} watched
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{season.episodeCount} eps</span>
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                            isSeasonExpanded && "rotate-90"
                          )} />
                        </div>
                      </button>

                      {isSeasonExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-border">
                          <SeasonEditForm
                            canEdit={canEdit}
                            seasonNumber={season.seasonNumber}
                            episodeCount={season.episodeCount}
                            airDate={season.airDate}
                            notes={seasonProgress?.notes}
                            episodeWatches={episodeWatches.forSeason(season.seasonNumber)}
                            onNotesChange={(notes) => handleSeasonNotesChange(season.seasonNumber, notes)}
                            isUpdatingSeasonNotes={isUpdatingSeasonNotes}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
