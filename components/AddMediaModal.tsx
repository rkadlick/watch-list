"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Id } from "@/convex/_generated/dataModel";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import { Loader2 } from "lucide-react";
import { SearchResultSkeleton } from "./media-card/SearchResultSkeleton";

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
  const [targetListId, setTargetListId] = useState<Id<"lists"> | null>(
    selectedListId
  );
  const [visibleCount, setVisibleCount] = useState(12);

  // Ref to store the debounce timeout
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchTMDB = useAction(api.tmdb.searchTMDB);
  const getOrCreateMedia = useAction(api.media.getOrCreateMedia);
  const { mutate: addListItem, isPending: isAddingToList } =
    useMutationWithError(api.listItems.addListItem, {
      successMessage: "Added to list",
    });

  // Keep modal list selection in sync with dashboard selection
  useEffect(() => {
    setTargetListId(selectedListId);
  }, [selectedListId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);

    try {
      const results = await searchTMDB({
        query: searchQuery,
      });

      setSearchResults(results || []);
      setVisibleCount(12);
    } catch {
      // Intentionally silent — search failure is non-fatal
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search handler
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Set loading state immediately for better UX
    setIsSearching(true);

    // Set new timer - search after 500ms of no typing
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchTMDB({
          query: value,
        });

        setSearchResults(results || []);
        setVisibleCount(12);
      } catch {
        // Intentionally silent — search failure is non-fatal
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, [searchTMDB]);

  const handleAddToList = async (listId: Id<"lists">) => {
    if (!selectedMedia || !listId) return;

    // 1. Get or create media (action)
    const mediaId = await getOrCreateMedia({
      tmdbId: selectedMedia.id,
      type: selectedMedia.media_type === "movie" ? "movie" : "tv",
    });

    // 2. Add to list (mutation — wrapped)
    await addListItem({
      listId,
      mediaId,
    });

    // 3. Reset UI on success
    onOpenChange(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia(null);
    setTargetListId(listId);
  };

  const getMediaTitle = (item: any) => {
    return item.title || item.name || "Unknown";
  };

  const getSeasonCount = (item: any) => {
    return (
      item.number_of_seasons ??
      item.season_count ??
      item.seasons?.length ??
      null
    );
  };

  const getMediaPoster = (item: any) => {
    if (item.poster_path) {
      return `https://image.tmdb.org/t/p/w200${item.poster_path}`;
    }
    return null;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${month}-${day}-${year}`;
    } catch {
      return "N/A";
    }
  };

  const listIsSelectable = lists && lists.length > 0;
  const paginatedResults = searchResults.slice(0, visibleCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>
            Search for movies or TV shows to add to your list. Choose a list,
            pick a title, and add without scrolling.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 h-[75vh]">
          {/* Search input - fixed at top */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search for a movie or TV show..."
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Clear debounce timer and search immediately on Enter
                    if (debounceTimerRef.current) {
                      clearTimeout(debounceTimerRef.current);
                    }
                    handleSearch();
                  }
                }}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </div>

          {/* Scrollable results area - shows skeleton OR results OR empty state */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isSearching ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Search Results</h3>
                  <div className="text-xs text-muted-foreground">
                    Searching...
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SearchResultSkeleton key={i} />
                  ))}
                </div>
              </>
            ) : searchResults.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Search Results</h3>
                  <div className="text-xs text-muted-foreground">
                    Showing {Math.min(visibleCount, searchResults.length)} of{" "}
                    {searchResults.length}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedResults
                    .filter(
                      (item) =>
                        item.media_type === "movie" || item.media_type === "tv"
                    )
                    .map((item) => {
                      const seasonCount = getSeasonCount(item);
                      return (
                        <Card
                          key={item.id}
                          className={`cursor-pointer transition-all ${selectedMedia?.id === item.id
                            ? "ring-2 ring-primary"
                            : "hover:shadow-md"
                            }`}
                          onClick={() => setSelectedMedia(item)}
                        >
                          <CardContent className="p-3 flex flex-col gap-2">
                            {getMediaPoster(item) ? (
                              <div className="relative w-full h-48 rounded">
                                <Image
                                  src={getMediaPoster(item)!}
                                  alt={getMediaTitle(item)}
                                  fill
                                  className="object-cover rounded"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-48 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                                No Image
                              </div>
                            )}
                            <div className="space-y-1">
                              <div className="text-sm font-semibold leading-tight">
                                {getMediaTitle(item)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(
                                  item.release_date || item.first_air_date
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {item.media_type}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
                {visibleCount < searchResults.length && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((c) => c + 12)}
                    >
                      Load 12 more
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-muted text-muted-foreground px-4 py-6 text-sm">
                Search for a title to see results.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t pt-3 bg-background sticky bottom-0">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Add to list
              </div>
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
              disabled={!selectedMedia || !targetListId || isAddingToList}
            >
              {isAddingToList ? "Adding..." : "Add to List"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
