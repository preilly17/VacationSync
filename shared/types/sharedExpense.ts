import type { SplitTgt } from "@shared/expenses";

export interface SharedExpenseParticipant {
  userId: string;
  shareSrcMinor: number;
  shareTgtMinor: number;
  status: "pending" | "paid";
  settledAt?: string | null;
}

export interface SharedExpenseRecord {
  id: string;
  payerUserId: string;
  amountSrcMinor: number;
  srcCurrency: string;
  tgtCurrency: string;
  fxRate: string;
  fxRateProvider: string;
  fxRateTimestamp: string;
  fxFeeBps?: number;
  description: string;
  category: string;
  createdAt: string;
  participants: SharedExpenseParticipant[];
  totalTgtMinor: number;
  status: "pending" | "settled";
  requestsSummary: SplitTgt[];
}
