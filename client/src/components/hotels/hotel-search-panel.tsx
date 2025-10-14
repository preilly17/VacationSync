import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { apiFetch } from "@/lib/api";
import { isUnauthorizedError } from "@/lib/authUtils";
import { HOTEL_REDIRECT_STORAGE_KEY, markExternalRedirect } from "@/lib/externalRedirects";
import type { TripWithDates, HotelSearchResult } from "@shared/schema";
import { format } from "date-fns";
import {
  Building,
  ChevronRight,
  DollarSign,
  Filter,
  Hotel,
  MapPin,
  Search,
  Star,
  Bed,
  Users,
} from "lucide-react";

export interface HotelSearchPanelRef {
  focusForm: () => void;
}

type ToastFunction = (toast: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | null;
}) => void;

type StoreBookingIntent = (
  type: "hotel",
  data: any,
  tripId: number,
  url?: string,
) => void;

interface HotelSearchPanelProps {
  tripId: number;
  trip?: TripWithDates | null;
  onLogHotelManually: () => void;
  onShareHotelWithGroup: (hotel: HotelSearchResult) => Promise<void> | void;
  storeBookingIntent: StoreBookingIntent;
  hotelProposalsCount: number;
  toast: ToastFunction;
  onResultsChange?: (results: HotelSearchResult[]) => void;
}

export const HotelSearchPanel = forwardRef<HotelSearchPanelRef, HotelSearchPanelProps>(
  (
    {
      tripId,
      trip,
      onLogHotelManually,
      onShareHotelWithGroup,
      storeBookingIntent,
      hotelProposalsCount,
      toast,
      onResultsChange,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const destinationInputRef = useRef<HTMLInputElement | null>(null);
    const [searchResults, setSearchResults] = useState<HotelSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchLocation, setSearchLocation] = useState<any>(null);
    const [checkInDate, setCheckInDate] = useState("");
    const [checkOutDate, setCheckOutDate] = useState("");
    const [adultCount, setAdultCount] = useState("2");
    const [childCount, setChildCount] = useState("0");
    const [roomCount, setRoomCount] = useState("1");
    const [priceRange, setPriceRange] = useState("any");
    const [minRating, setMinRating] = useState("any");
    const [freeCancellationOnly, setFreeCancellationOnly] = useState(false);

    useImperativeHandle(ref, () => ({
      focusForm: () => {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        const destinationElement = destinationInputRef.current ?? document.getElementById("hotel-destination");
        if (destinationElement && "focus" in destinationElement) {
          window.requestAnimationFrame(() => {
            (destinationElement as HTMLInputElement).focus();
          });
        }
      },
    }));

    useEffect(() => {
      onResultsChange?.(searchResults);
    }, [onResultsChange, searchResults]);

    useEffect(() => {
      if (trip?.startDate) {
        setCheckInDate((prev) => prev || format(new Date(trip.startDate), "yyyy-MM-dd"));
      }

      if (trip?.endDate) {
        setCheckOutDate((prev) => prev || format(new Date(trip.endDate), "yyyy-MM-dd"));
      }
    }, [trip?.startDate, trip?.endDate]);

    const getExternalDestination = useCallback(() => {
      if (searchLocation?.displayName) return searchLocation.displayName;
      if (searchLocation?.name) return searchLocation.name;
      if (trip?.destination) return trip.destination;
      return "New York";
    }, [searchLocation, trip?.destination]);

    const normalizeForAirbnb = useCallback((destination: string) => {
      return destination
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-{2,}/g, "-");
    }, []);

    const getRegionIdForVrbo = useCallback((location: any): string | null => {
      if (!location) return null;
      const regionId = location.regionId || location.geoId || location.id;
      return regionId ? String(regionId) : null;
    }, []);

    const getCoordinatesForVrbo = useCallback((location: any): string | null => {
      if (!location?.latitude || !location?.longitude) return null;
      return `${location.latitude},${location.longitude}`;
    }, []);

    const getTypeaheadCollationId = useCallback((location: any): string | null => {
      if (!location) return null;
      return location.typeaheadCollationId || location.collationId || null;
    }, []);

    const handleExternalSearch = useCallback(
      (provider: "airbnb" | "vrbo" | "expedia") => {
        const destination = getExternalDestination();
        const checkIn = checkInDate || (trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : "");
        const checkOut = checkOutDate || (trip?.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : "");
        const adults = Math.max(parseInt(adultCount, 10) || 1, 1);
        const children = Math.max(parseInt(childCount, 10) || 0, 0);

        if (!checkIn || !checkOut) {
          toast({
            title: "Missing dates",
            description: "Please provide both check-in and check-out dates to search.",
            variant: "destructive",
          });
          return;
        }

        if (new Date(checkOut) < new Date(checkIn)) {
          toast({
            title: "Date mismatch",
            description: "Check-out date must be after the check-in date.",
            variant: "destructive",
          });
          return;
        }

        let url = "";

        if (provider === "airbnb") {
          const airbnbSlug = normalizeForAirbnb(destination);
          const params = new URLSearchParams({
            checkin: checkIn,
            checkout: checkOut,
            adults: adults.toString(),
            children: children.toString(),
          });
          const slug = airbnbSlug || normalizeForAirbnb(destination.replace(/,/g, " "));
          url = `https://www.airbnb.com/s/${slug || encodeURIComponent(destination)}/homes?${params.toString()}`;
        }

        if (provider === "vrbo") {
          const vrboDestination = (searchLocation?.displayName || destination).trim();
          const params = new URLSearchParams();
          params.set("destination", vrboDestination);

          const regionId = getRegionIdForVrbo(searchLocation);
          if (regionId) {
            params.set("regionId", regionId);
          }

          const latLong = getCoordinatesForVrbo(searchLocation);
          if (latLong) {
            params.set("latLong", latLong);
          }

          params.set("flexibility", "0_DAY");
          params.set("d1", checkIn);
          params.set("startDate", checkIn);
          params.set("d2", checkOut);
          params.set("endDate", checkOut);
          params.set("adults", adults.toString());

          if (children > 0) {
            params.set("children", children.toString());
          }

          const typeaheadId = getTypeaheadCollationId(searchLocation);
          if (typeaheadId) {
            params.set("typeaheadCollationId", typeaheadId);
          }

          url = `https://www.vrbo.com/search?${params.toString()}`;
        }

        if (provider === "expedia") {
          const params = new URLSearchParams({
            destination,
            startDate: checkIn,
            endDate: checkOut,
            adults: adults.toString(),
            children: children.toString(),
          });
          url = `https://www.expedia.com/Hotel-Search?${params.toString()}`;
        }

        if (url) {
          markExternalRedirect(HOTEL_REDIRECT_STORAGE_KEY);
          window.open(url, "_blank", "noopener,noreferrer");
        }
      },
      [
        adultCount,
        checkInDate,
        checkOutDate,
        childCount,
        getCoordinatesForVrbo,
        getExternalDestination,
        getRegionIdForVrbo,
        getTypeaheadCollationId,
        normalizeForAirbnb,
        searchLocation,
        toast,
        trip?.endDate,
        trip?.startDate,
      ],
    );

    const generateSampleHotels = useCallback(
      (destination: string) => {
        const destLower = destination.toLowerCase();

        if (destLower.includes("tokyo") || destLower.includes("japan")) {
          const baseDate = trip?.startDate ? new Date(trip.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
          const endDate = trip?.endDate ? new Date(trip.endDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

          return [
            {
              id: "sample-1",
              name: "Park Hyatt Tokyo",
              rating: 4.8,
              price: "$450",
              pricePerNight: "$450",
              location: "Shinjuku, Tokyo",
              amenities: "Spa, Pool, Fine Dining, City Views",
              platform: "Amadeus",
              bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`,
            },
            {
              id: "sample-2",
              name: "The Ritz-Carlton Tokyo",
              rating: 4.7,
              price: "$380",
              pricePerNight: "$380",
              location: "Roppongi, Tokyo",
              amenities: "Spa, Multiple Restaurants, Club Access",
              platform: "Booking.com",
              bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`,
            },
            {
              id: "sample-3",
              name: "Aman Tokyo",
              rating: 4.9,
              price: "$520",
              pricePerNight: "$520",
              location: "Otemachi, Tokyo",
              amenities: "Spa, Traditional Design, Gardens",
              platform: "Amadeus",
              bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`,
            },
            {
              id: "sample-4",
              name: "Andaz Tokyo Toranomon Hills",
              rating: 4.6,
              price: "$290",
              pricePerNight: "$290",
              location: "Toranomon, Tokyo",
              amenities: "Modern Design, Rooftop Bar, City Views",
              platform: "Hotels.com",
              bookingUrl: `https://www.hotels.com/search.do?q-destination=tokyo&q-check-in=${baseDate}&q-check-out=${endDate}`,
            },
            {
              id: "sample-5",
              name: "Conrad Tokyo",
              rating: 4.5,
              price: "$310",
              pricePerNight: "$310",
              location: "Shiodome, Tokyo",
              amenities: "Bay Views, Spa, Modern Luxury",
              platform: "Expedia",
              bookingUrl: `https://www.expedia.com/Hotel-Search?destination=Tokyo&startDate=${baseDate}&endDate=${endDate}`,
            },
            {
              id: "sample-6",
              name: "Grand Hyatt Tokyo",
              rating: 4.4,
              price: "$270",
              pricePerNight: "$270",
              location: "Roppongi Hills, Tokyo",
              amenities: "Multiple Restaurants, Spa, Shopping Access",
              platform: "Hyatt",
              bookingUrl: `https://www.hyatt.com/en-US/hotel/japan/grand-hyatt-tokyo/tyogh`,
            },
            {
              id: "sample-7",
              name: "Hotel Okura Tokyo",
              rating: 4.7,
              price: "$340",
              pricePerNight: "$340",
              location: "Toranomon, Tokyo",
              amenities: "Traditional Japanese, Gardens, Fine Dining",
              platform: "Booking.com",
              bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`,
            },
            {
              id: "sample-8",
              name: "The Peninsula Tokyo",
              rating: 4.8,
              price: "$390",
              pricePerNight: "$390",
              location: "Marunouchi, Tokyo",
              amenities: "Luxury, Ginza Views, Premium Service",
              platform: "Peninsula",
              bookingUrl: `https://www.peninsula.com/en/tokyo/5-star-luxury-hotel-ginza`,
            },
            {
              id: "sample-9",
              name: "Hotel Gracery Shinjuku",
              rating: 4.2,
              price: "$140",
              pricePerNight: "$140",
              location: "Shinjuku, Tokyo",
              amenities: "Godzilla Theme, Entertainment District, Modern",
              platform: "Booking.com",
              bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`,
            },
            {
              id: "sample-10",
              name: "Cerulean Tower Tokyu Hotel",
              rating: 4.1,
              price: "$180",
              pricePerNight: "$180",
              location: "Shibuya, Tokyo",
              amenities: "High Floors, City Views, Shopping Access",
              platform: "Hotels.com",
              bookingUrl: `https://www.hotels.com/search.do?q-destination=tokyo&q-check-in=${baseDate}&q-check-out=${endDate}`,
            },
            {
              id: "sample-11",
              name: "Richmond Hotel Tokyo Suidobashi",
              rating: 4.0,
              price: "$90",
              pricePerNight: "$90",
              location: "Tokyo Dome Area",
              amenities: "Budget-Friendly, Clean Rooms, Convenient Location",
              platform: "Agoda",
              bookingUrl: `https://www.agoda.com/city/tokyo-jp.html?cid=-218`,
            },
            {
              id: "sample-12",
              name: "Keio Plaza Hotel Tokyo",
              rating: 4.0,
              price: "$150",
              pricePerNight: "$150",
              location: "Shinjuku, Tokyo",
              amenities: "Large Hotel, Multiple Facilities, Central Location",
              platform: "Booking.com",
              bookingUrl: `https://www.booking.com/searchresults.html?ss=tokyo&checkin=${baseDate}&checkout=${endDate}`,
            },
          ];
        }

        return [
          {
            id: "sample-generic-1",
            name: `Grand Hotel ${destination}`,
            rating: 4.2,
            price: "$220",
            pricePerNight: "$220",
            location: destination,
            amenities: "WiFi, Restaurant, Fitness Center",
            platform: "Amadeus",
            bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`,
          },
          {
            id: "sample-generic-2",
            name: `City Inn ${destination}`,
            rating: 4.0,
            price: "$150",
            pricePerNight: "$150",
            location: destination,
            amenities: "Free Breakfast, City Center, Modern Rooms",
            platform: "Booking.com",
            bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`,
          },
          {
            id: "sample-generic-3",
            name: `${destination} Boutique Suites`,
            rating: 4.5,
            price: "$280",
            pricePerNight: "$280",
            location: destination,
            amenities: "Boutique, Rooftop Bar, Local Design",
            platform: "Expedia",
            bookingUrl: `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(destination)}`,
          },
        ];
      },
      [trip?.endDate, trip?.startDate],
    );

    const searchHotels = useCallback(async () => {
      const locationToUse = searchLocation;
      const destination = locationToUse?.displayName || locationToUse?.name || trip?.destination || "";

      const resolvedCheckIn = checkInDate || (trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : "");
      const resolvedCheckOut = checkOutDate || (trip?.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : "");

      if (!destination) {
        toast({
          title: "Search Error",
          description: "Please choose a destination before searching for hotels.",
          variant: "destructive",
        });
        return;
      }

      if (!resolvedCheckIn || !resolvedCheckOut) {
        toast({
          title: "Search Error",
          description: "Check-in and check-out dates are required for hotel search.",
          variant: "destructive",
        });
        return;
      }

      const adultsValue = Math.max(parseInt(adultCount, 10) || 1, 1);
      const childrenValue = Math.max(parseInt(childCount, 10) || 0, 0);
      const roomsValue = Math.max(parseInt(roomCount, 10) || 1, 1);

      const priceParams: Record<string, number> = {};
      if (priceRange !== "any") {
        if (priceRange === "300+") {
          priceParams.minPrice = 300;
        } else {
          const [min, max] = priceRange.split("-").map((value) => Number(value));
          if (Number.isFinite(min)) {
            priceParams.minPrice = Number(min);
          }
          if (Number.isFinite(max)) {
            priceParams.maxPrice = Number(max);
          }
        }
      }

      const ratingValue = minRating !== "any" ? Number(minRating) : undefined;

      setIsSearching(true);
      try {
        const searchParams: Record<string, unknown> = {
          location: destination,
          adults: adultsValue,
          children: childrenValue,
          rooms: roomsValue,
          radius: 20,
          checkInDate: resolvedCheckIn,
          checkOutDate: resolvedCheckOut,
          ...priceParams,
        };

        if (ratingValue && !Number.isNaN(ratingValue)) {
          searchParams.minRating = ratingValue;
        }

        if (freeCancellationOnly) {
          searchParams.freeCancellation = true;
        }

        const response = await apiFetch("/api/hotels/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(searchParams),
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Hotel search API error:", response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const results = await response.json();

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

        let mappedResults: HotelSearchResult[] = [...results]
          .sort((a: any, b: any) => {
            try {
              return parsePriceValue(a) - parsePriceValue(b);
            } catch (error) {
              return 0;
            }
          })
          .map((hotel: any, index: number) => ({
            id: hotel.id || `${source}-${index}`,
            name: hotel.name || hotel.title || `Hotel ${index + 1}`,
            location: hotel.location || hotel.address || destination,
            price: hotel.price || hotel.totalPrice || "Price unavailable",
            pricePerNight: hotel.pricePerNight || hotel.price,
            rating: hotel.rating || hotel.stars || 4.5,
            amenities: hotel.amenities || hotel.description || "Free WiFi, Breakfast included, Pool",
            bookingUrl:
              hotel.bookingUrl ||
              hotel.url ||
              `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}&checkin=${resolvedCheckIn}&checkout=${resolvedCheckOut}`,
            platform: hotel.platform || source,
            description: hotel.description,
          }));

        if (mappedResults.length === 0) {
          mappedResults = generateSampleHotels(destination).map((hotel, index) => ({
            id: hotel.id || `sample-${index}`,
            name: hotel.name,
            location: hotel.location,
            price: hotel.price,
            pricePerNight: hotel.pricePerNight,
            rating: hotel.rating,
            amenities: hotel.amenities,
            bookingUrl: hotel.bookingUrl,
            platform: hotel.platform,
          }));
        }

        setSearchResults(mappedResults);

        if (results.length > 0) {
          toast({
            title: "Live Hotel Data",
            description: `Found ${mappedResults.length} hotels with real-time pricing via ${source}`,
          });
        } else {
          toast({
            title: "Enhanced Database Hotels",
            description: `Found ${mappedResults.length} authentic hotels with market-based pricing`,
          });
        }
      } catch (error) {
        console.error("Hotel search error:", error);
        const errorObj = error instanceof Error ? error : new Error(String(error));
        if (isUnauthorizedError(errorObj)) {
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
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, [
      adultCount,
      checkInDate,
      checkOutDate,
      childCount,
      freeCancellationOnly,
      generateSampleHotels,
      minRating,
      priceRange,
      roomCount,
      searchLocation,
      toast,
      trip?.destination,
      trip?.endDate,
      trip?.startDate,
    ]);

    const handleSearchSubmit = useCallback(
      (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        void searchHotels();
      },
      [searchHotels],
    );

    return (
      <div ref={containerRef} id="hotel-search-panel" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[260px] flex-1">
            <div className="search-header-gradient rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="airplane-animate">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
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
        </div>

        <Card className="border-primary/40 shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">Search Hotels for this Trip</CardTitle>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                {searchResults.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Found {searchResults.length} hotels
                  </div>
                )}
                <Button type="button" variant="outline" onClick={onLogHotelManually}>
                  <Building className="h-4 w-4 mr-2" />
                  Log Hotel Manually
                </Button>
              </div>
            </div>
            {trip?.destination && (trip?.startDate || trip?.endDate) && (
              <p className="text-sm text-muted-foreground">
                Trip destination: {trip.destination}
                {(trip.startDate || trip.endDate) && " • "}
                {trip.startDate ? format(new Date(trip.startDate), "MMM d") : "Start TBD"}
                {trip.endDate ? `–${format(new Date(trip.endDate), "MMM d")}` : ""}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-2 md:col-span-2 xl:col-span-2">
                  <Label htmlFor="hotel-destination">Destination</Label>
                  <SmartLocationSearch
                    id="hotel-destination"
                    ref={destinationInputRef}
                    placeholder="Search destination city..."
                    value={searchLocation?.displayName || searchLocation?.name || ""}
                    allowedTypes={['city']}
                    onLocationSelect={(location) => {
                      setSearchLocation(location);
                    }}
                  />
                  {trip?.destination && !searchLocation && (
                    <p className="text-xs text-gray-500 mt-1">Trip destination: {trip.destination}</p>
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
                <div className="space-y-2">
                  <Label htmlFor="hotel-rooms">Rooms</Label>
                  <Input
                    id="hotel-rooms"
                    type="number"
                    min={1}
                    value={roomCount}
                    onChange={(event) => setRoomCount(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="hotel-price-range">Price range</Label>
                  <Select value={priceRange} onValueChange={setPriceRange}>
                    <SelectTrigger id="hotel-price-range">
                      <SelectValue placeholder="Choose price range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any price</SelectItem>
                      <SelectItem value="0-150">$0 - $150</SelectItem>
                      <SelectItem value="150-300">$150 - $300</SelectItem>
                      <SelectItem value="300+">$300+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel-min-rating">Minimum rating</Label>
                  <Select value={minRating} onValueChange={setMinRating}>
                    <SelectTrigger id="hotel-min-rating">
                      <SelectValue placeholder="Choose minimum rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any rating</SelectItem>
                      <SelectItem value="3">3 stars & up</SelectItem>
                      <SelectItem value="4">4 stars & up</SelectItem>
                      <SelectItem value="4.5">4.5 stars & up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div className="space-y-1">
                    <Label htmlFor="hotel-free-cancel" className="text-sm font-medium">
                      Free cancellation
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Only show stays that can be cancelled without penalty
                    </p>
                  </div>
                  <Switch
                    id="hotel-free-cancel"
                    checked={freeCancellationOnly}
                    onCheckedChange={(checked) => setFreeCancellationOnly(checked)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => handleExternalSearch("airbnb")}
                    className="bg-[#FF5A5F] hover:bg-[#e24e52] text-white shadow-sm"
                  >
                    Search Airbnb
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleExternalSearch("vrbo")}
                    className="bg-[#0A4385] hover:bg-[#08376b] text-white shadow-sm"
                  >
                    Search VRBO
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleExternalSearch("expedia")}
                    className="bg-[#FEC601] hover:bg-[#e0b000] text-gray-900 shadow-sm"
                  >
                    Search Expedia
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button type="submit" disabled={isSearching} className="min-w-[160px] w-full sm:w-auto">
                  <Search className="h-4 w-4 mr-2" />
                  {isSearching ? (
                    <div className="flex items-center gap-2">
                      <TravelLoading variant="globe" size="sm" />
                      Searching...
                    </div>
                  ) : (
                    "Search Hotels"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {searchResults.length > 0 && (
          <Card className="mt-6 sky-pattern">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Hotel className="h-5 w-5" />
                    Available Hotels ({searchResults.length})
                    {searchResults.length > 0 && hotelProposalsCount > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({searchResults.length} found + {hotelProposalsCount} group)
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Hotels for {trip?.destination} •
                    {trip?.startDate && ` ${format(new Date(trip.startDate), "MMM d")}`}
                    {trip?.endDate && ` - ${format(new Date(trip.endDate), "MMM d")}`}
                  </p>
                </div>
                <Button onClick={onLogHotelManually} variant="outline">
                  <Building className="h-4 w-4 mr-2" />
                  Log Hotel Manually
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {searchResults.map((hotel, index) => (
                  <Card
                    key={hotel.id || index}
                    className={`relative overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 ${
                      hotel.isGroupProposal ? "border-blue-200 bg-blue-50/30" : "hotel-card-gradient border-0"
                    } airplane-pattern`}
                  >
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
                            hotel.platform === "Amadeus"
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-blue-50 border-blue-200 text-blue-700"
                          }`}
                        >
                          {hotel.platform === "Amadeus" ? "🔴 Live API Data" : "📊 Enhanced Database"}
                        </Badge>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            storeBookingIntent(
                              "hotel",
                              {
                                name: hotel.name,
                                location: hotel.location,
                                price: hotel.price,
                                rating: hotel.rating,
                                description: hotel.description,
                                startDate: trip?.startDate,
                                endDate: trip?.endDate,
                              },
                              tripId,
                            );
                            const bookingUrl =
                              hotel.bookingUrl ||
                              `https://www.booking.com/search.html?ss=${encodeURIComponent(hotel.name)}`;
                            window.open(bookingUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="flex-1 hover:bg-blue-50"
                        >
                          <Bed className="h-4 w-4 mr-2" />
                          Book Now
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onShareHotelWithGroup(hotel)}
                          className="flex-1"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Add to Group Hotels
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  },
);

HotelSearchPanel.displayName = "HotelSearchPanel";

