export type SplitShare = {
  userId: string;
  sourceMinorUnits: number;
  targetMinorUnits: number;
};

export type ComputeSplitInput = {
  totalSourceMinorUnits: number;
  debtorIds: string[];
  sourceCurrency: string;
  targetCurrency: string;
  conversionRate: number | string;
};

export type ComputeSplitResult = {
  shares: SplitShare[];
  totalSourceMinorUnits: number;
  totalTargetMinorUnits: number;
};

const currencyMinorUnitOverrides: Record<string, number> = {
  JPY: 0,
};

function ensureIntegerMinorUnits(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error("Amount must be provided in whole minor units");
  }
}

export function getCurrencyMinorUnitDigits(currency: string): number {
  const trimmed = currency?.trim().toUpperCase();
  if (!trimmed) {
    return 2;
  }
  if (currencyMinorUnitOverrides[trimmed] !== undefined) {
    return currencyMinorUnitOverrides[trimmed];
  }
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: trimmed,
      minimumFractionDigits: 0,
    });
    const parts = formatter.formatToParts(1);
    const fractionPart = parts.find((part) => part.type === "fraction");
    return fractionPart ? fractionPart.value.length : 0;
  } catch {
    return 2;
  }
}

export function getCurrencyMinorUnitFactor(currency: string): number {
  const digits = getCurrencyMinorUnitDigits(currency);
  return Math.pow(10, digits);
}

export function toMinorUnits(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }
  const factor = getCurrencyMinorUnitFactor(currency);
  return Math.round(amount * factor);
}

export function minorUnitsToAmount(minorUnits: number, currency: string): number {
  ensureIntegerMinorUnits(minorUnits);
  const factor = getCurrencyMinorUnitFactor(currency);
  if (factor === 0) {
    throw new Error("Invalid currency minor unit factor");
  }
  return Number((minorUnits / factor).toFixed(Math.log10(factor)));
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

function convertMinorUnits(
  sourceMinorUnits: number,
  sourceFactor: number,
  targetFactor: number,
  rate: number,
): number {
  const denominator = sourceFactor;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Conversion rate must be greater than zero");
  }

  const converted = (sourceMinorUnits * rate * targetFactor) / denominator;
  return Math.round(converted);
}

function ensurePositiveRate(rate: number | string): number {
  if (typeof rate === "number") {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Conversion rate must be greater than zero");
    }
    return rate;
  }

  const trimmed = rate.trim();
  if (!trimmed) {
    throw new Error("Conversion rate is required");
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Conversion rate must be greater than zero");
  }

  return parsed;
}

export function computeSplits({
  totalSourceMinorUnits,
  debtorIds,
  sourceCurrency,
  targetCurrency,
  conversionRate,
}: ComputeSplitInput): ComputeSplitResult {
  if (!Number.isFinite(totalSourceMinorUnits)) {
    throw new Error("Amount must be > 0");
  }

  ensureIntegerMinorUnits(totalSourceMinorUnits);

  if (totalSourceMinorUnits <= 0) {
    throw new Error("Amount must be > 0");
  }

  const normalizedDebtors = normalizeDebtorIds(debtorIds);
  if (normalizedDebtors.length === 0) {
    throw new Error("Choose at least one person to split with");
  }

  const sourceFactor = getCurrencyMinorUnitFactor(sourceCurrency);
  const targetFactor = getCurrencyMinorUnitFactor(targetCurrency);
  const rateValue = ensurePositiveRate(conversionRate);

  const nTotal = normalizedDebtors.length + 1;
  const base = Math.floor(totalSourceMinorUnits / nTotal);
  let remainder = totalSourceMinorUnits - base * nTotal;

  const shares: SplitShare[] = normalizedDebtors.map((userId) => {
    let shareSource = base;
    if (remainder > 0) {
      shareSource += 1;
      remainder -= 1;
    }

    const targetMinorUnits = convertMinorUnits(
      shareSource,
      sourceFactor,
      targetFactor,
      rateValue,
    );

    return {
      userId,
      sourceMinorUnits: shareSource,
      targetMinorUnits,
    };
  });

  const totalTargetMinorUnits = convertMinorUnits(
    totalSourceMinorUnits,
    sourceFactor,
    targetFactor,
    rateValue,
  );

  const currentSum = shares.reduce(
    (sum, share) => sum + share.targetMinorUnits,
    0,
  );

  let difference = totalTargetMinorUnits - currentSum;
  if (difference !== 0) {
    const direction = Math.sign(difference);
    difference = Math.abs(difference);
    for (let index = 0; index < normalizedDebtors.length && difference > 0; index += 1) {
      const share = shares[index];
      const updated = share.targetMinorUnits + direction;
      if (updated < 0) {
        continue;
      }
      shares[index] = {
        ...share,
        targetMinorUnits: updated,
      };
      difference -= 1;
    }
  }

  return {
    shares,
    totalSourceMinorUnits,
    totalTargetMinorUnits,
  };
}
