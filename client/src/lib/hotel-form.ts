import { useMemo } from "react";
import { z } from "zod";
import { insertHotelSchema, type InsertHotel } from "@shared/schema";

type TripDates = {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

export const hotelFormSchema = insertHotelSchema
  .extend({
    checkInDate: z.date(),
    checkOutDate: z.date(),
    amenities: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    contactInfo: z.string().optional().nullable(),
    images: z.string().optional().nullable(),
    policies: z.string().optional().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.pricePerNight == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Price per night is required",
        path: ["pricePerNight"],
      });
    }

    if (values.guestCount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Guest count is required",
        path: ["guestCount"],
      });
    }
  });

export type HotelFormValues = z.infer<typeof hotelFormSchema>;

export const createHotelFormDefaults = (tripId: number, tripDates?: TripDates): HotelFormValues => ({
  tripId,
  hotelName: "",
  hotelChain: null,
  hotelRating: null,
  address: "",
  city: "",
  country: "",
  zipCode: null,
  latitude: null,
  longitude: null,
  checkInDate: tripDates?.startDate ? new Date(tripDates.startDate) : new Date(),
  checkOutDate: tripDates?.endDate ? new Date(tripDates.endDate) : new Date(),
  roomType: null,
  roomCount: null,
  guestCount: null,
  bookingReference: null,
  totalPrice: null,
  pricePerNight: null,
  currency: "USD",
  status: "confirmed",
  bookingSource: null,
  purchaseUrl: null,
  amenities: "",
  images: "",
  policies: "",
  contactInfo: "",
  bookingPlatform: null,
  bookingUrl: null,
  cancellationPolicy: null,
  notes: "",
});

export const parseJsonInput = (value?: string | null) => {
  if (!value || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

export const parseAmenitiesInput = (value?: string | null) => {
  if (!value || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to comma parsing
    }
  }

  const items = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return trimmed;
  }

  return items.length === 1 ? items[0] : items;
};

export const stringifyJsonValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const transformHotelFormValues = (values: HotelFormValues): InsertHotel => ({
  tripId: values.tripId,
  hotelName: values.hotelName.trim(),
  hotelChain: values.hotelChain?.trim() ? values.hotelChain.trim() : null,
  hotelRating: values.hotelRating ?? null,
  address: values.address.trim(),
  city: values.city.trim(),
  country: values.country.trim(),
  zipCode: values.zipCode?.trim() ? values.zipCode.trim() : null,
  latitude: values.latitude ?? null,
  longitude: values.longitude ?? null,
  checkInDate: values.checkInDate.toISOString(),
  checkOutDate: values.checkOutDate.toISOString(),
  roomType: values.roomType?.trim() ? values.roomType.trim() : null,
  roomCount: values.roomCount ?? null,
  guestCount: values.guestCount ?? null,
  bookingReference: values.bookingReference?.trim() ? values.bookingReference.trim() : null,
  totalPrice: values.totalPrice ?? null,
  pricePerNight: values.pricePerNight ?? null,
  currency: values.currency?.trim() ? values.currency.trim() : "USD",
  status: values.status?.trim() ? values.status.trim() : "confirmed",
  bookingSource: values.bookingSource?.trim() ? values.bookingSource.trim() : null,
  purchaseUrl: values.purchaseUrl?.trim() ? values.purchaseUrl.trim() : null,
  amenities: parseAmenitiesInput(values.amenities),
  images: parseJsonInput(values.images),
  policies: parseJsonInput(values.policies),
  contactInfo: values.contactInfo?.trim() ? values.contactInfo.trim() : null,
  bookingPlatform: values.bookingPlatform?.trim() ? values.bookingPlatform.trim() : null,
  bookingUrl: values.bookingUrl?.trim() ? values.bookingUrl.trim() : null,
  cancellationPolicy: values.cancellationPolicy?.trim() ? values.cancellationPolicy.trim() : null,
  notes: values.notes?.trim() ? values.notes.trim() : null,
});

export const HOTEL_FIELD_LABELS: Record<
  keyof Omit<HotelFormValues, "tripId">
  , string
> = {
  hotelName: "Hotel Name",
  hotelChain: "Hotel Chain",
  hotelRating: "Hotel Rating",
  address: "Street Address",
  city: "City",
  country: "Country",
  zipCode: "Postal Code",
  latitude: "Latitude",
  longitude: "Longitude",
  checkInDate: "Check-In Date",
  checkOutDate: "Check-Out Date",
  roomType: "Room Type",
  roomCount: "Number of Rooms",
  guestCount: "Guest Count",
  bookingReference: "Booking Reference",
  totalPrice: "Total Price (USD)",
  pricePerNight: "Price per Night (USD)",
  currency: "Currency",
  status: "Booking Status",
  bookingSource: "Booking Source",
  purchaseUrl: "Purchase URL",
  amenities: "Amenities",
  images: "Images",
  policies: "Policies",
  contactInfo: "Contact Information",
  bookingPlatform: "Booking Platform",
  bookingUrl: "Booking Link (optional)",
  cancellationPolicy: "Cancellation Policy",
  notes: "Notes / Special Requests",
};

export const useHotelFieldLabel = (field: keyof typeof HOTEL_FIELD_LABELS) => {
  return useMemo(() => HOTEL_FIELD_LABELS[field] ?? field, [field]);
};
