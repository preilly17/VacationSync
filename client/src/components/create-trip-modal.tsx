import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTripCalendarSchema } from "@shared/schema";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { AlertCircle, Loader2 } from "lucide-react";

interface CreateTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = insertTripCalendarSchema
  .extend({
    name: z.string().trim().min(1, "Trip name is required"),
    destination: z.string().trim().min(1, "Destination is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .superRefine((data, ctx) => {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (Number.isNaN(startDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date must be a valid date",
        path: ["startDate"],
      });
    }

    if (Number.isNaN(endDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be a valid date",
        path: ["endDate"],
      });
    }

    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be before the start date",
        path: ["endDate"],
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

export function CreateTripModal({ open, onOpenChange }: CreateTripModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const getCreateTripErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.status === 403) {
        return "You don't have permission to create a trip.";
      }

      if (error.status === 400 || error.status === 422) {
        const backendMessage =
          error.data && typeof error.data === "object" && "message" in error.data && typeof error.data.message === "string"
            ? error.data.message.trim()
            : "";

        if (backendMessage && !/database|sql|constraint|column|insert/i.test(backendMessage)) {
          return backendMessage;
        }

        return "Please double-check the form fields and try again.";
      }

      if (error.status >= 500) {
        return "Something went wrong on our side. Please try again in a moment.";
      }

      const fallbackMessage =
        error.data && typeof error.data === "object" && "message" in error.data && typeof error.data.message === "string"
          ? error.data.message.trim()
          : "";

      if (fallbackMessage && !/database|sql|constraint|column|insert/i.test(fallbackMessage)) {
        return fallbackMessage;
      }
    }

    if (error instanceof Error && error.message.trim().length > 0 && !/database|sql|constraint|column|insert/i.test(error.message)) {
      return error.message;
    }

    return "Failed to create trip. Please try again.";
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      destination: "",
      startDate: "",
      endDate: "",
      geonameId: null,
      cityName: null,
      countryName: null,
      latitude: null,
      longitude: null,
      population: null,
    },
  });

  const createTripMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("/api/trips", {
        method: "POST",
        body: {
          ...data,
          name: data.name.trim(),
          destination: data.destination.trim(),
        },
      });
      return response.json();
    },
    onSuccess: async (trip) => {
      // Invalidate and refetch trips query to show new trip on home page
      await queryClient.invalidateQueries({ queryKey: ["/api/trips"] });

      // Pre-populate the cache with the new trip data for immediate display
      queryClient.setQueryData(["/api/trips"], (oldData: any) => {
        if (!oldData) return [trip];
        return [...oldData, trip];
      });

      toast({
        title: "Trip created!",
        description: "Your new trip has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
      setSelectedDestination(null);
      setFormError(null);

      // Small delay to ensure cache is updated before navigation
      setTimeout(() => {
        setLocation(`/trip/${trip.id}`);
      }, 100);
    },
    onError: (error: unknown) => {
      console.error("Trip creation error:", error);
      if (error instanceof ApiError && error.status === 401) {
        const sessionExpiredMessage = "Your session has expired. Redirecting to login...";
        toast({
          title: "Session expired",
          description: sessionExpiredMessage,
          variant: "destructive",
        });
        return;
      }

      const errorMessage = getCreateTripErrorMessage(error);

      setFormError(errorMessage);

      toast({
        title: "Unable to create trip",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (createTripMutation.isPending) {
      return;
    }

    setFormError(null);

    createTripMutation.mutate({
      ...data,
      name: data.name.trim(),
      destination: data.destination.trim(),
    });
  };

  const destinationValue = form.watch("destination");

  useEffect(() => {
    form.register("destination");
    return () => {
      form.unregister("destination");
    };
  }, [form]);

  const resetLocationMetadata = useCallback(() => {
    form.setValue("geonameId", null);
    form.setValue("cityName", null);
    form.setValue("countryName", null);
    form.setValue("latitude", null);
    form.setValue("longitude", null);
    form.setValue("population", null);
  }, [form]);

  const handleDestinationSelect = useCallback(
    (location: any) => {
      setSelectedDestination(location);

      const destinationText = location?.displayName || location?.label || location?.name || "";
      form.setValue("destination", destinationText, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.clearErrors("destination");

      const geonameIdValue =
        location?.geonameId !== undefined && location?.geonameId !== null
          ? Number(location.geonameId)
          : null;
      form.setValue("geonameId", Number.isFinite(geonameIdValue ?? NaN) ? geonameIdValue : null);
      form.setValue("cityName", location?.cityName ?? location?.name ?? null);
      form.setValue(
        "countryName",
        location?.countryName ?? location?.country ?? null,
      );
      const latitudeValue =
        typeof location?.latitude === "number"
          ? location.latitude
          : location?.latitude
            ? Number(location.latitude)
            : null;
      const longitudeValue =
        typeof location?.longitude === "number"
          ? location.longitude
          : location?.longitude
            ? Number(location.longitude)
            : null;
      form.setValue("latitude", Number.isFinite(latitudeValue ?? NaN) ? latitudeValue : null);
      form.setValue("longitude", Number.isFinite(longitudeValue ?? NaN) ? longitudeValue : null);
      const populationValue =
        typeof location?.population === "number"
          ? location.population
          : location?.population
            ? Number(location.population)
            : null;
      form.setValue("population", Number.isFinite(populationValue ?? NaN) ? populationValue : null);
    },
    [form],
  );

  const handleDestinationQueryChange = useCallback(
    (value: string) => {
      form.setValue("destination", value, {
        shouldDirty: true,
        shouldValidate: false,
      });

      const trimmed = value.trim();
      const selectedLabel =
        selectedDestination?.displayName ||
        selectedDestination?.label ||
        selectedDestination?.name ||
        "";
      const normalizedSelectedLabel = selectedLabel.trim().toLowerCase();
      const normalizedTrimmed = trimmed.toLowerCase();

      if (!trimmed) {
        setSelectedDestination(null);
        resetLocationMetadata();
        return;
      }

      form.clearErrors("destination");

      if (
        selectedDestination &&
        normalizedTrimmed.length > 0 &&
        normalizedTrimmed !== normalizedSelectedLabel
      ) {
        setSelectedDestination(null);
        resetLocationMetadata();
      }
    },
    [form, resetLocationMetadata, selectedDestination],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[85vh] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Start planning your group vacation by creating a new trip calendar.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <Alert variant="destructive" role="alert" className="text-left">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>We couldn't save your trip</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={createTripMutation.isPending}>
          <div>
            <Label htmlFor="name">Trip Name</Label>
            <Input
              id="name"
              placeholder="e.g., Japan Adventure 2025"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="destination">Destination</Label>
            <SmartLocationSearch
              id="destination"
              placeholder="e.g., Tokyo, Japan"
              value={destinationValue ?? ""}
              allowedTypes={["city"]}
              onLocationSelect={handleDestinationSelect}
              onQueryChange={handleDestinationQueryChange}
            />
            {form.formState.errors.destination && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.destination.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register("startDate")}
              />
              {form.formState.errors.startDate && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                {...form.register("endDate")}
              />
              {form.formState.errors.endDate && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                form.reset();
                setSelectedDestination(null);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-red-600 text-white"
              disabled={createTripMutation.isPending}
              aria-live="polite"
            >
              {createTripMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating...
                </span>
              ) : (
                "Create Trip"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
