"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import { useTvTrackingMode } from "@/lib/hooks/useTvTrackingMode";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaCardProps, StatusValue } from "./types";
import { MediaCardSmall } from "./MediaCardSmall";
import { MediaCardRegular } from "./MediaCardRegular";
import { MediaCardMinimal } from "./MediaCardMinimal";
import { formatDateDisplay } from "@/lib/dates";

export function MediaCard({ canEdit, listItem, size = "small", priority = false }: MediaCardProps) {
  // Mutations
  const {
    mutate: updateStatus,
    isPending: isUpdatingStatus,
  } = useMutationWithError(
    api.listItems.updateStatus,
    {
      successMessage: "Status updated",
    }
  );
  const {
    mutate: updateSeasonStatus,
    isPending: isUpdatingSeasonStatus,
  } = useMutationWithError(
    api.listItems.updateSeasonStatus,
    {
      successMessage: "Season status updated",
    }
  );
  const {
    mutate: deleteListItem,
    isPending: isDeleting,
  } = useMutationWithError(
    api.listItems.deleteListItem,
    {
      successMessage: "Removed from list",
    }
  );
  const {
    mutate: updateRating,
    isPending: isUpdatingRating,
  } = useMutationWithError(
    api.listItems.updateRating,
    {
      successMessage: "Rating updated",
    }
  );
  const {
    mutate: updatePriority,
    isPending: isUpdatingPriority,
  } = useMutationWithError(
    api.listItems.updatePriority,
    {
      successMessage: "Priority updated",
    }
  );
  const {
    mutate: updateNotes,
    isPending: isUpdatingNotes,
  } = useMutationWithError(
    api.listItems.updateNotes,
    {
      successMessage: "Notes updated",
    }
  );
  const {
    mutate: updateTags,
    isPending: isUpdatingTags,
  } = useMutationWithError(
    api.listItems.updateTags,
    {
      successMessage: "Tags updated",
    }
  );
  const {
    mutate: updateDates,
    isPending: isUpdatingDates,
  } = useMutationWithError(
    api.listItems.updateDates,
    {
      successMessage: "Dates updated",
    }
  );
  const {
    mutate: updateSeasonRating,
    isPending: isUpdatingSeasonRating,
  } = useMutationWithError(
    api.listItems.updateSeasonRating,
    {
      successMessage: "Season rating updated",
    }
  );
  const {
    mutate: updateSeasonNotes,
    isPending: isUpdatingSeasonNotes,
  } = useMutationWithError(
    api.listItems.updateSeasonNotes,
    {
      successMessage: "Season notes updated",
    }
  );
  const {
    mutate: updateSeasonDates,
    isPending: isUpdatingSeasonDates,
  } = useMutationWithError(
    api.listItems.updateSeasonDates,
    {
      successMessage: "Season dates updated",
    }
  );
  const {
    mutate: advanceEpisode,
    isPending: isAdvancingEpisode,
  } = useMutationWithError(
    api.listItems.advanceEpisode,
    {
      successMessage: "Episode marked as watched",
    }
  );
  const {
    mutate: rewindEpisode,
    isPending: isRewindingEpisode,
  } = useMutationWithError(
    api.listItems.rewindEpisode,
    {
      successMessage: "Rewound one episode",
    }
  );
  const {
    mutate: markSeasonWatched,
    isPending: isMarkingSeasonWatched,
  } = useMutationWithError(
    api.listItems.markSeasonWatched,
    {
      successMessage: "Season marked as watched",
    }
  );
  const {
    mutate: advanceSeason,
    isPending: isAdvancingSeason,
  } = useMutationWithError(
    api.listItems.advanceSeason,
    {
      successMessage: "Season marked as watched",
    }
  );
  const {
    mutate: rewindSeason,
    isPending: isRewindingSeason,
  } = useMutationWithError(
    api.listItems.rewindSeason,
    {
      successMessage: "Season unmarked",
    }
  );
  const {
    mutate: setEpisodeWatched,
  } = useMutationWithError(api.listItems.setEpisodeWatched);
  const {
    mutate: startSeasonRewatch,
    isPending: isStartingSeasonRewatch,
  } = useMutationWithError(api.listItems.startSeasonRewatch, {
    successMessage: "Season rewatch started — previous watch dates are kept",
  });
  const {
    mutate: stopSeasonRewatch,
    isPending: isStoppingSeasonRewatch,
  } = useMutationWithError(api.listItems.stopSeasonRewatch, {
    successMessage: "Season rewatch stopped",
  });
  const { mutate: logEpisodeRewatch } = useMutationWithError(api.listItems.logEpisodeRewatch);
  const { mutate: removeEpisodeRewatch } = useMutationWithError(api.listItems.removeEpisodeRewatch);
  const { mode: tvMode } = useTvTrackingMode();
  const {
    mutate: startRewatch,
    isPending: isStartingRewatch,
  } = useMutationWithError(
    api.listItems.startRewatch,
    {
      successMessage: "Rewatch started — tracker reset to S1E1",
    }
  );
  const {
    mutate: logWatchEntry,
    isPending: isLoggingWatchEntry,
  } = useMutationWithError(
    api.listItems.logWatchEntry,
    {
      successMessage: "Watch entry logged",
    }
  );
  const {
    mutate: removeWatchEntry,
    isPending: isRemovingWatchEntry,
  } = useMutationWithError(
    api.listItems.removeWatchEntry,
    {
      successMessage: "Watch entry removed",
    }
  );

  // Local state
  const [showSeasons, setShowSeasons] = useState(false);
  const [openSeason, setOpenSeason] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>("seasons");

  if (!listItem.media) return null;

  // Status handlers
  const handleStatusChange = async (newStatus: StatusValue) => {
    await updateStatus({ listItemId: listItem._id, status: newStatus });
  };

  const handleSeasonStatusChange = async (seasonNumber: number, status: StatusValue) => {
    await updateSeasonStatus({ listItemId: listItem._id, seasonNumber, status });
  };

  const handleDelete = async () => {
    await deleteListItem({ listItemId: listItem._id });
  };

  // Rating handlers
  const handleRatingChange = async (rating: number | undefined) => {
    await updateRating({ listItemId: listItem._id, rating });
  };

  const handleSeasonRatingChange = async (seasonNumber: number, rating: number | undefined) => {
    await updateSeasonRating({ listItemId: listItem._id, seasonNumber, rating });
  };

  // Priority handler
  const handlePriorityChange = async (priority: "low" | "medium" | "high" | undefined) => {
    await updatePriority({ listItemId: listItem._id, priority });
  };

  // Notes handlers
  const handleNotesChange = async (notes: string) => {
    await updateNotes({ listItemId: listItem._id, notes: notes || undefined });
  };

  const handleSeasonNotesChange = async (seasonNumber: number, notes: string) => {
    await updateSeasonNotes({ listItemId: listItem._id, seasonNumber, notes: notes || undefined });
  };

  // Tags handler
  const handleTagsChange = async (tags: string[]) => {
    await updateTags({ listItemId: listItem._id, tags: tags.length > 0 ? tags : undefined });
  };

  // Date handlers
  // Pass null to clear, undefined to leave unchanged, number to set
  const handleDatesChange = async (startedAt?: number | null, finishedAt?: number | null) => {
    const args: {
      listItemId: typeof listItem._id;
      startedAt?: number | null;
      finishedAt?: number | null;
    } = { listItemId: listItem._id };
    if (startedAt !== undefined) args.startedAt = startedAt;
    if (finishedAt !== undefined) args.finishedAt = finishedAt;
    await updateDates(args);
  };

  const handleSeasonDatesChange = async (seasonNumber: number, startedAt?: number | null, finishedAt?: number | null) => {
    const args: {
      listItemId: typeof listItem._id;
      seasonNumber: number;
      startedAt?: number | null;
      finishedAt?: number | null;
    } = { listItemId: listItem._id, seasonNumber };
    if (startedAt !== undefined) args.startedAt = startedAt;
    if (finishedAt !== undefined) args.finishedAt = finishedAt;
    await updateSeasonDates(args);
  };

  const handleAdvanceEpisode = async () => {
    await advanceEpisode({ listItemId: listItem._id });
  };

  const handleRewindEpisode = async () => {
    await rewindEpisode({ listItemId: listItem._id });
  };

  const handleMarkSeasonWatched = async (seasonNumber: number) => {
    await markSeasonWatched({ listItemId: listItem._id, seasonNumber });
  };

  const handleAdvanceSeason = async () => {
    await advanceSeason({ listItemId: listItem._id });
  };

  const handleRewindSeason = async () => {
    await rewindSeason({ listItemId: listItem._id });
  };

  const handleSetEpisodeWatched = async (
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
    alsoMarkEarlier = false
  ) => {
    const ref = { listItemId: listItem._id, seasonNumber, episodeNumber };
    const result = await setEpisodeWatched({ ...ref, watched, alsoMarkEarlier });
    if (!watched && result) {
      // Undo restores the original watch date, not today's
      toast(`Unmarked S${seasonNumber}E${episodeNumber}`, {
        action: {
          label: "Undo",
          onClick: () => {
            void setEpisodeWatched({
              ...ref,
              watched: true,
              restoreWatchedAt: result.removedWatchedAt,
            }).catch(() => {});
          },
        },
      });
    }
  };

  const handleStartSeasonRewatch = async (seasonNumber: number) => {
    await startSeasonRewatch({ listItemId: listItem._id, seasonNumber });
  };

  const handleStopSeasonRewatch = async (seasonNumber: number) => {
    await stopSeasonRewatch({ listItemId: listItem._id, seasonNumber });
  };

  const handleLogEpisodeRewatch = async (seasonNumber: number, episodeNumber: number) => {
    const watchId = await logEpisodeRewatch({ listItemId: listItem._id, seasonNumber, episodeNumber });
    toast.success(`Logged a rewatch of S${seasonNumber}E${episodeNumber}`, {
      action: {
        label: "Undo",
        onClick: () => {
          void removeEpisodeRewatch({ watchId }).catch(() => {});
        },
      },
    });
  };

  const handleRemoveEpisodeRewatch = async (watchId: Id<"episodeWatches">) => {
    await removeEpisodeRewatch({ watchId });
    toast.success("Watch removed");
  };

  const handleStartRewatch = async () => {
    await startRewatch({ listItemId: listItem._id });
  };

  const handleLogWatchEntry = async (entry: {
    startedAt?: number;
    finishedAt?: number;
    rating?: number;
    notes?: string;
  }) => {
    await logWatchEntry({ listItemId: listItem._id, ...entry });
  };

  const handleRemoveWatchEntry = async (entryIndex: number) => {
    await removeWatchEntry({ listItemId: listItem._id, entryIndex });
  };

  // Helper functions
  const getSeasonStatus = (seasonNumber: number): StatusValue => {
    const prog = listItem.seasonProgress?.find((p) => p.seasonNumber === seasonNumber);
    return prog?.status ?? "to_watch";
  };

  const getSeasonProgress = (seasonNumber: number) => {
    return listItem.seasonProgress?.find((p) => p.seasonNumber === seasonNumber);
  };

  const formatDate = (timestamp?: number) => {
    return formatDateDisplay(timestamp);
  };

  const commonProps = {
    canEdit,
    listItem,
    priority,
    handleStatusChange,
    handleDelete,
    showSeasons,
    setShowSeasons,
    openSeason,
    setOpenSeason,
    handleSeasonStatusChange,
    getSeasonStatus,
    getSeasonProgress,
    formatDate,
    // New handlers
    handleRatingChange,
    handleSeasonRatingChange,
    handlePriorityChange,
    handleNotesChange,
    handleSeasonNotesChange,
    handleTagsChange,
    handleDatesChange,
    handleSeasonDatesChange,
    activeTab,
    setActiveTab,
    // Episode tracking handlers
    handleAdvanceEpisode,
    handleRewindEpisode,
    handleMarkSeasonWatched,
    handleSetEpisodeWatched,
    handleStartSeasonRewatch,
    handleStopSeasonRewatch,
    handleLogEpisodeRewatch,
    handleRemoveEpisodeRewatch,
    isStartingSeasonRewatch,
    isStoppingSeasonRewatch,
    handleAdvanceSeason,
    handleRewindSeason,
    tvMode,
    // Rewatch handlers
    handleStartRewatch,
    handleLogWatchEntry,
    handleRemoveWatchEntry,
    // Loading flags
    isUpdatingStatus,
    isDeleting,
    isUpdatingRating,
    isUpdatingPriority,
    isUpdatingNotes,
    isUpdatingTags,
    isUpdatingDates,
    isUpdatingSeasonStatus,
    isUpdatingSeasonRating,
    isUpdatingSeasonNotes,
    isUpdatingSeasonDates,
    isAdvancingEpisode,
    isRewindingEpisode,
    isMarkingSeasonWatched,
    isAdvancingSeason,
    isRewindingSeason,
    isStartingRewatch,
    isLoggingWatchEntry,
    isRemovingWatchEntry,
  };

  // Default to minimal card; legacy sizes preserved for backward compat
  if (!size || size === "small") {
    return <MediaCardMinimal {...commonProps} priority={priority} />;
  }

  if (size === "normal" || size === "large") {
    return <MediaCardRegular {...commonProps} size={size} />;
  }

  return <MediaCardMinimal {...commonProps} priority={priority} />;
}
