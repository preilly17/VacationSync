import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, 
  Users, 
  MapPin, 
  ChevronLeft,
  ChevronRight,
  User,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { buildApiUrl } from "@/lib/api";
import { ActivityCard } from "@/components/activity-card";
import { CalendarGrid } from "@/components/calendar-grid";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import type { TripWithDetails, ActivityWithDetails, User as UserType } from "@shared/schema";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";

export default function MemberSchedule() {
  const { tripId } = useParams();
  const [, setLocation] = useLocation();
  const { user: currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = buildApiUrl("/api/login");
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: trip, isLoading: tripLoading, error: tripError } = useQuery<TripWithDetails>({
    queryKey: ["/api/trips", tripId],
    enabled: !!tripId && isAuthenticated,
    retry: false,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityWithDetails[]>({
    queryKey: ["/api/trips", tripId, "activities"],
    enabled: !!tripId && isAuthenticated,
    retry: false,
  });

  // Handle errors
  useEffect(() => {
    if (tripError && isUnauthorizedError(tripError as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = buildApiUrl("/api/login");
      }, 500);
    }
  }, [tripError, toast]);

  // Set default selected member when trip loads
  useEffect(() => {
    if (trip && trip.members.length > 0 && !selectedMemberId) {
      // Default to first member that's not the current user
      const otherMember = trip.members.find(member => member.userId !== currentUser?.id);
      if (otherMember) {
        setSelectedMemberId(otherMember.userId);
      } else if (trip.members.length > 0) {
        setSelectedMemberId(trip.members[0].userId);
      }
    }
  }, [trip, selectedMemberId, currentUser]);

  // Auto-navigate calendar to trip dates when trip loads
  useEffect(() => {
    if (trip?.startDate) {
      const tripStartDate = new Date(trip.startDate);
      const currentMonthStart = startOfMonth(currentMonth);
      const tripMonthStart = startOfMonth(tripStartDate);
      
      // Only update if we're not already showing the correct month
      if (!isSameMonth(currentMonthStart, tripMonthStart)) {
        setCurrentMonth(tripStartDate);
      }
    }
  }, [trip?.startDate]);

  const getSelectedMember = () => {
    if (!trip || !selectedMemberId) return null;
    return trip.members.find(member => member.userId === selectedMemberId);
  };

  const getMemberSchedule = () => {
    if (!activities || !selectedMemberId) return [];
    return activities.filter(activity => 
      activity.acceptances.some(acceptance => acceptance.userId === selectedMemberId)
    );
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  if (authLoading || tripLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Calendar className="text-white w-6 h-6" />
          </div>
          <p className="text-neutral-600">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-neutral-900 mb-2">Trip not found</h1>
            <p className="text-neutral-600 mb-4">
              The trip you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedMember = getSelectedMember();
  const memberSchedule = getMemberSchedule();

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Mobile Navigation */}
      <MobileNav 
        trip={trip}
        user={currentUser}
        onAddActivity={() => {}}
      />

      {/* Desktop Sidebar */}
      <Sidebar 
        trip={trip}
        user={currentUser}
        activeTab="members"
        onTabChange={() => {}}
      />

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(`/trip/${tripId}`)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Trip
                </Button>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-neutral-900">
                    Member Schedules
                  </h1>
                  <div className="flex items-center mt-2 text-sm text-neutral-600">
                    <span>{trip.name}</span>
                    <span className="mx-2">•</span>
                    <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Member Selection */}
        <div className="bg-white px-4 lg:px-8 py-4 border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-4 lg:mb-0">
                <h2 className="text-lg font-semibold text-neutral-900 mb-2">View Schedule For:</h2>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {trip.members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-6 h-6">
                            <AvatarImage 
                              src={member.user.profileImageUrl || undefined} 
                              alt={member.user.firstName || 'User'} 
                            />
                            <AvatarFallback className="text-xs">
                              {(member.user.firstName?.[0] || member.user.email?.[0] || 'U').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {member.user.firstName && member.user.lastName 
                              ? `${member.user.firstName} ${member.user.lastName}`
                              : member.user.firstName || member.user.email
                            }
                            {member.userId === currentUser?.id && " (You)"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-neutral-600">
                {memberSchedule.length} activities accepted
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Content */}
        <div className="px-4 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {selectedMember && (
              <Card>
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage 
                          src={selectedMember.user.profileImageUrl || undefined} 
                          alt={selectedMember.user.firstName || 'User'} 
                        />
                        <AvatarFallback>
                          {(selectedMember.user.firstName?.[0] || selectedMember.user.email?.[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-lg font-semibold text-neutral-900">
                          {selectedMember.user.firstName && selectedMember.user.lastName 
                            ? `${selectedMember.user.firstName} ${selectedMember.user.lastName}'s Personal Calendar`
                            : `${selectedMember.user.firstName || selectedMember.user.email}'s Personal Calendar`
                          }
                        </h2>
                        <p className="text-sm text-neutral-600">
                          Visual calendar of activities they've accepted
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium text-neutral-900 min-w-[120px] text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <CalendarGrid
                    currentMonth={currentMonth}
                    activities={memberSchedule}
                    trip={trip}
                    selectedDate={selectedDate}
                    onDayClick={(date) => setSelectedDate(date)}
                  />
                  {memberSchedule.length === 0 && (
                    <div className="p-8 text-center">
                      <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-neutral-900 mb-2">
                        No activities in schedule
                      </h3>
                      <p className="text-neutral-600">
                        {selectedMember.userId === currentUser?.id 
                          ? "You haven't accepted any activities yet."
                          : `${selectedMember.user.firstName || 'This member'} hasn't accepted any activities yet.`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}