import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type SummaryView = "total" | "youPaid" | "youOwe" | "youAreOwed";

type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

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
  const [detailView, setDetailView] = useState<SummaryView | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
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
        (share) => share.userId === user.id && share.isPaid,
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

  useEffect(() => {
    if (detailView) {
      setSearchTerm("");
      setSortOption("date-desc");
    }
  }, [detailView]);

  const cardConfigs: {
    type: SummaryView;
    title: string;
    description: string;
    amount: number;
    amountClassName?: string;
  }[] = useMemo(
    () => [
      {
        type: "total",
        title: "Total recorded",
        description: "All expenses logged for this trip.",
        amount: summary.total,
      },
      {
        type: "youPaid",
        title: "You paid",
        description: "Amount you covered for everyone else.",
        amount: summary.youPaid,
        amountClassName: "text-blue-600",
      },
      {
        type: "youOwe",
        title: "You owe",
        description: "Outstanding amount you still need to pay.",
        amount: summary.owes,
        amountClassName: "text-rose-600",
      },
      {
        type: "youAreOwed",
        title: "You're owed",
        description: "Friends still owe you this much.",
        amount: summary.owed,
        amountClassName: "text-emerald-600",
      },
    ],
    [summary.owed, summary.owes, summary.total, summary.youPaid],
  );

  const selectedCard = detailView
    ? cardConfigs.find((card) => card.type === detailView)
    : null;

  const filteredExpenses = useMemo(() => {
    if (!detailView) {
      return [] as ExpenseWithDetails[];
    }

    const matchesView = (expense: ExpenseWithDetails) => {
      if (detailView === "total") {
        return true;
      }

      if (!user?.id) {
        return false;
      }

      const shareForCurrentUser = expense.shares.find(
        (share) => share.userId === user.id && share.userId !== expense.paidBy.id,
      );

      if (detailView === "youPaid") {
        return expense.paidBy.id === user.id;
      }

      if (detailView === "youOwe") {
        return (
          !!shareForCurrentUser &&
          shareForCurrentUser.amount > 0 &&
          !shareForCurrentUser.isPaid
        );
      }

      if (detailView === "youAreOwed") {
        if (expense.paidBy.id !== user.id) {
          return false;
        }
        return expense.shares.some(
          (share) =>
            share.userId !== user.id &&
            share.userId !== expense.paidBy.id &&
            share.amount > 0 &&
            !share.isPaid,
        );
      }

      return false;
    };

    const matchesTrip = (expense: ExpenseWithDetails) => {
      if (!Number.isFinite(tripId)) {
        return true;
      }

      if (typeof expense.tripId !== "number") {
        return true;
      }

      return expense.tripId === tripId;
    };

    const searchQuery = searchTerm.trim().toLowerCase();

    const matchesSearch = (expense: ExpenseWithDetails) => {
      if (!searchQuery) {
        return true;
      }

      const title = expense.description?.toLowerCase() ?? "";
      const category = expense.category?.toLowerCase() ?? "";
      const activityName = expense.activity?.name?.toLowerCase() ?? "";
      const notes: string[] = [];
      if (category) notes.push(category.replace(/[_-]/g, " "));
      if (activityName) notes.push(activityName);
      const haystack = `${title} ${notes.join(" ")}`.trim();
      return haystack.includes(searchQuery);
    };

    const filtered = expenses.filter(
      (expense) => matchesView(expense) && matchesTrip(expense) && matchesSearch(expense),
    );

    return filtered.sort((a, b) => {
      if (sortOption === "date-desc" || sortOption === "date-asc") {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const comparison = aDate - bDate;
        return sortOption === "date-desc" ? -comparison : comparison;
      }

      const aAmount = a.totalAmount;
      const bAmount = b.totalAmount;
      const comparison = aAmount - bAmount;
      return sortOption === "amount-desc" ? -comparison : comparison;
    });
  }, [
    detailView,
    expenses,
    searchTerm,
    sortOption,
    tripId,
    user?.id,
  ]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "date-desc", label: "Date (newest)" },
    { value: "date-asc", label: "Date (oldest)" },
    { value: "amount-desc", label: "Amount (high to low)" },
    { value: "amount-asc", label: "Amount (low to high)" },
  ];

  const openDetailView = (type: SummaryView) => {
    if (summaryLoading) {
      return;
    }
    setDetailView(type);
  };

  const closeDetailView = () => {
    setDetailView(null);
  };

  const handleViewExpense = (expenseId: number) => {
    closeDetailView();
    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      const element = document.getElementById(`expense-${expenseId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        if (element instanceof HTMLElement) {
          element.focus({ preventScroll: true });
        }
      }
      window.location.hash = `expense-${expenseId}`;
    }, 150);
  };

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
        {cardConfigs.map((card) => (
          <Card
            key={card.type}
            role="button"
            tabIndex={0}
            onClick={() => openDetailView(card.type)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetailView(card.type);
              }
            }}
            className={cn(
              "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "cursor-pointer hover:border-primary/50",
              detailView === card.type ? "border-primary" : undefined,
            )}
            aria-label={`${card.title} details`}
          >
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              {summaryLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <CardTitle
                  className={cn("text-2xl font-semibold", card.amountClassName)}
                >
                  {formatCurrency(card.amount, summary.currency)}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
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
            const sharesExcludingPayer = expense.shares.filter(
              (share) => share.userId !== expense.paidBy.id,
            );
            const shareForCurrentUser = sharesExcludingPayer.find(
              (share) => share.userId === user?.id,
            );
            const isDeleting = deletingId === expense.id;
            const isSettling = settlingId === expense.id;
            const perPerson =
              sharesExcludingPayer.length > 0
                ? expense.totalAmount / sharesExcludingPayer.length
                : expense.totalAmount;

            return (
              <Card
                key={expense.id}
                id={`expense-${expense.id}`}
                className="shadow-sm"
                tabIndex={-1}
              >
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
                      {sharesExcludingPayer.length > 1 ? (
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
                  {sharesExcludingPayer.map((share) => {
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
                    ) : expense.paidBy.id === user?.id ? (
                      "You covered this expense for everyone else."
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

      <Dialog
        open={detailView !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDetailView();
          }
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{selectedCard?.title}</DialogTitle>
            <DialogDescription>
              Review the individual expenses that make up this total.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">
                  {selectedCard
                    ? formatCurrency(selectedCard.amount, summary.currency)
                    : formatCurrency(0, summary.currency)}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div className="text-sm text-muted-foreground sm:text-right">
                  Showing expenses for this trip.
                </div>
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by title or notes"
                  className="w-full min-w-[200px] sm:w-60"
                  aria-label="Search expenses"
                />
                <Select
                  value={sortOption}
                  onValueChange={(value: SortOption) => setSortOption(value)}
                >
                  <SelectTrigger
                    className="w-full min-w-[200px] sm:w-52"
                    aria-label="Sort expenses"
                  >
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
                <h4 className="text-base font-semibold">Nothing here yet</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  When expenses for this trip appear, they’ll show up here.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Added by</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total amount</TableHead>
                    <TableHead className="text-right">My share</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const sharesExcludingPayer = expense.shares.filter(
                      (share) => share.userId !== expense.paidBy.id,
                    );
                    const shareForCurrentUser = sharesExcludingPayer.find(
                      (share) => share.userId === user?.id,
                    );

                    const outstandingFromOthers = sharesExcludingPayer
                      .filter((share) => share.userId !== user?.id && !share.isPaid)
                      .reduce((total, share) => total + share.amount, 0);

                    const myShareAmount =
                      detailView === "youOwe"
                        ? shareForCurrentUser?.amount ?? 0
                        : detailView === "youAreOwed"
                          ? outstandingFromOthers
                          : 0;

                    const notes: string[] = [];
                    if (expense.category) {
                      notes.push(expense.category.replace(/[_-]/g, " "));
                    }
                    if (expense.activity?.name) {
                      notes.push(`Linked to ${expense.activity.name}`);
                    }

                    const notesText = notes.join(" • ") || "—";

                    return (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={expense.paidBy.profileImageUrl || undefined}
                                alt={getUserDisplayName(expense.paidBy)}
                              />
                              <AvatarFallback>
                                {getUserInitials(expense.paidBy)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">
                                {getUserDisplayName(expense.paidBy)}
                                {expense.paidBy.id === user?.id ? " (you)" : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatExpenseDate(expense.createdAt)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {expense.description || "Untitled expense"}
                        </TableCell>
                        <TableCell>{formatExpenseDate(expense.createdAt)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.totalAmount, expense.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {detailView === "youOwe" || detailView === "youAreOwed"
                            ? myShareAmount > 0
                              ? formatCurrency(myShareAmount, expense.currency)
                              : "—"
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate" title={notesText}>
                          {notesText}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="link"
                            size="sm"
                            className="px-0"
                            onClick={() => handleViewExpense(expense.id)}
                          >
                            View expense
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
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
