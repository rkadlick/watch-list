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
    lastMediaRefreshAt: v.optional(v.number()), // Last TMDB metadata refresh for this list
  })
    .index("by_owner_id", ["ownerId"]) // Critical: Find lists owned by a user
    .index("by_updated_at", ["updatedAt"]), // Optional: Sort lists by recent activity

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
          episodes: v.optional(
            v.array(
              v.object({
                episodeNumber: v.number(),
                name: v.string(),
                airDate: v.optional(v.string()),
                overview: v.optional(v.string()),
              })
            )
          ),
        })
      )
    ),
    episodesPopulated: v.optional(v.boolean()),
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
          episodeDates: v.optional(
            v.array(
              v.object({
                episodeNumber: v.number(),
                watchedAt: v.number(), // Timestamp when episode was checked off via advanceEpisode
              })
            )
          ),
        })
      )
    ),
    watchHistory: v.optional(
      v.array(
        v.object({
          startedAt: v.optional(v.number()),
          finishedAt: v.optional(v.number()),
          rating: v.optional(v.number()),
          notes: v.optional(v.string()),
          // TV only — snapshot of seasonProgress at rewatch archive time
          seasons: v.optional(
            v.array(
              v.object({
                seasonNumber: v.number(),
                startedAt: v.optional(v.number()),
                finishedAt: v.optional(v.number()),
                rating: v.optional(v.number()),
                notes: v.optional(v.string()),
                episodeDates: v.optional(
                  v.array(
                    v.object({
                      episodeNumber: v.number(),
                      watchedAt: v.number(),
                    })
                  )
                ),
              })
            )
          ),
        })
      )
    ),
    // Episode position tracking (TV only)
    currentSeasonNumber: v.optional(v.number()),
    currentEpisodeNumber: v.optional(v.number()),
    // Drop position tracking (TV only)
    droppedAtSeason: v.optional(v.number()),
    droppedAtEpisode: v.optional(v.number()),
    // Manual sort order within sections
    sortOrder: v.optional(v.number()),
    // TMDB change tracking — snapshot for diffing on refresh
    mediaSnapshot: v.optional(
      v.object({
        capturedAt: v.number(),
        releaseDate: v.optional(v.string()),
        seasonCount: v.number(),
        seasons: v.array(
          v.object({
            seasonNumber: v.number(),
            airDate: v.optional(v.string()),
            episodeCount: v.number(),
          })
        ),
      })
    ),
    pendingChanges: v.optional(
      v.array(
        v.object({
          type: v.union(
            v.literal("new_season"),
            v.literal("season_released"),
            v.literal("premiere_date_set"),
            v.literal("release_date_changed"),
            v.literal("movie_released"),
            v.literal("episodes_added")
          ),
          detectedAt: v.number(),
          detail: v.optional(v.string()),
        })
      )
    ),
  })
    .index("by_list_id", ["listId"])
    .index("by_list_and_media", ["listId", "mediaId"])
    .index("by_media_id", ["mediaId"]), // Optional: Find all lists containing a media item

  // Per-user cooldown for manual TMDB refresh on a list
  tmdbRefreshCooldowns: defineTable({
    userId: v.string(),
    listId: v.id("lists"),
    lastRefreshAt: v.number(),
  }).index("by_user_and_list", ["userId", "listId"]),

  // Per-user acknowledgment of list update banners
  listUpdateAcknowledgments: defineTable({
    userId: v.string(),
    listId: v.id("lists"),
    lastAcknowledgedAt: v.number(),
  }).index("by_user_and_list", ["userId", "listId"]),

  // TMDB search cache - stores search results to reduce API calls
  searchCache: defineTable({
    query: v.string(), // Normalized search query (lowercase, trimmed)
    results: v.any(), // TMDB search results array
    expiresAt: v.number(), // Timestamp when cache entry expires (6 hours)
  })
    .index("by_query", ["query"]) // Fast lookup by search query
    .index("by_expires", ["expiresAt"]), // For cleanup of expired entries
});

