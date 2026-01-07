"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { StatusMenu } from "./StatusMenu";
import { statusColors } from "./types";

interface SeasonAccordionProps {
  showSeasons: boolean;
  setShowSeasons: (val: boolean) => void;
  openSeason: string | undefined;
  setOpenSeason: (val: string | undefined) => void;
  media: any;
  listItem: any;
  config: any;
  handleSeasonStatusChange: (seasonNumber: number, status: any) => void;
  getSeasonStatus: (seasonNumber: number) => string;
  formatDate: (timestamp?: number) => string | null;
}

export function SeasonAccordion({
  showSeasons,
  setShowSeasons,
  openSeason,
  setOpenSeason,
  media,
  listItem,
  config,
  handleSeasonStatusChange,
  getSeasonStatus,
  formatDate,
}: SeasonAccordionProps) {
  if (!media.seasonData?.length) return null;

  return (
    <>
      <div className="pt-1">
        <Button
          className="cursor-pointer"
          variant="ghost"
          size="sm"
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

      {showSeasons && (
        <Accordion
          type="single"
          collapsible
          className="w-full border-t mt-2"
          value={openSeason}
          onValueChange={setOpenSeason}
        >
          {media.seasonData.map((season: any) => {
            const seasonStatus = getSeasonStatus(season.seasonNumber);
            const seasonProgress = listItem.seasonProgress?.find(
              (p: any) => p.seasonNumber === season.seasonNumber
            );
            console.log(seasonProgress);
            const seasonKey = `season-${season.seasonNumber}`;
            const isOpen = openSeason === seasonKey;

            return (
              <AccordionItem key={seasonKey} value={seasonKey}>
                <div className="flex items-center justify-between py-1">
                  <AccordionTrigger className="hover:no-underline flex-1 text-left">
                    Season {season.seasonNumber}
                  </AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <StatusMenu
                      value={seasonStatus}
                      onChange={(v) =>
                        handleSeasonStatusChange(season.seasonNumber, v)
                      }
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
                    {seasonProgress?.rating && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {seasonProgress.rating}/10
                      </div>
                    )}
                  </div>
                </div>
                <AccordionContent
                  className={`${config.textSize} text-muted-foreground`}
                >
                  <div>
                    <strong>Episodes:</strong> {season.episodeCount ?? "N/A"}
                  </div>
                  {season.airDate && (
                    <div>
                      <strong>Air Date:</strong>{" "}
                      {new Date(season.airDate).toLocaleDateString()}
                    </div>
                  )}
                  {/* Progress-based info */}
                  {seasonProgress?.startedAt && (
                    <div>
                      <strong>Started:</strong>{" "}
                      {formatDate(seasonProgress.startedAt)}
                    </div>
                  )}
                  {seasonProgress?.finishedAt && (
                    <div>
                      <strong>Finished:</strong>{" "}
                      {formatDate(seasonProgress.finishedAt)}
                    </div>
                  )}
                  {seasonProgress?.notes && (
                    <div>
                      <strong>Notes:</strong> {seasonProgress.notes}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </>
  );
}
