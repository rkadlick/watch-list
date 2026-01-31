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
import { Trash2, PlayCircle, Tv, FileText, ChevronDown, Calendar } from "lucide-react";
import { RatingCircle } from "./RatingCircle";
import { StatusMenu } from "./StatusMenu";
import { SeasonAccordion } from "./SeasonAccordion";
import { UserRatingPopover } from "./UserRatingPopover";
import { PrioritySelector } from "./PrioritySelector";
import { TrackingForm } from "./TrackingForm";
import { MediaCardProps, MediaCardInnerProps, StatusValue, statusColors, statusLabels } from "./types";
import { getMediaBlurPlaceholder } from "@/lib/image-utils";

interface MediaCardRegularComponentProps extends MediaCardInnerProps {
  size?: MediaCardProps["size"];
  priority?: boolean; // For priority loading
}

export function MediaCardRegular(props: MediaCardRegularComponentProps) {
  const {
    listItem,
    canEdit,
    size = "normal",
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
  if (!media) return null;

  const config =
    size === "large"
      ? {
        titleSize: "text-xl",
        textSize: "text-base",
        gap: "gap-4",
        iconSize: "h-5 w-5",
        badgeSize: "text-base",
      }
      : {
        titleSize: "text-lg",
        textSize: "text-sm",
        gap: "gap-3",
        iconSize: "h-4 w-4",
        badgeSize: "text-sm",
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
          month: "long",
          day: "numeric",
          year: "numeric",
        }));
      } else {
        parts.push(new Date(media.releaseDate).getFullYear().toString());
      }
    }
    if (media.type === "tv" && media.totalSeasons) {
      parts.push(`${media.totalSeasons} Season${media.totalSeasons !== 1 ? "s" : ""}`);
      if (media.totalEpisodes) {
        parts.push(`${media.totalEpisodes} Episodes`);
      }
    }
    return parts.join(" • ");
  };

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <div className={`flex ${config.gap} p-4 flex-1`}>
        {media.posterUrl && (
          <div
            className="relative flex-shrink-0 flex items-center justify-center"
            style={{
              width: size === "large" ? 160 : 120,
              aspectRatio: "2/3",
            }}
          >
            <Image
              src={media.posterUrl}
              alt={media.title}
              fill
              className="object-contain p-2"
              sizes="(max-width: 640px) 100px, (max-width: 1024px) 120px, (max-width: 1536px) 140px, 160px"
              placeholder="blur"
              blurDataURL={getMediaBlurPlaceholder(media.type)}
              priority={priority}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          {/* HEADER: Title + Delete */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${config.titleSize} font-semibold leading-tight line-clamp-2`}>
                {media.title}
              </CardTitle>
              {/* Meta info with dot separators */}
              <div className={`text-sm text-muted-foreground/70 mt-1`}>
                {buildMetaInfo()}
              </div>
            </div>

            {canEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${size === "large" ? "h-8 w-8" : "h-7 w-7"} text-muted-foreground hover:text-red-600 flex-shrink-0 cursor-pointer`}
                    disabled={isDeleting}
                  >
                    <Trash2 className={size === "large" ? "h-5 w-5" : "h-4 w-4"} />
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

          <div className={`flex flex-col ${config.gap}`}>
            {/* HEADER INJECTION: Status + User Rating + TMDB + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              {media.type === "movie" && canEdit ? (
                <StatusMenu
                  value={status}
                  onChange={handleStatusChange}
                  options={Object.entries(statusLabels).map(([value, label]) => ({
                    value: value as StatusValue,
                    label,
                    accent: statusColors[value as StatusValue],
                  }))}
                  disabled={isUpdatingStatus}
                />
              ) : (
                <Badge className={`${statusColors[status]} ${config.badgeSize}`}>
                  {statusLabels[status]}
                </Badge>
              )}

              {/* User Rating (clickable star) */}
              {canEdit && (
                <UserRatingPopover
                  rating={rating}
                  onRatingChange={handleRatingChange}
                  size={size === "large" ? "md" : "sm"}
                  disabled={isUpdatingRating}
                />
              )}

              {/* TMDB Score */}
              {media.voteAverage && <RatingCircle score={media.voteAverage} size={size === "large" ? 44 : 36} />}

              {/* Priority (clickable selector) */}
              {canEdit && (
                <PrioritySelector
                  priority={itemPriority}
                  onPriorityChange={handlePriorityChange}
                  size={size === "large" ? "md" : "sm"}
                  disabled={isUpdatingPriority}
                />
              )}
            </div>

            {/* Genres - dot separated */}
            {media.genres && media.genres.length > 0 && (
              <div
                className={`${config.textSize} text-muted-foreground/70`}
                title={`Genres: ${media.genres.map(g => g.name).join(", ")}`}
              >
                {media.genres.slice(0, size === "large" ? 6 : 4).map(g => g.name).join(" • ")}
                {media.genres.length > (size === "large" ? 6 : 4) && (
                  <span> +{media.genres.length - (size === "large" ? 6 : 4)}</span>
                )}
              </div>
            )}

            {/* Providers - cleaner inline layout */}
            {media.watchProviders && media.watchProviders.length > 0 && (
              <div
                className={`${config.textSize} text-muted-foreground/70 flex items-center gap-1.5`}
                title="Watch Providers"
              >
                <PlayCircle className={config.iconSize} />
                <span>
                  {media.watchProviders
                    .sort((a, b) => a.displayPriority - b.displayPriority)
                    // Deduplicate and normalize providers
                    .reduce((acc, p) => {
                      // Remove suffixes like "Standard with Ads", "with Ads"
                      const normalized = p.providerName
                        .replace(/\s+Standard(\s+with\s+Ads)?$/i, "")
                        .replace(/\s+with\s+Ads$/i, "")
                        .trim();

                      // Only add if not already present (checking normalized name)
                      if (!acc.some(exist => exist.normalizedName === normalized)) {
                        acc.push({ ...p, normalizedName: normalized });
                      }
                      return acc;
                    }, [] as any[])
                    .slice(0, size === "large" ? 4 : 3)
                    .map((p) => p.normalizedName)
                    .join(", ")}
                  {media.watchProviders.length > (size === "large" ? 4 : 3) && (
                    <span className="ml-1">+{media.watchProviders.length - (size === "large" ? 4 : 3)}</span>
                  )}
                </span>
              </div>
            )}

            {/* Date (Watched for movies, Started for shows) */}
            {(media.type === "movie" && finishedAt) || (media.type === "tv" && startedAt) ? (
              <div
                className={`${config.textSize} text-muted-foreground/70 flex items-center gap-1.5`}
                title={media.type === "movie" ? "Finished Date" : "Started Date"}
              >
                <Calendar className={config.iconSize} />
                <span>
                  {formatDate(media.type === "movie" ? finishedAt : startedAt)}
                </span>
              </div>
            ) : null}

            {/* Tags - dot separated */}
            {tags && tags.length > 0 && (
              <div
                className={`${config.textSize} text-muted-foreground/70`}
                title={`Tags: ${tags.join(", ")}`}
              >
                {tags.slice(0, size === "large" ? 5 : 4).join(" • ")}
                {tags.length > (size === "large" ? 5 : 4) && ` +${tags.length - (size === "large" ? 5 : 4)}`}
              </div>
            )}

            {/* Notes preview */}
            {notes && (
              <div
                className={`${config.textSize} text-muted-foreground/60 italic ${size === "large" ? "line-clamp-3" : "line-clamp-2"
                  }`}
                title="Notes"
              >
                &ldquo;{notes}&rdquo;
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABBED BODY (TV shows only) */}
      {media.type === "tv" && (
        <CardContent className="pt-0 pb-3 px-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="seasons" className="text-sm gap-1.5">
                <Tv className="h-3.5 w-3.5" />
                Seasons
              </TabsTrigger>
              <TabsTrigger value="tracking" className="text-sm gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Show Info
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seasons" className="mt-2">
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

            <TabsContent value="tracking" className="mt-2">
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
        <CardContent className="pt-0 pb-3 px-3">
          <details className="group border-t border-border/50 pt-3">
            <summary className="list-none bg-muted rounded-lg p-1 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-all text-muted-foreground hover:text-foreground group-open:bg-background group-open:text-foreground group-open:shadow-sm">
                <FileText className="h-4 w-4" />
                <span>Movie Info</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 opacity-50 group-open:opacity-100" />
              </div>
            </summary>
            <div className="pt-3 pb-1 border-t border-border/30 mt-2">
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
      <div className="px-4 pb-3 text-right">
        <span className="text-xs text-muted-foreground/50">
          Added {formatAddedDate(_creationTime)}
        </span>
      </div>
    </Card>
  );
}
