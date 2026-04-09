"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "./DatePicker";
import { formatISODateDisplay } from "@/lib/dates";
import type { WatchSpan } from "./types";

interface SeasonEditFormProps {
  canEdit: boolean;
  seasonNumber: number;
  episodeCount?: number;
  airDate?: string;
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
  spans?: WatchSpan[];
  onNotesChange: (notes: string) => void;
  onDatesChange: (startedAt?: number, finishedAt?: number) => void;
  onAddSpan?: (startedAt?: number) => void;
  onUpdateSpan?: (spanIndex: number, startedAt?: number | null, finishedAt?: number | null) => void;
  onRemoveSpan?: (spanIndex: number) => void;
  isUpdatingSeasonNotes: boolean;
  isUpdatingSeasonDates: boolean;
}

export function SeasonEditForm({
  canEdit,
  seasonNumber,
  episodeCount,
  airDate,
  notes = "",
  startedAt,
  finishedAt,
  spans,
  onNotesChange,
  onDatesChange,
  onAddSpan,
  onUpdateSpan,
  onRemoveSpan,
  isUpdatingSeasonNotes,
  isUpdatingSeasonDates,
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

  const useSpans = spans != null && spans.length > 0;
  const effectiveSpans: WatchSpan[] = useSpans
    ? spans!
    : startedAt || finishedAt
      ? [{ startedAt, finishedAt }]
      : [];

  return (
    <div className="space-y-3 pt-2">
      {metaParts.length > 0 && (
        <div className="text-xs text-muted-foreground/70 pb-1">
          {metaParts.join(" \u2022 ")}
        </div>
      )}

      {/* Watch spans */}
      <div className="space-y-2">
        {effectiveSpans.map((span, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground/50 w-5 text-right tabular-nums flex-shrink-0">
              {effectiveSpans.length > 1 ? `#${idx + 1}` : ""}
            </span>

            {useSpans && onUpdateSpan ? (
              <>
                <DatePicker
                  disabled={!canEdit || isUpdatingSeasonDates}
                  value={span.startedAt}
                  onChange={(ts) => onUpdateSpan(idx, ts ?? null, undefined)}
                  label="Started"
                  placeholder="Started?"
                />
                {(span.startedAt || span.finishedAt) && (
                  <>
                    <span className="text-muted-foreground/40">&rarr;</span>
                    <DatePicker
                      disabled={!canEdit || isUpdatingSeasonDates}
                      value={span.finishedAt}
                      onChange={(ts) => onUpdateSpan(idx, undefined, ts ?? null)}
                      label="Finished"
                      placeholder="Finished?"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <DatePicker
                  disabled={!canEdit || isUpdatingSeasonDates}
                  value={span.startedAt}
                  onChange={(ts) => onDatesChange(ts ?? undefined, span.finishedAt)}
                  label="Started this season"
                  placeholder="Started?"
                />
                {(span.startedAt || span.finishedAt) && (
                  <>
                    <span className="text-muted-foreground/40">&rarr;</span>
                    <DatePicker
                      disabled={!canEdit || isUpdatingSeasonDates}
                      value={span.finishedAt}
                      onChange={(ts) => onDatesChange(span.startedAt, ts ?? undefined)}
                      label="Finished this season"
                      placeholder="Finished?"
                    />
                  </>
                )}
              </>
            )}

            {canEdit && useSpans && onRemoveSpan && effectiveSpans.length > 0 && (
              <button
                onClick={() => onRemoveSpan(idx)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors cursor-pointer flex-shrink-0"
                disabled={isUpdatingSeasonDates}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {canEdit && onAddSpan && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground/60 hover:text-muted-foreground px-2"
            onClick={() => onAddSpan()}
            disabled={isUpdatingSeasonDates}
          >
            <Plus className="h-3 w-3 mr-1" />
            {effectiveSpans.length === 0 ? "Log watch" : "Log rewatch"}
          </Button>
        )}
      </div>

      {/* Notes */}
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
