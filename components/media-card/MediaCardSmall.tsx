"use client";

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
import { Card, CardContent, CardTitle } from "@/components/ui/Card";
import { Trash2, Tv, Tag, MessageSquare, Calendar, Pencil, X } from "lucide-react";
import { RatingCircle } from "./RatingCircle";
import { StatusMenu } from "./StatusMenu";
import { SeasonAccordion } from "./SeasonAccordion";
import { UserRatingPopover } from "./UserRatingPopover";
import { PrioritySelector } from "./PrioritySelector";
import { TrackingForm } from "./TrackingForm";
import { MediaCardInnerProps, StatusValue, statusColors, statusLabels } from "./types";
import { useState } from "react";
import { getMediaBlurPlaceholder } from "@/lib/image-utils";
import { PlatformLogo } from "@/components/PlatformLogo";
import { deduplicateProviders } from "@/lib/providers";
import { calculateTVStatus } from "@/lib/tv-status";

interface MediaCardSmallProps extends MediaCardInnerProps {
  priority?: boolean; // For priority loading
}

export function MediaCardSmall(props: MediaCardSmallProps) {
  const {
    listItem,
    canEdit,
    priority = false,
    handleStatusChange,
    handleDelete,
    showSeasons,
    setShowSeasons,
    openSeason,
    setOpenSeason,
    handleSeasonStatusChange,
    getSeasonStatus,
    getSeasonProgress,
    formatDate,
    handleRatingChange,
    handleSeasonRatingChange,
    handlePriorityChange,
    handleNotesChange,
    handleSeasonNotesChange,
    handleTagsChange,
    handleDatesChange,
    handleSeasonDatesChange,
    handleMarkSeasonWatched,
    isUpdatingStatus,
    isDeleting,
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
  } = props;

  const { media, status, rating, priority: itemPriority, tags, startedAt, finishedAt, notes, _creationTime } = listItem;

  const [showAllProviders, setShowAllProviders] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  if (!media) return null;

  // For TV shows, calculate the display status based on visible seasons
  const displayStatus = media.type === "tv"
    ? calculateTVStatus(media.seasonData, listItem.seasonProgress, status)
    : status;

  const config = {
    posterWidth: "w-20",
    posterHeight: "h-28",
    titleSize: "text-base",
    gap: "gap-2",
    padding: "p-3",
    textSize: "text-xs",
    iconSize: "h-3.5 w-3.5",
    badgeSize: "text-xs",
  };

  // Format "Added" date - show exact date
  const formatAddedDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Build meta info with dot separators
  const buildMetaInfo = () => {
    const parts: string[] = [];
    if (media.releaseDate) {
      if (media.type === "movie") {
        parts.push(new Date(media.releaseDate).toLocaleDateString("en-US", {
          month: "short", // Using short month for small card to save space
          day: "numeric",
          year: "numeric",
        }));
      } else {
        parts.push(new Date(media.releaseDate).getFullYear().toString());
      }
    }
    if (media.type === "tv" && media.totalSeasons) {
      parts.push(`${media.totalSeasons} Season${media.totalSeasons !== 1 ? "s" : ""}`);
    }
    if (media.genres && media.genres.length > 0) {
      parts.push(media.genres.slice(0, 2).map(g => g.name).join(", "));
    }
    return parts.join(" • ");
  };

  const hasNotes = !!notes;
  const hasTags = !!(tags && tags.length > 0);
  const hasDates = !!(startedAt || finishedAt);

  return (
    <Card className={`hover:shadow-md transition-shadow flex flex-col ${isEditMode ? "ring-1 ring-primary/30" : ""}`}>
      <div className={`flex ${config.gap} ${config.padding} flex-1`}>
        {media.posterUrl && (
          <div
            className={`relative flex-shrink-0 ${config.posterWidth} ${config.posterHeight} rounded overflow-hidden`}
          >
            <Image
              src={media.posterUrl}
              alt={media.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 64px, 80px"
              placeholder="blur"
              blurDataURL={getMediaBlurPlaceholder(media.type)}
              priority={priority}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* HEADER: Title + Edit toggle + Delete */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${config.titleSize} font-semibold leading-tight line-clamp-2`}>
                {media.title}
              </CardTitle>
              <div className={`${config.textSize} text-muted-foreground mt-0.5`}>
                {buildMetaInfo()}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 flex-shrink-0 cursor-pointer rounded-md group ${isEditMode ? "text-primary" : "text-muted-foreground"}`}
                  onClick={() => setIsEditMode(!isEditMode)}
                  title={isEditMode ? "Done editing" : "Edit details"}
                >
                  {isEditMode
                    ? <X className="h-3.5 w-3.5" />
                    : <Pencil className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
                  }
                </Button>
              )}
              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground flex-shrink-0 cursor-pointer rounded-md group"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-3.5 w-3.5 transition-colors group-hover:text-[var(--danger-600)] dark:group-hover:text-[var(--danger-400)]" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove from list?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove &ldquo;{media.title}&rdquo;? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* ROW 1: Status + Priority */}
          <div className="flex items-center gap-2">
            {media.type === "movie" && canEdit ? (
              <StatusMenu
                value={displayStatus}
                onChange={handleStatusChange}
                options={Object.entries(statusLabels).map(([value, label]) => ({
                  value: value as StatusValue,
                  label,
                  accent: statusColors[value as StatusValue],
                }))}
                disabled={isUpdatingStatus}
              />
            ) : (
              <Badge className={`${statusColors[displayStatus]} ${config.badgeSize}`}>
                {statusLabels[displayStatus]}
              </Badge>
            )}
            {canEdit && (
              <PrioritySelector
                priority={itemPriority}
                onPriorityChange={handlePriorityChange}
                size="sm"
                disabled={isUpdatingPriority}
              />
            )}
          </div>

          {/* ROW 2: Ratings (User + TMDB) */}
          <div className="flex items-center gap-3">
            {canEdit && (
              <UserRatingPopover
                rating={rating}
                onRatingChange={handleRatingChange}
                size="sm"
                disabled={isUpdatingRating}
              />
            )}
            {media.voteAverage && <RatingCircle score={media.voteAverage} size={36} />}
          </div>

          {/* ROW 3: Watch providers */}
          {media.watchProviders && media.watchProviders.length > 0 && (() => {
            const sortedProviders = [...media.watchProviders].sort((a, b) => a.displayPriority - b.displayPriority);
            const deduplicated = deduplicateProviders(sortedProviders);
            const displayCount = showAllProviders ? deduplicated.length : Math.min(4, deduplicated.length);

            return (
              <div className="flex items-center gap-2" title="Watch Providers">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {deduplicated.slice(0, displayCount).map((p) => (
                    <PlatformLogo
                      key={p.providerId}
                      providerName={p.normalizedName}
                      logoPath={p.logoPath}
                      size={26}
                    />
                  ))}
                  {!showAllProviders && deduplicated.length > 4 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0 h-6 cursor-pointer hover:bg-secondary/80"
                      onClick={() => setShowAllProviders(true)}
                    >
                      +{deduplicated.length - 4}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })()}

          {/* BROWSE MODE: Compact indicators for tags / notes / dates */}
          {!isEditMode && (hasNotes || hasTags || hasDates) && (
            <div className="flex items-center gap-2.5 text-muted-foreground">
              {hasTags && (
                <span
                  className="flex items-center gap-1 text-xs"
                  title={`${tags!.length} tag${tags!.length !== 1 ? "s" : ""}`}
                >
                  <Tag className="h-3 w-3" />
                  {tags!.length}
                </span>
              )}
              {hasNotes && (
                <span title="Has notes">
                  <MessageSquare className="h-3 w-3" />
                </span>
              )}
              {hasDates && (
                <span title="Has dates">
                  <Calendar className="h-3 w-3" />
                </span>
              )}
            </div>
          )}

          {/* EDIT MODE: Tracking form (dates, tags, notes) — shared by both TV and movies */}
          {isEditMode && (
            <TrackingForm
              canEdit={canEdit}
              startedAt={startedAt}
              finishedAt={finishedAt}
              tags={tags}
              notes={notes}
              mediaTitle={media.title}
              mediaType={media.type}
              onDatesChange={handleDatesChange}
              onTagsChange={handleTagsChange}
              onNotesChange={handleNotesChange}
              onDelete={handleDelete}
              isUpdatingNotes={isUpdatingNotes}
              isUpdatingTags={isUpdatingTags}
              isUpdatingDates={isUpdatingDates}
            />
          )}
        </div>
      </div>

      {/* TV: Season accordion — only shown in edit mode */}
      {media.type === "tv" && isEditMode && (
        <CardContent className="pt-2 pb-2 px-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <Tv className="h-3.5 w-3.5" />
            Seasons
          </div>
          <SeasonAccordion
            canEdit={canEdit}
            showSeasons={showSeasons}
            setShowSeasons={setShowSeasons}
            openSeason={openSeason}
            setOpenSeason={setOpenSeason}
            media={media}
            listItem={listItem}
            config={config}
            handleSeasonStatusChange={handleSeasonStatusChange}
            getSeasonStatus={getSeasonStatus}
            getSeasonProgress={getSeasonProgress}
            formatDate={formatDate}
            handleSeasonRatingChange={handleSeasonRatingChange}
            handleSeasonNotesChange={handleSeasonNotesChange}
            handleSeasonDatesChange={handleSeasonDatesChange}
            handleMarkSeasonWatched={handleMarkSeasonWatched}
            isUpdatingSeasonStatus={isUpdatingSeasonStatus}
            isUpdatingSeasonRating={isUpdatingSeasonRating}
            isUpdatingSeasonNotes={isUpdatingSeasonNotes}
            isUpdatingSeasonDates={isUpdatingSeasonDates}
            isMarkingSeasonWatched={isMarkingSeasonWatched}
          />
        </CardContent>
      )}

      {/* FOOTER: Added date */}
      <div className="px-3 pb-2 text-right">
        <span className="text-[10px] text-muted-foreground">
          Added {formatAddedDate(_creationTime)}
        </span>
      </div>
    </Card>
  );
}
