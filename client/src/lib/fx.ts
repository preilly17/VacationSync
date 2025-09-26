export interface LiveFxRateRequest {
  src: string;
  tgt: string;
}

export interface LiveFxRateResponse {
  rate: number;
  provider: string;
  timestamp: string;
}

const baseRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.34,
  AUD: 1.51,
  JPY: 155.11,
};

function normalizeCurrency(code: string): string {
  return code?.trim().toUpperCase();
}

export async function getLiveFxRate({
  src,
  tgt,
}: LiveFxRateRequest): Promise<LiveFxRateResponse> {
  const source = normalizeCurrency(src);
  const target = normalizeCurrency(tgt);

  await new Promise((resolve) => setTimeout(resolve, 450));

  if (!source || !target) {
    throw new Error("Source and target currencies are required");
  }

  if (source === target) {
    return {
      rate: 1,
      provider: "MockRates",
      timestamp: new Date().toISOString(),
    };
  }

  const sourceBase = baseRates[source] ?? baseRates.USD;
  const targetBase = baseRates[target] ?? baseRates.USD;

  const rate = targetBase / sourceBase;

  return {
    rate,
    provider: "MockRates",
    timestamp: new Date().toISOString(),
  };
}
