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
import { useLocation } from "wouter";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { UploadCloud, X } from "lucide-react";

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
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      destination: "",
      startDate: "",
      endDate: "",
      coverImageUrl: null,
    },
  });

  useEffect(() => {
    form.register("coverImageUrl");
  }, [form]);

  const resetCoverImage = (markDirty = false) => {
    setCoverImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    form.setValue("coverImageUrl", null, { shouldDirty: markDirty });
  };

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
      resetCoverImage();
      
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
    createTripMutation.mutate(data);
  };

  const handleDestinationSelect = (location: any) => {
    setSelectedDestination(location);
    form.setValue("destination", location.displayName || location.name);
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

    const maxFileSize = 5 * 1024 * 1024; // 5MB
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
        setCoverImagePreview(result);
        form.setValue("coverImageUrl", result, { shouldDirty: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCoverImage = () => {
    resetCoverImage(true);
  };

  const handleCancel = () => {
    form.reset();
    setSelectedDestination(null);
    resetCoverImage();
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
                  <p>Upload a banner image to personalize your trip page.</p>
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
