import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Helper function to ensure a user exists in the database
 * This handles race conditions where queries run before syncUser completes
 */
export const ensureUserExists = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    // Create user with validated email
    const email = args.email && args.email.trim() 
      ? args.email 
      : `${args.clerkId}@placeholder.local`; // Fallback for missing email

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email,
      name: args.name,
      avatarUrl: args.avatarUrl,
    });
  },
});

export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate email - don't accept empty strings
    const email = args.email && args.email.trim() 
      ? args.email 
      : `${args.clerkId}@placeholder.local`;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
    }
  },
});

export const searchUsers = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const search = args.email.trim().toLowerCase();

    if (!search) {
      return [];
    }

    // Prefix range: [search, search + '\uffff')
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) =>
        q.gte("email", search)
      )
      .filter((q) =>
        q.lt(q.field("email"), `${search}\uffff`)
      )
      .take(10);

    return users.map((user) => ({
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }));
  },
});

export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", args.clerkId)
      )
      .unique();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  },
});

// ============================================================================
// WEBHOOK MUTATIONS
// ============================================================================

/**
 * Create user from Clerk webhook
 * Called when a new user signs up
 */
export const createUserFromWebhook = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Combine firstName and lastName into name
    const name = [args.firstName, args.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Anonymous";

    // Check if user already exists (idempotency)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name,
        avatarUrl: args.imageUrl,
      });
      return existingUser._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name,
      avatarUrl: args.imageUrl,
    });
  },
});

/**
 * Update user from Clerk webhook
 * Called when user updates their profile
 */
export const updateUserFromWebhook = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = [args.firstName, args.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Anonymous";

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existingUser) {
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        name,
        avatarUrl: args.imageUrl,
      });
    }

    await ctx.db.patch(existingUser._id, {
      email: args.email,
      name,
      avatarUrl: args.imageUrl,
    });
    return existingUser._id;
  },
});

/**
 * Delete user from Clerk webhook
 * Called when user deletes their account
 * This will cascade delete all their data
 */
export const deleteUserFromWebhook = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return;
    }

    // Delete user (database cascade rules will handle related data)
    // Note: You may want to add additional cleanup logic here
    // such as transferring ownership of lists or removing member access
    await ctx.db.delete(user._id);
  },
});