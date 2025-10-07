import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isValid } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { useNewActivityCreate } from "@/hooks/use-new-activity-create";
import {
  useCreateActivity,
  type ActivityCreateFormValues,
  type ActivityValidationError,
} from "@/lib/activities/createActivity";
import { type ActivityType, type ActivityWithDetails, type TripMember, type User } from "@shared/schema";
import {
  ACTIVITY_CATEGORY_MESSAGE,
  ACTIVITY_CATEGORY_VALUES,
  ATTENDEE_REQUIRED_MESSAGE,
  END_TIME_AFTER_START_MESSAGE,
  MAX_ACTIVITY_DESCRIPTION_LENGTH,
  MAX_ACTIVITY_LOCATION_LENGTH,
  MAX_ACTIVITY_NAME_LENGTH,
  normalizeCostInput,
  normalizeMaxCapacityInput,
} from "@shared/activityValidation";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const categories = [
  { value: "food", label: "Food & Dining" },
  { value: "sightseeing", label: "Sightseeing" },
  { value: "transport", label: "Transportation" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "culture", label: "Culture" },
  { value: "outdoor", label: "Outdoor" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
] as const;

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
      .refine((value) => timePattern.test(value), { message: "Start time must be in HH:MM format." }),
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
    attendeeIds: z
      .array(z.string(), { invalid_type_error: ATTENDEE_REQUIRED_MESSAGE })
      .default([]),
    category: z
      .string()
      .refine((value) => ACTIVITY_CATEGORY_VALUES.includes(value as (typeof ACTIVITY_CATEGORY_VALUES)[number]), {
        message: ACTIVITY_CATEGORY_MESSAGE,
      }),
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
      const attendeeCount = new Set([...(data.attendeeIds ?? [])]).size;
      if (normalizedCapacity < attendeeCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxCapacity"],
          message: "Max participants cannot be less than the number of selected attendees.",
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export type ActivityComposerPrefill = {
  name?: string;
  description?: string | null;
  startDate?: string | Date | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  cost?: string | null;
  maxCapacity?: string | null;
  category?: string | null;
  attendeeIds?: Array<string | number>;
  type?: ActivityType;
};

type TripMemberWithUser = TripMember & { user: User };

type MemberOption = {
  id: string;
  name: string;
  isCurrentUser: boolean;
};

interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  selectedDate?: Date | null;
  members: TripMemberWithUser[];
  defaultMode?: ActivityType;
  allowModeToggle?: boolean;
  currentUserId?: string;
  prefill?: ActivityComposerPrefill | null;
}

const getMemberDisplayName = (member: User | null | undefined, isCurrentUser: boolean) => {
  if (!member) {
    return isCurrentUser ? "You" : "Trip member";
  }

  const first = member.firstName?.trim();
  const last = member.lastName?.trim();
  const base = first && last ? `${first} ${last}` : first ?? member.username ?? member.email ?? "Trip member";

  return isCurrentUser ? `${base} (You)` : base;
};

const formatDateValue = (value: string | Date | null | undefined) => {
  if (value instanceof Date) {
    if (!isValid(value)) {
      return "";
    }
    return format(value, "yyyy-MM-dd");
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
};

const sanitizeOptional = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return "";
  }
  return value ?? "";
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
  prefill,
}: AddActivityModalProps) {
  const { toast } = useToast();

  const scheduledActivitiesQueryKey = useMemo(() => [`/api/trips/${tripId}/activities`], [tripId]);
  const proposalActivitiesQueryKey = useMemo(() => [`/api/trips/${tripId}/proposals/activities`], [tripId]);
  const calendarActivitiesQueryKey = useMemo(() => ["/api/trips", tripId, "activities"], [tripId]);
  const shouldUseActivitiesV2 = useNewActivityCreate();

  const memberOptions = useMemo<MemberOption[]>(() => {
    const base = members.map((member) => ({
      id: String(member.userId),
      name: getMemberDisplayName(member.user, member.userId === currentUserId),
      isCurrentUser: member.userId === currentUserId,
    }));

    const hasCurrentUser = base.some((member) => member.isCurrentUser);

    if (hasCurrentUser || !currentUserId) {
      return base;
    }

    const fallbackName = (() => {
      const found = members.find((member) => member.userId === currentUserId);
      return getMemberDisplayName(found?.user, true);
    })();

    return [
      { id: String(currentUserId), name: fallbackName, isCurrentUser: true },
      ...base,
    ];
  }, [members, currentUserId]);

  const defaultAttendeeIds = useMemo(() => memberOptions.map((member) => member.id), [memberOptions]);
  const creatorMemberId = useMemo(
    () => memberOptions.find((member) => member.isCurrentUser)?.id ?? null,
    [memberOptions],
  );

  const computeDefaults = useCallback(() => {
    const attendeePrefill = Array.isArray(prefill?.attendeeIds)
      ? Array.from(
          new Set(
            prefill.attendeeIds
              .map((id) => (id === null || id === undefined ? "" : String(id)))
              .filter((id) => id.length > 0),
          ),
        )
      : undefined;

    const dateSource = prefill?.startDate ?? selectedDate ?? null;

    const values: FormValues = {
      name: prefill?.name ?? "",
      description: sanitizeOptional(prefill?.description),
      startDate: formatDateValue(dateSource),
      startTime: sanitizeOptional(prefill?.startTime ?? ""),
      endTime: sanitizeOptional(prefill?.endTime ?? ""),
      location: sanitizeOptional(prefill?.location),
      cost: sanitizeOptional(prefill?.cost),
      maxCapacity: sanitizeOptional(prefill?.maxCapacity),
      attendeeIds: attendeePrefill?.length ? attendeePrefill : defaultAttendeeIds,
      category: (() => {
        const candidate = (prefill?.category ?? "other")?.toLowerCase?.() ?? "other";
        return ACTIVITY_CATEGORY_VALUES.includes(candidate as (typeof ACTIVITY_CATEGORY_VALUES)[number])
          ? candidate
          : "other";
      })(),
    } satisfies FormValues;

    const initialMode = prefill?.type ?? defaultMode;

    return { values, mode: initialMode };
  }, [defaultAttendeeIds, defaultMode, prefill, selectedDate]);

  const { values: defaultValues, mode: initialMode } = computeDefaults();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: defaultValues,
  });

  const [mode, setMode] = useState<ActivityType>(initialMode);

  useEffect(() => {
    if (open) {
      const { values, mode: nextMode } = computeDefaults();
      form.reset(values);
      setMode(nextMode);
    }
  }, [open, computeDefaults, form]);

  useEffect(() => {
    if (!allowModeToggle) {
      setMode(defaultMode);
    }
  }, [allowModeToggle, defaultMode]);

  useEffect(() => {
    if (open && !prefill?.startDate && selectedDate) {
      form.setValue("startDate", formatDateValue(selectedDate), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [open, selectedDate, prefill?.startDate, form]);

  useEffect(() => {
    if (mode === "SCHEDULED" && creatorMemberId) {
      const attendees = new Set(form.getValues("attendeeIds") ?? []);
      if (!attendees.has(creatorMemberId)) {
        attendees.add(creatorMemberId);
        form.setValue("attendeeIds", Array.from(attendees), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [mode, creatorMemberId, form]);

  const handleValidationError = useCallback(
    (error: ActivityValidationError) => {
      if (error.fieldErrors.length > 0) {
        error.fieldErrors.forEach(({ field, message }) => {
          if (field === "type") {
            return;
          }

          form.setError(field as Exclude<keyof FormValues, "type">, {
            type: "server",
            message,
          });
        });

        const focusField = error.fieldErrors[0]?.field;
        if (focusField && focusField !== "type") {
          try {
            form.setFocus(focusField as Exclude<keyof FormValues, "type">);
          } catch (focusError) {
            console.error("Failed to focus field", focusError);
          }
        }
      }

      const message = error.formMessage ?? error.fieldErrors[0]?.message;
      if (message) {
        toast({
          title: "Please review the activity details",
          description: message,
          variant: "destructive",
        });
      }
    },
    [form, toast],
  );

  const handleSuccess = useCallback(
    (_activity: ActivityWithDetails, values: ActivityCreateFormValues) => {
      toast({
        title: values.type === "PROPOSE" ? "Activity proposed" : "Activity added",
        description:
          values.type === "PROPOSE"
            ? "We shared this idea with your group for feedback."
            : "Your activity has been added to the schedule.",
      });

      const { values: resetValues, mode: resetMode } = computeDefaults();
      form.reset(resetValues);
      setMode(resetMode);
      onOpenChange(false);
    },
    [computeDefaults, form, onOpenChange, toast],
  );

  const createActivity = useCreateActivity({
    tripId,
    scheduledActivitiesQueryKey,
    proposalActivitiesQueryKey,
    calendarActivitiesQueryKey,
    members,
    currentUserId,
    enabled: tripId > 0,
    onValidationError: handleValidationError,
    onSuccess: handleSuccess,
    activitiesVersion: shouldUseActivitiesV2 ? "v2" : "legacy",
  });

  const selectedAttendeeIds = form.watch("attendeeIds") ?? [];

  const handleToggleAttendee = useCallback(
    (userId: string, checked: boolean | "indeterminate") => {
      const normalized = String(userId);
      if (mode === "SCHEDULED" && creatorMemberId && normalized === creatorMemberId && checked !== true) {
        return;
      }

      const current = new Set(form.getValues("attendeeIds") ?? []);
      if (checked === true) {
        current.add(normalized);
      } else if (checked === false) {
        current.delete(normalized);
      }

      form.setValue("attendeeIds", Array.from(current), {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [creatorMemberId, form, mode],
  );

  const handleSelectAll = useCallback(() => {
    form.setValue("attendeeIds", defaultAttendeeIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [defaultAttendeeIds, form]);

  const handleClearAttendees = useCallback(() => {
    if (mode === "SCHEDULED" && creatorMemberId) {
      form.setValue("attendeeIds", [creatorMemberId], {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    form.setValue("attendeeIds", [], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [creatorMemberId, form, mode]);

  const submitForm = form.handleSubmit((values) => {
    const sanitized: ActivityCreateFormValues = {
      name: values.name,
      description: values.description,
      startDate: values.startDate,
      startTime: values.startTime,
      endTime: values.endTime?.trim() ? values.endTime : undefined,
      location: values.location,
      cost: values.cost?.trim() ? values.cost : undefined,
      maxCapacity: values.maxCapacity?.trim() ? values.maxCapacity : undefined,
      attendeeIds: values.attendeeIds,
      category: values.category,
      type: mode,
    };

    createActivity.submit(sanitized);
  });

  const isSubmitting = createActivity.isPending;

  const handleDialogChange = (next: boolean) => {
    if (!next) {
      const { values, mode: resetMode } = computeDefaults();
      onOpenChange(false);
      form.reset(values);
      setMode(resetMode);
      return;
    }

    onOpenChange(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create an activity</DialogTitle>
          <DialogDescription>
            Choose whether you&apos;re proposing an idea or locking plans onto the schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitForm} className="space-y-4">
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
                {mode === "PROPOSE"
                  ? "This activity will be proposed to the group."
                  : "This activity will be added directly to the schedule."}
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              {mode === "PROPOSE"
                ? "Selected travelers will get a vote to weigh in."
                : "Everyone selected will receive an RSVP request."}
            </p>
          </div>

          <div>
            <Label htmlFor="name">Activity name</Label>
            <Input id="name" placeholder="e.g., Tokyo Skytree visit" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Share any important details or notes"
              rows={3}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="startDate">Date</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
              {form.formState.errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="startTime">Start time</Label>
              <Input id="startTime" type="time" {...form.register("startTime")} />
              {form.formState.errors.startTime && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.startTime.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="endTime">End time (optional)</Label>
            <Input id="endTime" type="time" {...form.register("endTime")} />
            {form.formState.errors.endTime && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.endTime.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Add where everyone should meet" {...form.register("location")} />
            {form.formState.errors.location && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.location.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cost">Cost per person (optional)</Label>
              <Input id="cost" placeholder="$50" {...form.register("cost")} />
              {form.formState.errors.cost && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.cost.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="maxCapacity">Max participants (optional)</Label>
              <Input id="maxCapacity" placeholder="Leave blank for unlimited" {...form.register("maxCapacity")} />
              {form.formState.errors.maxCapacity && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.maxCapacity.message}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="attendees">Who&apos;s going?</Label>
              <span className="text-xs text-neutral-500">{selectedAttendeeIds.length} selected</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {mode === "PROPOSE"
                ? "We&apos;ll ask everyone selected to vote on this idea."
                : "We&apos;ll send RSVP requests so calendars stay in sync."}
            </p>
            <div className="mt-3 flex items-center gap-2">
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
                disabled={
                  selectedAttendeeIds.length === 0
                  || (mode === "SCHEDULED" && creatorMemberId !== null && selectedAttendeeIds.length === 1)
                }
              >
                Clear
              </Button>
            </div>
            <ScrollArea className="mt-3 max-h-40 rounded-lg border border-neutral-200">
              <div className="space-y-2 p-3">
                {memberOptions.length === 0 ? (
                  <p className="text-sm text-neutral-500">Invite friends to your trip to choose attendees.</p>
                ) : (
                  memberOptions.map((member) => {
                    const checked = selectedAttendeeIds.includes(member.id);
                    return (
                      <div key={member.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={`attendee-${member.id}`}
                          checked={checked}
                          onCheckedChange={(checkedState) => handleToggleAttendee(member.id, checkedState)}
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
              <p className="mt-2 text-sm text-red-600">{form.formState.errors.attendeeIds.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(value) => form.setValue("category", value, { shouldDirty: true, shouldValidate: true })}
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
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.category.message}</p>
            )}
          </div>

          {Object.keys(form.formState.errors).length > 0 && (
            <div className="rounded-lg bg-red-50 p-3">
              <p className="mb-1 text-sm font-medium text-red-800">Please fix the highlighted fields.</p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-white hover:bg-red-600"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : mode === "PROPOSE" ? "Send proposal" : "Add to schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
