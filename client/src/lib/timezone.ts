import { format } from "date-fns";

const sanitizeCandidateTimezone = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

export const resolveTripTimezone = (
  options: { tripTimezone?: string | null; userTimezone?: string | null } = {},
): string => {
  const tripCandidate = sanitizeCandidateTimezone(options.tripTimezone);
  if (tripCandidate) {
    return tripCandidate;
  }

  const userCandidate = sanitizeCandidateTimezone(options.userTimezone);
  if (userCandidate) {
    return userCandidate;
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const normalized = sanitizeCandidateTimezone(resolved ?? null);
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    // Ignore resolution errors and fall back below.
  }

  return "UTC";
};

export const formatDateInTimezone = (date: Date, timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find(part => part.type === "year")?.value ?? "";
    const month = parts.find(part => part.type === "month")?.value ?? "";
    const day = parts.find(part => part.type === "day")?.value ?? "";

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    // Ignore formatting errors and fall back below.
  }

  return format(date, "yyyy-MM-dd");
};

export const formatTimeInTimezone = (date: Date, timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const hour = parts.find(part => part.type === "hour")?.value ?? "00";
    const minute = parts.find(part => part.type === "minute")?.value ?? "00";

    if (hour && minute) {
      return `${hour}:${minute}`;
    }
  } catch (error) {
    // Ignore formatting errors and fall back below.
  }

  return format(date, "HH:mm");
};

