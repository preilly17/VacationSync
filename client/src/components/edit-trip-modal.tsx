import { useState, useEffect } from "react";
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
import SmartLocationSearch from "@/components/SmartLocationSearch";
import type { TripWithDetails } from "@shared/schema";
import { format } from "date-fns";
import { parseDateValue } from "@/lib/utils";

interface EditTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripWithDetails;
}

const formSchema = insertTripCalendarSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
}).partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

type FormData = z.infer<typeof formSchema>;

export function EditTripModal({ open, onOpenChange, trip }: EditTripModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const parsedTripStartDate = parseDateValue(trip.startDate) ?? new Date(trip.startDate);
  const parsedTripEndDate = parseDateValue(trip.endDate) ?? new Date(trip.endDate);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: trip.name,
      destination: trip.destination,
      startDate: format(parsedTripStartDate, "yyyy-MM-dd"),
      endDate: format(parsedTripEndDate, "yyyy-MM-dd"),
    },
  });

  // Reset form when trip changes or modal opens
  useEffect(() => {
    if (open && trip) {
      form.reset({
        name: trip.name,
        destination: trip.destination,
        startDate: format(parsedTripStartDate, "yyyy-MM-dd"),
        endDate: format(parsedTripEndDate, "yyyy-MM-dd"),
      });
      // Set destination for SmartLocationSearch
      setSelectedDestination({ 
        name: trip.destination, 
        displayName: trip.destination 
      });
    }
  }, [open, trip, form]);

  const updateTripMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest(`/api/trips/${trip.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: async (updatedTrip) => {
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}`] });
      
      // Update the specific trip cache immediately
      queryClient.setQueryData([`/api/trips/${trip.id}`], (oldData: any) => {
        if (oldData) {
          return { ...oldData, ...updatedTrip };
        }
        return updatedTrip;
      });
      
      toast({
        title: "Trip updated!",
        description: "Your trip details have been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Trip update error:", error);
      let errorMessage = "Failed to update trip. Please try again.";
      
      if (error.message === "Unauthorized" || error.message.includes("401")) {
        errorMessage = "Your session has expired. Redirecting to login...";
        return;
      }
      
      if (error.message.includes("Only the trip creator")) {
        errorMessage = "Only the trip creator can edit trip details.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Use selected destination if available, otherwise use form data
    const submitData = {
      ...data,
      destination: selectedDestination?.displayName || selectedDestination?.name || data.destination
    };
    console.log("Submitting trip update data:", submitData);
    updateTripMutation.mutate(submitData);
  };

  const handleDestinationSelect = (location: any) => {
    setSelectedDestination(location);
    // Don't update form state immediately - only on submit
  };

  const handleCancel = () => {
    // Reset form to original values
    form.reset({
      name: trip.name,
      destination: trip.destination,
      startDate: format(parsedTripStartDate, "yyyy-MM-dd"),
      endDate: format(parsedTripEndDate, "yyyy-MM-dd"),
    });
    // Reset selected destination to original
    setSelectedDestination({ 
      name: trip.destination, 
      displayName: trip.destination 
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit Trip Details</DialogTitle>
          <DialogDescription>
            Update your trip information. You can change the name, destination, and dates.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Trip Name</Label>
            <Input
              id="name"
              placeholder="e.g., Japan Adventure 2025"
              {...form.register("name")}
              data-testid="input-trip-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="destination">Destination</Label>
            <SmartLocationSearch
              placeholder="e.g., Tokyo, Japan"
              value={selectedDestination?.name || form.getValues("destination") || ""}
              onLocationSelect={handleDestinationSelect}
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
                data-testid="input-start-date"
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
                data-testid="input-end-date"
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
              onClick={handleCancel}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-red-600 text-white"
              disabled={updateTripMutation.isPending}
              data-testid="button-save-trip"
            >
              {updateTripMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}