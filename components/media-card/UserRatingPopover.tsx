"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface UserRatingPopoverProps {
  rating?: number;
  onRatingChange: (rating: number | undefined) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function UserRatingPopover({
  rating,
  onRatingChange,
  size = "sm",
  disabled = false,
}: UserRatingPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating ?? rating;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const starSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  const handleRatingClick = (value: number) => {
    onRatingChange(value);
    setOpen(false);
  };

  const handleClearRating = () => {
    onRatingChange(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer",
            "hover:bg-accent/50",
            rating
              ? "text-amber-500"
              : "text-muted-foreground hover:text-amber-500"
          )}
          disabled={disabled}
        >
          <Star
            className={cn(
              iconSize,
              rating ? "fill-amber-400 text-amber-400" : "fill-none"
            )}
          />
          <span className={cn(textSize, "font-medium tabular-nums")}>
            {rating ? rating : "–"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <p className={cn(textSize, "font-medium text-foreground")}>
            Your Rating
          </p>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <button
                key={value}
                className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                onMouseEnter={() => setHoverRating(value)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => handleRatingClick(value)}
                disabled={disabled}
                aria-disabled={disabled}
              >
                <Star
                  className={cn(
                    starSize,
                    displayRating && value <= displayRating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className={cn(textSize, "text-muted-foreground")}>
              {hoverRating ? `${hoverRating}/10` : rating ? `${rating}/10` : "Not rated"}
            </span>
            {rating && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearRating}
                disabled={disabled}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
