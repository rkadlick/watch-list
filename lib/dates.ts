// Date utilities for consistent handling across the app

/**
 * Parse a date input value (YYYY-MM-DD) to timestamp in LOCAL timezone
 * This fixes the "day before" bug caused by UTC parsing
 */
export function parseDateInputToTimestamp(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  // Parse as local date by splitting and using Date constructor with numbers
  const [year, month, day] = dateStr.split("-").map(Number);
  // Month is 0-indexed in JS Date
  const date = new Date(year, month - 1, day, 12, 0, 0); // noon to avoid any DST issues
  return date.getTime();
}

/**
 * Parse a month input value (YYYY-MM) to timestamp - stores as 1st of month
 * The time is set to 00:00:01 to distinguish from full dates (which use noon)
 */
export function parseMonthInputToTimestamp(monthStr: string): number | undefined {
  if (!monthStr) return undefined;
  const [year, month] = monthStr.split("-").map(Number);
  // Store as 1st of month at 00:00:01 to mark as "month only"
  const date = new Date(year, month - 1, 1, 0, 0, 1);
  return date.getTime();
}

/**
 * Check if a timestamp represents a "month only" date (stored at 00:00:01)
 */
export function isMonthOnlyDate(timestamp: number): boolean {
  const date = new Date(timestamp);
  return date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0;
}

/**
 * Format timestamp to date input value (YYYY-MM-DD)
 */
export function formatTimestampToDateInput(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format timestamp to month input value (YYYY-MM)
 */
export function formatTimestampToMonthInput(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Format timestamp for display - shows full date or month/year based on how it was stored
 */
export function formatDateDisplay(timestamp?: number): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  
  if (isMonthOnlyDate(timestamp)) {
    // Month only - show "Jan 2025"
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      year: "numeric" 
    });
  }
  
  // Full date - show "Jan 13, 2025"
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}

/**
 * Format timestamp for compact display (footer, etc)
 */
export function formatDateCompact(timestamp?: number): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  
  if (isMonthOnlyDate(timestamp)) {
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      year: "numeric" 
    });
  }
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}

/**
 * Parse an ISO date string (from API/database) to display format
 * Used for release dates, air dates, etc that come as strings
 */
export function formatISODateDisplay(isoString?: string): string | null {
  if (!isoString) return null;
  // Parse ISO string - these are typically YYYY-MM-DD format
  const [year, month, day] = isoString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}
