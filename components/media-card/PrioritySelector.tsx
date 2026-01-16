"use client";

import { useState } from "react";
import { Circle, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | undefined;

interface PrioritySelectorProps {
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  size?: "sm" | "md";
}

const priorityConfig = {
  high: {
    label: "High",
    color: "text-red-500",
    dotColor: "fill-red-500 text-red-500",
    bgHover: "hover:bg-red-50 dark:hover:bg-red-950/30",
  },
  medium: {
    label: "Medium",
    color: "text-amber-500",
    dotColor: "fill-amber-500 text-amber-500",
    bgHover: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
  },
  low: {
    label: "Low",
    color: "text-blue-500",
    dotColor: "fill-blue-500 text-blue-500",
    bgHover: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
  },
} as const;

export function PrioritySelector({
  priority,
  onPriorityChange,
  size = "sm",
}: PrioritySelectorProps) {
  const [open, setOpen] = useState(false);
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const chevronSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  const handleSelect = (value: Priority) => {
    onPriorityChange(value);
    setOpen(false);
  };

  const currentConfig = priority ? priorityConfig[priority] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer",
            "hover:bg-accent/50",
            priority ? currentConfig?.color : "text-muted-foreground"
          )}
        >
          {priority ? (
            <>
              <Circle className={cn(iconSize, currentConfig?.dotColor)} />
              <span className={cn(textSize, "font-medium")}>
                {currentConfig?.label}
              </span>
            </>
          ) : (
            <>
              <Circle className={cn(iconSize, "text-muted-foreground/50")} />
              <span className={cn(textSize)}>Priority</span>
            </>
          )}
          <ChevronDown className={cn(chevronSize, "opacity-50")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        <div className="flex flex-col">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-left",
                priorityConfig[p].bgHover,
                priority === p && "bg-accent"
              )}
              onClick={() => handleSelect(p)}
            >
              <Circle
                className={cn("h-2.5 w-2.5", priorityConfig[p].dotColor)}
              />
              <span className={cn(textSize, priorityConfig[p].color)}>
                {priorityConfig[p].label}
              </span>
            </button>
          ))}
          {priority && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-left",
                  "hover:bg-accent text-muted-foreground"
                )}
                onClick={() => handleSelect(undefined)}
              >
                <span className={textSize}>Clear priority</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
