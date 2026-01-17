"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardContent } from "@/components/ui/Card";

export function SearchResultSkeleton() {
  return (
    <Card className="transition-all">
      <CardContent className="p-3 flex flex-col gap-2">
        {/* Poster area (same ratio as Image fill) */}
        <div className="relative w-full aspect-[2/3] rounded bg-muted overflow-hidden">
          <Skeleton className="absolute inset-0 w-full h-full" />
        </div>

        {/* Text placeholders matching real card lines */}
        <div className="space-y-1 mt-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </CardContent>
    </Card>
  );
}