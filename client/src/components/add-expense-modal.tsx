import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TripWithDetails } from "@shared/schema";
import {
  computeSplits,
  minorUnitsToAmount,
  toMinorUnits,
} from "@shared/expenses";
import { Loader2, Users } from "lucide-react";
import { HelperText } from "@/components/ui/helper-text";

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  currentUserId?: string;
}

const expenseCategories = [
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transportation" },
  { value: "accommodation", label: "Accommodation" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
];

const currencyOptions = [
  { value: "USD", label: "US Dollar" },
  { value: "EUR", label: "Euro" },
  { value: "GBP", label: "British Pound" },
  { value: "CAD", label: "Canadian Dollar" },
  { value: "AUD", label: "Australian Dollar" },
  { value: "JPY", label: "Japanese Yen" },
];

const formSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Description is required"),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    }, "Amount must be greater than 0"),
  paidCurrency: z.string().min(1, "Currency is required"),
  requestCurrency: z.string().min(1, "Request currency is required"),
  exchangeRate: z
    .string()
    .trim()
    .min(1, "Conversion rate is required")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    }, "Conversion rate must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  participants: z
    .array(z.string())
    .min(1, "Choose at least one person to split with."),
  receiptUrl: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z
      .string()
      .trim()
      .url("Enter a valid URL")
      .optional(),
  ),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  description: "",
  amount: "",
  paidCurrency: "USD",
  requestCurrency: "USD",
  exchangeRate: "1",
  category: "other",
  participants: [],
  receiptUrl: undefined,
};

type CreateExpensePayload = {
  sourceAmountMinorUnits: number;
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  exchangeRateLockedAt: string;
  exchangeRateProvider?: string;
  description: string;
  category: string;
  participantUserIds: string[];
  payerUserId: string;
  receiptUrl?: string;
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

function parseExpenseError(error: unknown): string {
  if (error instanceof Error) {
    const match = error.message.match(/^\d+:\s*(.*)$/);
    if (match) {
      const payload = match[1];
      try {
        const parsed = JSON.parse(payload);
        if (parsed && typeof parsed.message === "string") {
          return parsed.message;
        }
      } catch {
        if (payload) {
          return payload;
        }
      }
    }

    return error.message;
  }

  return "Something went wrong";
}

function getMemberDisplayName(member?: TripWithDetails["members"][number]["user"]) {
  if (!member) {
    return "Traveler";
  }

  return (
    member.firstName?.trim() ||
    member.username?.trim() ||
    member.email
  );
}

function getMemberInitials(member?: TripWithDetails["members"][number]["user"]) {
  if (!member) {
    return "TR";
  }

  const parts = [member.firstName, member.lastName]
    .filter(Boolean)
    .map((part) => part?.trim()[0] ?? "");

  if (parts.length === 0) {
    return (member.email ?? "T").slice(0, 2).toUpperCase();
  }

  return parts.join("").toUpperCase();
}

export function AddExpenseModal({
  open,
  onOpenChange,
  tripId,
  currentUserId,
}: AddExpenseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { data: trip, isLoading: isTripLoading } = useQuery<TripWithDetails>({
    queryKey: [`/api/trips/${tripId}`],
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const members = trip?.members ?? [];
    if (!currentUserId) {
      return;
    }

    const isPartOfTrip = members.some(
      (member) => member.user.id === currentUserId,
    );

    if (!isPartOfTrip) {
      return;
    }

    const currentParticipants = form.getValues("participants");
    const filteredParticipants = currentParticipants.filter(
      (participantId) => participantId !== currentUserId,
    );

    if (filteredParticipants.length !== currentParticipants.length) {
      form.setValue("participants", filteredParticipants, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [open, trip, currentUserId, form]);

  const closeModal = () => {
    onOpenChange(false);
    form.reset(defaultValues);
    setSubmitError(null);
  };

  const createExpenseMutation = useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
      await apiRequest(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/expenses`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/expenses/balances`],
      });
      toast({
        title: "Expense added",
        description: "Everyone in the split has been notified.",
      });
      setSubmitError(null);
      closeModal();
    },
    onError: (error: unknown) => {
      const message = parseExpenseError(error);
      setSubmitError(message);

      const statusMatch =
        error instanceof Error ? error.message.match(/^(\d+)/) : null;
      const statusCode = statusMatch ? Number(statusMatch[1]) : undefined;

      if (!statusCode || statusCode >= 500) {
        toast({
          title: "Something went wrong",
          description: message,
          variant: "destructive",
        });
      }
    },
  });

  const amountInput = form.watch("amount");
  const selectedParticipants = form.watch("participants");
  const paidCurrency = form.watch("paidCurrency") || "USD";
  const requestCurrency = form.watch("requestCurrency") || paidCurrency;
  const exchangeRateInput = form.watch("exchangeRate");

  const selectedDebtorIds = useMemo(
    () =>
      currentUserId
        ? selectedParticipants.filter((id) => id !== currentUserId)
        : selectedParticipants,
    [currentUserId, selectedParticipants],
  );

  const amountMinorUnits = useMemo(() => {
    const parsed = Number.parseFloat(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    try {
      return toMinorUnits(parsed, paidCurrency);
    } catch {
      return null;
    }
  }, [amountInput, paidCurrency]);

  const tripMembers = trip?.members ?? [];

  const memberLookup = useMemo(() => {
    const map = new Map<string, TripWithDetails["members"][number]["user"]>();
    for (const member of tripMembers) {
      map.set(member.user.id, member.user);
    }
    return map;
  }, [tripMembers]);

  const getName = useCallback(
    (id: string) => getMemberDisplayName(memberLookup.get(id)),
    [memberLookup],
  );

  const computeSplitPreview = useCallback(
    (
      totalSourceMinorUnits: number,
      debtorIds: string[],
      sourceCurrency: string,
      targetCurrency: string,
      conversionRate: number,
    ) => {
      if (totalSourceMinorUnits <= 0 || debtorIds.length === 0) {
        return {
          perDebtor: new Map<
            string,
            { sourceMinorUnits: number; targetMinorUnits: number }
          >(),
          summary: debtorIds.length
            ? "We couldn't calculate the split. Double-check the details."
            : "Select at least one person to split with.",
          error: undefined,
          result: undefined,
        };
      }

      try {
        const computation = computeSplits({
          totalSourceMinorUnits,
          debtorIds,
          sourceCurrency,
          targetCurrency,
          conversionRate,
        });

        const perDebtor = new Map<
          string,
          { sourceMinorUnits: number; targetMinorUnits: number }
        >();
        const labels: string[] = [];

        for (const share of computation.shares) {
          perDebtor.set(share.userId, {
            sourceMinorUnits: share.sourceMinorUnits,
            targetMinorUnits: share.targetMinorUnits,
          });
          const formattedAmount = formatCurrency(
            minorUnitsToAmount(share.targetMinorUnits, targetCurrency),
            targetCurrency,
          );
          labels.push(`${getName(share.userId)} ${formattedAmount}`);
        }

        const summary = labels.length
          ? `Requests: ${labels.join(" • ")}`
          : "Select at least one person to split with.";

        return { perDebtor, summary, result: computation, error: undefined };
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "We couldn't calculate the split. Double-check the details.";
        return {
          perDebtor: new Map<string, { sourceMinorUnits: number; targetMinorUnits: number }>(),
          summary: message,
          error: message,
          result: undefined,
        };
      }
    },
    [getName],
  );

  const rateValue = Number.parseFloat(exchangeRateInput ?? "");
  const hasValidRate = Number.isFinite(rateValue) && rateValue > 0;

  const requestPreview = useMemo(() => {
    if (
      amountMinorUnits === null ||
      selectedDebtorIds.length === 0 ||
      !hasValidRate
    ) {
      return {
        perDebtor: new Map<string, { sourceMinorUnits: number; targetMinorUnits: number }>(),
        summary: "",
        error: undefined,
        result: undefined,
      };
    }

    return computeSplitPreview(
      amountMinorUnits,
      selectedDebtorIds,
      paidCurrency,
      requestCurrency,
      rateValue,
    );
  }, [
    amountMinorUnits,
    selectedDebtorIds,
    hasValidRate,
    computeSplitPreview,
    paidCurrency,
    requestCurrency,
    rateValue,
  ]);

  const helperSummary = useMemo(() => {
    if (selectedDebtorIds.length === 0) {
      return "Select at least one person to split with.";
    }

    if (amountMinorUnits === null) {
      return "Enter an amount to see the split.";
    }

    if (!hasValidRate) {
      return "Enter a conversion rate to see the split.";
    }

    if (requestPreview.error) {
      return requestPreview.error;
    }

    return (
      requestPreview.summary || "We couldn't calculate the split. Double-check the details."
    );
  }, [
    selectedDebtorIds,
    amountMinorUnits,
    hasValidRate,
    requestPreview.summary,
    requestPreview.error,
  ]);

  const debtors = useMemo(
    () =>
      tripMembers.filter((member) => member.user.id !== currentUserId),
    [tripMembers, currentUserId],
  );

  const canSubmit =
    amountMinorUnits !== null &&
    selectedDebtorIds.length > 0 &&
    hasValidRate &&
    Boolean(paidCurrency) &&
    Boolean(requestCurrency);

  useEffect(() => {
    if (submitError) {
      setSubmitError(null);
    }
  }, [
    amountMinorUnits,
    selectedDebtorIds,
    hasValidRate,
    paidCurrency,
    requestCurrency,
  ]);

  useEffect(() => {
    if (paidCurrency === requestCurrency && exchangeRateInput !== "1") {
      form.setValue("exchangeRate", "1", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [paidCurrency, requestCurrency, exchangeRateInput, form]);

  const onSubmit = useCallback(async () => {
    setSubmitError(null);

    if (!currentUserId) {
      setSubmitError("We couldn't identify the payer for this expense.");
      return;
    }

    if (!trip) {
      setSubmitError("Trip details are still loading. Please try again.");
      return;
    }

    const amountValue = form.getValues("amount");
    if (!amountValue) {
      setSubmitError("Enter a valid amount.");
      return;
    }

    const parsedAmount = Number(amountValue);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSubmitError("Enter a valid amount.");
      return;
    }

    const rawParticipants = form
      .getValues("participants")
      .filter((id) => id !== currentUserId);

    if (rawParticipants.length === 0) {
      setSubmitError("Choose at least one person to split with.");
      return;
    }

    if (amountMinorUnits === null) {
      setSubmitError("Enter a valid amount.");
      return;
    }

    if (!hasValidRate) {
      setSubmitError("Enter a conversion rate to see the split.");
      return;
    }

    const preview = computeSplitPreview(
      amountMinorUnits,
      rawParticipants,
      paidCurrency,
      requestCurrency,
      rateValue,
    );

    if (preview.error) {
      setSubmitError(preview.error);
      return;
    }

    const hasMissingShare = rawParticipants.some(
      (id) => preview.perDebtor.get(id) === undefined,
    );
    if (hasMissingShare) {
      setSubmitError("We couldn't calculate the split. Double-check the details.");
      return;
    }

    const payload: CreateExpensePayload = {
      payerUserId: currentUserId,
      sourceAmountMinorUnits: amountMinorUnits,
      sourceCurrency: paidCurrency,
      targetCurrency: requestCurrency,
      exchangeRate: rateValue,
      exchangeRateLockedAt: new Date().toISOString(),
      exchangeRateProvider:
        paidCurrency === requestCurrency ? "same-currency" : "manual",
      description: form.getValues("description").trim(),
      category: form.getValues("category"),
      participantUserIds: rawParticipants,
      ...(form.getValues("receiptUrl")
        ? { receiptUrl: form.getValues("receiptUrl")!.trim() }
        : {}),
    };

    try {
      await createExpenseMutation.mutateAsync(payload);
    } catch {
      // handled in onError
    }
  }, [
    amountMinorUnits,
    computeSplitPreview,
    createExpenseMutation,
    currentUserId,
    form,
    hasValidRate,
    paidCurrency,
    requestCurrency,
    rateValue,
    trip,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeModal();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex h-full flex-col"
          >
            <DialogHeader className="space-y-2 border-b px-6 py-5 text-left">
              <DialogTitle>Log a shared expense</DialogTitle>
              <DialogDescription>
                Capture what was spent and who is splitting the cost. We&rsquo;ll do
                the math for you.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[65vh] flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dinner at the beach restaurant"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount paid</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paidCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid in</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label} ({option.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requestCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request in</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label} ({option.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        Conversion rate ({paidCurrency} → {requestCurrency})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          placeholder="0.0000"
                          disabled={paidCurrency === requestCurrency}
                          {...field}
                        />
                      </FormControl>
                      <HelperText>
                        {`1 ${paidCurrency} = ${
                          hasValidRate
                            ? formatCurrency(rateValue, requestCurrency)
                            : "—"
                        } (${requestCurrency})`}
                      </HelperText>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="participants"
                render={({ field }) => {
                  const selected = new Set(field.value);
                  const hasMembers = debtors.length > 0;

                  return (
                    <FormItem>
                      <FormLabel>Split with</FormLabel>
                      <div className="rounded-lg border">
                        <div className="max-h-60 overflow-y-auto">
                          {isTripLoading ? (
                            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading travelers...
                            </div>
                          ) : hasMembers ? (
                            debtors.map((member) => {
                              const memberId = member.user.id;
                              const isChecked = selected.has(memberId);

                              return (
                                <div
                                  key={memberId}
                                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                                >
                                  <Checkbox
                                    id={`participant-${memberId}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        if (!selected.has(memberId)) {
                                          field.onChange([...field.value, memberId]);
                                        }
                                      } else {
                                        field.onChange(
                                          field.value.filter((id) => id !== memberId),
                                        );
                                      }
                                    }}
                                  />
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage
                                      src={member.user.profileImageUrl || undefined}
                                      alt={getMemberDisplayName(member.user)}
                                    />
                                    <AvatarFallback>
                                      {getMemberInitials(member.user)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      {getMemberDisplayName(member.user)}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {member.user.email}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
                              <Users className="h-5 w-5" />
                              Invite travelers to your trip so you can split expenses together.
                            </div>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                      <HelperText>{helperSummary}</HelperText>
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="receiptUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              {submitError ? (
                <p className="text-sm font-medium text-destructive sm:mr-auto">
                  {submitError}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="sm:w-auto"
                  disabled={createExpenseMutation.isPending || !canSubmit}
                >
                  {createExpenseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save & send requests"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
