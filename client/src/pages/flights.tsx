import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/api";
import { format } from "date-fns";
import { Plane, Clock, MapPin, User, Users, Edit, Trash2, Plus, Search, Filter, ArrowUpDown, SlidersHorizontal, ChevronDown, Share2, ArrowLeft, Check, X, PlaneTakeoff, PlaneLanding, ArrowRight, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TravelLoading } from "@/components/LoadingSpinners";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import type { FlightWithDetails, InsertFlight, FlightProposalWithDetails, InsertFlightRanking } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

// Helper function to format duration in minutes to "Xh Ym" format
function formatDuration(minutes: number | string): string {
  const mins = typeof minutes === 'string' ? parseInt(minutes) || 0 : minutes;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return `${hours}h ${remainder}m`;
}

// Helper function to format layovers
function formatLayovers(layoversStr: string | any[]): string {
  if (Array.isArray(layoversStr)) {
    return layoversStr.map((layover: any) => `${layover.airport} (${layover.duration}min)`).join(", ");
  }
  try {
    const layovers = JSON.parse(layoversStr);
    return layovers.map((layover: any) => `${layover.airport} (${layover.duration}min)`).join(", ");
  } catch {
    return layoversStr;
  }
}

// Helper function to get flight status color
function getFlightStatusColor(status: string): string {
  switch (status) {
    case "confirmed": return "bg-green-100 text-green-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "delayed": return "bg-yellow-100 text-yellow-800";
    case "completed": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

// Helper function to get airline name from code
function getAirlineName(airlineCode: string): string {
  const airlineMap: Record<string, string> = {
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'UA': 'United Airlines',
    'SW': 'Southwest Airlines',
    'AS': 'Alaska Airlines',
    'B6': 'JetBlue Airways',
    'F9': 'Frontier Airlines',
    'NK': 'Spirit Airlines',
    'G4': 'Allegiant Air',
    'SY': 'Sun Country Airlines',
    'WN': 'Southwest Airlines',
    'VS': 'Virgin Atlantic',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM',
    'IB': 'Iberia',
    'LX': 'Swiss International',
    'OS': 'Austrian Airlines',
    'SK': 'SAS',
    'AY': 'Finnair',
    'TP': 'TAP Air Portugal',
    'EI': 'Aer Lingus',
    'EY': 'Etihad Airways',
    'QR': 'Qatar Airways',
    'EK': 'Emirates',
    'TK': 'Turkish Airlines',
    'SV': 'Saudi Arabian Airlines',
    'MS': 'EgyptAir',
    'ET': 'Ethiopian Airlines',
    'KE': 'Korean Air',
    'SA': 'South African Airways',
    'JL': 'Japan Airlines',
    'NH': 'All Nippon Airways',
    'CX': 'Cathay Pacific',
    'SQ': 'Singapore Airlines',
    'TG': 'Thai Airways',
    'MH': 'Malaysia Airlines',
    'PR': 'Philippine Airlines',
    'CI': 'China Airlines',
    'BR': 'EVA Air',
    'OZ': 'Asiana Airlines',
    'VN': 'Vietnam Airlines',
    'CA': 'Air China',
    'MU': 'China Eastern',
    'CZ': 'China Southern',
    'AI': 'Air India',
    '6E': 'IndiGo',
    'SG': 'SpiceJet',
    'UK': 'Vistara',
    'I5': 'AirAsia India',
    'QF': 'Qantas',
    'JQ': 'Jetstar',
    'VA': 'Virgin Australia',
    'NZ': 'Air New Zealand',
    'LA': 'LATAM Airlines',
    'AR': 'Aerolíneas Argentinas',
    'G3': 'Gol Linhas Aéreas',
    'JJ': 'TAM Airlines',
    'CM': 'Copa Airlines',
    'AV': 'Avianca',
    'AC': 'Air Canada',
    'WS': 'WestJet'
  };
  
  return airlineMap[airlineCode] || airlineCode;
}

// Helper function to extract airline display name from flight data
function getFlightAirlineName(flight: any): string {
  // Handle different possible formats of airline data from API
  let airlineCode: string = '';
  
  // Try to get the primary airline code from various sources
  if (flight.airlines && Array.isArray(flight.airlines) && flight.airlines.length > 0) {
    // Use the first airline from the airlines array
    airlineCode = flight.airlines[0];
  } else if (flight.airline && typeof flight.airline === 'string') {
    // Use the airline field if it's a string
    airlineCode = flight.airline;
  } else if (flight.segments && Array.isArray(flight.segments) && flight.segments.length > 0) {
    // Get airline from the first segment
    airlineCode = flight.segments[0].airline || flight.segments[0].carrierCode || '';
  } else if (flight.validatingAirlineCodes && Array.isArray(flight.validatingAirlineCodes) && flight.validatingAirlineCodes.length > 0) {
    // Use validating airline codes as fallback
    airlineCode = flight.validatingAirlineCodes[0];
  }
  
  // Clean up the airline code (remove whitespace, convert to uppercase)
  airlineCode = airlineCode.toString().trim().toUpperCase();
  
  // If we have a valid airline code (2-3 characters), use the mapping
  if (airlineCode && airlineCode.length >= 2 && airlineCode.length <= 3) {
    return getAirlineName(airlineCode);
  }
  
  // If the airline code is longer, it might already be a full name
  if (airlineCode && airlineCode.length > 3) {
    return airlineCode;
  }
  
  // Fallback to 'Various Airlines' if we can't determine the airline
  return 'Various Airlines';
}

export default function FlightsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [, setLocation] = useLocation();
  const [isAddFlightOpen, setIsAddFlightOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<FlightWithDetails | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFormData, setSearchFormData] = useState({
    departure: '',
    arrival: '',
    departureDate: '',
    returnDate: '',
    passengers: '1',
    airline: ''
  });
  const [filters, setFilters] = useState({
    maxPrice: '',
    maxStops: '',
    airlines: [] as string[],
    departureTimeRange: '',
    duration: '',
    sortBy: 'duration' as 'price' | 'duration' | 'departure' | 'arrival',
    sortOrder: 'asc' as 'asc' | 'desc'
  });
  
  // Store cached search parameters to avoid re-triggering location searches
  const [cachedSearchParams, setCachedSearchParams] = useState<{
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    passengers: number;
    originCode?: string;
    destinationCode?: string;
  } | null>(null);
  
  // Server-side filter state with caching
  const [activeFilter, setActiveFilter] = useState<'best' | 'cheapest' | 'fastest'>('best');
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterResultCounts, setFilterResultCounts] = useState({
    best: 0,
    cheapest: 0,
    fastest: 0
  });
  const [filterResults, setFilterResults] = useState({
    best: [] as any[],
    cheapest: [] as any[],
    fastest: [] as any[]
  });
  
  // Flight form state
  const [flightFormData, setFlightFormData] = useState({
    flightNumber: '',
    airline: '',
    airlineCode: '',
    departureAirport: '',
    departureCode: '',
    departureTime: '',
    arrivalAirport: '',
    arrivalCode: '',
    arrivalTime: '',
    price: '',
    seatClass: 'economy',
    flightType: 'outbound',
    bookingReference: '',
    aircraft: '',
    status: 'confirmed'
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Handle filter switching with loading states - FIXED to prevent location searches
  const handleFilterChange = async (newFilter: 'best' | 'cheapest' | 'fastest') => {
    if (newFilter === activeFilter || filterLoading || searchResults.length === 0) return;
    
    setFilterLoading(true);
    setActiveFilter(newFilter);
    
    // If we already have results for this filter, just switch to them
    if (filterResults[newFilter].length > 0) {
      setFilterLoading(false);
      return;
    }
    
    // Use cached search parameters to avoid triggering location searches
    if (!cachedSearchParams) {
      console.warn('No cached search parameters available for filter change');
      // Apply local sorting as fallback
      const sortedResults = [...searchResults].sort((a: any, b: any) => {
        switch (newFilter) {
          case 'cheapest':
            return (a.price || a.totalPrice || 0) - (b.price || b.totalPrice || 0);
          case 'fastest':
            const getDurationMinutes = (durationStr: string) => {
              if (!durationStr) return 999999;
              const hours = durationStr.match(/(\d+)h/)?.[1] || '0';
              const minutes = durationStr.match(/(\d+)m/)?.[1] || '0';
              return parseInt(hours) * 60 + parseInt(minutes);
            };
            return getDurationMinutes(a.duration) - getDurationMinutes(b.duration);
          case 'best':
          default:
            const priceWeight = 0.6;
            const durationWeight = 0.4;
            const normalizePrice = (price: number) => Math.min(price / 1000, 1);
            const normalizeDuration = (duration: string) => {
              const minutes = getDurationMinutes(duration);
              return Math.min(minutes / 600, 1);
            };
            
            const aScore = (normalizePrice(a.price || a.totalPrice || 0) * priceWeight) + 
                         (normalizeDuration(a.duration) * durationWeight);
            const bScore = (normalizePrice(b.price || b.totalPrice || 0) * priceWeight) + 
                         (normalizeDuration(b.duration) * durationWeight);
            return aScore - bScore;
        }
      });
      
      setFilterResults(prev => ({
        ...prev,
        [newFilter]: sortedResults
      }));
      setFilterLoading(false);
      return;
    }
    
    // Use cached parameters with airport codes to prevent location searches
    try {
      const response = await apiRequest("/api/search/flights", {
        method: "POST",
        body: {
          // Use cached airport codes instead of location names to prevent location searches
          origin: cachedSearchParams.originCode || cachedSearchParams.origin,
          destination: cachedSearchParams.destinationCode || cachedSearchParams.destination,
          departureDate: cachedSearchParams.departureDate,
          returnDate: cachedSearchParams.returnDate || undefined,
          passengers: cachedSearchParams.passengers,
          airline: searchFormData.airline && searchFormData.airline !== 'any' ? searchFormData.airline : undefined,
          provider: 'both', // Use both Amadeus and Duffel providers
          filter: newFilter, // Add filter parameter
          page: 1,
          limit: 50
        }
      });

      const searchResponse = await response.json();
      console.log(`${newFilter} filter search response:`, searchResponse);
      
      if (searchResponse && searchResponse.flights && Array.isArray(searchResponse.flights) && searchResponse.flights.length > 0) {
        // Update filter results
        setFilterResults(prev => ({
          ...prev,
          [newFilter]: searchResponse.flights
        }));
        
        // Update result counts from server response
        if (searchResponse.filters) {
          setFilterResultCounts(searchResponse.filters);
        } else {
          setFilterResultCounts(prev => ({
            ...prev,
            [newFilter]: searchResponse.flights.length
          }));
        }
        
        toast({
          title: `${newFilter.charAt(0).toUpperCase() + newFilter.slice(1)} Filter Applied`,
          description: `Found ${searchResponse.flights.length} flights optimized for ${newFilter === 'best' ? 'best overall value' : newFilter === 'cheapest' ? 'lowest price' : 'shortest flight time'}`,
        });
      } else {
        // Use the current search results as fallback but apply local sorting
        const sortedResults = [...searchResults].sort((a: any, b: any) => {
          switch (newFilter) {
            case 'cheapest':
              return (a.price || a.totalPrice || 0) - (b.price || b.totalPrice || 0);
            case 'fastest':
              const getDurationMinutes = (durationStr: string) => {
                if (!durationStr) return 999999;
                const hours = durationStr.match(/(\d+)h/)?.[1] || '0';
                const minutes = durationStr.match(/(\d+)m/)?.[1] || '0';
                return parseInt(hours) * 60 + parseInt(minutes);
              };
              return getDurationMinutes(a.duration) - getDurationMinutes(b.duration);
            case 'best':
            default:
              // Best balance of price and duration
              const priceWeight = 0.6;
              const durationWeight = 0.4;
              const normalizePrice = (price: number) => Math.min(price / 1000, 1);
              const normalizeDuration = (duration: string) => {
                const minutes = getDurationMinutes(duration);
                return Math.min(minutes / 600, 1); // 10 hours = 1.0
              };
              
              const aScore = (normalizePrice(a.price || a.totalPrice || 0) * priceWeight) + 
                           (normalizeDuration(a.duration) * durationWeight);
              const bScore = (normalizePrice(b.price || b.totalPrice || 0) * priceWeight) + 
                           (normalizeDuration(b.duration) * durationWeight);
              return aScore - bScore;
          }
        });
        
        setFilterResults(prev => ({
          ...prev,
          [newFilter]: sortedResults
        }));
        
        setFilterResultCounts(prev => ({
          ...prev,
          [newFilter]: sortedResults.length
        }));
      }
    } catch (error: any) {
      console.error(`${newFilter} filter error:`, error);
      toast({
        title: "Filter Error",
        description: `Unable to apply ${newFilter} filter. Using current results.`,
        variant: "destructive",
      });
      
      // Fallback to current results with local sorting
      const sortedResults = [...searchResults];
      setFilterResults(prev => ({
        ...prev,
        [newFilter]: sortedResults
      }));
    } finally {
      setFilterLoading(false);
    }
  };

  const { data: flights, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/flights`, activeFilter], // Include filter in cache key
    enabled: !!tripId,
  });

  // Ensure flights is always an array
  const flightsArray = Array.isArray(flights) ? flights : [];

  const { data: trip } = useQuery({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId,
  });

  // Flight proposals for group voting
  const { data: flightProposals = [] as FlightProposalWithDetails[], isLoading: proposalsLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/flight-proposals`],
    enabled: !!tripId,
  });

  // State to track if we've already prefilled to avoid overriding user changes
  const [hasPrefilledSearch, setHasPrefilledSearch] = useState(false);

  // Prefill flight search form with user default location and trip destination
  useEffect(() => {
    if (user && trip && !hasPrefilledSearch) {
      const newSearchData = { ...searchFormData };
      let hasChanges = false;

      // Prefill departure with user's default location (prefer airport code for flights)
      if (user.defaultLocationCode && !searchFormData.departure) {
        newSearchData.departure = user.defaultLocationCode;
        hasChanges = true;
      } else if (user.defaultLocation && !searchFormData.departure) {
        newSearchData.departure = user.defaultLocation;
        hasChanges = true;
      }

      // Prefill arrival with trip destination
      if ((trip as any).destination && !searchFormData.arrival) {
        newSearchData.arrival = (trip as any).destination;
        hasChanges = true;
      }

      // Prefill dates with trip dates
      if ((trip as any).startDate && !searchFormData.departureDate) {
        newSearchData.departureDate = format(new Date((trip as any).startDate), 'yyyy-MM-dd');
        hasChanges = true;
      }

      if ((trip as any).endDate && !searchFormData.returnDate) {
        newSearchData.returnDate = format(new Date((trip as any).endDate), 'yyyy-MM-dd');
        hasChanges = true;
      }

      if (hasChanges) {
        setSearchFormData(newSearchData);
        setHasPrefilledSearch(true);
      }
    }
  }, [user, trip, hasPrefilledSearch]); // FIXED: Removed searchFormData to prevent circular dependency

  const createFlightMutation = useMutation({
    mutationFn: async (flightData: InsertFlight) => {
      return apiRequest(`/api/trips/${tripId}/flights`, {
        method: "POST",
        body: flightData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "flights"] });
      setIsAddFlightOpen(false);
      setEditingFlight(null);
      resetFlightForm();
      toast({
        title: "Success",
        description: "Flight added successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add flight",
        variant: "destructive",
      });
    },
  });

  const updateFlightMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<InsertFlight> }) => {
      return apiRequest(`/api/flights/${data.id}`, {
        method: "PUT",
        body: data.updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "flights"] });
      setEditingFlight(null);
      toast({
        title: "Success",
        description: "Flight updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update flight",
        variant: "destructive",
      });
    },
  });

  const deleteFlightMutation = useMutation({
    mutationFn: async (flightId: number) => {
      return apiRequest(`/api/flights/${flightId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "flights"] });
      toast({
        title: "Success",
        description: "Flight deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete flight",
        variant: "destructive",
      });
    },
  });

  // Flight ranking functionality
  const submitFlightRanking = async (proposalId: number, ranking: number, notes?: string) => {
    try {
      await apiRequest(`/api/flight-proposals/${proposalId}/rank`, {
        method: "POST",
        body: JSON.stringify({ ranking, notes }),
      });
      
      toast({
        title: "Ranking Submitted!",
        description: "Your flight preference has been recorded.",
      });
      
      // Refresh proposals
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "flight-proposals"] });
      
    } catch (error) {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to rank flights.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = buildApiUrl("/api/login");
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

  // Share flight with group as a proposal
  const shareFlightWithGroup = async (flight: any) => {
    try {
      // Extract and format flight data for the proposal API (matching backend expectations)
      const proposalData = {
        airline: flight.airline || 'Various Airlines',
        flightNumber: flight.flightNumber || `Flight-${Date.now()}`,
        departure: flight.departure?.airport || flight.departureAirport || searchFormData.departure,
        departureTime: flight.departure?.time || flight.departureTime || new Date().toISOString(),
        arrival: flight.arrival?.airport || flight.arrivalAirport || searchFormData.arrival, 
        arrivalTime: flight.arrival?.time || flight.arrivalTime || new Date().toISOString(),
        duration: flight.duration || '2h 30m',
        stops: flight.stops !== undefined ? flight.stops : 0,
        aircraft: flight.aircraft || 'Unknown Aircraft',
        price: flight.price || flight.totalPrice || 0,
        bookingClass: flight.class || searchFormData.cabinClass || 'Economy',
        platform: 'Amadeus',
        bookingUrl: flight.bookingUrls?.kayak || flight.bookingUrls?.expedia || '#'
      };

      await apiRequest(`/api/trips/${tripId}/flight-proposals`, {
        method: "POST",
        body: proposalData,
      });

      // Invalidate flight proposals cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "flight-proposals"] });
      
      toast({
        title: "Flight Proposed to Group!",
        description: `${proposalData.airline} flight ${proposalData.flightNumber} has been proposed to your group for ranking and voting.`,
      });
      
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to propose flights.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = buildApiUrl("/api/login");
        }, 500);
        return;
      }
      console.error("Error proposing flight:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to propose flight to group. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Form helper functions
  const resetFlightForm = () => {
    setFlightFormData({
      flightNumber: '',
      airline: '',
      airlineCode: '',
      departureAirport: '',
      departureCode: '',
      departureTime: '',
      arrivalAirport: '',
      arrivalCode: '',
      arrivalTime: '',
      price: '',
      seatClass: 'economy',
      flightType: 'outbound',
      bookingReference: '',
      aircraft: '',
      status: 'confirmed'
    });
  };

  const populateFlightForm = (flight: any) => {
    setFlightFormData({
      flightNumber: flight.flightNumber || '',
      airline: flight.airline || '',
      airlineCode: flight.airlineCode || '',
      departureAirport: flight.departureAirport || '',
      departureCode: flight.departureCode || '',
      departureTime: flight.departureTime ? new Date(flight.departureTime).toISOString().slice(0, 16) : '',
      arrivalAirport: flight.arrivalAirport || '',
      arrivalCode: flight.arrivalCode || '',
      arrivalTime: flight.arrivalTime ? new Date(flight.arrivalTime).toISOString().slice(0, 16) : '',
      price: flight.price?.toString() || '',
      seatClass: flight.seatClass || 'economy',
      flightType: flight.flightType || 'outbound',
      bookingReference: flight.bookingReference || '',
      aircraft: flight.aircraft || '',
      status: flight.status || 'confirmed'
    });
  };

  const handleFlightSubmit = () => {
    if (!flightFormData.flightNumber || !flightFormData.airline || !flightFormData.departureAirport || !flightFormData.arrivalAirport) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...flightFormData,
      tripId: parseInt(tripId!),
      departureTime: new Date(flightFormData.departureTime),
      arrivalTime: new Date(flightFormData.arrivalTime),
      price: flightFormData.price || undefined,
    };

    if (editingFlight) {
      updateFlightMutation.mutate({
        id: editingFlight.id,
        updates: submitData
      });
    } else {
      createFlightMutation.mutate(submitData);
    }
  };

  const handleEditFlight = (flight: any) => {
    setEditingFlight(flight);
    populateFlightForm(flight);
    setIsAddFlightOpen(true);
  };

  const handleCancelEdit = () => {
    setIsAddFlightOpen(false);
    setEditingFlight(null);
    resetFlightForm();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <TravelLoading variant="plane" size="lg" text="Loading flight coordination..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href={`/trip/${tripId}`}>
            <Button 
              variant="outline" 
              size="sm"
              className="mb-6 flex items-center hover:bg-gray-50"
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Trip
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Flight Coordination</h1>
            <p className="text-gray-600 mt-1">
              Manage flights for {(trip as any)?.name || 'your trip'}
            </p>
          </div>
          <Dialog open={isAddFlightOpen} onOpenChange={setIsAddFlightOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Flight
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingFlight ? 'Edit Flight Information' : 'Add Flight Information'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="flightNumber">Flight Number *</Label>
                    <Input 
                      id="flightNumber" 
                      placeholder="e.g., AA123" 
                      value={flightFormData.flightNumber}
                      onChange={(e) => setFlightFormData(prev => ({ ...prev, flightNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="airline">Airline *</Label>
                    <Input 
                      id="airline" 
                      placeholder="e.g., American Airlines" 
                      value={flightFormData.airline}
                      onChange={(e) => setFlightFormData(prev => ({ ...prev, airline: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="departureAirport">From *</Label>
                    <SmartLocationSearch
                      placeholder="Departure airport (e.g., JFK, New York)"
                      value={flightFormData.departureAirport}
                      onLocationSelect={(location) => setFlightFormData(prev => ({ 
                        ...prev, 
                        departureAirport: location.displayName,
                        departureCode: location.code 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="arrivalAirport">To *</Label>
                    <SmartLocationSearch
                      placeholder="Arrival airport (e.g., LAX, Los Angeles)"
                      value={flightFormData.arrivalAirport}
                      onLocationSelect={(location) => setFlightFormData(prev => ({ 
                        ...prev, 
                        arrivalAirport: location.displayName,
                        arrivalCode: location.code 
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="departureTime">Departure Time *</Label>
                    <Input 
                      id="departureTime" 
                      type="datetime-local" 
                      value={flightFormData.departureTime}
                      onChange={(e) => setFlightFormData(prev => ({ ...prev, departureTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="arrivalTime">Arrival Time *</Label>
                    <Input 
                      id="arrivalTime" 
                      type="datetime-local" 
                      value={flightFormData.arrivalTime}
                      onChange={(e) => setFlightFormData(prev => ({ ...prev, arrivalTime: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input 
                      id="price" 
                      type="number" 
                      placeholder="0.00" 
                      value={flightFormData.price}
                      onChange={(e) => setFlightFormData(prev => ({ ...prev, price: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="seatClass">Seat Class</Label>
                    <Select 
                      value={flightFormData.seatClass} 
                      onValueChange={(value) => setFlightFormData(prev => ({ ...prev, seatClass: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="premium">Premium Economy</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="first">First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="flightType">Flight Type</Label>
                    <Select 
                      value={flightFormData.flightType} 
                      onValueChange={(value) => setFlightFormData(prev => ({ ...prev, flightType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                        <SelectItem value="connecting">Connecting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bookingReference">Booking Reference</Label>
                    <Input 
                      id="bookingReference" 
                      placeholder="e.g., ABC123" 
                      value={flightFormData.bookingReference}
                      onChange={(e) => setFlightFormData(prev => ({ ...prev, bookingReference: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleFlightSubmit}
                    disabled={createFlightMutation.isPending || updateFlightMutation.isPending}
                  >
                    {createFlightMutation.isPending || updateFlightMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        {editingFlight ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      editingFlight ? 'Update Flight' : 'Add Flight'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs for Flight Search vs Group Voting */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search & Propose Flights</TabsTrigger>
          <TabsTrigger value="voting" className="relative">
            Group Voting
            {(flightProposals as FlightProposalWithDetails[]).length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {(flightProposals as FlightProposalWithDetails[]).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings">My Flight Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6 mt-6">
          {/* Flight Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Flights
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <Label htmlFor="departure">From</Label>
                <SmartLocationSearch
                  placeholder="Departure city or airport"
                  value={searchFormData.departure}
                  onLocationSelect={(location) => setSearchFormData(prev => ({ ...prev, departure: location.displayName }))}
                />
              </div>
              <div>
                <Label htmlFor="arrival">To</Label>
                <SmartLocationSearch
                  placeholder="Arrival city or airport"
                  value={searchFormData.arrival}
                  onLocationSelect={(location) => setSearchFormData(prev => ({ ...prev, arrival: location.displayName }))}
                />
              </div>
              <div>
                <Label htmlFor="departureDate">Departure</Label>
                <Input
                  id="departureDate"
                  type="date"
                  value={searchFormData.departureDate}
                  onChange={(e) => setSearchFormData(prev => ({ ...prev, departureDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="returnDate">Return (Optional)</Label>
                <Input
                  id="returnDate"
                  type="date"
                  value={searchFormData.returnDate}
                  onChange={(e) => setSearchFormData(prev => ({ ...prev, returnDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-4 items-end">
              <div>
                <Label htmlFor="passengers">Passengers</Label>
                <Select value={searchFormData.passengers} onValueChange={(value) => setSearchFormData(prev => ({ ...prev, passengers: value }))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num} {num === 1 ? 'passenger' : 'passengers'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="airline">Airline</Label>
                <Select value={searchFormData.airline} onValueChange={(value) => setSearchFormData(prev => ({ ...prev, airline: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Any airline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Airline</SelectItem>
                    <SelectItem value="AA">American Airlines</SelectItem>
                    <SelectItem value="DL">Delta Air Lines</SelectItem>
                    <SelectItem value="UA">United Airlines</SelectItem>
                    <SelectItem value="SW">Southwest Airlines</SelectItem>
                    <SelectItem value="AS">Alaska Airlines</SelectItem>
                    <SelectItem value="B6">JetBlue Airways</SelectItem>
                    <SelectItem value="F9">Frontier Airlines</SelectItem>
                    <SelectItem value="NK">Spirit Airlines</SelectItem>
                    <SelectItem value="G4">Allegiant Air</SelectItem>
                    <SelectItem value="VS">Virgin Atlantic</SelectItem>
                    <SelectItem value="BA">British Airways</SelectItem>
                    <SelectItem value="LH">Lufthansa</SelectItem>
                    <SelectItem value="AF">Air France</SelectItem>
                    <SelectItem value="KL">KLM</SelectItem>
                    <SelectItem value="IB">Iberia</SelectItem>
                    <SelectItem value="OS">Austrian Airlines</SelectItem>
                    <SelectItem value="EY">Etihad Airways</SelectItem>
                    <SelectItem value="QR">Qatar Airways</SelectItem>
                    <SelectItem value="EK">Emirates</SelectItem>
                    <SelectItem value="TK">Turkish Airlines</SelectItem>
                    <SelectItem value="JL">Japan Airlines</SelectItem>
                    <SelectItem value="NH">All Nippon Airways</SelectItem>
                    <SelectItem value="CX">Cathay Pacific</SelectItem>
                    <SelectItem value="SQ">Singapore Airlines</SelectItem>
                    <SelectItem value="AC">Air Canada</SelectItem>
                    <SelectItem value="WS">WestJet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={async () => {
                  if (!searchFormData.departure || !searchFormData.arrival || !searchFormData.departureDate) {
                    toast({
                      title: "Missing Information",
                      description: "Please fill in departure, arrival, and departure date",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setIsSearching(true);
                  
                  try {
                    const response = await apiRequest("/api/search/flights", {
                      method: "POST",
                      body: {
                        origin: searchFormData.departure,
                        destination: searchFormData.arrival,
                        departureDate: searchFormData.departureDate,
                        returnDate: searchFormData.returnDate || undefined,
                        passengers: parseInt(searchFormData.passengers),
                        airline: searchFormData.airline && searchFormData.airline !== 'any' ? searchFormData.airline : undefined,
                        provider: 'both', // Use both Amadeus and Duffel providers
                        page: 1,
                        limit: 50
                      }
                    });

                    // Parse the JSON response from the Response object
                    const searchResponse = await response.json();
                    console.log("Flight search response:", searchResponse);
                    
                    // Handle new paginated response format
                    if (searchResponse && searchResponse.flights && Array.isArray(searchResponse.flights) && searchResponse.flights.length > 0) {
                      setSearchResults(searchResponse.flights);
                      
                      // Cache search parameters to prevent location searches in filter changes
                      setCachedSearchParams({
                        origin: searchFormData.departure,
                        destination: searchFormData.arrival,
                        departureDate: searchFormData.departureDate,
                        returnDate: searchFormData.returnDate,
                        passengers: parseInt(searchFormData.passengers),
                        // Store both original location names and any resolved airport codes
                        originCode: searchFormData.departure.length === 3 ? searchFormData.departure : undefined,
                        destinationCode: searchFormData.arrival.length === 3 ? searchFormData.arrival : undefined
                      });
                      
                      // Initialize filter results using server-side response
                      setFilterResults({
                        best: searchResponse.flights,
                        cheapest: [],
                        fastest: []
                      });
                      
                      // Initialize filter counts from server response
                      if (searchResponse.filters) {
                        setFilterResultCounts(searchResponse.filters);
                      } else {
                        setFilterResultCounts({
                          best: searchResponse.flights.length,
                          cheapest: 0,
                          fastest: 0
                        });
                      }
                      
                      // Ensure "best" filter is active
                      setActiveFilter('best');
                      
                      const totalFromSources = (searchResponse.sources?.amadeus || 0) + (searchResponse.sources?.duffel || 0) + (searchResponse.sources?.kayak || 0);
                      toast({
                        title: "Flight Search Complete",
                        description: `Found ${searchResponse.pagination?.total || searchResponse.flights.length} flights from ${totalFromSources} total sources - Amadeus: ${searchResponse.sources?.amadeus || 0}, Duffel: ${searchResponse.sources?.duffel || 0}, Kayak: ${searchResponse.sources?.kayak || 0}`,
                      });
                    } else {
                      setSearchResults([]);
                      setFilterResults({
                        best: [],
                        cheapest: [],
                        fastest: []
                      });
                      setFilterResultCounts({
                        best: 0,
                        cheapest: 0,
                        fastest: 0
                      });
                      toast({
                        title: "No Flights Found",
                        description: "Try adjusting your search criteria or dates",
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    console.error("Flight search error:", error);
                    setSearchResults([]);
                    toast({
                      title: "Search Failed",
                      description: error?.message || "Unable to search flights. Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSearching(false);
                  }
                }}
                disabled={isSearching}
                className="px-8"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search Flights
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results Section */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Flight Search Results
                </CardTitle>
                {/* Kayak-style Filter Buttons */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={activeFilter === 'best' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('best')}
                    disabled={filterLoading}
                    className={`relative ${activeFilter === 'best' ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                    data-testid="filter-best"
                  >
                    {filterLoading && activeFilter === 'best' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-600 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      </div>
                    )}
                    🏆 Best
                    {filterResultCounts.best > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {filterResultCounts.best}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant={activeFilter === 'cheapest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('cheapest')}
                    disabled={filterLoading}
                    className={`relative ${activeFilter === 'cheapest' ? 'bg-green-600 text-white' : 'hover:bg-green-50'}`}
                    data-testid="filter-cheapest"
                  >
                    {filterLoading && activeFilter === 'cheapest' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-green-600 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      </div>
                    )}
                    💰 Cheapest
                    {filterResultCounts.cheapest > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {filterResultCounts.cheapest}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant={activeFilter === 'fastest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('fastest')}
                    disabled={filterLoading}
                    className={`relative ${activeFilter === 'fastest' ? 'bg-purple-600 text-white' : 'hover:bg-purple-50'}`}
                    data-testid="filter-fastest"
                  >
                    {filterLoading && activeFilter === 'fastest' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-purple-600 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      </div>
                    )}
                    ⚡ Fastest
                    {filterResultCounts.fastest > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {filterResultCounts.fastest}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Result Statistics - Kayak Style */}
              {(() => {
                const currentResults = filterResults[activeFilter].length > 0 ? filterResults[activeFilter] : searchResults;
                if (currentResults.length === 0) return null;
                
                // Calculate statistics
                const flightCount = currentResults.length;
                const prices = currentResults.map((f: any) => f.price || f.totalPrice || 0).filter(p => p > 0);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                
                const durations = currentResults.map((f: any) => {
                  if (!f.duration) return 0;
                  const hours = f.duration.match(/(\d+)h/)?.[1] || '0';
                  const minutes = f.duration.match(/(\d+)m/)?.[1] || '0';
                  return parseInt(hours) * 60 + parseInt(minutes);
                }).filter(d => d > 0);
                
                const avgDuration = durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;
                const avgHours = Math.floor(avgDuration / 60);
                const avgMinutes = avgDuration % 60;
                
                return (
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-6 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">{flightCount}</span>
                          <span>flights found</span>
                        </div>
                        {prices.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Price range:</span>
                            <span className="font-medium">${minPrice}{minPrice !== maxPrice && ` - $${maxPrice}`}</span>
                          </div>
                        )}
                        {avgDuration > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Avg. flight time:</span>
                            <span className="font-medium">{avgHours}h {avgMinutes}m</span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Filter: {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} 
                        {activeFilter === 'best' && ' (balanced price & time)'}
                        {activeFilter === 'cheapest' && ' (lowest price first)'}
                        {activeFilter === 'fastest' && ' (shortest duration first)'}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <div className="space-y-4">
                {/* Display results for active filter */}
                {(filterResults[activeFilter].length > 0 ? filterResults[activeFilter] : searchResults)
                  .map((flight: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Plane className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold">{getFlightAirlineName(flight)}</span>
                          <span className="text-gray-500">{flight.flightNumber || `Flight ${index + 1}`}</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          Available
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          ${flight.price ? Math.round(flight.price) : flight.totalPrice || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">per person</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <PlaneTakeoff className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="font-medium">{flight.departure?.airport || flight.departureAirport || searchFormData.departure}</div>
                          <div className="text-gray-500">
                            {flight.departure?.time ? new Date(flight.departure.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Departure time varies'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="mx-2 text-xs text-gray-500">
                          {flight.duration ? flight.duration.replace('PT', '').replace('H', 'h ').replace('M', 'm') : 'Duration varies'}
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <PlaneLanding className="h-4 w-4 text-red-600" />
                        <div>
                          <div className="font-medium">{flight.arrival?.airport || flight.arrivalAirport || searchFormData.arrival}</div>
                          <div className="text-gray-500">
                            {flight.arrival?.time ? new Date(flight.arrival.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Arrival time varies'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {flight.stops !== undefined && (
                          <span>{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</span>
                        )}
                        {flight.class && (
                          <span className="capitalize">{flight.class}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {/* Always show booking options for legitimate flight booking platforms */}
                        <Button 
                          size="sm" 
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          asChild
                          data-testid={`button-book-kayak-${index}`}
                        >
                          <a 
                            href={`https://www.kayak.com/flights/${cachedSearchParams?.originCode || 'ATL'}-${cachedSearchParams?.destinationCode || 'MIA'}/${searchFormData.departureDate}${searchFormData.returnDate ? `/${searchFormData.returnDate}` : ''}?sort=bestflight_a`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Book on Kayak
                          </a>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          asChild
                          data-testid={`button-book-expedia-${index}`}
                        >
                          <a 
                            href={`https://www.expedia.com/Flights-Search?trip=${searchFormData.returnDate ? 'roundtrip' : 'oneway'}&leg1=from:${cachedSearchParams?.originCode || 'ATL'},to:${cachedSearchParams?.destinationCode || 'MIA'},departure:${searchFormData.departureDate}TANYT${searchFormData.returnDate ? `&leg2=from:${cachedSearchParams?.destinationCode || 'MIA'},to:${cachedSearchParams?.originCode || 'ATL'},departure:${searchFormData.returnDate}TANYT` : ''}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Book on Expedia
                          </a>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => shareFlightWithGroup(flight)}
                          data-testid={`button-propose-flight-${index}`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Propose to Group
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setFlightFormData({
                              flightNumber: flight.flightNumber || '',
                              airline: getFlightAirlineName(flight),
                              airlineCode: flight.airlineCode || '',
                              departureAirport: flight.departure?.airport || flight.departureAirport || searchFormData.departure,
                              departureCode: flight.departure?.iataCode || flight.departureCode || '',
                              departureTime: flight.departure?.time || flight.departureTime || '',
                              arrivalAirport: flight.arrival?.airport || flight.arrivalAirport || searchFormData.arrival,
                              arrivalCode: flight.arrival?.iataCode || flight.arrivalCode || '',
                              arrivalTime: flight.arrival?.time || flight.arrivalTime || '',
                              price: flight.price?.toString() || flight.totalPrice?.toString() || '',
                              seatClass: flight.class || 'economy',
                              flightType: 'outbound',
                              bookingReference: '',
                              aircraft: flight.aircraft || '',
                              status: 'confirmed'
                            });
                            setEditingFlight(null);
                            setIsAddFlightOpen(true);
                          }}
                          data-testid={`button-add-to-trip-${index}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add to Trip
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Group Flights Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Group Flights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flightsArray.length === 0 ? (
              <div className="text-center py-8">
                <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No flights added yet</h3>
                <p className="text-gray-500 mb-4">
                  Start by adding flight information for your group members.
                </p>
                <Button onClick={() => {
                  resetFlightForm();
                  setEditingFlight(null);
                  setIsAddFlightOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Flight
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {flightsArray.map((flight: any) => (
                  <div key={flight.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Plane className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold">{flight.airline}</span>
                          <span className="text-gray-500">{flight.flightNumber}</span>
                        </div>
                        <Badge className={getFlightStatusColor(flight.status)}>
                          {flight.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditFlight(flight)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFlightMutation.mutate(flight.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <PlaneTakeoff className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="font-medium">{flight.departureAirport}</div>
                          <div className="text-gray-500">
                            {flight.departureTime ? format(new Date(flight.departureTime), 'MMM d, h:mm a') : 'Time TBD'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="mx-2 text-xs text-gray-500">
                          {flight.flightDuration ? formatDuration(flight.flightDuration) : 'Duration TBD'}
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <PlaneLanding className="h-4 w-4 text-red-600" />
                        <div>
                          <div className="font-medium">{flight.arrivalAirport}</div>
                          <div className="text-gray-500">
                            {flight.arrivalTime ? format(new Date(flight.arrivalTime), 'MMM d, h:mm a') : 'Time TBD'}
                          </div>
                        </div>
                      </div>
                    </div>
                    {flight.price && (
                      <div className="mt-2 text-sm text-gray-600">
                        Price: ${flight.price} {flight.currency || 'USD'}
                        {flight.seatClass && ` • ${flight.seatClass}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* Group Voting Tab */}
        <TabsContent value="voting" className="space-y-6 mt-6">
          {/* Group Flight Proposals */}
          {(flightProposals as FlightProposalWithDetails[]).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Group Flight Proposals ({(flightProposals as FlightProposalWithDetails[]).length})
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Rank these flights from 1 (most preferred) to help your group decide
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {(flightProposals as FlightProposalWithDetails[]).map((proposal: FlightProposalWithDetails) => (
                    <Card key={proposal.id} className="relative">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                              <PlaneTakeoff className="h-5 w-5 text-blue-600" />
                              {proposal.airline} {proposal.flightNumber}
                            </CardTitle>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {proposal.departureAirport} → {proposal.arrivalAirport}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {proposal.duration}
                              </div>
                              {proposal.stops > 0 && (
                                <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  {proposal.stops} stop{proposal.stops > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Proposed by {proposal.proposer?.firstName || 'Group Member'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">${proposal.price}</div>
                            {proposal.averageRanking && (
                              <div className="text-sm text-muted-foreground">
                                Avg: #{proposal.averageRanking}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <PlaneTakeoff className="h-3 w-3" />
                                Departure:
                              </div>
                              <div className="font-medium">
                                {new Date(proposal.departureTime).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <PlaneLanding className="h-3 w-3" />
                                Arrival:
                              </div>
                              <div className="font-medium">
                                {new Date(proposal.arrivalTime).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-muted-foreground">Your Ranking:</div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((rank) => (
                                <Button
                                  key={rank}
                                  size="sm"
                                  variant={proposal.currentUserRanking?.ranking === rank ? "default" : "outline"}
                                  onClick={() => submitFlightRanking(proposal.id, rank)}
                                  className="text-xs px-3"
                                  data-testid={`button-rank-flight-${proposal.id}-${rank}`}
                                >
                                  #{rank}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(proposal.bookingUrl, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </div>

                        {proposal.rankings && proposal.rankings.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">Group Rankings:</div>
                            <div className="grid grid-cols-1 gap-2">
                              {proposal.rankings.map((ranking: any) => (
                                <div key={ranking.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                  <span>{ranking.user?.firstName || 'Member'}</span>
                                  <Badge variant="secondary">#{ranking.ranking}</Badge>
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
                <h3 className="text-lg font-semibold mb-2">No flight proposals yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Search for flights and propose them to your group to start the voting process.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Flight Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6 mt-6">
          {flightsArray.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Plane className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No flights added yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your flight bookings to keep your group informed of travel plans.
                </p>
                <Dialog open={isAddFlightOpen} onOpenChange={setIsAddFlightOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Flight
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {flightsArray.map((flight) => (
                <Card key={flight.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {flight.airline} {flight.flightNumber}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {flight.departureAirport} → {flight.arrivalAirport}
                        </p>
                      </div>
                      <Badge className={getFlightStatusColor(flight.status || 'confirmed')}>
                        {flight.status || 'confirmed'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Departure</div>
                        <div className="font-medium">
                          {format(new Date(flight.departureTime), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Arrival</div>
                        <div className="font-medium">
                          {format(new Date(flight.arrivalTime), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditFlight(flight)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFlightMutation.mutate(flight.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {flight.price && (
                        <div className="text-lg font-semibold text-green-600">
                          ${flight.price}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}