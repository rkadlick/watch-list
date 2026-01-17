"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "./ui/Button";
import { useMutationWithError } from "@/lib/hooks/useMutationWithError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/Select";
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

type ShareListDialogProps = {
  listId: Id<"lists">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShareListDialog({
  listId,
  open,
  onOpenChange,
}: ShareListDialogProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "viewer">(
    "viewer"
  );
  const { mutate: addMember, isPending: isAddingMember } = useMutationWithError(api.lists.addMember, {
    successMessage: "Member added",
  });
  const { mutate: removeMember, isPending: isRemovingMember } = useMutationWithError(
    api.lists.removeMember,
    {
      successMessage: "Member removed",
    }
  );
  const { mutate: updateMemberRole, isPending: isUpdatingMemberRole } = useMutationWithError(
    api.lists.updateMemberRole,
    {
      successMessage: "Member role updated",
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
        ...(members?.members.map((m) => m?.clerkId) || [])
      ].filter(Boolean) // Remove undefined/null values
    );

  const searchResults = useQuery(
    api.users.searchUsers,
    searchEmail.trim() ? { email: searchEmail } : "skip"
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Share List</DialogTitle>
        </DialogHeader>

        <h3 className="text-sm font-medium">Add a new member</h3>
        <div className="flex flex-col gap-2">
          <Input
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="Search by email"
          />
          <div className="w-40">
            <Select
              value={selectedRole}
              onValueChange={(value: "admin" | "viewer") =>
                setSelectedRole(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {searchResults && searchResults.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium">Search Results</h4>
            {searchResults.map((result) => (
              <div key={result._id}>
                <p className="text-sm text-muted-foreground">{result.email}</p>
                <Button
                  disabled={existingClerkIds.has(result.clerkId) || isAddingMember}
                  onClick={() => {
                    addMember({
                      listId,
                      clerkId: result.clerkId,
                      role: selectedRole,
                    });
                    setSearchEmail("");
                  }}
                >
                  {isAddingMember ? "Adding..." : "Add"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          searchEmail.trim() &&
          searchResults?.length === 0 && <div className="text-sm text-muted-foreground">No search results</div>
        )}
        {allMembers && allMembers.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium">Current Members</h4>
            {allMembers.map((member) => (
              <div key={member?.clerkId}>
                <p className="text-sm text-muted-foreground">
                  {member?.email} - {member?.role}
                </p>
                {member?.role !== "owner" && (
                  <>
                    <Select
                      value={member?.role || "viewer"}
                      onValueChange={(value: "admin" | "viewer") =>
                        updateMemberRole({
                          listId,
                          clerkId: member?.clerkId || "",
                          role: value,
                        })
                      }
                      disabled={isUpdatingMemberRole || isRemovingMember || isAddingMember}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isRemovingMember}>
                          {isRemovingMember ? "Removing..." : "Remove"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member?.email}?
                            They will lose access to this list.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              removeMember({
                                listId,
                                clerkId: member?.clerkId || "",
                              })
                            }
                          >
                            {isRemovingMember ? "Removing..." : "Remove"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground" >No members</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
