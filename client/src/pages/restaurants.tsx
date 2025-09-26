import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  MapPin,
  Phone,
  Clock,
  Star,
  Users,
  ExternalLink,
  Search,
  Filter,
  ChefHat,
  Utensils,
  Globe,
  ArrowLeft,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { TripWithDetails, RestaurantWithDetails } from "@shared/schema";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { RestaurantProposalModal } from "@/components/restaurant-proposal-modal";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

const restaurantFormSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  cuisine: z.string().min(1, "Cuisine type is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional(),
  priceRange: z.string().min(1, "Price range is required"),
  rating: z.number().min(1).max(5),
  reservationDate: z.date(),
  reservationTime: z.string().min(1, "Reservation time is required"),
  partySize: z.number().min(1, "Party size must be at least 1"),
  specialRequests: z.string().optional(),
  website: z.string().url().optional(),
  openTableUrl: z.string().url().optional(),
});

type RestaurantFormData = z.infer<typeof restaurantFormSchema>;

export default function RestaurantsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Booking confirmation system
  const {
    showModal: showBookingModal,
    bookingData,
    storeBookingIntent,
    closeModal: closeBookingModal,
    confirmBooking,
    markBookingAsAsked
  } = useBookingConfirmation();

  // Search state
  const [searchLocation, setSearchLocation] = useState("");
  const [searchCuisine, setSearchCuisine] = useState("all");
  const [searchPriceRange, setSearchPriceRange] = useState("all");
  const [sortBy, setSortBy] = useState("rating");
  const [searchDate, setSearchDate] = useState<Date | undefined>(new Date());
  const [searchTime, setSearchTime] = useState("7:00 PM");
  const [searchPartySize, setSearchPartySize] = useState(2);
  const [searchRating, setSearchRating] = useState("all");
  const [searchDistance, setSearchDistance] = useState("all");
  const [searchOpenNow, setSearchOpenNow] = useState(false);
  const [searchDietaryTags, setSearchDietaryTags] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [restaurantToPropose, setRestaurantToPropose] = useState<any>(null);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);

  // Get trip details (only if tripId exists)
  const { data: trip } = useQuery({
    queryKey: ["/api/trips", tripId],
    enabled: !!tripId,
  });

  // Get current trip restaurants (only if tripId exists)
  const { data: tripRestaurants = [], isLoading: restaurantsLoading } = useQuery<RestaurantWithDetails[]>({
    queryKey: ["/api/trips", tripId, "restaurants"],
    enabled: !!tripId,
  });

  // Search restaurants
  const { data: searchResults = [], isLoading: searchLoading, refetch: searchRestaurants } = useQuery({
    queryKey: ["/api/restaurants/search", searchLocation, searchCuisine, searchPriceRange, sortBy, searchDistance, searchOpenNow],
    queryFn: async () => {
      const radiusValue =
        searchDistance !== "all" && distanceRadiusMap[searchDistance]
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

  // Set default search location from trip, user default location, or fallback to Paris
  useEffect(() => {
    if (trip && !searchLocation) {
      setSearchLocation((trip as any).destination);
    } else if (!tripId && !searchLocation) {
      // When not in trip context, try user's default location first
      if (user?.defaultCity) {
        setSearchLocation(user.defaultCity);
      } else if (user?.defaultLocation) {
        setSearchLocation(user.defaultLocation);
      } else {
        // Final fallback to Paris when no user location available
        setSearchLocation("Paris");
      }
    }
  }, [trip, searchLocation, tripId, user]);

  // Restaurant form
  const form = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: {
      name: "",
      cuisine: "",
      address: "",
      phone: "",
      priceRange: "$$",
      rating: 4.5,
      reservationDate: new Date(),
      reservationTime: "7:00 PM",
      partySize: 2,
      specialRequests: "",
      website: "",
      openTableUrl: "",
    },
  });

  const addRestaurantFromSearchMutation = useMutation({
    mutationFn: async (restaurant: any) => {
      if (!tripId) {
        throw new Error("Trip context missing");
      }

      const addressValue = restaurant.address || searchLocation || "";
      const { city, country } = parseAddressForTrip(addressValue);
      const reservationDateValue = searchDate ?? new Date();
      const ratingValue = Number(restaurant.rating);
      const openTableLink = restaurant.bookingLinks?.find((link: any) => {
        const text = (link.text || "").toLowerCase();
        const url = (link.url || "").toLowerCase();
        return text.includes("opentable") || url.includes("opentable");
      });

      const payload = {
        tripId: Number(tripId),
        name: restaurant.name,
        address: addressValue,
        city,
        country,
        reservationDate: format(reservationDateValue, "yyyy-MM-dd"),
        reservationTime: searchTime,
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
        reservationStatus: "planned",
        specialRequests: null,
        notes: searchDietaryTags.length > 0 ? searchDietaryTags.join(", ") : null,
      };

      return apiRequest(`/api/trips/${tripId}/restaurants`, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: () => {
      toast({
        title: "Restaurant Added",
        description: "This restaurant was added to your group reservations.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurants"] });
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

  // Create restaurant mutation (only if tripId exists)
  const createRestaurantMutation = useMutation({
    mutationFn: (data: RestaurantFormData) => {
      if (!tripId) {
        throw new Error("No trip context available");
      }
      return apiRequest(`/api/trips/${tripId}/restaurants`, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Restaurant Added",
        description: "Restaurant reservation has been added to your trip.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurants"] });
      setShowBooking(false);
      form.reset();
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
        title: "Error",
        description: "Failed to add restaurant. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle search
  const handleSearch = useCallback(() => {
    if (!searchLocation.trim()) {
      toast({
        title: "Location Required",
        description: "Please enter a location to search for restaurants.",
        variant: "destructive",
      });
      return;
    }
    setHasSearched(true);
    searchRestaurants();
  }, [searchLocation, toast, searchRestaurants, setHasSearched]);

  const focusSearchSection = useCallback(() => {
    if (!searchSectionRef.current) {
      return;
    }

    searchSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstFocusable = searchSectionRef.current.querySelector<HTMLElement>(
      "input, button, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
  }, []);

  // Handle location selection from smart search
  const handleLocationSelect = (location: any) => {
    // Extract just the city name for the search
    const cityName = location.name || location.displayName.split(',')[0];
    setSearchLocation(cityName);
  };

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

  // Handle booking link clicks with tracking
  const handleBookingLinkClick = (restaurant: any, link: { text: string; url: string; type: string }) => {
    if (!tripId) {
      // If not in trip context, just open the link
      window.open(link.url, '_blank', 'noopener,noreferrer');
      return;
    }
    
    console.log('Tracking booking link click:', { restaurant: restaurant.name, link: link.text, url: link.url });
    
    // Store booking intent before user leaves
    storeBookingIntent('restaurant', {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      cuisine: restaurant.cuisine,
      rating: restaurant.rating,
      priceRange: restaurant.priceRange,
      website: restaurant.website,
      bookingLinks: restaurant.bookingLinks,
      tripId: parseInt(tripId)
    }, parseInt(tripId), link.url);
    
    // Open the booking link
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };
  
  // Handle add restaurant from search
  const handleAddFromSearch = (restaurant: any) => {
    if (!tripId) {
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

  // Handle propose restaurant to group
  const handleProposeToGroup = (restaurant: any) => {
    setRestaurantToPropose(restaurant);
    setShowProposalModal(true);
  };

  // Remove duplicate creation path - the BookingConfirmationModal handles creation directly
  // This prevents double-adds that could occur when both paths are used
  
  // Handle form submission
  const onSubmit = (data: RestaurantFormData) => {
    createRestaurantMutation.mutate(data);
  };

  // Handle unauthorized access
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <TravelLoading size="lg" text="Preparing your travel experience..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Back Navigation Button */}
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button 
            variant="outline" 
            size="sm" 
            className="mb-6 flex items-center hover:bg-gray-50"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Restaurant Reservations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {trip ? `Find and book restaurants for ${(trip as any).destination}` : "Find and book restaurants"}
          </p>
        </div>
      </div>

      {/* Search Section */}
      <section ref={searchSectionRef} aria-labelledby="restaurant-search-heading">
        <Card id="restaurant-search-panel" aria-live="polite">
          <CardHeader className="space-y-1">
            <CardTitle id="restaurant-search-heading" className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Restaurants
            </CardTitle>
            <CardDescription>
              Plan a reservation without leaving the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSearch();
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <SmartLocationSearch
                    placeholder="Enter city, airport, or region..."
                    value={searchLocation}
                    onLocationSelect={handleLocationSelect}
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
                  <Input
                    id="partySize"
                    type="number"
                    min={1}
                    max={20}
                    value={searchPartySize}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSearchPartySize(Number.isNaN(value) ? 1 : value);
                    }}
                  />
                </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="cuisine">Cuisine</Label>
                <Select value={searchCuisine} onValueChange={setSearchCuisine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cuisines</SelectItem>
                    <SelectItem value="american">American</SelectItem>
                    <SelectItem value="italian">Italian</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="japanese">Japanese</SelectItem>
                    <SelectItem value="chinese">Chinese</SelectItem>
                    <SelectItem value="mexican">Mexican</SelectItem>
                    <SelectItem value="indian">Indian</SelectItem>
                    <SelectItem value="thai">Thai</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="steakhouse">Steakhouse</SelectItem>
                    <SelectItem value="seafood">Seafood</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priceRange">Price Range</Label>
                <Select value={searchPriceRange} onValueChange={setSearchPriceRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select price range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prices</SelectItem>
                    <SelectItem value="$">$ - Budget</SelectItem>
                    <SelectItem value="$$">$$ - Moderate</SelectItem>
                    <SelectItem value="$$$">$$$ - Expensive</SelectItem>
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setShowBooking(true)}
                >
                  <NotebookPen className="h-4 w-4 mr-2" />
                  Log Restaurant Manually
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
        </Card>
      </section>

      {hasSearched && !searchLoading && sortedSearchResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
            <Search className="h-8 w-8 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No restaurants found</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Try adjusting your filters or changing the location to discover more options.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {sortedSearchResults.length > 0 && (
        <div className="space-y-4">
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
                        <Badge variant="secondary">{restaurant.cuisine || restaurant.cuisineType || 'Restaurant'}</Badge>
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
                      {Math.round(restaurant.distance / 1000 * 10) / 10} km away
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
                  
                  <div className="flex flex-wrap gap-1 pt-2">
                    {restaurant.bookingLinks.map((link: any, index: number) => (
                      <Button
                        key={index}
                        variant={link.type === 'direct' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleBookingLinkClick(restaurant, link)}
                        data-testid={`button-booking-link-${link.type}-${index}`}
                        className="text-xs"
                      >
                        {link.type === 'phone' ? (
                          <Phone className="h-3 w-3 mr-1" />
                        ) : (
                          <ExternalLink className="h-3 w-3 mr-1" />
                        )}
                        {link.text}
                      </Button>
                    ))}
                  </div>
                  
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
                    
                    {/* Only show Propose to Group button when in trip context */}
                    {tripId && (
                      <Button
                        onClick={() => handleProposeToGroup(restaurant)}
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

      {/* Current Trip Restaurants */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Restaurant Reservations</h2>
        
        {restaurantsLoading ? (
          <div className="flex items-center justify-center py-12">
            <TravelLoading variant="luggage" size="lg" text="Loading your restaurant reservations..." />
          </div>
        ) : tripRestaurants.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Utensils className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No restaurants yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                Search for restaurants or add your own reservations to start planning your dining experiences.
              </p>
              <Button onClick={focusSearchSection}>
                <Search className="h-4 w-4 mr-2" />
                Search Restaurants
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tripRestaurants.map((restaurant: RestaurantWithDetails) => (
              <Card key={restaurant.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <ChefHat className="h-4 w-4" />
                        {restaurant.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="secondary">{restaurant.cuisineType || (restaurant as any).cuisine || 'Restaurant'}</Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {restaurant.priceRange}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {restaurant.rating}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    {restaurant.address}
                  </div>
                  
                  {restaurant.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4" />
                      {restaurant.phoneNumber}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CalendarIcon className="h-4 w-4" />
                    {restaurant.reservationDate ? format(new Date(restaurant.reservationDate), "PPP") : 'No date set'}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    {restaurant.reservationTime}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4" />
                    {restaurant.partySize} people
                  </div>
                  
                  {restaurant.specialRequests && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Special Requests:</strong> {restaurant.specialRequests}
                    </p>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    {restaurant.openTableUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBookingLinkClick(restaurant, {
                          text: 'OpenTable',
                          url: restaurant.openTableUrl ?? '',
                          type: 'opentable'
                        })}
                        data-testid="button-opentable"
                        className="flex-1"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        OpenTable
                      </Button>
                    )}
                    
                    {restaurant.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBookingLinkClick(restaurant, {
                          text: 'Restaurant Website',
                          url: restaurant.website ?? '',
                          type: 'website'
                        })}
                        data-testid="button-restaurant-website"
                        className="flex-1"
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Website
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Restaurant Reservation</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter restaurant name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="cuisine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuisine Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cuisine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="american">American</SelectItem>
                          <SelectItem value="italian">Italian</SelectItem>
                          <SelectItem value="french">French</SelectItem>
                          <SelectItem value="japanese">Japanese</SelectItem>
                          <SelectItem value="chinese">Chinese</SelectItem>
                          <SelectItem value="mexican">Mexican</SelectItem>
                          <SelectItem value="indian">Indian</SelectItem>
                          <SelectItem value="thai">Thai</SelectItem>
                          <SelectItem value="spanish">Spanish</SelectItem>
                          <SelectItem value="steakhouse">Steakhouse</SelectItem>
                          <SelectItem value="seafood">Seafood</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter restaurant address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="priceRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Range</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select price range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="$">$ - Budget</SelectItem>
                          <SelectItem value="$$">$$ - Moderate</SelectItem>
                          <SelectItem value="$$$">$$$ - Expensive</SelectItem>
                          <SelectItem value="$$$$">$$$$ - Very Expensive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="reservationDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Reservation Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
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
                  name="reservationTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          placeholder="Number of people"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="specialRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any dietary restrictions, seating preferences, or special occasions..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://restaurant-website.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="openTableUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OpenTable URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://opentable.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBooking(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createRestaurantMutation.isPending}>
                  {createRestaurantMutation.isPending ? "Adding..." : "Add Restaurant"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Booking Confirmation Modal */}
      <BookingConfirmationModal
        isOpen={showBookingModal}
        onClose={closeBookingModal}
        bookingType="restaurant"
        bookingData={bookingData}
        tripId={tripId ? parseInt(tripId) : 0}
        onConfirm={confirmBooking}
        markBookingAsAsked={markBookingAsAsked}
        onSuccess={() => {
          // Refresh activities if booking was confirmed
          queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "activities"] });
        }}
      />

      {/* Restaurant Proposal Modal */}
      {tripId && restaurantToPropose && (
        <RestaurantProposalModal
          open={showProposalModal}
          onOpenChange={setShowProposalModal}
          restaurant={restaurantToPropose}
          tripId={parseInt(tripId)}
        />
      )}
    </div>
  );
}