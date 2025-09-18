/**
 * Currency Service
 * Handles real-time currency conversion and exchange rate caching
 */

import memoize from "memoizee";

// Popular currencies for international travel
export const POPULAR_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
];

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  originalAmount: number;
  convertedAmount: number;
  lastUpdated: Date;
}

// Cache exchange rates for 1 hour to reduce API calls
const fetchExchangeRates = memoize(
  async (): Promise<ExchangeRates> => {
    try {
      // Using the free currency API
      const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the data to our expected format
      const rates: ExchangeRates = { USD: 1 }; // Base currency
      
      if (data.usd) {
        Object.entries(data.usd).forEach(([currency, rate]) => {
          if (typeof rate === 'number') {
            rates[currency.toUpperCase()] = rate;
          }
        });
      }
      
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      
      // Return fallback rates if API fails
      return {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.50,
        CAD: 1.36,
        AUD: 1.52,
        CHF: 0.88,
        CNY: 7.24,
        INR: 83.25,
        KRW: 1340.00,
        MXN: 17.15,
        THB: 35.80,
        SGD: 1.34,
        HKD: 7.78,
        NZD: 1.61,
        SEK: 10.85,
        NOK: 10.75,
        DKK: 6.87,
        PLN: 4.02,
        CZK: 22.85,
      };
    }
  },
  { maxAge: 3600 * 1000 } // Cache for 1 hour
);

export async function getAllExchangeRates(): Promise<ExchangeRates> {
  return await fetchExchangeRates();
}

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<CurrencyConversion> {
  if (fromCurrency === toCurrency) {
    return {
      fromCurrency,
      toCurrency,
      rate: 1,
      originalAmount: amount,
      convertedAmount: amount,
      lastUpdated: new Date(),
    };
  }

  const rates = await fetchExchangeRates();
  
  // Convert from source currency to USD, then USD to target currency
  let rate: number;
  
  if (fromCurrency === 'USD') {
    rate = rates[toCurrency] || 1;
  } else if (toCurrency === 'USD') {
    rate = 1 / (rates[fromCurrency] || 1);
  } else {
    // Convert via USD: fromCurrency -> USD -> toCurrency
    const fromToUsd = 1 / (rates[fromCurrency] || 1);
    const usdToTarget = rates[toCurrency] || 1;
    rate = fromToUsd * usdToTarget;
  }

  const convertedAmount = amount * rate;

  return {
    fromCurrency,
    toCurrency,
    rate,
    originalAmount: amount,
    convertedAmount: parseFloat(convertedAmount.toFixed(2)),
    lastUpdated: new Date(),
  };
}

// Smart currency detection based on trip destination
export function detectCurrencyByLocation(destination: string): string {
  const dest = destination.toLowerCase();
  
  // Japan
  if (dest.includes('japan') || dest.includes('tokyo') || dest.includes('osaka') || 
      dest.includes('kyoto') || dest.includes('hiroshima')) {
    return 'JPY';
  }
  
  // United Kingdom
  if (dest.includes('uk') || dest.includes('united kingdom') || dest.includes('england') ||
      dest.includes('london') || dest.includes('scotland') || dest.includes('wales') ||
      dest.includes('britain') || dest.includes('edinburgh')) {
    return 'GBP';
  }
  
  // European Union countries
  if (dest.includes('germany') || dest.includes('berlin') || dest.includes('munich') ||
      dest.includes('france') || dest.includes('paris') || dest.includes('lyon') ||
      dest.includes('italy') || dest.includes('rome') || dest.includes('milan') ||
      dest.includes('spain') || dest.includes('madrid') || dest.includes('barcelona') ||
      dest.includes('netherlands') || dest.includes('amsterdam') ||
      dest.includes('belgium') || dest.includes('brussels') ||
      dest.includes('austria') || dest.includes('vienna') ||
      dest.includes('portugal') || dest.includes('lisbon') ||
      dest.includes('greece') || dest.includes('athens') ||
      dest.includes('ireland') || dest.includes('dublin') ||
      dest.includes('finland') || dest.includes('helsinki') ||
      dest.includes('europe')) {
    return 'EUR';
  }
  
  // Switzerland
  if (dest.includes('switzerland') || dest.includes('zurich') || dest.includes('geneva')) {
    return 'CHF';
  }
  
  // Canada
  if (dest.includes('canada') || dest.includes('toronto') || dest.includes('vancouver') ||
      dest.includes('montreal') || dest.includes('ottawa')) {
    return 'CAD';
  }
  
  // Australia
  if (dest.includes('australia') || dest.includes('sydney') || dest.includes('melbourne') ||
      dest.includes('brisbane') || dest.includes('perth')) {
    return 'AUD';
  }
  
  // China
  if (dest.includes('china') || dest.includes('beijing') || dest.includes('shanghai') ||
      dest.includes('guangzhou') || dest.includes('shenzhen')) {
    return 'CNY';
  }
  
  // India
  if (dest.includes('india') || dest.includes('delhi') || dest.includes('mumbai') ||
      dest.includes('bangalore') || dest.includes('chennai')) {
    return 'INR';
  }
  
  // South Korea
  if (dest.includes('korea') || dest.includes('seoul') || dest.includes('busan') ||
      dest.includes('south korea')) {
    return 'KRW';
  }
  
  // Mexico
  if (dest.includes('mexico') || dest.includes('cancun') || dest.includes('mexico city') ||
      dest.includes('playa del carmen') || dest.includes('guadalajara')) {
    return 'MXN';
  }
  
  // Thailand
  if (dest.includes('thailand') || dest.includes('bangkok') || dest.includes('phuket') ||
      dest.includes('chiang mai') || dest.includes('pattaya')) {
    return 'THB';
  }
  
  // Singapore
  if (dest.includes('singapore')) {
    return 'SGD';
  }
  
  // Hong Kong
  if (dest.includes('hong kong') || dest.includes('hongkong')) {
    return 'HKD';
  }
  
  // New Zealand
  if (dest.includes('new zealand') || dest.includes('auckland') || dest.includes('wellington')) {
    return 'NZD';
  }
  
  // Nordic countries
  if (dest.includes('sweden') || dest.includes('stockholm')) {
    return 'SEK';
  }
  if (dest.includes('norway') || dest.includes('oslo')) {
    return 'NOK';
  }
  if (dest.includes('denmark') || dest.includes('copenhagen')) {
    return 'DKK';
  }
  
  // Eastern Europe
  if (dest.includes('poland') || dest.includes('warsaw') || dest.includes('krakow')) {
    return 'PLN';
  }
  if (dest.includes('czech') || dest.includes('prague') || dest.includes('czechia')) {
    return 'CZK';
  }
  
  // Default to USD for other destinations
  return 'USD';
}

// Format currency for display
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = POPULAR_CURRENCIES.find(c => c.code === currencyCode);
  const symbol = currency?.symbol || currencyCode;
  
  // Handle currencies that don't use decimal places
  switch (currencyCode) {
    case 'JPY':
    case 'KRW':
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    default:
      return `${symbol}${amount.toFixed(2)}`;
  }
}