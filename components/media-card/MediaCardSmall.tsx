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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Trash2, PlayCircle, Tv, FileText, Tag, MessageSquare, ChevronDown, Calendar } from "lucide-react";
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
    // New handlers
    handleRatingChange,
    handleSeasonRatingChange,
    handlePriorityChange,
    handleNotesChange,
    handleSeasonNotesChange,
    handleTagsChange,
    handleDatesChange,
    handleSeasonDatesChange,
    activeTab,
    setActiveTab,
    // NEW loading flags
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
  } = props;

  const { media, status, rating, priority: itemPriority, tags, startedAt, finishedAt, notes, _creationTime } = listItem;

  const [showAllProviders, setShowAllProviders] = useState(false);
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

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
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
          {/* HEADER: Title + Delete */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${config.titleSize} font-semibold leading-tight line-clamp-2`}>
                {media.title}
              </CardTitle>
              {/* Meta info with dot separators */}
              <div className={`${config.textSize} text-muted-foreground/70 mt-0.5`}>
                {buildMetaInfo()}
              </div>
            </div>
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
              <div
                className="flex items-center gap-2"
                title="Watch Providers"
              >
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

          {/* ROW 3.5: Date (Watched for movies, Started for shows) */}
          {(media.type === "movie" && finishedAt) || (media.type === "tv" && startedAt) ? (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              title={media.type === "movie" ? "Finished Date" : "Started Date"}
            >
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {formatDate(media.type === "movie" ? finishedAt : startedAt)}
              </span>
            </div>
          ) : null}

          {/* ROW 4: Tags */}
          {tags && tags.length > 0 && (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              title="Tags"
            >
              <Tag className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
                {tags.length > 3 && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    +{tags.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* ROW 5: Notes preview */}
          {notes && (
            <div
              className="flex items-start gap-2 text-sm text-muted-foreground"
              title="Notes"
            >
              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2 italic text-muted-foreground/80">
                {notes}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TABBED BODY (TV shows only) */}
      {media.type === "tv" && (
        <CardContent className="pt-4 pb-2 px-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/50 p-0.5 rounded-md">
              <TabsTrigger
                value="seasons"
                className="text-xs gap-1.5 rounded data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Tv className="h-3.5 w-3.5" />
                Seasons
              </TabsTrigger>
              <TabsTrigger
                value="tracking"
                className="text-xs gap-1.5 rounded data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <FileText className="h-3.5 w-3.5" />
                Show Info
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seasons" className="mt-3">
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
                isUpdatingSeasonStatus={isUpdatingSeasonStatus}
                isUpdatingSeasonRating={isUpdatingSeasonRating}
                isUpdatingSeasonNotes={isUpdatingSeasonNotes}
                isUpdatingSeasonDates={isUpdatingSeasonDates}
              />
            </TabsContent>

            <TabsContent value="tracking" className="mt-3">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      )}

      {/* MOVIES: Just show Movie Info form inline (no seasons) */}
      {media.type === "movie" && (
        <CardContent className="pt-0 pb-2 px-3">
          <details className="group pt-2">
            <summary className="list-none bg-muted rounded-lg p-0.5 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-all text-muted-foreground hover:text-foreground group-open:bg-background group-open:text-foreground group-open:shadow-sm">
                <FileText className="h-3.5 w-3.5" />
                <span>Movie Info</span>
                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180 opacity-50 group-open:opacity-100" />
              </div>
            </summary>
            <div className="pt-3 pb-1 mt-2">
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
            </div>
          </details>
        </CardContent>
      )}

      {/* FOOTER: Added date */}
      <div className="px-3 pb-2 text-right">
        <span className="text-[10px] text-muted-foreground/50">
          Added {formatAddedDate(_creationTime)}
        </span>
      </div>
    </Card>
  );
}
