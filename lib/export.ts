/**
 * Utility functions for exporting data to CSV format
 */

export interface ExportItem {
  title: string;
  type: string;
  status: string;
  rating?: number;
  priority?: string;
  tags: string;
  startedAt?: number;
  finishedAt?: number;
  notes: string;
  releaseDate: string;
  genres: string;
  totalSeasons?: number;
  totalEpisodes?: number;
}

export interface ExportData {
  listName: string;
  exportedAt: number;
  items: ExportItem[];
}

/**
 * Format a timestamp to YYYY-MM-DD
 */
function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: string | number | undefined): string {
  if (field === undefined || field === null) return "";
  
  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Convert export data to CSV format
 */
export function convertToCSV(data: ExportData): string {
  const headers = [
    "Title",
    "Type",
    "Status",
    "Rating",
    "Priority",
    "Tags",
    "Started",
    "Finished",
    "Release Date",
    "Genres",
    "Seasons",
    "Episodes",
    "Notes",
  ];

  const rows = data.items.map((item) => [
    escapeCSVField(item.title),
    escapeCSVField(item.type),
    escapeCSVField(item.status),
    escapeCSVField(item.rating),
    escapeCSVField(item.priority),
    escapeCSVField(item.tags),
    escapeCSVField(formatDate(item.startedAt)),
    escapeCSVField(formatDate(item.finishedAt)),
    escapeCSVField(item.releaseDate),
    escapeCSVField(item.genres),
    escapeCSVField(item.totalSeasons),
    escapeCSVField(item.totalEpisodes),
    escapeCSVField(item.notes),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Download a file with the given content
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Generate a safe filename from list name
 */
export function generateFilename(listName: string): string {
  const safeName = listName
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  
  const date = new Date().toISOString().split("T")[0];
  return `${safeName}-${date}.csv`;
}
