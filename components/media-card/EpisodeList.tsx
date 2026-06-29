"use client";

import { Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { EpisodeData } from "./types";
import { isEpisodeUnreleasedInGrid } from "@/lib/tv-episodes";

interface EpisodeListProps {
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
  episodes?: EpisodeData[];
  isCurrentSeason: boolean;
  isWatched: boolean;
  currentEpisodeNumber?: number;
  canEdit: boolean;
  onMarkSeasonWatched: (seasonNumber: number) => void;
  isMarkingSeasonWatched: boolean;
}

function formatAirDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function EpisodeList({
  seasonNumber,
  episodeCount,
  airDate,
  episodes,
  isCurrentSeason,
  isWatched,
  currentEpisodeNumber,
  canEdit,
  onMarkSeasonWatched,
  isMarkingSeasonWatched,
}: EpisodeListProps) {
  const currentEp = currentEpisodeNumber ?? 1;

  // Build a lookup map from the structured episode data
  const episodeMap = new Map<number, EpisodeData>();
  for (const ep of episodes ?? []) {
    episodeMap.set(ep.episodeNumber, ep);
  }

  // Disable "All watched" if any episode in this season hasn't aired yet
  const hasUnreleasedEpisodes = Array.from({ length: episodeCount }, (_, i) => i + 1).some(
    (epNum) => isEpisodeUnreleasedInGrid(episodeMap.get(epNum)?.airDate)
  );

  return (
    <div>
      {/* "All watched" button — only shown when season not yet fully watched */}
      {canEdit && !isWatched && (
        <div className="flex justify-end pb-2 mb-2 border-b border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-muted-foreground hover:text-[var(--success-600)] dark:hover:text-[var(--success-400)] hover:bg-[var(--success-50)] dark:hover:bg-[var(--success-950)]"
            onClick={() => onMarkSeasonWatched(seasonNumber)}
            disabled={isMarkingSeasonWatched || hasUnreleasedEpisodes}
            title={hasUnreleasedEpisodes ? "Some episodes haven't aired yet" : undefined}
          >
            <Check className="h-3 w-3 mr-1" />
            All watched
          </Button>
        </div>
      )}

      {/* Episode grid */}
      <div className="flex flex-wrap gap-x-2 gap-y-3 justify-center">
        {Array.from({ length: episodeCount }, (_, i) => {
          const epNum = i + 1;
          const epData = episodeMap.get(epNum);
          const unreleased = isEpisodeUnreleasedInGrid(epData?.airDate);
          const isEpWatched = isWatched || (isCurrentSeason && epNum < currentEp);
          const isCurrent = isCurrentSeason && epNum === currentEp;
          const title = epData?.name
            ? `E${epNum}: ${epData.name}${epData.airDate ? ` · ${formatAirDate(epData.airDate)}` : ""}`
            : `Episode ${epNum}`;

          return (
            <div
              key={epNum}
              className="flex flex-col items-center gap-0.5 w-8"
              title={title}
            >
              {/* Check circle */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  isEpWatched
                    ? "bg-[var(--success-500)] border-[var(--success-500)]"
                    : isCurrent
                      ? "border-[var(--primary-500)] bg-[var(--primary-50)] dark:bg-[var(--primary-950)]"
                      : unreleased
                        ? "border-border/25 bg-transparent"
                        : "border-border/40 bg-transparent"
                )}
              >
                {isEpWatched && <Check className="h-2.5 w-2.5 text-white" />}
                {!isEpWatched && unreleased && (
                  <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
                )}
              </div>

              {/* Episode number label */}
              <span
                className={cn(
                  "text-[10px] tabular-nums leading-none",
                  isEpWatched
                    ? "text-[var(--success-600)] dark:text-[var(--success-400)]"
                    : isCurrent
                      ? "text-[var(--primary-600)] dark:text-[var(--primary-400)] font-semibold"
                      : unreleased
                        ? "text-muted-foreground/25"
                        : "text-muted-foreground/50"
                )}
              >
                E{epNum}
              </span>

            </div>
          );
        })}
      </div>
    </div>
  );
}
