"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, usePaginatedQuery, useConvex } from "convex/react";
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
import { EditListDialog } from "@/components/EditListDialog";
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
  Download,
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
import { convertToCSV, downloadFile, generateFilename } from "@/lib/export";

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

  // Get all lists (owned + member)
  const lists = useQuery(
    api.lists.getMyLists,
    isLoaded ? {} : "skip"
  );


  const convex = useConvex();
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

  const [isEditListDialogOpen, setIsEditListDialogOpen] = useState(false);
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

  // Helper function to get list role
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

  // Group and sort lists by role
  const groupedLists = useMemo(() => {
    if (!lists || !user) return { creator: [], admin: [], viewer: [] };

    const grouped = {
      creator: [] as typeof lists,
      admin: [] as typeof lists,
      viewer: [] as typeof lists,
    };

    lists.forEach((list) => {
      const role = getListRole(list, user.id);
      if (role && grouped[role]) {
        grouped[role].push(list);
      }
    });

    // Sort each group by creation time (most recent first)
    // TODO: Update to use lastModified or lastAccessedAt when available
    Object.keys(grouped).forEach((key) => {
      grouped[key as keyof typeof grouped].sort(
        (a, b) => (b._creationTime || 0) - (a._creationTime || 0)
      );
    });

    return grouped;
  }, [lists, user]);

  // Get role badge styling
  const getRoleBadgeStyles = (role: "creator" | "admin" | "viewer") => {
    const styles = {
      creator: {
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        section: "text-blue-600 dark:text-blue-400",
        active: "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/50",
        inactive: "border-transparent hover:border-border hover:bg-muted/60",
        separator: "border-blue-100 dark:border-blue-900/30",
      },
      admin: {
        badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
        section: "text-purple-600 dark:text-purple-400",
        active: "border-purple-500 bg-purple-50 dark:border-purple-600 dark:bg-purple-950/50",
        inactive: "border-transparent hover:border-border hover:bg-muted/60",
        separator: "border-purple-100 dark:border-purple-900/30",
      },
      viewer: {
        badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
        section: "text-slate-600 dark:text-slate-400",
        active: "border-slate-500 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50",
        inactive: "border-transparent hover:border-border hover:bg-muted/60",
        separator: "border-slate-100 dark:border-slate-700/30",
      },
    };
    return styles[role];
  };

  // Auto-select first list if available (prioritize by role: creator > admin > viewer)
  useEffect(() => {
    if (lists && lists.length > 0 && !selectedListId) {
      setTimeout(() => {
        const firstList =
          groupedLists.creator[0] ||
          groupedLists.admin[0] ||
          groupedLists.viewer[0];
        if (firstList) {
          setSelectedListId(firstList._id);
        }
      }, 0);
    }
  }, [lists, selectedListId, groupedLists]);

  // Get list items
  const listItems = useQuery(
    api.listItems.getListItems,
    selectedListId ? { listId: selectedListId } : "skip"
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
    setSelectedListId(listId);
  };

  const handleExportCSV = async () => {
    if (!selectedListId) return;

    try {
      const exportData = await convex.query(api.listItems.exportListItems, {
        listId: selectedListId,
      });

      const csv = convertToCSV(exportData);
      const filename = generateFilename(exportData.listName);
      downloadFile(csv, filename);

      // Show success toast
      const { toast } = await import("sonner");
      toast.success("List exported successfully");
    } catch (error) {
      const { toast } = await import("sonner");
      toast.error("Failed to export list");
      console.error("Export error:", error);
    }
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
        {filteredItems.map((item, index) => (
          <MediaCard
            key={item._id}
            canEdit={canEdit}
            listItem={item}
            size={cardSize}
            priority={index < 8} // Priority load first 8 items
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
    <div className="flex min-h-screen bg-background text-foreground w-full max-w-full overflow-x-hidden">
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

        <div className="px-4 py-3 border-b">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsCreateListOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            Create List
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-4">
            {/* Creator Lists */}
            {groupedLists.creator.length > 0 && (
              <div className="space-y-2">
                <div className={`text-xs font-semibold uppercase tracking-wider px-2 ${getRoleBadgeStyles("creator").section}`}>
                  Created by You
                </div>
                {groupedLists.creator.map((list, index) => {
                  const listRole = getListRole(list, user?.id);
                  const isCreator = list.ownerId === user?.id;
                  const roleStyles = getRoleBadgeStyles("creator");
                  return (
                    <div key={list._id}>
                      {index > 0 && (
                        <div className={`border-t my-2 ${roleStyles.separator}`} />
                      )}
                      <div
                        className={`w-full rounded-lg border px-3 py-3 transition-colors flex items-start gap-2
                      ${selectedListId === list._id
                            ? roleStyles.active
                            : roleStyles.inactive
                          }`}
                      >
                      <button
                        onClick={() => {
                          setSelectedListId(list._id);
                          setIsSidebarOpen(false);
                        }}
                        className="flex-1 text-left cursor-pointer flex flex-col items-start gap-1.5 min-w-0"
                      >
                        <div className="w-full font-medium truncate">{list.name}</div>

                        {list.description && (
                          <div className="w-full text-sm text-muted-foreground line-clamp-2">
                            {list.description}
                          </div>
                        )}

                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${roleStyles.badge}`}>
                          Creator
                        </span>
                      </button>

                      {isCreator && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600 flex-shrink-0"
                              title="Delete list"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete List</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &ldquo;{list.name}&rdquo; and all items. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  if (selectedListId === list._id) {
                                    handleDeleteList();
                                  } else {
                                    deleteList({ listId: list._id });
                                  }
                                }}
                                disabled={isDeletingList}
                              >
                                <Trash className="h-3 w-3 mr-1" />
                                {isDeletingList ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Admin Lists */}
            {groupedLists.admin.length > 0 && (
              <div className="space-y-2">
                <div className={`text-xs font-semibold uppercase tracking-wider px-2 ${getRoleBadgeStyles("admin").section}`}>
                  Admin Access
                </div>
                {groupedLists.admin.map((list, index) => {
                  const roleStyles = getRoleBadgeStyles("admin");
                  return (
                    <div key={list._id}>
                      {index > 0 && (
                        <div className={`border-t my-2 ${roleStyles.separator}`} />
                      )}
                      <div
                        className={`w-full rounded-lg border px-3 py-3 transition-colors flex items-start gap-2
                      ${selectedListId === list._id
                            ? roleStyles.active
                            : roleStyles.inactive
                          }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedListId(list._id);
                            setIsSidebarOpen(false);
                          }}
                          className="flex-1 text-left cursor-pointer flex flex-col items-start gap-1.5 min-w-0"
                        >
                          <div className="w-full font-medium truncate">{list.name}</div>

                          {list.description && (
                            <div className="w-full text-sm text-muted-foreground line-clamp-2">
                              {list.description}
                            </div>
                          )}

                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${roleStyles.badge}`}>
                            Admin
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Viewer Lists */}
            {groupedLists.viewer.length > 0 && (
              <div className="space-y-2">
                <div className={`text-xs font-semibold uppercase tracking-wider px-2 ${getRoleBadgeStyles("viewer").section}`}>
                  View Only
                </div>
                {groupedLists.viewer.map((list, index) => {
                  const roleStyles = getRoleBadgeStyles("viewer");
                  return (
                    <div key={list._id}>
                      {index > 0 && (
                        <div className={`border-t my-2 ${roleStyles.separator}`} />
                      )}
                      <div
                        className={`w-full rounded-lg border px-3 py-3 transition-colors flex items-start gap-2
                      ${selectedListId === list._id
                            ? roleStyles.active
                            : roleStyles.inactive
                          }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedListId(list._id);
                            setIsSidebarOpen(false);
                          }}
                          className="flex-1 text-left cursor-pointer flex flex-col items-start gap-1.5 min-w-0"
                        >
                          <div className="w-full font-medium truncate">{list.name}</div>

                          {list.description && (
                            <div className="w-full text-sm text-muted-foreground line-clamp-2">
                              {list.description}
                            </div>
                          )}

                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${roleStyles.badge}`}>
                            Viewer
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden">
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
              <div className="text-lg font-semibold">
                {selectedList?.name ?? "Select a list"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Edit button - all sizes, with outline, text on desktop */}
            {canEdit && selectedList && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden h-9 w-9"
                  onClick={() => setIsEditListDialogOpen(true)}
                  title="Edit list"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden md:flex"
                  onClick={() => setIsEditListDialogOpen(true)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </>
            )}

            {/* Manage Members - all sizes, text on desktop */}
            {canEdit && selectedList && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden h-9 w-9"
                  onClick={() => setIsShareListOpen(true)}
                  title="Manage members"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  className="hidden md:flex"
                  onClick={() => setIsShareListOpen(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Manage Members
                </Button>
              </>
            )}

            {/* Export - Icon only on mobile, text on desktop */}
            {selectedList && (
              <>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  size="icon"
                  className="md:hidden h-9 w-9"
                  title="Export list"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="hidden md:flex"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </>
            )}

            {/* Add Media - Icon only on mobile, text on desktop */}
            {canEdit && (
              <>
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  size="icon"
                  className="md:hidden h-9 w-9"
                  title="Add media"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                </Button>
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="hidden md:flex"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                  Add Media
                </Button>
              </>
            )}

            <ThemeToggle />
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
            <div className="border-b bg-card/80 px-3 py-2 md:px-6 md:py-4 backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1">
                    {/* Removed duplicate title - shown in header */}
                    {selectedList.description && (
                      <>
                        {/* Desktop: show description */}
                        <p className="text-sm text-muted-foreground hidden md:block">
                          {selectedList.description}
                        </p>
                        {/* Mobile: collapsible description */}
                        <details className="md:hidden">
                          <summary className="text-sm text-muted-foreground cursor-pointer hover:underline">
                            Show description
                          </summary>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedList.description}
                          </p>
                        </details>
                      </>
                    )}

                  </div>
                </div>

                {/* Horizontal scrolling status pills */}
                <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
                  <div className="flex gap-1.5 md:gap-2 min-w-max">
                    {VIEW_CHIPS.map((chip) => (
                      <Button
                        key={chip.value}
                        variant="outline"
                        size="sm"
                        className={`rounded-full px-2 py-0.5 md:px-3 md:py-1 border-2 transition-colors text-xs md:text-sm h-7 md:h-9 flex-shrink-0 ${activeView === chip.value
                          ? "border-primary bg-primary text-white hover:bg-primary/85 hover:border-primary hover:text-white dark:border-primary/80 dark:bg-primary/80 dark:hover:bg-primary/70 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                          : "border-border bg-background text-foreground hover:bg-muted/70 hover:border-border"
                          }`}
                        onClick={() => setActiveView(chip.value)}
                      >
                        <span>{chip.label}</span>
                        <span
                          className={`ml-1 md:ml-2 rounded-full border px-1.5 md:px-2 text-[10px] md:text-xs ${activeView === chip.value
                            ? "border-white/70 bg-white/25 text-white dark:border-white/30 dark:bg-white/15"
                            : "border-border bg-secondary text-foreground"
                            }`}
                        >
                          {statusCounts[chip.value]}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  {/* Card size selector - icon buttons */}
                  <div className="hidden md:flex items-center gap-1 border rounded-md p-0.5">
                    <Button
                      variant={cardSize === "small" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCardSize("small")}
                      title="Small cards"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                    </Button>
                    <Button
                      variant={cardSize === "normal" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCardSize("normal")}
                      title="Normal cards"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="7" />
                        <rect x="3" y="14" width="18" height="7" />
                      </svg>
                    </Button>
                    <Button
                      variant={cardSize === "large" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCardSize("large")}
                      title="Large cards"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" />
                      </svg>
                    </Button>
                  </div>

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
            <div className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-5">
              {renderItems()}
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
        listName={selectedList?.name}
        open={isShareListOpen && canEdit}
        onOpenChange={setIsShareListOpen}
      />
      <EditListDialog
        listId={selectedListId ?? ("" as Id<"lists">)}
        initialName={selectedList?.name ?? ""}
        initialDescription={selectedList?.description}
        open={isEditListDialogOpen && !!canEdit && !!selectedList}
        onOpenChange={setIsEditListDialogOpen}
      />
    </div >
  );
}
