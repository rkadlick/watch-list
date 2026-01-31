"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "./ui/Button";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/Dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/AlertDialog";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { RadioGroup, RadioGroupItem } from "./ui/RadioGroup";
import { Label } from "./ui/Label";
import { Separator } from "./ui/Separator";
import { ChevronRight, Crown, Search, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ShareListDialogProps = {
  listId: Id<"lists">;
  listName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShareListDialog({
  listId,
  listName = "this list",
  open,
  onOpenChange,
}: ShareListDialogProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const { mutate: addMember, isPending: isAddingMember } = useMutationWithError(
    api.lists.addMember,
    {
      successMessage: "Member added",
    }
  );
  const { mutate: removeMember, isPending: isRemovingMember } = useMutationWithError(
    api.lists.removeMember,
    {
      successMessage: "Member removed",
    }
  );
  const { mutate: updateMemberRole, isPending: isUpdatingMemberRole } = useMutationWithError(
    api.lists.updateMemberRole,
    {
      successMessage: "Role updated",
    }
  );

  const members = useQuery(
    api.lists.getListMembers,
    open ? { listId } : "skip"
  );

  const allMembers = members
    ? [
      {
        ...members.owner,
        role: "owner" as const,
      },
      ...members.members,
    ]
    : [];

  const existingClerkIds = new Set(
    [
      members?.owner?.clerkId,
      ...(members?.members.map((m) => m?.clerkId) || []),
    ].filter(Boolean)
  );

  const searchResults = useQuery(
    api.users.searchUsers,
    searchEmail.trim() ? { email: searchEmail } : "skip"
  );

  const handleAddMember = (clerkId: string) => {
    addMember({
      listId,
      clerkId,
      role: "viewer", // Always add as viewer
    });
    setSearchEmail("");
  };

  const toggleExpand = (memberId: string) => {
    setExpandedMemberId((prev) => (prev === memberId ? null : memberId));
  };

  const handleRoleChange = (clerkId: string, role: "admin" | "viewer") => {
    updateMemberRole({ listId, clerkId, role });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
            <Crown className="h-3 w-3 mr-1" />
            Creator
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">
            Admin
          </Badge>
        );
      case "viewer":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700">
            Viewer
          </Badge>
        );
      default:
        return null;
    }
  };

  const memberCount = members ? members.members.length + 1 : 0; // +1 for owner

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{listName}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Add Member Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Add Member</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Search by email..."
                className="pl-9 pr-9"
              />
              {searchEmail && (
                <button
                  onClick={() => setSearchEmail("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Search Results</p>
                {searchResults.map((result) => {
                  const isExisting = existingClerkIds.has(result.clerkId);
                  return (
                    <div
                      key={result._id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {result.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{result.name || result.email}</p>
                          <p className="text-xs text-muted-foreground">{result.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={isExisting || isAddingMember}
                        onClick={() => handleAddMember(result.clerkId)}
                      >
                        {isExisting ? (
                          "Already a member"
                        ) : isAddingMember ? (
                          "Adding..."
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {searchEmail.trim() && searchResults?.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No users found with that email
              </div>
            )}
          </div>

          <Separator />

          {/* Current Members Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Current Members</h3>
              <span className="text-xs text-muted-foreground">
                {memberCount}/50
              </span>
            </div>

            {allMembers.length > 0 ? (
              <div className="space-y-2">
                {allMembers.map((member) => {
                  const isOwner = member.role === "owner";
                  const isExpanded = expandedMemberId === member.clerkId;

                  return (
                    <div
                      key={member.clerkId}
                      className={cn(
                        "rounded-lg border bg-card transition-all",
                        isOwner && "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      )}
                    >
                      {/* Member Row */}
                      <button
                        onClick={() => !isOwner && toggleExpand(member.clerkId)}
                        disabled={isOwner}
                        className={cn(
                          "w-full p-3 flex items-center gap-3 text-left transition-colors",
                          !isOwner && "hover:bg-accent/50 cursor-pointer"
                        )}
                      >
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {member.email?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.name || member.email}
                            {isOwner && " (You)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>

                        {/* Role Badge */}
                        <div className="flex items-center gap-2">
                          {getRoleBadge(member.role)}
                          {!isOwner && (
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                isExpanded && "rotate-90"
                              )}
                            />
                          )}
                        </div>
                      </button>

                      {/* Expanded Content (only for non-owners) */}
                      {!isOwner && (
                        <div
                          className={cn(
                            "overflow-hidden transition-all duration-200",
                            isExpanded ? "max-h-40" : "max-h-0"
                          )}
                        >
                          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
                            {/* Role Selector */}
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                Change Role
                              </Label>
                              <RadioGroup
                                value={member.role}
                                onValueChange={(value) =>
                                  handleRoleChange(member.clerkId, value as "admin" | "viewer")
                                }
                                disabled={isUpdatingMemberRole}
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="admin" id={`${member.clerkId}-admin`} />
                                  <Label htmlFor={`${member.clerkId}-admin`} className="text-sm font-normal cursor-pointer">
                                    Admin
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="viewer" id={`${member.clerkId}-viewer`} />
                                  <Label htmlFor={`${member.clerkId}-viewer`} className="text-sm font-normal cursor-pointer">
                                    Viewer
                                  </Label>
                                </div>
                              </RadioGroup>
                            </div>

                            {/* Remove Button */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="w-full"
                                  disabled={isRemovingMember}
                                >
                                  {isRemovingMember ? "Removing..." : "Remove Member"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {member.email}? They will lose
                                    access to this list.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      removeMember({
                                        listId,
                                        clerkId: member.clerkId,
                                      })
                                    }
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No members yet
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
