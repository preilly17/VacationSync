import { useState, useEffect, useCallback } from "react";
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
import { buildApiUrl } from "@/lib/api";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import type { TripWithDetails } from "@shared/schema";
import { CoverPhotoSection, type CoverPhotoValue } from "@/components/cover-photo-section";
import { createCoverPhotoBannerFile } from "@/lib/coverPhotoProcessing";
import { toDateInputValue } from "@/lib/date";

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
  const [pendingCoverPhotoFile, setPendingCoverPhotoFile] = useState<File | null>(null);
  const [pendingCoverPhotoMeta, setPendingCoverPhotoMeta] = useState<
    { size: number; type: string } | null
  >(null);
  const [saveState, setSaveState] = useState<"idle" | "uploading" | "saving">("idle");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: trip.name,
      destination: trip.destination,
      startDate: toDateInputValue(trip.startDate),
      endDate: toDateInputValue(trip.endDate),
      coverImageUrl: trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoUrl: trip.coverPhotoUrl ?? null,
      coverPhotoCardUrl: trip.coverPhotoCardUrl ?? null,
      coverPhotoThumbUrl: trip.coverPhotoThumbUrl ?? null,
      coverPhotoAlt: trip.coverPhotoAlt ?? null,
      coverPhotoAttribution: trip.coverPhotoAttribution ?? null,
      coverPhotoStorageKey: trip.coverPhotoStorageKey ?? null,
      coverPhotoOriginalUrl:
        trip.coverPhotoOriginalUrl ?? trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoFocalX:
        typeof trip.coverPhotoFocalX === "number" ? trip.coverPhotoFocalX : 0.5,
      coverPhotoFocalY:
        typeof trip.coverPhotoFocalY === "number" ? trip.coverPhotoFocalY : 0.5,
      coverPhotoUploadSize: null,
      coverPhotoUploadType: null,
    },
  });

  // Reset form when trip changes or modal opens
  useEffect(() => {
    if (open && trip) {
      form.reset({
        name: trip.name,
        destination: trip.destination,
        startDate: toDateInputValue(trip.startDate),
        endDate: toDateInputValue(trip.endDate),
        coverImageUrl: trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
        coverPhotoUrl: trip.coverPhotoUrl ?? null,
        coverPhotoCardUrl: trip.coverPhotoCardUrl ?? null,
        coverPhotoThumbUrl: trip.coverPhotoThumbUrl ?? null,
        coverPhotoAlt: trip.coverPhotoAlt ?? null,
        coverPhotoAttribution: trip.coverPhotoAttribution ?? null,
        coverPhotoStorageKey: trip.coverPhotoStorageKey ?? null,
        coverPhotoOriginalUrl:
          trip.coverPhotoOriginalUrl ?? trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
        coverPhotoFocalX:
          typeof trip.coverPhotoFocalX === "number" ? trip.coverPhotoFocalX : 0.5,
        coverPhotoFocalY:
          typeof trip.coverPhotoFocalY === "number" ? trip.coverPhotoFocalY : 0.5,
        coverPhotoUploadSize: null,
        coverPhotoUploadType: null,
      });
      // Set destination for SmartLocationSearch
      setSelectedDestination({
        name: trip.destination,
        displayName: trip.destination
      });
    }
  }, [open, trip, form]);

  useEffect(() => {
    if (!open) {
      setPendingCoverPhotoFile(null);
      setPendingCoverPhotoMeta(null);
      setSaveState("idle");
    }
  }, [open]);

  const updateTripMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest(`/api/trips/${trip.id}`, {
        method: "PUT",
        body: data,
      });
      return response;
    },
    onSuccess: async (updatedTrip) => {
      const version = Date.now();
      const withCacheBuster = (input?: string | null) => {
        if (!input) {
          return null;
        }
        const separator = input.includes("?") ? "&" : "?";
        return `${input}${separator}v=${version}`;
      };

      const updatedTripWithCache = {
        ...updatedTrip,
        coverImageUrl: withCacheBuster(
          updatedTrip.coverImageUrl ??
            updatedTrip.coverPhotoUrl ??
            updatedTrip.coverPhotoOriginalUrl ??
            null,
        ),
        coverPhotoUrl: withCacheBuster(
          updatedTrip.coverPhotoUrl ??
            updatedTrip.coverImageUrl ??
            updatedTrip.coverPhotoOriginalUrl ??
            null,
        ),
        coverPhotoCardUrl: withCacheBuster(updatedTrip.coverPhotoCardUrl ?? null),
        coverPhotoThumbUrl: withCacheBuster(updatedTrip.coverPhotoThumbUrl ?? null),
      };

      await queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}`] });

      queryClient.setQueryData([`/api/trips/${trip.id}`], (oldData: any) => {
        if (oldData) {
          return { ...oldData, ...updatedTripWithCache };
        }
        return updatedTripWithCache;
      });

      setPendingCoverPhotoFile(null);
      setPendingCoverPhotoMeta(null);
      setSaveState("idle");

      const originalCover =
        trip.coverImageUrl ??
        trip.coverPhotoUrl ??
        trip.coverPhotoOriginalUrl ??
        null;
      const updatedCover =
        updatedTrip.coverImageUrl ??
        updatedTrip.coverPhotoUrl ??
        updatedTrip.coverPhotoOriginalUrl ??
        null;
      const coverChanged = originalCover !== updatedCover;

      toast({
        title: coverChanged ? "Saved" : "Trip updated!",
        description: coverChanged
          ? "Cover photo updated."
          : "Your trip details have been updated successfully.",
      });
      onOpenChange(false);
    },
  });

  type UploadResponse = {
    storageKey: string;
    publicUrl: string;
    size: number;
    mimeType: string;
  };

  const uploadCoverPhoto = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await fetch(buildApiUrl("/api/uploads/cover-photo"), {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": file.name,
          "X-Content-Type": file.type,
        },
        body: file,
        credentials: "include",
      });

      const text = await response.text();
      if (!response.ok) {
        let message = text || "We couldn’t upload that image. Try JPG/PNG/WebP under the size limit.";
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message) {
            message = parsed.message;
          }
        } catch (parseError) {
          console.warn("Failed to parse upload error response", parseError);
        }
        throw new Error(message);
      }

      try {
        const payload = JSON.parse(text);
        return {
          storageKey: payload.storageKey,
          publicUrl: payload.publicUrl,
          size: payload.size,
          mimeType: payload.mimeType,
        };
      } catch (parseError) {
        console.error("Unexpected upload response", parseError, text);
        throw new Error("We couldn’t upload that image. Please try again.");
      }
    },
    [],
  );

  const deleteUploadedFile = useCallback(async (storageKey: string) => {
    if (!storageKey) {
      return;
    }
    try {
      await fetch(
        buildApiUrl(`/api/uploads/cover-photo/${encodeURIComponent(storageKey)}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
    } catch (cleanupError) {
      console.warn("Failed to clean up uploaded cover photo", cleanupError);
    }
  }, []);

  const extractServerMessage = (error: unknown): string => {
    if (error instanceof Error) {
      const message = error.message ?? "";
      const jsonMatch = message.match(/\{.*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.message) {
            return parsed.message;
          }
        } catch (parseError) {
          console.warn("Failed to parse server error", parseError);
        }
      }
      return message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "Unknown error";
  };

  const onSubmit = async (_data: FormData) => {
    const destinationValue =
      selectedDestination?.displayName ||
      selectedDestination?.name ||
      form.getValues("destination") ||
      trip.destination;

    let uploadResult: UploadResponse | null = null;

    try {
      const currentValues = form.getValues();
      const normalizeFocal = (value: unknown) => {
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string" && value !== "") {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const normalizedFocalX = normalizeFocal(currentValues.coverPhotoFocalX);
      const normalizedFocalY = normalizeFocal(currentValues.coverPhotoFocalY);

      if (pendingCoverPhotoFile) {
        setSaveState("uploading");

        let fileToUpload = pendingCoverPhotoFile;
        try {
          fileToUpload = await createCoverPhotoBannerFile(
            pendingCoverPhotoFile,
            typeof normalizedFocalX === "number" ? normalizedFocalX : 0.5,
            typeof normalizedFocalY === "number" ? normalizedFocalY : 0.5,
          );
        } catch (processingError) {
          console.error("Failed to prepare cover photo", processingError);
          setSaveState("idle");
          const message =
            processingError instanceof Error && processingError.message
              ? processingError.message
              : "We couldn’t process that image. Try another one.";
          toast({
            title: "Error",
            description: message,
            variant: "destructive",
          });
          return;
        }

        try {
          uploadResult = await uploadCoverPhoto(fileToUpload);
        } catch (uploadError) {
          setSaveState("idle");
          const message = extractServerMessage(uploadError);
          toast({
            title: "Error",
            description: message,
            variant: "destructive",
          });
          return;
        }
      }

      setSaveState("saving");

      const submitData: FormData = {
        ...currentValues,
        destination: destinationValue,
        coverPhotoFocalX: normalizedFocalX,
        coverPhotoFocalY: normalizedFocalY,
        coverPhotoUploadSize: pendingCoverPhotoMeta?.size ?? null,
        coverPhotoUploadType: pendingCoverPhotoMeta?.type ?? null,
      };

      if (uploadResult) {
        submitData.coverPhotoUrl = uploadResult.publicUrl;
        submitData.coverImageUrl = uploadResult.publicUrl;
        submitData.coverPhotoOriginalUrl = uploadResult.publicUrl;
        submitData.coverPhotoStorageKey = uploadResult.storageKey;
        submitData.coverPhotoCardUrl = null;
        submitData.coverPhotoThumbUrl = null;
        submitData.coverPhotoUploadSize = uploadResult.size;
        submitData.coverPhotoUploadType = uploadResult.mimeType;
      }

      await updateTripMutation.mutateAsync(submitData);
    } catch (error) {
      if (uploadResult) {
        await deleteUploadedFile(uploadResult.storageKey);
      }
      setSaveState("idle");

      if (
        error instanceof Error &&
        (error.message === "Unauthorized" || error.message.includes("401"))
      ) {
        toast({
          title: "Session expired",
          description: "Your session has expired. Please refresh and sign in again.",
          variant: "destructive",
        });
        return;
      }

      const reason = extractServerMessage(error);
      const description = reason.includes("Only the trip creator")
        ? reason
        : `We couldn’t save this photo to your trip. Reason: ${reason}`;

      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    }
  };

  const handleCoverPhotoChange = useCallback(
    (next: CoverPhotoValue) => {
      form.setValue("coverImageUrl", next.coverPhotoUrl ?? null, { shouldDirty: true });
      form.setValue("coverPhotoUrl", next.coverPhotoUrl ?? null, { shouldDirty: true });
      form.setValue("coverPhotoCardUrl", next.coverPhotoCardUrl ?? null, { shouldDirty: true });
      form.setValue("coverPhotoThumbUrl", next.coverPhotoThumbUrl ?? null, { shouldDirty: true });
      form.setValue("coverPhotoAlt", next.coverPhotoAlt ?? null, { shouldDirty: true });
      form.setValue("coverPhotoAttribution", next.coverPhotoAttribution ?? null, { shouldDirty: true });
      form.setValue("coverPhotoStorageKey", next.coverPhotoStorageKey ?? null, { shouldDirty: true });
      form.setValue("coverPhotoOriginalUrl", next.coverPhotoOriginalUrl ?? null, { shouldDirty: true });
      if (typeof next.coverPhotoFocalX === "number") {
        form.setValue("coverPhotoFocalX", next.coverPhotoFocalX, { shouldDirty: true });
      }
      if (typeof next.coverPhotoFocalY === "number") {
        form.setValue("coverPhotoFocalY", next.coverPhotoFocalY, { shouldDirty: true });
      }
    },
    [form],
  );

  const handlePendingFileChange = useCallback(
    (file: File | null, _previewUrl: string | null) => {
      setPendingCoverPhotoFile(file);
      if (file) {
        setPendingCoverPhotoMeta({ size: file.size, type: file.type });
        form.setValue("coverPhotoUploadSize", file.size, { shouldDirty: true });
        form.setValue("coverPhotoUploadType", file.type, { shouldDirty: true });
        form.setValue("coverPhotoStorageKey", null, { shouldDirty: true });
      } else {
        setPendingCoverPhotoMeta(null);
        form.setValue("coverPhotoUploadSize", null, { shouldDirty: true });
        form.setValue("coverPhotoUploadType", null, { shouldDirty: true });
        form.setValue("coverPhotoStorageKey", null, { shouldDirty: true });
      }
    },
    [form],
  );

  const toNumericOrNull = (value: unknown) => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const watchedCoverPhotoUrl = form.watch("coverPhotoUrl");
  const watchedCoverImageUrl = form.watch("coverImageUrl");
  const watchedCoverPhotoOriginalUrl = form.watch("coverPhotoOriginalUrl");

  const resolvedCoverPhotoUrl =
    watchedCoverPhotoUrl ??
    watchedCoverPhotoOriginalUrl ??
    watchedCoverImageUrl ??
    null;
  const resolvedCoverPhotoOriginalUrl =
    watchedCoverPhotoOriginalUrl ??
    watchedCoverPhotoUrl ??
    watchedCoverImageUrl ??
    null;

  const coverPhotoValue: CoverPhotoValue = {
    coverPhotoUrl: resolvedCoverPhotoUrl,
    coverPhotoCardUrl: form.watch("coverPhotoCardUrl") ?? null,
    coverPhotoThumbUrl: form.watch("coverPhotoThumbUrl") ?? null,
    coverPhotoAlt: form.watch("coverPhotoAlt") ?? null,
    coverPhotoAttribution: form.watch("coverPhotoAttribution") ?? null,
    coverPhotoStorageKey: form.watch("coverPhotoStorageKey") ?? null,
    coverPhotoOriginalUrl: resolvedCoverPhotoOriginalUrl,
    coverPhotoFocalX: toNumericOrNull(form.watch("coverPhotoFocalX")),
    coverPhotoFocalY: toNumericOrNull(form.watch("coverPhotoFocalY")),
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
      startDate: toDateInputValue(trip.startDate),
      endDate: toDateInputValue(trip.endDate),
      coverImageUrl: trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoUrl: trip.coverPhotoUrl ?? null,
      coverPhotoCardUrl: trip.coverPhotoCardUrl ?? null,
      coverPhotoThumbUrl: trip.coverPhotoThumbUrl ?? null,
      coverPhotoAlt: trip.coverPhotoAlt ?? null,
      coverPhotoAttribution: trip.coverPhotoAttribution ?? null,
    });
    // Reset selected destination to original
    setSelectedDestination({
      name: trip.destination,
      displayName: trip.destination
    });
    setPendingCoverPhotoFile(null);
    setPendingCoverPhotoMeta(null);
    setSaveState("idle");
    onOpenChange(false);
  };

  const isUploadingCoverPhoto = saveState === "uploading";
  const isSavingTrip = saveState === "saving" || updateTripMutation.isPending;
  const isCoverPhotoBusy = isUploadingCoverPhoto || isSavingTrip;
  const saveButtonLabel = isUploadingCoverPhoto
    ? "Uploading…"
    : isSavingTrip
      ? "Saving…"
      : "Save Changes";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Edit Trip Details</DialogTitle>
          <DialogDescription>
            Update your trip information. You can change the name, destination, and dates.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("coverImageUrl")} />
          <input type="hidden" {...form.register("coverPhotoUrl")} />
          <input type="hidden" {...form.register("coverPhotoCardUrl")} />
          <input type="hidden" {...form.register("coverPhotoThumbUrl")} />
          <input type="hidden" {...form.register("coverPhotoAlt")} />
          <input type="hidden" {...form.register("coverPhotoAttribution")} />
          <input type="hidden" {...form.register("coverPhotoStorageKey")} />
          <input type="hidden" {...form.register("coverPhotoOriginalUrl")} />
          <input type="hidden" {...form.register("coverPhotoFocalX", { valueAsNumber: true })} />
          <input type="hidden" {...form.register("coverPhotoFocalY", { valueAsNumber: true })} />
          <input type="hidden" {...form.register("coverPhotoUploadSize", { valueAsNumber: true })} />
          <input type="hidden" {...form.register("coverPhotoUploadType")} />

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
              id="destination"
              placeholder="e.g., Tokyo, Japan"
              value={selectedDestination?.name || form.getValues("destination") || ""}
              allowedTypes={['city']}
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

          <CoverPhotoSection
            value={coverPhotoValue}
            onChange={handleCoverPhotoChange}
            defaultAltText={`Cover photo for ${form.watch("name") || trip.name}`}
            onPendingFileChange={handlePendingFileChange}
            isBusy={isCoverPhotoBusy}
          />

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
              disabled={isCoverPhotoBusy}
              data-testid="button-save-trip"
            >
              {saveButtonLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}