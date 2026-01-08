import type { Id } from "@/convex/_generated/dataModel";

export type CardSize = "small" | "normal" | "large";
export type StatusValue = "to_watch" | "watching" | "watched" | "dropped";
export type SeasonStatusValue = StatusValue;

export interface MediaCardProps {
  size?: CardSize;
  listItem: {
    _id: Id<"listItems">;
    status: StatusValue;
    rating?: number;
    notes?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    startedAt?: number;
    finishedAt?: number;
    seasonProgress?: Array<{
      seasonNumber: number;
      status: SeasonStatusValue;
      rating?: number;
      notes?: string;
      startedAt?: number;
      finishedAt?: number;
    }>;
    media: {
      _id: Id<"media">;
      type: "movie" | "tv";
      title: string;
      posterUrl?: string;
      releaseDate?: string;
      genres?: Array<{ id: number; name: string }>;
      watchProviders?: Array<{
        providerId: number;
        providerName: string;
        logoPath?: string;
        displayPriority: number;
      }>;
      voteAverage?: number;
      totalSeasons?: number;
      totalEpisodes?: number;
      seasonData?: Array<{
        seasonNumber: number;
        episodeCount: number;
        airDate?: string;
      }>;
    } | null;
  };
}

export const statusLabels = {
  to_watch: "To Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

export const statusColors = {
  to_watch: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500",
  watching: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-600 dark:text-blue-50 dark:border-blue-400",
  watched: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  dropped: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700",
};