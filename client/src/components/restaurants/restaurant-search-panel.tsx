import { useState, useMemo, useCallback, useEffect, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { apiFetch } from "@/lib/api";
import {
  Calendar,
  Clock,
  Filter,
  MapPin,
  Phone,
  Star,
  Users,
  ChefHat,
  ExternalLink,
  Search,
  X,
} from "lucide-react";

export interface RestaurantSearchFormState {
  location: string;
  date: string;
  time: string;
  partySize: string;
  cuisine: string;
  price: string;
  rating: string;
  distance: string;
  dietary: string;
  openNow: boolean;
  reservationsOnly: boolean;
}

export interface RestaurantSearchPanelProps {
  formState: RestaurantSearchFormState;
  onFormStateChange: (next: RestaurantSearchFormState) => void;
  onClose: () => void;
  onSelectRestaurant: (restaurant: any) => void;
  onProposeRestaurant?: (restaurant: any) => void;
  onBookingLinkClick?: (restaurant: any, link: { text: string; url: string; type: string }) => void;
  tripDestination?: string;
  locationInputRef?: React.RefObject<HTMLInputElement>;
  autoFocusLocation?: boolean;
  shouldAutoSearch?: boolean;
  showProposals?: boolean;
}

const DEFAULT_PAGE_SIZE = 9;

const comparisonKeys: (keyof RestaurantSearchFormState)[] = [
  "location",
  "date",
  "time",
  "partySize",
  "cuisine",
  "price",
  "rating",
  "distance",
  "dietary",
  "openNow",
  "reservationsOnly",
];

export function createDefaultRestaurantSearchState(initialLocation = ""): RestaurantSearchFormState {
  return {
    location: initialLocation,
    date: "",
    time: "",
    partySize: "2",
    cuisine: "all",
    price: "all",
    rating: "all",
    distance: "5000",
    dietary: "any",
    openNow: false,
    reservationsOnly: false,
  };
}

export default function RestaurantSearchPanel({
  formState,
  onFormStateChange,
  onClose,
  onSelectRestaurant,
  onProposeRestaurant,
  onBookingLinkClick,
  tripDestination,
  locationInputRef,
  autoFocusLocation = false,
  shouldAutoSearch = false,
  showProposals = false,
}: RestaurantSearchPanelProps) {
  const [committedFilters, setCommittedFilters] = useState<RestaurantSearchFormState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputError, setInputError] = useState<string | null>(null);
  const [autoSearchApplied, setAutoSearchApplied] = useState(false);

  const runSearch = useCallback(() => {
    if (!formState.location.trim()) {
      setInputError("Enter a location to search for restaurants.");
      return;
    }

    setInputError(null);
    setCommittedFilters({ ...formState });
    setCurrentPage(1);
  }, [formState]);

  useEffect(() => {
    if (shouldAutoSearch && !autoSearchApplied) {
      if (formState.location.trim()) {
        runSearch();
      }
      setAutoSearchApplied(true);
    }
  }, [formState.location, runSearch, shouldAutoSearch, autoSearchApplied]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "/api/restaurants/search",
      committedFilters?.location,
      committedFilters?.cuisine,
      committedFilters?.price,
      committedFilters?.rating,
      committedFilters?.distance,
      committedFilters?.dietary,
      committedFilters?.openNow,
      committedFilters?.reservationsOnly,
    ],
    enabled: Boolean(committedFilters?.location?.trim()),
    queryFn: async () => {
      if (!committedFilters?.location.trim()) {
        return [];
      }

      const params = new URLSearchParams({
        location: committedFilters.location.trim(),
        limit: "30",
        radius: committedFilters.distance || "5000",
      });

      if (committedFilters.cuisine && committedFilters.cuisine !== "all") {
        params.append("cuisine", committedFilters.cuisine);
      }

      if (committedFilters.price && committedFilters.price !== "all") {
        params.append("priceRange", committedFilters.price);
      }

      if (committedFilters.rating && committedFilters.rating !== "all") {
        params.append("minRating", committedFilters.rating);
      }

      if (committedFilters.openNow) {
        params.append("openNow", "1");
      }

      if (committedFilters.reservationsOnly) {
        params.append("reservationsOnly", "1");
      }

      if (committedFilters.dietary && committedFilters.dietary !== "any") {
        params.append("dietary", committedFilters.dietary);
      }

      if (committedFilters.partySize) {
        params.append("partySize", committedFilters.partySize);
      }

      if (committedFilters.date) {
        params.append("date", committedFilters.date);
      }

      if (committedFilters.time) {
        params.append("time", committedFilters.time);
      }

      const response = await apiFetch(`/api/restaurants/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }
      return response.json();
    },
  });

  const results: any[] = data ?? [];
  const totalResults = results.length;
  const totalPages = totalResults > 0 ? Math.ceil(totalResults / DEFAULT_PAGE_SIZE) : 1;
  const hasUnappliedChanges = useMemo(() => {
    if (!committedFilters) {
      return false;
    }

    return comparisonKeys.some((key) => committedFilters[key] !== formState[key]);
  }, [committedFilters, formState]);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalResults]);

  const paginatedResults = useMemo(() => {
    if (totalResults === 0) {
      return [];
    }

    const start = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    return results.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [results, currentPage, totalResults]);

  const updateFormState = useCallback((patch: Partial<RestaurantSearchFormState>) => {
    onFormStateChange({ ...formState, ...patch });
  }, [formState, onFormStateChange]);

  const handleLocationSelect = useCallback((location: any) => {
    const cityName = location?.name || location?.displayName?.split(",")[0] || "";
    updateFormState({ location: cityName });
  }, [updateFormState]);

  const handleLocationQueryChange = useCallback((value: string) => {
    updateFormState({ location: value });
  }, [updateFormState]);

  const handleLocationKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (formState.location.trim()) {
        runSearch();
      }
    }
  }, [formState.location, runSearch]);

  const handleBookingLinkClick = useCallback((restaurant: any, link: { text: string; url: string; type: string }) => {
    if (onBookingLinkClick) {
      onBookingLinkClick(restaurant, link);
      return;
    }

    window.open(link.url, "_blank", "noopener,noreferrer");
  }, [onBookingLinkClick]);

  const renderFiltersNotice = hasUnappliedChanges ? (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3 text-sm text-muted-foreground">
      <Filter className="h-4 w-4 mt-0.5" />
      <p>Filters updated. Press <span className="font-medium">Search Restaurants</span> to refresh the results.</p>
    </div>
  ) : null;

  return (
    <section className="rounded-2xl border bg-background shadow-sm p-4 sm:p-6 mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Search className="h-4 w-4" />
            Restaurant Search
          </div>
          <h2 className="text-xl font-semibold">
            {tripDestination ? `Find restaurants in ${tripDestination}` : "Find restaurants for your trip"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Use filters to discover the perfect spot, then add it directly to your group's plan.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} className="self-start" aria-label="Close restaurant search panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-3">
            <Label className="mb-1 block">Location</Label>
            <SmartLocationSearch
              placeholder="Enter city, area, or neighborhood"
              value={formState.location}
              onLocationSelect={handleLocationSelect}
              onQueryChange={handleLocationQueryChange}
              inputRef={locationInputRef}
              autoFocus={autoFocusLocation}
              onKeyDown={handleLocationKeyDown}
            />
          </div>

          <div className="space-y-1">
            <Label className="mb-1 block" htmlFor="restaurant-search-date">Date</Label>
            <div className="relative">
              <Input
                id="restaurant-search-date"
                type="date"
                value={formState.date}
                onChange={(event) => updateFormState({ date: event.target.value })}
              />
              <Calendar className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="mb-1 block" htmlFor="restaurant-search-time">Time</Label>
            <div className="relative">
              <Input
                id="restaurant-search-time"
                type="time"
                value={formState.time}
                onChange={(event) => updateFormState({ time: event.target.value })}
              />
              <Clock className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="mb-1 block">Party size</Label>
            <Select value={formState.partySize} onValueChange={(value) => updateFormState({ partySize: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Party size" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }).map((_, index) => {
                  const size = (index + 1).toString();
                  return (
                    <SelectItem key={size} value={size}>
                      {size} {size === "1" ? "guest" : "guests"}
                    </SelectItem>
                  );
                })}
                <SelectItem value="12">12 guests</SelectItem>
                <SelectItem value="16">16 guests</SelectItem>
                <SelectItem value="20">20 guests</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="mb-1 block">Cuisine</Label>
            <Select value={formState.cuisine} onValueChange={(value) => updateFormState({ cuisine: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All cuisines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cuisines</SelectItem>
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

          <div className="space-y-1">
            <Label className="mb-1 block">Price</Label>
            <Select value={formState.price} onValueChange={(value) => updateFormState({ price: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Any price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All prices</SelectItem>
                <SelectItem value="$">$ Budget</SelectItem>
                <SelectItem value="$$">$$ Moderate</SelectItem>
                <SelectItem value="$$$">$$$ Expensive</SelectItem>
                <SelectItem value="$$$$">$$$$ Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="mb-1 block">Minimum rating</Label>
            <Select value={formState.rating} onValueChange={(value) => updateFormState({ rating: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Any rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any rating</SelectItem>
                <SelectItem value="7">7.0+</SelectItem>
                <SelectItem value="8">8.0+</SelectItem>
                <SelectItem value="9">9.0+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="mb-1 block">Distance</Label>
            <Select value={formState.distance} onValueChange={(value) => updateFormState({ distance: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Any distance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 km</SelectItem>
                <SelectItem value="2000">2 km</SelectItem>
                <SelectItem value="5000">5 km</SelectItem>
                <SelectItem value="10000">10 km</SelectItem>
                <SelectItem value="20000">20 km</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="mb-1 block">Dietary preferences</Label>
            <Select value={formState.dietary} onValueChange={(value) => updateFormState({ dietary: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="vegetarian">Vegetarian friendly</SelectItem>
                <SelectItem value="vegan">Vegan friendly</SelectItem>
                <SelectItem value="gluten-free">Gluten free options</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div>
              <Label className="text-sm font-medium">Open now</Label>
              <p className="text-xs text-muted-foreground">Show restaurants currently open</p>
            </div>
            <Switch checked={formState.openNow} onCheckedChange={(checked) => updateFormState({ openNow: checked })} />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div>
              <Label className="text-sm font-medium">Reservations only</Label>
              <p className="text-xs text-muted-foreground">Show places that take reservations</p>
            </div>
            <Switch
              checked={formState.reservationsOnly}
              onCheckedChange={(checked) => updateFormState({ reservationsOnly: checked })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            onClick={runSearch}
            disabled={!formState.location.trim() || isFetching}
            className="w-full sm:w-auto"
          >
            {isFetching || isLoading ? (
              <span className="flex items-center gap-2">
                <TravelLoading variant="compass" size="sm" />
                Searching...
              </span>
            ) : (
              "Search Restaurants"
            )}
          </Button>

          {renderFiltersNotice}
        </div>

        {inputError && (
          <Alert variant="destructive">
            <AlertDescription>{inputError}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message || "Unable to load restaurants"}</AlertDescription>
          </Alert>
        )}

        {!committedFilters && !isLoading && !isFetching && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Enter a location above and search to explore dining options.
          </div>
        )}

        {committedFilters && !isLoading && !isFetching && results.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No restaurants found for your filters yet. Try adjusting your search and run it again.
          </div>
        )}

        {(isLoading || isFetching) && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Searching for great restaurants near {committedFilters?.location || formState.location || "your destination"}...
          </div>
        )}

        {paginatedResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Showing {paginatedResults.length} of {totalResults} restaurants
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            <div className="max-h-[60vh] overflow-auto pr-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedResults.map((restaurant: any) => (
                  <Card key={restaurant.id} className="transition-shadow hover:shadow-lg">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <ChefHat className="h-4 w-4" />
                            {restaurant.name}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary">{restaurant.cuisineType || "Restaurant"}</Badge>
                            {restaurant.priceRange && <span>{restaurant.priceRange}</span>}
                          </div>
                        </div>
                        {restaurant.rating && (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4 text-yellow-500" />
                            {restaurant.rating}/10
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      {restaurant.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4" />
                          <span>{restaurant.address}</span>
                        </div>
                      )}

                      {restaurant.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{restaurant.phoneNumber}</span>
                        </div>
                      )}

                      {restaurant.distance && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{Math.round((restaurant.distance / 1000) * 10) / 10} km away</span>
                        </div>
                      )}

                      {restaurant.tips && restaurant.tips.length > 0 && (
                        <div className="rounded-md bg-muted/40 p-3 text-xs italic">
                          “{restaurant.tips[0]}” — Foursquare user
                        </div>
                      )}

                      {Array.isArray(restaurant.bookingLinks) && restaurant.bookingLinks.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {restaurant.bookingLinks.map((link: any, index: number) => (
                            <Button
                              key={`${restaurant.id}-link-${index}`}
                              variant={link.type === "direct" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleBookingLinkClick(restaurant, link)}
                              className="text-xs"
                            >
                              {link.type === "phone" ? (
                                <Phone className="mr-1 h-3 w-3" />
                              ) : (
                                <ExternalLink className="mr-1 h-3 w-3" />
                              )}
                              {link.text}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="pt-3">
                        <Button className="w-full" size="sm" onClick={() => onSelectRestaurant(restaurant)}>
                          Add to Trip
                        </Button>
                        {showProposals && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => onProposeRestaurant?.(restaurant)}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Propose to Group
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
