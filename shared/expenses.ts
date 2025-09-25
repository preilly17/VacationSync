import { getCurrencyMeta } from "./currency";

export type SplitTgt = {
  userId: string;
  shareSrcMinor: number;
  shareTgtMinor: number;
};

export function splitIncludePayer(
  amountSrcMinor: number,
  debtorIds: string[],
): Map<string, number> {
  if (!Number.isInteger(amountSrcMinor) || amountSrcMinor <= 0) {
    throw new Error("Amount must be > 0");
  }
  if (debtorIds.length === 0) {
    throw new Error("Choose at least one person");
  }

  const nTotal = debtorIds.length + 1; // include payer in divisor
  const base = Math.floor(amountSrcMinor / nTotal);
  let rem = amountSrcMinor - base * nTotal;

  const out = new Map<string, number>();
  for (const id of debtorIds) {
    let share = base;
    if (rem > 0) {
      share += 1;
      rem -= 1;
    }
    out.set(id, share);
  }

  return out;
}

function pow10BigInt(exp: number): bigint {
  if (exp < 0 || !Number.isInteger(exp)) {
    throw new Error("Exponent must be a non-negative integer");
  }
  let result = 1n;
  for (let i = 0; i < exp; i++) {
    result *= 10n;
  }
  return result;
}

function parseFxRate(rate: string, scale: number): bigint {
  if (!rate || typeof rate !== "string") {
    throw new Error("FX rate required");
  }
  const trimmed = rate.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    throw new Error("FX rate must be a positive decimal string");
  }

  const [intPart, fracPart = ""] = trimmed.split(".");
  const paddedFrac = (fracPart + "0".repeat(scale)).slice(0, scale);
  const combined = `${intPart}${paddedFrac}`.replace(/^0+(?=\d)/, "");
  const scaled = BigInt(combined || "0");
  if (scaled <= 0n) {
    throw new Error("FX rate must be greater than zero");
  }
  return scaled;
}

// fxRate: decimal string = target per 1 src (e.g., "0.006674")
// srcExp/tgtExp = minor-unit exponents, e.g., JPY=0, USD=2
export function convertMinor(
  srcMinor: number,
  srcExp: number,
  tgtExp: number,
  fxRate: string,
): number {
  if (!Number.isInteger(srcMinor)) {
    throw new Error("Source minor units must be integers");
  }
  const SCALE = 12;
  const scaleFactor = pow10BigInt(SCALE);
  const rateScaled = parseFxRate(fxRate, SCALE);

  const srcFactor = pow10BigInt(srcExp);
  const tgtFactor = pow10BigInt(tgtExp);
  const num = BigInt(srcMinor) * rateScaled * tgtFactor;
  const den = scaleFactor * srcFactor;

  const quotient = num / den;
  const remainder = num % den;
  if (remainder * BigInt(2) >= den) {
    return Number(quotient + BigInt(1));
  }
  return Number(quotient);
}

export interface CurrencyAwareSplitResult {
  rows: SplitTgt[];
  totalTgtMinor: number;
}

export function computeCurrencyAwareSplits(
  amountSrcMinor: number,
  debtorIds: string[],
  srcCurrency: string,
  tgtCurrency: string,
  fxRate: string,
): CurrencyAwareSplitResult {
  const shares = splitIncludePayer(amountSrcMinor, debtorIds);
  const srcMeta = getCurrencyMeta(srcCurrency);
  const tgtMeta = getCurrencyMeta(tgtCurrency);

  const rows: SplitTgt[] = debtorIds.map((id) => {
    const shareSrc = shares.get(id)!;
    const shareTgt = convertMinor(
      shareSrc,
      srcMeta.exponent,
      tgtMeta.exponent,
      fxRate,
    );
    return { userId: id, shareSrcMinor: shareSrc, shareTgtMinor: shareTgt };
  });

  const sumTgt = rows.reduce((s, r) => s + r.shareTgtMinor, 0);
  const totalSrc = rows.reduce((s, r) => s + r.shareSrcMinor, 0);
  const totalTgt = convertMinor(
    totalSrc,
    srcMeta.exponent,
    tgtMeta.exponent,
    fxRate,
  );

  let diff = totalTgt - sumTgt;
  for (let i = 0; diff > 0 && i < rows.length; i++) {
    rows[i].shareTgtMinor += 1;
    diff -= 1;
  }

  if (diff < 0) {
    // In extremely rare cases round-half-up on individual shares can push the
    // debtor sum above the converted total. Roll the excess off the last
    // debtors to keep the math balanced while preserving stable ordering for
    // positive adjustments above.
    for (let i = rows.length - 1; diff < 0 && i >= 0; i--) {
      const available = Math.min(rows[i].shareTgtMinor, -diff);
      if (available > 0) {
        rows[i].shareTgtMinor -= available;
        diff += available;
      }
    }
  }

  return { rows, totalTgtMinor: totalTgt };
}
