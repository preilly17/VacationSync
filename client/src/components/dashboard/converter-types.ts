export type LastConversion = {
  amount: number;
  from: string;
  to: string;
  result: number;
  rate: number;
  timestamp: number;
};

export type ConversionRecent = LastConversion;
