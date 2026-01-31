/**
 * Validation utilities for data integrity
 * Provides consistent validation across all mutations
 */

// Validation limits
export const LIMITS = {
  // Lists
  LIST_NAME_MIN: 1,
  LIST_NAME_MAX: 100,
  LIST_DESCRIPTION_MAX: 500,
  LIST_MEMBERS_MAX: 50,

  // List Items
  NOTES_MAX: 2000,
  TAGS_MAX: 20,
  TAG_LENGTH_MAX: 50,
  RATING_MIN: 1,
  RATING_MAX: 10,

  // General
  SEASON_NUMBER_MIN: 0,
  SEASON_NUMBER_MAX: 100,
} as const;

/**
 * Validate and sanitize a string
 * - Trims whitespace
 * - Strips HTML tags
 * - Enforces length limits
 */
export function validateString(
  value: string | undefined,
  options: {
    fieldName: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  }
): string | undefined {
  const { fieldName, required = false, minLength, maxLength } = options;

  // Handle undefined/null
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return undefined;
  }

  // Sanitize: strip HTML tags and trim
  let sanitized = value
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Check if empty after sanitization
  if (sanitized.length === 0) {
    if (required) {
      throw new Error(`${fieldName} cannot be empty`);
    }
    return undefined;
  }

  // Check minimum length
  if (minLength !== undefined && sanitized.length < minLength) {
    throw new Error(
      `${fieldName} must be at least ${minLength} character${minLength === 1 ? "" : "s"}`
    );
  }

  // Check maximum length
  if (maxLength !== undefined && sanitized.length > maxLength) {
    throw new Error(
      `${fieldName} must be at most ${maxLength} characters (currently ${sanitized.length})`
    );
  }

  return sanitized;
}

/**
 * Validate a rating (1-10)
 */
export function validateRating(
  rating: number | undefined,
  fieldName: string = "Rating"
): number | undefined {
  if (rating === undefined) {
    return undefined;
  }

  if (!Number.isInteger(rating)) {
    throw new Error(`${fieldName} must be a whole number`);
  }

  if (rating < LIMITS.RATING_MIN || rating > LIMITS.RATING_MAX) {
    throw new Error(
      `${fieldName} must be between ${LIMITS.RATING_MIN} and ${LIMITS.RATING_MAX}`
    );
  }

  return rating;
}

/**
 * Validate and sanitize tags array
 * - Removes duplicates (case-insensitive)
 * - Trims and sanitizes each tag
 * - Enforces length limits
 */
export function validateTags(
  tags: string[] | undefined
): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  // Sanitize and filter empty tags
  const sanitized = tags
    .map((tag) =>
      validateString(tag, {
        fieldName: "Tag",
        required: false,
        maxLength: LIMITS.TAG_LENGTH_MAX,
      })
    )
    .filter((tag): tag is string => tag !== undefined);

  if (sanitized.length === 0) {
    return undefined;
  }

  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  const unique = sanitized.filter((tag) => {
    const lower = tag.toLowerCase();
    if (seen.has(lower)) {
      return false;
    }
    seen.add(lower);
    return true;
  });

  // Check array length limit
  if (unique.length > LIMITS.TAGS_MAX) {
    throw new Error(
      `Maximum ${LIMITS.TAGS_MAX} tags allowed (you have ${unique.length})`
    );
  }

  return unique.length > 0 ? unique : undefined;
}

/**
 * Validate a season number
 */
export function validateSeasonNumber(seasonNumber: number): number {
  if (!Number.isInteger(seasonNumber)) {
    throw new Error("Season number must be a whole number");
  }

  if (
    seasonNumber < LIMITS.SEASON_NUMBER_MIN ||
    seasonNumber > LIMITS.SEASON_NUMBER_MAX
  ) {
    throw new Error(
      `Season number must be between ${LIMITS.SEASON_NUMBER_MIN} and ${LIMITS.SEASON_NUMBER_MAX}`
    );
  }

  return seasonNumber;
}

/**
 * Validate date logic
 * - Dates must be in the past or present
 * - finishedAt must be >= startedAt
 */
export function validateDates(options: {
  startedAt?: number | null;
  finishedAt?: number | null;
  allowFuture?: boolean;
}): void {
  const { startedAt, finishedAt, allowFuture = false } = options;
  const now = Date.now();

  // Check if dates are in the future
  if (!allowFuture) {
    if (startedAt && startedAt > now) {
      throw new Error("Start date cannot be in the future");
    }
    if (finishedAt && finishedAt > now) {
      throw new Error("Finish date cannot be in the future");
    }
  }

  // Check if finishedAt is before startedAt
  if (startedAt && finishedAt && finishedAt < startedAt) {
    throw new Error("Finish date cannot be before start date");
  }
}

/**
 * Validate a positive number (like TMDB ID)
 */
export function validatePositiveNumber(
  value: number,
  fieldName: string
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string {
  const trimmed = email.trim();
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    throw new Error("Invalid email format");
  }
  
  return trimmed;
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(
  array: T[],
  maxLength: number,
  fieldName: string
): void {
  if (array.length > maxLength) {
    throw new Error(
      `Maximum ${maxLength} ${fieldName} allowed (you have ${array.length})`
    );
  }
}
