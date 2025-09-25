import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface FormatCurrencyOptions {
  currency?: string;
  locale?: string;
  fallback?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(
  amount: number | null | undefined,
  {
    currency = "USD",
    locale,
    fallback = "",
    minimumFractionDigits,
    maximumFractionDigits,
  }: FormatCurrencyOptions = {},
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return fallback;
  }

  const formatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
  };

  if (typeof minimumFractionDigits === "number") {
    formatOptions.minimumFractionDigits = minimumFractionDigits;
  }

  if (typeof maximumFractionDigits === "number") {
    formatOptions.maximumFractionDigits = maximumFractionDigits;
  }

  try {
    return new Intl.NumberFormat(locale, formatOptions).format(amount);
  } catch {
    const fractionDigits =
      typeof maximumFractionDigits === "number"
        ? maximumFractionDigits
        : typeof minimumFractionDigits === "number"
          ? minimumFractionDigits
          : 2;
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
}

export function parseDateValue(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    const isoLikeMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (isoLikeMatch) {
      const [, year, month, day] = isoLikeMatch;
      const parsedDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
      );

      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    const parsedDate = new Date(trimmedValue);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return null;
}
