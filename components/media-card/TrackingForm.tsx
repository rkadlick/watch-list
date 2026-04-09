"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "./DatePicker";
import { formatDateDisplay } from "@/lib/dates";

interface TrackingFormProps {
  canEdit: boolean;
  startedAt?: number;
  finishedAt?: number;
  movieWatchDates?: number[];
  tags?: string[];
  notes?: string;
  mediaTitle?: string;
  mediaType?: "movie" | "tv";
  onDatesChange: (startedAt?: number, finishedAt?: number) => void;
  onTagsChange: (tags: string[]) => void;
  onNotesChange: (notes: string) => void;
  onDelete: () => void;
  onAddMovieWatchDate?: (watchedOn: number) => void;
  onRemoveMovieWatchDate?: (dateIndex: number) => void;
  isUpdatingNotes: boolean;
  isUpdatingTags: boolean;
  isUpdatingDates: boolean;
}

export function TrackingForm({
  canEdit,
  startedAt,
  finishedAt,
  movieWatchDates,
  tags = [],
  notes = "",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mediaTitle,
  mediaType = "tv",
  onDatesChange,
  onTagsChange,
  onNotesChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDelete,
  onAddMovieWatchDate,
  onRemoveMovieWatchDate,
  isUpdatingNotes,
  isUpdatingTags,
  isUpdatingDates,
}: TrackingFormProps) {
  const [newTag, setNewTag] = useState("");
  const [localNotes, setLocalNotes] = useState(notes);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingDate, setIsAddingDate] = useState(false);

  const handleStartedChange = (timestamp?: number | null) => {
    onDatesChange(timestamp ?? undefined, finishedAt);
  };

  const handleFinishedChange = (timestamp?: number | null) => {
    onDatesChange(startedAt, timestamp ?? undefined);
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag]);
      setNewTag("");
    }
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setIsAddingTag(false);
      setNewTag("");
    }
  };

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (localNotes !== notes && canEdit) {
      onNotesChange(localNotes);
    } else if (!canEdit) {
      setLocalNotes(notes);
    }
  };

  const dates = movieWatchDates ?? (finishedAt ? [finishedAt] : []);

  return (
    <div className="space-y-4 py-2">
      {/* Date Row */}
      <div>
        {mediaType === "movie" ? (
          <div className="space-y-2">
            {dates.length > 0 && (
              <div className="space-y-1">
                {dates.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {i === 0 ? "Watched" : `Rewatch #${i}`}{" "}
                      {formatDateDisplay(d)}
                    </span>
                    {canEdit && onRemoveMovieWatchDate && (
                      <button
                        onClick={() => onRemoveMovieWatchDate(i)}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors cursor-pointer"
                        disabled={isUpdatingDates}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              isAddingDate ? (
                <DatePicker
                  value={undefined}
                  onChange={(timestamp) => {
                    if (timestamp && onAddMovieWatchDate) {
                      onAddMovieWatchDate(timestamp);
                    }
                    setIsAddingDate(false);
                  }}
                  label="Watched on"
                  placeholder="Pick date"
                  disabled={isUpdatingDates}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground/60 hover:text-muted-foreground px-2 -ml-2"
                  onClick={() => setIsAddingDate(true)}
                  disabled={isUpdatingDates}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Log watch
                </Button>
              )
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <DatePicker
              value={startedAt}
              onChange={handleStartedChange}
              label="Started watching"
              placeholder="Started?"
              disabled={!canEdit || isUpdatingDates}
            />

            {(startedAt || finishedAt) && (
              <>
                <span className="text-muted-foreground/40">&rarr;</span>
                <DatePicker
                  value={finishedAt}
                  onChange={handleFinishedChange}
                  label="Finished watching"
                  placeholder="Finished?"
                  disabled={!canEdit || isUpdatingDates}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="border border-border/50 rounded-md bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs px-2 py-0.5 gap-1 group"
            >
              {tag}
              {canEdit && (
                <button
                  className="opacity-50 group-hover:opacity-100 hover:text-destructive transition-all cursor-pointer"
                  onClick={() => handleRemoveTag(tag)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}

          {isAddingTag ? (
            <Input
              type="text"
              placeholder="Tag name..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              autoFocus
              className="h-6 text-xs w-24 bg-background border-0 focus-visible:ring-0 px-2 -mx-2"
              disabled={isUpdatingTags}
            />
          ) : (
            canEdit && (
              <button
                onClick={() => setIsAddingTag(true)}
                className="flex items-center gap-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
                disabled={isUpdatingTags}
              >
                <Plus className="h-3 w-3" />
                {tags.length === 0 ? "Add tag" : ""}
              </button>
            )
          )}
        </div>
      </div>

      {/* Notes */}
      {canEdit && (
        <div className="border border-border/50 rounded-md bg-muted/30 px-3 py-2">
          {isEditingNotes && canEdit ? (
            <Textarea
              placeholder="Your thoughts about this show..."
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              autoFocus
              className="text-xs min-h-[80px] resize-none bg-background border-0 focus-visible:ring-0 px-2 -mx-2"
              disabled={isUpdatingNotes}
            />
          ) : canEdit && (
            <>
              {notes ? (
                <button
                  onClick={() => canEdit && setIsEditingNotes(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left w-full line-clamp-3"
                >
                  {notes}
                </button>
              ) : (
                <button
                  onClick={() => canEdit && setIsEditingNotes(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Add notes
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
