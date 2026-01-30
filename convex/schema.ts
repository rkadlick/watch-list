import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({ 
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()), 
    avatarUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]).index("by_email", ["email"]),

  lists: defineTable({
    name: v.string(),
    ownerId: v.string(), // Clerk ID - Creator role (implicit)
    members: v.array(
      v.object({
        clerkId: v.string(),
        role: v.union(v.literal("admin"), v.literal("viewer")),
      })
    ),
    description: v.optional(v.string()),
    defaultSort: v.optional(
      v.union(
        v.literal("added"),
        v.literal("release"),
        v.literal("rating"),
        v.literal("alpha")
      )
    ),
    updatedAt: v.number(), // Timestamp - updated on list modifications
  }),

  media: defineTable({
    tmdbId: v.number(),
    type: v.union(v.literal("movie"), v.literal("tv")),
    title: v.string(),
    posterUrl: v.optional(v.string()),
    backdropUrl: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    genres: v.array(
      v.object({
        id: v.number(),
        name: v.string(),
      })
    ),
    overview: v.optional(v.string()),
    tagline: v.optional(v.string()),
    voteAverage: v.optional(v.number()),
    lastAirDate: v.optional(v.string()),
    watchProviders: v.optional(
      v.array(
        v.object({
          providerId: v.number(),
          providerName: v.string(),
          logoPath: v.optional(v.string()),
          displayPriority: v.number(),
        })
      )
    ),
    tmdbRaw: v.any(), // Store full JSON response here for safety
    totalSeasons: v.optional(v.number()),
    totalEpisodes: v.optional(v.number()),
    seasonData: v.optional(
      v.array(
        v.object({
          seasonNumber: v.number(),
          episodeCount: v.number(),
          airDate: v.optional(v.string()),
        })
      )
    ),
  }).index("by_tmdb_id", ["tmdbId"]),

  listItems: defineTable({
    listId: v.id("lists"),
    mediaId: v.id("media"),
    status: v.union(
      v.literal("to_watch"),
      v.literal("watching"),
      v.literal("watched"),
      v.literal("dropped")
    ),
    rating: v.optional(v.number()), // 1-10 - overall rating
    notes: v.optional(v.string()),
    startedAt: v.optional(v.number()), // When started (TV shows) or undefined (movies)
    finishedAt: v.optional(v.number()), // When finished (movies = watch date, TV shows = end date)
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high")
      )
    ),
    tags: v.optional(v.array(v.string())),
    seasonProgress: v.optional(
      v.array(
        v.object({
          seasonNumber: v.number(),
          status: v.union(
            v.literal("to_watch"),
            v.literal("watching"),
            v.literal("watched"),
            v.literal("dropped")
          ),
          rating: v.optional(v.number()), // 1-10 - season rating
          notes: v.optional(v.string()), // Season-specific notes
          startedAt: v.optional(v.number()), // When season started
          finishedAt: v.optional(v.number()), // When season finished
        })
      )
    ),
  })
    .index("by_list_id", ["listId"])
    .index("by_list_and_media", ["listId", "mediaId"]),

  // TMDB search cache - stores search results to reduce API calls
  searchCache: defineTable({
    query: v.string(), // Normalized search query (lowercase, trimmed)
    results: v.any(), // TMDB search results array
    expiresAt: v.number(), // Timestamp when cache entry expires (6 hours)
  })
    .index("by_query", ["query"]) // Fast lookup by search query
    .index("by_expires", ["expiresAt"]), // For cleanup of expired entries
});

