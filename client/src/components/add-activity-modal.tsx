import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ActivityType, type ActivityWithDetails, type TripMember, type User } from "@shared/schema";
import {
  ACTIVITY_CATEGORY_MESSAGE,
  ACTIVITY_CATEGORY_VALUES,
  ATTENDEE_REQUIRED_MESSAGE,
  END_TIME_AFTER_START_MESSAGE,
  MAX_ACTIVITY_DESCRIPTION_LENGTH,
  MAX_ACTIVITY_LOCATION_LENGTH,
  MAX_ACTIVITY_NAME_LENGTH,
  normalizeAttendeeIds,
  normalizeCostInput,
  normalizeMaxCapacityInput,
} from "@shared/activityValidation";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

type TripMemberWithUser = TripMember & { user: User };

interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  selectedDate?: Date | null;
  members: TripMemberWithUser[];
  defaultMode?: ActivityType;
  allowModeToggle?: boolean;
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const formSchema = z
  .object({
    name: z
      .string()
      .min(1, "Activity name is required")
      .max(MAX_ACTIVITY_NAME_LENGTH, `Activity name must be ${MAX_ACTIVITY_NAME_LENGTH} characters or fewer.`),
    description: z
      .string()
      .max(
        MAX_ACTIVITY_DESCRIPTION_LENGTH,
        `Description must be ${MAX_ACTIVITY_DESCRIPTION_LENGTH} characters or fewer.`,
      )
      .optional()
      .transform((value) => value ?? ""),
    startDate: z.string().min(1, "Start date is required"),
    startTime: z
      .string()
      .min(1, "Start time is required")
      .refine((value) => timePattern.test(value), {
        message: "Start time must be in HH:MM format.",
      }),
    endTime: z
      .string()
      .optional()
      .refine((value) => !value || timePattern.test(value), {
        message: "End time must be in HH:MM format.",
      }),
    location: z
      .string()
      .max(
        MAX_ACTIVITY_LOCATION_LENGTH,
        `Location must be ${MAX_ACTIVITY_LOCATION_LENGTH} characters or fewer.`,
      )
      .optional()
      .transform((value) => value ?? ""),
    cost: z.string().optional(),
    maxCapacity: z.string().optional(),
    attendeeIds: z.array(z.string(), { invalid_type_error: ATTENDEE_REQUIRED_MESSAGE }).min(1, ATTENDEE_REQUIRED_MESSAGE),
    category: z
      .string()
      .refine((value) => ACTIVITY_CATEGORY_VALUES.includes(value as (typeof ACTIVITY_CATEGORY_VALUES)[number]), {
        message: ACTIVITY_CATEGORY_MESSAGE,
      }),
    type: z.enum(["SCHEDULED", "PROPOSE"]).default("SCHEDULED"),
  })
  .superRefine((data, ctx) => {
    if (data.cost) {
      const { error } = normalizeCostInput(data.cost);
      if (error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cost"], message: error });
      }
    }

    if (data.maxCapacity) {
      const { error } = normalizeMaxCapacityInput(data.maxCapacity);
      if (error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxCapacity"], message: error });
      }
    }

    if (data.endTime) {
      const startDate = new Date(`${data.startDate}T${data.startTime}`);
      const endDate = new Date(`${data.startDate}T${data.endTime}`);
      if (Number.isNaN(endDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "End time must be a valid time.",
        });
      } else if (!Number.isNaN(startDate.getTime()) && endDate <= startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: END_TIME_AFTER_START_MESSAGE });
      }
    }

    const { value: normalizedCapacity } = normalizeMaxCapacityInput(data.maxCapacity);
    if (normalizedCapacity !== null) {
      const attendeeCount = new Set([...data.attendeeIds]).size;
      if (normalizedCapacity < attendeeCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxCapacity"],
          message: "Max participants cannot be less than the number of selected attendees.",
        });
      }
    }
  });

type FormData = z.infer<typeof formSchema>;

const categories = [
  { value: "food", label: "Food & Dining" },
  { value: "sightseeing", label: "Sightseeing" },
  { value: "transport", label: "Transportation" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "culture", label: "Culture" },
  { value: "outdoor", label: "Outdoor" },
  { value: "other", label: "Other" },
];

const serverFieldMap: Partial<Record<string, keyof FormData>> = {
  name: "name",
  description: "description",
  startTime: "startTime",
  endTime: "endTime",
  location: "location",
  cost: "cost",
  maxCapacity: "maxCapacity",
  category: "category",
  attendeeIds: "attendeeIds",
  startDate: "startDate",
};

const getMemberDisplayName = (member?: User | null) => {
  if (!member) return "Trip member";
  const first = member.firstName?.trim();
  const last = member.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (member.username) return member.username;
  return member.email || "Trip member";
};

export function AddActivityModal({
  open,
  onOpenChange,
  tripId,
  selectedDate,
  members,
  defaultMode = "SCHEDULED",
  allowModeToggle = true,
}: AddActivityModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: String(member.userId),
        name: getMemberDisplayName(member.user),
      })),
    [members],
  );

  const defaultAttendeeIds = useMemo(
    () => memberOptions.map((member) => member.id),
    [memberOptions],
  );

  const getDefaultValues = useCallback(
    () => ({
      name: "",
      description: "",
      startDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
      startTime: "",
      endTime: "",
      location: "",
      cost: "",
      maxCapacity: "",
      category: "other",
      attendeeIds: defaultAttendeeIds,
      type: defaultMode,
    }),
    [defaultAttendeeIds, selectedDate, defaultMode],
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [mode, setMode] = useState<ActivityType>(defaultMode);
  const isProposalMode = mode === "PROPOSE";

  const selectedAttendeeIds = form.watch("attendeeIds") ?? [];

  useEffect(() => {
    if (open) {
      form.setValue("attendeeIds", defaultAttendeeIds, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [open, defaultAttendeeIds, form]);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
    }
  }, [defaultMode, open]);

  // Update form when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      form.setValue("startDate", format(selectedDate, "yyyy-MM-dd"), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else {
      form.reset(getDefaultValues());
    }
  }, [selectedDate, form, getDefaultValues]);

  useEffect(() => {
    setMode(defaultMode);
    form.setValue("type", defaultMode, { shouldDirty: false, shouldValidate: true });
  }, [defaultMode, form]);

  const handleToggleAttendee = (userId: string, checked: boolean | "indeterminate") => {
    const normalizedId = String(userId);
    const current = new Set((form.getValues("attendeeIds") ?? []).map(String));
    if (checked === true) {
      current.add(normalizedId);
    } else if (checked === false) {
      current.delete(normalizedId);
    }
    form.setValue("attendeeIds", Array.from(current), { shouldDirty: true, shouldValidate: true });
  };

  const handleSelectAll = () => {
    form.setValue("attendeeIds", defaultAttendeeIds, { shouldDirty: true, shouldValidate: true });
  };

  const handleClearAttendees = () => {
    form.setValue("attendeeIds", [], { shouldDirty: true, shouldValidate: true });
  };

  const createActivityMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!data.startDate || !data.startTime) {
        throw new Error("Start date and time are required");
      }

      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      if (Number.isNaN(startDateTime.getTime())) {
        throw new Error("Start date and time must be valid.");
      }

      const endDateTime = data.endTime ? new Date(`${data.startDate}T${data.endTime}`) : null;
      if (endDateTime && Number.isNaN(endDateTime.getTime())) {
        throw new Error("End time must be a valid time.");
      }

      const costResult = normalizeCostInput(data.cost);
      if (costResult.error) {
        throw new Error(costResult.error);
      }

      const capacityResult = normalizeMaxCapacityInput(data.maxCapacity);
      if (capacityResult.error) {
        throw new Error(capacityResult.error);
      }

      const attendeesResult = normalizeAttendeeIds(data.attendeeIds);
      if (attendeesResult.error) {
        throw new Error(attendeesResult.error);
      }

      const payload = {
        tripCalendarId: tripId,
        name: data.name.trim(),
        description: data.description?.trim() ? data.description.trim() : null,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : null,
        location: data.location?.trim() ? data.location.trim() : null,
        cost: costResult.value,
        maxCapacity: capacityResult.value,
        category: data.category,
        attendeeIds: attendeesResult.value,
        type: data.type ?? "SCHEDULED",
      };

      const response = await apiRequest(`/api/trips/${tripId}/activities`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const created = (await response.json()) as ActivityWithDetails;
      return created;
    },
    onSuccess: (createdActivity, variables) => {
      const submissionType = variables?.type ?? "SCHEDULED";

      const sortByStartTime = (activities: ActivityWithDetails[]) =>
        [...activities].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );

      const updateCache = (queryKey: unknown[]) => {
        queryClient.setQueryData<ActivityWithDetails[]>(queryKey, (existing = []) => {
          const filtered = existing.filter((item) => item.id !== createdActivity.id);
          return sortByStartTime([...filtered, createdActivity]);
        });
      };

      updateCache([`/api/trips/${tripId}/activities`]);
      updateCache([`/api/trips/${tripId}/proposals/activities`]);
      updateCache(["/api/trips", tripId.toString(), "activities"]);

      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "activities"] });

      toast({
        title: submissionType === "PROPOSE" ? "Activity proposed!" : "Activity created!",
        description:
          submissionType === "PROPOSE"
            ? "Your idea has been shared with the group for feedback."
            : "Your activity has been added to the trip calendar.",
      });
      onOpenChange(false);
      form.reset(getDefaultValues());
      setMode(defaultMode);
    },
    onError: (error) => {
      console.error("Activity creation error:", error);

      if (error instanceof ApiError) {
        if (error.status === 422) {
          const data = error.data as
            | { errors?: { field: string; message: string }[]; message?: string }
            | undefined;
          const serverErrors = Array.isArray(data?.errors) ? data?.errors : [];

          if (serverErrors.length > 0) {
            serverErrors.forEach(({ field, message }) => {
              const mappedField = serverFieldMap[field];
              if (mappedField) {
                form.setError(mappedField, { type: "server", message });
              }
            });

            const focusField = serverErrors.find(({ field }) => serverFieldMap[field])?.field;
            if (focusField) {
              const mapped = serverFieldMap[focusField];
              if (mapped) {
                try {
                  form.setFocus(mapped);
                } catch {
                  // ignore focus errors
                }
              }
            }
          }

          toast({
            title: "Please fix the highlighted fields",
            description:
              data?.message ?? "Some details need your attention before we can create this activity.",
            variant: "destructive",
          });
          return;
        }

        if (error.status >= 500) {
          const data = error.data as { correlationId?: string } | undefined;
          toast({
            title: "We couldn’t create this activity. Nothing was saved. Please try again.",
            description: data?.correlationId ? `Reference: ${data.correlationId}` : undefined,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create activity. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createActivityMutation.mutate({ ...data, type: mode });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Activity</DialogTitle>
          <DialogDescription>
            Plan a new activity for your trip, choose who's attending, and we'll notify them for you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="mode">Activity Type</Label>
            {allowModeToggle ? (
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) => {
                  if (value) {
                    setMode(value as ActivityType);
                  }
                }}
                className="mt-2 flex"
              >
                <ToggleGroupItem value="SCHEDULED" className="flex-1">
                  Add to schedule
                </ToggleGroupItem>
                <ToggleGroupItem value="PROPOSE" className="flex-1">
                  Propose to group
                </ToggleGroupItem>
              </ToggleGroup>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">
                {isProposalMode
                  ? "This activity will be proposed to the group."
                  : "This activity will be added directly to the schedule."}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="name">Activity Name</Label>
            <Input
              id="name"
              placeholder="e.g., Tokyo Skytree Visit"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what you'll be doing..."
              rows={3}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Date</Label>
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
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                {...form.register("startTime")}
              />
              {form.formState.errors.startTime && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.startTime.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="endTime">End Time (Optional)</Label>
            <Input
              id="endTime"
              type="time"
              {...form.register("endTime")}
            />
            {form.formState.errors.endTime && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.endTime.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Address or landmark"
              {...form.register("location")}
            />
            {form.formState.errors.location && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.location.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cost">Cost per Person</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("cost")}
              />
              {form.formState.errors.cost && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.cost.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="maxCapacity">Max Participants</Label>
              <Input
                id="maxCapacity"
                type="number"
                inputMode="numeric"
                placeholder="No limit"
                {...form.register("maxCapacity")}
              />
              {form.formState.errors.maxCapacity && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.maxCapacity.message}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="attendees">Who's Going?</Label>
              <span className="text-xs text-neutral-500">{selectedAttendeeIds.length} selected</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Everyone can still see this on the group calendar, even if they're not attending.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={memberOptions.length === 0 || selectedAttendeeIds.length === defaultAttendeeIds.length}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAttendees}
                disabled={selectedAttendeeIds.length === 0}
              >
                Clear
              </Button>
            </div>
            <ScrollArea className="mt-3 max-h-40 rounded-lg border border-neutral-200">
              <div className="p-3 space-y-2">
                {memberOptions.length === 0 ? (
                  <p className="text-sm text-neutral-500">Invite friends to your trip to pick attendees.</p>
                ) : (
                  memberOptions.map((member) => {
                    const isChecked = selectedAttendeeIds.includes(member.id);
                    return (
                      <div key={member.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={`attendee-${member.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleToggleAttendee(member.id, checked)}
                        />
                        <Label htmlFor={`attendee-${member.id}`} className="text-sm text-neutral-700">
                          {member.name}
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            {form.formState.errors.attendeeIds && (
              <p className="text-sm text-red-600 mt-2">{form.formState.errors.attendeeIds.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(value) =>
                form.setValue("category", value, { shouldDirty: true, shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.category.message}</p>
            )}
          </div>

          {Object.keys(form.formState.errors).length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-2">Please fix these errors:</p>
              <ul className="text-sm text-red-600 space-y-1">
                {Object.entries(form.formState.errors).map(([field, error]) => (
                  <li key={field}>• {field}: {error?.message}</li>
                ))}
              </ul>
            </div>
          )}

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
              disabled={createActivityMutation.isPending || !form.formState.isValid}
            >
              {createActivityMutation.isPending ? "Creating..." : "Create Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
