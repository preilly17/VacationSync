import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { computeCurrencyAwareSplits, convertMinor } from "@shared/expenses";
import { getCurrencyMeta, formatMinorUnits } from "@shared/currency";
import { applyFeeToRate } from "@shared/fx";
import type { SharedExpenseRecord } from "@shared/types/sharedExpense";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";

const currencyOptions = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
];

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  srcCurrency: z.string().min(1),
  tgtCurrency: z.string().min(1),
  fxMode: z.enum(["auto", "custom"]),
  fxRate: z.string().min(1),
  fxFeeBps: z.string().optional(),
  participantIds: z.array(z.string()).min(1, "Select at least one traveler"),
});

const defaultValues = {
  description: "",
  category: "Food",
  amount: "",
  srcCurrency: "USD",
  tgtCurrency: "USD",
  fxMode: "auto" as const,
  fxRate: "1.000000",
  fxFeeBps: "0",
  participantIds: [] as string[],
};

interface GroupMember {
  id: string;
  name: string;
  email: string;
}

interface FxQuote {
  rate: string;
  provider: string;
  timestamp: string;
}

function majorToMinor(amount: number, exponent: number): number {
  const factor = 10 ** exponent;
  return Math.round(amount * factor);
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPreview(
  amountMinor: number,
  srcCurrency: string,
  tgtCurrency: string,
  fxRate: string,
  timestamp: string,
): string {
  const srcFormatted = formatMinorUnits(amountMinor, srcCurrency);
  const srcMeta = getCurrencyMeta(srcCurrency);
  const tgtMeta = getCurrencyMeta(tgtCurrency);
  const totalTgtMinor = convertMinor(
    amountMinor,
    srcMeta.exponent,
    tgtMeta.exponent,
    fxRate,
  );
  const tgtFormatted = formatMinorUnits(totalTgtMinor, tgtCurrency);
  const rateDisplay = Number(fxRate).toFixed(4);
  const date = timestamp ? new Date(timestamp).toISOString().split("T")[0] : "";
  return `${srcFormatted} ${srcMeta.code} → ${tgtFormatted} ${tgtMeta.code} @ ${rateDisplay} (${date})`;
}

function buildRequestsSummary(
  split: ReturnType<typeof computeCurrencyAwareSplits> | null,
  tgtCurrency: string,
  membersById: Map<string, GroupMember>,
): string {
  if (!split) {
    return "Requests: --";
  }
  const parts = split.rows.map((row) => {
    const member = membersById.get(row.userId);
    const name = member ? member.name : row.userId;
    const amount = formatMinorUnits(row.shareTgtMinor, tgtCurrency);
    return `${name} ${amount}`;
  });
  return parts.length > 0 ? `Requests: ${parts.join(" • ")}` : "Requests: --";
}

export function SharedExpenseForm() {
  const { user } = useAuth();
  const payerId = user?.id ?? "alec";
  const currentUserId = user?.id ?? payerId;
  const payerName = user?.firstName ?? user?.username ?? "You";
  const payerEmail = user?.email ?? "you@example.com";
  const payerCurrency = "USD";

  const members: GroupMember[] = useMemo(
    () => [
      { id: payerId, name: `${payerName} (You)`, email: payerEmail },
      { id: "jake", name: "Jake", email: "jake@example.com" },
      { id: "patch", name: "Patch", email: "patch@example.com" },
      { id: "eric", name: "Eric", email: "eric@example.com" },
    ],
    [payerEmail, payerId, payerName],
  );

  const membersById = useMemo(() => {
    return new Map(members.map((member) => [member.id, member] as const));
  }, [members]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...defaultValues,
      tgtCurrency: payerCurrency,
    },
  });

  const fxMode = form.watch("fxMode");
  const srcCurrency = form.watch("srcCurrency");
  const tgtCurrency = form.watch("tgtCurrency");
  const amountInput = form.watch("amount");
  const fxFeeInput = form.watch("fxFeeBps") ?? "0";
  const participantIds = form.watch("participantIds");

  const [autoQuote, setAutoQuote] = useState<FxQuote | null>(null);
  const [autoQuoteLoading, setAutoQuoteLoading] = useState(false);
  const [autoQuoteError, setAutoQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchQuote() {
      if (fxMode !== "auto") {
        return;
      }
      if (!srcCurrency || !tgtCurrency) {
        return;
      }
      setAutoQuoteLoading(true);
      setAutoQuoteError(null);
      try {
        const response = await fetch(
          `/api/fx/quote?src=${encodeURIComponent(srcCurrency)}&tgt=${encodeURIComponent(tgtCurrency)}`,
        );
        if (!response.ok) {
          throw new Error(`Quote failed with status ${response.status}`);
        }
        const data = (await response.json()) as FxQuote;
        if (!cancelled) {
          setAutoQuote(data);
          form.setValue("fxRate", data.rate, { shouldDirty: true });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Unable to fetch FX rate";
          setAutoQuoteError(message);
        }
      } finally {
        if (!cancelled) {
          setAutoQuoteLoading(false);
        }
      }
    }
    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [fxMode, srcCurrency, tgtCurrency, form]);

  const amountNumber = parseNumber(amountInput);
  const srcMeta = getCurrencyMeta(srcCurrency);
  const tgtMeta = getCurrencyMeta(tgtCurrency);
  const amountMinor = amountNumber > 0 ? majorToMinor(amountNumber, srcMeta.exponent) : 0;

  const baseRate = fxMode === "auto" ? autoQuote?.rate ?? form.getValues("fxRate") : form.watch("fxRate");
  const feeBps = Number.parseInt(fxFeeInput || "0", 10) || 0;
  const effectiveRate = useMemo(() => {
    if (!baseRate) {
      return "0";
    }
    try {
      return applyFeeToRate(baseRate, Math.max(feeBps, 0));
    } catch {
      return baseRate;
    }
  }, [baseRate, feeBps]);

  const splitPreview = useMemo(() => {
    try {
      if (amountMinor <= 0) {
        return null;
      }
      if (participantIds.length === 0) {
        return null;
      }
      return computeCurrencyAwareSplits(
        amountMinor,
        participantIds,
        srcCurrency,
        tgtCurrency,
        effectiveRate,
      );
    } catch {
      return null;
    }
  }, [amountMinor, participantIds, srcCurrency, tgtCurrency, effectiveRate]);

  const previewLine = amountMinor
    ? buildPreview(
        amountMinor,
        srcCurrency,
        tgtCurrency,
        effectiveRate,
        autoQuote?.timestamp ?? new Date().toISOString(),
      )
    : "Enter an amount to preview conversions";

  const requestsSummary = buildRequestsSummary(
    splitPreview,
    tgtCurrency,
    membersById,
  );

  const createExpenseMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (amountMinor <= 0) {
        throw new Error("Amount must be greater than zero");
      }
      if (values.participantIds.length === 0) {
        throw new Error("Select at least one traveler");
      }
      if (!effectiveRate || Number(effectiveRate) <= 0) {
        throw new Error("FX rate is required");
      }
      const payload = {
        payerUserId: payerId,
        amountSrcMinor: amountMinor,
        srcCurrency: values.srcCurrency,
        tgtCurrency: values.tgtCurrency,
        fxRate: effectiveRate,
        fxRateProvider: autoQuote?.provider ?? "Custom",
        fxRateTimestamp: autoQuote?.timestamp ?? new Date().toISOString(),
        fxFeeBps: feeBps > 0 ? feeBps : undefined,
        description: values.description,
        category: values.category,
        participantUserIds: values.participantIds,
      };
      await apiRequest("/api/expenses", {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: () => {
      toast({
        title: "Expense saved",
        description: "Requests have been generated for the selected travelers.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      form.reset({
        ...defaultValues,
        tgtCurrency: payerCurrency,
        participantIds: [],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unable to save expense";
      toast({
        title: "Could not save expense",
        description: message,
        variant: "destructive",
      });
    },
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery<SharedExpenseRecord[]>({
    queryKey: ["/api/expenses"],
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ expenseId, userId }: { expenseId: string; userId: string }) => {
      await apiRequest(`/api/expenses/${expenseId}/participants/${userId}/mark-paid`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Marked paid",
        description: "Thanks for settling up!",
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to mark paid";
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const payerRow = members[0];
  const debtors = members.slice(1);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Log a shared expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form
              className="space-y-6"
              onSubmit={form.handleSubmit((values) => createExpenseMutation.mutate(values))}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Dinner at Tsukiji" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Food" {...field} />
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
                      <FormLabel>Amount (source currency)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="srcCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid in</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencyOptions.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
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
                  name="tgtCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request in</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencyOptions.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormLabel>FX rate</FormLabel>
                <FormField
                  control={form.control}
                  name="fxMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-2 sm:grid-cols-2"
                        >
                          <FormItem className="flex items-center gap-2 rounded-md border p-3">
                            <FormControl>
                              <RadioGroupItem value="auto" />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-medium">Auto</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Mid-market rate fetched for this date.
                              </p>
                            </div>
                          </FormItem>
                          <FormItem className="flex items-center gap-2 rounded-md border p-3">
                            <FormControl>
                              <RadioGroupItem value="custom" />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-medium">Custom</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Enter a rate from your card statement.
                              </p>
                            </div>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {fxMode === "custom" ? (
                  <FormField
                    control={form.control}
                    name="fxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom rate</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.000001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    {autoQuoteLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Fetching rate…
                      </span>
                    ) : autoQuoteError ? (
                      autoQuoteError
                    ) : autoQuote ? (
                      <span>
                        Locked {autoQuote.rate} from {autoQuote.provider} at {" "}
                        {new Date(autoQuote.timestamp).toLocaleString()}
                      </span>
                    ) : (
                      "Select currencies to fetch an FX quote."
                    )}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="fxFeeBps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee (bps)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormLabel>Split with</FormLabel>
                <div className="rounded-lg border">
                  <div className="divide-y">
                    <div className="flex items-center gap-3 p-3 text-sm text-muted-foreground">
                      <Checkbox checked disabled />
                      <div>
                        <p className="font-medium">{payerRow.name}</p>
                        <p className="text-xs">Your share is included automatically.</p>
                      </div>
                    </div>
                    {debtors.map((member) => {
                      const selected = participantIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                form.setValue("participantIds", [...participantIds, member.id], {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                              } else {
                                form.setValue(
                                  "participantIds",
                                  participantIds.filter((id) => id !== member.id),
                                  { shouldValidate: true, shouldDirty: true },
                                );
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <FormMessage>{form.formState.errors.participantIds?.message}</FormMessage>
              </div>

              <div className="space-y-2 rounded-md border border-dashed p-3 text-sm">
                <p className="font-medium">{previewLine}</p>
                <p className="text-muted-foreground">{requestsSummary}</p>
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={
                  createExpenseMutation.isPending ||
                  participantIds.length === 0 ||
                  amountMinor <= 0 ||
                  !effectiveRate
                }
              >
                {createExpenseMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save & send requests"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingExpenses ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading expenses…
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Logged expenses will appear here once you start splitting costs.
            </p>
          ) : (
            expenses.map((expense) => {
              const payer = membersById.get(expense.payerUserId);
              return (
                <div key={expense.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {payer ? payer.name.replace(" (You)", "") : expense.payerUserId} paid {" "}
                        {formatMinorUnits(expense.amountSrcMinor, expense.srcCurrency)} {" "}
                        ({expense.srcCurrency})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Locked {Number(expense.fxRate).toFixed(6)} from {expense.fxRateProvider}
                      </p>
                    </div>
                    <Badge variant={expense.status === "settled" ? "default" : "secondary"}>
                      {expense.status === "settled" ? "Settled" : "Pending"}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-2">
                    {expense.participants.map((participant) => {
                      const member = membersById.get(participant.userId);
                      const label = member ? member.name : participant.userId;
                      const isCurrentUser = participant.userId === currentUserId;
                      const owesLabel = isCurrentUser
                        ? "You owe"
                        : `${label.replace(" (You)", "")} owes`;
                      return (
                        <div
                          key={participant.userId}
                          className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {label}
                              {participant.userId === payerId ? " (You)" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {owesLabel} {formatMinorUnits(participant.shareTgtMinor, expense.tgtCurrency)}
                              {" "}to {payer ? payer.name.replace(" (You)", "") : expense.payerUserId}
                              — based on {formatMinorUnits(participant.shareSrcMinor, expense.srcCurrency)}
                              {" "}@ rate {Number(expense.fxRate).toFixed(4)}.
                            </p>
                          </div>
                          {participant.status === "paid" ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          ) : isCurrentUser ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                markPaidMutation.mutate({
                                  expenseId: expense.id,
                                  userId: participant.userId,
                                })
                              }
                              disabled={markPaidMutation.isPending}
                            >
                              <Wallet className="mr-1 h-4 w-4" /> Mark paid
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
