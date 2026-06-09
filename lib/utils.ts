import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Translates actual Database strings into the Replit UI's expected states
export function normalizeStatus(status?: string) {
  if (!status) return "unknown";
  const s = status.toLowerCase().trim();
  
  if (s.includes("awaiting") || s.includes("pending")) return "pending";
  if (s.includes("assigned")) return "assigned";
  if (s.includes("in progress") || s.includes("in_progress")) return "in_progress";
  if (s.includes("follow") || s.includes("follow_up")) return "follow_up";
  if (s.includes("completed")) return "completed";
  if (s.includes("cancelled") || s.includes("canceled")) return "cancelled";
  
  return s;
}