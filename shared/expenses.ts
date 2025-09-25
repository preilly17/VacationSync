export type Split = { userId: string; amountCents: number };

function ensureIntegerCents(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error("Amount must be provided in whole cents");
  }
}

function normalizeDebtorIds(debtorIds: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const rawId of debtorIds) {
    const id = rawId?.trim();
    if (!id) {
      continue;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

export function computeSplits(amountCents: number, debtorIds: string[]): Split[] {
  if (!Number.isFinite(amountCents)) {
    throw new Error("Amount must be > 0");
  }
  ensureIntegerCents(amountCents);
  if (amountCents <= 0) {
    throw new Error("Amount must be > 0");
  }

  const normalizedDebtors = normalizeDebtorIds(debtorIds);
  if (normalizedDebtors.length === 0) {
    throw new Error("Choose at least one person to split with");
  }

  const nTotal = normalizedDebtors.length + 1;
  const base = Math.floor(amountCents / nTotal);
  let remainder = amountCents - base * nTotal;

  return normalizedDebtors.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    return { userId, amountCents: base + extra };
  });
}

export function centsToAmount(amountCents: number): number {
  ensureIntegerCents(amountCents);
  return Number((amountCents / 100).toFixed(2));
}
