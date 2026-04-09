"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import type { StatusValue } from "@/components/media-card/types";

interface CalendarItem {
  _id: string;
  status: StatusValue;
  movieWatchDates?: number[];
  startedAt?: number;
  finishedAt?: number;
  lastWatchedAt?: number;
  seasonProgress?: Array<{
    seasonNumber: number;
    status: StatusValue;
    startedAt?: number;
    finishedAt?: number;
    spans?: Array<{ startedAt?: number; finishedAt?: number }>;
  }>;
  media: {
    type: "movie" | "tv";
    title: string;
    releaseDate?: string;
    seasonData?: Array<{
      seasonNumber: number;
      airDate?: string;
    }>;
  } | null;
}

interface CalendarViewProps {
  items: CalendarItem[] | undefined;
}

interface DayEvent {
  title: string;
  type: "movie" | "tv";
  kind: "watched" | "started" | "finished" | "release" | "air_date";
  status: StatusValue;
  detail?: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timestampToDateKey(ts: number): string {
  return toDateKey(new Date(ts));
}

function isoToDateKey(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildEventsMap(items: CalendarItem[]): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>();

  function push(key: string, event: DayEvent) {
    const arr = map.get(key) ?? [];
    arr.push(event);
    map.set(key, arr);
  }

  for (const item of items) {
    if (!item.media) continue;
    const { media } = item;

    if (media.type === "movie") {
      const dates = item.movieWatchDates ?? (item.finishedAt ? [item.finishedAt] : []);
      for (const d of dates) {
        push(timestampToDateKey(d), {
          title: media.title,
          type: "movie",
          kind: "watched",
          status: item.status,
        });
      }

      if (media.releaseDate) {
        const key = isoToDateKey(media.releaseDate);
        if (key) {
          push(key, {
            title: media.title,
            type: "movie",
            kind: "release",
            status: item.status,
            detail: "Release",
          });
        }
      }
    }

    if (media.type === "tv") {
      const progress = item.seasonProgress ?? [];
      for (const sp of progress) {
        const spans = sp.spans ?? (sp.startedAt || sp.finishedAt ? [{ startedAt: sp.startedAt, finishedAt: sp.finishedAt }] : []);
        for (const span of spans) {
          if (span.startedAt) {
            push(timestampToDateKey(span.startedAt), {
              title: media.title,
              type: "tv",
              kind: "started",
              status: sp.status,
              detail: `S${sp.seasonNumber} started`,
            });
          }
          if (span.finishedAt) {
            push(timestampToDateKey(span.finishedAt), {
              title: media.title,
              type: "tv",
              kind: "finished",
              status: sp.status,
              detail: `S${sp.seasonNumber} finished`,
            });
          }
        }
      }

      if (media.seasonData) {
        for (const sd of media.seasonData) {
          if (sd.airDate) {
            const key = isoToDateKey(sd.airDate);
            if (key) {
              push(key, {
                title: media.title,
                type: "tv",
                kind: "air_date",
                status: item.status,
                detail: `S${sd.seasonNumber} air date`,
              });
            }
          }
        }
      }
    }
  }

  return map;
}

function kindColor(kind: DayEvent["kind"]): string {
  switch (kind) {
    case "watched":
    case "finished":
      return "bg-emerald-500";
    case "started":
      return "bg-blue-500";
    case "release":
    case "air_date":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

function kindLabel(kind: DayEvent["kind"]): string {
  switch (kind) {
    case "watched":
      return "Watched";
    case "started":
      return "Started";
    case "finished":
      return "Finished";
    case "release":
      return "Released";
    case "air_date":
      return "Aired";
  }
}

export function CalendarView({ items }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const events = useMemo(() => buildEventsMap(items ?? []), [items]);

  const { year, month } = viewDate;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateKey(new Date());

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const prev = () =>
    setViewDate((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: v.month - 1 }
    );

  const next = () =>
    setViewDate((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: v.month + 1 }
    );

  const goToday = () => {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">
              {MONTH_NAMES[month]} {year}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>

        {/* Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* Day names */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {DAY_NAMES.map((name) => (
              <div key={name} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {name}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((weekRow, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {weekRow.map((day, di) => {
                if (day === null) {
                  return <div key={di} className="min-h-[80px] bg-muted/20 border-r last:border-r-0" />;
                }

                const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = events.get(key) ?? [];
                const isToday = key === today;

                return (
                  <div
                    key={di}
                    className={cn(
                      "min-h-[80px] p-1 border-r last:border-r-0 relative",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs tabular-nums block text-right mb-0.5",
                        isToday
                          ? "font-bold text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {day}
                    </span>

                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, ei) => (
                        <Tooltip key={ei}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 px-0.5 py-px rounded cursor-default hover:bg-muted/60 transition-colors overflow-hidden">
                              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", kindColor(ev.kind))} />
                              <span className="text-[10px] leading-tight truncate">
                                {ev.title}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="flex items-center gap-1.5">
                              {ev.type === "movie" ? (
                                <Film className="h-3 w-3" />
                              ) : (
                                <Tv className="h-3 w-3" />
                              )}
                              <span className="font-medium">{ev.title}</span>
                            </div>
                            <div className="text-muted-foreground mt-0.5">
                              {ev.detail ?? kindLabel(ev.kind)}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {dayEvents.length > 3 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-[10px] text-muted-foreground/60 pl-0.5 cursor-default">
                              +{dayEvents.length - 3} more
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                            {dayEvents.slice(3).map((ev, ei) => (
                              <div key={ei} className="flex items-center gap-1.5 py-0.5">
                                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", kindColor(ev.kind))} />
                                <span>{ev.title}</span>
                                <span className="text-muted-foreground">
                                  {ev.detail ?? kindLabel(ev.kind)}
                                </span>
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Watched / Finished</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Started</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Release / Air date</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
