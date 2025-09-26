import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import SmartLocationSearch, {
  type LocationResult,
  type SmartLocationSearchHandle,
} from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { MapPin, Search, X, Users, Star, Bed, Filter, Loader2, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import type { HotelSearchResult, TripWithDates } from "@shared/schema";

export interface HotelSearchFilters {
  priceLevel: string;
  rating: string;
  freeCancellation: boolean;
}

export interface HotelSearchContext {
  destinationText: string;
  location: LocationResult | null;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  rooms: number;
  filters: HotelSearchFilters;
}

interface HotelSearchPanelProps {
  trip?: TripWithDates | null;
  isOpen: boolean;
  autoSearch?: boolean;
  initialDestination?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialRooms?: number;
  onClose: () => void;
  onSelectHotel: (hotel: HotelSearchResult, context: HotelSearchContext) => Promise<void> | void;
  onProposeHotel?: (hotel: HotelSearchResult, context: HotelSearchContext) => Promise<void> | void;
}

const PRICE_LEVELS = [
  { value: "any", label: "Any price" },
  { value: "value", label: "Budget (≤ $150)" },
  { value: "mid", label: "Comfort ($150 - $300)" },
  { value: "premium", label: "Premium ($300+)" },
];

const RATING_LEVELS = [
  { value: "any", label: "Any rating" },
  { value: "3", label: "3★ & up" },
  { value: "4", label: "4★ & up" },
  { value: "4.5", label: "4.5★ & up" },
];

const parsePositiveInt = (value: string, fallback: number, min = 0) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= min) {
    return parsed;
  }
  return fallback;
};

const parsePriceValue = (price?: string | null) => {
  if (!price) return null;
  const numeric = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const buildSearchPayload = (context: HotelSearchContext) => {
  const locationName = context.location?.name || context.destinationText;
  const payload: Record<string, unknown> = {
    location: locationName,
    checkInDate: context.checkInDate,
    checkOutDate: context.checkOutDate,
    adults: context.adults,
    children: context.children,
    rooms: context.rooms,
    filters: context.filters,
  };

  if (context.location?.country) {
    payload.country = context.location.country;
  }

  if (context.location?.state) {
    payload.state = context.location.state;
  }

  return payload;
};

const sortResultsByPrice = (results: HotelSearchResult[]) => {
  return [...results].sort((a, b) => {
    const priceA = parsePriceValue(a.pricePerNight ?? a.price) ?? Number.POSITIVE_INFINITY;
    const priceB = parsePriceValue(b.pricePerNight ?? b.price) ?? Number.POSITIVE_INFINITY;
    return priceA - priceB;
  });
};

const getDestinationSummary = (context: HotelSearchContext | null) => {
  if (!context) return "";
  try {
    const checkIn = format(new Date(context.checkInDate), "MMM d");
    const checkOut = format(new Date(context.checkOutDate), "MMM d");
    return `${context.destinationText} • ${checkIn} – ${checkOut}`;
  } catch {
    return context.destinationText;
  }
};

const getPriceLabel = (context: HotelSearchContext | null) => {
  if (!context) return null;
  const match = PRICE_LEVELS.find((option) => option.value === context.filters.priceLevel);
  return match?.label ?? null;
};

const getRatingLabel = (context: HotelSearchContext | null) => {
  if (!context) return null;
  const match = RATING_LEVELS.find((option) => option.value === context.filters.rating);
  return match?.label ?? null;
};

export function HotelSearchPanel({
  trip,
  isOpen,
  autoSearch = false,
  initialDestination,
  initialCheckIn,
  initialCheckOut,
  initialAdults,
  initialChildren,
  initialRooms,
  onClose,
  onSelectHotel,
  onProposeHotel,
}: HotelSearchPanelProps) {
  const { toast } = useToast();
  const destinationInputRef = useRef<SmartLocationSearchHandle | null>(null);
  const [destinationInput, setDestinationInput] = useState(() => initialDestination || trip?.destination || "");
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [checkInDate, setCheckInDate] = useState(
    () => initialCheckIn || (trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : ""),
  );
  const [checkOutDate, setCheckOutDate] = useState(
    () => initialCheckOut || (trip?.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : ""),
  );
  const [adultInput, setAdultInput] = useState(() => String(initialAdults ?? 2));
  const [childInput, setChildInput] = useState(() => String(initialChildren ?? 0));
  const [roomInput, setRoomInput] = useState(() => String(initialRooms ?? 1));
  const [priceFilter, setPriceFilter] = useState("any");
  const [ratingFilter, setRatingFilter] = useState("any");
  const [freeCancellation, setFreeCancellation] = useState(false);
  const [searchResults, setSearchResults] = useState<HotelSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [committedContext, setCommittedContext] = useState<HotelSearchContext | null>(null);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [selectionPending, setSelectionPending] = useState<string | null>(null);
  const [proposalPending, setProposalPending] = useState<string | null>(null);

  const adultCount = useMemo(() => Math.max(1, parsePositiveInt(adultInput, 2, 1)), [adultInput]);
  const childCount = useMemo(() => Math.max(0, parsePositiveInt(childInput, 0, 0)), [childInput]);
  const roomCount = useMemo(() => Math.max(1, parsePositiveInt(roomInput, 1, 1)), [roomInput]);

  const canSearch = Boolean(
    destinationInput.trim() &&
    checkInDate &&
    checkOutDate &&
    adultCount > 0,
  );

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => destinationInputRef.current?.focus(), 150);
      return () => clearTimeout(timeout);
    }

    setSearchResults([]);
    setCommittedContext(null);
    setSearchError(null);
    setHasAutoSearched(false);
    setSelectionPending(null);
    setProposalPending(null);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && autoSearch && !hasAutoSearched && canSearch) {
      setHasAutoSearched(true);
      handleSearchConfirm();
    }
  }, [autoSearch, canSearch, hasAutoSearched, isOpen]);

  const searchContext: HotelSearchContext = useMemo(() => ({
    destinationText: destinationInput.trim(),
    location: selectedLocation,
    checkInDate,
    checkOutDate,
    adults: adultCount,
    children: childCount,
    rooms: roomCount,
    filters: {
      priceLevel: priceFilter,
      rating: ratingFilter,
      freeCancellation,
    },
  }), [destinationInput, selectedLocation, checkInDate, checkOutDate, adultCount, childCount, roomCount, priceFilter, ratingFilter, freeCancellation]);

  const executeSearch = useCallback(async (context: HotelSearchContext) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await apiFetch("/api/hotels/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(buildSearchPayload(context)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Hotel search failed (${response.status})`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Unexpected response format from hotel search");
      }

      setSearchResults(sortResultsByPrice(payload));
    } catch (error) {
      console.error("Hotel search error", error);
      setSearchResults([]);
      setSearchError("We couldn't load hotels right now. Please try again in a moment.");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchConfirm = useCallback(() => {
    if (!canSearch) {
      return;
    }

    if (new Date(checkOutDate) < new Date(checkInDate)) {
      toast({
        title: "Check your dates",
        description: "Check-out must be after check-in.",
        variant: "destructive",
      });
      return;
    }

    if (adultCount <= 0) {
      toast({
        title: "Missing guests",
        description: "Please add at least one adult.",
        variant: "destructive",
      });
      return;
    }

    const context = searchContext;
    setCommittedContext(context);
    executeSearch(context);
  }, [adultCount, canSearch, checkInDate, checkOutDate, executeSearch, searchContext, toast]);

  const handleDestinationKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && canSearch) {
      event.preventDefault();
      handleSearchConfirm();
    }
  };

  const handleSelectHotel = async (hotel: HotelSearchResult) => {
    if (!committedContext) {
      toast({
        title: "Search first",
        description: "Run a hotel search before adding to the trip.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSelectionPending(hotel.id);
      await onSelectHotel(hotel, committedContext);
    } catch (error) {
      console.error("Select hotel error", error);
      if (!(error as any)?.handled) {
        toast({
          title: "Couldn't add hotel",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSelectionPending(null);
    }
  };

  const handleProposeHotel = async (hotel: HotelSearchResult) => {
    if (!onProposeHotel || !committedContext) {
      if (!onProposeHotel) return;
      toast({
        title: "Search first",
        description: "Run a hotel search before proposing to the group.",
        variant: "destructive",
      });
      return;
    }

    try {
      setProposalPending(hotel.id);
      await onProposeHotel(hotel, committedContext);
    } catch (error) {
      console.error("Propose hotel error", error);
      if (!(error as any)?.handled) {
        toast({
          title: "Couldn't propose hotel",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setProposalPending(null);
    }
  };

  const renderResultCard = (hotel: HotelSearchResult) => {
    return (
      <Card key={hotel.id} className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span>{hotel.name}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{hotel.location}</p>
              {hotel.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{hotel.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 text-sm font-medium text-amber-600">
                <Star className="h-4 w-4 fill-amber-500" />
                <span>{hotel.rating?.toFixed(1)}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {hotel.platform}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="text-lg font-semibold text-emerald-600">{hotel.price}</span>
            </div>
            {hotel.pricePerNight && (
              <div className="mt-1 text-xs text-muted-foreground">
                ≈ {hotel.pricePerNight} per night
              </div>
            )}
          </div>

          {hotel.amenities && (
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amenities</span>
              <p className="text-sm text-muted-foreground leading-relaxed">{hotel.amenities}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={selectionPending === hotel.id}
              onClick={() => handleSelectHotel(hotel)}
            >
              {selectionPending === hotel.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Select
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!onProposeHotel || proposalPending === hotel.id}
              onClick={() => handleProposeHotel(hotel)}
              className="flex-1"
            >
              {proposalPending === hotel.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Propose
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => window.open(hotel.bookingUrl, "_blank", "noopener,noreferrer")}
            >
              <Bed className="mr-2 h-4 w-4" />
              View Deal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <section className="rounded-2xl border bg-background p-4 shadow-sm sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Search className="h-5 w-5 text-blue-600" />
            Search hotels
          </h2>
          <p className="text-sm text-muted-foreground">
            Stay on this page, search, and add hotels directly to your trip.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close hotel search">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Label className="text-sm font-medium">Destination</Label>
            <SmartLocationSearch
              ref={destinationInputRef}
              placeholder="City, neighborhood, landmark..."
              value={destinationInput}
              onQueryChange={setDestinationInput}
              onLocationSelect={(location) => {
                setSelectedLocation(location);
                setDestinationInput(location.displayName);
              }}
              onKeyDown={handleDestinationKeyDown}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Check-in</Label>
            <Input
              type="date"
              value={checkInDate}
              onChange={(event) => setCheckInDate(event.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Check-out</Label>
            <Input
              type="date"
              value={checkOutDate}
              min={checkInDate || undefined}
              onChange={(event) => setCheckOutDate(event.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Adults</Label>
            <Input
              type="number"
              min={1}
              value={adultInput}
              onChange={(event) => setAdultInput(event.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Children</Label>
            <Input
              type="number"
              min={0}
              value={childInput}
              onChange={(event) => setChildInput(event.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Rooms</Label>
            <Input
              type="number"
              min={1}
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Price</Label>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Any price" />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_LEVELS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Rating</Label>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  {RATING_LEVELS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={freeCancellation}
                onCheckedChange={(value) => setFreeCancellation(Boolean(value))}
              />
              Free cancellation
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPriceFilter("any");
                setRatingFilter("any");
                setFreeCancellation(false);
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Reset filters
            </Button>
            <Button onClick={handleSearchConfirm} disabled={!canSearch || isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search Hotels
                </>
              )}
            </Button>
          </div>
        </div>

        {searchError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>We hit a snag</AlertTitle>
            <AlertDescription>{searchError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {committedContext ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{getDestinationSummary(committedContext)}</span>
              <span>• {committedContext.adults + committedContext.children} guests</span>
              <span>• {committedContext.rooms} rooms</span>
              {getPriceLabel(committedContext) && <Badge variant="secondary">{getPriceLabel(committedContext)}</Badge>}
              {getRatingLabel(committedContext) && <Badge variant="secondary">{getRatingLabel(committedContext)}</Badge>}
              {committedContext.filters.freeCancellation && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Free cancellation
                </Badge>
              )}
              <Badge variant="outline" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a destination and press search to see hotels. We won't run a search until you confirm.
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <TravelLoading variant="globe" size="md" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {searchResults.map((hotel) => renderResultCard(hotel))}
            </div>
          ) : committedContext ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                We couldn't find hotels for this search. Adjust your filters or try another destination.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Your search results will appear here once you confirm a destination and dates.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HotelSearchPanel;
