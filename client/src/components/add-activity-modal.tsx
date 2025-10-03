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
import { buildActivitySubmission } from "@/lib/activitySubmission";
import { format } from "date-fns";

type TripMemberWithUser = TripMember & { user: User };

interface MemberOption {
  id: string;
  name: string;
  isCurrentUser: boolean;
}

interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  selectedDate?: Date | null;
  members: TripMemberWithUser[];
  defaultMode?: ActivityType;
  allowModeToggle?: boolean;
  currentUserId?: string;
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

const getMemberDisplayName = (member: User | null | undefined, isCurrentUser: boolean) => {
  if (!member) return isCurrentUser ? "You" : "Trip member";
  const first = member.firstName?.trim();
  const last = member.lastName?.trim();
  const baseName = first && last ? `${first} ${last}` : first ?? member.username ?? member.email ?? "Trip member";
  return isCurrentUser ? `${baseName} (You)` : baseName;
};

export function AddActivityModal({
  open,
  onOpenChange,
  tripId,
  selectedDate,
  members,
  defaultMode = "SCHEDULED",
  allowModeToggle = true,
  currentUserId,
}: AddActivityModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const memberOptions = useMemo<MemberOption[]>(() => {
    const baseOptions = members.map((member) => ({
      id: String(member.userId),
      name: getMemberDisplayName(member.user, member.userId === currentUserId),
      isCurrentUser: member.userId === currentUserId,
    }));

    const hasCurrentUserOption = baseOptions.some((member) => member.isCurrentUser);
    if (hasCurrentUserOption || !currentUserId) {
      return baseOptions;
    }

    const fallbackName = (() => {
      const matchingMember = members.find((member) => member.userId === currentUserId);
      if (matchingMember) {
        return getMemberDisplayName(matchingMember.user, true);
      }
      return "You";
    })();

    return [
      {
        id: String(currentUserId),
        name: fallbackName,
        isCurrentUser: true,
      },
      ...baseOptions,
    ];
  }, [members, currentUserId]);

  const defaultAttendeeIds = useMemo(
    () => memberOptions.map((member) => member.id),
    [memberOptions],
  );

  const creatorMemberId = useMemo(() => memberOptions.find((member) => member.isCurrentUser)?.id ?? null, [memberOptions]);

  const scheduledActivitiesQueryKey = useMemo(() => [`/api/trips/${tripId}/activities`], [tripId]);
  const proposalActivitiesQueryKey = useMemo(
    () => [`/api/trips/${tripId}/proposals/activities`],
    [tripId],
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

  useEffect(() => {
    if (mode === "SCHEDULED" && creatorMemberId) {
      const attendees = new Set((form.getValues("attendeeIds") ?? []).map(String));
      if (!attendees.has(creatorMemberId)) {
        attendees.add(creatorMemberId);
        form.setValue("attendeeIds", Array.from(attendees), { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [creatorMemberId, form, mode]);

  const handleToggleAttendee = (userId: string, checked: boolean | "indeterminate") => {
    const normalizedId = String(userId);
    if (mode === "SCHEDULED" && creatorMemberId && normalizedId === creatorMemberId && checked !== true) {
      return;
    }
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
    if (mode === "SCHEDULED") {
      if (creatorMemberId) {
        form.setValue("attendeeIds", [creatorMemberId], { shouldDirty: true, shouldValidate: true });
      }
      return;
    }
    form.setValue("attendeeIds", [], { shouldDirty: true, shouldValidate: true });
  };

  const createActivityMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const submissionType = data.type ?? "SCHEDULED";

      const { payload } = buildActivitySubmission({
        tripId,
        name: data.name,
        description: data.description,
        date: data.startDate,
        startTime: data.startTime,
        endTime: data.endTime ?? null,
        location: data.location,
        cost: data.cost,
        maxCapacity: data.maxCapacity,
        category: data.category,
        attendeeIds: data.attendeeIds,
        type: submissionType,
      });

      const endpoint =
        submissionType === "PROPOSE"
          ? `/api/trips/${tripId}/proposals/activities`
          : `/api/trips/${tripId}/activities`;

      const response = await apiRequest(endpoint, {
        method: "POST",
        body: payload,
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

      if (submissionType === "PROPOSE") {
        updateCache(proposalActivitiesQueryKey);
        updateCache(scheduledActivitiesQueryKey);

        queryClient.invalidateQueries({ queryKey: proposalActivitiesQueryKey });
        queryClient.invalidateQueries({ queryKey: scheduledActivitiesQueryKey });
        queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "activities"] });
      } else {
        updateCache(scheduledActivitiesQueryKey);
        updateCache(["/api/trips", tripId.toString(), "activities"]);

        queryClient.invalidateQueries({ queryKey: scheduledActivitiesQueryKey });
        queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "activities"] });
      }

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

  const findDuplicateActivity = useCallback(
    (name: string, startDateTime: Date) => {
      const normalizedName = name.trim().toLowerCase();
      if (!normalizedName) {
        return null;
      }

      const targetTime = startDateTime.getTime();
      if (!Number.isFinite(targetTime)) {
        return null;
      }

      const scheduled = queryClient.getQueryData<ActivityWithDetails[]>(scheduledActivitiesQueryKey) ?? [];
      const proposals = queryClient.getQueryData<ActivityWithDetails[]>(proposalActivitiesQueryKey) ?? [];
      const combined = [...scheduled, ...proposals];

      for (const activity of combined) {
        const activityName = (activity.name ?? "").trim().toLowerCase();
        if (activityName !== normalizedName) {
          continue;
        }

        const activityStart = new Date(activity.startTime).getTime();
        if (!Number.isFinite(activityStart)) {
          continue;
        }

        if (Math.abs(activityStart - targetTime) <= 60_000) {
          return activity;
        }
      }

      return null;
    },
    [proposalActivitiesQueryKey, queryClient, scheduledActivitiesQueryKey],
  );

  const onSubmit = (data: FormData) => {
    const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
    const duplicate = findDuplicateActivity(data.name, startDateTime);

    if (duplicate) {
      const duplicateStart = new Date(duplicate.startTime);
      const friendlyTime = Number.isNaN(duplicateStart.getTime())
        ? "the same time"
        : format(duplicateStart, "MMM d 'at' h:mm a");
      toast({
        title: "Heads up — possible duplicate",
        description: `"${duplicate.name}" is already on the books for ${friendlyTime}. We'll still save this if you'd like to continue.`,
      });
    }

    createActivityMutation.mutate({ ...data, type: mode });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create an activity</DialogTitle>
          <DialogDescription>
            Decide whether you&apos;re proposing an idea for feedback or locking plans onto the schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="mode">Share it with the group</Label>
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
            <p className="mt-2 text-xs text-neutral-500">
              {isProposalMode
                ? "Invitees get a 👍 / 👎 vote. You can schedule it later if the group is in."
                : "Invitees receive an RSVP request right away so their schedules stay in sync."}
            </p>
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
              <Label htmlFor="attendees">Who&apos;s going?</Label>
              <span className="text-xs text-neutral-500">{selectedAttendeeIds.length} selected</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {isProposalMode
                ? "We’ll ping the selected travelers to vote 👍 or 👎."
                : "We’ll send RSVP requests to everyone selected and keep their calendars updated."}
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
                          disabled={mode === "SCHEDULED" && member.isCurrentUser}
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
              {createActivityMutation.isPending
                ? isProposalMode
                  ? "Sending..."
                  : "Scheduling..."
                : isProposalMode
                  ? "Send proposal"
                  : "Add to schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
