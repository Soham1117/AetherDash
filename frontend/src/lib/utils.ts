import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string or Date object to a readable format
 * @param date - Date string (ISO format) or Date object
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  options?: {
    includeTime?: boolean;
    format?: "short" | "medium" | "long" | "full";
  }
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "Invalid Date";
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: options?.format === "short" ? "short" : options?.format === "long" ? "long" : "short",
    day: "numeric",
  };

  if (options?.includeTime) {
    formatOptions.hour = "2-digit";
    formatOptions.minute = "2-digit";
  }

  return dateObj.toLocaleDateString("en-US", formatOptions);
}

/**
 * Format a date to a relative time string (e.g., "2 days ago", "in 3 hours")
 * @param date - Date string (ISO format) or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) {
    return diffInSeconds < 0 ? "in a few seconds" : "just now";
  } else if (absDiff < 3600) {
    const minutes = Math.floor(absDiff / 60);
    return diffInSeconds < 0 ? `in ${minutes} minute${minutes !== 1 ? "s" : ""}` : `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (absDiff < 86400) {
    const hours = Math.floor(absDiff / 3600);
    return diffInSeconds < 0 ? `in ${hours} hour${hours !== 1 ? "s" : ""}` : `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else if (absDiff < 604800) {
    const days = Math.floor(absDiff / 86400);
    return diffInSeconds < 0 ? `in ${days} day${days !== 1 ? "s" : ""}` : `${days} day${days !== 1 ? "s" : ""} ago`;
  } else {
    return formatDate(dateObj);
  }
}
