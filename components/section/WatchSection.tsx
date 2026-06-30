"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WatchSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  accent?: "primary" | "warning" | "success" | "neutral";
  description?: string;
}

const accentStyles = {
  primary: "text-[var(--primary-600)] dark:text-[var(--primary-400)]",
  warning: "text-[var(--warning-600)] dark:text-[var(--warning-400)]",
  success: "text-[var(--success-600)] dark:text-[var(--success-400)]",
  neutral: "text-muted-foreground",
};

const accentCountStyles = {
  primary: "bg-[var(--primary-100)] dark:bg-[var(--primary-800)] text-[var(--primary-700)] dark:text-[var(--primary-200)]",
  warning: "bg-[var(--warning-100)] dark:bg-[var(--warning-800)] text-[var(--warning-700)] dark:text-[var(--warning-200)]",
  success: "bg-[var(--success-100)] dark:bg-[var(--success-800)] text-[var(--success-700)] dark:text-[var(--success-200)]",
  neutral: "bg-muted text-muted-foreground",
};

export function WatchSection({
  title,
  count,
  defaultOpen = true,
  children,
  className,
  accent = "neutral",
  description,
}: WatchSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("space-y-3", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <span className={cn("transition-colors", accentStyles[accent])}>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <span className={cn("font-semibold text-sm uppercase tracking-wider", accentStyles[accent])}>
          {title}
        </span>
        <span
          className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded-full tabular-nums",
            accentCountStyles[accent]
          )}
        >
          {count}
        </span>
        {description && (
          <span className="text-xs text-muted-foreground hidden sm:inline">{description}</span>
        )}
      </button>

      {isOpen && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
}

interface WatchSubSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function WatchSubSection({
  title,
  count,
  defaultOpen = true,
  children,
  className,
}: WatchSubSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("space-y-2", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <span className="text-muted-foreground">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
      </button>

      {isOpen && <div>{children}</div>}
    </div>
  );
}
