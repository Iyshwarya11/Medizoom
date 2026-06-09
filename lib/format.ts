import { format, parseISO } from "date-fns";

export function formatDate(dateString?: string | null) {
  if (!dateString) return "-";
  try { return format(parseISO(dateString), "MMM d, yyyy"); } catch (e) { return dateString; }
}

export function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";
  try { return format(parseISO(dateString), "MMM d, yyyy HH:mm"); } catch (e) { return dateString; }
}

export function formatTime(dateString?: string | null) {
  if (!dateString) return "-";
  try { return format(parseISO(dateString), "HH:mm"); } catch (e) { return dateString; }
}