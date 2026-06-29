import type { Id } from "@/convex/_generated/dataModel";

export type CardSize = "small" | "normal" | "large";
export type StatusValue = "to_watch" | "watching" | "watched" | "dropped";
export type SeasonStatusValue = StatusValue;
export type PriorityValue = "low" | "medium" | "high" | undefined;

export interface EpisodeDate {
  episodeNumber: number;
  watchedAt: number;
}

export interface SeasonProgress {
  seasonNumber: number;
  status: SeasonStatusValue;
  rating?: number;
  notes?: string;
  startedAt?: number;
  finishedAt?: number;
  episodeDates?: EpisodeDate[];
}

export interface WatchHistorySeason {
  seasonNumber: number;
  startedAt?: number;
  finishedAt?: number;
  rating?: number;
  notes?: string;
  episodeDates?: EpisodeDate[];
}

export interface WatchHistoryEntry {
  startedAt?: number;
  finishedAt?: number;
  rating?: number;
  notes?: string;
  seasons?: WatchHistorySeason[];
}

export interface EpisodeData {
  episodeNumber: number;
  name: string;
  airDate?: string;
  overview?: string;
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
    // Episode position tracking
    currentSeasonNumber?: number;
    currentEpisodeNumber?: number;
    // Drop position
    droppedAtSeason?: number;
    droppedAtEpisode?: number;
    watchHistory?: WatchHistoryEntry[];
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
        episodes?: EpisodeData[];
      }>;
      tmdbRaw?: unknown;
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
  // Tracking handlers
  handleRatingChange: (rating: number | undefined) => Promise<void>;
  handleSeasonRatingChange: (seasonNumber: number, rating: number | undefined) => Promise<void>;
  handlePriorityChange: (priority: PriorityValue) => Promise<void>;
  handleNotesChange: (notes: string) => Promise<void>;
  handleSeasonNotesChange: (seasonNumber: number, notes: string) => Promise<void>;
  handleTagsChange: (tags: string[]) => Promise<void>;
  handleDatesChange: (startedAt?: number | null, finishedAt?: number | null) => Promise<void>;
  handleSeasonDatesChange: (seasonNumber: number, startedAt?: number | null, finishedAt?: number | null) => Promise<void>;
  // Episode tracking handlers
  handleAdvanceEpisode: () => Promise<void>;
  handleRewindEpisode: () => Promise<void>;
  handleMarkSeasonWatched: (seasonNumber: number) => Promise<void>;
  // Rewatch handlers
  handleStartRewatch: () => Promise<void>;
  handleLogWatchEntry: (entry: { startedAt?: number; finishedAt?: number; rating?: number; notes?: string }) => Promise<void>;
  handleRemoveWatchEntry: (entryIndex: number) => Promise<void>;
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
  isAdvancingEpisode: boolean;
  isRewindingEpisode: boolean;
  isMarkingSeasonWatched: boolean;
  isStartingRewatch: boolean;
  isLoggingWatchEntry: boolean;
  isRemovingWatchEntry: boolean;
}

export const statusLabels = {
  to_watch: "To Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

export const statusColors = {
  to_watch: "status-to-watch",
  watching: "status-watching",
  watched: "status-watched",
  dropped: "status-dropped",
};

export const priorityColors = {
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};
