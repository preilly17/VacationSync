import { computeCurrencyAwareSplits } from "@shared/expenses";
import type {
  SharedExpenseParticipant,
  SharedExpenseRecord,
} from "@shared/types/sharedExpense";

interface CreateExpenseInput {
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
  participantUserIds: string[];
}

let expenses: SharedExpenseRecord[] = [];
let counter = 1;

function cloneExpense(expense: SharedExpenseRecord): SharedExpenseRecord {
  return JSON.parse(JSON.stringify(expense));
}

export function createExpense(input: CreateExpenseInput): SharedExpenseRecord {
  const { rows, totalTgtMinor } = computeCurrencyAwareSplits(
    input.amountSrcMinor,
    input.participantUserIds,
    input.srcCurrency,
    input.tgtCurrency,
    input.fxRate,
  );

  const nowIso = new Date().toISOString();
  const id = String(counter++);
  const participants: SharedExpenseParticipant[] = rows.map((row) => ({
    userId: row.userId,
    shareSrcMinor: row.shareSrcMinor,
    shareTgtMinor: row.shareTgtMinor,
    status: "pending",
    settledAt: null,
  }));

  const record: SharedExpenseRecord = {
    id,
    payerUserId: input.payerUserId,
    amountSrcMinor: input.amountSrcMinor,
    srcCurrency: input.srcCurrency,
    tgtCurrency: input.tgtCurrency,
    fxRate: input.fxRate,
    fxRateProvider: input.fxRateProvider,
    fxRateTimestamp: input.fxRateTimestamp,
    fxFeeBps: input.fxFeeBps,
    description: input.description,
    category: input.category,
    createdAt: nowIso,
    participants,
    totalTgtMinor,
    status: "pending",
    requestsSummary: rows,
  };

  expenses.unshift(record);
  return cloneExpense(record);
}

export function listExpenses(): SharedExpenseRecord[] {
  return expenses.map((expense) => cloneExpense(expense));
}

export function markParticipantPaid(
  expenseId: string,
  userId: string,
): SharedExpenseRecord {
  const expense = expenses.find((item) => item.id === expenseId);
  if (!expense) {
    throw new Error("Expense not found");
  }

  const participant = expense.participants.find((item) => item.userId === userId);
  if (!participant) {
    throw new Error("Participant not found on expense");
  }

  participant.status = "paid";
  participant.settledAt = new Date().toISOString();

  if (expense.participants.every((item) => item.status === "paid")) {
    expense.status = "settled";
  }

  return cloneExpense(expense);
}

export function resetExpenseStore() {
  expenses = [];
  counter = 1;
}
