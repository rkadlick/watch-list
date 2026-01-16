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
  const { mutate: addMember } = useMutationWithError(api.lists.addMember, {
    successMessage: "Member added",
  });
  const { mutate: removeMember } = useMutationWithError(
    api.lists.removeMember,
    {
      successMessage: "Member removed",
    }
  );
  const { mutate: updateMemberRole } = useMutationWithError(
    api.lists.updateMemberRole,
    {
      successMessage: "Member role updated",
    }
  );
  const members = useQuery(
    api.lists.getListMembers,
    open ? { listId } : "skip"
  );
  const existingClerkIds = new Set(
    members?.members.map((m) => m?.clerkId) || []
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

      <h3>Add a new member</h3>
      <div className="flex flex-col gap-2">
        <input
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
          <h4>Search Results</h4>
          {searchResults.map((result) => (
            <div key={result._id}>
              <p>{result.email}</p>
              <Button
                disabled={existingClerkIds.has(result.clerkId)}
                onClick={() =>
                  {
                    addMember({
                      listId,
                      clerkId: result.clerkId,
                      role: selectedRole,
                    });
                    setSearchEmail("");
                  }
                }
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      ) : (
        searchEmail.trim() &&
        searchResults?.length === 0 && <div>No search results</div>
      )}
      {members && members.members.length > 0 ? (
        <div>
          <h4>Current Members</h4>
          {members.members.map((member) => (
            <div key={member?.clerkId}>
              <p>{member?.email}</p>
              <Select
                value={member?.role || "viewer"}
                onValueChange={(value: "admin" | "viewer") =>
                  updateMemberRole({
                    listId,
                    clerkId: member?.clerkId || "",
                    role: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  removeMember({ listId, clerkId: member?.clerkId || "" })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div>No members</div>
      )}
    </DialogContent>
    </Dialog>
  );
}
