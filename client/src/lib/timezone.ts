import { format } from "date-fns";

const sanitizeCandidateTimezone = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const getTimeZoneOffsetInMilliseconds = (instant: Date, timeZone: string): number => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = formatter.formatToParts(instant);
    const lookup: Record<string, number> = {};

    for (const part of parts) {
      if (part.type === "literal") continue;
      const parsed = Number.parseInt(part.value, 10);
      if (!Number.isNaN(parsed)) {
        lookup[part.type] = parsed;
      }
    }

    const year = lookup.year ?? instant.getUTCFullYear();
    const month = (lookup.month ?? instant.getUTCMonth() + 1) - 1;
    const day = lookup.day ?? instant.getUTCDate();
    const hour = lookup.hour ?? instant.getUTCHours();
    const minute = lookup.minute ?? instant.getUTCMinutes();
    const second = lookup.second ?? instant.getUTCSeconds();

    const asUtc = Date.UTC(year, month, day, hour, minute, second);
    return asUtc - instant.getTime();
  } catch (error) {
    console.warn("Failed to determine timezone offset", { error, timeZone });
    return 0;
  }
};

export const combineDateAndTimeInUtc = (
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone: string,
): string | null => {
  if (!date || !time) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hourStr = "0", minuteStr = "0"] = time.split(":");

  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10);
  const day = Number.parseInt(dayStr ?? "", 10);
  const hour = Number.parseInt(hourStr ?? "", 10);
  const minute = Number.parseInt(minuteStr ?? "", 10);

  if (
    Number.isNaN(year)
    || Number.isNaN(month)
    || Number.isNaN(day)
    || Number.isNaN(hour)
    || Number.isNaN(minute)
  ) {
    return null;
  }

  try {
    const provisional = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offset = getTimeZoneOffsetInMilliseconds(provisional, timeZone);
    return new Date(provisional.getTime() - offset).toISOString();
  } catch (error) {
    console.warn("Failed to convert activity time to UTC", {
      error,
      date,
      time,
      timeZone,
    });
    return `${date}T${time}:00.000Z`;
  }
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

