import { useState, useEffect } from "react";
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
  ExternalLink,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [locationSearch, setLocationSearch] = useState(trip?.destination || "");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    const locationName = location?.city || location?.name || location?.code || location;
    setLocationSearch(locationName);
    if (locationName) {
      setHasSearched(true);
    }
  };

  // Pre-set the location when the component loads with trip destination
  useEffect(() => {
    if (trip?.destination && !selectedLocation) {
      setLocationSearch(trip.destination);
      setSelectedLocation({ 
        name: trip.destination,
        displayName: trip.destination,
        city: trip.destination
      });
    }
  }, [trip?.destination, selectedLocation]);

  const handleSearch = () => {
    if (locationSearch.trim()) {
      setHasSearched(true);
    }
  };

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities/discover", locationSearch, searchTerm, selectedCategory, priceRange, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        location: locationSearch || trip?.destination || "",
        searchTerm,
        category: selectedCategory,
        priceRange,
        sortBy
      });
      
      const response = await fetch(`/api/activities/discover?${params}`, {
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
    enabled: !!locationSearch && hasSearched,
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
            <div className="flex gap-2">
              <div className="flex-1">
                <SmartLocationSearch
                  placeholder={`Search activities in ${trip?.destination || 'any destination'}`}
                  value={locationSearch}
                  onLocationSelect={handleLocationSelect}
                />
              </div>
              <Button onClick={handleSearch} disabled={!locationSearch.trim()}>
                <Search className="w-4 h-4 mr-2" />
                Search Activities
              </Button>
            </div>
            {trip?.destination && !hasSearched && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setLocationSearch(trip.destination);
                  setHasSearched(true);
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
      {!hasSearched ? (
        <Card className="mt-6">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="text-white w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">
              Discover Amazing Activities
            </h3>
            <p className="text-neutral-600 mb-6 max-w-md mx-auto">
              Enter a destination in the search box above to find authentic activities and experiences.
              Try searching for your trip destination: "{trip?.destination}" or any other city you're interested in.
            </p>
            <Button onClick={() => handleSearch()} disabled={!locationSearch.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Search Activities
            </Button>
          </CardContent>
        </Card>
      ) : activitiesLoading ? (
        <Card className="mt-6">
          <CardContent className="text-center py-12">
            <TravelLoading variant="compass" size="lg" text="Discovering amazing activities..." />
          </CardContent>
        </Card>
      ) : activities && activities.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <Card className="mt-6">
          <CardContent className="text-center py-12">
            <h3 className="text-xl font-bold text-neutral-900 mb-2">No Activities Found</h3>
            <p className="text-neutral-600 mb-4">
              No activities were found for "{locationSearch}". Try a different destination or broader search terms.
            </p>
            <Button variant="outline" onClick={() => setHasSearched(false)}>
              Try Different Location
            </Button>
          </CardContent>
        </Card>
      )}

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