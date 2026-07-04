"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Film,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Tv,
  XCircle,
} from "lucide-react";
import { getMediaBlurPlaceholder } from "@/lib/image-utils";
import { EpisodeList } from "./EpisodeList";
import { DetailSheet } from "./DetailSheet";
import { MediaCardInnerProps } from "./types";
import { cn } from "@/lib/utils";
import { calculateTVStatus } from "@/lib/tv-status";
import { isEpisodeLocked, resolveEpisodeAirDate } from "@/lib/tv-episodes";
import { toast } from "sonner";

interface Props extends MediaCardInnerProps {
  priority?: boolean;
}

function computeRemaining(
  seasonData: Array<{ seasonNumber: number; episodeCount: number; airDate?: string }> | undefined,
  currentSeason: number,
  currentEpisode: number
) {
  const visible = (seasonData ?? []).filter((s) => s.airDate);
  if (visible.length === 0) return { episodesLeft: 0, seasonsLeft: 0 };

  const sorted = [...visible].sort((a, b) => a.seasonNumber - b.seasonNumber);
  let episodesLeft = 0;
  let seasonsLeft = 0;

  for (const s of sorted) {
    if (s.seasonNumber < currentSeason) continue;
    if (s.seasonNumber === currentSeason) {
      episodesLeft += Math.max(0, s.episodeCount - currentEpisode + 1);
    } else {
      episodesLeft += s.episodeCount;
      seasonsLeft++;
    }
  }

  return { episodesLeft, seasonsLeft };
}

export function MediaCardMinimal({
  canEdit,
  priority = false,
  listItem,
  handleStatusChange,
  handleDelete,
  handleAdvanceEpisode,
  handleRewindEpisode,
  handleMarkSeasonWatched,
  handleRatingChange,
  handlePriorityChange,
  handleNotesChange,
  handleTagsChange,
  handleDatesChange,
  handleSeasonStatusChange,
  handleSeasonRatingChange,
  handleSeasonNotesChange,
  handleSeasonDatesChange,
  getSeasonStatus,
  getSeasonProgress,
  formatDate,
  handleStartRewatch,
  handleLogWatchEntry,
  handleRemoveWatchEntry,
  isUpdatingStatus,
  isDeleting,
  isAdvancingEpisode,
  isRewindingEpisode,
  isMarkingSeasonWatched,
  isStartingRewatch,
  isLoggingWatchEntry,
  isRemovingWatchEntry,
  isUpdatingRating,
  isUpdatingPriority,
  isUpdatingNotes,
  isUpdatingTags,
  isUpdatingDates,
  isUpdatingSeasonStatus,
  isUpdatingSeasonRating,
  isUpdatingSeasonNotes,
  isUpdatingSeasonDates,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [showLogRewatchForm, setShowLogRewatchForm] = useState(false);
  const [logWatchDate, setLogWatchDate] = useState("");

  const { media, status } = listItem;
  if (!media) return null;

  const isTV = media.type === "tv";
  const isMovie = media.type === "movie";
  const isWatching = status === "watching";
  const isToWatch = status === "to_watch";
  const isWatched = status === "watched";
  const isDropped = status === "dropped";
  const isDone = isWatched || isDropped;

  const curSeason = listItem.currentSeasonNumber ?? 1;
  const curEpisode = listItem.currentEpisodeNumber ?? 1;

  const displayStatus = isTV
    ? calculateTVStatus(media.seasonData, listItem.seasonProgress, status)
    : status;

  const { episodesLeft, seasonsLeft } = isTV && isWatching
    ? computeRemaining(media.seasonData, curSeason, curEpisode)
    : { episodesLeft: 0, seasonsLeft: 0 };

  const visibleSeasons = (media.seasonData ?? [])
    .filter((s) => s.airDate)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  const droppedLabel = (() => {
    if (!isDropped || !listItem.droppedAtSeason) return null;
    const s = media.seasonData?.find((s) => s.seasonNumber === listItem.droppedAtSeason);
    const atEnd = listItem.droppedAtEpisode && s && listItem.droppedAtEpisode >= s.episodeCount;
    if (atEnd) return `After S${listItem.droppedAtSeason}`;
    if (listItem.droppedAtEpisode) return `S${listItem.droppedAtSeason} E${listItem.droppedAtEpisode}`;
    return `S${listItem.droppedAtSeason}`;
  })();

  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : null;

  const today = new Date().toISOString().slice(0, 10);
  const allSeasons = (media.seasonData ?? [])
    .filter((s) => s.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const highestWatched = Math.max(
    0,
    ...(listItem.seasonProgress ?? [])
      .filter((p) => p.status === "watched")
      .map((p) => p.seasonNumber)
  );
  const pendingNextSeasons = allSeasons.filter((s) => s.seasonNumber > highestWatched);
  const showNewSeasonBadge =
    isTV &&
    status === "watched" &&
    pendingNextSeasons.some(
      (s) => !s.airDate || (s.airDate && s.airDate > today)
    );
  const showComingSoonBadge =
    (isMovie && media.releaseDate && media.releaseDate > today) ||
    (isTV &&
      status === "to_watch" &&
      visibleSeasons.length === 0 &&
      allSeasons.length > 0);

  // Current episode air date — used to lock the watch button until release
  const currentSeasonData = visibleSeasons.find((s) => s.seasonNumber === curSeason);
  const currentEpAirDate = resolveEpisodeAirDate(currentSeasonData, curEpisode);
  const currentEpLocked = isEpisodeLocked(currentSeasonData, curEpisode);

  // Format for display next to position indicator
  const currentEpAirDateFormatted = currentEpAirDate
    ? (() => {
        const d = new Date(currentEpAirDate + "T00:00:00");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
      })()
    : null;

  const handleAdvanceWithToast = async () => {
    if (currentEpLocked) return;
    const wasToWatch = listItem.status === "to_watch";
    await handleAdvanceEpisode();
    if (wasToWatch) {
      toast.success(`${media.title} moved to Current`);
    }
  };

  const handleMovieMarkWatched = async () => {
    await handleStatusChange("watched");
    toast.success(`${media.title} moved to Finished`);
  };

  const handleLogRewatchSubmit = async () => {
    const finishedAt = logWatchDate ? new Date(logWatchDate).getTime() : undefined;
    await handleLogWatchEntry({ finishedAt });
    setLogWatchDate("");
    setShowLogRewatchForm(false);
    toast.success("Rewatch logged");
  };

  const showEpisodePosition = isTV && (isWatching || isToWatch);
  const isMovieExpandable = isMovie && (canEdit || (media.watchProviders && media.watchProviders.length > 0));
  const isExpandable = (isTV && visibleSeasons.length > 0) || isMovieExpandable;

  return (
    <>
      <div className="surface-card relative overflow-hidden transition-shadow hover:shadow-md">

        <div
          className="absolute top-2 right-2 z-10 pointer-events-none text-muted-foreground"
          aria-hidden
        >
          {isMovie ? (
            <Film className="h-3.5 w-3.5" />
          ) : (
            <Tv className="h-3.5 w-3.5" />
          )}
        </div>

        {/* ── Collapsed header – relative so chevron can be anchored bottom-right ── */}
        <div className="relative">
          <div
            className={cn(
              "flex items-center gap-3 px-3 pt-3",
              // pb-6 on all cards: TV uses it for the expand chevron, movies get consistent bottom spacing
              "pb-6"
            )}
          >
            {/* Poster */}
            <div
              className={cn(
                "relative flex-shrink-0 w-14 h-[84px] rounded-lg overflow-hidden bg-muted",
                isExpandable ? "cursor-pointer" : ""
              )}
              onClick={() => { if (isExpandable) setIsExpanded(!isExpanded); }}
            >
              {media.posterUrl ? (
                <Image
                  src={media.posterUrl}
                  alt={media.title}
                  fill
                  className="object-cover"
                  sizes="56px"
                  placeholder="blur"
                  blurDataURL={getMediaBlurPlaceholder(media.type)}
                  priority={priority}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">
                  {isMovie ? "🎬" : "📺"}
                </div>
              )}
            </div>

            {/* Info */}
            <div
              className={cn(
                "flex-1 min-w-0",
                isExpandable ? "cursor-pointer" : ""
              )}
              onClick={() => { if (isExpandable) setIsExpanded(!isExpanded); }}
            >
              {/* Title — largest */}
              <div className="font-bold text-base leading-tight truncate">{media.title}</div>

              {/* Meta */}
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                {year && <span>{year}</span>}
                {isTV && media.totalSeasons && (
                  <>
                    <span>·</span>
                    <span>{media.totalSeasons} {media.totalSeasons === 1 ? "season" : "seasons"}</span>
                  </>
                )}
                {media.genres?.[0] && (
                  <>
                    <span>·</span>
                    <span className="truncate">{media.genres[0].name}</span>
                  </>
                )}
              </div>

              {/* Episode status subtitle (position shown next to action button) */}
              {showEpisodePosition && (
                <div className="mt-2">
                  {isWatching && !currentEpLocked && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {episodesLeft > 0
                        ? `${episodesLeft} ep${episodesLeft !== 1 ? "s" : ""} left${seasonsLeft > 0 ? ` · ${seasonsLeft} ${seasonsLeft === 1 ? "season" : "seasons"} left` : ""}`
                        : "Last episode"}
                    </div>
                  )}
                  {isWatching && currentEpLocked && (
                    <div className="text-xs text-muted-foreground">Not released yet</div>
                  )}
                  {isToWatch && (
                    <div className="text-xs text-muted-foreground">Not started</div>
                  )}
                </div>
              )}

              {/* Dropped label */}
              {isDropped && droppedLabel && (
                <div className="mt-1.5 text-xs text-[var(--danger-600)] dark:text-[var(--danger-300)]">
                  Dropped · {droppedLabel}
                </div>
              )}

              {/* New season badge */}
              {showNewSeasonBadge && (
                <Badge className="mt-1.5 text-[10px] px-1.5 py-0 bg-[var(--primary-100)] dark:bg-[var(--primary-800)] text-[var(--primary-700)] dark:text-[var(--primary-200)] border-0">
                  New season coming
                </Badge>
              )}

              {showComingSoonBadge && (
                <Badge className="mt-1.5 text-[10px] px-1.5 py-0 bg-[var(--warning-100)] dark:bg-[var(--warning-800)] text-[var(--warning-700)] dark:text-[var(--warning-200)] border-0">
                  Coming soon
                </Badge>
              )}

              {/* Rewatch count badge */}
              {listItem.watchHistory && listItem.watchHistory.length > 0 && (
                <Badge className="mt-1.5 text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-0">
                  {listItem.watchHistory.length + (isWatched ? 1 : 0)}× watched
                </Badge>
              )}
            </div>

            {/* ── Episode position + action circle ── */}
            <div className="flex-shrink-0 flex items-center gap-2.5">
              {showEpisodePosition && (
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-base tabular-nums leading-none whitespace-nowrap">
                    S{String(curSeason).padStart(2, "0")} | E{String(curEpisode).padStart(2, "0")}
                  </span>
                  {currentEpLocked && currentEpAirDateFormatted && (
                    <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {currentEpAirDateFormatted}
                    </span>
                  )}
                </div>
              )}

              {canEdit && !isDone && isMovie && (
                <button
                  className={cn(
                    "h-11 w-11 rounded-full border-2 flex items-center justify-center transition-all duration-150",
                    "border-border text-muted-foreground bg-background",
                    "hover:border-[var(--success-600)] hover:text-[var(--success-700)] hover:bg-[var(--success-50)]",
                    "dark:hover:border-[var(--success-400)] dark:hover:text-[var(--success-300)] dark:hover:bg-[var(--success-800)]",
                    (isAdvancingEpisode || isUpdatingStatus) && "opacity-40 cursor-not-allowed"
                  )}
                  onClick={handleMovieMarkWatched}
                  disabled={isAdvancingEpisode || isUpdatingStatus}
                  title="Mark as watched"
                >
                  <Check className={cn(
                    "h-5 w-5",
                    (isAdvancingEpisode || isUpdatingStatus) && "animate-pulse"
                  )} />
                </button>
              )}

              {canEdit && !isDone && isTV && currentEpLocked && (
                <div
                  className="h-11 w-11 rounded-full border-2 flex items-center justify-center border-border text-muted-foreground bg-muted/30"
                  title={`Not released yet${currentEpAirDateFormatted ? ` · ${currentEpAirDateFormatted}` : ""}`}
                >
                  <Lock className="h-5 w-5" />
                </div>
              )}

              {canEdit && !isDone && isTV && !currentEpLocked && (
                <button
                  className={cn(
                    "h-11 w-11 rounded-full border-2 flex items-center justify-center transition-all duration-150",
                    "border-border text-muted-foreground bg-background",
                    "hover:border-[var(--success-600)] hover:text-[var(--success-700)] hover:bg-[var(--success-50)]",
                    "dark:hover:border-[var(--success-400)] dark:hover:text-[var(--success-300)] dark:hover:bg-[var(--success-800)]",
                    (isAdvancingEpisode || isUpdatingStatus) && "opacity-40 cursor-not-allowed"
                  )}
                  onClick={handleAdvanceWithToast}
                  disabled={isAdvancingEpisode || isUpdatingStatus}
                  title={isToWatch ? "Start watching" : "Mark episode as watched"}
                >
                  <Check className={cn(
                    "h-5 w-5",
                    (isAdvancingEpisode || isUpdatingStatus) && "animate-pulse"
                  )} />
                </button>
              )}

              {isWatched && (
                <div className="h-11 w-11 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-[var(--success-600)] dark:text-[var(--success-300)]" />
                </div>
              )}

              {isDropped && (
                <div className="h-11 w-11 rounded-full flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-[var(--danger-600)] dark:text-[var(--danger-300)]" />
                </div>
              )}
            </div>
          </div>

          {/* Expand chevron — bottom-right corner of the collapsed header */}
          {isExpandable && (
            <button
              className="absolute bottom-1 right-2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse" : isTV ? "Show seasons" : "More info"}
            >
              {isExpanded
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* ── Expanded panel (TV: providers + seasons / Movie: providers + actions) ── */}
        {isExpandable && isExpanded && (
          <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5">

            {/* Watch providers — centered at the top for both TV and movie */}
            {media.watchProviders && media.watchProviders.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 pb-0.5">
                {[...media.watchProviders]
                  .sort((a, b) => a.displayPriority - b.displayPriority)
                  .slice(0, 6)
                  .map((provider) =>
                    provider.logoPath ? (
                      <img
                        key={provider.providerId}
                        src={`https://image.tmdb.org/t/p/w45${provider.logoPath}`}
                        alt={provider.providerName}
                        title={provider.providerName}
                          width={32}
                          height={32}
                          className="rounded w-8 h-8 object-cover opacity-80"
                      />
                    ) : null
                  )}
              </div>
            )}

            {/* TV: season list */}
            {isTV && visibleSeasons.map((season) => {
              const seasonStatus = getSeasonStatus(season.seasonNumber);
              const isSeasonWatched = seasonStatus === "watched";
              const isCurrentSeason = season.seasonNumber === curSeason;
              const isSeasonExpanded = expandedSeason === season.seasonNumber;

              return (
                <div key={season.seasonNumber} className="rounded-md border border-border overflow-hidden">
                  <button
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                      isCurrentSeason && "bg-[var(--primary-50)] dark:bg-[var(--primary-800)]"
                    )}
                    onClick={() => setExpandedSeason(isSeasonExpanded ? null : season.seasonNumber)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium",
                        isSeasonWatched && "text-[var(--success-700)] dark:text-[var(--success-300)]"
                      )}>
                        Season {season.seasonNumber}
                      </span>
                      {isCurrentSeason && !isSeasonWatched && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-[var(--primary-100)] dark:bg-[var(--primary-800)] text-[var(--primary-700)] dark:text-[var(--primary-200)] border-0">
                          Watching
                        </Badge>
                      )}
                      {isSeasonWatched && (
                        <Check className="h-3.5 w-3.5 text-[var(--success-600)] dark:text-[var(--success-300)]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{season.episodeCount} eps</span>
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform",
                        isSeasonExpanded && "rotate-90"
                      )} />
                    </div>
                  </button>

                  {isSeasonExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-border">
                      <EpisodeList
                        seasonNumber={season.seasonNumber}
                        episodeCount={season.episodeCount}
                        airDate={season.airDate}
                        episodes={season.episodes}
                        isCurrentSeason={isCurrentSeason}
                        isWatched={isSeasonWatched}
                        currentEpisodeNumber={isCurrentSeason ? curEpisode : undefined}
                        canEdit={canEdit}
                        onMarkSeasonWatched={handleMarkSeasonWatched}
                        isMarkingSeasonWatched={isMarkingSeasonWatched}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Movie: log rewatch */}
            {isMovie && canEdit && isWatched && (
              <div className="pt-1">
                {showLogRewatchForm ? (
                  <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">Log a rewatch</p>
                    <input
                      type="date"
                      value={logWatchDate}
                      onChange={(e) => setLogWatchDate(e.target.value)}
                      className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setShowLogRewatchForm(false);
                          setLogWatchDate("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleLogRewatchSubmit}
                        disabled={isLoggingWatchEntry || !logWatchDate}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => {
                      setLogWatchDate(new Date().toISOString().slice(0, 10));
                      setShowLogRewatchForm(true);
                    }}
                    disabled={isLoggingWatchEntry}
                  >
                    <Plus className="h-3 w-3" />
                    Log rewatch
                  </Button>
                )}
              </div>
            )}

            {/* Footer: undo episode (TV watching), edit details, delete */}
            {canEdit && (
              <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
                <div className="flex items-center gap-1">
                  {isWatching && isTV && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={handleRewindEpisode}
                      disabled={isRewindingEpisode}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Undo episode
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => setIsDetailOpen(true)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit details
                  </Button>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-[var(--danger-600)] dark:hover:text-[var(--danger-400)] gap-1.5"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove from list?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove &ldquo;{media.title}&rdquo;? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        {isDeleting ? "Removing..." : "Remove"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        )}
      </div>

      <DetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        canEdit={canEdit}
        listItem={listItem}
        media={media}
        handleStatusChange={handleStatusChange}
        handleRatingChange={handleRatingChange}
        handlePriorityChange={handlePriorityChange}
        handleNotesChange={handleNotesChange}
        handleTagsChange={handleTagsChange}
        handleDatesChange={handleDatesChange}
        handleSeasonStatusChange={handleSeasonStatusChange}
        handleSeasonRatingChange={handleSeasonRatingChange}
        handleSeasonNotesChange={handleSeasonNotesChange}
        handleSeasonDatesChange={handleSeasonDatesChange}
        handleMarkSeasonWatched={handleMarkSeasonWatched}
        handleStartRewatch={handleStartRewatch}
        handleLogWatchEntry={handleLogWatchEntry}
        handleRemoveWatchEntry={handleRemoveWatchEntry}
        getSeasonStatus={getSeasonStatus}
        getSeasonProgress={getSeasonProgress}
        formatDate={formatDate}
        isUpdatingStatus={isUpdatingStatus}
        isUpdatingRating={isUpdatingRating}
        isUpdatingPriority={isUpdatingPriority}
        isUpdatingNotes={isUpdatingNotes}
        isUpdatingTags={isUpdatingTags}
        isUpdatingDates={isUpdatingDates}
        isUpdatingSeasonStatus={isUpdatingSeasonStatus}
        isUpdatingSeasonRating={isUpdatingSeasonRating}
        isUpdatingSeasonNotes={isUpdatingSeasonNotes}
        isUpdatingSeasonDates={isUpdatingSeasonDates}
        isMarkingSeasonWatched={isMarkingSeasonWatched}
        isStartingRewatch={isStartingRewatch}
        isLoggingWatchEntry={isLoggingWatchEntry}
        isRemovingWatchEntry={isRemovingWatchEntry}
      />
    </>
  );
}
