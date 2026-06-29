/**
 * Returns true when an episode air date is in the future.
 * Missing air date alone is not enough — use isEpisodeLocked for UI gating.
 */
export function isEpisodeUnreleased(airDate: string | undefined): boolean {
  if (!airDate) return false;
  return new Date(`${airDate}T00:00:00`).getTime() > Date.now();
}

export function getEpisodeAirDate(
  episodes: Array<{ episodeNumber: number; airDate?: string }> | undefined,
  episodeNumber: number
): string | undefined {
  return episodes?.find((e) => e.episodeNumber === episodeNumber)?.airDate;
}

export function resolveEpisodeAirDate(
  season:
    | {
        airDate?: string;
        episodes?: Array<{ episodeNumber: number; airDate?: string }>;
      }
    | undefined,
  episodeNumber: number
): string | undefined {
  if (!season) return undefined;

  const episodeDate = getEpisodeAirDate(season.episodes, episodeNumber);
  if (episodeDate) return episodeDate;

  // Fall back to season premiere for SxE1 when per-episode data is missing
  if (episodeNumber === 1 && season.airDate) return season.airDate;

  return undefined;
}

/** True when the episode has a known air date that hasn't passed yet. */
export function isEpisodeLocked(
  season:
    | {
        airDate?: string;
        episodes?: Array<{ episodeNumber: number; airDate?: string }>;
      }
    | undefined,
  episodeNumber: number
): boolean {
  const airDate = resolveEpisodeAirDate(season, episodeNumber);
  if (!airDate) return false;
  return isEpisodeUnreleased(airDate);
}

export function episodeUnreleasedMessage(
  seasonNumber: number,
  episodeNumber: number,
  airDate?: string
): string {
  return airDate
    ? `S${seasonNumber}E${episodeNumber} hasn't aired yet (airs ${airDate})`
    : `S${seasonNumber}E${episodeNumber} hasn't aired yet`;
}

/** For episode grids: missing air date means not yet available. */
export function isEpisodeUnreleasedInGrid(airDate: string | undefined): boolean {
  if (!airDate) return true;
  return isEpisodeUnreleased(airDate);
}
