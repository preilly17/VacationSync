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

export function formatWholeNumber(
  value: number | null | undefined,
  { locale, fallback = "" }: { locale?: string; fallback?: string } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  const normalized = Math.round(value);

  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(normalized);
  } catch {
    return normalized.toString();
  }
}
