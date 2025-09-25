export interface CurrencyMeta {
  code: string;
  exponent: number;
  symbol: string;
}

const currencyTable: Record<string, CurrencyMeta> = {
  USD: { code: "USD", exponent: 2, symbol: "$" },
  EUR: { code: "EUR", exponent: 2, symbol: "€" },
  GBP: { code: "GBP", exponent: 2, symbol: "£" },
  CAD: { code: "CAD", exponent: 2, symbol: "C$" },
  AUD: { code: "AUD", exponent: 2, symbol: "A$" },
  JPY: { code: "JPY", exponent: 0, symbol: "¥" },
  CHF: { code: "CHF", exponent: 2, symbol: "CHF" },
  CNY: { code: "CNY", exponent: 2, symbol: "¥" },
  INR: { code: "INR", exponent: 2, symbol: "₹" },
  MXN: { code: "MXN", exponent: 2, symbol: "$" },
  NZD: { code: "NZD", exponent: 2, symbol: "NZ$" },
  SGD: { code: "SGD", exponent: 2, symbol: "S$" },
  SEK: { code: "SEK", exponent: 2, symbol: "kr" },
  NOK: { code: "NOK", exponent: 2, symbol: "kr" },
  DKK: { code: "DKK", exponent: 2, symbol: "kr" },
  KRW: { code: "KRW", exponent: 0, symbol: "₩" },
  HKD: { code: "HKD", exponent: 2, symbol: "HK$" },
  THB: { code: "THB", exponent: 2, symbol: "฿" },
};

export function getCurrencyMeta(code: string): CurrencyMeta {
  const meta = currencyTable[code.toUpperCase()];
  if (!meta) {
    return { code: code.toUpperCase(), exponent: 2, symbol: code.toUpperCase() };
  }
  return meta;
}

export function formatMinorUnits(amountMinor: number, currency: string): string {
  const { exponent, symbol } = getCurrencyMeta(currency);
  const factor = 10 ** exponent;
  const major = amountMinor / factor;
  const formatted = major.toLocaleString(undefined, {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  return `${symbol}${formatted}`;
}
