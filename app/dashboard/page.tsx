"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useConvex, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { WatchSubSection } from "@/components/section/WatchSection";
import { Id } from "@/convex/_generated/dataModel";
import {
  ArrowUpDown,
  Menu,
  X,
  Edit2,
  Trash,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
import {
  classifyDashboardItems,
  getDefaultDashboardTab,
  type DashboardTab,
} from "@/lib/dashboard-sections";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "movie" | "tv";
type SortOption = "added" | "release" | "rating" | "alpha" | "priority";

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
  const [sortByPerList, setSortByPerList] = useState<Record<string, SortOption>>({});
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isEditListDialogOpen, setIsEditListDialogOpen] = useState(false);
  const [isShareListOpen, setIsShareListOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("current");
  const [tabInitializedForList, setTabInitializedForList] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(() => Date.now());
  const [isRefreshingMedia, setIsRefreshingMedia] = useState(false);

  const refreshListMedia = useAction(api.media.refreshListMedia);
  const refreshCooldown = useQuery(
    api.media.getRefreshCooldown,
    selectedListId ? { listId: selectedListId } : "skip"
  );

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

  useEffect(() => {
    const interval = setInterval(() => setRefreshTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshCooldownRemainingMs = useMemo(() => {
    if (!refreshCooldown?.lastRefreshAt) return 0;
    return Math.max(
      0,
      refreshCooldown.cooldownMs - (refreshTick - refreshCooldown.lastRefreshAt)
    );
  }, [refreshCooldown, refreshTick]);

  const canRefreshMedia = refreshCooldownRemainingMs === 0 && !isRefreshingMedia;

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

  // Get role badge styling - using scale-based utilities
  const getRoleBadgeStyles = (role: "creator" | "admin" | "viewer") => {
    const styles = {
      creator: {
        badge: "role-creator",
        section: "text-[var(--primary-600)] dark:text-[var(--primary-300)]",
        active: "bg-[var(--primary-100)] dark:bg-[var(--primary-700)] shadow-sm ring-1 ring-[var(--primary-600)]/20 dark:ring-[var(--primary-300)]/20",
        inactive: "hover:bg-muted/40 dark:hover:bg-muted/20",
      },
      admin: {
        badge: "role-admin",
        section: "text-[var(--info-600)] dark:text-[var(--info-300)]",
        active: "bg-[var(--info-100)] dark:bg-[var(--info-700)] shadow-sm ring-1 ring-[var(--info-600)]/20 dark:ring-[var(--info-300)]/20",
        inactive: "hover:bg-muted/40 dark:hover:bg-muted/20",
      },
      viewer: {
        badge: "role-viewer",
        section: "text-muted-foreground",
        active: "bg-muted shadow-sm ring-1 ring-border/30",
        inactive: "hover:bg-muted/40 dark:hover:bg-muted/20",
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

  const today = new Date().toISOString().slice(0, 10);

  const sortedItems = useMemo(() => {
    if (!listItems) return undefined;
    let items = [...listItems];

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
        const aP = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] : 0;
        const bP = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] : 0;
        return bP - aP;
      },
    };

    return items.sort(sorters[currentSort]);
  }, [listItems, currentSort, typeFilter]);

  // Section grouping
  const sections = useMemo(() => {
    if (!sortedItems) return undefined;
    return classifyDashboardItems(sortedItems, today);
  }, [sortedItems, today]);

  // Reset to sensible default tab when switching lists
  useEffect(() => {
    if (!sections || !selectedListId) return;
    const listKey = selectedListId.toString();
    if (tabInitializedForList === listKey) return;
    setActiveTab(getDefaultDashboardTab(sections));
    setTabInitializedForList(listKey);
  }, [sections, selectedListId, tabInitializedForList]);

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

    // Clear form fields
    setNewListName("");
    setNewListDescription("");

    // Close the dialog
    setIsCreateListOpen(false);

    // Select the newly created list
    setSelectedListId(listId);
  };

  const handleRefreshMedia = async () => {
    if (!selectedListId || !canRefreshMedia) return;

    setIsRefreshingMedia(true);
    try {
      const result = await refreshListMedia({ listId: selectedListId });
      const { toast } = await import("sonner");
      toast.success(
        result.scheduled === 0
          ? "List is empty — nothing to refresh"
          : `Refreshing ${result.scheduled} title${result.scheduled === 1 ? "" : "s"} from TMDB`
      );
    } catch (error) {
      const { toast } = await import("sonner");
      const message =
        error instanceof Error ? error.message : "Failed to refresh media";
      toast.error(message);
    } finally {
      setIsRefreshingMedia(false);
    }
  };

  const refreshButtonTitle = canRefreshMedia
    ? "Refresh titles from TMDB"
    : `Available in ${Math.ceil(refreshCooldownRemainingMs / 1000)}s`;

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

  const CardGrid = ({
    items,
    newlyReleasedIds,
  }: {
    items: typeof sortedItems;
    newlyReleasedIds?: Set<string>;
  }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {items.map((item, index) => {
          const isNewlyReleased = newlyReleasedIds?.has(item._id);
          return (
            <div
              key={item._id}
              className={cn(
                isNewlyReleased &&
                  "rounded-xl ring-2 ring-[var(--primary-400)] dark:ring-[var(--primary-500)] ring-offset-2 ring-offset-background"
              )}
            >
              {isNewlyReleased && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary-700)] dark:text-[var(--primary-300)] bg-[var(--primary-50)] dark:bg-[var(--primary-950)] rounded-t-xl border-b border-[var(--primary-200)] dark:border-[var(--primary-800)]">
                  New season out
                </div>
              )}
              <MediaCard
                canEdit={canEdit}
                listItem={item}
                priority={index < 6}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderSections = () => {
    if (sections === undefined) {
      // Loading
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MediaCardSkeleton key={i} size="small" />
          ))}
        </div>
      );
    }

    const totalItems =
      sections.watchingNow.length +
      sections.awaitingRelease.length +
      sections.haventStarted.length +
      sections.finished.length;

    if (totalItems === 0) {
      return (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              {typeFilter !== "all"
                ? `No ${typeFilter === "movie" ? "movies" : "TV shows"} in this list yet.`
                : "Add movies and shows to start tracking."}
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const currentCount =
      sections.watchingNow.length + sections.awaitingRelease.length;

    const newlyReleasedIds = new Set(
      sections.awaitingRelease
        .filter((e) => e.newlyReleased)
        .map((e) => e.item._id)
    );

    const awaitingReleaseItems = sections.awaitingRelease.map((e) => e.item);

    const tabCounts = {
      current: currentCount,
      havent_started: sections.haventStarted.length,
      finished: sections.finished.length,
    };

    return (
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DashboardTab)}
        className="w-full"
      >
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto sm:h-9 p-1 gap-1">
          <TabsTrigger value="current" className="text-xs sm:text-sm px-2 sm:px-3">
            Current
            {tabCounts.current > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                {tabCounts.current}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="havent_started" className="text-xs sm:text-sm px-2 sm:px-3">
            Haven&apos;t Started
            {tabCounts.havent_started > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                {tabCounts.havent_started}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finished" className="text-xs sm:text-sm px-2 sm:px-3">
            Finished
            {tabCounts.finished > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                {tabCounts.finished}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4 space-y-6">
          {currentCount === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing in progress. Shows you&apos;re watching or waiting on will appear here.
            </p>
          ) : (
            <>
              {sections.watchingNow.length > 0 && (
                <WatchSubSection
                  title="Watching Now"
                  count={sections.watchingNow.length}
                  defaultOpen={true}
                >
                  <div className="pt-2">
                    <CardGrid items={sections.watchingNow} />
                  </div>
                </WatchSubSection>
              )}
              {sections.awaitingRelease.length > 0 && (
                <WatchSubSection
                  title="Awaiting Release"
                  count={sections.awaitingRelease.length}
                  defaultOpen={true}
                >
                  <div className="pt-2">
                    <CardGrid
                      items={awaitingReleaseItems}
                      newlyReleasedIds={newlyReleasedIds}
                    />
                  </div>
                </WatchSubSection>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="havent_started" className="mt-4">
          {sections.haventStarted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No unwatched items on your list.
            </p>
          ) : (
            <CardGrid items={sections.haventStarted} />
          )}
        </TabsContent>

        <TabsContent value="finished" className="mt-4">
          {sections.finished.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing finished yet.
            </p>
          ) : (
            <CardGrid items={sections.finished} />
          )}
        </TabsContent>
      </Tabs>
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
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar - fixed to side, has its own scroll if needed */}
      <div
        className={`fixed inset-y-0 left-0 z-30 border-r bg-sidebar text-sidebar-foreground transition-all duration-200 md:static md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${isSidebarCollapsed ? "md:w-16" : "md:w-72"} w-72 flex flex-col h-screen md:h-full shrink-0`}
      >
        <div className="flex items-center justify-between bg-gradient-to-b from-sidebar/50 to-transparent px-4 py-4 pb-6">
          {!isSidebarCollapsed && (
            <div>
              <div className="text-sm uppercase tracking-wide text-muted-foreground">
                Lists
              </div>
              <div className="text-lg font-semibold">Watch List</div>
            </div>
          )}
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          {/* Desktop collapse/expand button */}
          <Button
            variant="ghost"
            size="icon"
            className={`hidden md:flex ${isSidebarCollapsed ? "mx-auto" : ""}`}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className={`py-3 pb-5 mb-3 ${isSidebarCollapsed ? "px-2" : "px-4"}`}>
          <Button
            variant="outline"
            className="w-full"
            size={isSidebarCollapsed ? "icon" : "default"}
            onClick={() => setIsCreateListOpen(true)}
            title={isSidebarCollapsed ? "Create List" : undefined}
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
              className={isSidebarCollapsed ? "" : "mr-2"}
            >
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            {!isSidebarCollapsed && "Create List"}
          </Button>
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto ${isSidebarCollapsed ? "p-2" : "p-3"}`}>
          <div className="space-y-4">
            {/* Creator Lists */}
            {groupedLists.creator.length > 0 && (
              <div className="space-y-2">
                {!isSidebarCollapsed && (
                  <div className={`text-xs font-semibold uppercase tracking-wider px-2 ${getRoleBadgeStyles("creator").section}`}>
                    Created by You
                  </div>
                )}
                {groupedLists.creator.map((list, index) => {
                  const listRole = getListRole(list, user?.id);
                  const isCreator = list.ownerId === user?.id;
                  const roleStyles = getRoleBadgeStyles("creator");
                  return (
                    <div key={list._id}>
                      {index > 0 && !isSidebarCollapsed && (
                        <div className="h-2" />
                      )}
                      <div
                        className={`w-full rounded-lg transition-all flex items-start gap-2 ${isSidebarCollapsed ? "p-2 justify-center" : "px-3 py-3"
                          } ${selectedListId === list._id
                            ? roleStyles.active
                            : roleStyles.inactive
                          }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedListId(list._id);
                            setIsSidebarOpen(false);
                          }}
                          className={`text-left cursor-pointer flex items-start gap-1.5 ${isSidebarCollapsed ? "flex-col items-center" : "flex-1 flex-col min-w-0"
                            }`}
                          title={isSidebarCollapsed ? list.name : undefined}
                        >
                          {isSidebarCollapsed ? (
                            <div className="w-8 h-8 rounded-full bg-[var(--primary-600)] dark:bg-[var(--primary-400)] text-[var(--neutral-50)] dark:text-[var(--neutral-800)] flex items-center justify-center font-bold text-sm shadow-sm">
                              {list.name.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <>
                              <div className="w-full font-medium truncate">{list.name}</div>

                              {list.description && (
                                <div className="w-full text-sm text-muted-foreground line-clamp-2">
                                  {list.description}
                                </div>
                              )}
                            </>
                          )}
                        </button>

                        {isCreator && !isSidebarCollapsed && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground flex-shrink-0 rounded-md group"
                                title="Delete list"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash className="h-4 w-4 transition-colors group-hover:text-[var(--danger-600)] dark:group-hover:text-[var(--danger-400)]" />
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
                {!isSidebarCollapsed && (
                  <div className={`text-xs font-semibold uppercase tracking-wider px-2 ${getRoleBadgeStyles("admin").section}`}>
                    Admin Access
                  </div>
                )}
                {groupedLists.admin.map((list, index) => {
                  const roleStyles = getRoleBadgeStyles("admin");
                  return (
                    <div key={list._id}>
                      {index > 0 && !isSidebarCollapsed && (
                        <div className="h-2" />
                      )}
                      <div
                        className={`w-full rounded-lg transition-all flex items-start gap-2 ${isSidebarCollapsed ? "p-2 justify-center" : "px-3 py-3"
                          } ${selectedListId === list._id
                            ? roleStyles.active
                            : roleStyles.inactive
                          }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedListId(list._id);
                            setIsSidebarOpen(false);
                          }}
                          className={`text-left cursor-pointer flex items-start gap-1.5 ${isSidebarCollapsed ? "flex-col items-center" : "flex-1 flex-col min-w-0"
                            }`}
                          title={isSidebarCollapsed ? list.name : undefined}
                        >
                          {isSidebarCollapsed ? (
                            <div className="w-8 h-8 rounded-full bg-[var(--info-600)] dark:bg-[var(--info-400)] text-[var(--neutral-50)] dark:text-[var(--neutral-800)] flex items-center justify-center font-bold text-sm shadow-sm">
                              {list.name.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <>
                              <div className="w-full font-medium truncate">{list.name}</div>

                              {list.description && (
                                <div className="w-full text-sm text-muted-foreground line-clamp-2">
                                  {list.description}
                                </div>
                              )}
                            </>
                          )}
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
                {!isSidebarCollapsed && (
                  <div className={`text-xs font-semibold uppercase tracking-wider px-2 ${getRoleBadgeStyles("viewer").section}`}>
                    View Only
                  </div>
                )}
                {groupedLists.viewer.map((list, index) => {
                  const roleStyles = getRoleBadgeStyles("viewer");
                  return (
                    <div key={list._id}>
                      {index > 0 && !isSidebarCollapsed && (
                        <div className="h-2" />
                      )}
                      <div
                        className={`w-full rounded-lg transition-all flex items-start gap-2 ${isSidebarCollapsed ? "p-2 justify-center" : "px-3 py-3"
                          } ${selectedListId === list._id
                            ? roleStyles.active
                            : roleStyles.inactive
                          }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedListId(list._id);
                            setIsSidebarOpen(false);
                          }}
                          className={`text-left cursor-pointer flex items-start gap-1.5 ${isSidebarCollapsed ? "flex-col items-center" : "flex-1 flex-col min-w-0"
                            }`}
                          title={isSidebarCollapsed ? list.name : undefined}
                        >
                          {isSidebarCollapsed ? (
                            <div className="w-8 h-8 rounded-full bg-[var(--neutral-300)] dark:bg-[var(--neutral-600)] text-[var(--neutral-800)] dark:text-[var(--neutral-100)] flex items-center justify-center font-bold text-sm shadow-sm">
                              {list.name.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <>
                              <div className="w-full font-medium truncate">{list.name}</div>

                              {list.description && (
                                <div className="w-full text-sm text-muted-foreground line-clamp-2">
                                  {list.description}
                                </div>
                              )}
                            </>
                          )}
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

      {/* Main Content Area - fixed header, scrollable media list */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0 bg-background/50">
        {/* HEADER - fixed at top */}
        <div className="shrink-0 z-20 bg-background/95 backdrop-blur-sm">
          {/* Unified Header */}
          <div className="bg-card/80 dark:bg-card/60">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
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

                {/* Refresh TMDB data - available to all list members */}
                {selectedList && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleRefreshMedia}
                      disabled={!canRefreshMedia}
                      size="icon"
                      className="md:hidden h-9 w-9"
                      title={refreshButtonTitle}
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          isRefreshingMedia && "animate-spin"
                        )}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRefreshMedia}
                      disabled={!canRefreshMedia}
                      className="hidden md:flex"
                      title={refreshButtonTitle}
                    >
                      <RefreshCw
                        className={cn(
                          "mr-2 h-4 w-4",
                          isRefreshingMedia && "animate-spin"
                        )}
                      />
                      {refreshCooldownRemainingMs > 0
                        ? `Refresh (${Math.ceil(refreshCooldownRemainingMs / 1000)}s)`
                        : "Refresh"}
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

            {/* Toolbar - sort + type filter */}
            {selectedList && (
              <div className="px-3 py-2 md:px-6 md:py-2 border-t border-border/40">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedList.description && (
                    <p className="w-full text-xs text-muted-foreground hidden md:block mb-1">
                      {selectedList.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select
                      value={currentSort}
                      onValueChange={(value) =>
                        setSortByPerList((prev) => ({
                          ...prev,
                          [selectedListId!.toString()]: value as SortOption,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
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
                  <Select
                    value={typeFilter}
                    onValueChange={(value) => setTypeFilter(value as TypeFilter)}
                  >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
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
            )}
          </div>
        </div>

        {/* Embellished separator between header and content */}
        <div className="relative shrink-0 z-20">
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--primary-400)]/60 to-transparent header-separator-glow"></div>
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--info-400)]/30 to-transparent"></div>
          <div className="h-[3px] bg-gradient-to-r from-transparent via-[var(--primary-400)]/10 to-transparent blur-sm"></div>
        </div>

        {/* SCROLLABLE MEDIA CONTENT AREA */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!isLoaded ? (
            // Show skeletons inside the dashboard layout while user/data load
            <div className="px-4 py-5 md:px-6">
              <div className="sm:columns-2 lg:columns-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="break-inside-avoid mb-3">
                    <MediaCardSkeleton size="small" />
                  </div>
                ))}
              </div>
            </div>
          ) : selectedList ? (
            <div>
              <div className="px-3 pt-4 pb-6 md:px-6 md:pt-5 md:pb-8">
                {renderSections()}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center px-4 py-20 min-h-full">
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
          currentUserId={user?.id}
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
      </div>
    </div>
  );
}
