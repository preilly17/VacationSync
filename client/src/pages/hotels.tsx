import { useState, useEffect, useCallback } from "react";
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
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { MapPin, Users, Star, Edit, Trash2, ExternalLink, Hotel, Plus, Bed, Search, Filter, ArrowLeft, Building, ChevronRight, DollarSign, Calculator, ArrowUpDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { type InsertHotel, type HotelWithDetails, type TripWithDates, type HotelSearchResult, type HotelProposalWithDetails } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
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
  const [, setLocation] = useLocation();
  const tripId = parseInt(params.tripId as string);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelWithDetails | null>(null);
  const [searchResults, setSearchResults] = useState<HotelSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLocation, setSearchLocation] = useState<any>(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adultCount, setAdultCount] = useState('2');
  const [childCount, setChildCount] = useState('0');

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

  useEffect(() => {
    if (trip?.startDate) {
      setCheckInDate((prev) => prev || format(new Date(trip.startDate), 'yyyy-MM-dd'));
    }

    if (trip?.endDate) {
      setCheckOutDate((prev) => prev || format(new Date(trip.endDate), 'yyyy-MM-dd'));
    }
  }, [trip?.startDate, trip?.endDate]);


  // Function to get location data for hotel search
  const getLocationForSearch = (location: any): { coordinates?: [number, number]; cityName?: string; countryCode?: string } => {
    if (!location) return {};
    
    const result: { coordinates?: [number, number]; cityName?: string; countryCode?: string } = {};
    
    if (location.latitude && location.longitude) {
      result.coordinates = [location.latitude, location.longitude];
    }
    
    if (location.name) {
      result.cityName = location.name;
    }
    
    if (location.countryCode) {
      result.countryCode = location.countryCode;
    }
    
    return result;
  };

  // Function to get IATA city code from destination name (fallback)
  const getCityCode = (destination: string): string => {
    const cityMap: { [key: string]: string } = {
      'tokyo': 'TYO',
      'japan': 'TYO',
      'new york': 'NYC',
      'nyc': 'NYC',
      'london': 'LON',
      'paris': 'PAR',
      'los angeles': 'LAX',
      'las vegas': 'LAS',
      'miami': 'MIA',
      'chicago': 'CHI',
      'san francisco': 'SFO',
      'barcelona': 'BCN',
      'rome': 'ROM',
      'amsterdam': 'AMS',
      'berlin': 'BER',
      'dubai': 'DXB',
      'singapore': 'SIN',
      'hong kong': 'HKG',
      'sydney': 'SYD',
      'bangkok': 'BKK',
      'madrid': 'MAD',
      'lisbon': 'LIS',
      'vienna': 'VIE',
      'zagreb': 'ZAG',
      'croatia': 'ZAG',
      'split': 'SPU',
      'dubrovnik': 'DBV'
    };
    
    const key = destination.toLowerCase();
    for (const [city, code] of Object.entries(cityMap)) {
      if (key.includes(city)) {
        return code;
      }
    }
    return 'NYC'; // Default fallback
  };

  const getExternalDestination = () => {
    const locationName = searchLocation?.displayName || searchLocation?.name;
    if (locationName && locationName.trim()) {
      return locationName.trim();
    }

    if (trip?.destination?.trim()) {
      return trip.destination.trim();
    }

    return '';
  };

  const normalizeForAirbnb = (destination: string) => {
    if (!destination) return '';

    const cleaned = destination
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');

    const segments = cleaned
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) =>
        segment
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      );

    if (segments.length === 0) {
      return cleaned
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    return segments.join('--');
  };

  const normalizeForVrbo = (destination: string) => {
    if (!destination) return '';

    return destination
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  };

  const handleExternalSearch = (provider: 'airbnb' | 'vrbo' | 'expedia') => {
    const destination = getExternalDestination();
    const adults = parseInt(adultCount, 10);
    const children = childCount ? parseInt(childCount, 10) : 0;

    if (!destination) {
      toast({
        title: "Missing destination",
        description: "Please select or enter a destination before searching external sites.",
        variant: "destructive",
      });
      return;
    }

    if (!checkInDate || !checkOutDate) {
      toast({
        title: "Missing dates",
        description: "Please provide both check-in and check-out dates to search.",
        variant: "destructive",
      });
      return;
    }

    if (Number.isNaN(adults) || adults <= 0) {
      toast({
        title: "Invalid number of adults",
        description: "Please enter at least one adult traveler.",
        variant: "destructive",
      });
      return;
    }

    if (Number.isNaN(children) || children < 0) {
      toast({
        title: "Invalid number of children",
        description: "Children count cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(checkOutDate) < new Date(checkInDate)) {
      toast({
        title: "Date mismatch",
        description: "Check-out date must be after the check-in date.",
        variant: "destructive",
      });
      return;
    }

    const trimmedDestination = destination.trim();
    const childrenValue = Math.max(children, 0);
    let url = '';

    if (provider === 'airbnb') {
      const airbnbSlug = normalizeForAirbnb(trimmedDestination);
      const params = new URLSearchParams({
        checkin: checkInDate,
        checkout: checkOutDate,
        adults: adults.toString(),
        children: childrenValue.toString(),
      });
      const slug = airbnbSlug || normalizeForAirbnb(trimmedDestination.replace(/,/g, ' '));
      url = `https://www.airbnb.com/s/${slug || encodeURIComponent(trimmedDestination)}/homes?${params.toString()}`;
    }

    if (provider === 'vrbo') {
      const vrboSlug = normalizeForVrbo(trimmedDestination) || normalizeForVrbo(trimmedDestination.replace(/,/g, ' '));
      const params = new URLSearchParams({
        checkin: checkInDate,
        checkout: checkOutDate,
        adults: adults.toString(),
        children: childrenValue.toString(),
      });
      url = `https://www.vrbo.com/search/keywords:${vrboSlug || encodeURIComponent(trimmedDestination)}?${params.toString()}`;
    }

    if (provider === 'expedia') {
      const params = new URLSearchParams({
        destination: trimmedDestination,
        startDate: checkInDate,
        endDate: checkOutDate,
        adults: adults.toString(),
        children: childrenValue.toString(),
      });
      url = `https://www.expedia.com/Hotel-Search?${params.toString()}`;
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Hotel search function with location search integration
  const searchHotels = async (customLocation?: any) => {
    const locationToUse = customLocation || searchLocation;
    
    if (!locationToUse && (!trip || !trip.destination || !trip.startDate || !trip.endDate)) {
      toast({
        title: "Search Error",
        description: "Please select a location or ensure trip information is available.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const destination = locationToUse?.name || trip?.destination || '';
      
      console.log(`Searching hotels for destination: ${destination}`);

      const searchParams: any = {
        location: destination,
        adults: 2,
        radius: 20
      };

      // Use trip dates - required by backend
      if (trip?.startDate && trip?.endDate) {
        searchParams.checkInDate = format(new Date(trip.startDate), 'yyyy-MM-dd');
        searchParams.checkOutDate = format(new Date(trip.endDate), 'yyyy-MM-dd');
      } else {
        toast({
          title: "Search Error",
          description: "Trip dates are required for hotel search. Please set trip dates first.",
          variant: "destructive",
        });
        return;
      }

      const response = await apiFetch("/api/hotels/search", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Hotel search API error:", response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let results = await response.json();
      console.log("Hotel search response:", results);

      // Check if results is valid array
      if (!Array.isArray(results)) {
        console.error("Invalid results format:", results);
        throw new Error("Invalid response format from hotel search API");
      }

      const source = "Amadeus API";

      const parsePriceValue = (hotel: any) => {
        if (hotel.pricePerNightValue != null) {
          const value = Number(hotel.pricePerNightValue);
          return Number.isFinite(value) ? value : 0;
        }

        const rawPrice = String(hotel.price ?? "");
        const numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
        return Number.isFinite(numericPrice) ? numericPrice : 0;
      };

      const processedResults = [...results].sort((a: any, b: any) => {
        try {
          return parsePriceValue(a) - parsePriceValue(b);
        } catch (error) {
          return 0;
        }
      });

      setSearchResults(processedResults);

      // Show appropriate toast based on data source
      if (source === "Amadeus API") {
        toast({
          title: "Live Hotel Data",
          description: `Found ${processedResults.length} hotels with real-time pricing via Amadeus API`,
        });
      } else {
        toast({
          title: "Enhanced Database Hotels",
          description: `Found ${processedResults.length} authentic hotels with market-based pricing`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Hotel search error:", error);
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Authentication Required",
          description: "Please refresh the page to continue searching hotels.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Search Error",
        description: "Unable to search hotels. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Generate sample hotels for testing
  const generateSampleHotels = (destination: string) => {
    const destLower = destination.toLowerCase();
    
    if (destLower.includes('tokyo') || destLower.includes('japan')) {
      const baseDate = trip?.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const endDate = trip?.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      return [
        {
          id: 'sample-1',
          name: 'Park Hyatt Tokyo',
          rating: 4.8,
          price: '$450',
          pricePerNight: '$450',
          location: 'Shinjuku, Tokyo',
          amenities: 'Spa, Pool, Fine Dining, City Views',
          platform: 'Amadeus',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`
        },
        {
          id: 'sample-2', 
          name: 'The Ritz-Carlton Tokyo',
          rating: 4.7,
          price: '$380',
          pricePerNight: '$380',
          location: 'Roppongi, Tokyo',
          amenities: 'Spa, Multiple Restaurants, Club Access',
          platform: 'Booking.com',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`
        },
        {
          id: 'sample-3',
          name: 'Aman Tokyo',
          rating: 4.9,
          price: '$520',
          pricePerNight: '$520',
          location: 'Otemachi, Tokyo',
          amenities: 'Spa, Traditional Design, Gardens',
          platform: 'Amadeus',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`
        },
        {
          id: 'sample-4',
          name: 'Andaz Tokyo Toranomon Hills',
          rating: 4.6,
          price: '$290',
          pricePerNight: '$290',
          location: 'Toranomon, Tokyo',
          amenities: 'Modern Design, Rooftop Bar, City Views',
          platform: 'Hotels.com',
          bookingUrl: `https://www.hotels.com/search.do?q-destination=tokyo&q-check-in=${baseDate}&q-check-out=${endDate}`
        },
        {
          id: 'sample-5',
          name: 'Conrad Tokyo',
          rating: 4.5,
          price: '$310',
          pricePerNight: '$310',
          location: 'Shiodome, Tokyo',
          amenities: 'Bay Views, Spa, Modern Luxury',
          platform: 'Expedia',
          bookingUrl: `https://www.expedia.com/Hotel-Search?destination=Tokyo&startDate=${baseDate}&endDate=${endDate}`
        },
        {
          id: 'sample-6',
          name: 'Grand Hyatt Tokyo',
          rating: 4.4,
          price: '$270',
          pricePerNight: '$270',
          location: 'Roppongi Hills, Tokyo',
          amenities: 'Multiple Restaurants, Spa, Shopping Access',
          platform: 'Hyatt',
          bookingUrl: `https://www.hyatt.com/en-US/hotel/japan/grand-hyatt-tokyo/tyogh`
        },
        {
          id: 'sample-7',
          name: 'Hotel Okura Tokyo',
          rating: 4.7,
          price: '$340',
          pricePerNight: '$340',
          location: 'Toranomon, Tokyo',
          amenities: 'Traditional Japanese, Gardens, Fine Dining',
          platform: 'Booking.com',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`
        },
        {
          id: 'sample-8',
          name: 'The Peninsula Tokyo',
          rating: 4.8,
          price: '$390',
          pricePerNight: '$390',
          location: 'Marunouchi, Tokyo',
          amenities: 'Luxury, Ginza Views, Premium Service',
          platform: 'Peninsula',
          bookingUrl: `https://www.peninsula.com/en/tokyo/5-star-luxury-hotel-ginza`
        },
        {
          id: 'sample-9',
          name: 'Hotel Gracery Shinjuku',
          rating: 4.2,
          price: '$140',
          pricePerNight: '$140',
          location: 'Shinjuku, Tokyo',
          amenities: 'Godzilla Theme, Entertainment District, Modern',
          platform: 'Booking.com',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`
        },
        {
          id: 'sample-10',
          name: 'Cerulean Tower Tokyu Hotel',
          rating: 4.1,
          price: '$180',
          pricePerNight: '$180',
          location: 'Shibuya, Tokyo',
          amenities: 'High Floors, City Views, Shopping Access',
          platform: 'Hotels.com',
          bookingUrl: `https://www.hotels.com/search.do?q-destination=tokyo&q-check-in=${baseDate}&q-check-out=${endDate}`
        },
        {
          id: 'sample-11',
          name: 'Richmond Hotel Tokyo Suidobashi',
          rating: 4.0,
          price: '$90',
          pricePerNight: '$90',
          location: 'Tokyo Dome Area',
          amenities: 'Budget-Friendly, Clean Rooms, Convenient Location',
          platform: 'Agoda',
          bookingUrl: `https://www.agoda.com/city/tokyo-jp.html?cid=-218`
        },
        {
          id: 'sample-12',
          name: 'Keio Plaza Hotel Tokyo',
          rating: 4.0,
          price: '$150',
          pricePerNight: '$150',
          location: 'Shinjuku, Tokyo',
          amenities: 'Large Hotel, Multiple Facilities, Central Location',
          platform: 'Booking.com',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`
        }
      ];
    }
    
    return [
      {
        id: 'sample-generic-1',
        name: `Grand Hotel ${destination}`,
        rating: 4.2,
        price: '$220',
        pricePerNight: '$220',
        location: destination,
        amenities: 'WiFi, Restaurant, Fitness Center',
        platform: 'Amadeus',
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`
      },
      {
        id: 'sample-generic-2',
        name: `City Inn ${destination}`,
        rating: 4.0,
        price: '$150',
        pricePerNight: '$150',
        location: destination,
        amenities: 'WiFi, Breakfast, Central Location',
        platform: 'Booking.com',
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`
      }
    ];
  };

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
      
      // Refresh hotel proposals
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "hotel-proposals"] });
      
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
      await apiRequest(`/api/hotel-proposals/${proposalId}/rankings`, {
        method: "POST",
        body: JSON.stringify({ ranking, notes }),
      });
      
      toast({
        title: "Ranking Submitted!",
        description: "Your hotel preference has been recorded.",
      });
      
      // Refresh proposals
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "hotel-proposals"] });
      
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "hotels"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "hotels"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "hotels"] });
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

      <div className="flex items-center justify-between">
        <div>
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
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={searchHotels} 
            disabled={isSearching}
          >
            <Search className="h-4 w-4 mr-2" />
            {isSearching ? (
              <div className="flex items-center gap-2">
                <TravelLoading variant="globe" size="sm" />
                Searching...
              </div>
            ) : (
              'Refresh Hotels'
            )}
          </Button>
        </div>
      </div>

      {/* Tabs for Search vs Group Voting vs Currency Converter */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search & Propose Hotels</TabsTrigger>
          <TabsTrigger value="voting" className="relative">
            Group Voting
            {hotelProposals.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {hotelProposals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="currency">Currency Converter</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6 mt-6">
          {/* Hotel Search Interface */}
          <Card>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="space-y-2 md:col-span-2 xl:col-span-2">
                  <Label>Destination</Label>
                  <SmartLocationSearch
                    placeholder="Search destination city..."
                    value={searchLocation?.displayName || searchLocation?.name || ''}
                    onLocationSelect={(location) => {
                      setSearchLocation(location);
                    }}
                  />
                  {trip?.destination && !searchLocation && (
                    <p className="text-xs text-gray-500 mt-1">
                      Trip destination: {trip.destination}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hotel-check-in">Check-in</Label>
                  <Input
                    id="hotel-check-in"
                    type="date"
                    value={checkInDate}
                    onChange={(event) => setCheckInDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel-check-out">Check-out</Label>
                  <Input
                    id="hotel-check-out"
                    type="date"
                    value={checkOutDate}
                    onChange={(event) => setCheckOutDate(event.target.value)}
                    min={checkInDate || undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel-adults">Adults</Label>
                  <Input
                    id="hotel-adults"
                    type="number"
                    min={1}
                    value={adultCount}
                    onChange={(event) => setAdultCount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel-children">Children</Label>
                  <Input
                    id="hotel-children"
                    type="number"
                    min={0}
                    value={childCount}
                    onChange={(event) => setChildCount(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => handleExternalSearch('airbnb')}
                  className="bg-[#FF5A5F] hover:bg-[#e24e52] text-white shadow-sm"
                >
                  Search Airbnb
                </Button>
                <Button
                  type="button"
                  onClick={() => handleExternalSearch('vrbo')}
                  className="bg-[#0A4385] hover:bg-[#08376b] text-white shadow-sm"
                >
                  Search VRBO
                </Button>
                <Button
                  type="button"
                  onClick={() => handleExternalSearch('expedia')}
                  className="bg-[#FEC601] hover:bg-[#e0b000] text-gray-900 shadow-sm"
                >
                  Search Expedia
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Found {searchResults.length} hotels
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Add Hotel Dialog */}
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

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card className="mt-6 sky-pattern">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Hotel className="h-5 w-5" />
                  Available Hotels ({searchResults.length})
                  {searchResults.length > 0 && hotelProposals.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({searchResults.length} found + {hotelProposals.length} group)
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hotels for {trip?.destination} • {trip && format(new Date(trip.startDate), 'MMM d')} - {trip && format(new Date(trip.endDate), 'MMM d')}
                </p>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Hotel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {searchResults.map((hotel, index) => (
                <Card key={hotel.id || index} className={`relative overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 ${hotel.isGroupProposal ? 'border-blue-200 bg-blue-50/30' : 'hotel-card-gradient border-0'} airplane-pattern`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-blue-600 airplane-animate" />
                            <CardTitle className="text-xl font-semibold text-gray-800">{hotel.name}</CardTitle>
                          </div>
                          {hotel.isGroupProposal && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                              <Users className="w-3 h-3 mr-1" />
                              Group
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                          <MapPin className="h-4 w-4" />
                          {hotel.location}
                        </p>
                        {hotel.isGroupProposal && hotel.proposedBy && (
                          <p className="text-xs text-blue-600 mt-1">
                            Proposed by {hotel.proposedBy.firstName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-md">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{hotel.rating}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-muted-foreground">Estimated Total:</span>
                        </div>
                        <span className="text-lg font-bold text-green-600">{hotel.price}</span>
                      </div>
                      {hotel.pricePerNight && hotel.pricePerNight !== hotel.price && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground ml-6">Est. Per Night:</span>
                          <span className="text-sm font-medium text-green-600">{hotel.pricePerNight}</span>
                        </div>
                      )}
                      <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 mt-2">
                        ⚠️ Estimates only - actual prices may differ significantly on booking sites
                      </div>
                    </div>
                    
                    {hotel.amenities && (
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Amenities:</span>
                        <p className="text-sm text-gray-600 leading-relaxed">{hotel.amenities}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          hotel.platform === 'Amadeus' 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}
                      >
                        {hotel.platform === 'Amadeus' ? '🔴 Live API Data' : '📊 Enhanced Database'}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          storeBookingIntent('hotel', {
                            name: hotel.name,
                            location: hotel.location,
                            price: hotel.price,
                            rating: hotel.rating,
                            description: hotel.description,
                            startDate: trip?.startDate,
                            endDate: trip?.endDate,
                          }, tripId);
                          // Use the first available booking link, or fallback to a search
                          const bookingUrl =
                            hotel.bookingUrl ||
                            `https://www.booking.com/search.html?ss=${encodeURIComponent(hotel.name)}`;
                          window.open(bookingUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex-1 hover:bg-blue-50"
                      >
                        <Bed className="h-4 w-4 mr-2" />
                        Book Now
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => shareHotelWithGroup(hotel)}
                        className="flex-1"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Propose to Group
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group Hotel Proposals */}
      {hotelProposals.length > 0 && (
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
                    
                    {/* Ranking Interface */}
                    <div className="space-y-3 border-t pt-3">
                      <span className="text-sm font-medium">Rank this hotel:</span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rank) => (
                          <Button
                            key={rank}
                            size="sm"
                            variant={proposal.currentUserRanking?.ranking === rank ? "default" : "outline"}
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
                    
                    {/* Show other members' rankings */}
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
      )}
        </TabsContent>

        <TabsContent value="voting" className="space-y-6 mt-6">
          {/* Group Hotel Proposals */}
          {hotelProposals.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Group Hotel Proposals ({hotelProposals.length})
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
                            <CardTitle className="text-lg font-semibold">{proposal.hotelName}</CardTitle>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-4 w-4" />
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
                        
                        {/* Ranking Interface */}
                        <div className="space-y-3 border-t pt-3">
                          <span className="text-sm font-medium">Rank this hotel:</span>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rank) => (
                              <Button
                                key={rank}
                                size="sm"
                                variant={proposal.currentUserRanking?.ranking === rank ? "default" : "outline"}
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
                        
                        {/* Show other members' rankings */}
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
                  Search for hotels and propose them to your group to start the voting process.
                </p>
                <Button onClick={searchHotels} variant="outline" disabled={isSearching}>
                  <Search className="h-4 w-4 mr-2" />
                  {isSearching ? "Searching..." : "Search Hotels"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="currency" className="space-y-6 mt-6">
          {/* Currency Converter */}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100"
                    value={currencyAmount}
                    onChange={(e) => setCurrencyAmount(e.target.value)}
                    className="text-lg"
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
        </TabsContent>
      </Tabs>

      {/* User's Personal Hotels (Existing Bookings) */}
      {hotels.length === 0 && searchResults.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bed className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hotels yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Search for hotels to share with your group or add your own bookings to track accommodations for your trip.
            </p>
          </CardContent>
        </Card>
      ) : hotels.length > 0 && (
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

      {/* Booking Confirmation Modal */}
      <BookingConfirmationModal
        isOpen={showModal}
        onClose={closeModal}
        bookingType={bookingData?.type || 'hotel'}
        bookingData={bookingData?.data}
        tripId={tripId}
        onSuccess={() => {
          // Refetch hotels data
          queryClient.invalidateQueries({ queryKey: ['/api/trips', tripId, 'hotels'] });
        }}
      />
    </div>
  );
}
