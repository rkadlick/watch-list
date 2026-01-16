import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
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