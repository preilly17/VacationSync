import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import {
  Search,
  Star,
  Clock,
  MapPin,
  DollarSign,
  ExternalLink
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { TripWithDetails } from "@shared/schema";

interface Activity {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  category: string;
  price: number;
  currency?: string;
  duration: string;
  rating: number;
  bookingUrl: string;
  provider?: string;
  images?: string[];
}

interface ActivitySearchProps {
  tripId: number;
  trip: TripWithDetails;
  user: any;
}

export default function ActivitySearch({ tripId, trip, user }: ActivitySearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [submittedLocation, setSubmittedLocation] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const focusLocationInput = useCallback(() => {
    if (typeof window === "undefined") {
      locationInputRef.current?.focus();
      return;
    }

    window.requestAnimationFrame(() => {
      locationInputRef.current?.focus();
    });
  }, []);

  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    const locationName = location?.city || location?.name || location?.code || location;
    setLocationSearch(locationName);
    focusLocationInput();
  };

  // Prefill destination from query params if provided
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryDestination = params.get("q");
    const autoParam = params.get("auto");

    if (queryDestination) {
      setLocationSearch(queryDestination);
      setSelectedLocation((prev: any) =>
        prev ?? {
          name: queryDestination,
          displayName: queryDestination,
          city: queryDestination
        }
      );

      if (autoParam === "1") {
        setShouldAutoSearch(true);
      }
    }
  }, []);

  useEffect(() => {
    if (shouldAutoSearch && locationSearch.trim()) {
      setSubmittedLocation(locationSearch.trim());
      setHasSearched(true);
      setShouldAutoSearch(false);
    }
  }, [shouldAutoSearch, locationSearch]);

  const handleSearch = () => {
    if (!locationSearch.trim()) {
      setHasSearched(false);
      setSubmittedLocation("");
      return;
    }

    setSubmittedLocation(locationSearch.trim());
    setHasSearched(true);
  };

  const trimmedLocation = useMemo(() => submittedLocation.trim(), [submittedLocation]);

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities/discover", trimmedLocation, searchTerm, selectedCategory, priceRange, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        location: trimmedLocation || trip?.destination || "",
        searchTerm,
        category: selectedCategory,
        priceRange,
        sortBy
      });
      
      const response = await apiFetch(`/api/activities/discover?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to search activities');
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch activities: ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!trimmedLocation && hasSearched,
    retry: 1,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Discover Activities
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search for activities and experiences at your destination
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location Search */}
          <div className="space-y-2">
            <Label>Search Destination</Label>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleSearch();
              }}
            >
              <div className="flex-1">
                <SmartLocationSearch
                  id="discover-activities-destination"
                  placeholder={`Search activities in ${trip?.destination || 'any destination'}`}
                  value={locationSearch}
                  onLocationSelect={handleLocationSelect}
                  ref={locationInputRef}
                />
              </div>
              <Button type="submit" disabled={!locationSearch.trim()}>
                <Search className="w-4 h-4 mr-2" />
                Search Activities
              </Button>
            </form>
            {trip?.destination && !hasSearched && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocationSearch(trip.destination);
                  setHasSearched(false);
                  focusLocationInput();
                }}
                className="mt-2"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Search in {trip.destination}
              </Button>
            )}
          </div>

          {/* Search Filters */}
          {hasSearched && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="sightseeing">Sightseeing</SelectItem>
                  <SelectItem value="food">Food & Dining</SelectItem>
                  <SelectItem value="adventure">Adventure</SelectItem>
                  <SelectItem value="culture">Culture</SelectItem>
                  <SelectItem value="nature">Nature</SelectItem>
                  <SelectItem value="entertainment">Entertainment</SelectItem>
                  <SelectItem value="shopping">Shopping</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="0-25">$0 - $25</SelectItem>
                  <SelectItem value="25-50">$25 - $50</SelectItem>
                  <SelectItem value="50-100">$50 - $100</SelectItem>
                  <SelectItem value="100-200">$100 - $200</SelectItem>
                  <SelectItem value="200+">$200+</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activities Results */}
      {hasSearched ? (
        activitiesLoading ? (
          <Card className="mt-4">
            <CardContent className="text-center py-12">
              <TravelLoading variant="compass" size="lg" text="Discovering amazing activities..." />
            </CardContent>
          </Card>
        ) : activities && activities.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((activity) => (
              <Card
                key={activity.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
                onClick={() => {
                  setSelectedActivity(activity);
                  setShowDetailsDialog(true);
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base lg:text-lg leading-tight">
                    {activity.name}
                  </CardTitle>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-sm text-neutral-600">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-400 mr-1" />
                        <span>{activity.rating}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span className="truncate">{activity.duration}</span>
                      </div>
                    </div>
                    {activity.provider && (
                      <Badge variant="outline" className="text-xs">
                        {activity.provider}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <p className="text-sm text-neutral-600 mb-4 line-clamp-3 flex-1">
                    {activity.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-lg font-semibold text-green-600">
                      <DollarSign className="w-4 h-4" />
                      <span>{activity.currency || '$'}{activity.price}</span>
                    </div>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="text-center py-12">
              <h3 className="text-xl font-bold text-neutral-900 mb-2">No Activities Found</h3>
              <p className="text-neutral-600 mb-4">
                No activities were found for "{submittedLocation || locationSearch}". Try a different destination or broader search terms.
              </p>
              <Button variant="outline" onClick={() => setHasSearched(false)}>
                Try Different Location
              </Button>
            </CardContent>
          </Card>
        )
      ) : null}

      {/* Activity Details Dialog */}
      {selectedActivity && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {selectedActivity.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 text-sm text-neutral-600">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-400 mr-1" />
                  <span>{selectedActivity.rating} rating</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{selectedActivity.duration}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{selectedActivity.location}</span>
                </div>
              </div>
              
              <p className="text-neutral-700 leading-relaxed">
                {selectedActivity.longDescription || selectedActivity.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center text-xl font-bold text-green-600">
                  <DollarSign className="w-5 h-5" />
                  <span>{selectedActivity.currency || '$'}{selectedActivity.price}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                    Close
                  </Button>
                  <Button onClick={() => window.open(selectedActivity.bookingUrl, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}