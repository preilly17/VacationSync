function pow10BigInt(exp: number): bigint {
  let result = BigInt(1);
  for (let i = 0; i < exp; i++) {
    result *= BigInt(10);
  }
  return result;
}

function toScaled(rate: string, scale: number): bigint {
  const trimmed = rate.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    throw new Error("Rate must be a positive decimal string");
  }
  const [intPart, fracPart = ""] = trimmed.split(".");
  const frac = (fracPart + "0".repeat(scale)).slice(0, scale);
  const combined = (intPart || "0") + frac;
  return BigInt(combined);
}

function fromScaled(value: bigint, scale: number, fractionDigits: number): string {
  if (fractionDigits < 0) {
    throw new Error("fractionDigits must be >= 0");
  }
  let scaledValue = value;
  if (scale > fractionDigits) {
    const diff = scale - fractionDigits;
    const divider = pow10BigInt(diff);
    // half-up rounding while reducing precision
    scaledValue = (scaledValue + divider / BigInt(2)) / divider;
    scale = fractionDigits;
  } else if (scale < fractionDigits) {
    const multiplier = pow10BigInt(fractionDigits - scale);
    scaledValue *= multiplier;
    scale = fractionDigits;
  }

  const str = scaledValue.toString().padStart(scale + 1, "0");
  const intPart = str.slice(0, -scale) || "0";
  const fracPart = str.slice(-scale).padEnd(fractionDigits, "0");
  return fractionDigits > 0 ? `${intPart}.${fracPart}` : intPart;
}

export function applyFeeToRate(
  baseRate: string,
  feeBps: number,
  fractionDigits = 6,
): string {
  if (feeBps < 0) {
    throw new Error("feeBps must be >= 0");
  }
  const SCALE = 12;
  const scaled = toScaled(baseRate, SCALE);
  const multiplier = BigInt(10000 + feeBps);
  const result =
    (scaled * multiplier + BigInt(5000)) / BigInt(10000); // half-up
  return fromScaled(result, SCALE, fractionDigits);
}
