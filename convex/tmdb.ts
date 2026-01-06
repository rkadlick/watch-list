import { action } from "./_generated/server";
import { v } from "convex/values";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

export const searchTMDB = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error("TMDB_API_KEY environment variable is not set");
    }

    const url = `${TMDB_API_BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(args.query)}&include_adult=false`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  },
});

