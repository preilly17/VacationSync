import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
} from "@/components/ui/badge";
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
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
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

type SectionKey = "needsYourPayment" | "waitingOnOthers" | "settled";

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
    needsYourPayment: true,
    waitingOnOthers: true,
    settled: false,
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
      needsYourPayment: [],
      waitingOnOthers: [],
      settled: [],
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

      if (needsYourPayment) {
        buckets.needsYourPayment.push(expense);
      } else if (waitingOnOthers) {
        buckets.waitingOnOthers.push(expense);
      } else {
        buckets.settled.push(expense);
      }
    });

    return buckets;
  }, [sortedExpenses, user?.id]);

  const activeExpense = useMemo(
    () => expenses.find((expense) => expense.id === activeExpenseId) ?? null,
    [expenses, activeExpenseId],
  );

  const pendingBadgeClass = "border-transparent bg-primary/10 text-primary";
  const paidBadgeClass = "border-transparent bg-muted text-muted-foreground";

  const sections: { key: SectionKey; title: string; description: string }[] = [
    {
      key: "needsYourPayment",
      title: "Needs your payment",
      description: "These balances still require your payment.",
    },
    {
      key: "waitingOnOthers",
      title: "Waiting on others",
      description: "You covered these expenses and are waiting to be repaid.",
    },
    {
      key: "settled",
      title: "Settled",
      description: "Paid expenses stay on record here for reference.",
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
    const hasPendingFromOthers = expense.shares.some(
      (share) => share.userId !== expense.paidBy.id && share.status !== "paid",
    );
    const waitingOnOthers =
      expense.paidBy.id === user?.id && hasPendingFromOthers;
    const status = isCurrentUserDebtor || waitingOnOthers ? "pending" : "paid";
    const badgeClassName =
      status === "pending" ? pendingBadgeClass : paidBadgeClass;
    const statusLabel = status === "pending" ? "Pending" : "Paid";
    const isSettlingRow = settlingId === expense.id;
    const payerDisplay = getUserDisplayName(expense.paidBy);
    const dateDisplay = formatExpenseDate(expense.createdAt);
    const totalDisplay = formatCurrency(expense.totalAmount, targetCurrency);
    const shareClassName = cn(
      "text-sm font-semibold tabular-nums text-right",
      yourShareAmount === null ? "text-muted-foreground" : undefined,
    );

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
        className="group flex items-start gap-3 rounded-md px-3 py-2 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className={shareClassName}>{yourShareDisplay}</span>
            <Badge
              variant="outline"
              className={cn("border-transparent text-xs font-medium", badgeClassName)}
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
            <span className="text-xs text-muted-foreground tabular-nums text-right">
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
              <Badge variant="outline" className="border-transparent capitalize">
                {categoryLabel}
              </Badge>
            ) : null}
            {activeExpense.activity ? (
              <Badge variant="outline" className="border-transparent">
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
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
                    <p className="text-sm font-medium">
                      {getUserDisplayName(share.user)}
                      {share.userId === user?.id ? (
                        <Badge
                          variant="outline"
                          className="ml-2 border-transparent text-xs text-muted-foreground"
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
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Shared expenses</h3>
          <p className="text-sm text-muted-foreground">
            Track purchases and know exactly who still owes what.
          </p>
        </div>
        <Button onClick={() => setIsAddExpenseModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Log expense
        </Button>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {summaryLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : summary.net === 0 ? (
            <span>You're all settled up</span>
          ) : summary.net > 0 ? (
            <span>You're owed {formatCurrency(summary.net, summary.currency)}</span>
          ) : (
            <span>You owe {formatCurrency(Math.abs(summary.net), summary.currency)}</span>
          )}
        </div>
        {summaryLoading ? (
          <Skeleton className="h-3 w-64" />
        ) : (
          <p className="text-xs text-muted-foreground">
            You paid {formatCurrency(summary.youPaid, summary.currency)} • You owe{" "}
            {formatCurrency(summary.owes, summary.currency)} • You're owed{" "}
            {formatCurrency(summary.owed, summary.currency)}
          </p>
        )}
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
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
                    >
                      <span>{section.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                  <CollapsibleContent>
                    <div className="space-y-2 pt-2">
                      {items.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted-foreground">
                          {section.key === "settled"
                            ? "Paid expenses will appear here once everything is settled."
                            : "All caught up here."}
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

