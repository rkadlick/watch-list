"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function MediaCardSkeleton({ size = "normal" }: { size?: "small" | "normal" | "large" }) {
  // Config scales with the size prop
  const config =
    size === "small"
      ? {
          posterWidth: "w-20",
          posterHeight: "h-28",
          padding: "p-3",
          gap: "gap-2",
          title: "h-3 w-2/3",
          meta: "h-2.5 w-1/2",
          icon: "h-4 w-4",
          line: "h-2.5 w-3/4",
        }
      : size === "large"
      ? {
          posterWidth: "w-40",
          posterHeight: "h-60",
          padding: "p-5",
          gap: "gap-5",
          title: "h-5 w-3/4",
          meta: "h-4 w-1/2",
          icon: "h-5 w-5",
          line: "h-3.5 w-3/4",
        }
      : {
          // "normal"
          posterWidth: "w-28",
          posterHeight: "h-40",
          padding: "p-4",
          gap: "gap-3",
          title: "h-4 w-3/4",
          meta: "h-3 w-2/3",
          icon: "h-4 w-4",
          line: "h-3 w-3/4",
        };

  return (
    <Card className={`flex flex-col animate-pulse`}>
      <div className={`flex ${config.gap} ${config.padding}`}>
        {/* Poster placeholder */}
        <div
          className={`flex-shrink-0 rounded-md bg-muted/50 ${config.posterWidth} ${config.posterHeight}`}
        />

        {/* Content area */}
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <Skeleton className={config.title} />
            <Skeleton className={config.meta} />
          </div>

          {/* Status / Rating Row */}
          <div className="flex items-center gap-2 mt-3">
            <Skeleton className={`h-6 w-16 rounded-full`} />
            <Skeleton className={`h-6 w-6 rounded-full`} />
            <Skeleton className={`h-6 w-6 rounded-full`} />
          </div>

          {/* Optional tag / notes rows */}
          <div className="mt-3 space-y-2">
            <Skeleton className={config.line} />
            <Skeleton className={config.line} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-2 text-right">
        <Skeleton className="h-2 w-24 ml-auto" />
      </div>
    </Card>
  );
}