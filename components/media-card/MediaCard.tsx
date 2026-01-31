"use client";

import { useState } from "react";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import { api } from "@/convex/_generated/api";
import type { MediaCardProps, StatusValue } from "./types";
import { MediaCardSmall } from "./MediaCardSmall";
import { MediaCardRegular } from "./MediaCardRegular";
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
    // NEW loading flags
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
  };

  if (size === "small") {
    return <MediaCardSmall {...commonProps} />;
  }

  return <MediaCardRegular {...commonProps} size={size} />;
}
