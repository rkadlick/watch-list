"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
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
import { Button } from "@/components/ui/Button";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Trash2, ChevronDown, ChevronUp, Star, Calendar, Tag, PlayCircle } from "lucide-react";
import Image from "next/image";

type CardSize = "small" | "normal" | "large";

interface MediaCardProps {
  size?: CardSize;
  listItem: {
    _id: Id<"listItems">;
    status: "to_watch" | "watching" | "watched" | "dropped";
    rating?: number;
    notes?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    startedAt?: number;
    finishedAt?: number;
    seasonProgress?: Array<{
      seasonNumber: number;
      status: "to_watch" | "watching" | "watched" | "dropped";
      rating?: number;
      notes?: string;
      startedAt?: number;
      finishedAt?: number;
    }>;
    media: {
      _id: Id<"media">;
      type: "movie" | "tv";
      title: string;
      posterUrl?: string;
      releaseDate?: string;
      genres?: Array<{ id: number; name: string }>;
      watchProviders?: Array<{
        providerId: number;
        providerName: string;
        logoPath?: string;
        displayPriority: number;
      }>;
      voteAverage?: number;
      totalSeasons?: number;
      totalEpisodes?: number;
      seasonData?: Array<{
        seasonNumber: number;
        episodeCount: number;
        airDate?: string;
      }>;
    } | null;
  };
}

const statusLabels = {
  to_watch: "To Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

const statusColors = {
  to_watch: "bg-gray-100 text-gray-800",
  watching: "bg-blue-100 text-blue-800",
  watched: "bg-green-100 text-green-800",
  dropped: "bg-red-100 text-red-800",
};

const seasonStatusLabels = {
  to_watch: "To Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

type StatusValue = "to_watch" | "watching" | "watched" | "dropped";
type SeasonStatusValue = "to_watch" | "watching" | "watched" | "dropped";

interface StatusMenuProps<T extends string> {
  value: T;
  options: { value: T; label: string; accent: string }[];
  onChange: (value: T) => void;
  showArrow?: boolean;
}

function StatusMenu<T extends string>({ value, options, onChange, showArrow = true }: StatusMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keyup", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keyup", handleEscape);
    };
  }, []);

  const active = options.find((opt) => opt.value === value);

  if (!showArrow) {
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active?.accent} cursor-default`}>
        {active?.label ?? "Status"}
      </span>
    );
  }

  return (
    <div 
      className="relative inline-block" 
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors flex items-center gap-1 ${active?.accent} cursor-pointer`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span>{active?.label ?? "Status"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute z-[100] mt-2 w-40 rounded-lg border bg-card shadow-lg">
          <ul className="py-1 text-sm">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/60 ${
                    opt.value === value ? "text-primary font-semibold" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && <span className="text-xs">•</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreCircle({ score, maxScore = 10, size = 40 }: { score: number; maxScore?: number; size?: number }) {
  const percentage = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  let color = "text-green-600";
  let strokeColor = "stroke-green-600";
  if (score < 4) {
    color = "text-red-600";
    strokeColor = "stroke-red-600";
  } else if (score < 7) {
    color = "text-yellow-600";
    strokeColor = "stroke-yellow-600";
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={strokeColor}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <span className={`absolute text-xs font-semibold ${color}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export function MediaCard({ listItem, size = "small" }: MediaCardProps) {
  const { media, status, rating, notes, priority, tags, startedAt, finishedAt, seasonProgress } = listItem;
  const updateStatus = useMutation(api.listItems.updateStatus);
  const updateSeasonStatus = useMutation(api.listItems.updateSeasonStatus);
  const deleteListItem = useMutation(api.listItems.deleteListItem);
  const [showSeasons, setShowSeasons] = useState(false);
  const [openSeason, setOpenSeason] = useState<string | undefined>(undefined);

  if (!media) {
    return null;
  }

  const getSeasonStatus = (seasonNumber: number): "to_watch" | "watching" | "watched" | "dropped" => {
    const progress = seasonProgress?.find((p) => p.seasonNumber === seasonNumber);
    if (progress?.status === "watched") return "watched";
    if (progress?.status === "watching") return "watching";
    if (progress?.status === "dropped") return "dropped";
    return "to_watch";
  };

  const handleStatusChange = async (newStatus: "to_watch" | "watching" | "watched" | "dropped") => {
    try {
      await updateStatus({
        listItemId: listItem._id,
        status: newStatus,
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleSeasonStatusChange = async (
    seasonNumber: number,
    newStatus: "to_watch" | "watching" | "watched" | "dropped"
  ) => {
    try {
      await updateSeasonStatus({
        listItemId: listItem._id,
        seasonNumber,
        status: newStatus,
      });
    } catch (error) {
      console.error("Error updating season status:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteListItem({
        listItemId: listItem._id,
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item. Please try again.");
    }
  };

  const priorityColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Size configurations
  const sizeConfig = {
    small: {
      posterWidth: "w-20",
      posterHeight: "h-28",
      titleSize: "text-base",
      gap: "gap-2",
      padding: "p-3",
      textSize: "text-xs",
      iconSize: "h-3 w-3",
      badgeSize: "text-xs",
    },
    normal: {
      posterWidth: "w-32",
      posterHeight: "h-44",
      posterMaxHeight: "max-h-48",
      titleSize: "text-lg",
      gap: "gap-3",
      padding: "p-4",
      textSize: "text-sm",
      iconSize: "h-4 w-4",
      badgeSize: "text-sm",
    },
    large: {
      posterWidth: "w-40",
      posterHeight: "h-56",
      posterMaxHeight: "max-h-64",
      titleSize: "text-xl",
      gap: "gap-4",
      padding: "p-5",
      textSize: "text-base",
      iconSize: "h-5 w-5",
      badgeSize: "text-base",
    },
  };

  const config = sizeConfig[size];

  // Render small card (current compact layout)
  if (size === "small") {
  return (
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className={`flex ${config.gap} ${config.padding}`}>
          {/* Compact poster thumbnail */}
      {media.posterUrl && (
            <div className={`relative flex-shrink-0 ${config.posterWidth} ${config.posterHeight} rounded overflow-hidden`}>
          <Image
            src={media.posterUrl}
            alt={media.title}
            fill
            className="object-cover"
                sizes="80px"
          />
        </div>
      )}
          
          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Header with title and delete */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className={`${config.titleSize} font-semibold leading-tight line-clamp-2`}>
                  {media.title}
                </CardTitle>
                <div className={`flex items-center gap-2 mt-1 flex-wrap ${config.textSize} text-muted-foreground`}>
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
                    className="h-6 w-6 text-muted-foreground hover:text-red-600 flex-shrink-0"
              >
                    <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from list?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove "{media.title}" from this list? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

          {/* Status and ratings */}
          <div className={`flex items-center gap-2 flex-wrap`}>
        {media.type === "movie" ? (
              <StatusMenu<StatusValue>
                value={status}
                onChange={handleStatusChange}
                options={[
                  { value: "to_watch", label: "To Watch", accent: statusColors.to_watch },
                  { value: "watching", label: "Watching", accent: statusColors.watching },
                  { value: "watched", label: "Watched", accent: statusColors.watched },
                  { value: "dropped", label: "Dropped", accent: statusColors.dropped },
                ]}
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
            {media.voteAverage && (
              <ScoreCircle score={media.voteAverage} size={size === "small" ? 32 : 40} />
            )}
            {priority && (
              <Badge variant="outline" className={`${config.badgeSize} ${priorityColors[priority]}`}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </Badge>
            )}
          </div>

          {/* Genres - text list */}
          {media.genres && media.genres.length > 0 && (
            <div className={`${config.textSize} text-muted-foreground`}>
              {media.genres.slice(0, size === "small" ? 3 : size === "normal" ? 4 : 6).map((genre, idx) => (
                <span key={genre.id}>
                  {genre.name}
                  {idx < Math.min(media.genres!.length, size === "small" ? 3 : size === "normal" ? 4 : 6) - 1 && ", "}
                </span>
              ))}
              {media.genres.length > (size === "small" ? 3 : size === "normal" ? 4 : 6) && (
                <span> +{media.genres.length - (size === "small" ? 3 : size === "normal" ? 4 : 6)} more</span>
              )}
            </div>
          )}

          {/* Watch providers - list format */}
          {media.watchProviders && media.watchProviders.length > 0 && (
            <div className="flex flex-col gap-0">
              {media.watchProviders
                .sort((a, b) => a.displayPriority - b.displayPriority)
                .slice(0, size === "small" ? 3 : size === "normal" ? 4 : 5)
                .map((provider, idx) => (
                  <div key={provider.providerId} className="flex items-center gap-2 pb-1 border-b border-muted last:border-b-0">
                    {idx === 0 && (
                      <div className="flex-shrink-0">
                        <div className="rounded-full bg-muted p-1 flex items-center justify-center" style={{ width: size === "small" ? "20px" : "24px", height: size === "small" ? "20px" : "24px" }}>
                          <PlayCircle className={`${config.iconSize} text-muted-foreground`} />
                        </div>
                      </div>
                    )}
                    {idx > 0 && <div className="w-6" />}
                    <span className={`${config.textSize} text-muted-foreground`}>
                      {provider.providerName}
                    </span>
                  </div>
                ))}
              {media.watchProviders.length > (size === "small" ? 3 : size === "normal" ? 4 : 5) && (
                <div className={`${config.textSize} text-muted-foreground pt-1`}>
                  +{media.watchProviders.length - (size === "small" ? 3 : size === "normal" ? 4 : 5)} more
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className={`${config.iconSize} text-muted-foreground flex-shrink-0`} />
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, size === "small" ? 3 : size === "normal" ? 4 : 5).map((tag, idx) => (
                  <Badge key={idx} variant="outline" className={`${config.badgeSize} px-1.5 py-0`}>
                    {tag}
                  </Badge>
                ))}
                {tags.length > (size === "small" ? 3 : size === "normal" ? 4 : 5) && (
                  <Badge variant="outline" className={`${config.badgeSize} px-1.5 py-0`}>
                    +{tags.length - (size === "small" ? 3 : size === "normal" ? 4 : 5)}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Dates */}
          {(startedAt || finishedAt) && (
            <div className={`flex items-center gap-2 ${config.textSize} text-muted-foreground`}>
              {startedAt && (
                <div>Started: {formatDate(startedAt)}</div>
              )}
              {finishedAt && (
                <div>Finished: {formatDate(finishedAt)}</div>
              )}
            </div>
          )}

          {/* Notes preview */}
          {notes && (
            <div className={`${config.textSize} text-muted-foreground ${size === "small" ? "line-clamp-2" : size === "normal" ? "line-clamp-3" : "line-clamp-4"}`}>
              {notes}
          </div>
          )}

          {/* TV Show seasons toggle */}
          {media.type === "tv" && media.seasonData && media.seasonData.length > 0 && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size={size === "small" ? "sm" : "default"}
                onClick={() => setShowSeasons(!showSeasons)}
                className={size === "small" ? "h-7 text-xs px-2" : ""}
              >
                <span>{showSeasons ? "Hide" : "Show"} Seasons</span>
                {showSeasons ? (
                  <ChevronUp className={`${config.iconSize} ml-1`} />
                ) : (
                  <ChevronDown className={`${config.iconSize} ml-1`} />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Seasons accordion (expanded below card - full width) */}
      {showSeasons && media.type === "tv" && media.seasonData && media.seasonData.length > 0 && (
        <CardContent className="pt-0 pb-3 px-3 border-t">
              <Accordion type="single" collapsible className="w-full" value={openSeason} onValueChange={setOpenSeason}>
                {media.seasonData.map((season) => {
                  const seasonStatus = getSeasonStatus(season.seasonNumber);
              const seasonProgress = listItem.seasonProgress?.find((p) => p.seasonNumber === season.seasonNumber);
                  const seasonKey = `season-${season.seasonNumber}`;
                  const isOpen = openSeason === seasonKey;
                  return (
                <AccordionItem key={season.seasonNumber} value={seasonKey} className="relative">
                  <div className="flex items-center justify-between gap-2 py-2">
                    {/* AREA 1: The Trigger (Text only) */}
                    <AccordionTrigger className={`${config.textSize} flex-1 hover:no-underline py-0 cursor-pointer`}>
                      <span className="font-medium">Season {season.seasonNumber}</span>
                    </AccordionTrigger>
                    
                    {/* AREA 2: The Action (The Dropdown and Rating) */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isOpen ? (
                        <StatusMenu<SeasonStatusValue>
                          value={seasonStatus}
                          onChange={(value) =>
                            handleSeasonStatusChange(
                              season.seasonNumber,
                              value as SeasonStatusValue
                            )
                          }
                          options={[
                            { value: "to_watch", label: "To Watch", accent: statusColors.to_watch },
                            { value: "watching", label: "Watching", accent: statusColors.watching },
                            { value: "watched", label: "Watched", accent: statusColors.watched },
                            { value: "dropped", label: "Dropped", accent: statusColors.dropped },
                          ]}
                          showArrow={true}
                        />
                      ) : (
                        <StatusMenu<SeasonStatusValue>
                          value={seasonStatus}
                          onChange={(value) =>
                            handleSeasonStatusChange(
                              season.seasonNumber,
                              value as SeasonStatusValue
                            )
                          }
                          options={[
                            { value: "to_watch", label: "To Watch", accent: statusColors.to_watch },
                            { value: "watching", label: "Watching", accent: statusColors.watching },
                            { value: "watched", label: "Watched", accent: statusColors.watched },
                            { value: "dropped", label: "Dropped", accent: statusColors.dropped },
                          ]}
                          showArrow={false}
                        />
                      )}
                      {seasonProgress?.rating && (
                        <div className="flex items-center gap-1">
                          <Star className={`${config.iconSize} fill-yellow-400 text-yellow-400`} />
                          <span className={config.textSize}>{seasonProgress.rating}/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                      <AccordionContent>
                    <div className={`${config.textSize} text-muted-foreground space-y-2`}>
                          <div className="space-y-1">
                            <div>
                              <strong>Episodes:</strong> {season.episodeCount}
                            </div>
                            {season.airDate && (
                              <div>
                                <strong>Air Date:</strong>{" "}
                                {new Date(season.airDate).toLocaleDateString()}
                              </div>
                            )}
                        {seasonProgress?.startedAt && (
                          <div>
                            <strong>Started:</strong> {formatDate(seasonProgress.startedAt)}
                          </div>
                        )}
                        {seasonProgress?.finishedAt && (
                          <div>
                            <strong>Finished:</strong> {formatDate(seasonProgress.finishedAt)}
                          </div>
                        )}
                        {seasonProgress?.notes && (
                          <div>
                            <strong>Notes:</strong> {seasonProgress.notes}
                          </div>
                        )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
        </CardContent>
      )}
    </Card>
    );
  }

  // Render normal and large cards (horizontal layout with poster on left)
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className={`flex ${config.gap} ${config.padding}`}>
        {/* Poster on left - showing full image */}
        {media.posterUrl && (
          <div className={`relative flex-shrink-0 flex items-center justify-center`} style={{ 
            width: size === "normal" ? "120px" : "160px",
            aspectRatio: '2/3'
          }}>
            <Image
              src={media.posterUrl}
              alt={media.title}
              fill
              className="object-contain p-2"
              sizes={size === "normal" ? "120px" : "160px"}
            />
          </div>
        )}
        
        {/* Content on right */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header with title and delete */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${config.titleSize} font-semibold leading-tight line-clamp-2`}>
                {media.title}
              </CardTitle>
              <div className={`flex items-center gap-2 mt-1 flex-wrap ${config.textSize} text-muted-foreground`}>
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
                  className={`${size === "normal" ? "h-7 w-7" : "h-8 w-8"} text-muted-foreground hover:text-red-600 flex-shrink-0`}
                >
                  <Trash2 className={size === "normal" ? "h-4 w-4" : "h-5 w-5"} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from list?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove "{media.title}" from this list? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Content sections alongside image */}
          <div className={`flex flex-col ${config.gap} flex-1`}>
            {/* Status and ratings */}
            <div className={`flex items-center gap-2 flex-wrap`}>
              {media.type === "movie" ? (
                <StatusMenu<StatusValue>
                  value={status}
                  onChange={handleStatusChange}
                  options={[
                    { value: "to_watch", label: "To Watch", accent: statusColors.to_watch },
                    { value: "watching", label: "Watching", accent: statusColors.watching },
                    { value: "watched", label: "Watched", accent: statusColors.watched },
                    { value: "dropped", label: "Dropped", accent: statusColors.dropped },
                  ]}
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
              {media.voteAverage && (
                <ScoreCircle score={media.voteAverage} size={size === "normal" ? 40 : 48} />
              )}
              {priority && (
                <Badge variant="outline" className={`${config.badgeSize} ${priorityColors[priority]}`}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Badge>
              )}
            </div>

            {/* Genres - text list */}
            {media.genres && media.genres.length > 0 && (
              <div className={`${config.textSize} text-muted-foreground`}>
                {media.genres.slice(0, size === "normal" ? 4 : 6).map((genre, idx) => (
                  <span key={genre.id}>
                    {genre.name}
                    {idx < Math.min(media.genres!.length, size === "normal" ? 4 : 6) - 1 && ", "}
                  </span>
                ))}
                {media.genres.length > (size === "normal" ? 4 : 6) && (
                  <span> +{media.genres.length - (size === "normal" ? 4 : 6)} more</span>
                )}
              </div>
            )}

            {/* Watch providers - list format */}
            {media.watchProviders && media.watchProviders.length > 0 && (
              <div className="flex flex-col gap-0">
                {media.watchProviders
                  .sort((a, b) => a.displayPriority - b.displayPriority)
                  .slice(0, size === "normal" ? 4 : 5)
                  .map((provider, idx) => (
                    <div key={provider.providerId} className="flex items-center gap-2 pb-1 border-b border-muted last:border-b-0">
                      {idx === 0 && (
                        <div className="flex-shrink-0">
                          <div className="rounded-full bg-muted p-1 flex items-center justify-center" style={{ width: size === "normal" ? "24px" : "28px", height: size === "normal" ? "24px" : "28px" }}>
                            <PlayCircle className={`${config.iconSize} text-muted-foreground`} />
                          </div>
                        </div>
                      )}
                      {idx > 0 && <div className="w-7" />}
                      <span className={`${config.textSize} text-muted-foreground`}>
                        {provider.providerName}
                      </span>
                    </div>
                  ))}
                {media.watchProviders.length > (size === "normal" ? 4 : 5) && (
                  <div className={`${config.textSize} text-muted-foreground pt-1`}>
                    +{media.watchProviders.length - (size === "normal" ? 4 : 5)} more
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className={`${config.iconSize} text-muted-foreground flex-shrink-0`} />
                <div className="flex flex-wrap gap-1">
                  {tags.slice(0, size === "normal" ? 4 : 5).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className={`${config.badgeSize} px-1.5 py-0`}>
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > (size === "normal" ? 4 : 5) && (
                    <Badge variant="outline" className={`${config.badgeSize} px-1.5 py-0`}>
                      +{tags.length - (size === "normal" ? 4 : 5)}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Dates */}
            {(startedAt || finishedAt) && (
              <div className={`flex items-center gap-2 ${config.textSize} text-muted-foreground`}>
                {startedAt && (
                  <div>Started: {formatDate(startedAt)}</div>
                )}
                {finishedAt && (
                  <div>Finished: {formatDate(finishedAt)}</div>
                )}
              </div>
            )}

            {/* Notes preview */}
            {notes && (
              <div className={`${config.textSize} text-muted-foreground ${size === "normal" ? "line-clamp-3" : "line-clamp-4"}`}>
                {notes}
              </div>
            )}

            {/* TV Show seasons toggle */}
            {media.type === "tv" && media.seasonData && media.seasonData.length > 0 && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => setShowSeasons(!showSeasons)}
                >
                  <span>{showSeasons ? "Hide" : "Show"} Seasons</span>
                  {showSeasons ? (
                    <ChevronUp className={`${config.iconSize} ml-1`} />
                  ) : (
                    <ChevronDown className={`${config.iconSize} ml-1`} />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seasons accordion (expanded below card - full width) */}
      {showSeasons && media.type === "tv" && media.seasonData && media.seasonData.length > 0 && (
        <CardContent className="pt-0 pb-3 px-3 border-t">
          <Accordion type="single" collapsible className="w-full" value={openSeason} onValueChange={setOpenSeason}>
            {media.seasonData.map((season) => {
              const seasonStatus = getSeasonStatus(season.seasonNumber);
              const seasonProgress = listItem.seasonProgress?.find((p) => p.seasonNumber === season.seasonNumber);
              const seasonKey = `season-${season.seasonNumber}`;
              const isOpen = openSeason === seasonKey;
              return (
                <AccordionItem key={season.seasonNumber} value={seasonKey} className="relative">
                  <div className="flex items-center justify-between gap-2 py-2">
                    {/* AREA 1: The Trigger (Text only) */}
                    <AccordionTrigger className="text-sm flex-1 hover:no-underline py-0">
                      <span className="font-medium">Season {season.seasonNumber}</span>
                    </AccordionTrigger>
                    
                    {/* AREA 2: The Action (The Dropdown and Rating) */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isOpen ? (
                        <StatusMenu<SeasonStatusValue>
                          value={seasonStatus}
                          onChange={(value) =>
                            handleSeasonStatusChange(
                              season.seasonNumber,
                              value as SeasonStatusValue
                            )
                          }
                          options={[
                            { value: "to_watch", label: "To Watch", accent: statusColors.to_watch },
                            { value: "watching", label: "Watching", accent: statusColors.watching },
                            { value: "watched", label: "Watched", accent: statusColors.watched },
                            { value: "dropped", label: "Dropped", accent: statusColors.dropped },
                          ]}
                          showArrow={true}
                        />
                      ) : (
                        <StatusMenu<SeasonStatusValue>
                          value={seasonStatus}
                          onChange={(value) =>
                            handleSeasonStatusChange(
                              season.seasonNumber,
                              value as SeasonStatusValue
                            )
                          }
                          options={[
                            { value: "to_watch", label: "To Watch", accent: statusColors.to_watch },
                            { value: "watching", label: "Watching", accent: statusColors.watching },
                            { value: "watched", label: "Watched", accent: statusColors.watched },
                            { value: "dropped", label: "Dropped", accent: statusColors.dropped },
                          ]}
                          showArrow={false}
                        />
                      )}
                      {seasonProgress?.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{seasonProgress.rating}/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <AccordionContent>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <div className="space-y-1">
                        <div>
                          <strong>Episodes:</strong> {season.episodeCount}
                        </div>
                        {season.airDate && (
                          <div>
                            <strong>Air Date:</strong>{" "}
                            {new Date(season.airDate).toLocaleDateString()}
                          </div>
                        )}
                        {seasonProgress?.startedAt && (
                          <div>
                            <strong>Started:</strong> {formatDate(seasonProgress.startedAt)}
                          </div>
                        )}
                        {seasonProgress?.finishedAt && (
                          <div>
                            <strong>Finished:</strong> {formatDate(seasonProgress.finishedAt)}
                          </div>
                        )}
                        {seasonProgress?.notes && (
                          <div>
                            <strong>Notes:</strong> {seasonProgress.notes}
          </div>
        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
      </CardContent>
      )}
    </Card>
  );
}