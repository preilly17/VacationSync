import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import {
  generateCashAppUrl,
  generateVenmoUrl,
  generatePaymentNote,
} from "@/lib/paymentUtils";
import { CurrencyConverter } from "@/components/currency-converter";
import { useToast } from "@/hooks/use-toast";
import { insertExpenseSchema, type TripWithDetails } from "@shared/schema";
import { useEffect, useState } from "react";
import { DollarSign, Smartphone } from "lucide-react";

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
}

const formSchema = insertExpenseSchema
  .omit({
    tripId: true,
  })
  .extend({
    amount: z
      .string()
      .min(1, "Amount is required")
      .refine(
        (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
        "Amount must be a positive number",
      ),
    selectedMembers: z
      .array(z.string())
      .min(1, "Select at least one member to split with"),
  });

type FormData = z.infer<typeof formSchema>;

const expenseCategories = [
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transportation" },
  { value: "accommodation", label: "Accommodation" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
];

export function AddExpenseModal({
  open,
  onOpenChange,
  tripId,
}: AddExpenseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requestCurrency, setRequestCurrency] = useState<string>("USD"); // Currency to request payment in
  const [conversionData, setConversionData] = useState<{
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    originalAmount: number;
    convertedAmount: number;
    lastUpdated: Date;
  } | null>(null);

  // Get trip data to access members
  const { data: trip } = useQuery<TripWithDetails>({
    queryKey: [`/api/trips/${tripId}`],
  });

  // Get current user
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      category: "other",
      currency: "USD",
      splitType: "equal",
      activityId: undefined,
      splitData: null,
      receiptUrl: undefined,
      selectedMembers: [],
    },
  });

  const amountValue = form.watch("amount") || "";
  const currencyValue = form.watch("currency") || "USD";
  const selectedMemberIds = form.watch("selectedMembers") ?? [];
  const conversionMatches =
    conversionData !== null &&
    conversionData.fromCurrency === currencyValue &&
    conversionData.toCurrency === requestCurrency;

  useEffect(() => {
    if (requestCurrency === currencyValue && conversionData) {
      setConversionData(null);
    }
  }, [conversionData, currencyValue, requestCurrency]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const totalAmount = parseFloat(data.amount);
      const splitAmount = totalAmount / data.selectedMembers.length;

      const expenseData = {
        ...data,
        amount: totalAmount,
        tripId,
        splitData: {
          members: data.selectedMembers,
          splitAmount: splitAmount,
          splitType: "equal",
        },
      };

      await apiRequest(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        body: JSON.stringify(expenseData),
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
        title: "Success",
        description: "Expense added successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add expense",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createExpenseMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex w-full max-w-[820px] min-h-0 flex-col !gap-0 overflow-hidden !p-0 sm:w-[92vw] md:w-[820px] max-h-[calc(100vh-2rem)] sm:max-h-[92vh]">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex h-full min-h-0 flex-1 flex-col"
          >
            <header className="flex shrink-0 items-center border-b border-border px-6 py-5 pr-12">
              <DialogTitle className="text-lg font-semibold">
                Add New Expense
              </DialogTitle>
            </header>

            <div className="flex-1 min-h-0 space-y-6 overflow-y-auto px-6 py-5 pb-28 overscroll-contain sm:pb-10">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="What did you spend on?" {...field} />
                    </FormControl>
                    <div className="min-h-[18px]">
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel>Amount &amp; Currency</FormLabel>
                <CurrencyConverter
                  amount={amountValue}
                  onAmountChange={(amount) => form.setValue("amount", amount)}
                  currency={currencyValue}
                  onCurrencyChange={(currency) =>
                    form.setValue("currency", currency)
                  }
                  tripId={tripId}
                  showConversion={requestCurrency !== currencyValue}
                  onConversionChange={(conversion) =>
                    setConversionData(conversion)
                  }
                  targetCurrency={requestCurrency}
                />

                <div className="rounded-lg border bg-blue-50 p-4 shadow-sm shadow-blue-100/20">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-blue-900">
                      Request payment in:
                    </label>
                    <Select
                      value={requestCurrency}
                      onValueChange={setRequestCurrency}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">💵 USD</SelectItem>
                        <SelectItem value="EUR">💶 EUR</SelectItem>
                        <SelectItem value="GBP">💷 GBP</SelectItem>
                        <SelectItem value="JPY">💴 JPY</SelectItem>
                        <SelectItem value="CAD">🍁 CAD</SelectItem>
                        <SelectItem value="AUD">🇦🇺 AUD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="min-h-[18px] text-xs text-blue-700">
                    {requestCurrency === currencyValue
                      ? "Using original expense currency - no conversion needed"
                      : `Payment requests will use ${requestCurrency} (converted from ${currencyValue})`}
                  </p>
                </div>

                <div className="flex min-h-[44px] flex-col justify-center rounded-lg border border-green-200 bg-green-50 p-3">
                  {requestCurrency !== currencyValue ? (
                    conversionMatches ? (
                      <div className="flex flex-col gap-2 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {currencyValue} {amountValue || "0"} = {requestCurrency}{" "}
                          {conversionData?.convertedAmount.toFixed(2)}
                        </span>
                        <span className="text-xs text-green-600">
                          Rate: 1 {conversionData?.fromCurrency} ={" "}
                          {conversionData?.rate.toFixed(4)}{" "}
                          {conversionData?.toCurrency}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-green-700">
                        Fetching the latest conversion rate...
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-green-700">
                      Select a different request currency to preview conversion
                      details here.
                    </span>
                  )}
                </div>

                <p
                  className={`min-h-[18px] text-xs ${
                    form.formState.errors.amount
                      ? "font-medium text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {form.formState.errors.amount?.message ?? " "}
                </p>
              </div>

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseCategories.map((category) => (
                          <SelectItem
                            key={category.value}
                            value={category.value}
                          >
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="min-h-[18px]">
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selectedMembers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Split with Members</FormLabel>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Select members to split this expense with
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        {trip?.members?.map((member) => {
                          const isSelected = field.value.includes(
                            member.user.id,
                          );
                          return (
                            <div
                              key={member.user.id}
                              className="flex flex-col gap-3 rounded-lg border p-3 transition hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex flex-1 items-start gap-3 sm:items-center">
                                <Checkbox
                                  id={member.user.id}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const newSelection = checked
                                      ? [...field.value, member.user.id]
                                      : field.value.filter(
                                          (id) => id !== member.user.id,
                                        );
                                    field.onChange(newSelection);
                                  }}
                                  className="mt-1 sm:mt-0"
                                />
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={
                                      member.user.profileImageUrl || undefined
                                    }
                                  />
                                  <AvatarFallback>
                                    {member.user.firstName?.[0] ||
                                      member.user.email?.[0] ||
                                      "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {member.user.firstName}{" "}
                                    {member.user.lastName}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {(member.user.cashAppUsername ||
                                      member.user.phoneNumber) && (
                                      <Badge
                                        variant="secondary"
                                        className="whitespace-nowrap text-xs"
                                      >
                                        <Smartphone className="mr-1 h-3 w-3" />
                                        CashApp
                                      </Badge>
                                    )}
                                    {(member.user.venmoUsername ||
                                      member.user.phoneNumber) && (
                                      <Badge
                                        variant="secondary"
                                        className="whitespace-nowrap text-xs"
                                      >
                                        <Smartphone className="mr-1 h-3 w-3" />
                                        Venmo
                                      </Badge>
                                    )}
                                    {member.user.phoneNumber && (
                                      <Badge
                                        variant="secondary"
                                        className="whitespace-nowrap bg-green-100 text-xs text-green-700"
                                      >
                                        Phone
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isSelected && field.value.length > 0 && (
                                <div className="flex shrink-0 flex-col items-start gap-1 text-left sm:items-end sm:text-right">
                                  <p className="text-sm font-medium">
                                    {(() => {
                                      const expenseCurrency = currencyValue;
                                      const originalAmount = parseFloat(
                                        amountValue || "0",
                                      );

                                      if (
                                        requestCurrency !== expenseCurrency &&
                                        conversionMatches &&
                                        conversionData
                                      ) {
                                        return `${requestCurrency} ${(conversionData.convertedAmount / field.value.length).toFixed(2)}`;
                                      }

                                      return `${expenseCurrency} ${(originalAmount / field.value.length).toFixed(2)}`;
                                    })()}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    per person
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                    <div className="min-h-[18px]">
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                )}
              />

              {selectedMemberIds.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="h-4 w-4" />
                      Payment App Quick Links
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {selectedMemberIds.map((memberId) => {
                      const member = trip?.members?.find(
                        (m) => m.user.id === memberId,
                      )?.user;
                      if (!member) return null;

                      const expenseCurrency = currencyValue;
                      const originalAmount = parseFloat(amountValue || "0");
                      const matchedConversion = conversionMatches
                        ? conversionData
                        : null;
                      const conversionActive =
                        requestCurrency !== expenseCurrency && matchedConversion
                          ? matchedConversion
                          : null;

                      const splitAmount = conversionActive
                        ? (
                            conversionActive.convertedAmount /
                            selectedMemberIds.length
                          ).toFixed(2)
                        : (
                            originalAmount /
                            selectedMemberIds.length
                          ).toFixed(2);

                      const displayCurrency = conversionActive
                        ? requestCurrency
                        : expenseCurrency;

                      return (
                        <div
                          key={memberId}
                          className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={member.profileImageUrl || undefined}
                              />
                              <AvatarFallback className="text-xs">
                                {member.firstName?.[0] ||
                                  member.email?.[0] ||
                                  "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {member.firstName} {member.lastName}
                            </span>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                            <span className="whitespace-nowrap text-sm font-medium">
                              {displayCurrency} {splitAmount}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const cashAppUrl = generateCashAppUrl(
                                  member,
                                  splitAmount,
                                );
                                const expenseName =
                                  form.getValues().description;
                                const venmoUrl = generateVenmoUrl(
                                  member,
                                  splitAmount,
                                  generatePaymentNote(
                                    expenseName || "Trip expense",
                                    trip?.name || undefined,
                                  ),
                                );

                                return (
                                  <>
                                    {cashAppUrl && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          window.open(cashAppUrl, "_blank");
                                          toast({
                                            title: "Opening CashApp",
                                            description: member.phoneNumber
                                              ? "Redirecting to CashApp with phone number for direct payment"
                                              : "Redirecting to CashApp with username",
                                          });
                                        }}
                                        className="whitespace-nowrap px-2 py-1 text-xs"
                                      >
                                        CashApp
                                      </Button>
                                    )}
                                    {venmoUrl && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          window.open(venmoUrl, "_blank");
                                          toast({
                                            title: "Opening Venmo",
                                            description: member.phoneNumber
                                              ? "Redirecting to Venmo with phone number for direct payment"
                                              : "Redirecting to Venmo with username",
                                          });
                                        }}
                                        className="whitespace-nowrap px-2 py-1 text-xs"
                                      >
                                        Venmo
                                      </Button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="splitType"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormLabel>Split Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="How to split the expense" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="equal">Split Equally</SelectItem>
                        <SelectItem value="percentage">
                          By Percentage
                        </SelectItem>
                        <SelectItem value="exact">Exact Amounts</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receiptUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Link to receipt or photo"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <div className="min-h-[18px]">
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <footer className="sticky bottom-0 z-10 flex min-h-[72px] shrink-0 flex-col gap-3 border-t border-border bg-gradient-to-t from-background via-background/95 to-background px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={createExpenseMutation.isPending}
              >
                {createExpenseMutation.isPending
                  ? "Adding..."
                  : "Create expense"}
              </Button>
            </footer>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
