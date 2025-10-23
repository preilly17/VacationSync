export const parseTripDateToLocal = (value?: string | Date | null): Date | null => {
  if (!value) {
    return null;
  }

  const dateString = value instanceof Date ? value.toISOString() : value;
  const [datePart] = dateString.split("T");

  if (datePart) {
    const parts = datePart.split("-");

    if (parts.length === 3) {
      const [yearString, monthString, dayString] = parts;
      const year = Number.parseInt(yearString, 10);
      const month = Number.parseInt(monthString, 10);
      const day = Number.parseInt(dayString, 10);

      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        return new Date(year, month - 1, day);
      }
    }
  }

  const fallback = value instanceof Date ? value : new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

