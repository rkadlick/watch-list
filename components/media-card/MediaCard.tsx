"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MediaCardProps, StatusValue } from "./types";
import { MediaCardSmall } from "./MediaCardSmall";
import { MediaCardRegular } from "./MediaCardRegular";

export function MediaCard({ listItem, size = "small" }: MediaCardProps) {
  const updateStatus = useMutation(api.listItems.updateStatus);
  const updateSeasonStatus = useMutation(api.listItems.updateSeasonStatus);
  const deleteListItem = useMutation(api.listItems.deleteListItem);
  const [showSeasons, setShowSeasons] = useState(false);
  const [openSeason, setOpenSeason] = useState<string | undefined>(undefined);

  if (!listItem.media) return null;

  const handleStatusChange = async (newStatus: StatusValue) => {
    await updateStatus({ listItemId: listItem._id, status: newStatus });
  };

  const handleSeasonStatusChange = async (seasonNumber: number, status: StatusValue) => {
    await updateSeasonStatus({ listItemId: listItem._id, seasonNumber, status });
  };

  const handleDelete = async () => {
    await deleteListItem({ listItemId: listItem._id });
  };

  const getSeasonStatus = (seasonNumber: number) => {
    const prog = listItem.seasonProgress?.find((p) => p.seasonNumber === seasonNumber);
    return prog?.status ?? "to_watch";
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (size === "small")
    return (
      <MediaCardSmall
        listItem={listItem}
        handleStatusChange={handleStatusChange}
        handleDelete={handleDelete}
        showSeasons={showSeasons}
        setShowSeasons={setShowSeasons}
        openSeason={openSeason}
        setOpenSeason={setOpenSeason}
        handleSeasonStatusChange={handleSeasonStatusChange}
        getSeasonStatus={getSeasonStatus}
        formatDate={formatDate}
      />
    );

  return (
    <MediaCardRegular
      listItem={listItem}
      size={size}
      handleStatusChange={handleStatusChange}
      handleDelete={handleDelete}
      showSeasons={showSeasons}
      setShowSeasons={setShowSeasons}
      openSeason={openSeason}
      setOpenSeason={setOpenSeason}
      handleSeasonStatusChange={handleSeasonStatusChange}
      getSeasonStatus={getSeasonStatus}
      formatDate={formatDate}
    />
  );
}