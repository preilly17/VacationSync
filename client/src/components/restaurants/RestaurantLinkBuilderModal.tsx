import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from "date-fns";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { buildOpenTableUrl, buildResyUrl } from "@/utils/urlBuilders/restaurants";
import type { RestaurantLinkBuilderResult, RestaurantPlatform } from "@/types/restaurants";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const builderSchema = z
  .object({
    platform: z.union([z.literal("resy"), z.literal("open_table")]).default("resy"),
    city: z.string().trim().min(1, "City is required"),
    date: z.string().trim().refine((value) => ISO_DATE_REGEX.test(value), "Select a valid date"),
    time: z.string().trim().optional(),
    partySize: z.coerce.number({ invalid_type_error: "Party size must be a number" }).int().min(1, "Party size must be at least 1"),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const trimmedTime = values.time?.trim();
    if (values.platform === "open_table") {
      if (!trimmedTime || !TIME_REGEX.test(trimmedTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["time"],
          message: "Select a time",
        });
      }
    } else if (trimmedTime && !TIME_REGEX.test(trimmedTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["time"],
        message: "Time must be HH:mm",
      });
    }

    const lat = values.latitude?.trim();
    if (lat && Number.isNaN(Number(lat))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["latitude"],
        message: "Latitude must be a number",
      });
    }

    const lng = values.longitude?.trim();
    if (lng && Number.isNaN(Number(lng))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["longitude"],
        message: "Longitude must be a number",
      });
    }
  });

export type RestaurantLinkBuilderFormValues = z.infer<typeof builderSchema>;

export interface RestaurantLinkBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCity?: string | null;
  stateCode?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  defaultPartySize?: number | null;
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
  onLinkOpened: (result: RestaurantLinkBuilderResult) => void;
}

const toDate = (value?: string | Date | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const trackAnalytics = (eventName: string, payload: Record<string, unknown>) => {
  if (typeof window === "undefined") {
    return;
  }

  const analyticsWindow = window as typeof window & {
    analytics?: { track?: (event: string, detail?: Record<string, unknown>) => void };
  };

  try {
    analyticsWindow.analytics?.track?.(eventName, payload);
  } catch (error) {
    console.warn("Failed to publish analytics event", error);
  }
};

export function RestaurantLinkBuilderModal({
  open,
  onOpenChange,
  defaultCity,
  stateCode,
  startDate,
  endDate,
  defaultPartySize,
  defaultLatitude,
  defaultLongitude,
  onLinkOpened,
}: RestaurantLinkBuilderModalProps) {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(Boolean(defaultLatitude != null || defaultLongitude != null));

  const resolvedStart = useMemo(() => toDate(startDate) ?? undefined, [startDate]);
  const resolvedEnd = useMemo(() => toDate(endDate) ?? undefined, [endDate]);

  const defaultDate = useMemo(() => {
    const today = startOfDay(new Date());
    if (resolvedStart && resolvedEnd && !isAfter(resolvedStart, resolvedEnd)) {
      if (isWithinInterval(today, { start: startOfDay(resolvedStart), end: startOfDay(resolvedEnd) })) {
        return format(today, "yyyy-MM-dd");
      }

      return format(startOfDay(resolvedStart), "yyyy-MM-dd");
    }

    if (resolvedStart) {
      if (!isBefore(today, startOfDay(resolvedStart))) {
        return format(today, "yyyy-MM-dd");
      }

      return format(startOfDay(resolvedStart), "yyyy-MM-dd");
    }

    return format(today, "yyyy-MM-dd");
  }, [resolvedStart, resolvedEnd]);

  const defaultValues = useMemo<RestaurantLinkBuilderFormValues>(
    () => ({
      platform: "resy",
      city: defaultCity ?? "",
      date: defaultDate,
      time: "",
      partySize: Math.max(1, defaultPartySize ?? 2),
      latitude: defaultLatitude != null ? String(defaultLatitude) : "",
      longitude: defaultLongitude != null ? String(defaultLongitude) : "",
    }),
    [defaultCity, defaultDate, defaultLatitude, defaultLongitude, defaultPartySize],
  );

  const form = useForm<RestaurantLinkBuilderFormValues>({
    resolver: zodResolver(builderSchema),
    defaultValues,
    mode: "onChange",
  });

  const platform = form.watch("platform");
  const selectedDate = form.watch("date");

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setShowAdvanced(Boolean(defaultLatitude != null || defaultLongitude != null));
      void form.trigger();
      trackAnalytics("link_builder_opened", { tab: "restaurants", platform: form.getValues("platform") });
    }
  }, [open, form, defaultValues, defaultLatitude, defaultLongitude]);

  const dateOptions = useMemo(() => {
    if (!resolvedStart || !resolvedEnd || isAfter(resolvedStart, resolvedEnd)) {
      return [] as string[];
    }

    const days: string[] = [];
    let current = startOfDay(resolvedStart);
    const final = startOfDay(resolvedEnd);

    while (!isAfter(current, final)) {
      days.push(format(current, "yyyy-MM-dd"));
      current = addDays(current, 1);
    }

    return days;
  }, [resolvedStart, resolvedEnd]);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        form.reset(defaultValues);
        setShowAdvanced(Boolean(defaultLatitude != null || defaultLongitude != null));
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, form, defaultValues, defaultLatitude, defaultLongitude],
  );

  const submit = form.handleSubmit((values) => {
    try {
      const trimmedCity = values.city.trim();
      const latNumber = values.latitude?.trim() ? Number(values.latitude) : undefined;
      const lngNumber = values.longitude?.trim() ? Number(values.longitude) : undefined;

      let url: string;
      let result: RestaurantLinkBuilderResult;

      if (values.platform === "resy") {
        url = buildResyUrl({
          city: trimmedCity,
          stateCode: stateCode ?? undefined,
          date: values.date,
          partySize: values.partySize,
        });
      } else {
        url = buildOpenTableUrl({
          city: trimmedCity,
          date: values.date,
          time: values.time?.trim() ?? "",
          partySize: values.partySize,
          latitude: latNumber,
          longitude: lngNumber,
        });
      }

      result = {
        platform: values.platform,
        url,
        date: values.date,
        time: values.time?.trim() || undefined,
        partySize: values.partySize,
        city: trimmedCity,
        stateCode: stateCode ?? undefined,
        latitude: latNumber,
        longitude: lngNumber,
      };

      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      trackAnalytics("link_opened", { tab: "restaurants", platform: values.platform });
      onLinkOpened(result);
      handleClose(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to build link";
      toast({
        title: "Couldn't open reservation link",
        description: message,
        variant: "destructive",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Build a restaurant link</DialogTitle>
          <DialogDescription>
            Generate a Resy or OpenTable link with your trip details, then log the reservation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-6">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) {
                        field.onChange(value as RestaurantPlatform);
                      }
                    }}
                    className="grid grid-cols-2 gap-2"
                  >
                    <ToggleGroupItem value="resy" aria-label="Resy" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      Resy
                    </ToggleGroupItem>
                    <ToggleGroupItem value="open_table" aria-label="OpenTable" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      OpenTable
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Where will you dine?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {dateOptions.length > 0 ? (
              <div className="space-y-2">
                <FormLabel>Date</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {dateOptions.map((date) => {
                    const isSelected = selectedDate === date;
                    return (
                      <Button
                        key={date}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => {
                          form.setValue("date", date, { shouldValidate: true, shouldDirty: true });
                        }}
                      >
                        {format(parseISO(date), "EEE, MMM d")}
                      </Button>
                    );
                  })}
                </div>
                <Separator className="!my-4" />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time {platform === "open_table" ? "*" : "(optional)"}</FormLabel>
                    <FormControl>
                      <Input type="time" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partySize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party size</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                className="px-0 text-sm font-medium"
                onClick={() => setShowAdvanced((previous) => !previous)}
              >
                {showAdvanced ? "Hide advanced options" : "Advanced"}
              </Button>
              {showAdvanced ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form.formState.isValid}>
                Open Link
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
