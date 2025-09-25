import { useEffect, useMemo } from "react";
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
import { computeSplits } from "@shared/expenses";
import { Loader2, Users } from "lucide-react";

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
  currency: z.string().min(1, "Currency is required"),
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
  currency: "USD",
  category: "other",
  participants: [],
  receiptUrl: undefined,
};

type CreateExpensePayload = {
  amountCents: number;
  currency: string;
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
  };

  const createExpenseMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!currentUserId) {
        throw new Error("We couldn't identify the payer for this expense.");
      }

      if (!trip) {
        throw new Error("Trip details are still loading. Please try again.");
      }

      const parsedAmount = Number.parseFloat(values.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const amountCents = Math.round(parsedAmount * 100);
      const selectedSet = new Set(values.participants);
      const participantUserIds = trip.members
        .map((member) => member.user.id)
        .filter(
          (memberId) =>
            memberId !== currentUserId && selectedSet.has(memberId),
        );

      if (participantUserIds.length === 0) {
        throw new Error("Choose at least one person to split with.");
      }

      // Validate the split locally to keep UI and backend logic in sync.
      computeSplits(amountCents, participantUserIds);

      const payload: CreateExpensePayload = {
        amountCents,
        currency: values.currency,
        description: values.description.trim(),
        category: values.category,
        participantUserIds,
        payerUserId: currentUserId,
        ...(values.receiptUrl
          ? { receiptUrl: values.receiptUrl.trim() }
          : {}),
      };

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
      closeModal();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create expense";
      toast({
        title: "Something went wrong",
        description: message,
        variant: "destructive",
      });
    },
  });

  const amountInput = form.watch("amount");
  const selectedParticipants = form.watch("participants");
  const participantsExcludingPayer = useMemo(
    () =>
      currentUserId
        ? selectedParticipants.filter((id) => id !== currentUserId)
        : selectedParticipants,
    [currentUserId, selectedParticipants],
  );
  const currency = form.watch("currency") || "USD";

  const totalAmount = useMemo(() => {
    const parsed = Number.parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const orderedParticipants = useMemo(() => {
    if (!trip) {
      return participantsExcludingPayer;
    }

    const selectedSet = new Set(participantsExcludingPayer);
    return trip.members
      .map((member) => member.user.id)
      .filter((memberId) => memberId !== currentUserId && selectedSet.has(memberId));
  }, [trip, currentUserId, participantsExcludingPayer]);

  const amountCents = useMemo(() => {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return null;
    }

    return Math.round(totalAmount * 100);
  }, [totalAmount]);

  const splitPreview = useMemo(() => {
    if (!trip || amountCents === null) {
      return null;
    }

    if (orderedParticipants.length === 0) {
      return null;
    }

    try {
      const splits = computeSplits(amountCents, orderedParticipants);
      const summaries = splits.map((split) => {
        const member = trip.members.find((item) => item.user.id === split.userId);
        return {
          userId: split.userId,
          amountCents: split.amountCents,
          label: getMemberDisplayName(member?.user),
          formattedAmount: formatCurrency(split.amountCents / 100, currency),
        };
      });

      return { splits, summaries };
    } catch {
      return null;
    }
  }, [trip, orderedParticipants, amountCents, currency]);

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
            onSubmit={form.handleSubmit((values) => createExpenseMutation.mutate(values))}
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
                      <FormLabel>Amount</FormLabel>
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
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
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
                  const payerMember = trip?.members?.find(
                    (member) => member.user.id === currentUserId,
                  );
                  const otherMembers = (trip?.members ?? []).filter(
                    (member) => member.user.id !== currentUserId,
                  );
                  const hasMembers = (payerMember ? 1 : 0) + otherMembers.length > 0;

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
                            <>
                              {payerMember ? (
                                <div className="flex items-center gap-3 border-b px-4 py-3">
                                  <Checkbox
                                    id={`participant-${payerMember.user.id}`}
                                    checked={false}
                                    disabled
                                  />
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage
                                      src={
                                        payerMember.user.profileImageUrl || undefined
                                      }
                                      alt={getMemberDisplayName(payerMember.user)}
                                    />
                                    <AvatarFallback>
                                      {getMemberInitials(payerMember.user)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      You (payer)
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {payerMember.user.email}
                                    </p>
                                  </div>
                                </div>
                              ) : null}

                              {otherMembers.length > 0 ? (
                                otherMembers.map((member) => {
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
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
                              <Users className="h-5 w-5" />
                              Invite travelers to your trip so you can split expenses together.
                            </div>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                      <div className="rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        {participantsExcludingPayer.length === 0
                          ? "Choose at least one person to split with."
                          : amountCents === null
                          ? "Enter an amount to see the split."
                          : splitPreview
                          ? `Requests: ${splitPreview.summaries
                              .map(
                                (summary) => `${summary.label} ${summary.formattedAmount}`,
                              )
                              .join(" • ")}`
                          : "We couldn't calculate the split. Double-check the details."}
                      </div>
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

            <div className="flex flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
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
                disabled={
                  createExpenseMutation.isPending ||
                  participantsExcludingPayer.length === 0 ||
                  amountCents === null
                }
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
