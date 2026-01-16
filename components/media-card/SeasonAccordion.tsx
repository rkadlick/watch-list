"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import { Star } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { StatusMenu } from "./StatusMenu";
import { SeasonEditForm } from "./SeasonEditForm";
import { statusColors, SeasonProgress, StatusValue } from "./types";
import { cn } from "@/lib/utils";

interface SeasonAccordionProps {
  canEdit: boolean;
  showSeasons: boolean;
  setShowSeasons: (val: boolean) => void;
  openSeason: string | undefined;
  setOpenSeason: (val: string | undefined) => void;
  media: {
    seasonData?: Array<{
      seasonNumber: number;
      episodeCount: number;
      airDate?: string;
    }>;
  };
  listItem: {
    seasonProgress?: SeasonProgress[];
  };
  config: {
    textSize: string;
    iconSize: string;
  };
  handleSeasonStatusChange: (seasonNumber: number, status: StatusValue) => void;
  getSeasonStatus: (seasonNumber: number) => StatusValue;
  getSeasonProgress: (seasonNumber: number) => SeasonProgress | undefined;
  formatDate: (timestamp?: number) => string | null;
  // New handlers
  handleSeasonRatingChange: (seasonNumber: number, rating: number | undefined) => Promise<void>;
  handleSeasonNotesChange: (seasonNumber: number, notes: string) => Promise<void>;
  handleSeasonDatesChange: (seasonNumber: number, startedAt?: number, finishedAt?: number) => Promise<void>;
}

// Star Rating Picker Component
function StarRatingPicker({
  value,
  onChange,
}: {
  value?: number;
  onChange: (rating: number | undefined) => void;
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayRating = hoverRating ?? value;

  const handleClick = (rating: number) => {
    if (rating === value) {
      onChange(undefined);
    } else {
      onChange(rating);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
          <button
            key={rating}
            className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
            onMouseEnter={() => setHoverRating(rating)}
            onMouseLeave={() => setHoverRating(null)}
            onClick={() => handleClick(rating)}
          >
            <Star
              className={cn(
                "h-5 w-5",
                displayRating && rating <= displayRating
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hoverRating
            ? `${hoverRating}/10`
            : value
              ? `${value}/10`
              : "Not rated"}
        </span>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => onChange(undefined)}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export function SeasonAccordion({
  canEdit,
  openSeason,
  setOpenSeason,
  media,
  config,
  handleSeasonStatusChange,
  getSeasonStatus,
  getSeasonProgress,
  handleSeasonRatingChange,
  handleSeasonNotesChange,
  handleSeasonDatesChange,
}: SeasonAccordionProps) {
  if (!media.seasonData?.length) {
    return (
      <div className={`${config.textSize} text-muted-foreground py-2`}>
        No season data available
      </div>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      value={openSeason}
      onValueChange={setOpenSeason}
    >
      {media.seasonData.map((season) => {
        const seasonStatus = getSeasonStatus(season.seasonNumber);
        const seasonProgress = getSeasonProgress(season.seasonNumber);
        const seasonKey = `season-${season.seasonNumber}`;

        return (
          <AccordionItem key={seasonKey} value={seasonKey} className="border-b border-border/50">
            <div className="flex items-center justify-between pr-2">
              {/* Left Side: Accordion Trigger */}
              <AccordionTrigger className="hover:no-underline flex-1 py-2">
                <span className="font-medium text-sm">Season {season.seasonNumber}</span>
              </AccordionTrigger>

              {/* Right Side: Status + Rating Popover (separate from trigger) */}
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {canEdit && (
                <StatusMenu
                  value={seasonStatus}
                  onChange={(v) => handleSeasonStatusChange(season.seasonNumber, v)}
                  options={[
                    {
                      value: "to_watch",
                      label: "To Watch",
                      accent: statusColors.to_watch,
                    },
                    {
                      value: "watching",
                      label: "Watching",
                      accent: statusColors.watching,
                    },
                    {
                      value: "watched",
                      label: "Watched",
                      accent: statusColors.watched,
                    },
                    {
                      value: "dropped",
                      label: "Dropped",
                      accent: statusColors.dropped,
                    },
                  ]}
                />
                )}
                {/* Rating Popover */}
                {canEdit && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors cursor-pointer",
                        "hover:bg-accent/50",
                        seasonProgress?.rating
                          ? "text-amber-500"
                          : "text-muted-foreground/50 hover:text-amber-500"
                      )}
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          seasonProgress?.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-none"
                        )}
                      />
                      {seasonProgress?.rating && (
                        <span className="text-xs tabular-nums">{seasonProgress.rating}</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <StarRatingPicker
                      value={seasonProgress?.rating}
                      onChange={(rating) =>
                        handleSeasonRatingChange(season.seasonNumber, rating)
                      }
                    />
                  </PopoverContent>
                </Popover>
                )}
              </div>
            </div>

            <AccordionContent className="pb-3">
              <SeasonEditForm
                canEdit={canEdit}
                seasonNumber={season.seasonNumber}
                episodeCount={season.episodeCount}
                airDate={season.airDate}
                notes={seasonProgress?.notes}
                startedAt={seasonProgress?.startedAt}
                finishedAt={seasonProgress?.finishedAt}
                onNotesChange={(notes) =>
                  handleSeasonNotesChange(season.seasonNumber, notes)
                }
                onDatesChange={(startedAt, finishedAt) =>
                  handleSeasonDatesChange(season.seasonNumber, startedAt, finishedAt)
                }
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
