import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AddExpenseModal } from "./add-expense-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithDetails, User } from "@shared/schema";
import { minorUnitsToAmount } from "@shared/expenses";
import {
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PiggyBank,
  Plus,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ExpenseBalances = {
  owes: number;
  owed: number;
  balance: number;
};

interface ExpenseTrackerProps {
  tripId: number;
  user?: User;
}

type SectionKey = "open" | "completed";

type SummaryCardKey = "paid" | "owe" | "owed";

const summaryCardStyles: Record<
  SummaryCardKey,
  {
    accent: string;
    surface: string;
    icon: string;
    focusRing: string;
    dot: string;
  }
> = {
  paid: {
    accent: "from-sky-400 via-sky-500 to-indigo-500",
    surface: "bg-sky-500/10 dark:bg-sky-500/20",
    icon: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-100",
    focusRing: "focus-visible:ring-sky-500",
    dot: "bg-sky-500",
  },
  owe: {
    accent: "from-amber-400 via-orange-400 to-orange-500",
    surface: "bg-amber-500/10 dark:bg-amber-500/20",
    icon: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-100",
    focusRing: "focus-visible:ring-amber-500",
    dot: "bg-amber-500",
  },
  owed: {
    accent: "from-emerald-400 via-emerald-500 to-teal-500",
    surface: "bg-emerald-500/10 dark:bg-emerald-500/20",
    icon: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-100",
    focusRing: "focus-visible:ring-emerald-500",
    dot: "bg-emerald-500",
  },
};

function formatCurrency(amount: number, currency: string) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

function getUserDisplayName(user?: User | null) {
  if (!user) {
    return "Traveler";
  }

  return (
    user.firstName?.trim() ||
    user.username?.trim() ||
    user.email
  );
}

function getUserInitials(user?: User | null) {
  if (!user) {
    return "TR";
  }

  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((part) => part?.trim()[0] ?? "")
    .join("");

  if (initials.length > 0) {
    return initials.toUpperCase();
  }

  return (user.email ?? "T").slice(0, 2).toUpperCase();
}

function formatExpenseDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRate(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  } catch {
    return value.toFixed(4);
  }
}

function getShareTargetAmountForExpense(
  share: ExpenseWithDetails["shares"][number],
  expense: ExpenseWithDetails,
) {
  const targetCurrency = expense.targetCurrency ?? expense.currency;
  return typeof share.amountTargetMinorUnits === "number"
    ? minorUnitsToAmount(share.amountTargetMinorUnits, targetCurrency)
    : share.amount;
}

function getShareSourceAmountForExpense(
  share: ExpenseWithDetails["shares"][number],
  expense: ExpenseWithDetails,
) {
  const sourceCurrency = expense.originalCurrency ?? expense.currency;
  return typeof share.amountSourceMinorUnits === "number"
    ? minorUnitsToAmount(share.amountSourceMinorUnits, sourceCurrency)
    : null;
}

function ExpenseListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-md border border-transparent bg-muted/40 px-3 py-3"
        >
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExpenseTracker({ tripId, user }: ExpenseTrackerProps) {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [activeExpenseId, setActiveExpenseId] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState({
    open: true,
    completed: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: expenses = [],
    isLoading: isLoadingExpenses,
  } = useQuery<ExpenseWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/expenses`],
  });

  const { data: balances } = useQuery<ExpenseBalances>({
    queryKey: [`/api/trips/${tripId}/expenses/balances`],
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      await apiRequest(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });
    },
    onMutate: (expenseId: number) => {
      setDeletingId(expenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/expenses`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/expenses/balances`],
      });
      toast({
        title: "Expense removed",
        description: "The expense has been deleted.",
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete expense";
      toast({
        title: "Unable to delete expense",
        description: message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      await apiRequest(`/api/expenses/${expenseId}/mark-paid`, {
        method: "PATCH",
      });
    },
    onMutate: (expenseId: number) => {
      setSettlingId(expenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/expenses`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/expenses/balances`],
      });
      toast({
        title: "Marked as paid",
        description: "Your share has been marked as paid.",
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to mark expense as paid";
      toast({
        title: "Unable to update expense",
        description: message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSettlingId(null);
    },
  });

  const summaryCurrency = expenses[0]?.currency ?? "USD";
  const summary = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
    const youPaid = expenses.reduce((sum, expense) => {
      let total = sum;

      if (expense.paidBy.id === user?.id) {
        total += expense.totalAmount;
        return total;
      }

      if (!user?.id) {
        return total;
      }

      const paidShareForUser = expense.shares.find(
        (share) => share.userId === user.id && share.status === "paid",
      );

      if (paidShareForUser) {
        total += paidShareForUser.amount;
      }

      return total;
    }, 0);
    const owes = Number(balances?.owes ?? 0);
    const owed = Number(balances?.owed ?? 0);

    return {
      currency: summaryCurrency,
      total,
      youPaid,
      owes,
      owed,
      net: owed - owes,
    };
  }, [expenses, user?.id, balances, summaryCurrency]);

  const summaryLoading = isLoadingExpenses && expenses.length === 0;

  const summaryCardData: Array<{
    key: SummaryCardKey;
    label: string;
    value: string;
    description: string;
    Icon: typeof Wallet;
    showDot: boolean;
  }> = [
    {
      key: "paid",
      label: "You've paid",
      value: formatCurrency(summary.youPaid, summary.currency),
      description: "Total amount you've personally covered.",
      Icon: Wallet,
      showDot: false,
    },
    {
      key: "owe",
      label: "You owe",
      value: formatCurrency(summary.owes, summary.currency),
      description: "What you still need to pay others.",
      Icon: ArrowUpCircle,
      showDot: summary.owes > 0,
    },
    {
      key: "owed",
      label: "You're owed",
      value: formatCurrency(summary.owed, summary.currency),
      description: "What others still need to pay you.",
      Icon: PiggyBank,
      showDot: summary.owed > 0,
    },
  ];

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      }),
    [expenses],
  );

  const sectionedExpenses = useMemo(() => {
    const buckets: Record<SectionKey, ExpenseWithDetails[]> = {
      open: [],
      completed: [],
    };

    sortedExpenses.forEach((expense) => {
      const shareForCurrentUser = user?.id
        ? expense.shares.find((share) => share.userId === user.id)
        : null;
      const pendingNonPayerShares = expense.shares.filter(
        (share) => share.userId !== expense.paidBy.id && share.status !== "paid",
      );
      const needsYourPayment =
        !!shareForCurrentUser &&
        shareForCurrentUser.userId !== expense.paidBy.id &&
        shareForCurrentUser.status !== "paid";
      const waitingOnOthers =
        expense.paidBy.id === user?.id && pendingNonPayerShares.length > 0;

      if (needsYourPayment || waitingOnOthers) {
        buckets.open.push(expense);
      } else {
        buckets.completed.push(expense);
      }
    });

    return buckets;
  }, [sortedExpenses, user?.id]);

  const activeExpense = useMemo(
    () => expenses.find((expense) => expense.id === activeExpenseId) ?? null,
    [expenses, activeExpenseId],
  );

  const owesBadgeClass =
    "border-transparent bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-100";
  const waitingBadgeClass =
    "border-transparent bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-100";
  const paidBadgeClass =
    "border-transparent bg-slate-500/15 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200";

  const sections: {
    key: SectionKey;
    title: string;
    description: string;
    emptyMessage: string;
  }[] = [
    {
      key: "open",
      title: "Open transactions",
      description: "Outstanding expenses that still need attention.",
      emptyMessage: "You're all caught up. Nothing needs attention right now.",
    },
    {
      key: "completed",
      title: "Completed",
      description: "Settled expenses stay on record for reference.",
      emptyMessage: "Once expenses are fully paid they will move here.",
    },
  ];

  const renderExpenseRow = (expense: ExpenseWithDetails) => {
    const targetCurrency = expense.targetCurrency ?? expense.currency;
    const shareForCurrentUser = user?.id
      ? expense.shares.find((share) => share.userId === user.id)
      : null;
    const yourShareAmount =
      shareForCurrentUser !== undefined && shareForCurrentUser !== null
        ? getShareTargetAmountForExpense(shareForCurrentUser, expense)
        : null;
    const yourShareDisplay =
      yourShareAmount !== null
        ? formatCurrency(yourShareAmount, targetCurrency)
        : "—";
    const isCurrentUserDebtor =
      !!shareForCurrentUser &&
      shareForCurrentUser.userId !== expense.paidBy.id &&
      shareForCurrentUser.status !== "paid";
    const pendingSharesForOthers = expense.shares.filter(
      (share) => share.userId !== expense.paidBy.id && share.status !== "paid",
    );
    const waitingOnOthers =
      expense.paidBy.id === user?.id && pendingSharesForOthers.length > 0;
    const badgeClassName = isCurrentUserDebtor
      ? owesBadgeClass
      : waitingOnOthers
      ? waitingBadgeClass
      : paidBadgeClass;
    const statusLabel = isCurrentUserDebtor
      ? "You owe"
      : waitingOnOthers
      ? "Waiting"
      : "Settled";
    const isSettlingRow = settlingId === expense.id;
    const payerDisplay = getUserDisplayName(expense.paidBy);
    const dateDisplay = formatExpenseDate(expense.createdAt);
    const totalDisplay = formatCurrency(expense.totalAmount, targetCurrency);
    const shareClassName = cn(
      "text-base font-semibold tracking-tight tabular-nums text-right text-foreground",
      yourShareAmount === null ? "text-muted-foreground" : undefined,
    );

    const shareSummary = (() => {
      if (isCurrentUserDebtor) {
        const shareLabel =
          yourShareAmount !== null ? yourShareDisplay : "your share";
        return `You still owe ${shareLabel}.`;
      }
      if (waitingOnOthers) {
        const paymentCount = pendingSharesForOthers.length;
        const paymentLabel = paymentCount === 1 ? "payment" : "payments";
        return `Waiting on ${paymentCount} ${paymentLabel}.`;
      }
      return "All settled.";
    })();

    return (
      <div
        key={expense.id}
        role="button"
        tabIndex={0}
        onClick={() => setActiveExpenseId(expense.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveExpenseId(expense.id);
          }
        }}
        className={cn(
          "group flex items-start gap-4 rounded-xl border border-transparent bg-transparent px-4 py-3 transition-all duration-200",
          "hover:border-sky-500/30 hover:bg-sky-500/5 dark:hover:border-sky-500/30 dark:hover:bg-sky-500/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-sky-500",
        )}
      >
        <Avatar className="h-9 w-9">
          <AvatarImage
            src={expense.paidBy.profileImageUrl || undefined}
            alt={payerDisplay}
          />
          <AvatarFallback>{getUserInitials(expense.paidBy)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">
            {expense.description || "Untitled expense"}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{payerDisplay}</span>
            <span className="hidden sm:inline">•</span>
            <span>{dateDisplay}</span>
          </div>
          <p className="text-xs text-muted-foreground">{shareSummary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 border-l border-border/70 pl-4 text-right dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className={shareClassName}>{yourShareDisplay}</span>
            <Badge
              variant="outline"
              className={cn(
                "border-transparent px-2.5 py-1 text-xs font-semibold shadow-sm",
                badgeClassName,
              )}
            >
              {statusLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isCurrentUserDebtor ? (
              <Button
                variant="default"
                size="sm"
                disabled={isSettlingRow}
                onClick={(event) => {
                  event.stopPropagation();
                  markAsPaidMutation.mutate(expense.id);
                }}
              >
                {isSettlingRow ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                Mark paid
              </Button>
            ) : null}
            <span className="text-right text-sm font-medium text-muted-foreground tabular-nums">
              {totalDisplay}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const detailContent = (() => {
    if (!activeExpense) {
      return null;
    }

    const targetCurrency = activeExpense.targetCurrency ?? activeExpense.currency;
    const sourceCurrency = activeExpense.originalCurrency ?? targetCurrency;
    const rateLabel = formatRate(activeExpense.exchangeRate);
    const rateDescriptor = rateLabel
      ? `${rateLabel} ${targetCurrency}/${sourceCurrency}`
      : null;
    const sourceTotalAmount =
      typeof activeExpense.sourceAmountMinorUnits === "number"
        ? minorUnitsToAmount(activeExpense.sourceAmountMinorUnits, sourceCurrency)
        : null;
    const sharesExcludingPayer = activeExpense.shares.filter(
      (share) => share.userId !== activeExpense.paidBy.id,
    );
    const shareForCurrentUser = user?.id
      ? activeExpense.shares.find((share) => share.userId === user.id)
      : null;
    const isCurrentUserSharePaid = shareForCurrentUser?.status === "paid";
    const isCurrentUserDebtor =
      !!shareForCurrentUser &&
      shareForCurrentUser.userId !== activeExpense.paidBy.id &&
      !isCurrentUserSharePaid;
    const payerDisplay = getUserDisplayName(activeExpense.paidBy);
    const isSettlingDetail = settlingId === activeExpense.id;
    const isDeletingDetail = deletingId === activeExpense.id;
    const categoryLabel = activeExpense.category?.replace(/[_-]/g, " ");

    const headerDetails: string[] = [];
    if (sourceTotalAmount !== null) {
      headerDetails.push(`Paid ${formatCurrency(sourceTotalAmount, sourceCurrency)}`);
    }
    if (rateDescriptor && sourceCurrency !== targetCurrency) {
      headerDetails.push(`Rate ${rateDescriptor}`);
    }
    const headerDetailText = headerDetails.join(" • ");

    const getShareTargetAmount = (
      share: (typeof activeExpense.shares)[number],
    ) => getShareTargetAmountForExpense(share, activeExpense);
    const getShareSourceAmount = (
      share: (typeof activeExpense.shares)[number],
    ) => getShareSourceAmountForExpense(share, activeExpense);

    const currentUserTargetShare =
      shareForCurrentUser !== undefined && shareForCurrentUser !== null
        ? getShareTargetAmount(shareForCurrentUser)
        : null;
    const currentUserTargetDisplay =
      currentUserTargetShare !== null
        ? formatCurrency(currentUserTargetShare, targetCurrency)
        : null;
    const currentUserSourceShare =
      shareForCurrentUser !== undefined && shareForCurrentUser !== null
        ? getShareSourceAmount(shareForCurrentUser)
        : null;
    const currentUserSourceDisplay =
      currentUserSourceShare !== null
        ? formatCurrency(currentUserSourceShare, sourceCurrency)
        : null;
    const currentUserConversionDetail = (() => {
      if (!shareForCurrentUser || sourceCurrency === targetCurrency) {
        return null;
      }
      if (currentUserSourceDisplay) {
        return rateDescriptor
          ? `${currentUserSourceDisplay} @ ${rateDescriptor}`
          : currentUserSourceDisplay;
      }
      return rateDescriptor ? `Rate ${rateDescriptor}` : null;
    })();

    const footerMessage = (() => {
      if (shareForCurrentUser) {
        if (isCurrentUserSharePaid) {
          return "You're settled for this expense.";
        }
        const fallbackAmount = formatCurrency(
          getShareTargetAmount(shareForCurrentUser),
          targetCurrency,
        );
        const amountDisplay = currentUserTargetDisplay ?? fallbackAmount;
        return currentUserConversionDetail
          ? `You owe ${amountDisplay} to ${payerDisplay} (based on ${currentUserConversionDetail}).`
          : `You owe ${amountDisplay} to ${payerDisplay}.`;
      }
      if (activeExpense.paidBy.id === user?.id) {
        return "You covered this expense for everyone else.";
      }
      return "You are not part of this split.";
    })();

    return (
      <>
        <DialogHeader>
          <DialogTitle>{activeExpense.description || "Untitled expense"}</DialogTitle>
          <DialogDescription>
            Paid by {payerDisplay} on {formatExpenseDate(activeExpense.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold">
              {formatCurrency(activeExpense.totalAmount, targetCurrency)}
            </span>
            {headerDetailText ? (
              <span className="text-xs text-muted-foreground">{headerDetailText}</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Splits include the payer; the payer never receives a request.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {categoryLabel ? (
              <Badge
                variant="outline"
                className="border-transparent bg-slate-500/15 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200 capitalize"
              >
                {categoryLabel}
              </Badge>
            ) : null}
            {activeExpense.activity ? (
              <Badge variant="outline" className="border-transparent bg-slate-500/15 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200">
                Linked to {activeExpense.activity.name}
              </Badge>
            ) : null}
            {activeExpense.receiptUrl ? (
              <Button asChild variant="link" size="sm" className="px-0">
                <a
                  href={activeExpense.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ReceiptText className="mr-1 h-4 w-4" />
                  Receipt
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          {sharesExcludingPayer.map((share) => {
            const isSharePaid = share.status === "paid";
            const targetShareAmount = getShareTargetAmount(share);
            const targetShareDisplay = formatCurrency(
              targetShareAmount,
              targetCurrency,
            );
            const sourceShareAmount = getShareSourceAmount(share);
            const sourceShareDisplay =
              sourceShareAmount !== null
                ? formatCurrency(sourceShareAmount, sourceCurrency)
                : null;
            const conversionDetail =
              sourceCurrency === targetCurrency
                ? null
                : sourceShareDisplay
                ? rateDescriptor
                  ? `${sourceShareDisplay} @ ${rateDescriptor}`
                  : sourceShareDisplay
                : rateDescriptor
                ? `Rate ${rateDescriptor}`
                : null;

            return (
              <div
                key={share.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3 dark:border-white/10 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={share.user.profileImageUrl || undefined}
                      alt={getUserDisplayName(share.user)}
                    />
                    <AvatarFallback>{getUserInitials(share.user)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {getUserDisplayName(share.user)}
                      {share.userId === user?.id ? (
                        <Badge
                          variant="outline"
                          className="ml-2 border-transparent bg-slate-500/15 text-xs font-semibold text-slate-700 dark:bg-slate-500/25 dark:text-slate-200"
                        >
                          You
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isSharePaid
                        ? "Paid"
                        : share.userId === user?.id
                        ? "Awaiting your payment"
                        : "Awaiting payment"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {targetShareDisplay}
                  </p>
                  {conversionDetail ? (
                    <p className="text-xs text-muted-foreground">{conversionDetail}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
          <p>{footerMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            {isCurrentUserDebtor ? (
              <Button
                variant="default"
                size="sm"
                disabled={isSettlingDetail}
                onClick={() => markAsPaidMutation.mutate(activeExpense.id)}
              >
                {isSettlingDetail ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                Mark paid
              </Button>
            ) : null}
            {activeExpense.paidBy.id === user?.id ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingDetail}
                onClick={() => deleteExpenseMutation.mutate(activeExpense.id)}
              >
                {isDeletingDetail ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-4 w-4" />
                )}
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </>
    );
  })();
  const netAbsoluteAmount = Math.abs(summary.net);
  const netStatusText = summary.net === 0
    ? "You're all settled up"
    : summary.net > 0
    ? `You're owed ${formatCurrency(summary.net, summary.currency)}`
    : `You owe ${formatCurrency(netAbsoluteAmount, summary.currency)}`;
  const netPillClass = summary.net === 0
    ? "bg-slate-500/15 text-slate-700 dark:bg-slate-500/25 dark:text-slate-100"
    : summary.net > 0
    ? "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-100"
    : "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-100";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Shared expenses</h3>
          <p className="text-sm text-muted-foreground">
            Track purchases and know exactly who still owes what.
          </p>
        </div>
        <Button
          onClick={() => setIsAddExpenseModalOpen(true)}
          className="bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-500 text-white shadow-[0_16px_38px_-20px_rgba(14,116,144,0.65)] transition-all hover:from-sky-500 hover:via-sky-600 hover:to-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-sky-500 dark:shadow-[0_18px_42px_-22px_rgba(8,47,73,0.75)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Log expense
        </Button>
      </div>

      <div className="space-y-4">
        <div
          role="group"
          tabIndex={0}
          className="group relative overflow-hidden rounded-2xl border border-border/70 bg-indigo-500/5 p-5 shadow-[0_24px_48px_-32px_rgba(15,23,42,0.5)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_26px_52px_-28px_rgba(15,23,42,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-[#6366f1] dark:border-white/10 dark:bg-indigo-500/15 dark:shadow-[0_32px_56px_-30px_rgba(0,0,0,0.7)] dark:hover:shadow-[0_34px_60px_-26px_rgba(0,0,0,0.75)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#f97316] via-[#f472b6] to-[#6366f1] opacity-80 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-foreground/80">
                Net balance
              </span>
              {summaryLoading ? (
                <Skeleton className="h-7 w-28 rounded-md" />
              ) : (
                <p className="text-[1.6rem] font-semibold tracking-tight text-foreground tabular-nums">
                  {formatCurrency(netAbsoluteAmount, summary.currency)}
                </p>
              )}
              {!summaryLoading ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This is the difference between what you're owed and what you owe across every expense on this trip.
                </p>
              ) : (
                <Skeleton className="h-3 w-56 rounded-md" />
              )}
            </div>
            <div className="flex items-start justify-end">
              <div
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm", 
                  netPillClass,
                )}
              >
                {summaryLoading ? <Skeleton className="h-4 w-28 rounded-full" /> : netStatusText}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {summaryCardData.map((card) => {
            const styles = summaryCardStyles[card.key];
            return (
              <div
                key={card.label}
                role="group"
                tabIndex={0}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/70 p-5 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.5)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_22px_48px_-28px_rgba(15,23,42,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:shadow-[0_28px_54px_-32px_rgba(0,0,0,0.68)] dark:hover:shadow-[0_30px_58px_-28px_rgba(0,0,0,0.72)]",
                  styles.surface,
                  styles.focusRing,
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r opacity-80 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100",
                    styles.accent,
                  )}
                />
                {card.showDot ? (
                  <span
                    className={cn(
                      "absolute right-4 top-4 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-white/80 shadow-sm dark:border-white/20",
                      styles.dot,
                    )}
                    aria-hidden
                  />
                ) : null}
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full",
                  styles.icon,
                )}
                >
                  <card.Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-foreground/80">
                  {card.label}
                </p>
                {summaryLoading ? (
                  <>
                    <Skeleton className="mt-3 h-6 w-24 rounded-md" />
                    <Skeleton className="mt-2 h-3 w-28 rounded-md" />
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-[1.45rem] font-semibold tracking-tight text-foreground tabular-nums">
                      {card.value}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {summaryLoading ? (
        <ExpenseListSkeleton />
      ) : expenses.length === 0 ? (
        <div className="rounded-md border border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No shared expenses yet. Add your first one to start tracking balances.
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => {
            const items = sectionedExpenses[section.key];
            const isOpen = openSections[section.key];
            return (
              <Collapsible
                key={section.key}
                open={isOpen}
                onOpenChange={(open) =>
                  setOpenSections((previous) => ({ ...previous, [section.key]: open }))
                }
              >
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_48px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[0_30px_52px_-34px_rgba(0,0,0,0.65)]">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between gap-2 bg-slate-100/60 px-4 py-3 text-left text-sm font-semibold text-foreground/80 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-sky-500 dark:bg-slate-800/50 dark:text-foreground dark:hover:bg-slate-800/70"
                    >
                      <span>{section.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground/80">
                        <span>{items.length}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isOpen ? "rotate-180" : "rotate-0",
                          )}
                        />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <div className="border-t border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-slate-900/40">
                    {section.description}
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-2 px-2 pb-4 pt-2 sm:px-4">
                      {items.length === 0 ? (
                        <p className="rounded-xl bg-muted/40 px-3 py-3 text-xs text-muted-foreground dark:bg-slate-800/50">
                          {section.emptyMessage}
                        </p>
                      ) : (
                        items.map(renderExpenseRow)
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      <Dialog
        open={activeExpense !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveExpenseId(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">{detailContent}</DialogContent>
      </Dialog>

      <AddExpenseModal
        open={isAddExpenseModalOpen}
        onOpenChange={setIsAddExpenseModalOpen}
        tripId={tripId}
        currentUserId={user?.id}
      />
    </div>
  );
}

