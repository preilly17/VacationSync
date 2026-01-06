import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
import { normalizeTimeTo24Hour } from "@/lib/time";
import { parseTripDateToLocal } from "@/lib/date";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { buildRestaurantProposalRequestBody } from "@/lib/restaurant-proposals";
import type { TripWithDetails } from "@shared/schema";

const optionalUrlField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .url({ message: "Invalid url" })
    .optional(),
);

const restaurantFormSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  cuisine: z.string().min(1, "Cuisine type is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
  priceRange: z.string().min(1, "Price range is required"),
  rating: z.number().min(1).max(5),
  reservationDate: z.date(),
  reservationTime: z.string().min(1, "Reservation time is required"),
  partySize: z.number().min(1, "Party size must be at least 1"),
  specialRequests: z.string().optional(),
  website: optionalUrlField,
  openTableUrl: optionalUrlField,
});

export type RestaurantFormData = z.infer<typeof restaurantFormSchema>;

const defaultFormValues: RestaurantFormData = {
  name: "",
  cuisine: "",
  address: "",
  city: "",
  country: "",
  phone: "",
  priceRange: "$$",
  rating: 4.5,
  reservationDate: new Date(),
  reservationTime: "7:00 PM",
  partySize: 2,
  specialRequests: "",
  website: "",
  openTableUrl: "",
};

export interface RestaurantManualDialogProps {
  tripId?: number | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RestaurantManualDialog({ tripId, open, onOpenChange, onSuccess }: RestaurantManualDialogProps) {
  const normalizedTripId = useMemo(() => {
    if (typeof tripId === "string") {
      const parsed = parseInt(tripId, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return tripId;
  }, [tripId]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(normalizedTripId ?? null);
  const [tripSelectionError, setTripSelectionError] = useState<string | null>(null);

  const { data: tripsData = [], isLoading: tripsLoading } = useQuery<TripWithDetails[]>({
    queryKey: ["/api/trips"],
    enabled: !normalizedTripId,
  });

  const availableTrips = tripsData ?? [];

  const effectiveTripId = normalizedTripId ?? selectedTripId ?? undefined;

  const tripContext = useMemo<TripWithDetails | undefined>(() => {
    if (!effectiveTripId) {
      return undefined;
    }

    const candidateKeys: Array<readonly unknown[]> = [
      [`/api/trips/${effectiveTripId}`],
      [`/api/trips/${String(effectiveTripId)}`],
      ["/api/trips", effectiveTripId],
      ["/api/trips", String(effectiveTripId)],
    ];

    for (const key of candidateKeys) {
      const data = queryClient.getQueryData<TripWithDetails>(key as any);
      if (data) {
        return data;
      }
    }

    if (!normalizedTripId) {
      return availableTrips.find((trip) => trip.id === effectiveTripId);
    }

    return undefined;
  }, [availableTrips, effectiveTripId, normalizedTripId, queryClient]);

  const ensureValidReservationDate = (value: unknown): Date | undefined => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    return undefined;
  };

  const normalizeDay = (value?: Date | null): Date | null => {
    if (!value) {
      return null;
    }

    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const tripStartDate = useMemo(() => parseTripDateToLocal(tripContext?.startDate), [tripContext]);
  const tripEndDate = useMemo(() => parseTripDateToLocal(tripContext?.endDate), [tripContext]);
  const normalizedTripStart = useMemo(() => normalizeDay(tripStartDate), [tripStartDate]);
  const normalizedTripEnd = useMemo(() => normalizeDay(tripEndDate), [tripEndDate]);

  const getCityAndCountry = useCallback(
    (address: string) => {
      const parts = address
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      const fallbackDestination = (tripContext?.destination ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const fallbackCity = tripContext?.cityName || fallbackDestination[0] || "";
      const fallbackCountry =
        tripContext?.countryName ||
        (fallbackDestination.length > 1 ? fallbackDestination[fallbackDestination.length - 1] : "");

      let city: string | null = null;
      let country: string | null = null;

      if (parts.length >= 2) {
        country = parts[parts.length - 1] || null;
        city = parts[parts.length - 2] || null;
      } else if (parts.length === 1) {
        city = parts[0] || null;
      }

      return {
        city: (city ?? fallbackCity ?? "").trim(),
        country: (country ?? fallbackCountry ?? "").trim(),
      };
    },
    [tripContext?.cityName, tripContext?.countryName, tripContext?.destination],
  );

  const form = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: defaultFormValues,
  });

  const addressValue = form.watch("address");

  useEffect(() => {
    if (!open) {
      return;
    }

    const { city, country } = getCityAndCountry(addressValue ?? "");

    if (!form.getValues("city") && city) {
      form.setValue("city", city, { shouldDirty: false });
    }

    if (!form.getValues("country") && country) {
      form.setValue("country", country, { shouldDirty: false });
    }
  }, [addressValue, form, getCityAndCountry, open]);

  useEffect(() => {
    if (!open) {
      form.reset(defaultFormValues);
      setTripSelectionError(null);
      setSelectedTripId(normalizedTripId ?? null);
    }
  }, [open, form, normalizedTripId]);

  useEffect(() => {
    if (normalizedTripId) {
      setSelectedTripId(normalizedTripId);
      setTripSelectionError(null);
      return;
    }

    if (open && !selectedTripId && availableTrips.length > 0) {
      setSelectedTripId(availableTrips[0].id);
    }
  }, [availableTrips, normalizedTripId, open, selectedTripId]);

  useEffect(() => {
    if (selectedTripId) {
      setTripSelectionError(null);
    }
  }, [selectedTripId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (tripStartDate) {
      form.setValue("reservationDate", tripStartDate, { shouldDirty: false });
      return;
    }

    const currentDate = ensureValidReservationDate(form.getValues("reservationDate"));
    if (!currentDate) {
      form.setValue("reservationDate", undefined as unknown as Date, { shouldDirty: false });
    }
  }, [form, open, tripStartDate]);

  const createRestaurantMutation = useMutation({
    mutationFn: async ({ data, tripId: targetTripId }: { data: RestaurantFormData; tripId: number }) => {
      const normalizedName = data.name.trim();
      const normalizedCuisine = data.cuisine.trim();
      const normalizedAddress = data.address.trim();
      const normalizedCity = data.city.trim();
      const normalizedCountry = data.country.trim();
      const normalizedPartySize = Number.isFinite(data.partySize)
        ? Math.max(1, Math.round(data.partySize))
        : 1;
      const normalizedRating = Number.isFinite(data.rating) ? data.rating : null;
      const normalizedPriceRange = data.priceRange?.trim() || "$$";
      const fallbackLocation = getCityAndCountry(normalizedAddress);
      const city = normalizedCity || fallbackLocation.city || "Unknown City";
      const country = normalizedCountry || fallbackLocation.country || "Unknown Country";
      const reservationDateValue = ensureValidReservationDate(data.reservationDate) ?? tripStartDate ?? new Date();
      const reservationDate = formatISO(reservationDateValue, { representation: "date" });
      const reservationTime = normalizeTimeTo24Hour(data.reservationTime) || "19:00";
      const payload = {
        name: normalizedName,
        address: normalizedAddress,
        city,
        country,
        reservationDate,
        reservationTime,
        partySize: normalizedPartySize,
        cuisineType: normalizedCuisine || null,
        zipCode: null,
        latitude: null,
        longitude: null,
        phoneNumber: data.phone?.trim() ? data.phone.trim() : null,
        website: data.website ?? null,
        openTableUrl: data.openTableUrl ?? null,
        priceRange: normalizedPriceRange,
        rating: normalizedRating,
        confirmationNumber: null,
        specialRequests: data.specialRequests?.trim() ? data.specialRequests.trim() : null,
        notes: null,
      };

      const endpoint = `/api/trips/${targetTripId}/restaurant-proposals`;
      const requestBody = buildRestaurantProposalRequestBody(
        {
          name: normalizedName,
          address: normalizedAddress,
          cuisineType: normalizedCuisine,
          priceRange: normalizedPriceRange,
          rating: normalizedRating,
          phoneNumber: data.phone,
          website: data.website,
          openTableUrl: data.openTableUrl,
          reservationUrl: data.openTableUrl ?? data.website ?? null,
        },
        {
          preferredDates: [reservationDate],
          preferredMealTime: "dinner",
        },
      );

      console.log("Mutation request", endpoint, requestBody);

      return apiRequest(endpoint, {
        method: "POST",
        body: requestBody,
      });
    },
    onSuccess: (_, variables) => {
      const targetTripId = variables?.tripId;
      toast({
        title: "Restaurant Proposed",
        description: "Restaurant proposal has been shared with your group.",
      });
      if (targetTripId != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/trips", targetTripId, "restaurant-proposals"] });
      }
      form.reset(defaultFormValues);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }

      const errorMessage =
        error instanceof ApiError && typeof error.message === "string"
          ? error.message
          : "Failed to add restaurant. Please try again.";

      console.error("Failed to add restaurant", error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    if (!effectiveTripId) {
      setTripSelectionError("Select a trip before saving this reservation.");
      return;
    }

    createRestaurantMutation.mutate({ data: values, tripId: effectiveTripId });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Restaurant Reservation</DialogTitle>
          <DialogDescription>
            Capture reservation details to share with your trip members.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!normalizedTripId && (
              <div className="space-y-2">
                <Label htmlFor="manual-restaurant-trip">Trip</Label>
                <Select
                  value={selectedTripId ? String(selectedTripId) : ""}
                  onValueChange={(value) => {
                    const parsed = Number.parseInt(value, 10);
                    setSelectedTripId(Number.isNaN(parsed) ? null : parsed);
                  }}
                  disabled={tripsLoading || availableTrips.length === 0}
                >
                  <SelectTrigger id="manual-restaurant-trip">
                    <SelectValue
                      placeholder={
                        tripsLoading
                          ? "Loading trips..."
                          : availableTrips.length === 0
                            ? "No trips available"
                            : "Select a trip"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTrips.map((trip) => (
                      <SelectItem key={trip.id} value={String(trip.id)}>
                        {trip.name || trip.destination}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tripSelectionError ? (
                  <p className="text-sm text-destructive">{tripSelectionError}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    We’ll save this reservation to the selected trip.
                  </p>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Restaurant Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Restaurant name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cuisine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuisine</FormLabel>
                    <FormControl>
                      <Input placeholder="Cuisine type" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priceRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Range</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select price range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="$">$</SelectItem>
                        <SelectItem value="$$">$$</SelectItem>
                        <SelectItem value="$$$">$$$</SelectItem>
                        <SelectItem value="$$$$">$$$$</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Average price per person</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address, city, country" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
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
                      <Input placeholder="Country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        placeholder="4.5"
                        value={field.value}
                        onChange={(event) => field.onChange(parseFloat(event.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Average rating between 1 and 5</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reservationDate"
                render={({ field }) => {
                  const reservationDateValue = ensureValidReservationDate(field.value);

                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Reservation Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal",
                                !reservationDateValue && "text-muted-foreground",
                              )}
                            >
                              {reservationDateValue ? format(reservationDateValue, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={reservationDateValue}
                            onSelect={(date) => {
                              if (!date || Number.isNaN(date.getTime())) {
                                field.onChange(undefined);
                                return;
                              }

                              field.onChange(date);
                            }}
                            fromDate={normalizedTripStart ?? undefined}
                            toDate={normalizedTripEnd ?? undefined}
                            disabled={(date) => {
                              const normalizedDate = normalizeDay(date);

                              if (normalizedDate && normalizedTripStart && normalizedDate < normalizedTripStart) {
                                return true;
                              }

                              if (normalizedDate && normalizedTripEnd && normalizedDate > normalizedTripEnd) {
                                return true;
                              }

                              return normalizedDate ? normalizedDate < new Date("1900-01-01") : false;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="reservationTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                        <SelectItem value="5:30 PM">5:30 PM</SelectItem>
                        <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                        <SelectItem value="6:30 PM">6:30 PM</SelectItem>
                        <SelectItem value="7:00 PM">7:00 PM</SelectItem>
                        <SelectItem value="7:30 PM">7:30 PM</SelectItem>
                        <SelectItem value="8:00 PM">8:00 PM</SelectItem>
                        <SelectItem value="8:30 PM">8:30 PM</SelectItem>
                        <SelectItem value="9:00 PM">9:00 PM</SelectItem>
                        <SelectItem value="9:30 PM">9:30 PM</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Party Size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      placeholder="Number of people"
                      value={field.value}
                      onChange={(event) => field.onChange(parseInt(event.target.value, 10))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialRequests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requests (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any dietary restrictions, seating preferences, or special occasions..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://restaurant-website.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="openTableUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenTable URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://opentable.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRestaurantMutation.isPending}>
                {createRestaurantMutation.isPending ? "Adding..." : "Add Restaurant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
