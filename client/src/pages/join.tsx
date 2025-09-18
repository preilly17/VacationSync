import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Users, CheckCircle, AlertCircle, Plane } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function Join() {
  const { shareCode } = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [departureLocation, setDepartureLocation] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [showLocationForm, setShowLocationForm] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated && shareCode) {
      // Pass the current path as returnTo parameter
      const returnUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `/api/login?returnTo=${returnUrl}`;
      return;
    }
  }, [isAuthenticated, authLoading, shareCode]);

  // Load trip information
  useEffect(() => {
    if (!shareCode || !isAuthenticated) return;
    
    const loadTripInfo = async () => {
      try {
        setLoading(true);
        // First check if user is already a member by trying to get trip details
        const tripResponse = await fetch(`/api/trips/share/${shareCode}`, {
          credentials: 'include',
        });
        
        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          setTrip(tripData);
          
          // Check if user is already a member
          const isMember = tripData.members.some((member: any) => member.userId === user?.id);
          if (isMember) {
            setJoined(true);
          } else {
            // Show location form before joining
            setShowLocationForm(true);
          }
        } else if (tripResponse.status === 404) {
          setError("Trip not found. The invite link may be invalid or expired.");
        } else {
          throw new Error("Failed to load trip information");
        }
      } catch (err) {
        console.error("Error loading trip:", err);
        setError("Failed to load trip information. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadTripInfo();
  }, [shareCode, isAuthenticated, user]);

  const joinTripMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/join/${shareCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          departureLocation: departureLocation || undefined,
          departureAirport: departureAirport || undefined,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join trip');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setJoined(true);
      toast({
        title: "Welcome!",
        description: "You've successfully joined the trip!",
      });
      // Invalidate trips cache to refresh the user's trip list
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Calendar className="text-white w-6 h-6" />
          </div>
          <p className="text-neutral-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Calendar className="text-white w-6 h-6" />
          </div>
          <p className="text-neutral-600">Processing invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 mb-2">Unable to Join Trip</h1>
            <p className="text-neutral-600 mb-4">{error}</p>
            <Button onClick={() => setLocation("/")}>
              Go to My Trips
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 mb-2">You're In!</h1>
            <p className="text-neutral-600 mb-6">
              You've successfully joined the trip. Start planning activities and coordinating with your group!
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => setLocation("/")}
                className="w-full"
              >
                View All My Trips
              </Button>
              <Button 
                variant="outline"
                onClick={() => setLocation(`/trip/${trip?.id || ''}`)}
                className="w-full"
                disabled={!trip}
              >
                Go to Trip Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showLocationForm && trip) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Plane className="w-12 h-12 text-primary mx-auto mb-4" />
              <h1 className="text-xl font-bold text-neutral-900 mb-2">Join Trip</h1>
              <p className="text-neutral-600 text-sm">
                You're about to join <strong>{trip.name}</strong>
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="departureLocation" className="text-sm font-medium">
                  Departure Location (Optional)
                </Label>
                <Input
                  id="departureLocation"
                  type="text"
                  placeholder="e.g., New York, NY"
                  value={departureLocation}
                  onChange={(e) => setDepartureLocation(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-neutral-600 mt-1">
                  This helps with flight searches and group coordination
                </p>
              </div>
              
              <div>
                <Label htmlFor="departureAirport" className="text-sm font-medium">
                  Preferred Airport Code (Optional)
                </Label>
                <Input
                  id="departureAirport"
                  type="text"
                  placeholder="e.g., JFK, LAX, DFW"
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value.toUpperCase())}
                  className="mt-1"
                  maxLength={3}
                />
                <p className="text-xs text-neutral-600 mt-1">
                  3-letter airport code for flight searches
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => joinTripMutation.mutate()}
                disabled={joinTripMutation.isPending}
                className="w-full"
              >
                {joinTripMutation.isPending ? "Joining..." : "Join Trip"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowLocationForm(false)}
                className="w-full"
              >
                Skip Location Info
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <Calendar className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Join Trip</h1>
          <p className="text-neutral-600 mb-4">
            You're about to join a vacation planning group!
          </p>
          <Button 
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}