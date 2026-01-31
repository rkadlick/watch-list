"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Masonry from "react-masonry-css";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { AddMediaModal } from "@/components/AddMediaModal";
import { MediaCard } from "@/components/media-card/MediaCard";
import { ShareListDialog } from "@/components/ShareListDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Id } from "@/convex/_generated/dataModel";
import {
  ArrowUpDown,
  Grid,
  Menu,
  X,
  Edit2,
  Check,
  X as XIcon,
  Share,
  Trash,
  Loader2,
} from "lucide-react";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogTrigger,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/AlertDialog";
import { MediaCardSkeleton } from "@/components/media-card/MediaCardSkeleton";

type StatusView = "all" | "to_watch" | "watching" | "watched" | "dropped";
type SortOption = "added" | "release" | "rating" | "alpha" | "priority";
type TypeFilter = "all" | "movie" | "tv";
type CardSize = "small" | "normal" | "large";

const VIEW_CHIPS: { value: StatusView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "to_watch", label: "To Watch" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
  { value: "dropped", label: "Dropped" },
];

export default function DashboardPage() {
  const { user, isLoaded } = useUser();

  // Use paginated query for lists (50 per page)
  const {
    results: lists,
    status: listsStatus,
    loadMore: loadMoreLists,
  } = usePaginatedQuery(
    api.lists.getMyLists,
    isLoaded ? {} : "skip",
    { initialNumItems: 50 }
  );

  const syncUser = useMutation(api.users.syncUser);
  const { mutate: createList, isPending: isCreatingList } =
    useMutationWithError(api.lists.createList, {
      successMessage: "List created",
    });
  const { mutate: updateList, isPending: isUpdatingList } =
    useMutationWithError(api.lists.updateList, {
      successMessage: "List updated",
    });
  const { mutate: deleteList, isPending: isDeletingList } =
    useMutationWithError(api.lists.deleteList, {
      successMessage: "List deleted",
    });
  const [selectedListId, setSelectedListId] = useState<Id<"lists"> | null>(
    null
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [activeView, setActiveView] = useState<StatusView>("all");
  const [cardSize, setCardSize] = useState<CardSize>("small");
  const [sortByPerList, setSortByPerList] = useState<
    Record<string, SortOption>
  >({});
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<Id<"lists"> | null>(null);
  const [editListName, setEditListName] = useState("");
  const [editListDescription, setEditListDescription] = useState("");
  const [isShareListOpen, setIsShareListOpen] = useState(false);

  // Sync user when they log in - ensure this completes before queries run
  useEffect(() => {
    if (isLoaded && user) {
      // Get email with fallback
      const email = user.emailAddresses[0]?.emailAddress;

      // Only sync if we have a valid email
      if (email && email.trim()) {
        syncUser({
          clerkId: user.id,
          email,
          name: user.fullName || undefined,
          avatarUrl: user.imageUrl || undefined,
        }).catch((error) => {
          // Silent fail for user sync - not critical for UX
          if (process.env.NODE_ENV === "development") {
            console.error("User sync failed:", error);
          }
        });
      } else {
        // No email - sync with placeholder
        syncUser({
          clerkId: user.id,
          email: `${user.id}@placeholder.local`,
          name: user.fullName || undefined,
          avatarUrl: user.imageUrl || undefined,
        }).catch((error) => {
          if (process.env.NODE_ENV === "development") {
            console.error("User sync failed:", error);
          }
        });
      }
    }
  }, [isLoaded, user, syncUser]);

  // Auto-select first list if available
  useEffect(() => {
    if (lists && lists.length > 0 && !selectedListId) {
      setTimeout(() => {
        setSelectedListId(lists[0]._id);
      }, 0);
    }
  }, [lists, selectedListId]);

  // Use paginated query for list items (50 per page)
  const {
    results: listItems,
    status: listItemsStatus,
    loadMore: loadMoreItems,
  } = usePaginatedQuery(
    api.listItems.getListItems,
    selectedListId ? { listId: selectedListId } : "skip",
    { initialNumItems: 50 }
  );

  const selectedList = lists?.find((list) => list._id === selectedListId);
  const currentSort = selectedListId
    ? (sortByPerList[selectedListId.toString()] ?? "added")
    : "added";

  const statusCounts = useMemo(() => {
    const counts: Record<StatusView, number> = {
      all: listItems?.length ?? 0,
      to_watch: 0,
      watching: 0,
      watched: 0,
      dropped: 0,
    };
    listItems?.forEach((item) => {
      counts[item.status as StatusView] =
        (counts[item.status as StatusView] || 0) + 1;
    });
    return counts;
  }, [listItems]);

  const filteredItems = useMemo(() => {
    if (!listItems) return undefined;
    let items = [...listItems];
    if (activeView !== "all") {
      items = items.filter((item) => item.status === activeView);
    }
    if (typeFilter !== "all") {
      items = items.filter((item) => item.media?.type === typeFilter);
    }

    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const sorters: Record<SortOption, (a: any, b: any) => number> = {
      added: (a, b) => (b._creationTime || 0) - (a._creationTime || 0),
      release: (a, b) => {
        const aDate = a.media?.releaseDate
          ? new Date(a.media.releaseDate).getTime()
          : 0;
        const bDate = b.media?.releaseDate
          ? new Date(b.media.releaseDate).getTime()
          : 0;
        return bDate - aDate;
      },
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      alpha: (a, b) =>
        (a.media?.title || "").localeCompare(b.media?.title || ""),
      priority: (a, b) => {
        const aPriority = a.priority
          ? priorityOrder[a.priority as keyof typeof priorityOrder]
          : 0;
        const bPriority = b.priority
          ? priorityOrder[b.priority as keyof typeof priorityOrder]
          : 0;
        return bPriority - aPriority;
      },
    };

    return items.sort(sorters[currentSort]);
  }, [listItems, activeView, currentSort, typeFilter]);

  const currentRole = useMemo(() => {
    if (!selectedList || !user) return null;

    if (selectedList.ownerId === user.id) {
      return "creator";
    }

    const member = selectedList.members?.find((m) => m.clerkId === user.id);

    return member?.role ?? null;
  }, [selectedList, user]);

  const canEdit = currentRole === "creator" || currentRole === "admin";

  function getListRole(
    list: {
      ownerId: string;
      members?: Array<{ clerkId: string; role: string }>;
    },
    userId: string | null | undefined
  ): "creator" | "admin" | "viewer" | null {
    if (!userId) return null;
    if (list.ownerId === userId) return "creator";
    const member = list.members?.find((m) => m.clerkId === userId);
    return (member?.role as "admin" | "viewer") ?? null;
  }

  const handleDeleteList = async () => {
    if (!selectedList) return;

    await deleteList({ listId: selectedList._id });

    const remainingLists = lists?.filter((l) => l._id !== selectedList._id);

    setSelectedListId(remainingLists?.[0]?._id ?? null);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    const listId = await createList({
      name: newListName,
      description: newListDescription || undefined,
    });
    setNewListName("");
    setNewListDescription("");
    setIsCreateListOpen(false);
    setSelectedListId(listId);
  };

  const renderItems = () => {
    // === Loading (data not yet available)
    if (filteredItems === undefined) {
      return (
        <Masonry
          breakpointCols={{
            default: cardSize === "large" ? 2 : 4,
            1600: cardSize === "large" ? 2 : 4,
            1280: cardSize === "large" ? 2 : 3,
            1024: cardSize === "large" ? 2 : 2,
            768: 1,
          }}
          className="flex gap-4"
          columnClassName="masonry-column flex flex-col gap-4"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <MediaCardSkeleton key={i} size={cardSize} />
          ))}
        </Masonry>
      );
    }

    // === Empty state
    if (filteredItems.length === 0) {
      return (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No items match this view</CardTitle>
            <CardDescription>
              Try another status, filter, or add media to this list.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    // === Ready state — show cards
    const breakpoints = {
      default: cardSize === "large" ? 2 : 4,
      1600: cardSize === "large" ? 2 : 4,
      1280: cardSize === "large" ? 2 : 3,
      1024: cardSize === "large" ? 2 : 2,
      768: 1,
    };

    return (
      <Masonry
        breakpointCols={breakpoints}
        className="flex gap-4"
        columnClassName="masonry-column flex flex-col gap-4"
      >
        {filteredItems.map((item) => (
          <MediaCard
            key={item._id}
            canEdit={canEdit}
            listItem={item}
            size={cardSize}
          />
        ))}
      </Masonry>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Please sign in
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 md:static md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-muted-foreground">
              Lists
            </div>
            <div className="text-lg font-semibold">Watch List</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsCreateListOpen(true)}
            disabled={isCreatingList}
          >
            {isCreatingList ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create List"
            )}
          </Button>
          {canEdit && (
            <Button className="w-full" onClick={() => setIsAddModalOpen(true)}>
              Add Media
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {lists?.map((list) => {
              const listRole = getListRole(list, user?.id);
              return (
                <button
                  key={list._id}
                  onClick={() => {
                    setSelectedListId(list._id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors cursor-pointer flex flex-col items-start gap-1
                ${selectedListId === list._id
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-transparent hover:border-border hover:bg-muted/60"
                    }`}
                >
                  <div className="w-full font-medium truncate">{list.name}</div>

                  {list.description && (
                    <div className="w-full text-sm text-muted-foreground line-clamp-2">
                      {list.description}
                    </div>
                  )}

                  <div className="w-full text-xs text-muted-foreground capitalize">
                    {listRole === "creator"
                      ? "Creator"
                      : listRole === "admin"
                        ? "Admin"
                        : listRole === "viewer"
                          ? "Viewer"
                          : "Unknown"}
                  </div>
                </button>
              );
            })}

            {/* Load More button for lists */}
            {listsStatus === "CanLoadMore" && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  onClick={() => loadMoreLists(50)}
                  className="w-full"
                  size="sm"
                >
                  Load More Lists
                </Button>
              </div>
            )}

            {listsStatus === "LoadingMore" && (
              <div className="mt-2 text-center text-sm text-muted-foreground">
                Loading more lists...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Dashboard
              </div>
              <div className="text-lg font-semibold">
                {selectedList?.name ?? "Select a list"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => setIsCreateListOpen(true)}>
              Create List
            </Button>
            {canEdit && (
              <Button onClick={() => setIsAddModalOpen(true)}>Add Media</Button>
            )}
          </div>
        </div>
        {!isLoaded ? (
          // Show skeletons inside the dashboard layout while user/data load
          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
            <div
              className="
        grid 
        gap-6 
        sm:grid-cols-2 
        md:grid-cols-3 
        lg:grid-cols-4 
        xl:grid-cols-5
      "
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <MediaCardSkeleton key={i} size={cardSize} />
              ))}
            </div>
          </div>
        ) : selectedList ? (
          <>
            {/* Fixed toolbar section */}
            <div className="border-b bg-card/80 px-4 py-4 md:px-6 backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1">
                    {editingListId === selectedList._id && canEdit ? (
                      <div className="space-y-2">
                        <Input
                          value={editListName}
                          onChange={(e) => setEditListName(e.target.value)}
                          className="text-2xl font-semibold h-auto py-1 px-0 border-0 border-b-2 border-primary focus-visible:ring-0 rounded-none"
                          placeholder="List name"
                          autoFocus
                        />
                        <Input
                          value={editListDescription}
                          onChange={(e) =>
                            setEditListDescription(e.target.value)
                          }
                          className="text-muted-foreground h-auto py-1 px-0 border-0 border-b border-primary/50 focus-visible:ring-0 rounded-none"
                          placeholder="Description (optional)"
                        />
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            disabled={isUpdatingList}
                            onClick={async () => {
                              await updateList({
                                listId: selectedList._id,
                                name: editListName || undefined,
                                description: editListDescription || undefined,
                              });
                              setEditingListId(null);
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {isUpdatingList ? "Updating..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingListId(null);
                              setEditListName("");
                              setEditListDescription("");
                            }}
                          >
                            <XIcon className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-2xl font-semibold">
                          {selectedList.name}
                        </h2>
                        {selectedList.description && (
                          <p className="text-muted-foreground mt-1">
                            {selectedList.description}
                          </p>
                        )}
                        {selectedList.ownerId === user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="mt-2"
                              >
                                <Trash className="h-3 w-3 mr-1" />
                                Delete List
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete List</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the list and all
                                  items. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteList}
                                  disabled={isDeletingList}
                                >
                                  <Trash className="h-3 w-3 mr-1" />
                                  {isDeletingList ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {canEdit && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2"
                              onClick={() => {
                                setEditingListId(selectedList._id);
                                setEditListName(selectedList.name);
                                setEditListDescription(
                                  selectedList.description || ""
                                );
                              }}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsShareListOpen(true);
                              }}
                            >
                              <Share className="h-3 w-3 mr-1" />
                              Manage Members ({selectedList.members?.length + 1}
                              )
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={cardSize}
                      onValueChange={(value) => setCardSize(value as CardSize)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {VIEW_CHIPS.map((chip) => (
                    <Button
                      key={chip.value}
                      variant="outline"
                      className={`rounded-full px-3 py-1 border-2 transition-colors ${activeView === chip.value
                        ? "border-primary bg-primary text-white hover:bg-primary/85 hover:border-primary hover:text-white dark:border-primary/80 dark:bg-primary/80 dark:hover:bg-primary/70 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                        : "border-border bg-background text-foreground hover:bg-muted/70 hover:border-border"
                        }`}
                      onClick={() => setActiveView(chip.value)}
                    >
                      <span>{chip.label}</span>
                      <span
                        className={`ml-2 rounded-full border px-2 text-xs ${activeView === chip.value
                          ? "border-white/70 bg-white/25 text-white dark:border-white/30 dark:bg-white/15"
                          : "border-border bg-secondary text-foreground"
                          }`}
                      >
                        {statusCounts[chip.value]}
                      </span>
                    </Button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={currentSort}
                      onValueChange={(value) =>
                        setSortByPerList((prev) => ({
                          ...prev,
                          [selectedListId!.toString()]: value as SortOption,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="added">Date added</SelectItem>
                        <SelectItem value="release">Release year</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                        <SelectItem value="alpha">A–Z</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={typeFilter}
                      onValueChange={(value) =>
                        setTypeFilter(value as TypeFilter)
                      }
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="movie">Movies</SelectItem>
                        <SelectItem value="tv">TV shows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable card container */}
            <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
              {renderItems()}

              {/* Load More button for list items */}
              {listItemsStatus === "CanLoadMore" && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => loadMoreItems(50)}
                    className="w-full max-w-md"
                  >
                    Load More Items
                  </Button>
                </div>
              )}

              {listItemsStatus === "LoadingMore" && (
                <div className="flex justify-center mt-6">
                  <div className="text-sm text-muted-foreground">
                    Loading more items...
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4">
            <Card className="max-w-lg w-full border-dashed">
              <CardHeader>
                <CardTitle>Welcome to your watch lists</CardTitle>
                <CardDescription>
                  Create your first list to start tracking movies and shows. You
                  can add items from TMDB search once a list exists.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button onClick={() => setIsCreateListOpen(true)}>
                  Create List
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled
                >
                  Add Media
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AddMediaModal
        open={isAddModalOpen && canEdit}
        onOpenChange={setIsAddModalOpen}
        selectedListId={selectedListId}
        lists={lists ?? []}
        onListSelect={(listId) => setSelectedListId(listId)}
      />

      <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Create a new list to organize your movies and TV shows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">List Name</label>
              <Input
                placeholder="My Watch List"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateList();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Description (Optional)
              </label>
              <Input
                placeholder="A list of shows I want to binge"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateList();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateListOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateList} disabled={!newListName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ShareListDialog
        listId={selectedListId ?? ("" as Id<"lists">)}
        open={isShareListOpen && canEdit}
        onOpenChange={setIsShareListOpen}
      />
    </div>
  );
}
