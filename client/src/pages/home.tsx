import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, Plus, Users, MapPin, Settings, Plane, Camera, Heart, Compass, Trash2, Calculator, ArrowUpDown, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { CreateTripModal } from "@/components/create-trip-modal";
import { NotificationIcon } from "@/components/notification-icon";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";
import { useOnboarding } from "@/hooks/useOnboarding";
import { TravelLoading } from "@/components/LoadingSpinners";
import { TravelMascot } from "@/components/TravelMascot";
import { ManualRefreshButton } from "@/components/manual-refresh-button";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TripWithDetails } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { shouldShowOnboarding, completeOnboarding, skipOnboarding } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    // Show onboarding after a short delay for better UX
    const timer = setTimeout(() => {
      if (shouldShowOnboarding()) {
        setShowOnboarding(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [shouldShowOnboarding]);

  const handleOnboardingComplete = () => {
    completeOnboarding();
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    skipOnboarding();
    setShowOnboarding(false);
  };

  const { data: trips, isLoading, error } = useQuery<TripWithDetails[]>({
    queryKey: ["/api/trips"],
    enabled: !!user, // Only fetch when user is authenticated
    retry: false,
  });

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      return apiRequest(`/api/trips/${tripId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Trip deleted",
        description: "Your past trip has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete trip",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  });

  const formatDateRange = (startDate: string | Date, endDate: string | Date) => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const getUpcomingTrips = () => {
    if (!trips) return [];
    const now = new Date();
    return trips.filter(trip => new Date(trip.startDate) >= now);
  };

  const getPastTrips = () => {
    if (!trips) return [];
    const now = new Date();
    return trips.filter(trip => new Date(trip.endDate) < now);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen ocean-gradient flex items-center justify-center">
        <TravelLoading variant="travel" size="lg" text="Loading your travel dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen ocean-gradient flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Session Issue</h2>
          <p className="text-gray-600 mb-6">
            Your session has expired. Click the refresh button to log in again and continue using the app.
          </p>
          <ManualRefreshButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ocean-gradient">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 px-4 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'Traveler'}
              </h1>
              <p className="text-gray-600 mt-1">
                Ready to plan your next adventure?
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <NotificationIcon />
              <Link href="/currency-converter">
                <Button variant="outline" size="sm">
                  <Calculator className="w-4 h-4 mr-2" />
                  Currency
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Profile
                </Button>
              </Link>
              <Button
                onClick={() => {
                  console.log("Create trip button clicked, setting modal to true");
                  setShowCreateModal(true);
                }}
                className="bg-primary hover:bg-red-600 text-white"
                data-onboarding="create-trip"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Trip
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  console.log("Logout button clicked");
                  localStorage.clear();
                  sessionStorage.clear();
                  try {
                    await apiRequest('/api/auth/logout', { method: 'POST' });
                  } catch (error) {
                    console.error('Error logging out:', error);
                  } finally {
                    queryClient.clear();
                    window.location.href = '/login';
                  }
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Calendar className="text-primary w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {getUpcomingTrips().length}
                  </p>
                  <p className="text-neutral-600 text-sm">Upcoming Trips</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                  <Users className="text-secondary w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {trips?.reduce((total, trip) => total + trip.memberCount, 0) || 0}
                  </p>
                  <p className="text-neutral-600 text-sm">Travel Companions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <MapPin className="text-purple-600 w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {new Set(trips?.map(trip => trip.destination)).size || 0}
                  </p>
                  <p className="text-neutral-600 text-sm">Destinations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Upcoming Trips */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900">Upcoming Trips</h2>
          </div>

          {getUpcomingTrips().length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-gray-400 w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">No upcoming trips</h3>
                <p className="text-neutral-600 mb-4">Start planning your next adventure!</p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary hover:bg-red-600 text-white"
                  data-onboarding="create-trip"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Trip
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getUpcomingTrips().map((trip) => (
                <Link key={trip.id} href={`/trip/${trip.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-semibold text-neutral-900 line-clamp-1">
                          {trip.name}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {trip.memberCount} members
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-neutral-600 text-sm">
                          <MapPin className="w-4 h-4 mr-2" />
                          {trip.destination}
                        </div>
                        <div className="flex items-center text-neutral-600 text-sm">
                          <Calendar className="w-4 h-4 mr-2" />
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {(trip.members || []).slice(0, 3).map((member) => (
                            <div
                              key={member.id}
                              className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-200"
                            >
                              {member.user.profileImageUrl ? (
                                <img
                                  src={member.user.profileImageUrl}
                                  alt={member.user.firstName || 'Member'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                  {(member.user.firstName?.[0] || member.user.email?.[0] || 'U').toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                          {trip.memberCount > 3 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                +{trip.memberCount - 3}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {new Date(trip.startDate).getTime() - Date.now() > 0 
                            ? `${Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days to go`
                            : 'In progress'
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past Trips */}
        {getPastTrips().length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">Past Trips</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getPastTrips().map((trip) => (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow opacity-75 relative">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Link href={`/trip/${trip.id}`} className="flex-1 cursor-pointer">
                        <h3 className="text-lg font-semibold text-neutral-900 line-clamp-1 hover:text-blue-600 transition-colors">
                          {trip.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Completed
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                              data-testid={`delete-trip-${trip.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Past Trip</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{trip.name}"? This action cannot be undone and will permanently remove all trip data including activities, expenses, and memories.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTripMutation.mutate(trip.id)}
                                disabled={deleteTripMutation.isPending}
                                className="bg-red-600 hover:bg-red-700"
                                data-testid={`confirm-delete-trip-${trip.id}`}
                              >
                                {deleteTripMutation.isPending ? "Deleting..." : "Delete Trip"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <Link href={`/trip/${trip.id}`} className="cursor-pointer">
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-neutral-600 text-sm">
                          <MapPin className="w-4 h-4 mr-2" />
                          {trip.destination}
                        </div>
                        <div className="flex items-center text-neutral-600 text-sm">
                          <Calendar className="w-4 h-4 mr-2" />
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </div>
                      </div>

                      <div className="flex -space-x-2">
                        {(trip.members || []).slice(0, 3).map((member) => (
                          <div
                            key={member.id}
                            className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-200"
                          >
                            {member.user.profileImageUrl ? (
                              <img
                                src={member.user.profileImageUrl}
                                alt={member.user.firstName || 'Member'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                                {(member.user.firstName?.[0] || member.user.email?.[0] || 'U').toUpperCase()}
                              </div>
                            )}
                          </div>
                        ))}
                        {trip.memberCount > 3 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">
                              +{trip.memberCount - 3}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateTripModal
        open={showCreateModal}
        onOpenChange={(open) => {
          console.log("CreateTripModal onOpenChange called with:", open);
          setShowCreateModal(open);
        }}
      />
      
      {showOnboarding && (
        <OnboardingTutorial
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </div>
  );
}
