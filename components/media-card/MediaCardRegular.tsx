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
import { Trash2, Calendar, Star, Tag, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { RatingCircle } from "./RatingCircle";
import { StatusMenu } from "./StatusMenu";
import { SeasonAccordion } from "./SeasonAccordion";
import { MediaCardProps, StatusValue, statusColors, statusLabels } from "./types";

interface MediaCardRegularProps extends MediaCardProps {
  handleStatusChange: (status: StatusValue) => Promise<void>;
  handleDelete: () => Promise<void>;
  showSeasons: boolean;
  setShowSeasons: (b: boolean) => void;
  openSeason: string | undefined;
  setOpenSeason: (v: string | undefined) => void;
  handleSeasonStatusChange: (seasonNumber: number, status: StatusValue) => Promise<void>;
  getSeasonStatus: (seasonNumber: number) => string;
  formatDate: (timestamp?: number) => string | null;
}

export function MediaCardRegular(props: MediaCardRegularProps) {
  const {
    listItem,
    size = "normal",
    handleStatusChange,
    handleDelete,
    showSeasons,
    setShowSeasons,
    openSeason,
    setOpenSeason,
    handleSeasonStatusChange,
    getSeasonStatus,
    formatDate,
  } = props;

  const { media, status, rating, priority, tags, startedAt, finishedAt, notes } = listItem;
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

  const priorityColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className={`flex ${config.gap} p-4`}>
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
              sizes={size === "large" ? "160px" : "120px"}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${config.titleSize} font-semibold leading-tight line-clamp-2`}>
                {media.title}
              </CardTitle>
              <div
                className={`flex items-center gap-2 mt-1 flex-wrap ${config.textSize} text-muted-foreground`}
              >
                {media.releaseDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className={config.iconSize} />
                    {new Date(media.releaseDate).getFullYear()}
                  </div>
                )}
                {media.type === "tv" && media.totalSeasons && (
                  <div>
                    {media.totalSeasons} Season{media.totalSeasons !== 1 ? "s" : ""}
                    {media.totalEpisodes && ` • ${media.totalEpisodes} Episodes`}
                  </div>
                )}
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${size === "large" ? "h-8 w-8" : "h-7 w-7"} text-muted-foreground hover:text-red-600 flex-shrink-0 cursor-pointer`}
                >
                  <Trash2 className={size === "large" ? "h-5 w-5" : "h-4 w-4"} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from list?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove “{media.title}”? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className={`flex flex-col ${config.gap}`}>
            <div className="flex items-center gap-2 flex-wrap">
              {media.type === "movie" ? (
                <StatusMenu
                  value={status}
                  onChange={handleStatusChange}
                  options={Object.entries(statusLabels).map(([value, label]) => ({
                    value: value as StatusValue,
                    label,
                    accent: statusColors[value as StatusValue],
                  }))}
                />
              ) : (
                <Badge className={`${statusColors[status]} ${config.badgeSize}`}>
                  {statusLabels[status]}
                </Badge>
              )}

              {rating && (
                <div className="flex items-center gap-1">
                  <Star className={`${config.iconSize} fill-yellow-400 text-yellow-400`} />
                  <span className={config.textSize}>{rating}/10</span>
                </div>
              )}

              {media.voteAverage && <RatingCircle score={media.voteAverage} size={size === "large" ? 48 : 40} />}

              {priority && (
                <Badge
                  variant="outline"
                  className={`${config.badgeSize} ${priorityColors[priority]}`}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Badge>
              )}
            </div>

            {/* Genres */}
            {media.genres && media.genres.length > 0 && (
              <div className={`${config.textSize} text-muted-foreground`}>
                {media.genres.slice(0, size === "large" ? 6 : 4).map((genre, i) => (
                  <span key={genre.id}>
                    {genre.name}
                    {i < Math.min(media.genres?.length ?? 0, size === "large" ? 6 : 4) - 1 && ", "}
                  </span>
                ))}
                {media.genres.length > (size === "large" ? 6 : 4) && (
                  <span> +{media.genres.length - (size === "large" ? 6 : 4)} more</span>
                )}
              </div>
            )}

            {/* Providers */}
            {media.watchProviders && (
              <div className="flex flex-col gap-0">
                {media.watchProviders
                  .sort((a, b) => a.displayPriority - b.displayPriority)
                  .slice(0, size === "large" ? 5 : 4)
                  .map((provider, i) => (
                    <div
                      key={provider.providerId}
                      className="flex items-center gap-2 pb-1 border-b border-muted last:border-b-0"
                    >
                      {i === 0 && (
                        <div className="rounded-full bg-muted p-1 flex items-center justify-center w-6 h-6">
                          <PlayCircle className={`${config.iconSize} text-muted-foreground`} />
                        </div>
                      )}
                      {i > 0 && <div className="w-7" />}
                      <span className={`${config.textSize} text-muted-foreground`}>
                        {provider.providerName}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className={`${config.iconSize} text-muted-foreground`} />
                <div className="flex flex-wrap gap-1">
                  {tags.slice(0, size === "large" ? 5 : 4).map((tag, i) => (
                    <Badge key={i} variant="outline" className={`${config.badgeSize} px-1.5 py-0`}>
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > (size === "large" ? 5 : 4) && (
                    <Badge variant="outline" className={`${config.badgeSize} px-1.5 py-0`}>
                      +{tags.length - (size === "large" ? 5 : 4)}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {(startedAt || finishedAt) && (
              <div className={`flex items-center gap-2 ${config.textSize} text-muted-foreground`}>
                {startedAt && <div>Started: {formatDate(startedAt)}</div>}
                {finishedAt && <div>Finished: {formatDate(finishedAt)}</div>}
              </div>
            )}

            {notes && (
              <div
                className={`${config.textSize} text-muted-foreground ${
                  size === "large" ? "line-clamp-4" : "line-clamp-3"
                }`}
              >
                {notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seasons (TV-only) */}
      {media.type === "tv" && (
        <CardContent className="pt-0 pb-3 px-3">
          <SeasonAccordion
            showSeasons={showSeasons}
            setShowSeasons={setShowSeasons}
            openSeason={openSeason}
            setOpenSeason={setOpenSeason}
            media={media}
            listItem={listItem}
            config={config}
            handleSeasonStatusChange={handleSeasonStatusChange}
            getSeasonStatus={getSeasonStatus}
            formatDate={formatDate}
          />
        </CardContent>
      )}
    </Card>
  );
}