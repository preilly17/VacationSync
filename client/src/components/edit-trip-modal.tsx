import { useEffect, useRef, useState } from "react";
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
import { UploadCloud, X } from "lucide-react";

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
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    trip.coverImageUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: trip.name,
      destination: trip.destination,
      startDate: format(new Date(trip.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(trip.endDate), "yyyy-MM-dd"),
      coverImageUrl: trip.coverImageUrl ?? null,
    },
  });

  useEffect(() => {
    form.register("coverImageUrl");
  }, [form]);

  const setCoverImageValue = (value: string | null, markDirty = false) => {
    setCoverImagePreview(value);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    form.setValue("coverImageUrl", value, { shouldDirty: markDirty });
  };

  // Reset form when trip changes or modal opens
  useEffect(() => {
    if (open && trip) {
      form.reset({
        name: trip.name,
        destination: trip.destination,
        startDate: format(new Date(trip.startDate), "yyyy-MM-dd"),
        endDate: format(new Date(trip.endDate), "yyyy-MM-dd"),
        coverImageUrl: trip.coverImageUrl ?? null,
      });
      // Set destination for SmartLocationSearch
      setSelectedDestination({
        name: trip.destination,
        displayName: trip.destination
      });
      setCoverImageValue(trip.coverImageUrl ?? null);
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
      destination:
        selectedDestination?.displayName ||
        selectedDestination?.name ||
        data.destination,
    };
    updateTripMutation.mutate(submitData);
  };

  const handleDestinationSelect = (location: any) => {
    setSelectedDestination(location);
    form.setValue(
      "destination",
      location.displayName || location.name,
      { shouldDirty: true },
    );
  };

  const handleCoverImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Please choose an image file for the cover photo.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;
    if (file.size > maxFileSize) {
      toast({
        title: "Image too large",
        description: "Please choose an image that is 5MB or smaller.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) {
        setCoverImageValue(result, true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCoverImage = () => {
    setCoverImageValue(null, true);
  };

  const handleCancel = () => {
    // Reset form to original values
    form.reset({
      name: trip.name,
      destination: trip.destination,
      startDate: format(new Date(trip.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(trip.endDate), "yyyy-MM-dd"),
      coverImageUrl: trip.coverImageUrl ?? null,
    });
    // Reset selected destination to original
    setSelectedDestination({
      name: trip.destination,
      displayName: trip.destination
    });
    setCoverImageValue(trip.coverImageUrl ?? null);
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

          <div>
            <Label htmlFor="coverImage">Cover Photo</Label>
            <div className="mt-2 space-y-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4">
              {coverImagePreview ? (
                <div className="overflow-hidden rounded-lg border border-neutral-200">
                  <img
                    src={coverImagePreview}
                    alt="Trip cover preview"
                    className="h-44 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-neutral-500">
                  <UploadCloud className="h-8 w-8 text-primary" />
                  <p>Upload a banner image to update the trip background.</p>
                  <p className="text-xs text-neutral-400">JPG or PNG, up to 5MB.</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {coverImagePreview ? "Replace photo" : "Upload photo"}
                </Button>
                {coverImagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={handleRemoveCoverImage}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <input
                id="coverImage"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverImageChange}
              />
            </div>
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