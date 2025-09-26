import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { MapPin, Users, Star, Edit, Trash2, ExternalLink, Hotel, Plus, Bed, Search, ArrowLeft, Building, ChevronRight, Calculator, ArrowUpDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { type InsertHotel, type HotelWithDetails, type TripWithDates, type HotelSearchResult, type HotelProposalWithDetails } from "@shared/schema";
import { TravelLoading } from "@/components/LoadingSpinners";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import HotelSearchPanel, { type HotelSearchContext } from "@/components/hotels/hotel-search-panel";
import {
  createHotelFormDefaults,
  hotelFormSchema,
  parseAmenitiesInput,
  parseJsonInput,
  stringifyJsonValue,
  transformHotelFormValues,
  type HotelFormValues,
} from "@/lib/hotel-form";
import { HotelFormFields } from "@/components/hotels/hotel-form-fields";

export default function HotelsPage() {
  const params = useParams();
  const tripId = parseInt(params.tripId as string);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelWithDetails | null>(null);
  // Currency conversion state
  const [currencyAmount, setCurrencyAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [conversionResult, setConversionResult] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Booking confirmation system
  const { showModal, bookingData, storeBookingIntent, closeModal } = useBookingConfirmation();

  const { data: trip } = useQuery<TripWithDates>({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId,
  });

  const { data: hotels = [], isLoading } = useQuery<HotelWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/hotels`],
    enabled: !!tripId,
  });

  // Hotel proposals for group voting
  const { data: hotelProposals = [], isLoading: proposalsLoading } = useQuery<HotelProposalWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/hotel-proposals`],
    enabled: !!tripId,
  });

  const addHotelButtonRef = useRef<HTMLButtonElement>(null);

  const [currentPath, setLocation] = useLocation();

  const { pathname: hotelsPathname, searchParams } = useMemo(() => {
    const [path = currentPath, search = ""] = currentPath.split("?");
    return {
      pathname: path,
      searchParams: new URLSearchParams(search),
    };
  }, [currentPath]);

  const isSearchPanelOpen = searchParams.get("panel") === "search";
  const shouldAutoSearch = isSearchPanelOpen && searchParams.get("auto") === "1";

  const updatePanelQuery = useCallback(
    (open: boolean, options?: { auto?: boolean }) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (open) {
        nextParams.set("panel", "search");
        if (options?.auto) {
          nextParams.set("auto", "1");
        } else {
          nextParams.delete("auto");
        }
      } else {
        nextParams.delete("panel");
        nextParams.delete("auto");
      }

      const query = nextParams.toString();
      setLocation(`${hotelsPathname}${query ? `?${query}` : ""}`, { replace: true });
    },
    [hotelsPathname, searchParams, setLocation],
  );

  const openSearchPanel = useCallback(() => updatePanelQuery(true), [updatePanelQuery]);
  const closeSearchPanel = useCallback(() => updatePanelQuery(false), [updatePanelQuery]);
  const toggleSearchPanel = useCallback(() => {
    if (isSearchPanelOpen) {
      updatePanelQuery(false);
    } else {
      updatePanelQuery(true);
    }
  }, [isSearchPanelOpen, updatePanelQuery]);

  const previousSearchOpen = useRef(isSearchPanelOpen);
  useEffect(() => {
    if (previousSearchOpen.current && !isSearchPanelOpen) {
      addHotelButtonRef.current?.focus();
    }
    previousSearchOpen.current = isSearchPanelOpen;
  }, [isSearchPanelOpen]);

  const initialCheckInDate = useMemo(
    () => (trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : undefined),
    [trip?.startDate],
  );
  const initialCheckOutDate = useMemo(
    () => (trip?.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : undefined),
    [trip?.endDate],
  );

  // Currency conversion function
  const convertCurrency = async () => {
    if (!currencyAmount || !fromCurrency || !toCurrency) {
      toast({
        title: "Currency Conversion Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (fromCurrency === toCurrency) {
      setConversionResult(`${currencyAmount} ${fromCurrency}`);
      return;
    }

    setIsConverting(true);
    try {
      const amount = parseFloat(currencyAmount);
      if (isNaN(amount)) {
        throw new Error("Invalid amount");
      }

      // Use the @fawazahmed0/currency-api for real exchange rates
      const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromCurrency.toLowerCase()}.json`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch exchange rates");
      }
      
      const data = await response.json();
      const rate = data[fromCurrency.toLowerCase()][toCurrency.toLowerCase()];
      
      if (!rate) {
        throw new Error("Exchange rate not available");
      }
      
      const convertedAmount = (amount * rate).toFixed(2);
      setConversionResult(`${convertedAmount} ${toCurrency}`);
      
      toast({
        title: "Currency Converted",
        description: `${amount} ${fromCurrency} = ${convertedAmount} ${toCurrency}`,
      });
      
    } catch (error) {
      console.error("Currency conversion error:", error);
      toast({
        title: "Conversion Error",
        description: "Unable to convert currency. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Share hotel with group as a proposal
  const shareHotelWithGroup = async (hotel: HotelSearchResult) => {
    try {
      await apiRequest(`/api/trips/${tripId}/hotel-proposals`, {
        method: "POST",
        body: JSON.stringify({
          hotelName: hotel.name,
          location: hotel.location,
          price: hotel.price,
          pricePerNight: hotel.pricePerNight || hotel.price,
          rating: hotel.rating || 4,
          amenities: hotel.amenities || "WiFi, Breakfast",
          platform: hotel.platform,
          bookingUrl: hotel.bookingUrl
        }),
      });
      
      toast({
        title: "Hotel Proposed to Group!",
        description: `${hotel.name} has been proposed to your group for ranking and voting.`,
      });
      
      // PROPOSALS FEATURE: refresh proposals so manual saves stay in sync.
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (isUnauthorizedError(errorObj)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to propose hotels.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to propose hotel. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Hotel ranking functionality
  const submitRanking = async (proposalId: number, ranking: number, notes?: string) => {
    try {
      // PROPOSALS FEATURE: reuse the shared ranking endpoint for proposal votes.
      await apiRequest(`/api/hotel-proposals/${proposalId}/rank`, {
        method: "POST",
        body: JSON.stringify({ ranking, notes }),
      });
      
      toast({
        title: "Ranking Submitted!",
        description: "Your hotel preference has been recorded.",
      });
      
      // PROPOSALS FEATURE: keep rankings consistent across tabs.
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (isUnauthorizedError(errorObj)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to rank hotels.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit ranking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formDefaults = useCallback(
    () => createHotelFormDefaults(tripId, { startDate: trip?.startDate, endDate: trip?.endDate }),
    [tripId, trip?.startDate, trip?.endDate],
  );

  const form = useForm<HotelFormValues>({
    resolver: zodResolver(hotelFormSchema),
    defaultValues: formDefaults(),
  });

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setEditingHotel(null);
    form.reset(formDefaults());
  }, [form, formDefaults]);

  const openCreateDialog = useCallback(() => {
    setEditingHotel(null);
    form.reset(formDefaults());
    setIsDialogOpen(true);
  }, [form, formDefaults]);

  useEffect(() => {
    if (!isDialogOpen && !editingHotel) {
      form.reset(formDefaults());
    }
  }, [editingHotel, form, formDefaults, isDialogOpen]);

  const createHotelMutation = useMutation({
    mutationFn: async (payload: InsertHotel) => {
      return await apiRequest(`/api/trips/${tripId}/hotels`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
      // PROPOSALS FEATURE: sync manual hotel saves with the proposals tab.
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      toast({
        title: "Hotel added successfully",
        description: "Your hotel booking has been saved to the trip.",
      });
      handleDialogClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to add hotels.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add hotel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateHotelMutation = useMutation({
    mutationFn: async (payload: InsertHotel) => {
      return await apiRequest(`/api/hotels/${editingHotel?.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
      // PROPOSALS FEATURE: ensure proposal details reflect the latest hotel edits.
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      toast({
        title: "Hotel updated successfully",
        description: "Your hotel booking has been updated.",
      });
      handleDialogClose();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to update hotels.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update hotel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteHotelMutation = useMutation({
    mutationFn: async (hotelId: number) => {
      return await apiRequest(`/api/hotels/${hotelId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
      // PROPOSALS FEATURE: remove deleted hotels from the proposals list immediately.
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      toast({
        title: "Hotel deleted successfully",
        description: "Your hotel booking has been removed.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to delete hotels.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete hotel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (hotel: HotelWithDetails) => {
    setEditingHotel(hotel);
    const defaults = formDefaults();
    form.reset({
      ...defaults,
      tripId,
      hotelName: hotel.hotelName,
      hotelChain: hotel.hotelChain,
      address: hotel.address,
      city: hotel.city,
      country: hotel.country,
      zipCode: hotel.zipCode ?? null,
      latitude: hotel.latitude ?? null,
      longitude: hotel.longitude ?? null,
      checkInDate: new Date(hotel.checkInDate),
      checkOutDate: new Date(hotel.checkOutDate),
      totalPrice: hotel.totalPrice ?? null,
      pricePerNight: hotel.pricePerNight ?? null,
      roomType: hotel.roomType ?? null,
      roomCount: hotel.roomCount ?? null,
      guestCount: hotel.guestCount ?? null,
      hotelRating: hotel.hotelRating ?? null,
      bookingReference: hotel.bookingReference ?? null,
      bookingSource: hotel.bookingSource ?? null,
      purchaseUrl: hotel.purchaseUrl ?? null,
      currency: hotel.currency ?? defaults.currency,
      status: hotel.status ?? defaults.status,
      amenities:
        typeof hotel.amenities === "string"
          ? hotel.amenities
          : Array.isArray(hotel.amenities)
            ? hotel.amenities.join(", ")
            : stringifyJsonValue(hotel.amenities),
      images: stringifyJsonValue(hotel.images),
      policies: stringifyJsonValue(hotel.policies),
      contactInfo: stringifyJsonValue(hotel.contactInfo),
      bookingPlatform: hotel.bookingPlatform ?? null,
      bookingUrl: hotel.bookingUrl ?? null,
      cancellationPolicy: hotel.cancellationPolicy ?? null,
      notes: hotel.notes ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (hotelId: number) => {
    if (window.confirm("Are you sure you want to delete this hotel booking?")) {
      deleteHotelMutation.mutate(hotelId);
    }
  };

  const onSubmit = (values: HotelFormValues) => {
    const payload = transformHotelFormValues(values);
    if (editingHotel) {
      updateHotelMutation.mutate(payload);
    } else {
      createHotelMutation.mutate(payload);
    }
  };

  const getStarRating = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "w-4 h-4",
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        )}
      />
    ));
  };

  const formatDateRange = (checkIn: string, checkOut: string) => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    return `${format(checkInDate, "MMM d")} - ${format(checkOutDate, "MMM d")} (${nights} nights)`;
  };

  const parsePriceValue = (price?: string | null) => {
    if (!price) return null;
    const numeric = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  };

  const detectCurrency = (price?: string | null) => {
    if (!price) return "USD";
    if (price.includes("€")) return "EUR";
    if (price.includes("£")) return "GBP";
    if (price.includes("¥") || price.includes("円")) return "JPY";
    if (price.includes("₩")) return "KRW";
    if (price.includes("A$")) return "AUD";
    if (price.includes("C$")) return "CAD";
    if (price.includes("₽")) return "RUB";
    if (price.includes("₹")) return "INR";
    if (price.includes("₺")) return "TRY";
    if (price.includes("₱")) return "PHP";
    if (price.includes("₫")) return "VND";
    if (price.includes("฿")) return "THB";
    if (price.includes("CHF")) return "CHF";
    if (price.includes("HK$")) return "HKD";
    if (price.includes("S$")) return "SGD";
    if (price.trim().startsWith("$")) return "USD";
    return "USD";
  };

  const deriveCityCountry = (value: string, fallback: string) => {
    const source = value || fallback;
    const segments = source
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return { city: fallback, country: fallback };
    }

    if (segments.length === 1) {
      return { city: segments[0], country: segments[0] };
    }

    return {
      city: segments[0],
      country: segments[segments.length - 1],
    };
  };

  const handleSelectHotelFromSearch = useCallback(
    async (hotel: HotelSearchResult, context: HotelSearchContext) => {
      const fallbackDestination = context.destinationText || trip?.destination || hotel.location || hotel.name;
      const combinedLocation = hotel.location || fallbackDestination;
      const { city, country } = deriveCityCountry(combinedLocation, fallbackDestination);
      const totalGuests = context.adults + context.children;

      const payload: InsertHotel = {
        tripId,
        hotelName: hotel.name,
        hotelChain: null,
        hotelRating: typeof hotel.rating === "number" ? hotel.rating : null,
        address: hotel.address && hotel.address.trim() ? hotel.address.trim() : combinedLocation,
        city: city || fallbackDestination,
        country: country || fallbackDestination,
        zipCode: null,
        latitude: null,
        longitude: null,
        checkInDate: context.checkInDate,
        checkOutDate: context.checkOutDate,
        roomType: null,
        roomCount: context.rooms > 0 ? context.rooms : null,
        guestCount: totalGuests > 0 ? totalGuests : null,
        bookingReference: null,
        totalPrice: parsePriceValue(hotel.price),
        pricePerNight: parsePriceValue(hotel.pricePerNight ?? null),
        currency: detectCurrency(hotel.price ?? hotel.pricePerNight ?? null),
        status: "interested",
        bookingSource: hotel.platform,
        purchaseUrl: hotel.bookingUrl,
        amenities: hotel.amenities ?? null,
        images: null,
        policies: null,
        contactInfo: null,
        bookingPlatform: hotel.platform,
        bookingUrl: hotel.bookingUrl,
        cancellationPolicy: context.filters.freeCancellation ? "Free cancellation" : null,
        notes: hotel.description ?? null,
      };

      try {
        await apiRequest(`/api/trips/${tripId}/hotels`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });

        toast({
          title: "Added to trip.",
          description: `${hotel.name} was saved to your itinerary.`,
        });
      } catch (error) {
        if (isUnauthorizedError(error as Error)) {
          toast({
            title: "Unauthorized",
            description: "You need to be logged in to add hotels.",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/login";
          }, 500);
          const handled = new Error("auth-required");
          (handled as any).handled = true;
          throw handled;
        }

        toast({
          title: "Error",
          description: "Failed to add hotel. Please try again.",
          variant: "destructive",
        });
        const handled = error instanceof Error ? error : new Error("selection-failed");
        (handled as any).handled = true;
        throw handled;
      }
    },
    [queryClient, toast, trip?.destination, tripId],
  );

  if (isLoading) {
    return (
      <div className="space-y-4 min-h-screen flex items-center justify-center">
        <TravelLoading variant="luggage" size="lg" text="Loading your hotel coordination..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Link href={`/trip/${tripId}`}>
          <Button 
            variant="outline" 
            size="sm"
            className="mb-6 flex items-center hover:bg-gray-50"
            data-testid="button-back-to-trip"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Trip
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="search-header-gradient rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="airplane-animate">
              <Building className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                Accommodations Search
              </h1>
              <p className="text-gray-700">
                Search hotels to propose to your group and vote on group proposals
              </p>
            </div>
            <div className="flex gap-2 ml-auto">
              <Hotel className="h-5 w-5 text-blue-500" />
              <ChevronRight className="h-5 w-5 text-gray-400" />
              <Bed className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            ref={addHotelButtonRef}
            onClick={toggleSearchPanel}
          >
            <Search className="h-4 w-4 mr-2" />
            {isSearchPanelOpen ? 'Hide search' : 'Add Hotel'}
          </Button>
          <Button variant="outline" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Manual entry
          </Button>
        </div>
      </div>

      {isSearchPanelOpen && (
        <HotelSearchPanel
          trip={trip}
          isOpen={isSearchPanelOpen}
          autoSearch={shouldAutoSearch}
          initialDestination={trip?.destination}
          initialCheckIn={initialCheckInDate}
          initialCheckOut={initialCheckOutDate}
          onClose={closeSearchPanel}
          onSelectHotel={handleSelectHotelFromSearch}
          onProposeHotel={(hotel) => shareHotelWithGroup(hotel)}
        />
      )}

      {proposalsLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl hidden md:block" />
        </div>
      ) : hotelProposals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Group Hotel Proposals
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Rank these hotels from 1 (most preferred) to help your group decide
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {hotelProposals.map((proposal) => (
                <Card key={proposal.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{proposal.hotelName}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {proposal.location}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Proposed by {proposal.proposer.firstName || 'Group Member'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1">
                          {getStarRating(Number(proposal.rating))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Price:</span>
                        <span className="text-lg font-bold text-blue-600">{proposal.price}</span>
                      </div>
                      {proposal.averageRanking != null && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">Group Average:</span>
                          <span className="text-sm font-medium text-blue-600">#{proposal.averageRanking}</span>
                        </div>
                      )}
                    </div>

                    {proposal.amenities && (
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Amenities:</span>
                        <p className="text-sm text-gray-600 leading-relaxed">{proposal.amenities}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <Badge variant="outline" className="text-xs">
                        {proposal.platform}
                      </Badge>
                      {proposal.currentUserRanking && (
                        <Badge variant="secondary" className="text-xs">
                          Your Rank: #{proposal.currentUserRanking.ranking}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3 border-t pt-3">
                      <span className="text-sm font-medium">Rank this hotel:</span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rank) => (
                          <Button
                            key={rank}
                            size="sm"
                            variant={proposal.currentUserRanking?.ranking === rank ? 'default' : 'outline'}
                            onClick={() => submitRanking(proposal.id, rank)}
                            className="text-xs px-3"
                          >
                            #{rank}
                          </Button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(proposal.bookingUrl, '_blank')}
                          className="flex-1"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Hotel
                        </Button>
                      </div>
                    </div>

                    {proposal.rankings.length > 0 && (
                      <div className="space-y-2 border-t pt-3">
                        <span className="text-sm font-medium">Group Rankings:</span>
                        <div className="space-y-1">
                          {proposal.rankings.map((ranking) => (
                            <div key={ranking.id} className="flex items-center justify-between text-sm">
                              <span>{ranking.user.firstName || 'Group Member'}</span>
                              <Badge variant="outline" className="text-xs">
                                #{ranking.ranking}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hotel proposals yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Use the hotel search to add or propose new stays for your group.
            </p>
            <Button onClick={openSearchPanel} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Open search panel
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Currency Converter
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Convert currencies for your travel budget planning with live exchange rates
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                value={currencyAmount}
                onChange={(event) => setCurrencyAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>From Currency</Label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                  <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                  <SelectItem value="JPY">🇯🇵 JPY - Japanese Yen</SelectItem>
                  <SelectItem value="AUD">🇦🇺 AUD - Australian Dollar</SelectItem>
                  <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="CHF">🇨🇭 CHF - Swiss Franc</SelectItem>
                  <SelectItem value="CNY">🇨🇳 CNY - Chinese Yuan</SelectItem>
                  <SelectItem value="SEK">🇸🇪 SEK - Swedish Krona</SelectItem>
                  <SelectItem value="NZD">🇳🇿 NZD - New Zealand Dollar</SelectItem>
                  <SelectItem value="MXN">🇲🇽 MXN - Mexican Peso</SelectItem>
                  <SelectItem value="SGD">🇸🇬 SGD - Singapore Dollar</SelectItem>
                  <SelectItem value="HKD">🇭🇰 HKD - Hong Kong Dollar</SelectItem>
                  <SelectItem value="NOK">🇳🇴 NOK - Norwegian Krone</SelectItem>
                  <SelectItem value="KRW">🇰🇷 KRW - South Korean Won</SelectItem>
                  <SelectItem value="TRY">🇹🇷 TRY - Turkish Lira</SelectItem>
                  <SelectItem value="RUB">🇷🇺 RUB - Russian Ruble</SelectItem>
                  <SelectItem value="INR">🇮🇳 INR - Indian Rupee</SelectItem>
                  <SelectItem value="BRL">🇧🇷 BRL - Brazilian Real</SelectItem>
                  <SelectItem value="ZAR">🇿🇦 ZAR - South African Rand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>To Currency</Label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                  <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                  <SelectItem value="JPY">🇯🇵 JPY - Japanese Yen</SelectItem>
                  <SelectItem value="AUD">🇦🇺 AUD - Australian Dollar</SelectItem>
                  <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="CHF">🇨🇭 CHF - Swiss Franc</SelectItem>
                  <SelectItem value="CNY">🇨🇳 CNY - Chinese Yuan</SelectItem>
                  <SelectItem value="SEK">🇸🇪 SEK - Swedish Krona</SelectItem>
                  <SelectItem value="NZD">🇳🇿 NZD - New Zealand Dollar</SelectItem>
                  <SelectItem value="MXN">🇲🇽 MXN - Mexican Peso</SelectItem>
                  <SelectItem value="SGD">🇸🇬 SGD - Singapore Dollar</SelectItem>
                  <SelectItem value="HKD">🇭🇰 HKD - Hong Kong Dollar</SelectItem>
                  <SelectItem value="NOK">🇳🇴 NOK - Norwegian Krone</SelectItem>
                  <SelectItem value="KRW">🇰🇷 KRW - South Korean Won</SelectItem>
                  <SelectItem value="TRY">🇹🇷 TRY - Turkish Lira</SelectItem>
                  <SelectItem value="RUB">🇷🇺 RUB - Russian Ruble</SelectItem>
                  <SelectItem value="INR">🇮🇳 INR - Indian Rupee</SelectItem>
                  <SelectItem value="BRL">🇧🇷 BRL - Brazilian Real</SelectItem>
                  <SelectItem value="ZAR">🇿🇦 ZAR - South African Rand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Button
              onClick={() => {
                const temp = fromCurrency;
                setFromCurrency(toCurrency);
                setToCurrency(temp);
              }}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={convertCurrency}
              disabled={isConverting}
              className="w-full md:w-auto"
              size="lg"
            >
              {isConverting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Converting...
                </div>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Convert Currency
                </>
              )}
            </Button>
          </div>

          {conversionResult && (
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground">Conversion Result</div>
                  <div className="text-2xl font-bold text-green-600">
                    {currencyAmount} {fromCurrency} = {conversionResult}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Exchange rates provided by @fawazahmed0/currency-api
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">💡 Travel Budget Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Exchange rates fluctuate daily - check before your trip</li>
              <li>• Consider using cards with no foreign transaction fees</li>
              <li>• Keep some local currency for small vendors and tips</li>
              <li>• Airport exchanges often have higher fees than banks</li>
            </ul>
          </div>
        </CardContent>
      </Card>
      {/* User's Personal Hotels (Existing Bookings) */}
      {hotels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <Bed className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No hotels saved yet</h3>
              <p className="text-muted-foreground">
                Use the Add Hotel button to search for accommodations or record a confirmed stay manually.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={openSearchPanel}>
                <Search className="h-4 w-4 mr-2" />
                Open search
              </Button>
              <Button variant="outline" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Manual entry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{hotel.name}</CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {hotel.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1">
                      {getStarRating(hotel.rating || 5)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Check-in/out:</span>
                  <span className="font-medium">
                    {formatDateRange(String(hotel.checkInDate), String(hotel.checkOutDate))}
                  </span>
                </div>

                {hotel.roomType && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Room:</span>
                    <span className="font-medium">{hotel.roomType}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Guests:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {hotel.guests}
                  </span>
                </div>

                {hotel.totalPrice != null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Estimated Total:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(hotel.totalPrice, {
                          currency: hotel.currency ?? "USD",
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                      ⚠️ Estimates only - may differ from booking sites
                    </div>
                  </div>
                )}

                {hotel.pricePerNight != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Est. Per Night:</span>
                    <span className="font-medium">
                      {formatCurrency(hotel.pricePerNight, {
                        currency: hotel.currency ?? "USD",
                      })}
                    </span>
                  </div>
                )}

                {hotel.bookingPlatform && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Platform:</span>
                    <Badge variant="secondary">{hotel.bookingPlatform}</Badge>
                  </div>
                )}

                {hotel.amenities && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Amenities:</span>
                    <p className="text-xs text-muted-foreground mt-1">{String(hotel.amenities)}</p>
                  </div>
                )}

                {hotel.description && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="text-xs text-muted-foreground mt-1">{String(hotel.description)}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(hotel)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(hotel.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {hotel.bookingUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => hotel.bookingUrl && window.open(hotel.bookingUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Booking
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsDialogOpen(true);
          } else {
            handleDialogClose();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingHotel ? "Edit Hotel" : "Add Hotel"}
            </DialogTitle>
            <DialogDescription>
              Provide the hotel details exactly as defined in the booking schema. Fields marked with an asterisk (*) are required.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <HotelFormFields
                form={form}
                isSubmitting={createHotelMutation.isPending || updateHotelMutation.isPending}
                submitLabel={editingHotel ? "Save Changes" : "Add Hotel"}
                onCancel={handleDialogClose}
                showCancelButton
              />
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Booking Confirmation Modal */}
      <BookingConfirmationModal
        isOpen={showModal}
        onClose={closeModal}
        bookingType={bookingData?.type || 'hotel'}
        bookingData={bookingData?.data}
        tripId={tripId}
        onSuccess={() => {
          // Refetch hotels data
          queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
          // PROPOSALS FEATURE: reflect scheduled hotels in the proposals tab immediately.
          queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
        }}
      />
    </div>
  );
}
