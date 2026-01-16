"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "./DatePicker";
import { formatISODateDisplay } from "@/lib/dates";

interface SeasonEditFormProps {
  seasonNumber: number;
  episodeCount?: number;
  airDate?: string;
  // User tracking data
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
  // Callbacks
  onNotesChange: (notes: string) => void;
  onDatesChange: (startedAt?: number, finishedAt?: number) => void;
}

export function SeasonEditForm({
  seasonNumber,
  episodeCount,
  airDate,
  notes = "",
  startedAt,
  finishedAt,
  onNotesChange,
  onDatesChange,
}: SeasonEditFormProps) {
  const [localNotes, setLocalNotes] = useState(notes);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const handleStartedChange = (timestamp?: number) => {
    onDatesChange(timestamp, finishedAt);
  };

  const handleFinishedChange = (timestamp?: number) => {
    onDatesChange(startedAt, timestamp);
  };

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (localNotes !== notes) {
      onNotesChange(localNotes);
    }
  };

  // Sync local notes when prop changes
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  // Format meta info with dot separators
  const metaParts: string[] = [];
  if (episodeCount) metaParts.push(`${episodeCount} Episodes`);
  if (airDate) {
    const formattedAirDate = formatISODateDisplay(airDate);
    if (formattedAirDate) metaParts.push(`Aired ${formattedAirDate}`);
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Meta Info (no borders, dot separated) - moved above date */}
      {metaParts.length > 0 && (
        <div className="text-xs text-muted-foreground/70 pb-1">
          {metaParts.join(" • ")}
        </div>
      )}

      {/* Dates Row */}
      <div className="flex items-center gap-4">
        <DatePicker
          value={startedAt}
          onChange={handleStartedChange}
          label="Started this season"
          placeholder="Started?"
        />

        {(startedAt || finishedAt) && (
          <>
            <span className="text-muted-foreground/40">→</span>
            <DatePicker
              value={finishedAt}
              onChange={handleFinishedChange}
              label="Finished this season"
              placeholder="Finished?"
            />
          </>
        )}
      </div>

      {/* Notes - Click to Edit - Made more distinct */}
      <div className="border border-border/50 rounded-md bg-muted/30 px-3 py-2">
        {isEditingNotes ? (
          <Textarea
            placeholder={`Notes for Season ${seasonNumber}...`}
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={handleNotesBlur}
            autoFocus
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
    </div>
  );
}
