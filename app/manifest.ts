import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Watch List - Movie & TV Tracker",
    short_name: "Watch List",
    description: "Track your favorite movies and TV shows",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#4722A3",
    theme_color: "#5E2FC7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
