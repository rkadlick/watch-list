"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function SearchResultSkeleton() {
  return (
    <div className="surface-card flex items-center gap-2.5 px-2 py-1.5 w-full min-w-0">
      <Skeleton className="flex-shrink-0 w-11 aspect-[2/3] rounded-md" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
