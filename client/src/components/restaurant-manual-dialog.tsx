import { useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
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

  const cachedTrip = useMemo<TripWithDetails | undefined>(() => {
    if (!normalizedTripId) {
      return undefined;
    }

    const candidateKeys: Array<readonly unknown[]> = [
      [`/api/trips/${normalizedTripId}`],
      [`/api/trips/${String(normalizedTripId)}`],
      ["/api/trips", normalizedTripId],
      ["/api/trips", String(normalizedTripId)],
    ];

    for (const key of candidateKeys) {
      const data = queryClient.getQueryData<TripWithDetails>(key as any);
      if (data) {
        return data;
      }
    }

    return undefined;
  }, [normalizedTripId, queryClient]);

  const getCityAndCountry = (address: string) => {
    const parts = address
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    let city: string | null = null;
    let country: string | null = null;

    if (parts.length >= 2) {
      country = parts[parts.length - 1] || null;
      city = parts[parts.length - 2] || null;
    } else if (parts.length === 1) {
      city = parts[0] || null;
    }

    if (!city) {
      city = cachedTrip?.cityName || null;
    }

    if (!country) {
      country =
        cachedTrip?.countryName ||
        (() => {
          const destination = cachedTrip?.destination ?? "";
          const destinationParts = destination
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0);

          if (destinationParts.length === 0) {
            return null;
          }

          return destinationParts[destinationParts.length - 1] || null;
        })();
    }

    return {
      city: city ?? "Unknown City",
      country: country ?? "Unknown Country",
    };
  };

  const form = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultFormValues);
    }
  }, [open, form]);

  const createRestaurantMutation = useMutation({
    mutationFn: async (data: RestaurantFormData) => {
      if (!normalizedTripId) {
        throw new Error("No trip context available");
      }
      const { city, country } = getCityAndCountry(data.address);
      const reservationDate = format(data.reservationDate, "yyyy-MM-dd");

      const payload = {
        tripId: Number(normalizedTripId),
        name: data.name,
        address: data.address,
        city,
        country,
        reservationDate,
        reservationTime: data.reservationTime,
        partySize: data.partySize,
        cuisineType: data.cuisine || null,
        zipCode: null,
        latitude: null,
        longitude: null,
        phoneNumber: data.phone?.trim() ? data.phone.trim() : null,
        website: data.website ?? null,
        openTableUrl: data.openTableUrl ?? null,
        priceRange: data.priceRange,
        rating: data.rating,
        confirmationNumber: null,
        reservationStatus: "planned",
        specialRequests: data.specialRequests?.trim() ? data.specialRequests.trim() : null,
        notes: null,
      };

      return apiRequest(`/api/trips/${normalizedTripId}/restaurants`, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: () => {
      toast({
        title: "Restaurant Added",
        description: "Restaurant reservation has been added to your trip.",
      });
      if (normalizedTripId) {
        queryClient.invalidateQueries({ queryKey: ["/api/trips", normalizedTripId, "restaurants"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips", String(normalizedTripId), "restaurants"] });
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

      toast({
        title: "Error",
        description: "Failed to add restaurant. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    createRestaurantMutation.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Restaurant Reservation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Reservation Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => field.onChange(date ?? new Date())}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
