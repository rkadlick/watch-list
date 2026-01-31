import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Helper function to get user's role in a list
// Returns "creator" | "admin" | "viewer" | null
function getUserRole(
  list: { ownerId: string; members: Array<{ clerkId: string; role: "admin" | "viewer" }> },
  clerkId: string
): "creator" | "admin" | "viewer" | null {
  if (list.ownerId === clerkId) {
    return "creator";
  }
  const member = list.members.find((m) => m.clerkId === clerkId);
  return member ? member.role : null;
}

// Helper function to check if user can edit (creator or admin)
function canEdit(role: "creator" | "admin" | "viewer" | null): boolean {
  return role === "creator" || role === "admin";
}

// Helper function to check if user can view (any role)
function canView(role: "creator" | "admin" | "viewer" | null): boolean {
  return role !== null;
}

export const getMyLists = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;

    // OPTIMIZED: Query lists where user is the owner (uses index)
    const ownedLists = await ctx.db
      .query("lists")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", clerkId))
      .collect();

    // For member lists, we still need to scan all lists
    // (can't index array fields efficiently in Convex)
    // But this is acceptable since most users own more lists than they're members of
    const allLists = await ctx.db.query("lists").collect();
    const memberLists = allLists.filter((list) => {
      // Skip if already in ownedLists
      if (list.ownerId === clerkId) {
        return false;
      }
      // Check if user is a member
      return list.members.some((m) => m.clerkId === clerkId);
    });

    // Combine and return
    return [...ownedLists, ...memberLists];
  },
});

export const createList = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const now = Date.now();

    // Validate and sanitize inputs
    const { validateString, LIMITS } = await import("./validation");
    
    const name = validateString(args.name, {
      fieldName: "List name",
      required: true,
      minLength: LIMITS.LIST_NAME_MIN,
      maxLength: LIMITS.LIST_NAME_MAX,
    });

    const description = validateString(args.description, {
      fieldName: "Description",
      required: false,
      maxLength: LIMITS.LIST_DESCRIPTION_MAX,
    });

    if (!name) {
      throw new Error("List name is required");
    }

    return await ctx.db.insert("lists", {
      name,
      ownerId: clerkId,
      members: [],
      description,
      defaultSort: "added",
      updatedAt: now,
    });
  },
});

export const updateList = mutation({
  args: {
    listId: v.id("lists"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    defaultSort: v.optional(
      v.union(
        v.literal("added"),
        v.literal("release"),
        v.literal("rating"),
        v.literal("alpha")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, clerkId);
    if (role !== "creator" && role !== "admin") {
      throw new Error("Not authorized to update this list");
    }

    // Validate and sanitize inputs
    const { validateString, LIMITS } = await import("./validation");

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      const name = validateString(args.name, {
        fieldName: "List name",
        required: true,
        minLength: LIMITS.LIST_NAME_MIN,
        maxLength: LIMITS.LIST_NAME_MAX,
      });
      if (!name) {
        throw new Error("List name cannot be empty");
      }
      updates.name = name;
    }
    if (args.description !== undefined) {
      updates.description = validateString(args.description, {
        fieldName: "Description",
        required: false,
        maxLength: LIMITS.LIST_DESCRIPTION_MAX,
      });
    }
    if (args.defaultSort !== undefined) {
      updates.defaultSort = args.defaultSort;
    }

    await ctx.db.patch(args.listId, updates);
  },
});

export const addMember = mutation({
  args: {
    listId: v.id("lists"),
    clerkId: v.string(),
    role: v.union(v.literal("admin"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const currentUserClerkId = identity.subject;
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, currentUserClerkId);
    if (role !== "creator" && role !== "admin") {
      throw new Error("Not authorized to add members");
    }

    // Validate member limit
    const { validateArrayLength, LIMITS } = await import("./validation");
    validateArrayLength(
      list.members,
      LIMITS.LIST_MEMBERS_MAX - 1, // -1 because we're about to add one
      "members"
    );

    // Check if user is already a member
    if (list.members.some((m) => m.clerkId === args.clerkId)) {
      throw new Error("User is already a member of this list");
    }

    // Check if trying to add the creator
    if (list.ownerId === args.clerkId) {
      throw new Error("Creator is already a member");
    }

    await ctx.db.patch(args.listId, {
      members: [...list.members, { clerkId: args.clerkId, role: args.role }],
      updatedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    listId: v.id("lists"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const currentUserClerkId = identity.subject;
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, currentUserClerkId);
    if (role !== "creator" && role !== "admin") {
      throw new Error("Not authorized to remove members");
    }

    // Cannot remove creator
    if (list.ownerId === args.clerkId) {
      throw new Error("Cannot remove creator from list");
    }

    // Check if user is a member
    const memberIndex = list.members.findIndex((m) => m.clerkId === args.clerkId);
    if (memberIndex === -1) {
      throw new Error("User is not a member of this list");
    }

    await ctx.db.patch(args.listId, {
      members: list.members.filter((m) => m.clerkId !== args.clerkId),
      updatedAt: Date.now(),
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    listId: v.id("lists"),
    clerkId: v.string(),
    role: v.union(v.literal("admin"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const currentUserClerkId = identity.subject;
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const role = getUserRole(list, currentUserClerkId);
    if (role !== "creator" && role !== "admin") {
      throw new Error("Not authorized to update member roles");
    }

    // Cannot change creator's role
    if (list.ownerId === args.clerkId) {
      throw new Error("Cannot change creator's role");
    }

    // Check if user is a member
    const memberIndex = list.members.findIndex((m) => m.clerkId === args.clerkId);
    if (memberIndex === -1) {
      throw new Error("User is not a member of this list");
    }

    const updatedMembers = [...list.members];
    updatedMembers[memberIndex] = { clerkId: args.clerkId, role: args.role };

    await ctx.db.patch(args.listId, {
      members: updatedMembers,
      updatedAt: Date.now(),
    });
  },
});

export const getListMembers = query({
  args: { listId: v.id("lists") },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

        // Fetch owner
        const owner = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) =>
          q.eq("clerkId", list.ownerId)
        )
        .unique();
  
      // Handle missing owner gracefully (shouldn't happen, but be defensive)
      const ownerData = owner ? {
        clerkId: owner.clerkId,
        email: owner.email,
        name: owner.name,
        avatarUrl: owner.avatarUrl,
        role: "owner" as const,
      } : {
        clerkId: list.ownerId,
        email: "unknown@placeholder.local",
        name: "Unknown User",
        avatarUrl: undefined,
        role: "owner" as const,
      };
  
      // Fetch members - filter out users who haven't logged in yet
      const memberPromises = list.members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) =>
            q.eq("clerkId", member.clerkId)
          )
          .unique();
  
        if (!user) {
          // User hasn't logged in yet - hide them from member list
          return null;
        }
  
        return {
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: member.role,
        };
      });

      const allMembers = await Promise.all(memberPromises);
      // Filter out null values (unsynced users)
      const syncedMembers = allMembers.filter((m) => m !== null);

    return {
      owner: ownerData,
      members: syncedMembers,
    };
  }
});

export const deleteList = mutation({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("List not found");
    }

    // Only creator can delete list
    if (list.ownerId !== clerkId) {
      throw new Error("Only creator can delete this list");
    }

    // Delete all list items first
    const listItems = await ctx.db
      .query("listItems")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    for (const item of listItems) {
      await ctx.db.delete(item._id);
    }

    // Delete the list
    await ctx.db.delete(args.listId);
  },
});

