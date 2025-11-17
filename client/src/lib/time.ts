import { format, parse } from "date-fns";

const TIME_24H_REGEX = /^\d{2}:\d{2}$/;

/**
 * Normalizes a human-friendly time string (e.g. "7:00 PM") to 24-hour HH:mm format.
 * Returns an empty string if the value can't be parsed.
 */
export function normalizeTimeTo24Hour(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (TIME_24H_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = parse(trimmed, "h:mm a", new Date());
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return format(parsed, "HH:mm");
  } catch (error) {
    return "";
  }
}
