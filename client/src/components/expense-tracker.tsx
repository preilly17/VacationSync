import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AddExpenseModal } from "./add-expense-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithDetails, User } from "@shared/schema";
import {
  CheckCircle2,
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
  Users,
} from "lucide-react";

type ExpenseBalances = {
  owes: number;
  owed: number;
  balance: number;
};

interface ExpenseTrackerProps {
  tripId: number;
  user?: User;
}

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

function ExpenseListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((item) => (
        <Card key={item}>
          <CardHeader className="space-y-3 pb-0">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ExpenseTracker({ tripId, user }: ExpenseTrackerProps) {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
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
      return expense.paidBy.id === user?.id
        ? sum + expense.totalAmount
        : sum;
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total recorded</CardDescription>
            {summaryLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <CardTitle className="text-2xl font-semibold">
                {formatCurrency(summary.total, summary.currency)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              All expenses logged for this trip.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>You paid</CardDescription>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <CardTitle className="text-2xl font-semibold text-blue-600">
                {formatCurrency(summary.youPaid, summary.currency)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Amount you covered for everyone else.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>You owe</CardDescription>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <CardTitle className="text-2xl font-semibold text-rose-600">
                {formatCurrency(summary.owes, summary.currency)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Outstanding amount you still need to pay.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>You're owed</CardDescription>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <CardTitle className="text-2xl font-semibold text-emerald-600">
                {formatCurrency(summary.owed, summary.currency)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Friends still owe you this much.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {summary.net > 0
          ? `You should receive ${formatCurrency(summary.net, summary.currency)} when everyone settles up.`
          : summary.net < 0
          ? `You still owe ${formatCurrency(Math.abs(summary.net), summary.currency)} in total.`
          : "You're all settled up!"}
      </div>

      <section className="space-y-4">
        {isLoadingExpenses ? (
          <ExpenseListSkeleton />
        ) : expenses.length === 0 ? (
          <Card className="text-center">
            <CardHeader className="items-center space-y-3">
              <Users className="h-10 w-10 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                No expenses yet
              </CardTitle>
              <CardDescription>
                Add your first expense to start tracking balances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsAddExpenseModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add an expense
              </Button>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => {
            const shareForCurrentUser = expense.shares.find(
              (share) => share.userId === user?.id,
            );
            const isDeleting = deletingId === expense.id;
            const isSettling = settlingId === expense.id;
            const perPerson =
              expense.shares.length > 0
                ? expense.totalAmount / expense.shares.length
                : expense.totalAmount;

            return (
              <Card key={expense.id} className="shadow-sm">
                <CardHeader className="gap-4 pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={expense.paidBy.profileImageUrl || undefined}
                          alt={getUserDisplayName(expense.paidBy)}
                        />
                        <AvatarFallback>
                          {getUserInitials(expense.paidBy)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">
                          {expense.description}
                        </CardTitle>
                        <CardDescription>
                          Paid by {getUserDisplayName(expense.paidBy)} on {" "}
                          {formatExpenseDate(expense.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold">
                        {formatCurrency(expense.totalAmount, expense.currency)}
                      </p>
                      {expense.shares.length > 1 ? (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(perPerson, expense.currency)} each
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="capitalize">
                      {expense.category.replace(/[_-]/g, " ")}
                    </Badge>
                    {expense.activity ? (
                      <Badge variant="outline" className="max-w-[200px] truncate">
                        Linked to {expense.activity.name}
                      </Badge>
                    ) : null}
                    {expense.receiptUrl ? (
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="px-0"
                      >
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ReceiptText className="mr-1 h-4 w-4" /> Receipt
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-4">
                  {expense.shares.map((share) => {
                    const isCurrentUser = share.userId === user?.id;
                    return (
                      <div
                        key={share.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={share.user.profileImageUrl || undefined}
                              alt={getUserDisplayName(share.user)}
                            />
                            <AvatarFallback>
                              {getUserInitials(share.user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              {getUserDisplayName(share.user)}
                              {isCurrentUser ? (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  You
                                </Badge>
                              ) : null}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {share.isPaid
                                ? "Settled"
                                : isCurrentUser
                                ? "Awaiting your payment"
                                : "Waiting for payment"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatCurrency(share.amount, expense.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {share.isPaid ? "Paid" : "Outstanding"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>

                <Separator className="mx-6" />

                <CardFooter className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <div>
                    {shareForCurrentUser ? (
                      shareForCurrentUser.isPaid ? (
                        "You're settled for this expense."
                      ) : (
                        `You owe ${formatCurrency(
                          shareForCurrentUser.amount,
                          expense.currency,
                        )} on this expense.`
                      )
                    ) : (
                      "You are not part of this split."
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {shareForCurrentUser && !shareForCurrentUser.isPaid ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSettling}
                        onClick={() => markAsPaidMutation.mutate(expense.id)}
                      >
                        {isSettling ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Mark paid
                      </Button>
                    ) : null}
                    {expense.paidBy.id === user?.id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => deleteExpenseMutation.mutate(expense.id)}
                      >
                        {isDeleting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </CardFooter>
              </Card>
            );
          })
        )}
      </section>

      <AddExpenseModal
        open={isAddExpenseModalOpen}
        onOpenChange={setIsAddExpenseModalOpen}
        tripId={tripId}
        currentUserId={user?.id}
      />
    </div>
  );
}
