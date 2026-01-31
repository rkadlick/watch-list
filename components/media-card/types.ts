import type { Id } from "@/convex/_generated/dataModel";

export type CardSize = "small" | "normal" | "large";
export type StatusValue = "to_watch" | "watching" | "watched" | "dropped";
export type SeasonStatusValue = StatusValue;
export type PriorityValue = "low" | "medium" | "high" | undefined;

export interface SeasonProgress {
  seasonNumber: number;
  status: SeasonStatusValue;
  rating?: number;
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface MediaCardProps {
  canEdit: boolean;
  size?: CardSize;
  priority?: boolean; // For priority image loading
  listItem: {
    _id: Id<"listItems">;
    _creationTime: number; // Convex auto-provides this
    status: StatusValue;
    rating?: number;
    notes?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    startedAt?: number;
    finishedAt?: number;
    seasonProgress?: SeasonProgress[];
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

// Extended props for the inner card components
export interface MediaCardInnerProps extends Omit<MediaCardProps, "size"> {
  handleStatusChange: (status: StatusValue) => Promise<void>;
  handleDelete: () => Promise<void>;
  showSeasons: boolean;
  setShowSeasons: (b: boolean) => void;
  openSeason: string | undefined;
  setOpenSeason: (v: string | undefined) => void;
  handleSeasonStatusChange: (seasonNumber: number, status: StatusValue) => Promise<void>;
  getSeasonStatus: (seasonNumber: number) => StatusValue;
  getSeasonProgress: (seasonNumber: number) => SeasonProgress | undefined;
  formatDate: (timestamp?: number) => string | null;
  // New handlers
  handleRatingChange: (rating: number | undefined) => Promise<void>;
  handleSeasonRatingChange: (seasonNumber: number, rating: number | undefined) => Promise<void>;
  handlePriorityChange: (priority: PriorityValue) => Promise<void>;
  handleNotesChange: (notes: string) => Promise<void>;
  handleSeasonNotesChange: (seasonNumber: number, notes: string) => Promise<void>;
  handleTagsChange: (tags: string[]) => Promise<void>;
  handleDatesChange: (startedAt?: number | null, finishedAt?: number | null) => Promise<void>;
  handleSeasonDatesChange: (seasonNumber: number, startedAt?: number | null, finishedAt?: number | null) => Promise<void>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isUpdatingStatus: boolean;
  isDeleting: boolean;
  isUpdatingRating: boolean;
  isUpdatingPriority: boolean;
  isUpdatingNotes: boolean;
  isUpdatingTags: boolean;
  isUpdatingDates: boolean;
  isUpdatingSeasonStatus: boolean;
  isUpdatingSeasonRating: boolean;
  isUpdatingSeasonNotes: boolean;
  isUpdatingSeasonDates: boolean;
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

export const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
  low: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
};
