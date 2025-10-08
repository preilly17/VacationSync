export type ActivityDateInput = string | Date | null | undefined;

export const parseActivityDate = (value: ActivityDateInput): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const getActivityComparisonDate = (
  start: ActivityDateInput,
  end: ActivityDateInput,
): Date | null => {
  const startDate = parseActivityDate(start);
  const endDate = parseActivityDate(end);

  return endDate ?? startDate;
};

export const isActivityPast = (
  start: ActivityDateInput,
  end: ActivityDateInput,
  now: Date = new Date(),
): boolean => {
  const comparisonTarget = getActivityComparisonDate(start, end);

  if (!comparisonTarget) {
    return false;
  }

  return comparisonTarget.getTime() < now.getTime();
};
