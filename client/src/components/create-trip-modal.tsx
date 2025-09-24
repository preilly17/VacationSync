import { useState, useRef, type ChangeEvent } from "react";
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

const MAX_COVER_PHOTO_SIZE_MB = 5;
const MAX_COVER_PHOTO_SIZE_BYTES = MAX_COVER_PHOTO_SIZE_MB * 1024 * 1024;

export function CreateTripModal({ open, onOpenChange }: CreateTripModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      destination: "",
      startDate: "",
      endDate: "",
      coverPhotoUrl: null,
    },
  });

  const coverPhotoPreview = form.watch("coverPhotoUrl");

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

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

  const handleDestinationSelect = (location: any) => {
    setSelectedDestination(location);
    form.setValue("destination", location.displayName || location.name);
  };

  const handleCoverPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Please choose an image file for your cover photo.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > MAX_COVER_PHOTO_SIZE_BYTES) {
      toast({
        title: "Image too large",
        description:
          "Please choose an image smaller than " +
          MAX_COVER_PHOTO_SIZE_MB +
          "MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        form.setValue("coverPhotoUrl", reader.result, { shouldDirty: true });
      }
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "We couldn't read that file. Please try again with a different image.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveCoverPhoto = () => {
    form.setValue("coverPhotoUrl", null, { shouldDirty: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    form.reset();
    setSelectedDestination(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

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
              placeholder="e.g., Tokyo, Japan"
              value={selectedDestination?.name || ""}
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

          <div className="space-y-3">
            <div>
              <Label htmlFor="coverPhoto">Cover Photo</Label>
              <p className="text-sm text-neutral-500">
                Upload a banner image to personalize your trip card.
              </p>
            </div>
            {coverPhotoPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                <img
                  src={coverPhotoPreview}
                  alt="Trip cover preview"
                  className="h-40 w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
                No photo selected yet
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="coverPhoto"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverPhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                {coverPhotoPreview ? "Change photo" : "Upload cover photo"}
              </Button>
              {coverPhotoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleRemoveCoverPhoto}
                >
                  Remove photo
                </Button>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              JPG or PNG up to {MAX_COVER_PHOTO_SIZE_MB}MB.
            </p>
            {form.formState.errors.coverPhotoUrl && (
              <p className="text-sm text-red-600">
                {form.formState.errors.coverPhotoUrl.message}
              </p>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
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
