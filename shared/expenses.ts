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

function parseFxRate(rate: string): number {
  if (!rate || typeof rate !== "string") {
    throw new Error("FX rate required");
  }
  const parsed = Number(rate);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("FX rate must be a positive number string");
  }
  return parsed;
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
  const rate = parseFxRate(fxRate);

  const SCALE = 1_000_000;
  const rateScaled = Math.round(rate * SCALE);

  const srcFactor = BigInt(10 ** srcExp);
  const tgtFactor = BigInt(10 ** tgtExp);
  const num = BigInt(srcMinor) * BigInt(rateScaled) * tgtFactor;
  const den = BigInt(SCALE) * srcFactor;

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
  for (let i = rows.length - 1; diff < 0 && i >= 0; i--) {
    if (rows[i].shareTgtMinor > 0) {
      rows[i].shareTgtMinor -= 1;
      diff += 1;
    }
  }

  return { rows, totalTgtMinor: totalTgt };
}
