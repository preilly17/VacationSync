import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { RestaurantManualAddPrefill } from "@/types/restaurants";
import { addRestaurant } from "@/lib/restaurants";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const manualSchema = z.object({
  name: z.string().trim().min(1, "Restaurant name is required"),
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  country: z.string().trim().min(1, "Country is required"),
  reservationDate: z.string().trim().refine((value) => ISO_DATE_REGEX.test(value), "Date must be YYYY-MM-DD"),
  reservationTime: z.string().trim().refine((value) => TIME_REGEX.test(value), "Time must be HH:mm"),
  partySize: z.coerce.number({ invalid_type_error: "Party size must be a number" }).int().min(1, "Party size must be at least 1"),
});

export type RestaurantManualAddFormValues = z.infer<typeof manualSchema>;

export interface RestaurantManualAddModalProps {
  tripId?: number | string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: RestaurantManualAddPrefill | null;
  onSuccess?: () => void;
}

export function RestaurantManualAddModal({ tripId, open, onOpenChange, prefill, onSuccess }: RestaurantManualAddModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const normalizedTripId = useMemo(() => {
    if (typeof tripId === "string") {
      const parsed = Number.parseInt(tripId, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
      return undefined;
    }

    if (typeof tripId === "number" && Number.isFinite(tripId) && tripId > 0) {
      return tripId;
    }

    return undefined;
  }, [tripId]);

  const defaultValues = useMemo<RestaurantManualAddFormValues>(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const fallbackTime = "19:00";
    return {
      name: prefill?.name ?? "",
      address: prefill?.address ?? "",
      city: prefill?.city ?? "",
      country: prefill?.country ?? "",
      reservationDate: prefill?.date ?? today,
      reservationTime: prefill?.time ?? fallbackTime,
      partySize: Math.max(1, prefill?.partySize ?? 2),
    };
  }, [prefill]);

  const form = useForm<RestaurantManualAddFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const mutation = useMutation({
    mutationFn: async (values: RestaurantManualAddFormValues) => {
      if (normalizedTripId == null) {
        throw new Error("Trip details are still loading. Please try again in a moment.");
      }

      const sanitizedUrl = prefill?.url?.trim() ? prefill.url.trim() : null;

      const payload = {
        name: values.name.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
        country: values.country.trim(),
        reservationDate: values.reservationDate.trim(),
        reservationTime: values.reservationTime.trim(),
        partySize: Number(values.partySize),
        priceRange: "$$",
        reservationStatus: "pending",
        website: prefill?.platform === "resy" ? sanitizedUrl : null,
        openTableUrl: prefill?.platform === "open_table" ? sanitizedUrl : null,
        notes:
          prefill?.platform
            ? `Saved from ${prefill.platform === "resy" ? "Resy" : "OpenTable"} link builder`
            : null,
      };

      await addRestaurant(normalizedTripId, payload);
    },
    onSuccess: async () => {
      if (normalizedTripId != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/trips", normalizedTripId, "restaurants"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips", String(normalizedTripId), "restaurants"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips", normalizedTripId, "restaurant-proposals"] });
      }

      toast({
        title: "Restaurant saved",
        description: "We've added this reservation to your trip.",
      });
      onSuccess?.();
      form.reset(defaultValues);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session expired",
          description: "Please log in again to save this restaurant.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }

      const description = error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Could not save restaurant",
        description,
        variant: "destructive",
      });
    },
  });

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        form.reset(defaultValues);
      }
      onOpenChange(nextOpen);
    },
    [defaultValues, form, onOpenChange],
  );

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save restaurant details</DialogTitle>
          <DialogDescription>
            Capture the essentials so your group can reference this reservation later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Restaurant name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Restaurant" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Street, city, country" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reservationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reservationTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="partySize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Party size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || mutation.isPending || normalizedTripId == null}
              >
                {mutation.isPending ? "Saving..." : "Save restaurant"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
