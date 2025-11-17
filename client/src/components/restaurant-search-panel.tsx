import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChefHat,
  Clock,
  ExternalLink,
  Filter,
  MapPin,
  NotebookPen,
  Phone,
  Search,
  Star,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import SmartLocationSearch, { type LocationResult as SmartLocationResult } from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
import { normalizeTimeTo24Hour } from "@/lib/time";
import { buildOpenTableUrl, buildResyUrl } from "@/utils/urlBuilders/restaurants";

import type { TripWithDetails } from "@shared/schema";
import type { RestaurantPlatform } from "@/types/restaurants";

const distanceRadiusMap: Record<string, number> = {
  "0.5": 800,
  "1": 1600,
  "5": 8000,
  "10": 16000,
  "25": 40000,
};

const dietaryOptions = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "dairy-free", label: "Dairy-Free" },
];

export interface RestaurantSearchPanelProps {
  tripId?: string | number;
  trip?: TripWithDetails;
  user?: { defaultCity?: string | null; defaultLocation?: string | null } | null;
  onLogRestaurantManually?: () => void;
  onProposeRestaurant?: (restaurant: any) => void;
  onBookingLinkClick?: (restaurant: any, link: { text: string; url: string; type: string }) => void;
  onExternalSearch?: (details: {
    platform: RestaurantPlatform;
    url: string;
    date: string;
    partySize: number;
    city: string;
    time?: string;
    stateCode?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  initialSearchDate?: Date;
  initialSearchTime?: string;
  initialPartySize?: number;
}

export const RestaurantSearchPanel = forwardRef<HTMLDivElement, RestaurantSearchPanelProps>(
  (
    {
      tripId,
      trip,
      user,
      onLogRestaurantManually,
      onProposeRestaurant,
      onBookingLinkClick,
      onExternalSearch,
      initialSearchDate,
      initialSearchTime,
      initialPartySize,
    },
    ref,
  ) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const normalizedTripId = typeof tripId === "string" ? parseInt(tripId, 10) : tripId;

    const [searchLocation, setSearchLocation] = useState("");
    const [selectedLocation, setSelectedLocation] = useState<SmartLocationResult | null>(null);
    const [searchCuisine, setSearchCuisine] = useState("all");
    const [searchPriceRange, setSearchPriceRange] = useState("all");
    const [sortBy, setSortBy] = useState("rating");
    const [searchDate, setSearchDate] = useState<Date | undefined>(initialSearchDate ?? new Date());
    const [searchTime, setSearchTime] = useState(initialSearchTime ?? "7:00 PM");
    const [searchPartySize, setSearchPartySize] = useState(initialPartySize ?? 2);
    const [searchRating, setSearchRating] = useState("all");
    const [searchDistance, setSearchDistance] = useState("all");
    const [searchOpenNow, setSearchOpenNow] = useState(false);
    const [searchDietaryTags, setSearchDietaryTags] = useState<string[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const lastSelectedLocationRef = useRef<string | null>(null);

    const { data: searchResults = [], isLoading: searchLoading, refetch } = useQuery({
      queryKey: [
        "/api/restaurants/search",
        searchLocation,
        searchCuisine,
        searchPriceRange,
        sortBy,
        searchDistance,
        searchOpenNow,
      ],
      queryFn: async () => {
        const radiusValue = searchDistance !== "all" && distanceRadiusMap[searchDistance]
          ? distanceRadiusMap[searchDistance]
          : 5000;

        const params = new URLSearchParams({
          location: searchLocation,
          limit: "20",
          radius: radiusValue.toString(),
        });

        if (searchCuisine && searchCuisine !== "all") {
          params.append("cuisine", searchCuisine);
        }

        if (searchPriceRange && searchPriceRange !== "all") {
          params.append("priceRange", searchPriceRange);
        }

        if (sortBy) {
          params.append("sortBy", sortBy);
        }

        if (searchOpenNow) {
          params.append("openNow", "true");
        }

        const response = await apiFetch(`/api/restaurants/search?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      },
      enabled: false,
    });

    const filteredSearchResults = useMemo(() => {
      return (searchResults as any[]).filter((restaurant: any) => {
        if (searchRating !== "all") {
          const minRating = Number(searchRating);
          const ratingValue = Number(restaurant.rating ?? restaurant.ratingScore ?? 0);
          if (!Number.isNaN(minRating) && (Number.isNaN(ratingValue) || ratingValue < minRating)) {
            return false;
          }
        }

        if (searchDistance !== "all" && distanceRadiusMap[searchDistance] && restaurant.distance) {
          if (restaurant.distance > distanceRadiusMap[searchDistance]) {
            return false;
          }
        }

        if (searchOpenNow && restaurant.isOpen === false) {
          return false;
        }

        if (searchDietaryTags.length > 0) {
          const tags = Array.isArray(restaurant.dietaryTags)
            ? restaurant.dietaryTags
            : Array.isArray(restaurant.tags)
              ? restaurant.tags
              : [];

          const normalizedTags = tags.map((tag: string) => tag.toLowerCase());
          const matches = searchDietaryTags.every((tag) => normalizedTags.includes(tag));
          if (!matches) {
            return false;
          }
        }

        return true;
      });
    }, [searchResults, searchRating, searchDistance, searchOpenNow, searchDietaryTags]);

    const sortedSearchResults = useMemo(() => {
      const results = [...filteredSearchResults];
      if (sortBy === "rating") {
        return results.sort((a, b) => (Number(b.rating ?? 0) || 0) - (Number(a.rating ?? 0) || 0));
      }
      if (sortBy === "price") {
        const getPriceValue = (priceRange?: string) => (priceRange ? priceRange.length : 0);
        return results.sort((a, b) => getPriceValue(a.priceRange) - getPriceValue(b.priceRange));
      }
      return results;
    }, [filteredSearchResults, sortBy]);

    useEffect(() => {
      if (trip && !searchLocation) {
        setSearchLocation((trip as any).destination);
      } else if (!normalizedTripId && !searchLocation) {
        if (user?.defaultCity) {
          setSearchLocation(user.defaultCity);
        } else if (user?.defaultLocation) {
          setSearchLocation(user.defaultLocation);
        } else {
          setSearchLocation("Paris");
        }
      }
    }, [trip, searchLocation, tripId, user]);

    const parseAddressForTrip = useCallback(
      (address: string) => {
        const parts = address.split(',').map((part) => part.trim()).filter(Boolean);

        let city = "";
        let country = "";

        if (parts.length >= 2) {
          country = parts[parts.length - 1];
          city = parts[parts.length - 2];
        } else if (parts.length === 1) {
          city = parts[0];
        }

        if (!city && searchLocation) {
          city = searchLocation;
        }

        if (!country && searchLocation) {
          country = searchLocation;
        }

        if (!city) {
          city = "Unknown City";
        }

        if (!country) {
          country = "Unknown Country";
        }

        return { city, country };
      },
      [searchLocation]
    );

    const addRestaurantFromSearchMutation = useMutation({
      mutationFn: async (restaurant: any) => {
        if (!normalizedTripId) {
          throw new Error("Trip context missing");
        }

        const addressValue = restaurant.address || searchLocation || "";
        const { city, country } = parseAddressForTrip(addressValue);
        const reservationDateValue = searchDate ?? new Date();
        const reservationTime = normalizeTimeTo24Hour(searchTime) || "19:00";
        const ratingValue = Number(restaurant.rating);
        const openTableLink = restaurant.bookingLinks?.find((link: any) => {
          const text = (link.text || "").toLowerCase();
          const url = (link.url || "").toLowerCase();
          return text.includes("opentable") || url.includes("opentable");
        });

        const payload = {
          tripId: Number(normalizedTripId),
          name: restaurant.name,
          address: addressValue,
          city,
          country,
          reservationDate: format(reservationDateValue, "yyyy-MM-dd"),
          reservationTime,
          partySize: Number.isNaN(Number(searchPartySize)) ? 2 : Number(searchPartySize),
          cuisineType: restaurant.cuisineType || restaurant.cuisine || null,
          zipCode: null,
          latitude: restaurant.latitude ?? null,
          longitude: restaurant.longitude ?? null,
          phoneNumber: restaurant.phone || restaurant.phoneNumber || null,
          website: restaurant.website || null,
          openTableUrl: openTableLink?.url || null,
          priceRange: restaurant.priceRange || "$$",
          rating: Number.isFinite(ratingValue) ? ratingValue : null,
          confirmationNumber: null,
          specialRequests: null,
          notes: searchDietaryTags.length > 0 ? searchDietaryTags.join(", ") : null,
        };

        return apiRequest(`/api/trips/${normalizedTripId}/restaurants`, {
          method: "POST",
          body: payload,
        });
      },
      onSuccess: () => {
        toast({
          title: "Restaurant Added",
          description: "This restaurant was added to your group reservations.",
        });
        if (normalizedTripId) {
          const queryKeyId = typeof tripId === "undefined" ? normalizedTripId : tripId;
          queryClient.invalidateQueries({ queryKey: ["/api/trips", queryKeyId, "restaurants"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trips", queryKeyId, "restaurant-proposals"] });
        }
      },
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          toast({
            title: "Unauthorized",
            description: "You are logged out. Logging in again...",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/login";
          }, 500);
          return;
        }

        toast({
          title: "Unable to Add Restaurant",
          description: "We couldn't save this restaurant. Please try again.",
          variant: "destructive",
        });
      },
    });

    const runSearch = useCallback(() => {
      if (!searchLocation.trim()) {
        toast({
          title: "Location Required",
          description: "Please enter a location to search for restaurants.",
          variant: "destructive",
        });
        return;
      }

      setHasSearched(true);
      refetch();
    }, [refetch, searchLocation, toast]);

    const handleLocationSelect = useCallback((location: SmartLocationResult) => {
      const candidates: string[] = [];
      if (typeof location.cityName === "string") {
        candidates.push(location.cityName.trim());
      }
      if (typeof location.name === "string") {
        candidates.push(location.name.trim());
      }
      if (typeof location.displayName === "string") {
        const [firstPart] = location.displayName.split(",");
        if (firstPart) {
          candidates.push(firstPart.trim());
        }
      }

      const nextLocation = candidates.find((value) => value.length > 0) ?? "";
      const normalized = nextLocation.length > 0 ? nextLocation : searchLocation.trim();

      setSearchLocation(normalized);
      setSelectedLocation(location);
      lastSelectedLocationRef.current = normalized.length > 0 ? normalized : null;
    }, [searchLocation]);

    const handleLocationQueryChange = useCallback(
      (value: string) => {
        setSearchLocation(value);
        const trimmed = value.trim();

        if (!trimmed) {
          setSelectedLocation(null);
          lastSelectedLocationRef.current = null;
          return;
        }

        if (lastSelectedLocationRef.current && trimmed !== lastSelectedLocationRef.current.trim()) {
          setSelectedLocation(null);
        }
      },
      [],
    );

    const derivedLocation = useMemo(() => {
      const fallbackCity = searchLocation.trim();
      let city = fallbackCity;

      if (selectedLocation) {
        const candidateCityValues = [
          typeof selectedLocation.cityName === "string" ? selectedLocation.cityName.trim() : "",
          typeof selectedLocation.name === "string" ? selectedLocation.name.trim() : "",
        ];

        if (typeof selectedLocation.displayName === "string") {
          const [firstPart] = selectedLocation.displayName.split(",");
          if (firstPart) {
            candidateCityValues.push(firstPart.trim());
          }
        }

        city = candidateCityValues.find((value) => value.length > 0) ?? fallbackCity;
      }

      const rawState =
        (selectedLocation && typeof selectedLocation.state === "string" ? selectedLocation.state : undefined) ??
        (selectedLocation &&
        typeof (selectedLocation as Record<string, unknown>).stateCode === "string"
          ? ((selectedLocation as Record<string, unknown>).stateCode as string)
          : undefined) ??
        (selectedLocation && typeof selectedLocation.region === "string" ? selectedLocation.region : undefined);

      const trimmedState = rawState?.trim();
      const stateCode =
        trimmedState && /^[A-Za-z]{2}$/.test(trimmedState) ? trimmedState.toUpperCase() : undefined;

      const latitude =
        selectedLocation && typeof selectedLocation.latitude === "number" && Number.isFinite(selectedLocation.latitude)
          ? selectedLocation.latitude
          : undefined;
      const longitude =
        selectedLocation &&
        typeof selectedLocation.longitude === "number" && Number.isFinite(selectedLocation.longitude)
          ? selectedLocation.longitude
          : undefined;

      return {
        city,
        stateCode,
        latitude,
        longitude,
      };
    }, [searchLocation, selectedLocation]);

    const formatDateYYYYMMDD = useCallback((value?: Date) => {
      if (!value || Number.isNaN(value.getTime())) {
        return "";
      }

      return format(value, "yyyy-MM-dd");
    }, []);

    const openInNewTab = useCallback((url: string) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }, []);

    const reservationDetails = useMemo(() => {
      const date = formatDateYYYYMMDD(searchDate);
      const time = normalizeTimeTo24Hour(searchTime) || "";
      const partySize = Math.max(1, Number(searchPartySize) || 1);
      const hasCity = derivedLocation.city.trim().length > 0;
      const hasDate = Boolean(date);
      const hasPartySize = partySize >= 1;
      const resyDisabled = !(hasCity && hasDate && hasPartySize);
      const openTableDisabled = resyDisabled || !time;

      return {
        date,
        time,
        partySize,
        hasCity,
        resyDisabled,
        openTableDisabled,
      };
    }, [derivedLocation.city, formatDateYYYYMMDD, searchDate, searchPartySize, searchTime]);

    const handleSearchResy = useCallback(() => {
      if (reservationDetails.resyDisabled) {
        return;
      }

      const city = derivedLocation.city.trim();
      if (!city || !reservationDetails.date) {
        return;
      }

      const url = buildResyUrl({
        city,
        stateCode: derivedLocation.stateCode,
        date: reservationDetails.date,
        partySize: reservationDetails.partySize,
      });

      openInNewTab(url);
      onExternalSearch?.({
        platform: "resy",
        url,
        date: reservationDetails.date,
        partySize: reservationDetails.partySize,
        city,
        stateCode: derivedLocation.stateCode,
        latitude: derivedLocation.latitude,
        longitude: derivedLocation.longitude,
      });
    }, [derivedLocation, onExternalSearch, openInNewTab, reservationDetails]);

    const handleSearchOpenTable = useCallback(() => {
      if (reservationDetails.openTableDisabled) {
        return;
      }

      const city = derivedLocation.city.trim();
      if (!city || !reservationDetails.date || !reservationDetails.time) {
        return;
      }

      const url = buildOpenTableUrl({
        city,
        date: reservationDetails.date,
        time: reservationDetails.time,
        partySize: reservationDetails.partySize,
        latitude: derivedLocation.latitude,
        longitude: derivedLocation.longitude,
      });

      openInNewTab(url);
      onExternalSearch?.({
        platform: "open_table",
        url,
        date: reservationDetails.date,
        time: reservationDetails.time,
        partySize: reservationDetails.partySize,
        city,
        stateCode: derivedLocation.stateCode,
        latitude: derivedLocation.latitude,
        longitude: derivedLocation.longitude,
      });
    }, [derivedLocation, onExternalSearch, openInNewTab, reservationDetails]);

    const { resyDisabled, openTableDisabled } = reservationDetails;

    const handleAddFromSearch = (restaurant: any) => {
      if (!normalizedTripId) {
        toast({
          title: "Trip Required",
          description: "Open a trip to add restaurants to your group list.",
          variant: "destructive",
        });
        return;
      }

      if (!searchDate) {
        toast({
          title: "Select a Date",
          description: "Choose a reservation date before adding the restaurant.",
          variant: "destructive",
        });
        return;
      }

      if (!searchTime) {
        toast({
          title: "Select a Time",
          description: "Choose a reservation time before adding the restaurant.",
          variant: "destructive",
        });
        return;
      }

      addRestaurantFromSearchMutation.mutate(restaurant);
    };

    return (
      <section ref={ref} aria-labelledby="restaurant-search-heading">
        <Card id="restaurant-search-panel" aria-live="polite">
          <CardHeader className="space-y-1">
            <CardTitle id="restaurant-search-heading" className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Restaurants
            </CardTitle>
            <CardDescription>Plan a reservation without leaving the page.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                runSearch();
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <SmartLocationSearch
                    id="location"
                    placeholder="Enter city, airport, or region..."
                    value={searchLocation}
                    onLocationSelect={handleLocationSelect}
                    onQueryChange={handleLocationQueryChange}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="reservationDate">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !searchDate && "text-muted-foreground"
                        )}
                      >
                        {searchDate ? format(searchDate, "PPP") : "Pick a date"}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={searchDate}
                        onSelect={setSearchDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="reservationTime">Time</Label>
                  <Select value={searchTime} onValueChange={setSearchTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                      <SelectItem value="5:30 PM">5:30 PM</SelectItem>
                      <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                      <SelectItem value="6:30 PM">6:30 PM</SelectItem>
                      <SelectItem value="7:00 PM">7:00 PM</SelectItem>
                      <SelectItem value="7:30 PM">7:30 PM</SelectItem>
                      <SelectItem value="8:00 PM">8:00 PM</SelectItem>
                      <SelectItem value="8:30 PM">8:30 PM</SelectItem>
                      <SelectItem value="9:00 PM">9:00 PM</SelectItem>
                      <SelectItem value="9:30 PM">9:30 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="partySize">Party Size</Label>
                  <Select
                    value={searchPartySize.toString()}
                    onValueChange={(value) => setSearchPartySize(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select party size" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size} {size === 1 ? "person" : "people"}
                        </SelectItem>
                      ))}
                      <SelectItem value="12">12 people</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="cuisine">Cuisine</Label>
                  <Select value={searchCuisine} onValueChange={setSearchCuisine}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any cuisine</SelectItem>
                      <SelectItem value="italian">Italian</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="japanese">Japanese</SelectItem>
                      <SelectItem value="mexican">Mexican</SelectItem>
                      <SelectItem value="indian">Indian</SelectItem>
                      <SelectItem value="thai">Thai</SelectItem>
                      <SelectItem value="chinese">Chinese</SelectItem>
                      <SelectItem value="mediterranean">Mediterranean</SelectItem>
                      <SelectItem value="seafood">Seafood</SelectItem>
                      <SelectItem value="steakhouse">Steakhouse</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priceRange">Price Range</Label>
                  <Select value={searchPriceRange} onValueChange={setSearchPriceRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any price</SelectItem>
                      <SelectItem value="$">$ - Budget</SelectItem>
                      <SelectItem value="$$">$$ - Moderate</SelectItem>
                      <SelectItem value="$$$">$$$ - Upscale</SelectItem>
                      <SelectItem value="$$$$">$$$$ - Very Expensive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="rating">Minimum Rating</Label>
                  <Select value={searchRating} onValueChange={setSearchRating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ratings</SelectItem>
                      <SelectItem value="7">7+/10</SelectItem>
                      <SelectItem value="8">8+/10</SelectItem>
                      <SelectItem value="9">9+/10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="distance">Distance</Label>
                <Select value={searchDistance} onValueChange={setSearchDistance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any distance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any distance</SelectItem>
                    <SelectItem value="0.5">Within 0.5 km</SelectItem>
                    <SelectItem value="1">Within 1 km</SelectItem>
                    <SelectItem value="5">Within 5 km</SelectItem>
                    <SelectItem value="10">Within 10 km</SelectItem>
                    <SelectItem value="25">Within 25 km</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sortBy">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rating">Rating</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div>
                    <Label htmlFor="openNow" className="text-sm font-medium">
                      Open Now
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show restaurants accepting guests right now.
                    </p>
                  </div>
                  <Switch id="openNow" checked={searchOpenNow} onCheckedChange={setSearchOpenNow} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dietary Tags</Label>
                <ToggleGroup
                  type="multiple"
                  value={searchDietaryTags}
                  onValueChange={setSearchDietaryTags}
                  className="flex flex-wrap gap-2"
                >
                  {dietaryOptions.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      aria-label={option.label}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm capitalize transition",
                        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      )}
                    >
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  Adjust filters, then search when you're ready.
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={handleSearchOpenTable}
                          disabled={openTableDisabled}
                          aria-label="Search OpenTable"
                          data-testid="button-search-open-table"
                        >
                          Search OpenTable
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Build link and search on OpenTable</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={handleSearchResy}
                          disabled={resyDisabled}
                          aria-label="Search Resy"
                          data-testid="button-search-resy"
                        >
                          Search Resy
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Build link and search on Resy</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 w-full sm:w-auto">
                    <Button type="submit" disabled={searchLoading} className="w-full sm:w-auto">
                      {searchLoading ? (
                        <div className="flex items-center gap-2">
                          <TravelLoading variant="compass" size="sm" />
                          Searching...
                        </div>
                      ) : (
                        "Search Restaurants"
                      )}
                    </Button>
                    {onLogRestaurantManually && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={onLogRestaurantManually}
                      >
                        <NotebookPen className="h-4 w-4 mr-2" />
                        Log Restaurant Manually
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {hasSearched && !searchLoading && sortedSearchResults.length === 0 && (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
              <Search className="h-8 w-8 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No restaurants found</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Try adjusting your filters or changing the location to discover more options.
              </p>
            </CardContent>
          </Card>
        )}

        {sortedSearchResults.length > 0 && (
          <div className="space-y-4 mt-6">
            <h2 className="text-xl font-semibold">
              Search Results ({sortedSearchResults.length} restaurants)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedSearchResults.map((restaurant: any) => (
                <Card key={restaurant.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <ChefHat className="h-4 w-4" />
                          {restaurant.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="secondary">{restaurant.cuisine || restaurant.cuisineType || "Restaurant"}</Badge>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {restaurant.priceRange}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {restaurant.rating}/10
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      {restaurant.address}
                    </div>

                    {(restaurant.phoneNumber || restaurant.phone) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="h-4 w-4" />
                        {restaurant.phoneNumber || restaurant.phone}
                      </div>
                    )}

                    {restaurant.distance && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4" />
                        {Math.round((restaurant.distance / 1000) * 10) / 10} km away
                      </div>
                    )}

                    {restaurant.tips && restaurant.tips.length > 0 && (
                      <div className="space-y-1">
                        {restaurant.tips.slice(0, 1).map((tip: string, index: number) => (
                          <p key={index} className="text-sm text-gray-600 dark:text-gray-400 italic">
                            "{tip}" - Foursquare user
                          </p>
                        ))}
                      </div>
                    )}

                    {restaurant.bookingLinks && restaurant.bookingLinks.length > 0 && onBookingLinkClick && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {restaurant.bookingLinks.map((link: any, index: number) => (
                          <Button
                            key={index}
                            variant={link.type === "direct" ? "default" : "outline"}
                            size="sm"
                            onClick={() => onBookingLinkClick?.(restaurant, link)}
                            data-testid={`button-booking-link-${link.type}-${index}`}
                            className="text-xs"
                          >
                            {link.type === "phone" ? (
                              <Phone className="h-3 w-3 mr-1" />
                            ) : (
                              <ExternalLink className="h-3 w-3 mr-1" />
                            )}
                            {link.text}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t space-y-2">
                      <Button
                        onClick={() => handleAddFromSearch(restaurant)}
                        size="sm"
                        className="w-full"
                        data-testid={`button-add-restaurant-${restaurant.id}`}
                        disabled={addRestaurantFromSearchMutation.isPending}
                      >
                        {addRestaurantFromSearchMutation.isPending ? "Adding..." : "Add to Group Restaurants"}
                      </Button>

                      {normalizedTripId && onProposeRestaurant && (
                        <Button
                          onClick={() => onProposeRestaurant?.(restaurant)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                          data-testid={`button-propose-restaurant-${restaurant.id}`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Propose to Group
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }
);

RestaurantSearchPanel.displayName = "RestaurantSearchPanel";

