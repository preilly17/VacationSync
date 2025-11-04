import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  CalendarIcon,
  MapPin,
  Phone,
  Clock,
  Star,
  Users,
  ExternalLink,
  Utensils,
  Globe,
  ArrowLeft,
  Search,
  NotebookPen,
  ChefHat,
} from "lucide-react";
import type { TripWithDetails, RestaurantWithDetails } from "@shared/schema";
import { TravelLoading } from "@/components/LoadingSpinners";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { RestaurantProposalModal } from "@/components/restaurant-proposal-modal";
import { RestaurantSearchPanel } from "@/components/restaurant-search-panel";
import { RestaurantManualDialog } from "@/components/restaurant-manual-dialog";

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

  const handleOpenManualDialog = useCallback(() => {
    setShowBooking(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "search") {
      focusSearchSection();
    }

    const manualParam = params.get("manual");
    if (manualParam === "1" || manualParam === "true") {
      setShowBooking(true);
    }
  }, [focusSearchSection]);

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
  
  // Handle propose restaurant to group
  const handleProposeToGroup = (restaurant: any) => {
    setRestaurantToPropose(restaurant);
    setShowProposalModal(true);
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

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleOpenManualDialog}
            disabled={!tripId}
            title={tripId ? undefined : "Open a trip to log restaurants manually"}
          >
            <NotebookPen className="h-4 w-4 mr-2" />
            Log Restaurant Manually
          </Button>
        </div>
      </div>

      <RestaurantSearchPanel
        ref={searchSectionRef}
        tripId={tripId}
        trip={trip as TripWithDetails | undefined}
        user={user}
        onLogRestaurantManually={handleOpenManualDialog}
        onProposeRestaurant={handleProposeToGroup}
        onBookingLinkClick={handleBookingLinkClick}
      />

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
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button onClick={focusSearchSection} className="w-full sm:w-auto">
                  <Search className="h-4 w-4 mr-2" />
                  Search Restaurants
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleOpenManualDialog}
                  disabled={!tripId}
                  title={tripId ? undefined : "Open a trip to log restaurants manually"}
                >
                  <NotebookPen className="h-4 w-4 mr-2" />
                  Log Manually
                </Button>
              </div>
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

                  {tripId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => handleProposeToGroup(restaurant)}
                      data-testid={`button-propose-saved-restaurant-${restaurant.id}`}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Propose to Group
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <RestaurantManualDialog tripId={tripId} open={showBooking} onOpenChange={setShowBooking} />

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
          if (tripId) {
            queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "activities"] });
            queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
          }
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