import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plane, Hotel, MapPin, CheckCircle, X, Utensils, Star, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { ActivityType } from "@shared/schema";
import { normalizeCostInput, normalizeMaxCapacityInput } from "@shared/activityValidation";

interface BookingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingType: 'flight' | 'hotel' | 'activity' | 'restaurant';
  bookingData?: any;
  tripId: number;
  onSuccess?: () => void;
  onConfirm?: (confirmed: boolean) => void;
  markBookingAsAsked?: (type: string, dataId: string, tripId: number, response: 'confirmed' | 'declined' | 'dismissed') => void;
}

const bookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  location: z.string().optional(),
  price: z.string().optional(),
  additionalDetails: z.string().optional(),
  // Restaurant-specific fields
  reservationTime: z.string().optional(),
  partySize: z.number().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  endTime: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

// Time options with 12h display but 24h values
const timeOptions = [
  { display: '5:30 PM', value: '17:30' },
  { display: '6:00 PM', value: '18:00' },
  { display: '6:30 PM', value: '18:30' },
  { display: '7:00 PM', value: '19:00' },
  { display: '7:30 PM', value: '19:30' },
  { display: '8:00 PM', value: '20:00' },
  { display: '8:30 PM', value: '20:30' },
  { display: '9:00 PM', value: '21:00' },
  { display: '9:30 PM', value: '21:30' },
];

export function BookingConfirmationModal({
  isOpen,
  onClose,
  bookingType,
  bookingData,
  tripId,
  onSuccess,
  onConfirm,
  markBookingAsAsked
}: BookingConfirmationModalProps) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [proposing, setProposing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: bookingData?.name || bookingData?.data?.name || "",
      description: bookingData?.description || bookingData?.data?.description || "",
      startDate: bookingData?.startDate ? new Date(bookingData.startDate) : new Date(),
      endDate: bookingData?.endDate ? new Date(bookingData.endDate) : undefined,
      location: bookingData?.location || bookingData?.data?.address || "",
      price: bookingData?.price || "",
      additionalDetails: "",
      // Restaurant-specific field defaults
      reservationTime: "19:00",
      partySize: 2,
      phone: bookingData?.data?.phone || "",
      website: bookingData?.data?.website || "",
      endTime: "21:00",
    },
  });

  const getIcon = () => {
    switch (bookingType) {
      case 'flight': return <Plane className="h-6 w-6" />;
      case 'hotel': return <Hotel className="h-6 w-6" />;
      case 'activity': return <MapPin className="h-6 w-6" />;
      case 'restaurant': return <Utensils className="h-6 w-6" />;
    }
  };

  const getTitle = () => {
    switch (bookingType) {
      case 'flight': return 'Flight Booking';
      case 'hotel': return 'Hotel Booking';
      case 'activity': return 'Activity Booking';
      case 'restaurant': return 'Restaurant Reservation';
    }
  };

  const handleConfirmation = (didBook: boolean) => {
    setConfirmed(didBook);
    if (onConfirm) {
      onConfirm(didBook);
    }
    if (!didBook && bookingType !== 'restaurant') {
      // If they didn't book a non-restaurant item, offer to propose
      setProposing(true);
    } else if (!didBook && bookingType === 'restaurant') {
      // For restaurants, just close if they didn't book
      onClose();
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    try {
      // Only support restaurant bookings through the activities endpoint
      if (bookingType !== 'restaurant') {
        toast({
          title: "Unsupported Booking Type",
          description: `${bookingType} bookings are not currently supported through this modal. Please add them manually to your trip.`,
          variant: "destructive",
        });
        return;
      }

      const submissionType: ActivityType = confirmed ? 'SCHEDULED' : 'PROPOSE';

      const reservationDate = format(data.startDate, 'yyyy-MM-dd');
      const startTimeValue = data.reservationTime ?? '19:00';
      const startDateTime = new Date(`${reservationDate}T${startTimeValue}`);
      if (Number.isNaN(startDateTime.getTime())) {
        throw new Error('Reservation time must be a valid date/time.');
      }

      const endDateSource = data.endDate ?? data.startDate;
      const endTimeValue = data.endTime ?? null;
      let endDateTime: Date | null = null;
      if (endTimeValue) {
        const endDate = format(endDateSource, 'yyyy-MM-dd');
        endDateTime = new Date(`${endDate}T${endTimeValue}`);
        if (Number.isNaN(endDateTime.getTime())) {
          throw new Error('End time must be a valid date/time.');
        }
      }

      const costResult = normalizeCostInput(data.price ?? null);
      if (costResult.error) {
        throw new Error(costResult.error);
      }

      const capacityResult = normalizeMaxCapacityInput(data.partySize ?? null);
      if (capacityResult.error) {
        throw new Error(capacityResult.error);
      }

      const payload = {
        tripCalendarId: tripId,
        name: data.name || bookingData?.data?.name || 'Restaurant Reservation',
        description: (data.description && data.description.trim().length > 0)
          ? data.description
          : `Restaurant reservation at ${data.name || bookingData?.data?.name}${data.additionalDetails ? '. ' + data.additionalDetails : ''}`,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : null,
        location: data.location || bookingData?.data?.address || '',
        cost: costResult.value,
        maxCapacity: capacityResult.value,
        category: 'food',
        type: submissionType,
        additionalInfo: JSON.stringify({
          restaurant: {
            name: data.name || bookingData?.data?.name,
            cuisine: bookingData?.data?.cuisine || '',
            rating: bookingData?.data?.rating || 0,
            phone: data.phone || bookingData?.data?.phone,
            website: data.website || bookingData?.data?.website,
            address: data.location || bookingData?.data?.address,
            priceRange: bookingData?.data?.priceRange || '',
            bookingLinks: bookingData?.data?.bookingLinks || []
          },
          reservation: {
            date: reservationDate,
            time: startTimeValue,
            partySize: data.partySize || 2,
            specialRequests: data.additionalDetails || ''
          }
        }),
        attendeeIds: user ? [user.id] : [],
      };

      const endpoint = submissionType === 'PROPOSE'
        ? `/api/trips/${tripId}/proposals/activities`
        : `/api/trips/${tripId}/activities`;

      await apiRequest(endpoint, {
        method: 'POST',
        body: payload,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips', tripId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips', tripId] });

      toast({
        title: "Booking Added",
        description: confirmed 
          ? `Your restaurant reservation has been added to your calendar and proposed to the group.`
          : `Your restaurant proposal has been shared with the group.`,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Booking save error:', error);
      toast({
        title: "Error",
        description: `Failed to save restaurant booking. Please try again.`,
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()} Confirmation
          </DialogTitle>
          <DialogDescription>
            {bookingType === 'restaurant' 
              ? `Confirm your reservation details and add it to your trip calendar.`
              : `Confirm your ${bookingType} booking and add it to your trip.`}
          </DialogDescription>
        </DialogHeader>

        {confirmed === null && (
          <div className="space-y-4 py-4">
            {/* Restaurant Details Section */}
            {bookingType === 'restaurant' && bookingData && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <Utensils className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{bookingData.data?.name}</h4>
                    <div className="space-y-1 mt-1">
                      {bookingData.data?.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {bookingData.data.address}
                        </p>
                      )}
                      {bookingData.data?.cuisine && (
                        <p className="text-sm text-muted-foreground">
                          {bookingData.data.cuisine} cuisine
                        </p>
                      )}
                      {bookingData.data?.rating && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {bookingData.data.rating} stars
                        </p>
                      )}
                      {bookingData.data?.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {bookingData.data.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              {bookingType === 'restaurant' 
                ? `Did you make a reservation at ${bookingData?.data?.name || 'this restaurant'}?`
                : `Did you complete your ${bookingType} booking on the external site?`}
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => handleConfirmation(true)}
                className="flex-1 flex items-center gap-2"
                data-testid="button-confirm-booking"
              >
                <CheckCircle className="h-4 w-4" />
                {bookingType === 'restaurant' ? 'Yes, I booked' : 'Yes, I booked it'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleConfirmation(false)}
                className="flex-1 flex items-center gap-2"
                data-testid="button-decline-booking"
              >
                <X className="h-4 w-4" />
                {bookingType === 'restaurant' ? 'No, just looking' : 'No, just browsing'}
              </Button>
            </div>
            {bookingType === 'restaurant' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  if (markBookingAsAsked && bookingData) {
                    const dataId = bookingData.data?.id || bookingData.data?.name || 'unknown';
                    markBookingAsAsked(bookingData.type, dataId, tripId, 'dismissed');
                  }
                  onClose();
                }}
                className="w-full text-xs text-muted-foreground"
                data-testid="button-dont-ask-again"
              >
                Don't ask me about this restaurant again today
              </Button>
            )}
          </div>
        )}

        {(confirmed !== null || proposing) && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                {confirmed 
                  ? "Great! Let's add this to your calendar and propose it to the group."
                  : "No problem! You can still propose this to the group for discussion."
                }
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {bookingType === 'restaurant' ? 'Restaurant Name' : 'Name'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={bookingType === 'restaurant' 
                          ? 'Restaurant name' 
                          : `Enter ${bookingType} name`
                        } 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Restaurant-specific fields */}
              {bookingType === 'restaurant' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="reservationTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reservation Time</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.display}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="partySize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Party Size</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="# of people" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map((size) => (
                                <SelectItem key={size} value={size.toString()}>{size} {size === 1 ? 'person' : 'people'}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Restaurant phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Restaurant website" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMM d, yyyy")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {bookingType !== 'activity' && (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "MMM d, yyyy")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Location" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input placeholder="$0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="additionalDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {bookingType === 'restaurant' ? 'Special Requests (Optional)' : 'Additional Details (Optional)'}
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={bookingType === 'restaurant' 
                          ? 'Any dietary restrictions, special occasions, seating preferences...'
                          : `Any additional details about this ${bookingType}...`
                        }
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {confirmed ? 'Add to Calendar & Propose' : 'Propose to Group'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}