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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, MapPin, Users, Star, Edit, Trash2, ExternalLink, Hotel, Plus, Bed, Search, Filter, ArrowLeft, Building, ChevronRight, DollarSign, Calculator, ArrowUpDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { insertHotelSchema, type InsertHotel, type HotelWithDetails, type TripWithDates, type HotelSearchResult, type HotelProposalWithDetails } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";

const formSchema = insertHotelSchema.extend({
  checkInDate: z.date(),
  checkOutDate: z.date(),
  amenities: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  images: z.string().optional().nullable(),
  policies: z.string().optional().nullable(),
});

type HotelFormValues = z.infer<typeof formSchema>;

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
  const [searchFilters, setSearchFilters] = useState({
    maxPrice: '',
    minRating: 'any',
    sortBy: 'price'
  });

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

  // Auto-search hotels and auto-populate when trip or user data is loaded
  useEffect(() => {
    if (!isSearching && searchResults.length === 0 && !searchLocation) {
      let locationToSet = null;

      // First priority: trip destination
      if (trip && trip.destination) {
        console.log('Auto-searching hotels for trip destination:', trip.destination);
        locationToSet = {
          name: trip.destination,
          iataCode: trip.destination.includes('(') ? 
            trip.destination.match(/\(([^)]+)\)/)?.[1] : null,
          type: 'CITY'
        };
      }
      // Second priority: user's default location when no trip destination
      else if (user && (!trip || !trip.destination) && (user.defaultCity || user.defaultLocation)) {
        const defaultLoc = user.defaultCity || user.defaultLocation;
        console.log('Auto-searching hotels for user default location:', defaultLoc);
        locationToSet = {
          name: defaultLoc,
          type: 'CITY'
        };
      }

      if (locationToSet) {
        setSearchLocation(locationToSet);
        searchHotels(locationToSet);
      }
    }
  }, [trip, user, isSearching, searchResults.length, searchLocation]);

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
      
      // Apply filters with error handling
      if (searchFilters.minRating && searchFilters.minRating !== 'any') {
        results = results.filter((hotel: any) => {
          const rating = parseFloat(hotel.rating) || 0;
          return rating >= parseFloat(searchFilters.minRating);
        });
      }
      
      if (searchFilters.maxPrice) {
        results = results.filter((hotel: any) => {
          try {
            // 🔧 INTEGRATION FIX: Use numeric pricePerNightValue instead of parsing formatted strings
            const pricePerNight = hotel.pricePerNightValue || 
              parseFloat(String(hotel.price || '0').replace(/[^0-9.]/g, '')) || 0;
            return pricePerNight <= parseFloat(searchFilters.maxPrice);
          } catch (e) {
            return true; // Include hotel if price parsing fails
          }
        });
      }
      
      // Apply sorting with error handling
      if (searchFilters.sortBy === 'price') {
        results.sort((a: any, b: any) => {
          try {
            // 🔧 INTEGRATION FIX: Use numeric pricePerNightValue for accurate sorting
            const priceA = a.pricePerNightValue || 
              parseFloat(String(a.price || '0').replace(/[^0-9.]/g, '')) || 0;
            const priceB = b.pricePerNightValue || 
              parseFloat(String(b.price || '0').replace(/[^0-9.]/g, '')) || 0;
            return priceA - priceB;
          } catch (e) {
            return 0;
          }
        });
      } else if (searchFilters.sortBy === 'rating') {
        results.sort((a: any, b: any) => {
          const ratingA = parseFloat(a.rating) || 0;
          const ratingB = parseFloat(b.rating) || 0;
          return ratingB - ratingA;
        });
      }
      
      setSearchResults(results);
      
      // Show appropriate toast based on data source
      if (source === "Amadeus API") {
        toast({
          title: "Live Hotel Data",
          description: `Found ${results.length} hotels with real-time pricing via Amadeus API`,
        });
      } else {
        toast({
          title: "Enhanced Database Hotels",
          description: `Found ${results.length} authentic hotels with market-based pricing`,
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

  const createDefaultFormValues = useCallback((): HotelFormValues => ({
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
    checkInDate: trip?.startDate ? new Date(trip.startDate) : new Date(),
    checkOutDate: trip?.endDate ? new Date(trip.endDate) : new Date(),
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
  }), [tripId, trip]);

  const parseJsonInput = (value?: string | null) => {
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

  const parseAmenitiesInput = (value?: string | null) => {
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

  const stringifyJsonValue = (value: unknown) => {
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

  const transformHotelFormValues = (values: HotelFormValues): InsertHotel => ({
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

  const form = useForm<HotelFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: createDefaultFormValues(),
  });

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setEditingHotel(null);
    form.reset(createDefaultFormValues());
  }, [createDefaultFormValues, form]);

  const openCreateDialog = useCallback(() => {
    setEditingHotel(null);
    form.reset(createDefaultFormValues());
    setIsDialogOpen(true);
  }, [createDefaultFormValues, form]);

  useEffect(() => {
    if (!isDialogOpen && !editingHotel) {
      form.reset(createDefaultFormValues());
    }
  }, [createDefaultFormValues, editingHotel, form, isDialogOpen]);

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
    const defaults = createDefaultFormValues();
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
          <Card className="border border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add hotel manually
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter every required field from the hotel schema to save a custom booking without using search results.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Required fields include hotelName, address, city, country, checkInDate, and checkOutDate.
              </p>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add hotel manually
              </Button>
            </CardContent>
          </Card>

          {/* Hotel Search Interface */}
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Search Location</Label>
                  <SmartLocationSearch
                    placeholder="Search destination city..."
                    value={searchLocation?.displayName || searchLocation?.name || ''}
                    onLocationSelect={(location) => {
                      setSearchLocation(location);
                      if (location) {
                        searchHotels(location);
                      }
                    }}
                  />
                  {trip?.destination && !searchLocation && (
                    <p className="text-xs text-gray-500 mt-1">
                      Trip destination: {trip.destination}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Search Filters</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Max price"
                      type="number"
                      value={searchFilters.maxPrice}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                    />
                    <Select 
                      value={searchFilters.minRating} 
                      onValueChange={(value) => setSearchFilters(prev => ({ ...prev, minRating: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Min rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any rating</SelectItem>
                        <SelectItem value="3">3+ stars</SelectItem>
                        <SelectItem value="4">4+ stars</SelectItem>
                        <SelectItem value="5">5 stars</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select 
                      value={searchFilters.sortBy} 
                      onValueChange={(value) => setSearchFilters(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <Button 
                  onClick={() => searchHotels()} 
                  disabled={isSearching}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {isSearching ? (
                    <div className="flex items-center gap-2">
                      <TravelLoading variant="luggage" size="sm" />
                      Searching...
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Search Hotels
                    </span>
                  )}
                </Button>
                
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hotelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          hotelName
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Grand Hotel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hotelChain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>hotelChain</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Hilton Worldwide"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          address
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          city
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          country
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>zipCode</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="10001"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="checkInDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-1">
                        checkInDate
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select date</span>
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
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checkOutDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-1">
                        checkOutDate
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select date</span>
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
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="totalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>totalPrice</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="299.00"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : parseFloat(event.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricePerNight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>pricePerNight</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="99.00"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : parseFloat(event.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        currency
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="AUD">AUD</SelectItem>
                          <SelectItem value="JPY">JPY</SelectItem>
                          <SelectItem value="MXN">MXN</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        status
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="confirmed">confirmed</SelectItem>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="cancelled">cancelled</SelectItem>
                          <SelectItem value="on-hold">on-hold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>guestCount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : parseInt(event.target.value, 10),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="roomCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>roomCount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : parseInt(event.target.value, 10),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="roomType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>roomType</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value)}
                        value={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select room type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="standard">standard</SelectItem>
                          <SelectItem value="deluxe">deluxe</SelectItem>
                          <SelectItem value="suite">suite</SelectItem>
                          <SelectItem value="penthouse">penthouse</SelectItem>
                          <SelectItem value="studio">studio</SelectItem>
                          <SelectItem value="apartment">apartment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hotelRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>hotelRating</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value, 10) : null)}
                        value={field.value != null ? field.value.toString() : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : parseFloat(event.target.value),
                            )
                          }
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
                      <FormLabel>longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : parseFloat(event.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bookingReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>bookingReference</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC123"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bookingSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>bookingSource</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Agent name or source"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bookingPlatform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>bookingPlatform</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="booking.com">booking.com</SelectItem>
                          <SelectItem value="expedia">expedia</SelectItem>
                          <SelectItem value="hotels.com">hotels.com</SelectItem>
                          <SelectItem value="airbnb">airbnb</SelectItem>
                          <SelectItem value="vrbo">vrbo</SelectItem>
                          <SelectItem value="direct">direct</SelectItem>
                          <SelectItem value="other">other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bookingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>bookingUrl</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://booking.com/..."
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>purchaseUrl</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://portal..."
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>contactInfo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Phone, email, or JSON"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cancellationPolicy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>cancellationPolicy</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Free cancellation until..."
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amenities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>amenities</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="WiFi, Pool, Gym"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional details about the hotel..."
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>images</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='["https://example.com/image.jpg"]'
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="policies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>policies</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"checkIn": "3pm", "checkOut": "11am"}'
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createHotelMutation.isPending || updateHotelMutation.isPending}>
                  {editingHotel ? "Update Hotel" : "Add Hotel"}
                </Button>
              </div>
            </form>
          </Form>
          </DialogContent>
        </Dialog>

      {/* Hotel Search Section */}
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Hotels in {trip?.destination}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                <Input
                  placeholder="Max Price ($)"
                  value={searchFilters.maxPrice}
                  onChange={(e) => setSearchFilters({ ...searchFilters, maxPrice: e.target.value })}
                />
                <Select
                  value={searchFilters.minRating}
                  onValueChange={(value) => setSearchFilters({ ...searchFilters, minRating: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Min Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Rating</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="4.5">4.5+ Stars</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={searchFilters.sortBy}
                  onValueChange={(value) => setSearchFilters({ ...searchFilters, sortBy: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price (Low to High)</SelectItem>
                    <SelectItem value="rating">Rating (High to Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={searchHotels} disabled={isSearching}>
                {isSearching ? "Searching..." : "Find Hotels"}
              </Button>
            </div>
            
            {trip && (
              <div className="text-sm text-muted-foreground">
                Searching for hotels in {trip.destination} from {format(new Date(trip.startDate), 'MMM d')} to {format(new Date(trip.endDate), 'MMM d')}
              </div>
            )}
          </CardContent>
        </Card>

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
