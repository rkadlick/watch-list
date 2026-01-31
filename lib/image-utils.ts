/**
 * Generate a blur placeholder for images
 * Creates a tiny SVG with dominant color for smooth loading experience
 */

/**
 * Generate a simple blur placeholder with a dominant color
 * @param color - Hex color (e.g., "#1a1a1a") or named color
 * @returns Base64 encoded SVG data URL
 */
export function generateBlurPlaceholder(color: string = "#1a1a1a"): string {
  const svg = `
    <svg width="40" height="60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.4" />
        </linearGradient>
      </defs>
      <rect width="40" height="60" fill="url(#grad)" />
    </svg>
  `;

  // Convert to base64
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Get dominant color from TMDB poster path
 * Uses a simple heuristic based on genre/type for consistent colors
 * In a real app, you might extract this from the actual image
 */
export function getDominantColor(mediaType?: "movie" | "tv"): string {
  // Simple color scheme based on media type
  // You can enhance this by extracting actual colors from images
  if (mediaType === "movie") {
    return "#2a2a3e"; // Deep blue-gray for movies
  } else if (mediaType === "tv") {
    return "#3e2a2a"; // Deep red-gray for TV shows
  }
  return "#1a1a1a"; // Default dark gray
}

/**
 * Generate a blur placeholder for a media item
 * @param mediaType - Type of media (movie or tv)
 * @returns Base64 encoded blur placeholder
 */
export function getMediaBlurPlaceholder(mediaType?: "movie" | "tv"): string {
  const color = getDominantColor(mediaType);
  return generateBlurPlaceholder(color);
}
