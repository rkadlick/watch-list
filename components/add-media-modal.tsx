"use client";

import { useEffect, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Id } from "@/convex/_generated/dataModel";

interface AddMediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedListId: Id<"lists"> | null;
  lists?: Array<{ _id: Id<"lists">; name: string }>;
  onListSelect?: (listId: Id<"lists">) => void;
}

export function AddMediaModal({
  open,
  onOpenChange,
  selectedListId,
  lists = [],
  onListSelect,
}: AddMediaModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [targetListId, setTargetListId] = useState<Id<"lists"> | null>(selectedListId);
  const [visibleCount, setVisibleCount] = useState(12);

  const searchTMDB = useAction(api.tmdb.searchTMDB);
  const getOrCreateMedia = useAction(api.media.getOrCreateMedia);
  const addListItem = useMutation(api.listItems.addListItem);

  // Keep modal list selection in sync with dashboard selection
  useEffect(() => {
    setTargetListId(selectedListId);
  }, [selectedListId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchTMDB({ query: searchQuery });
      setSearchResults(results || []);
      setVisibleCount(12);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToList = async (listId: Id<"lists">) => {
    if (!selectedMedia || !listId) return;

    try {
      // First, get or create the media (this uses an action which can fetch from TMDB)
      const mediaId = await getOrCreateMedia({
        tmdbId: selectedMedia.id,
        type: selectedMedia.media_type === "movie" ? "movie" : "tv",
      });

      // Then, add it to the list (this uses a mutation)
      await addListItem({
        listId,
        mediaId,
      });
      onOpenChange(false);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedMedia(null);
      setTargetListId(listId);
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item. It may already exist in the list.");
    }
  };

  const getMediaTitle = (item: any) => {
    return item.title || item.name || "Unknown";
  };

  const getPlatform = (item: any) => {
    // TMDB search API doesn't provide streaming service in this response; placeholder until provider data is wired.
    return item.streamingService ?? "Unknown";
  };

  const getSeasonCount = (item: any) => {
    return item.number_of_seasons ?? item.season_count ?? item.seasons?.length ?? null;
  };

  const getMediaPoster = (item: any) => {
    if (item.poster_path) {
      return `https://image.tmdb.org/t/p/w200${item.poster_path}`;
    }
    return null;
  };

  const listIsSelectable = lists && lists.length > 0;
  const paginatedResults = searchResults.slice(0, visibleCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>
            Search for movies or TV shows to add to your list. Choose a list, pick a title, and add without scrolling.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 h-[75vh]">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search for a movie or TV show..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
            {searchResults.length === 0 && (
              <div className="rounded-lg border border-dashed border-muted text-muted-foreground px-4 py-6 text-sm">
                Search for a title to see results.
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Search Results</h3>
                  <div className="text-xs text-muted-foreground">
                    Showing {Math.min(visibleCount, searchResults.length)} of {searchResults.length}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedResults
                    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
                    .map((item) => {
                      const seasonCount = getSeasonCount(item);
                      return (
                        <Card
                          key={item.id}
                          className={`cursor-pointer transition-all ${
                            selectedMedia?.id === item.id
                              ? "ring-2 ring-primary"
                              : "hover:shadow-md"
                          }`}
                          onClick={() => setSelectedMedia(item)}
                        >
                          <CardContent className="p-3 flex flex-col gap-2">
                            {getMediaPoster(item) ? (
                              <img
                                src={getMediaPoster(item)!}
                                alt={getMediaTitle(item)}
                                className="w-full h-48 object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-48 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                                No Image
                              </div>
                            )}
                            <div className="space-y-1">
                              <div className="text-sm font-semibold leading-tight">
                                {getMediaTitle(item)}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {item.media_type} • {item.release_date || item.first_air_date || "N/A"}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div><strong>Platform:</strong> {getPlatform(item)}</div>
                              {item.media_type === "tv" && (
                                <div>
                                  <strong>Seasons:</strong> {seasonCount ?? "N/A"}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
                {visibleCount < searchResults.length && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => setVisibleCount((c) => c + 12)}>
                      Load 12 more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 border-t pt-3 bg-background sticky bottom-0">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Add to list</div>
              {listIsSelectable ? (
                <Select
                  value={targetListId ?? undefined}
                  onValueChange={(value) => {
                    const next = value as Id<"lists">;
                    setTargetListId(next);
                    onListSelect?.(next);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list._id} value={list._id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">
                  Create a list first to add media.
                </div>
              )}
            </div>
            <Button
              className="whitespace-nowrap"
              onClick={() => {
                if (selectedMedia && targetListId) {
                  handleAddToList(targetListId);
                }
              }}
              disabled={!selectedMedia || !targetListId}
            >
              Add to List
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

