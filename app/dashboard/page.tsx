"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { AddMediaModal } from "@/components/AddMediaModal";
import { MediaCard } from "@/components/MediaCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowUpDown, Grid, List as ListIcon, Menu, X } from "lucide-react";

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
  const lists = useQuery(api.lists.getMyLists);
  const syncUser = useMutation(api.users.syncUser);
  const createList = useMutation(api.lists.createList);
  const [selectedListId, setSelectedListId] = useState<Id<"lists"> | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [activeView, setActiveView] = useState<StatusView>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cardSize, setCardSize] = useState<CardSize>("small");
  const [sortByPerList, setSortByPerList] = useState<Record<string, SortOption>>({});
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync user when they log in
  useEffect(() => {
    if (isLoaded && user) {
      syncUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: user.fullName || undefined,
        avatarUrl: user.imageUrl || undefined,
      }).catch(console.error);
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

  const listItems = useQuery(
    api.listItems.getListItems,
    selectedListId ? { listId: selectedListId } : "skip"
  );

  const selectedList = lists?.find((list) => list._id === selectedListId);
  const currentSort = selectedListId ? sortByPerList[selectedListId.toString()] ?? "added" : "added";

  const statusCounts = useMemo(() => {
    const counts: Record<StatusView, number> = {
      all: listItems?.length ?? 0,
      to_watch: 0,
      watching: 0,
      watched: 0,
      dropped: 0,
    };
    listItems?.forEach((item) => {
      counts[item.status as StatusView] = (counts[item.status as StatusView] || 0) + 1;
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
        const aDate = a.media?.releaseDate ? new Date(a.media.releaseDate).getTime() : 0;
        const bDate = b.media?.releaseDate ? new Date(b.media.releaseDate).getTime() : 0;
        return bDate - aDate;
      },
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      alpha: (a, b) => (a.media?.title || "").localeCompare(b.media?.title || ""),
      priority: (a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] : 0;
        const bPriority = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] : 0;
        return bPriority - aPriority;
      },
    };

    return items.sort(sorters[currentSort]);
  }, [listItems, activeView, currentSort, typeFilter]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      const listId = await createList({
        name: newListName,
        description: newListDescription || undefined,
      });
      setNewListName("");
      setNewListDescription("");
      setIsCreateListOpen(false);
      setSelectedListId(listId);
    } catch (error) {
      console.error("Error creating list:", error);
    }
  };

  const renderItems = () => {
    if (filteredItems === undefined) {
      return <div className="flex h-64 items-center justify-center">Loading...</div>;
    }
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

    const getGridClasses = () => {
      if (viewMode === "list") {
        return "grid grid-cols-1 gap-3";
      }
      // Grid view with different column counts based on card size
      switch (cardSize) {
        case "small":
          return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3";
        case "normal":
          return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4";
        case "large":
          return "grid grid-cols-1 lg:grid-cols-2 gap-4";
        default:
          return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3";
      }
    };

    return (
      <div className={getGridClasses()}>
        {filteredItems.map((item) => (
          <MediaCard key={item._id} listItem={item} size={cardSize} />
        ))}
      </div>
    );
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 md:static md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-muted-foreground">Lists</div>
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
          <Button variant="outline" className="w-full" onClick={() => setIsCreateListOpen(true)}>
            Create List
          </Button>
          <Button className="w-full" onClick={() => setIsAddModalOpen(true)}>
            Add Media
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {lists?.map((list) => (
              <button
                key={list._id}
                onClick={() => {
                  setSelectedListId(list._id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selectedListId === list._id
                    ? "border-primary/60 bg-primary/5 text-primary"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                }`}
              >
                <div className="font-medium">{list.name}</div>
                {list.description && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {list.description}
                  </div>
                )}
              </button>
            ))}
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
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</div>
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
            <Button onClick={() => setIsAddModalOpen(true)}>Add Media</Button>
          </div>
        </div>

        {selectedList ? (
          <>
            {/* Fixed toolbar section */}
            <div className="border-b bg-card/80 px-4 py-4 md:px-6 backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">{selectedList.name}</h2>
                    {selectedList.description && (
                      <p className="text-muted-foreground mt-1">{selectedList.description}</p>
                    )}
                  </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <ListIcon className="h-4 w-4" />
                  </Button>
                  {viewMode === "grid" && (
                    <Select value={cardSize} onValueChange={(value) => setCardSize(value as CardSize)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {VIEW_CHIPS.map((chip) => (
                  <Button
                    key={chip.value}
                    variant="outline"
                    className={`rounded-full px-3 py-1 border-2 transition-colors ${
                      activeView === chip.value
                        ? "border-primary bg-primary text-white hover:bg-primary/85 hover:border-primary hover:text-white dark:border-primary/80 dark:bg-primary/80 dark:hover:bg-primary/70 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                        : "border-border bg-background text-foreground hover:bg-muted/70 hover:border-border"
                    }`}
                    onClick={() => setActiveView(chip.value)}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`ml-2 rounded-full border px-2 text-xs ${
                        activeView === chip.value
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
                  <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
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
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4">
            <Card className="max-w-lg w-full border-dashed">
              <CardHeader>
                <CardTitle>Welcome to your watch lists</CardTitle>
                <CardDescription>
                  Create your first list to start tracking movies and shows. You can add items from TMDB search once a list exists.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button onClick={() => setIsCreateListOpen(true)}>Create List</Button>
                <Button variant="outline" onClick={() => setIsAddModalOpen(true)} disabled>
                  Add Media
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AddMediaModal
        open={isAddModalOpen}
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
              <label className="text-sm font-medium">Description (Optional)</label>
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
              <Button variant="outline" onClick={() => setIsCreateListOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateList} disabled={!newListName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

