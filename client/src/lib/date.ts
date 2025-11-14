const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const extractDatePortion = (value?: string | Date | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString().split("T")[0] ?? null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const [datePart] = trimmed.split("T");
    if (datePart && ISO_DATE_PATTERN.test(datePart)) {
      return datePart;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0] ?? null;
    }
  }

  return null;
};

export const parseTripDateToLocal = (value?: string | Date | null): Date | null => {
  const datePortion = extractDatePortion(value);

  if (datePortion) {
    const [yearString, monthString, dayString] = datePortion.split("-");
    const year = Number.parseInt(yearString, 10);
    const month = Number.parseInt(monthString, 10);
    const day = Number.parseInt(dayString, 10);

    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }

  if (!value) {
    return null;
  }

  const fallback = value instanceof Date ? value : new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const toDateInputValue = (value?: string | Date | null): string => {
  const datePortion = extractDatePortion(value);
  return datePortion ?? "";
};

