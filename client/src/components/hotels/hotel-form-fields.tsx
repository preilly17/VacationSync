import { useEffect } from "react";
import type { InputHTMLAttributes } from "react";
import type { DateRange } from "react-day-picker";
import { differenceInCalendarDays, format } from "date-fns";
import type { UseFormReturn } from "react-hook-form";
import { CalendarIcon } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  HOTEL_FIELD_LABELS,
  type HotelFormValues,
} from "@/lib/hotel-form";

const requiredFields: Array<keyof HotelFormValues> = [
  "hotelName",
  "address",
  "city",
  "country",
  "checkInDate",
  "checkOutDate",
  "pricePerNight",
  "guestCount",
];

const integerFields = new Set<keyof HotelFormValues>(["guestCount", "roomCount"]);

const selectFieldOptions: Record<string, Array<{ label: string; value: string }>> = {
  currency: [
    { label: "USD", value: "USD" },
    { label: "EUR", value: "EUR" },
    { label: "GBP", value: "GBP" },
    { label: "CAD", value: "CAD" },
    { label: "AUD", value: "AUD" },
    { label: "JPY", value: "JPY" },
    { label: "MXN", value: "MXN" },
  ],
  status: [
    { label: "Confirmed", value: "confirmed" },
    { label: "Pending", value: "pending" },
    { label: "Cancelled", value: "cancelled" },
    { label: "On Hold", value: "on-hold" },
  ],
  bookingPlatform: [
    { label: "Booking.com", value: "booking.com" },
    { label: "Expedia", value: "expedia" },
    { label: "Hotels.com", value: "hotels.com" },
    { label: "Airbnb", value: "airbnb" },
    { label: "VRBO", value: "vrbo" },
    { label: "Direct", value: "direct" },
    { label: "Other", value: "other" },
  ],
};

interface HotelFormFieldsProps {
  form: UseFormReturn<HotelFormValues>;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

export function HotelFormFields({
  form,
  isSubmitting,
  submitLabel,
  onCancel,
  showCancelButton = false,
}: HotelFormFieldsProps) {
  useEffect(() => {
    form.register("checkOutDate");
  }, [form]);

  const checkOutValue = form.watch("checkOutDate");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderTextField(form, "hotelName")}
        {renderNumberField(form, "hotelRating", { min: "0", max: "5", step: "0.1", placeholder: "4.5" })}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Address</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderTextField(form, "address", { placeholder: "123 Main St" })}
          {renderTextField(form, "city", { placeholder: "Austin" })}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderTextField(form, "zipCode", { placeholder: "78701" })}
          {renderTextField(form, "country", { placeholder: "United States" })}
        </div>
      </div>

      <div className="grid grid-cols-1">
        <FormField
          control={form.control}
          name="checkInDate"
          render={({ field }) => {
            const selectedRange: DateRange | undefined = field.value
              ? { from: field.value, to: checkOutValue ?? field.value }
              : undefined;

            const label = HOTEL_FIELD_LABELS.checkInDate;
            const hasBothDates = Boolean(selectedRange?.from && selectedRange?.to);
            const nights = hasBothDates
              ? Math.max(1, differenceInCalendarDays(selectedRange!.to!, selectedRange!.from!))
              : 0;
            const description = hasBothDates
              ? `${format(selectedRange!.from!, "MMM d, yyyy")} → ${format(selectedRange!.to!, "MMM d, yyyy")} • ${nights} night${nights === 1 ? "" : "s"}`
              : selectedRange?.from
                ? `Selected ${format(selectedRange.from, "MMM d, yyyy")}. Choose a check-out date.`
                : "Select your stay dates.";

            return (
              <FormItem className="flex flex-col">
                <FormLabel className="mb-1">
                  {label}
                  <RequiredMark fieldName="checkInDate" />
                  <span className="mx-1 text-muted-foreground">/</span>
                  {HOTEL_FIELD_LABELS.checkOutDate}
                  <RequiredMark fieldName="checkOutDate" />
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedRange?.from && "text-muted-foreground",
                          "hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        )}
                      >
                        {selectedRange?.from ? (
                          <span className="flex flex-col">
                            <span className="font-medium text-neutral-900">
                              {format(selectedRange.from, "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {hasBothDates
                                ? `${format(selectedRange!.to!, "MMM d, yyyy")} • ${nights} night${nights === 1 ? "" : "s"}`
                                : "Select a check-out date"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select check-in and check-out</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-70" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={selectedRange?.from}
                      selected={selectedRange}
                      onSelect={(range) => {
                        if (range?.from) {
                          field.onChange(range.from);
                        }
                        if (range?.to) {
                          form.setValue("checkOutDate", range.to, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        } else if (range?.from) {
                          form.setValue("checkOutDate", range.from, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground mt-2">{description}</p>
                {(form.formState.errors.checkInDate || form.formState.errors.checkOutDate) && (
                  <FormMessage>
                    {form.formState.errors.checkInDate?.message ||
                      form.formState.errors.checkOutDate?.message}
                  </FormMessage>
                )}
              </FormItem>
            );
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderNumberField(form, "pricePerNight", { min: "0", step: "0.01", placeholder: "99.00" })}
        {renderNumberField(form, "guestCount", { min: "1", step: "1" })}
        {renderNumberField(form, "roomCount", { min: "1", step: "1" })}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {renderTextField(form, "bookingUrl", { type: "url", placeholder: "https://booking.com/..." })}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {renderTextareaField(form, "notes", "Share group preferences or special requests.")}
      </div>

      <Accordion type="single" collapsible className="overflow-hidden rounded-md border">
        <AccordionItem value="advanced" className="border-b-0">
          <AccordionTrigger className="px-4 text-sm font-medium">Advanced Details</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderTextField(form, "hotelChain", { placeholder: "Hilton Worldwide" })}
                {renderTextField(form, "roomType", { placeholder: "Double Queen" })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderTextField(form, "bookingReference", { placeholder: "ABC123" })}
                {renderTextField(form, "bookingSource", { placeholder: "Travel agent" })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderNumberField(form, "totalPrice", { min: "0", step: "0.01", placeholder: "299.00" })}
                {renderSelectField(form, "currency")}
                {renderSelectField(form, "status")}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderNumberField(form, "latitude", { step: "0.000001" })}
                {renderNumberField(form, "longitude", { step: "0.000001" })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderTextField(form, "purchaseUrl", { type: "url", placeholder: "https://portal.example.com" })}
                {renderSelectField(form, "bookingPlatform", true)}
                {renderTextField(form, "cancellationPolicy", {
                  placeholder: "Free cancellation until 48 hours prior",
                })}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {renderTextField(form, "contactInfo", { placeholder: "Front desk: +1 (555) 555-5555" })}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderTextareaField(form, "amenities", "Separate amenities with commas or paste JSON.")}
                {renderTextareaField(form, "policies", "Use JSON or descriptive text for important policies.")}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {renderTextareaField(form, "images", "Provide image URLs separated by commas or JSON array.")}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end gap-3 pt-2">
        {showCancelButton && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function renderTextField(
  form: UseFormReturn<HotelFormValues>,
  name: keyof HotelFormValues,
  inputProps: InputHTMLAttributes<HTMLInputElement> = {},
) {
  const label = HOTEL_FIELD_LABELS[name as keyof typeof HOTEL_FIELD_LABELS] ?? name;

  return (
    <FormField
      key={String(name)}
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            <RequiredMark fieldName={name} />
          </FormLabel>
          <FormControl>
            <Input
              {...inputProps}
              {...field}
              value={field.value ?? ""}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function renderNumberField(
  form: UseFormReturn<HotelFormValues>,
  name: keyof HotelFormValues,
  props: { min?: string; max?: string; step?: string; placeholder?: string } = {},
) {
  const label = HOTEL_FIELD_LABELS[name as keyof typeof HOTEL_FIELD_LABELS] ?? name;
  const isInteger = integerFields.has(name);

  return (
    <FormField
      key={String(name)}
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            <RequiredMark fieldName={name} />
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              {...props}
              value={field.value ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "") {
                  field.onChange(null);
                  return;
                }
                field.onChange(isInteger ? parseInt(value, 10) : parseFloat(value));
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function renderSelectField(
  form: UseFormReturn<HotelFormValues>,
  name: keyof HotelFormValues,
  isOptional = false,
) {
  const options = selectFieldOptions[name as string];
  const label = HOTEL_FIELD_LABELS[name as keyof typeof HOTEL_FIELD_LABELS] ?? name;

  if (!options) {
    return renderTextField(form, name);
  }

  return (
    <FormField
      key={String(name)}
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {!isOptional && <RequiredMark fieldName={name} />}
          </FormLabel>
          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function renderTextareaField(
  form: UseFormReturn<HotelFormValues>,
  name: keyof HotelFormValues,
  helperText?: string,
) {
  const label = HOTEL_FIELD_LABELS[name as keyof typeof HOTEL_FIELD_LABELS] ?? name;

  return (
    <FormField
      key={String(name)}
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              rows={4}
              {...field}
              value={field.value ?? ""}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </FormControl>
          {helperText && (
            <p className="text-xs text-muted-foreground">{helperText}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function RequiredMark({ fieldName }: { fieldName: keyof HotelFormValues }) {
  const isRequired = requiredFields.includes(fieldName);
  if (!isRequired) {
    return null;
  }
  return <span className="ml-1 text-destructive">*</span>;
}
