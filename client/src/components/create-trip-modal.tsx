import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTripCalendarSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import SmartLocationSearch from "@/components/SmartLocationSearch";

interface CreateTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = insertTripCalendarSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type FormData = z.infer<typeof formSchema>;

export function CreateTripModal({ open, onOpenChange }: CreateTripModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedDestination, setSelectedDestination] = useState<any>(null);

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
      const response = await apiRequest('/api/trips', {
        method: 'POST',
        body: JSON.stringify(data),
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
      
      // Small delay to ensure cache is updated before navigation
      setTimeout(() => {
        setLocation(`/trip/${trip.id}`);
      }, 100);
    },
    onError: (error: any) => {
      console.error("Trip creation error:", error);
      let errorMessage = "Failed to create trip. Please try again.";
      
      if (error.message === "Unauthorized" || error.message.includes("401")) {
        errorMessage = "Your session has expired. Redirecting to login...";
        // The redirect will happen automatically from the queryClient
        return;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Submitting trip data:", data);
    createTripMutation.mutate(data);
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
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Start planning your group vacation by creating a new trip calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

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
              allowedTypes={['city']}
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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-red-600 text-white"
              disabled={createTripMutation.isPending}
            >
              {createTripMutation.isPending ? "Creating..." : "Create Trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
