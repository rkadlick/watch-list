"use client";

import { useState, useEffect } from "react";
import { Plus, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { formatISODateDisplay } from "@/lib/dates";
import { EpisodeDate } from "./types";

interface SeasonEditFormProps {
  canEdit: boolean;
  seasonNumber: number;
  episodeCount?: number;
  airDate?: string;
  notes?: string;
  episodeDates?: EpisodeDate[];
  onNotesChange: (notes: string) => void;
  isUpdatingSeasonNotes: boolean;
}

export function SeasonEditForm({
  canEdit,
  seasonNumber,
  episodeCount,
  airDate,
  notes = "",
  episodeDates = [],
  onNotesChange,
  isUpdatingSeasonNotes,
}: SeasonEditFormProps) {
  const [localNotes, setLocalNotes] = useState(notes);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (localNotes !== notes) {
      onNotesChange(localNotes);
    }
  };

  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  const metaParts: string[] = [];
  if (episodeCount) metaParts.push(`${episodeCount} Episodes`);
  if (airDate) {
    const formattedAirDate = formatISODateDisplay(airDate);
    const isFuture = new Date(airDate) > new Date();
    const prefix = isFuture ? "Airing on" : "Aired";
    if (formattedAirDate) metaParts.push(`${prefix} ${formattedAirDate}`);
  }

  const sortedEpisodeDates = [...episodeDates].sort(
    (a, b) => a.episodeNumber - b.episodeNumber
  );

  const formatWatchDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-3 pt-2">
      {metaParts.length > 0 && (
        <div className="text-xs text-muted-foreground/70 pb-1">
          {metaParts.join(" • ")}
        </div>
      )}

      {sortedEpisodeDates.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Episodes watched</div>
          <div className="space-y-1">
            {sortedEpisodeDates.map((entry) => (
              <div
                key={entry.episodeNumber}
                className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-md px-2.5 py-1.5"
              >
                <span className="text-foreground">Episode {entry.episodeNumber}</span>
                <span className="flex items-center gap-1 tabular-nums">
                  <Calendar className="h-3 w-3" />
                  {formatWatchDate(entry.watchedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/60 py-1">No episodes watched yet</div>
      )}

      {canEdit && (
        <div className="border border-border/50 rounded-md bg-muted/30 px-3 py-2">
          {isEditingNotes ? (
            <Textarea
              placeholder={`Notes for Season ${seasonNumber}...`}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              autoFocus
              disabled={isUpdatingSeasonNotes}
              className="text-xs min-h-[60px] resize-none bg-background border-0 focus-visible:ring-0 px-2 -mx-2"
            />
          ) : notes ? (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left w-full line-clamp-3"
            >
              {notes}
            </button>
          ) : (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Add note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
