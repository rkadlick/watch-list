import Image from "next/image";

interface PlatformLogoProps {
  providerName: string;
  logoPath?: string;
  size?: number;
}

// TMDB image base URL for provider logos
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

// Map of provider names to logo colors/styles (fallback when logoPath is not available)
const platformStyles: Record<string, { bg: string; text: string; abbr: string }> = {
  "netflix": { bg: "#E50914", text: "#FFFFFF", abbr: "N" },
  "hulu": { bg: "#1CE783", text: "#000000", abbr: "H" },
  "disney plus": { bg: "#113CCF", text: "#FFFFFF", abbr: "D+" },
  "amazon prime video": { bg: "#00A8E1", text: "#FFFFFF", abbr: "PV" },
  "prime video": { bg: "#00A8E1", text: "#FFFFFF", abbr: "PV" },
  "hbo max": { bg: "#B100FF", text: "#FFFFFF", abbr: "MAX" },
  "max": { bg: "#B100FF", text: "#FFFFFF", abbr: "MAX" },
  "apple tv plus": { bg: "#000000", text: "#FFFFFF", abbr: "TV+" },
  "apple tv": { bg: "#000000", text: "#FFFFFF", abbr: "TV+" },
  "paramount plus": { bg: "#0064FF", text: "#FFFFFF", abbr: "P+" },
  "paramount+": { bg: "#0064FF", text: "#FFFFFF", abbr: "P+" },
  "peacock": { bg: "#000000", text: "#FFFFFF", abbr: "P" },
  "showtime": { bg: "#D4001A", text: "#FFFFFF", abbr: "SH" },
  "starz": { bg: "#000000", text: "#FFFFFF", abbr: "ST" },
  "crunchyroll": { bg: "#F47521", text: "#FFFFFF", abbr: "CR" },
  "youtube": { bg: "#FF0000", text: "#FFFFFF", abbr: "YT" },
  "youtube premium": { bg: "#FF0000", text: "#FFFFFF", abbr: "YT" },
  "espn": { bg: "#D00F0F", text: "#FFFFFF", abbr: "ESPN" },
  "amc": { bg: "#000000", text: "#FFFFFF", abbr: "AMC" },
  "amc+": { bg: "#000000", text: "#FFFFFF", abbr: "AMC+" },
  "discovery+": { bg: "#0075DC", text: "#FFFFFF", abbr: "D+" },
  "criterion channel": { bg: "#000000", text: "#FFFFFF", abbr: "CC" },
  "mubi": { bg: "#03A9F4", text: "#FFFFFF", abbr: "MUBI" },
  "shudder": { bg: "#E50914", text: "#FFFFFF", abbr: "SH" },
  "tubi": { bg: "#FA3C2E", text: "#FFFFFF", abbr: "TUBI" },
  "pluto tv": { bg: "#000000", text: "#FFFFFF", abbr: "PLUTO" },
  "plex": { bg: "#EBAF00", text: "#000000", abbr: "PLEX" },
  "vudu": { bg: "#0088CC", text: "#FFFFFF", abbr: "VUDU" },
  "fubo": { bg: "#000000", text: "#FFFFFF", abbr: "FUBO" },
  "funimation": { bg: "#410099", text: "#FFFFFF", abbr: "FUNI" },
};

export function PlatformLogo({ providerName, logoPath, size = 28 }: PlatformLogoProps) {
  // If we have a logoPath from TMDB, use that
  if (logoPath) {
    return (
      <div
        className="relative flex-shrink-0 rounded overflow-hidden"
        style={{ width: size, height: size }}
        title={providerName}
      >
        <Image
          src={`${TMDB_IMAGE_BASE}${logoPath}`}
          alt={providerName}
          width={size}
          height={size}
          className="object-contain"
        />
      </div>
    );
  }

  // Fallback to colored abbreviation if no logoPath
  const normalizedName = providerName.toLowerCase().trim();
  const platform = platformStyles[normalizedName] || {
    bg: "#6B7280",
    text: "#FFFFFF",
    abbr: providerName.substring(0, 2).toUpperCase(),
  };

  return (
    <div
      className="flex items-center justify-center rounded font-bold flex-shrink-0"
      style={{
        backgroundColor: platform.bg,
        color: platform.text,
        width: size,
        height: size,
        fontSize: size * 0.35,
      }}
      title={providerName}
    >
      {platform.abbr}
    </div>
  );
}
