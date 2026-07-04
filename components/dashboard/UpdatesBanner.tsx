"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  formatMediaChange,
  type MediaChange,
} from "@/lib/media-snapshot";
import type { Id } from "@/convex/_generated/dataModel";

export interface UpdateEntry {
  listItemId: Id<"listItems">;
  title: string;
  change: MediaChange;
}

interface UpdatesBannerProps {
  updates: UpdateEntry[];
  onDismiss: () => void;
}

export function UpdatesBanner({ updates, onDismiss }: UpdatesBannerProps) {
  if (updates.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--primary-200)] dark:border-[var(--primary-700)] bg-[var(--primary-50)] dark:bg-[var(--primary-950)] px-4 py-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--primary-800)] dark:text-[var(--primary-100)]">
            {updates.length} update{updates.length === 1 ? "" : "s"} since your last visit
          </p>
          <ul className="mt-2 space-y-1">
            {updates.slice(0, 8).map((entry, i) => (
              <li
                key={`${entry.listItemId}-${entry.change.type}-${entry.change.detectedAt}-${i}`}
                className="text-xs text-[var(--primary-700)] dark:text-[var(--primary-200)]"
              >
                <span className="font-medium">{entry.title}</span>
                {" — "}
                {formatMediaChange(entry.change.type, entry.change.detail)}
              </li>
            ))}
            {updates.length > 8 && (
              <li className="text-xs text-muted-foreground">
                +{updates.length - 8} more
              </li>
            )}
          </ul>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-[var(--primary-600)] dark:text-[var(--primary-300)]"
          onClick={onDismiss}
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function collectUnacknowledgedUpdates(
  items: Array<{
    _id: Id<"listItems">;
    pendingChanges?: MediaChange[];
    media: { title: string } | null;
  }>,
  lastAcknowledgedAt: number | null
): UpdateEntry[] {
  const cutoff = lastAcknowledgedAt ?? 0;
  const entries: UpdateEntry[] = [];

  for (const item of items) {
    if (!item.media || !item.pendingChanges?.length) continue;
    for (const change of item.pendingChanges) {
      if (change.detectedAt > cutoff) {
        entries.push({
          listItemId: item._id,
          title: item.media.title,
          change,
        });
      }
    }
  }

  return entries.sort((a, b) => b.change.detectedAt - a.change.detectedAt);
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatLastUpdated(timestamp: number | null): string | null {
  if (!timestamp) return null;
  return formatRelativeTime(timestamp);
}
