"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useAction } from "convex/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Id } from "@/convex/_generated/dataModel";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import { getMediaBlurPlaceholder } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { Film, Loader2, Tv } from "lucide-react";
import { SearchResultSkeleton } from "./media-card/SearchResultSkeleton";

interface AddMediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedListId: Id<"lists"> | null;
  lists?: Array<{ _id: Id<"lists">; name: string; ownerId: string }>;
  onListSelect?: (listId: Id<"lists">) => void;
  currentUserId?: string;
}

export function AddMediaModal({
  open,
  onOpenChange,
  selectedListId,
  lists = [],
  onListSelect,
  currentUserId,
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

  const getMediaImage = (item: any) => {
    if (item.poster_path) {
      return `https://image.tmdb.org/t/p/w154${item.poster_path}`;
    }
    if (item.backdrop_path) {
      return `https://image.tmdb.org/t/p/w300${item.backdrop_path}`;
    }
    return null;
  };

  const getMediaYear = (item: any) => {
    const dateString = item.release_date || item.first_air_date;
    if (!dateString) return null;
    const year = new Date(dateString).getFullYear();
    return Number.isNaN(year) ? null : year;
  };

  // Filter lists to only show creator-owned lists
  const creatorLists = currentUserId
    ? lists.filter(list => list.ownerId === currentUserId)
    : lists;
  const listIsSelectable = creatorLists && creatorLists.length > 0;
  const paginatedResults = searchResults.slice(0, visibleCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-xl max-h-[90vh] overflow-hidden p-4 sm:p-6 gap-3">
        <DialogHeader className="min-w-0">
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>
            Search for a movie or TV show, select a title, and add it to your
            list.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 min-h-0 min-w-0 w-full max-h-[min(70vh,680px)]">
          <div className="flex gap-2 min-w-0 w-full">
            <Input
              className="min-w-0 flex-1"
              placeholder="Search for a movie or TV show..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }
                  handleSearch();
                }
              }}
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="shrink-0"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>

          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-3 pb-1 w-full min-w-0">
              {isSearching ? (
                <>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <h3 className="text-sm font-semibold shrink-0">Search Results</h3>
                    <div className="text-xs text-muted-foreground truncate">
                      Searching...
                    </div>
                  </div>
                  <div className="space-y-2 w-full min-w-0">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SearchResultSkeleton key={i} />
                    ))}
                  </div>
                </>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <h3 className="text-sm font-semibold shrink-0">Search Results</h3>
                    <div className="text-xs text-muted-foreground truncate">
                      Showing {Math.min(visibleCount, searchResults.length)} of{" "}
                      {searchResults.length}
                    </div>
                  </div>
                  <div className="space-y-2 w-full min-w-0">
                    {paginatedResults
                      .filter(
                        (item) =>
                          item.media_type === "movie" ||
                          item.media_type === "tv"
                      )
                      .map((item) => {
                        const seasonCount = getSeasonCount(item);
                        const isSelected = selectedMedia?.id === item.id;
                        const isMovie = item.media_type === "movie";
                        const imageUrl = getMediaImage(item);
                        const year = getMediaYear(item);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={cn(
                              "surface-card relative w-full max-w-full min-w-0 box-border text-left transition-colors",
                              "flex items-center gap-2.5 px-2 py-1.5",
                              isSelected
                                ? "ring-2 ring-inset ring-primary bg-primary/5"
                                : "hover:bg-muted/40"
                            )}
                            onClick={() => setSelectedMedia(item)}
                          >
                            <div
                              className="absolute top-1.5 right-1.5 text-muted-foreground pointer-events-none"
                              aria-hidden
                            >
                              {isMovie ? (
                                <Film className="h-3 w-3" />
                              ) : (
                                <Tv className="h-3 w-3" />
                              )}
                            </div>

                            <div className="relative flex-shrink-0 w-11 aspect-[2/3] rounded-md bg-muted overflow-hidden">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={getMediaTitle(item)}
                                  fill
                                  className="object-contain"
                                  sizes="44px"
                                  placeholder="blur"
                                  blurDataURL={getMediaBlurPlaceholder(
                                    isMovie ? "movie" : "tv"
                                  )}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                                  {isMovie ? "🎬" : "📺"}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-semibold text-sm leading-tight truncate">
                                {getMediaTitle(item)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                                {year && <span>{year}</span>}
                                {!isMovie && seasonCount && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {seasonCount}{" "}
                                      {seasonCount === 1 ? "season" : "seasons"}
                                    </span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{isMovie ? "Movie" : "TV"}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  {visibleCount < searchResults.length && (
                    <div className="flex justify-center pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleCount((c) => c + 12)}
                      >
                        Load 12 more
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-muted text-muted-foreground px-4 py-6 text-sm text-center">
                  Search for a title to see results.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end border-t pt-4 shrink-0 min-w-0 w-full">
            <div className="flex-1 min-w-0 w-full">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {creatorLists.map((list) => (
                      <SelectItem key={list._id} value={list._id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Create a list first to add media.
                </div>
              )}
            </div>
            <Button
              className="w-full sm:w-auto shrink-0"
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
