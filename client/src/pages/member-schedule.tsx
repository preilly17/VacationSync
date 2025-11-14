import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect, useMemo, useCallback } from "react";
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
  ArrowLeft,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTripRealtime } from "@/hooks/use-trip-realtime";
import { isUnauthorizedError } from "@/lib/authUtils";
import { CalendarGrid } from "@/components/calendar-grid";
import { AddActivityModal, type ActivityComposerPrefill } from "@/components/add-activity-modal";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import type { TripWithDetails, ActivityWithDetails, User as UserType } from "@shared/schema";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { resolveTripTimezone } from "@/lib/timezone";
import {
  scheduledActivitiesQueryKey as buildScheduledActivitiesKey,
  proposalActivitiesQueryKey as buildProposalActivitiesKey,
} from "@/lib/activities/queryKeys";
import { parseTripDateToLocal } from "@/lib/date";
import { isScheduledActivity } from "@/lib/activities/activityType";

const getParticipantDisplayName = (user: UserType) => {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first} ${last}`;
  }

  if (first) {
    return first;
  }

  if (user.username) {
    return user.username;
  }

  return user.email || "Trip member";
};

const formatActivityTimeRange = (
  startTime: ActivityWithDetails["startTime"],
  endTime?: ActivityWithDetails["endTime"],
) => {
  const startDate = new Date(startTime);

  if (Number.isNaN(startDate.getTime())) {
    return "Time TBD";
  }

  const startLabel = format(startDate, "h:mm a");

  if (!endTime) {
    return startLabel;
  }

  const endDate = new Date(endTime);

  if (Number.isNaN(endDate.getTime())) {
    return startLabel;
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();

  if (sameDay) {
    return `${startLabel} - ${format(endDate, "h:mm a")}`;
  }

  return `${startLabel} - ${format(endDate, "MMM d, h:mm a")}`;
};

export default function MemberSchedule() {
  const { tripId } = useParams();
  const [, setLocation] = useLocation();
  const { user: currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [activityPrefill, setActivityPrefill] = useState<ActivityComposerPrefill | null>(null);

  const numericTripId = useMemo(() => {
    if (!tripId) return 0;
    const parsed = Number(tripId);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [tripId]);

  useTripRealtime(numericTripId, {
    enabled: numericTripId > 0 && isAuthenticated,
    userId: currentUser?.id ?? null,
  });

  const activitiesQueryKey = useMemo(
    () => buildScheduledActivitiesKey(numericTripId),
    [numericTripId],
  );
  const activityProposalsQueryKey = useMemo(
    () => buildProposalActivitiesKey(numericTripId),
    [numericTripId],
  );

  // Redirect if not authenticated
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

  const { data: trip, isLoading: tripLoading, error: tripError } = useQuery<TripWithDetails>({
    queryKey: ["/api/trips", tripId],
    enabled: !!tripId && isAuthenticated,
    retry: false,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityWithDetails[]>({
    queryKey: activitiesQueryKey,
    enabled: !!tripId && isAuthenticated,
    retry: false,
  });

  const activityTimezone = useMemo(() => {
    const tripWithTimezone = trip as (TripWithDetails & { timezone?: string | null }) | undefined;
    return resolveTripTimezone({
      tripTimezone: tripWithTimezone?.timezone ?? null,
      userTimezone: currentUser?.timezone ?? null,
    });
  }, [trip, currentUser?.timezone]);

  // Handle errors
  useEffect(() => {
    if (tripError && isUnauthorizedError(tripError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
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
      const tripStartDate = parseTripDateToLocal(trip.startDate);
      if (!tripStartDate) {
        return;
      }
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

  const handleDayClick = useCallback(
    (date: Date) => {
      setSelectedDate(date);

      const attendeeIds = new Set<string>();
      if (currentUser?.id) {
        attendeeIds.add(String(currentUser.id));
      }
      if (selectedMemberId) {
        attendeeIds.add(String(selectedMemberId));
      }

      setActivityPrefill({
        startDate: format(date, "yyyy-MM-dd"),
        attendeeIds: attendeeIds.size > 0 ? Array.from(attendeeIds) : undefined,
        type: "SCHEDULED",
      });
      setShowAddActivityModal(true);
    },
    [currentUser?.id, selectedMemberId],
  );

  const parseIsoDate = (value: TripWithDetails["startDate"]) =>
    value instanceof Date ? value : new Date(value);

  const formatDateRange = (
    startDate: TripWithDetails["startDate"],
    endDate: TripWithDetails["endDate"],
  ) => {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
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
  const memberSchedule = useMemo(() => {
    if (!activities || !selectedMemberId) {
      return [] as ActivityWithDetails[];
    }

    return activities
      .filter((activity) => {
        if (!isScheduledActivity(activity)) {
          return false;
        }

        const invites = Array.isArray(activity.invites) ? activity.invites : [];

        return invites.some(
          (invite) => invite.userId === selectedMemberId && invite.status === "accepted",
        );
      })
        .sort((a, b) => {
          const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        });
  }, [activities, selectedMemberId]);

  return (
    <>
      <div className="min-h-dvh lg:min-h-screen bg-neutral-100">
        {/* Mobile Navigation */}
        <MobileNav
          trip={trip}
          user={currentUser ?? undefined}
        />

        <div className="lg:flex lg:h-screen">
        {/* Desktop Sidebar */}
        <Sidebar
          trip={trip}
          user={currentUser ?? undefined}
          activeTab="members"
          onTabChange={() => {}}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 lg:h-screen lg:overflow-x-auto lg:overflow-y-auto">
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
                    onDayClick={handleDayClick}
                  />
                  {memberSchedule.length === 0 ? (
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
                  ) : (
                    <div className="mt-8 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">
                          Accepted activities
                        </h3>
                        <p className="text-sm text-neutral-600">
                          These events appear on {selectedMember.user.firstName || selectedMember.user.email || "their"}'s personal schedule.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {memberSchedule.map((activity) => {
                          const invites = Array.isArray(activity.invites) ? activity.invites : [];
                          const acceptedParticipants = invites
                            .filter((invite) => invite.status === "accepted")
                            .map((invite) => getParticipantDisplayName(invite.user));
                          const pendingParticipants = invites
                            .filter((invite) => invite.status === "pending")
                            .map((invite) => getParticipantDisplayName(invite.user));
                          const declinedParticipants = invites
                            .filter((invite) => invite.status === "declined")
                            .map((invite) => getParticipantDisplayName(invite.user));

                          return (
                            <div
                              key={activity.id}
                              className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h4 className="text-lg font-semibold text-neutral-900">
                                    {activity.name}
                                  </h4>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                                    <span className="flex items-center gap-2">
                                      <Clock className="h-4 w-4" />
                                      {formatActivityTimeRange(activity.startTime, activity.endTime ?? undefined)}
                                    </span>
                                    {activity.location && (
                                      <span className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {activity.location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge className="bg-primary/10 text-primary" variant="secondary">
                                  {activity.acceptedCount} going
                                  {activity.pendingCount > 0 && ` • ${activity.pendingCount} pending`}
                                </Badge>
                              </div>

                              {activity.description && (
                                <p className="mt-3 text-sm text-neutral-600 whitespace-pre-wrap">
                                  {activity.description}
                                </p>
                              )}

                              <div className="mt-4 space-y-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                    Going
                                  </p>
                                  {acceptedParticipants.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {acceptedParticipants.map((name, index) => (
                                        <Badge
                                          key={`${activity.id}-accepted-${index}`}
                                          variant="secondary"
                                          className="bg-neutral-100 text-neutral-700"
                                        >
                                          {name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-sm text-neutral-500 italic">
                                      No accepted participants yet.
                                    </p>
                                  )}
                                </div>
                                {pendingParticipants.length > 0 && (
                                  <p className="text-xs text-neutral-600">
                                    Awaiting response: {pendingParticipants.join(", ")}
                                  </p>
                                )}
                                {declinedParticipants.length > 0 && (
                                  <p className="text-xs text-neutral-500">
                                    Not going: {declinedParticipants.join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
        </div>
      </div>
      <AddActivityModal
        open={showAddActivityModal}
        onOpenChange={(open) => {
          setShowAddActivityModal(open);
          if (!open) {
            setActivityPrefill(null);
          }
        }}
        tripId={numericTripId}
        selectedDate={selectedDate}
        members={trip.members}
        defaultMode="SCHEDULED"
        allowModeToggle
        currentUserId={currentUser?.id}
        prefill={activityPrefill}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        tripTimezone={activityTimezone}
        scheduledActivitiesQueryKey={activitiesQueryKey}
        proposalActivitiesQueryKey={activityProposalsQueryKey}
        calendarActivitiesQueryKey={activitiesQueryKey}
      />
    </>
  );
}
