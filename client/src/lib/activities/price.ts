export function extractPriceValue(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/[\d]+(?:[.,][\d]+)?/);
  if (!match) {
    return undefined;
  }

  const normalized = match[0].replace(/,/g, "");
  return /^\d*(?:\.\d+)?$/.test(normalized) && normalized.length > 0 ? normalized : undefined;
}
