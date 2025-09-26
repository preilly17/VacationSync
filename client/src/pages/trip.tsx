import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Plus,
  Users,
  MapPin,
  Bell,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Clock,
  User as UserIcon,
  Package,
  DollarSign,
  ShoppingCart,
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  Hotel,
  Utensils,
  Trash2,
  ExternalLink,
  Cloud,
  Sparkles,
  CheckCircle,
  Settings,
  Search,
  NotebookPen,
  Loader2,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { CalendarGrid } from "@/components/calendar-grid";
import { AddActivityModal } from "@/components/add-activity-modal";
import { EditTripModal } from "@/components/edit-trip-modal";
import { InviteLinkModal } from "@/components/invite-link-modal";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { PackingList } from "@/components/packing-list";
import { ExpenseTracker } from "@/components/expense-tracker";
import { GroceryList } from "@/components/grocery-list";
import { RestaurantSearchPanel } from "@/components/restaurant-search-panel";
import { HotelSearchPanel, type HotelSearchPanelRef } from "@/components/hotels/hotel-search-panel";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NotificationIcon } from "@/components/notification-icon";
import { LeaveTripButton } from "@/components/leave-trip-button";
import { TravelLoading } from "@/components/LoadingSpinners";
import ActivitySearch from "@/components/activity-search";
import { WishListBoard } from "@/components/wish-list-board";
import Proposals from "@/pages/proposals";
import { ActivityDetailsDialog } from "@/components/activity-details-dialog";
import type {
  TripWithDetails,
  ActivityWithDetails,
  User,
  InsertHotel,
  ActivityInviteStatus,
  InsertFlight,
  RestaurantWithDetails,
  HotelProposalWithDetails,
  HotelSearchResult,
} from "@shared/schema";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
  subDays,
  startOfDay,
  isSameDay,
  isSameMonth,
  isBefore,
  isAfter,
  formatDistanceToNow,
  differenceInCalendarDays,
} from "date-fns";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HotelFormFields } from "@/components/hotels/hotel-form-fields";
import {
  createHotelFormDefaults,
  hotelFormSchema,
  transformHotelFormValues,
  type HotelFormValues,
} from "@/lib/hotel-form";
import { apiRequest } from "@/lib/queryClient";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const TRIP_TAB_KEYS = [
  "calendar",
  "schedule",
  "proposals",
  "packing",
  "flights",
  "hotels",
  "activities",
  "restaurants",
  "groceries",
  "expenses",
  "wish-list",
] as const;

type TripTab = (typeof TRIP_TAB_KEYS)[number];

const isTripTab = (value: string): value is TripTab =>
  TRIP_TAB_KEYS.includes(value as TripTab);

type SummaryPanel = "activities" | "rsvps" | "next";

const inviteStatusLabelMap: Record<ActivityInviteStatus, string> = {
  accepted: "Accepted",
  pending: "Pending",
  declined: "Declined",
  waitlisted: "Waitlisted",
};

const inviteStatusBadgeClasses: Record<ActivityInviteStatus, string> = {
  accepted: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  waitlisted: "bg-blue-100 text-blue-800 border-blue-200",
};

type ActivityRsvpAction = "ACCEPT" | "DECLINE" | "WAITLIST" | "MAYBE";

const statusToActionMap: Record<ActivityInviteStatus, ActivityRsvpAction> = {
  accepted: "ACCEPT",
  pending: "MAYBE",
  declined: "DECLINE",
  waitlisted: "WAITLIST",
};

// MOBILE-ONLY bottom navigation config
const MOBILE_TAB_ITEMS: { key: TripTab; label: string; icon: LucideIcon }[] = [
  { key: "calendar", label: "Group", icon: Calendar },
  { key: "schedule", label: "Personal", icon: Clock },
  { key: "packing", label: "Packing", icon: Package },
  { key: "expenses", label: "Expenses", icon: DollarSign },
  { key: "flights", label: "Flights", icon: Plane },
  { key: "hotels", label: "Hotels", icon: Hotel },
  { key: "proposals", label: "Proposals", icon: CheckCircle },
  { key: "wish-list", label: "Wish List", icon: Sparkles },
  { key: "activities", label: "Discover", icon: MapPin },
  { key: "restaurants", label: "Dining", icon: Utensils },
  { key: "groceries", label: "Groceries", icon: ShoppingCart },
];

const parseTripDateToLocal = (value?: string | Date | null): Date | null => {
  if (!value) {
    return null;
  }

  const dateString = value instanceof Date ? value.toISOString() : value;

  const [datePart] = dateString.split("T");

  if (datePart) {
    const parts = datePart.split("-");
    if (parts.length === 3) {
      const [yearString, monthString, dayString] = parts;
      const year = Number.parseInt(yearString, 10);
      const month = Number.parseInt(monthString, 10);
      const day = Number.parseInt(dayString, 10);

      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        return new Date(year, month - 1, day);
      }
    }
  }

  const fallback = value instanceof Date ? value : new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

interface DayViewProps {
  date: Date;
  activities: ActivityWithDetails[];
  onPreviousDay: () => void;
  onNextDay: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  emptyStateMessage?: string;
  onActivityClick?: (activity: ActivityWithDetails) => void;
  currentUser?: User | null;
  onSubmitRsvp?: (activity: ActivityWithDetails, action: ActivityRsvpAction) => void;
  isRsvpPending?: boolean;
}

const getParticipantDisplayName = (user: User) => {
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

const formatActivityTimeRange = (startTime: string | Date, endTime?: string | Date | null) => {
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

  if (isSameDay(startDate, endDate)) {
    return `${startLabel} - ${format(endDate, "h:mm a")}`;
  }

  return `${startLabel} - ${format(endDate, "MMM d, h:mm a")}`;
};

function DayView({
  date,
  activities,
  onPreviousDay,
  onNextDay,
  canGoPrevious,
  canGoNext,
  emptyStateMessage = "No activities scheduled for this day yet.",
  onActivityClick,
  currentUser,
  onSubmitRsvp,
  isRsvpPending,
}: DayViewProps) {
  const dayActivities = activities
    .filter((activity) => isSameDay(new Date(activity.startTime), date))
    .sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreviousDay}
            disabled={!canGoPrevious}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Viewing day
            </p>
            <p className="text-lg font-semibold text-neutral-900">
              {format(date, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNextDay}
            disabled={!canGoNext}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {dayActivities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
          {emptyStateMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {dayActivities.map((activity) => {
            const waitlistedCount =
              activity.waitlistedCount
                ?? activity.invites.filter((invite) => invite.status === "waitlisted").length;
            const isCreator =
              currentUser?.id === activity.postedBy || currentUser?.id === activity.poster.id;
            const currentInvite =
              activity.currentUserInvite
              ?? activity.invites.find((invite) => invite.userId === currentUser?.id)
              ?? null;
            const derivedStatus: ActivityInviteStatus = currentInvite?.status
              ?? (activity.isAccepted ? "accepted" : "pending");
            const statusLabel = inviteStatusLabelMap[derivedStatus];
            const isPastActivity = (() => {
              const end = activity.endTime ? new Date(activity.endTime) : null;
              const start = new Date(activity.startTime);
              const comparisonTarget = end && !Number.isNaN(end.getTime()) ? end : start;
              return Number.isNaN(comparisonTarget.getTime())
                ? false
                : comparisonTarget.getTime() < now.getTime();
            })();
            const rsvpCloseDate = activity.rsvpCloseTime
              ? new Date(activity.rsvpCloseTime)
              : null;
            const isRsvpClosed = Boolean(
              rsvpCloseDate && !Number.isNaN(rsvpCloseDate.getTime()) && rsvpCloseDate < now,
            );
            const activityType = (activity.type ?? "SCHEDULED").toUpperCase();
            const isProposal = activityType === "PROPOSE";
            const capacityFull = Boolean(
              !isProposal && activity.maxCapacity != null
                && activity.acceptedCount >= activity.maxCapacity,
            );

            const handleAction = (action: ActivityRsvpAction) => {
              if (!onSubmitRsvp) {
                return;
              }
              onSubmitRsvp(activity, action);
            };

            const renderActions = () => {
              if (isCreator) {
                return (
                  <Badge
                    variant="secondary"
                    className="bg-neutral-100 text-neutral-600 border border-neutral-200"
                  >
                    Organizer
                  </Badge>
                );
              }

              if (!onSubmitRsvp) {
                if (isPastActivity) {
                  return (
                    <Badge
                      variant="secondary"
                      className="bg-neutral-100 text-neutral-600 border border-neutral-200"
                    >
                      Past
                    </Badge>
                  );
                }
                if (isRsvpClosed) {
                  return (
                    <Badge
                      variant="secondary"
                      className="bg-neutral-100 text-neutral-600 border border-neutral-200"
                    >
                      RSVP closed
                    </Badge>
                  );
                }
                return null;
              }

              if (isPastActivity) {
                return (
                  <Badge
                    variant="secondary"
                    className="bg-neutral-100 text-neutral-600 border border-neutral-200"
                  >
                    Past
                  </Badge>
                );
              }

              if (isRsvpClosed) {
                return (
                  <Badge
                    variant="secondary"
                    className="bg-neutral-100 text-neutral-600 border border-neutral-200"
                  >
                    RSVP closed
                  </Badge>
                );
              }

              const declineLabel = isProposal ? "Not interested" : "Decline";
              const acceptLabel = isProposal ? "Interested" : "Accept";

              if (isProposal) {
                return (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction("ACCEPT")}
                      disabled={isRsvpPending}
                      aria-label="Accept invitation"
                    >
                      {acceptLabel}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("DECLINE")}
                      disabled={isRsvpPending}
                      aria-label="Decline invitation"
                    >
                      {declineLabel}
                    </Button>
                  </div>
                );
              }

              if (derivedStatus === "accepted") {
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-neutral-300"
                        disabled={isRsvpPending}
                      >
                        Change RSVP
                        <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onSelect={() => handleAction("DECLINE")}
                        disabled={isRsvpPending}
                      >
                        Decline
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              if (derivedStatus === "waitlisted") {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("MAYBE")}
                    disabled={isRsvpPending}
                    aria-label="Leave waitlist"
                  >
                    Leave waitlist
                  </Button>
                );
              }

              const declineButton = (
                <Button
                  key="decline"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("DECLINE")}
                  disabled={isRsvpPending}
                  aria-label="Decline invitation"
                >
                  {declineLabel}
                </Button>
              );

              if (capacityFull) {
                return (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction("WAITLIST")}
                      disabled={isRsvpPending}
                      aria-label="Join waitlist"
                    >
                      Join waitlist
                    </Button>
                    {declineButton}
                  </div>
                );
              }

              return (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction("ACCEPT")}
                    disabled={isRsvpPending}
                    aria-label="Accept invitation"
                  >
                    {acceptLabel}
                  </Button>
                  {declineButton}
                </div>
              );
            };

            const acceptedParticipants = activity.invites
              .filter((invite) => invite.status === "accepted")
              .map((invite) => getParticipantDisplayName(invite.user));
            const pendingParticipants = activity.invites
              .filter((invite) => invite.status === "pending")
              .map((invite) => getParticipantDisplayName(invite.user));
            const declinedParticipants = activity.invites
              .filter((invite) => invite.status === "declined")
              .map((invite) => getParticipantDisplayName(invite.user));

            return (
              <div
                key={activity.id}
                onClick={() => onActivityClick?.(activity)}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md cursor-pointer"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {activity.name}
                  </h3>
                  <div className="flex flex-col items-end gap-2 text-sm font-medium text-neutral-700">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="inline-flex items-center">
                        <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                        {formatActivityTimeRange(activity.startTime, activity.endTime)}
                      </span>
                      <Badge className="bg-primary/10 text-primary" variant="secondary">
                        {activity.acceptedCount} going
                        {activity.pendingCount > 0 && ` • ${activity.pendingCount} pending`}
                        {waitlistedCount > 0 && ` • ${waitlistedCount} waitlist`}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge
                        variant="outline"
                        className={`border ${inviteStatusBadgeClasses[derivedStatus]}`}
                      >
                        {statusLabel}
                      </Badge>
                      {renderActions()}
                    </div>
                  </div>
                </div>

                {activity.location && (
                  <div className="mt-2 flex items-center text-sm text-neutral-600">
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>{activity.location}</span>
                  </div>
                )}

                {activity.description && (
                  <p className="mt-3 text-sm text-neutral-600 whitespace-pre-wrap">
                    {activity.description}
                  </p>
                )}

                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <Users className="h-4 w-4" />
                    Participants
                  </div>
                  {acceptedParticipants.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {acceptedParticipants.map((name, index) => (
                        <Badge
                          key={`${activity.id}-participant-${index}`}
                          variant="secondary"
                          className="bg-neutral-100 text-neutral-700"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500 italic">
                      No participants yet.
                    </p>
                  )}
                  {pendingParticipants.length > 0 && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Awaiting response: {pendingParticipants.join(", ")}
                    </p>
                  )}
                  {declinedParticipants.length > 0 && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Not going: {declinedParticipants.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Trip() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TripTab>("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [groupCalendarView, setGroupCalendarView] = useState<"month" | "day">("month");
  const [scheduleCalendarView, setScheduleCalendarView] = useState<"month" | "day">("month");
  const [groupViewDate, setGroupViewDate] = useState<Date | null>(null);
  const [scheduleViewDate, setScheduleViewDate] = useState<Date | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [summaryPanel, setSummaryPanel] = useState<SummaryPanel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    if (viewParam && isTripTab(viewParam)) {
      setActiveTab(viewParam);
    }
  }, []);

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
    }
  }, [authLoading, isAuthenticated, toast]);

  // Trip data
  const { data: trip, isLoading: tripLoading, error: tripError } = useQuery<TripWithDetails>({
    queryKey: [`/api/trips/${id}`],
    enabled: !!id && isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return false;
      }
      return failureCount < 3;
    },
  });

  // Activities data
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityWithDetails[]>({
    queryKey: [`/api/trips/${id}/activities`],
    enabled: !!id && isAuthenticated,
  });

  const selectedActivity = useMemo(() => {
    if (!selectedActivityId) {
      return null;
    }
    return activities.find((activity) => activity.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  const respondToInviteMutation = useMutation({
    mutationFn: async ({
      activityId,
      action,
    }: {
      activityId: number;
      action: ActivityRsvpAction;
    }) => {
      const response = await apiRequest(`/api/activities/${activityId}/responses`, {
        method: "POST",
        body: { rsvp: action },
      });
      return (await response.json()) as {
        invite: unknown;
        activity: ActivityWithDetails | null;
        promotedUserId?: string | null;
      };
    },
    onSuccess: (_data, variables) => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${id}/activities`] });
      }

      const action = variables.action;
      let title = "RSVP updated";
      let description = "We saved your response.";

      if (action === "ACCEPT") {
        title = "You're going!";
        description = "This activity is on your personal schedule now.";
      } else if (action === "DECLINE") {
        title = "You declined this activity";
        description = "We won't show it on your personal schedule.";
      } else if (action === "WAITLIST") {
        title = "Joined the waitlist";
        description = "We'll let you know if a spot opens up.";
      } else {
        title = "Marked as undecided";
        description = "You can update your RSVP anytime.";
      }

      toast({ title, description });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }

      toast({
        title: "Unable to update RSVP",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleActivityClick = useCallback((activity: ActivityWithDetails) => {
    setSelectedActivityId(activity.id);
    setIsActivityDialogOpen(true);
  }, []);

  const submitRsvpAction = useCallback(
    (activityId: number, action: ActivityRsvpAction) => {
      respondToInviteMutation.mutate({ activityId, action });
    },
    [respondToInviteMutation],
  );

  const handleRespond = useCallback(
    (status: ActivityInviteStatus) => {
      if (!selectedActivity) {
        return;
      }

      const action = statusToActionMap[status];
      submitRsvpAction(selectedActivity.id, action);
    },
    [selectedActivity, submitRsvpAction],
  );

  const openSummaryPanel = (panel: SummaryPanel) => {
    setSummaryPanel(panel);
  };

  const closeSummaryPanel = () => {
    setSummaryPanel(null);
  };

  const handleSummaryCardKeyDown = (panel: SummaryPanel, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSummaryPanel(panel);
    }
  };

  const handleDialogItemKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    action: () => void,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  const handleOpenActivityFromPanel = (activity: ActivityWithDetails) => {
    closeSummaryPanel();
    handleActivityClick(activity);
  };

  const handleQuickRespond = (
    activityId: number,
    status: ActivityInviteStatus,
    currentStatus?: ActivityInviteStatus,
  ) => {
    if (status === "waitlisted" && currentStatus === "waitlisted") {
      submitRsvpAction(activityId, statusToActionMap.pending);
      return;
    }

    if (currentStatus === status) {
      return;
    }

    const action = statusToActionMap[status];
    submitRsvpAction(activityId, action);
  };

  const handleViewOnCalendar = (activity: ActivityWithDetails) => {
    const targetDate = clampDateToTrip(new Date(activity.startTime));
    if (targetDate) {
      setActiveTab("calendar");
      setGroupCalendarView("day");
      setGroupViewDate(targetDate);
      setSelectedDate(targetDate);
    }

    closeSummaryPanel();
  };

  // Packing data
  const { data: packingItems = [] } = useQuery({
    queryKey: [`/api/trips/${id}/packing`],
    enabled: !!id && isAuthenticated,
  });

  // Expenses data
  const { data: expenses = [] } = useQuery({
    queryKey: [`/api/trips/${id}/expenses`],
    enabled: !!id && isAuthenticated,
  });

  // Category filter options
  const categories = [
    "all",
    ...Array.from(new Set(activities.map((activity) => activity.category).filter(Boolean)))
  ];

  // People filter options
  const people = [
    "all",
    ...(trip?.members || []).map((member: any) => member.userId)
  ];

  const tripStartDate = useMemo(() => {
    const parsed = parseTripDateToLocal(trip?.startDate);
    return parsed ? startOfDay(parsed) : null;
  }, [trip?.startDate]);

  const tripEndDate = useMemo(() => {
    const parsed = parseTripDateToLocal(trip?.endDate);
    return parsed ? startOfDay(parsed) : null;
  }, [trip?.endDate]);

  const clampDateToTrip = (date: Date) => {
    if (!tripStartDate && !tripEndDate) {
      return startOfDay(date);
    }

    const normalized = startOfDay(date);

    if (tripStartDate && isBefore(normalized, tripStartDate)) {
      return tripStartDate;
    }

    if (tripEndDate && isAfter(normalized, tripEndDate)) {
      return tripEndDate;
    }

    return normalized;
  };

  useEffect(() => {
    if (tripStartDate) {
      setGroupViewDate((prev) => (prev ? prev : tripStartDate));
      setScheduleViewDate((prev) => (prev ? prev : tripStartDate));
      setSelectedDate((prev) => (prev ? prev : tripStartDate));
    }
  }, [tripStartDate]);

  useEffect(() => {
    if (activeTab === "calendar" && groupCalendarView === "day" && groupViewDate) {
      setSelectedDate(groupViewDate);
    }
  }, [activeTab, groupCalendarView, groupViewDate]);

  useEffect(() => {
    if (activeTab === "schedule" && scheduleCalendarView === "day" && scheduleViewDate) {
      setSelectedDate(scheduleViewDate);
    }
  }, [activeTab, scheduleCalendarView, scheduleViewDate]);

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    if (categoryFilter !== "all") {
      filtered = filtered.filter((activity) => activity.category === categoryFilter);
    }

    if (peopleFilter !== "all") {
      filtered = filtered.filter((activity) =>
        activity.invites?.some(
          (invite) => invite.userId === peopleFilter && invite.status === "accepted",
        ),
      );
    }

    return filtered;
  }, [activities, categoryFilter, peopleFilter]);

  const myScheduleActivities = useMemo(() => {
    if (!user) return [];
    return activities.filter((activity) =>
      activity.invites?.some((invite) => invite.userId === user.id && invite.status === "accepted"),
    );
  }, [activities, user]);

  const filteredMyInvitedActivities = useMemo(() => {
    if (!user) return [];
    return filteredActivities.filter((activity) =>
      activity.invites?.some((invite) => invite.userId === user.id),
    );
  }, [filteredActivities, user]);

  const sortedMyInvitedActivities = useMemo(() => {
    const now = Date.now();
    return [...filteredMyInvitedActivities].sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      const aIsPast = Number.isNaN(aTime) ? 1 : aTime < now ? 1 : 0;
      const bIsPast = Number.isNaN(bTime) ? 1 : bTime < now ? 1 : 0;

      if (aIsPast !== bIsPast) {
        return aIsPast - bIsPast;
      }

      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return 0;
      }

      return aTime - bTime;
    });
  }, [filteredMyInvitedActivities]);
  const currentGroupDay = groupViewDate ?? tripStartDate ?? null;
  const currentScheduleDay = scheduleViewDate ?? tripStartDate ?? null;

  const canGoToPreviousGroupDay = Boolean(
    currentGroupDay && tripStartDate && isAfter(currentGroupDay, tripStartDate),
  );
  const canGoToNextGroupDay = Boolean(
    currentGroupDay && tripEndDate && isBefore(currentGroupDay, tripEndDate),
  );
  const canGoToPreviousScheduleDay = Boolean(
    currentScheduleDay && tripStartDate && isAfter(currentScheduleDay, tripStartDate),
  );
  const canGoToNextScheduleDay = Boolean(
    currentScheduleDay && tripEndDate && isBefore(currentScheduleDay, tripEndDate),
  );

  const handleGroupViewChange = (view: "month" | "day") => {
    setGroupCalendarView(view);
    if (view === "day") {
      const baseDate = groupViewDate ?? selectedDate ?? tripStartDate;
      if (baseDate) {
        const normalized = clampDateToTrip(baseDate);
        setGroupViewDate(normalized);
        setSelectedDate(normalized);
      }
    }
  };

  const handleScheduleViewChange = (view: "month" | "day") => {
    setScheduleCalendarView(view);
    if (view === "day") {
      const baseDate = scheduleViewDate ?? selectedDate ?? tripStartDate;
      if (baseDate) {
        const normalized = clampDateToTrip(baseDate);
        setScheduleViewDate(normalized);
        setSelectedDate(normalized);
      }
    }
  };

  const handleGroupPreviousDay = () => {
    if (!currentGroupDay || !canGoToPreviousGroupDay) return;
    const previous = clampDateToTrip(subDays(currentGroupDay, 1));
    setGroupViewDate(previous);
    setSelectedDate(previous);
  };

  const handleGroupNextDay = () => {
    if (!currentGroupDay || !canGoToNextGroupDay) return;
    const next = clampDateToTrip(addDays(currentGroupDay, 1));
    setGroupViewDate(next);
    setSelectedDate(next);
  };

  const handleSchedulePreviousDay = () => {
    if (!currentScheduleDay || !canGoToPreviousScheduleDay) return;
    const previous = clampDateToTrip(subDays(currentScheduleDay, 1));
    setScheduleViewDate(previous);
    setSelectedDate(previous);
  };

  const handleScheduleNextDay = () => {
    if (!currentScheduleDay || !canGoToNextScheduleDay) return;
    const next = clampDateToTrip(addDays(currentScheduleDay, 1));
    setScheduleViewDate(next);
    setSelectedDate(next);
  };

  const openAddActivityModal = (date?: Date | null) => {
    const baseDate = date ?? selectedDate ?? tripStartDate;
    const targetDate = baseDate ? clampDateToTrip(baseDate) : null;

    if (targetDate) {
      setSelectedDate(targetDate);
      setGroupViewDate(targetDate);
      setScheduleViewDate(targetDate);
    }

    setShowAddActivity(true);
  };

  const handleOpenAddActivityForGroup = () => {
    const baseDate =
      groupCalendarView === "day"
        ? currentGroupDay ?? tripStartDate
        : selectedDate ?? currentGroupDay ?? tripStartDate;

    openAddActivityModal(baseDate);
  };

  const handleOpenAddActivityForSchedule = () => {
    const baseDate =
      scheduleCalendarView === "day"
        ? currentScheduleDay ?? tripStartDate
        : selectedDate ?? currentScheduleDay ?? tripStartDate;

    openAddActivityModal(baseDate);
  };

  const totalMembers = trip?.members?.length ?? 0;
  const tripDurationDays = trip?.startDate && trip?.endDate
    ? Math.max(differenceInCalendarDays(new Date(trip.endDate), new Date(trip.startDate)) + 1, 1)
    : null;

  const upcomingActivities = useMemo(() => {
    const now = new Date();
    return filteredActivities
      .map((activity) => ({
        activity,
        start: new Date(activity.startTime),
      }))
      .filter(({ start }) => !Number.isNaN(start.getTime()) && start.getTime() >= now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [filteredActivities]);

  const nextActivityEntry = upcomingActivities[0];
  const nextActivity = nextActivityEntry?.activity;
  const nextActivityStart = nextActivityEntry?.start;
  const nextActivityCountdown = nextActivityStart
    ? formatDistanceToNow(nextActivityStart, { addSuffix: true })
    : null;
  const nextActivityDateLabel = nextActivityStart
    ? format(nextActivityStart, "MMM d • h:mm a")
    : null;
  const nextActivityAttendees = useMemo(() => {
    if (!nextActivity) {
      return [];
    }

    return (nextActivity.invites ?? []).filter((invite) => invite.status === "accepted");
  }, [nextActivity]);

  // Auto-navigate calendar to trip dates when trip loads
  useEffect(() => {
    if (tripStartDate) {
      const currentMonthStart = startOfMonth(currentMonth);
      const tripMonthStart = startOfMonth(tripStartDate);

      // Only update if we're not already showing the correct month
      if (!isSameMonth(currentMonthStart, tripMonthStart)) {
        setCurrentMonth(tripStartDate);
      }
    }
  }, [tripStartDate]);

  if (authLoading || tripLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <TravelLoading variant="journey" size="lg" text="Loading your trip adventure..." />
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

  // MOBILE-ONLY: Force Safari to respect viewport height on mobile.
  return (
    <>
      <div className="min-h-dvh md:min-h-screen bg-neutral-100">
        {/* Mobile Navigation */}
        <MobileNav
          trip={trip}
          user={user}
        />

        {/* Main Content Container */}
        {/* // MOBILE-ONLY: Provide breathing room for bottom nav & safe area. */}
        <div className="relative pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-0">
          <div className="md:flex md:h-screen">
            {/* Vertical Tab Navigation */}
            <aside
              className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white md:sticky md:top-0 md:h-screen md:overflow-y-auto md:overflow-x-hidden md:self-start md:z-20"
              data-tutorial="trip-navigation"
            >
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Trip Sections</h2>
                <nav className="space-y-2">
                  {/* 1. Group Calendar */}
                  <button
                    onClick={() => setActiveTab("calendar")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "calendar" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                  >
                    <Calendar className="w-5 h-5 mr-3" />
                    Group Calendar
                  </button>
                  {/* 2. My Schedule */}
                  <button
                    onClick={() => setActiveTab("schedule")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "schedule"
                        ? "bg-primary text-white"
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-onboarding="personal-schedule"
                  >
                    <UserIcon className="w-5 h-5 mr-3" />
                    My Schedule
                  </button>
                  {/* 3. Proposals */}
                  <button
                    onClick={() => setActiveTab("proposals")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "proposals" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-testid="button-proposals"
                  >
                    <CheckCircle className="w-5 h-5 mr-3" />
                    Proposals
                  </button>
                  {/* 4. Packing List */}
                  <button
                    onClick={() => setActiveTab("packing")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "packing" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                  >
                    <Package className="w-5 h-5 mr-3" />
                    Packing List
                  </button>
                  {/* 5. Flights */}
                  <button
                    onClick={() => setActiveTab("flights")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "flights" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-tutorial="flights-tab"
                  >
                    <Plane className="w-5 h-5 mr-3" />
                    Flights
                  </button>
                  {/* 6. Hotels */}
                  <button
                    onClick={() => setActiveTab("hotels")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "hotels" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-tutorial="hotels-tab"
                  >
                    <Hotel className="w-5 h-5 mr-3" />
                    Hotels
                  </button>
                  {/* 7. Discover Activities */}
                  <button
                    onClick={() => setActiveTab("activities")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "activities" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-tutorial="activities-tab"
                  >
                    <MapPin className="w-5 h-5 mr-3" />
                    Discover Activities
                  </button>
                  {/* 8. Restaurants */}
                  <button
                    onClick={() => setActiveTab("restaurants")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "restaurants" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                  >
                    <Utensils className="w-5 h-5 mr-3" />
                    Restaurants
                  </button>
                  {/* 9. Groceries */}
                  <button
                    onClick={() => setActiveTab("groceries")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "groceries" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5 mr-3" />
                    Groceries
                  </button>
                  {/* 10. Expenses */}
                  <button
                    onClick={() => setActiveTab("expenses")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "expenses" 
                        ? "bg-primary text-white" 
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-tutorial="expenses-tab"
                  >
                    <DollarSign className="w-5 h-5 mr-3" />
                    Expenses
                  </button>
                  {/* 11. Wish List */}
                  <button
                    onClick={() => setActiveTab("wish-list")}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === "wish-list"
                        ? "bg-primary text-white"
                        : "text-neutral-600 hover:bg-gray-50 hover:text-neutral-900"
                    }`}
                    data-testid="button-wish-list"
                  >
                    <Sparkles className="w-5 h-5 mr-3" />
                    Wish List
                  </button>
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 md:h-screen md:overflow-x-auto md:overflow-y-auto">
              <div className="p-4 lg:p-8">
                {/* Back to Dashboard Button */}
                <Link href="/">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-6 flex items-center hover:bg-gray-50"
                    data-testid="button-back-to-main-dashboard"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                  </Button>
                </Link>
                
                {/* Trip Header */}
                <div className="mb-10 space-y-6">
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-rose-500 to-orange-400 text-white shadow-xl">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_top_left,rgba(255,255,255,0.6),transparent_55%)]"
                      aria-hidden="true"
                    />
                    <div className="relative p-6 sm:p-10">
                      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl space-y-5">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                            <Calendar className="h-4 w-4" />
                            <span>Trip dashboard</span>
                          </div>
                          <div className="space-y-3">
                            <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm sm:text-4xl">{trip.name}</h1>
                            <p className="text-sm text-white/80 sm:text-base">
                              Keep everyone aligned with the plans, RSVPs, and updates in one place.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base">
                            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                              <MapPin className="h-4 w-4" />
                              <span className="font-medium">{trip.destination}</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {tripStartDate && tripEndDate
                                  ? `${format(tripStartDate, 'MMM dd')} - ${format(tripEndDate, 'MMM dd, yyyy')}`
                                  : tripStartDate
                                    ? `${format(tripStartDate, 'MMM dd, yyyy')}`
                                    : 'Dates TBD'}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowMembersModal(true)}
                              className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur transition-colors hover:bg-white/25"
                            >
                              <Users className="h-4 w-4" />
                              <span className="font-medium">
                                {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
                              </span>
                            </button>
                            {tripDurationDays && (
                              <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                                <Clock className="h-4 w-4" />
                                <span>{tripDurationDays} day{tripDurationDays === 1 ? '' : 's'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-full max-w-sm lg:max-w-md">
                          <div className="space-y-4 rounded-2xl bg-white/90 p-5 text-neutral-900 shadow-lg backdrop-blur">
                            <div className="flex flex-wrap items-center gap-2">
                              <NotificationIcon />
                              <Button
                                onClick={() => setShowWeatherModal(true)}
                                variant="outline"
                                size="sm"
                                data-testid="button-weather"
                              >
                                <Cloud className="mr-2 h-4 w-4" />
                                Weather
                              </Button>
                              {user?.id === trip.createdBy && (
                                <Button
                                  onClick={() => setShowEditTrip(true)}
                                  variant="outline"
                                  size="sm"
                                  data-testid="button-edit-trip"
                                >
                                  <Settings className="mr-2 h-4 w-4" />
                                  Edit Trip
                                </Button>
                              )}
                              <Button
                                onClick={() => setShowInviteModal(true)}
                                variant="outline"
                                size="sm"
                                data-tutorial="invite-button"
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Invite
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {activeTab === "calendar" && (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <div
                        className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label="Open activities planned details"
                        onClick={() => openSummaryPanel("activities")}
                        onKeyDown={(event) => handleSummaryCardKeyDown("activities", event)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-500">Activities planned</p>
                            <p className="mt-1 text-2xl font-semibold text-neutral-900">
                              {upcomingActivities.length}
                            </p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-neutral-500">Track everything happening across the trip.</p>
                      </div>
                      <div
                        className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label="Open your RSVPs details"
                        onClick={() => openSummaryPanel("rsvps")}
                        onKeyDown={(event) => handleSummaryCardKeyDown("rsvps", event)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-500">Your RSVPs</p>
                            <p className="mt-1 text-2xl font-semibold text-neutral-900">
                              {filteredMyInvitedActivities.length}
                            </p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserIcon className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-neutral-500">Keep tabs on the plans you’ve been invited to.</p>
                      </div>
                      <div
                        className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label="Open next on the calendar details"
                        onClick={() => openSummaryPanel("next")}
                        onKeyDown={(event) => handleSummaryCardKeyDown("next", event)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-500">Next on the calendar</p>
                            <p className="mt-1 text-base font-semibold text-neutral-900 line-clamp-2">
                              {nextActivity ? nextActivity.name : 'No upcoming activity'}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {nextActivity ? (nextActivityCountdown || 'Happening soon') : 'Add an activity to kick things off.'}
                            </p>
                            {nextActivityDateLabel && (
                              <p className="text-xs text-neutral-500">{nextActivityDateLabel}</p>
                            )}
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Clock className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tab Content */}
                {activeTab === "calendar" && (
                  <div className="space-y-6">
                    <Card className="overflow-hidden border-none shadow-xl">
                      <CardHeader className="space-y-6 border-b border-neutral-200 bg-neutral-50/80">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <CardTitle className="text-lg font-semibold text-neutral-900">Group activity calendar</CardTitle>
                            <p className="text-sm text-neutral-600">Use filters to focus on the plans that matter right now.</p>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">View</span>
                              <Select
                                value={groupCalendarView}
                                onValueChange={(value) => handleGroupViewChange(value as "month" | "day")}
                              >
                                <SelectTrigger className="min-w-[150px] bg-white">
                                  <SelectValue placeholder="Select view" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="month">Month view</SelectItem>
                                  <SelectItem value="day">Day view</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {groupCalendarView === "month" && (
                              <div className="flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                  aria-label="Previous month"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="min-w-[140px] text-center text-sm font-semibold text-neutral-900">
                                  {format(currentMonth, 'MMMM yyyy')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                  aria-label="Next month"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            <Button
                              onClick={handleOpenAddActivityForGroup}
                              className="bg-primary text-white hover:bg-red-600"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Activity
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-6">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              <Filter className="h-3.5 w-3.5" />
                              Category
                            </span>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                              <SelectTrigger className="min-w-[180px] bg-white">
                                <SelectValue placeholder="All activities" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category === "all" ? "All activities" : category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              <Users className="h-3.5 w-3.5" />
                              Person
                            </span>
                            <Select value={peopleFilter} onValueChange={setPeopleFilter}>
                              <SelectTrigger className="min-w-[200px] bg-white">
                                <SelectValue placeholder="Everyone" />
                              </SelectTrigger>
                              <SelectContent>
                                {people.map((personId) => {
                                  const member = trip?.members?.find((m: any) => m.userId === personId);
                                  const displayName = personId === "all" ? "Everyone" :
                                    member?.user ? `${member.user.firstName} ${member.user.lastName}`.trim() :
                                    member?.userId === user?.id ? "You" : "Unknown";

                                  return (
                                    <SelectItem key={personId} value={personId}>
                                      {displayName}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6" data-tutorial="group-calendar">
                        {groupCalendarView === "month" ? (
                          <>
                            <CalendarGrid
                              currentMonth={currentMonth}
                              activities={filteredActivities}
                              trip={trip}
                              selectedDate={selectedDate}
                              onDayClick={(date) => {
                                openAddActivityModal(clampDateToTrip(date));
                              }}
                              onActivityClick={handleActivityClick}
                            />
                            {filteredActivities.length === 0 && (
                              <div className="p-8 text-center">
                                <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                                <h3 className="mb-2 text-lg font-medium text-neutral-900">No activities planned yet</h3>
                                <p className="mb-4 text-neutral-600">
                                  Discover activities in {trip.destination} or add your own custom activities.
                                </p>
                                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                                  <Button
                                    onClick={handleOpenAddActivityForGroup}
                                    className="bg-primary text-white hover:bg-red-600"
                                  >
                                    <MapPin className="mr-2 h-4 w-4" />
                                    Add Activity
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : currentGroupDay ? (
                          <DayView
                            date={currentGroupDay}
                            activities={filteredActivities}
                            onPreviousDay={handleGroupPreviousDay}
                            onNextDay={handleGroupNextDay}
                            canGoPrevious={canGoToPreviousGroupDay}
                            canGoNext={canGoToNextGroupDay}
                            emptyStateMessage="No activities scheduled for this day yet. Use the Add Activity button to plan something fun."
                            onActivityClick={handleActivityClick}
                            currentUser={user}
                            onSubmitRsvp={(activity, action) => submitRsvpAction(activity.id, action)}
                            isRsvpPending={respondToInviteMutation.isPending}
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
                            Trip dates are needed to show the calendar view.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "schedule" && (
                  <div>
                    <Card className="mb-6">
                      <div className="px-6 py-4 border-b border-gray-200 space-y-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold text-neutral-900">My Personal Calendar</h2>
                            <p className="text-sm text-neutral-600">Visual calendar of your accepted activities</p>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">View</span>
                              <Select
                                value={scheduleCalendarView}
                                onValueChange={(value) => handleScheduleViewChange(value as "month" | "day")}
                              >
                                <SelectTrigger className="min-w-[150px] bg-white">
                                  <SelectValue placeholder="Select view" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="month">Month view</SelectItem>
                                  <SelectItem value="day">Day view</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {scheduleCalendarView === "month" && (
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="min-w-[120px] text-center text-sm font-semibold text-neutral-900">
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
                            )}
                            <Button
                              onClick={handleOpenAddActivityForSchedule}
                              className="bg-primary text-white hover:bg-red-600"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Activity
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        {scheduleCalendarView === "month" ? (
                          <CalendarGrid
                            currentMonth={currentMonth}
                            activities={myScheduleActivities}
                            trip={trip}
                            selectedDate={selectedDate}
                            onDayClick={(date) => {
                              openAddActivityModal(clampDateToTrip(date));
                            }}
                            onActivityClick={handleActivityClick}
                          />
                        ) : currentScheduleDay ? (
                          <DayView
                            date={currentScheduleDay}
                            activities={myScheduleActivities}
                            onPreviousDay={handleSchedulePreviousDay}
                            onNextDay={handleScheduleNextDay}
                            canGoPrevious={canGoToPreviousScheduleDay}
                            canGoNext={canGoToNextScheduleDay}
                            emptyStateMessage="No activities accepted for this day yet."
                            onActivityClick={handleActivityClick}
                            currentUser={user}
                            onSubmitRsvp={(activity, action) => submitRsvpAction(activity.id, action)}
                            isRsvpPending={respondToInviteMutation.isPending}
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
                            Trip dates are needed to show the calendar view.
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                )}

                {activeTab === "packing" && (
                  <PackingList tripId={parseInt(id || "0")} />
                )}

                {activeTab === "expenses" && (
                  <ExpenseTracker tripId={parseInt(id || "0")} user={user} />
                )}

                {activeTab === "activities" && (
                  <div className="p-6">
                    <ActivitySearch tripId={parseInt(id || "0")} trip={trip} user={user} />
                  </div>
                )}

                {activeTab === "groceries" && (
                  <GroceryList
                    tripId={parseInt(id || "0")}
                    user={user}
                    members={trip?.members ?? []}
                  />
                )}

                {activeTab === "proposals" && (
                  <div className="space-y-6" data-testid="proposals-section">
                    <Proposals tripId={parseInt(id || "0")} />
                  </div>
                )}

                {activeTab === "wish-list" && (
                  <div className="space-y-6" data-testid="wish-list-section">
                    <WishListBoard tripId={parseInt(id || "0")} />
                  </div>
                )}

                {activeTab === "flights" && (
                  <FlightCoordination tripId={parseInt(id || "0")} user={user} trip={trip} />
                )}
                
                {activeTab === "hotels" && (
                  <HotelBooking tripId={parseInt(id || "0")} user={user} trip={trip} />
                )}
                
                {activeTab === "restaurants" && (
                  <RestaurantBooking tripId={parseInt(id || "0")} user={user} trip={trip as TripWithDetails | undefined} />
                )}


                {/* Leave Trip Section */}
                {user && trip && (
                  <div className="px-4 lg:px-8 py-8 border-t border-gray-200 mt-8">
                    <div className="max-w-7xl mx-auto">
                      <div className="bg-red-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-red-900 mb-2">Leave Trip</h3>
                        <p className="text-red-700 mb-4">
                          {trip.createdBy === user.id 
                            ? "As the trip creator, you manage this trip for everyone. You cannot leave, but you can delete the entire trip if needed."
                            : "No longer able to join this trip? You can leave the group, but you won't be able to rejoin without a new invitation."
                          }
                        </p>
                        <LeaveTripButton trip={trip} user={user} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* // MOBILE-ONLY floating action button */}
          <button
            type="button"
            onClick={() => setShowAddActivity(true)}
            className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 active:scale-95"
            aria-label="Add Activity"
          >
            <Plus className="h-6 w-6 text-white" />
          </button>

          {/* // MOBILE-ONLY bottom tab bar */}
          <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex items-stretch gap-1 overflow-x-auto px-3">
              {MOBILE_TAB_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={`relative flex min-h-[44px] flex-none basis-24 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${
                      isActive ? "text-primary" : "text-neutral-500"
                    }`}
                    data-testid={item.key === "proposals" ? "mobile-button-proposals" : item.key === "wish-list" ? "mobile-button-wish-list" : undefined}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="w-full truncate text-[11px]">{item.label}</span>
                    <span
                      className={`mt-1 h-0.5 w-12 rounded-full transition-colors ${
                        isActive ? "bg-primary" : "bg-transparent"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        <Dialog open={summaryPanel !== null} onOpenChange={(open) => !open && closeSummaryPanel()}>
          {summaryPanel && (
            <DialogContent className="max-w-3xl">
              {summaryPanel === "activities" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Activities planned</DialogTitle>
                    <DialogDescription>
                      Upcoming activities that match your current filters.
                    </DialogDescription>
                  </DialogHeader>
                  {activitiesLoading ? (
                    <div className="py-12 text-center text-sm text-neutral-500">
                      Loading activities…
                    </div>
                  ) : upcomingActivities.length > 0 ? (
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="space-y-3 py-1">
                        {upcomingActivities.map(({ activity, start }) => {
                          const startLabel = format(start, "EEEE, MMM d");
                          const timeLabel = format(start, "h:mm a");
                          const locationLabel = activity.location?.trim();
                          const categoryLabel = !locationLabel && activity.category ? activity.category : null;
                          const waitlistedCount =
                            activity.waitlistedCount
                              ?? activity.invites.filter((invite) => invite.status === "waitlisted").length;

                          return (
                            <div
                              key={activity.id}
                              className="group rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 hover:border-primary/40"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenActivityFromPanel(activity)}
                              onKeyDown={(event) =>
                                handleDialogItemKeyDown(event, () => handleOpenActivityFromPanel(activity))
                              }
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-base font-semibold text-neutral-900">{activity.name}</p>
                                  <p className="mt-1 text-sm text-neutral-600">
                                    {startLabel} • {timeLabel}
                                  </p>
                                  {locationLabel ? (
                                    <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                                      <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                                      {locationLabel}
                                    </p>
                                  ) : categoryLabel ? (
                                    <p className="mt-2 text-xs text-neutral-500">Category: {categoryLabel}</p>
                                  ) : null}
                                </div>
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <Calendar className="h-5 w-5" />
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
                                <span>
                                  {activity.acceptedCount} going
                                  {activity.pendingCount > 0 && ` • ${activity.pendingCount} pending`}
                                  {activity.declinedCount > 0 && ` • ${activity.declinedCount} declined`}
                                  {waitlistedCount > 0 && ` • ${waitlistedCount} waitlist`}
                                </span>
                                <button
                                  type="button"
                                  className="text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleViewOnCalendar(activity);
                                  }}
                                >
                                  View on calendar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
                      No upcoming activities match your current filters.
                    </div>
                  )}
                </>
              )}

              {summaryPanel === "rsvps" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Your RSVPs</DialogTitle>
                    <DialogDescription>
                      Review and update your responses for activities that match the current filters.
                    </DialogDescription>
                  </DialogHeader>
                  {!user ? (
                    <div className="py-12 text-center text-sm text-neutral-500">
                      Sign in to manage your RSVPs.
                    </div>
                  ) : activitiesLoading ? (
                    <div className="py-12 text-center text-sm text-neutral-500">
                      Loading your invitations…
                    </div>
                  ) : sortedMyInvitedActivities.length > 0 ? (
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="space-y-3 py-1">
                        {sortedMyInvitedActivities.map((activity) => {
                          const invite = activity.invites?.find((entry) => entry.userId === user.id);
                          const status: ActivityInviteStatus = invite?.status ?? "pending";
                          const start = new Date(activity.startTime);
                          const dateLabel = Number.isNaN(start.getTime())
                            ? null
                            : format(start, "EEEE, MMM d");
                          const timeLabel = Number.isNaN(start.getTime()) ? null : format(start, "h:mm a");
                          const locationLabel = activity.location?.trim();
                          const waitlistedCount =
                            activity.waitlistedCount
                              ?? activity.invites.filter((entry) => entry.status === "waitlisted").length;
                          const capacityFull = Boolean(
                            activity.maxCapacity != null
                              && activity.acceptedCount >= activity.maxCapacity,
                          );
                          const quickOptions: ActivityInviteStatus[] = capacityFull
                            ? ["accepted", "pending", "declined", "waitlisted"]
                            : ["accepted", "pending", "declined"];

                          return (
                            <div
                              key={activity.id}
                              className="group rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 hover:border-primary/40"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenActivityFromPanel(activity)}
                              onKeyDown={(event) =>
                                handleDialogItemKeyDown(event, () => handleOpenActivityFromPanel(activity))
                              }
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-base font-semibold text-neutral-900">{activity.name}</p>
                                  {(dateLabel || timeLabel) && (
                                    <p className="mt-1 text-sm text-neutral-600">
                                      {dateLabel}
                                      {dateLabel && timeLabel ? " • " : ""}
                                      {timeLabel}
                                    </p>
                                  )}
                                  {locationLabel && (
                                    <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                                      <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                                      {locationLabel}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`border ${inviteStatusBadgeClasses[status]}`}
                                  title={status === "pending" ? "Pending response" : `Status: ${inviteStatusLabelMap[status]}`}
                                >
                                  {inviteStatusLabelMap[status]}
                                </Badge>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                {quickOptions.map((option) => {
                                  const isActive = status === option;
                                  const label =
                                    option === "accepted"
                                      ? "Going"
                                      : option === "pending"
                                        ? "Decide later"
                                        : option === "declined"
                                          ? "Can't make it"
                                          : isActive
                                            ? "Leave waitlist"
                                            : "Join waitlist";

                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      className={`rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                                        isActive
                                          ? "border-primary/50 bg-primary/10 text-primary"
                                          : "border-neutral-200 text-neutral-600 hover:border-primary/40 hover:text-primary"
                                      }`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleQuickRespond(activity.id, option, status);
                                      }}
                                      aria-pressed={isActive}
                                      disabled={respondToInviteMutation.isPending}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
                                <span>
                                  {activity.acceptedCount} going
                                  {activity.pendingCount > 0 && ` • ${activity.pendingCount} pending`}
                                  {activity.declinedCount > 0 && ` • ${activity.declinedCount} declined`}
                                  {waitlistedCount > 0 && ` • ${waitlistedCount} waitlist`}
                                </span>
                                <button
                                  type="button"
                                  className="text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleViewOnCalendar(activity);
                                  }}
                                >
                                  View on calendar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
                      No invitations match your current filters.
                    </div>
                  )}
                </>
              )}

              {summaryPanel === "next" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Next on the calendar</DialogTitle>
                    <DialogDescription>
                      Here’s the next upcoming event that matches your current filters.
                    </DialogDescription>
                  </DialogHeader>
                  {nextActivity ? (
                    <div className="space-y-5">
                      <div className="rounded-xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-neutral-900">{nextActivity.name}</p>
                            {nextActivityDateLabel && (
                              <p className="mt-1 text-sm text-neutral-600">{nextActivityDateLabel}</p>
                            )}
                            {nextActivityCountdown && (
                              <p className="text-xs text-neutral-500">{nextActivityCountdown}</p>
                            )}
                            {nextActivity.location ? (
                              <p className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
                                <MapPin className="h-4 w-4 text-neutral-400" />
                                {nextActivity.location}
                              </p>
                            ) : nextActivity.category ? (
                              <p className="mt-3 text-xs text-neutral-500">Category: {nextActivity.category}</p>
                            ) : null}
                          </div>
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Clock className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="mt-5 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Who’s going
                          </p>
                          {nextActivityAttendees.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {nextActivityAttendees.map((invite) => (
                                <Badge
                                  key={invite.id}
                                  variant="outline"
                                  className="border-neutral-300 bg-white text-neutral-700"
                                >
                                  {getParticipantDisplayName(invite.user)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-500">No one has RSVP’d yes yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          className="bg-primary text-white hover:bg-red-600"
                          onClick={() => handleOpenActivityFromPanel(nextActivity)}
                        >
                          Open event
                        </Button>
                        <Button
                          variant="outline"
                          className="border-neutral-200 bg-white text-neutral-700 hover:border-primary hover:text-primary"
                          onClick={() => handleOpenActivityFromPanel(nextActivity)}
                        >
                          Message group
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
                      Add an activity to see what’s coming up next.
                    </div>
                  )}
                </>
              )}
            </DialogContent>
          )}
        </Dialog>

        <AddActivityModal
          open={showAddActivity}
          onOpenChange={(open) => {
            setShowAddActivity(open);
            if (!open) {
              setSelectedDate(null);
            }
          }}
          tripId={parseInt(id || "0")}
          selectedDate={selectedDate}
          members={trip?.members ?? []}
        />

        {trip && (
          <EditTripModal
            open={showEditTrip}
            onOpenChange={setShowEditTrip}
            trip={trip}
          />
        )}

        {trip && (
          <InviteLinkModal
            open={showInviteModal}
            onOpenChange={setShowInviteModal}
            trip={trip}
          />
        )}

        {trip && (
          <Dialog open={showWeatherModal} onOpenChange={setShowWeatherModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Cloud className="w-5 h-5" />
                  <span>Weather Forecast for {trip.destination}</span>
                </DialogTitle>
                <DialogDescription>
                  View current weather conditions and forecast for your trip destination to help you plan activities and pack accordingly.
                </DialogDescription>
              </DialogHeader>
              <WeatherReport trip={trip} />
            </DialogContent>
          </Dialog>
        )}

        {trip && (
          <MembersModal
            open={showMembersModal}
            onOpenChange={setShowMembersModal}
            trip={trip}
          />
        )}

        <ActivityDetailsDialog
          activity={selectedActivity}
          open={isActivityDialogOpen && Boolean(selectedActivity)}
          onOpenChange={(open) => {
            setIsActivityDialogOpen(open);
            if (!open) {
              setSelectedActivityId(null);
            }
          }}
          onRespond={handleRespond}
          isResponding={respondToInviteMutation.isPending}
          currentUserId={user?.id ?? undefined}
        />
      </div>

    </>
  );
}

// Flight Coordination Component
function FlightCoordination({
  tripId,
  user,
  trip,
}: {
  tripId: number;
  user: any;
  trip?: TripWithDetails | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: flightsData, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/flights`],
    enabled: !!tripId,
  });

  const flights = Array.isArray(flightsData) ? flightsData : [];

  const [searchFormData, setSearchFormData] = useState({
    departure: "",
    arrival: "",
    departureDate: "",
    returnDate: "",
    passengers: "1",
    airline: "any",
  });
  const [hasPrefilledSearch, setHasPrefilledSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualFlightData, setManualFlightData] = useState({
    flightNumber: "",
    airline: "",
    airlineCode: "",
    departureAirport: "",
    departureCode: "",
    departureTime: "",
    arrivalAirport: "",
    arrivalCode: "",
    arrivalTime: "",
    price: "",
    seatClass: "economy",
    flightType: "outbound",
    bookingReference: "",
    aircraft: "",
    status: "confirmed",
  });

  useEffect(() => {
    if (hasPrefilledSearch) {
      return;
    }

    setSearchFormData((prev) => {
      const next = { ...prev };
      let changed = false;

      if (!prev.departure) {
        if (user?.defaultLocationCode) {
          next.departure = user.defaultLocationCode;
          changed = true;
        } else if (user?.defaultLocation) {
          next.departure = user.defaultLocation;
          changed = true;
        }
      }

      if (!prev.arrival && trip?.destination) {
        next.arrival = trip.destination;
        changed = true;
      }

      if (!prev.departureDate && trip?.startDate) {
        next.departureDate = format(new Date(trip.startDate), "yyyy-MM-dd");
        changed = true;
      }

      if (!prev.returnDate && trip?.endDate) {
        next.returnDate = format(new Date(trip.endDate), "yyyy-MM-dd");
        changed = true;
      }

      if (changed) {
        setHasPrefilledSearch(true);
        return next;
      }

      return prev;
    });
  }, [trip, user, hasPrefilledSearch]);

  const resetManualFlightForm = useCallback(() => {
    setManualFlightData({
      flightNumber: "",
      airline: "",
      airlineCode: "",
      departureAirport: "",
      departureCode: "",
      departureTime: "",
      arrivalAirport: "",
      arrivalCode: "",
      arrivalTime: "",
      price: "",
      seatClass: "economy",
      flightType: "outbound",
      bookingReference: "",
      aircraft: "",
      status: "confirmed",
    });
  }, []);

  const createFlightMutation = useMutation({
    mutationFn: async (flightData: InsertFlight) => {
      return apiRequest(`/api/trips/${tripId}/flights`, {
        method: "POST",
        body: flightData,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flights`] });
      toast({
        title: "Flight added",
        description: "Your flight has been saved to the trip.",
      });
      setIsManualDialogOpen(false);
      resetManualFlightForm();
    },
    onError: (error: any) => {
      toast({
        title: "Unable to add flight",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleManualSubmit = useCallback(() => {
    if (
      !manualFlightData.flightNumber ||
      !manualFlightData.airline ||
      !manualFlightData.departureAirport ||
      !manualFlightData.arrivalAirport ||
      !manualFlightData.departureTime ||
      !manualFlightData.arrivalTime
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields before saving.",
        variant: "destructive",
      });
      return;
    }

    const payload: InsertFlight = {
      ...manualFlightData,
      tripId,
      departureTime: new Date(manualFlightData.departureTime),
      arrivalTime: new Date(manualFlightData.arrivalTime),
      price: manualFlightData.price ? Number(manualFlightData.price) : null,
      currency: "USD",
    };

    createFlightMutation.mutate(payload);
  }, [createFlightMutation, manualFlightData, toast, tripId]);

  const handleFlightSearch = useCallback(async () => {
    if (!searchFormData.departure || !searchFormData.arrival || !searchFormData.departureDate) {
      toast({
        title: "Missing information",
        description: "Add departure, arrival, and departure date to search flights.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await apiRequest("/api/search/flights", {
        method: "POST",
        body: {
          origin: searchFormData.departure,
          destination: searchFormData.arrival,
          departureDate: searchFormData.departureDate,
          returnDate: searchFormData.returnDate || undefined,
          passengers: parseInt(searchFormData.passengers, 10),
          airline: searchFormData.airline && searchFormData.airline !== "any" ? searchFormData.airline : undefined,
          provider: "both",
          page: 1,
          limit: 50,
        },
      });

      const data = await response.json();

      if (data && Array.isArray(data.flights) && data.flights.length > 0) {
        setSearchResults(data.flights);
        toast({
          title: "Flights found",
          description: `We found ${data.flights.length} flight options for your search.`,
        });
      } else {
        setSearchResults([]);
        toast({
          title: "No flights found",
          description: "Try adjusting your dates or destinations.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Flight search error", error);
      setSearchResults([]);
      toast({
        title: "Search failed",
        description: error?.message || "Unable to search flights right now.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchFormData, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const handleManualDialogOpen = () => {
    resetManualFlightForm();
    setIsManualDialogOpen(true);
  };

  const handleManualDialogChange = (open: boolean) => {
    if (!open) {
      resetManualFlightForm();
    }
    setIsManualDialogOpen(open);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Flight Coordination</h2>
        <p className="text-gray-600">Coordinate flights with your group</p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void handleFlightSearch();
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>From</Label>
                <SmartLocationSearch
                  placeholder="Departure city or airport"
                  value={searchFormData.departure}
                  onLocationSelect={(location) =>
                    setSearchFormData((prev) => ({ ...prev, departure: location.displayName }))
                  }
                />
              </div>
              <div>
                <Label>To</Label>
                <SmartLocationSearch
                  placeholder="Arrival city or airport"
                  value={searchFormData.arrival}
                  onLocationSelect={(location) =>
                    setSearchFormData((prev) => ({ ...prev, arrival: location.displayName }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="flight-search-departure-date">Departure date</Label>
                <Input
                  id="flight-search-departure-date"
                  type="date"
                  value={searchFormData.departureDate}
                  onChange={(event) =>
                    setSearchFormData((prev) => ({ ...prev, departureDate: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="flight-search-return-date">Return (optional)</Label>
                <Input
                  id="flight-search-return-date"
                  type="date"
                  value={searchFormData.returnDate}
                  onChange={(event) =>
                    setSearchFormData((prev) => ({ ...prev, returnDate: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="flight-search-passengers">Passengers</Label>
                <Select
                  value={searchFormData.passengers}
                  onValueChange={(value) => setSearchFormData((prev) => ({ ...prev, passengers: value }))}
                >
                  <SelectTrigger id="flight-search-passengers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? "passenger" : "passengers"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="flight-search-airline">Airline</Label>
                <Select
                  value={searchFormData.airline}
                  onValueChange={(value) => setSearchFormData((prev) => ({ ...prev, airline: value }))}
                >
                  <SelectTrigger id="flight-search-airline">
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
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button type="submit" className="w-full sm:w-auto" disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleManualDialogOpen}
              >
                Log Flight Manually
              </Button>
            </div>
          </form>

          {isSearching ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-4">
              {searchResults.map((flight, index) => {
                const airlineName = getFlightAirlineName(flight);
                const priceLabel = formatPriceDisplay(flight.price ?? flight.totalPrice, flight.currency);
                const hasNumericPrice = parseNumericAmount(flight.price ?? flight.totalPrice) !== null;
                const departureInfo = getFlightEndpointInfo(flight, "departure", searchFormData.departure);
                const arrivalInfo = getFlightEndpointInfo(flight, "arrival", searchFormData.arrival);
                const stops = getFlightStops(flight);
                const duration = getFlightDurationLabel(flight);

                return (
                  <div key={`${airlineName}-${index}`} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Plane className="h-4 w-4 text-blue-600" />
                        <span>{airlineName}</span>
                        {flight.flightNumber && <span className="text-gray-500">{flight.flightNumber}</span>}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{priceLabel}</div>
                        {hasNumericPrice && <div className="text-xs text-gray-500">per traveler</div>}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-[1fr_auto_1fr] md:items-center">
                      <div className="flex items-start gap-2">
                        <PlaneTakeoff className="mt-0.5 h-4 w-4 text-green-600" />
                        <div>
                          <div className="font-medium">{departureInfo.location}</div>
                          <div className="text-gray-500">{departureInfo.timeLabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                        <ArrowRight className="h-4 w-4" />
                        <span>{duration}</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      <div className="flex items-start gap-2">
                        <PlaneLanding className="mt-0.5 h-4 w-4 text-red-600" />
                        <div>
                          <div className="font-medium">{arrivalInfo.location}</div>
                          <div className="text-gray-500">{arrivalInfo.timeLabel}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                      {typeof stops === "number" && (
                        <span>{stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`}</span>
                      )}
                      {flight.class && <span className="capitalize">{flight.class}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : hasSearched ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-600">
              No flights matched your search. Try different dates or airports.
            </div>
          ) : flights.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Plane className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-600">Search for flights to start coordinating with your group.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {searchResults.length === 0 && !isSearching && !hasSearched && (
        <Card>
          <CardContent className="p-6">
            {flights.length > 0 ? (
              <div className="space-y-4">
                {flights.slice(0, 3).map((flight: any) => (
                  <div key={flight.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center space-x-4">
                      <Plane className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-semibold">{flight.flightNumber}</p>
                        <p className="text-sm text-gray-600">
                          {flight.departureCode} → {flight.arrivalCode}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(flight.departureTime), "MMM dd, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{flight.status}</Badge>
                  </div>
                ))}
                {flights.length > 3 && (
                  <p className="text-center text-sm text-gray-500">+{flights.length - 3} more flights</p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Plane className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">No flights added yet</h3>
                <p className="text-gray-600">Use the search form above or log a flight manually to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isManualDialogOpen} onOpenChange={handleManualDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Flight Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="manual-flight-number">Flight Number *</Label>
                <Input
                  id="manual-flight-number"
                  placeholder="e.g., AA123"
                  value={manualFlightData.flightNumber}
                  onChange={(event) =>
                    setManualFlightData((prev) => ({ ...prev, flightNumber: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="manual-airline">Airline *</Label>
                <Input
                  id="manual-airline"
                  placeholder="e.g., American Airlines"
                  value={manualFlightData.airline}
                  onChange={(event) =>
                    setManualFlightData((prev) => ({ ...prev, airline: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>From *</Label>
                <SmartLocationSearch
                  placeholder="Departure airport"
                  value={manualFlightData.departureAirport}
                  onLocationSelect={(location) =>
                    setManualFlightData((prev) => ({
                      ...prev,
                      departureAirport: location.displayName,
                      departureCode: location.code,
                    }))
                  }
                />
              </div>
              <div>
                <Label>To *</Label>
                <SmartLocationSearch
                  placeholder="Arrival airport"
                  value={manualFlightData.arrivalAirport}
                  onLocationSelect={(location) =>
                    setManualFlightData((prev) => ({
                      ...prev,
                      arrivalAirport: location.displayName,
                      arrivalCode: location.code,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="manual-departure-time">Departure Time *</Label>
                <Input
                  id="manual-departure-time"
                  type="datetime-local"
                  value={manualFlightData.departureTime}
                  onChange={(event) =>
                    setManualFlightData((prev) => ({ ...prev, departureTime: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="manual-arrival-time">Arrival Time *</Label>
                <Input
                  id="manual-arrival-time"
                  type="datetime-local"
                  value={manualFlightData.arrivalTime}
                  onChange={(event) =>
                    setManualFlightData((prev) => ({ ...prev, arrivalTime: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="manual-price">Price ($)</Label>
                <Input
                  id="manual-price"
                  type="number"
                  min="0"
                  value={manualFlightData.price}
                  onChange={(event) =>
                    setManualFlightData((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="manual-seat-class">Seat Class</Label>
                <Select
                  value={manualFlightData.seatClass}
                  onValueChange={(value) => setManualFlightData((prev) => ({ ...prev, seatClass: value }))}
                >
                  <SelectTrigger id="manual-seat-class">
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="manual-flight-type">Flight Type</Label>
                <Select
                  value={manualFlightData.flightType}
                  onValueChange={(value) => setManualFlightData((prev) => ({ ...prev, flightType: value }))}
                >
                  <SelectTrigger id="manual-flight-type">
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
                <Label htmlFor="manual-booking-reference">Booking Reference</Label>
                <Input
                  id="manual-booking-reference"
                  placeholder="e.g., ABC123"
                  value={manualFlightData.bookingReference}
                  onChange={(event) =>
                    setManualFlightData((prev) => ({ ...prev, bookingReference: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => handleManualDialogChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleManualSubmit}
                disabled={createFlightMutation.isPending}
              >
                {createFlightMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Flight"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseNumericAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function formatPriceDisplay(value: unknown, currency?: string | null, fallback = "See details"): string {
  const amount = parseNumericAmount(value);
  if (amount !== null) {
    return formatCurrency(amount, { currency: currency ?? "USD" });
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return fallback;
}

function getFlightDurationLabel(flight: any): string {
  const durationSource =
    flight?.duration ||
    flight?.totalDuration ||
    flight?.itineraries?.[0]?.duration ||
    flight?.segments?.[0]?.duration ||
    null;

  if (!durationSource) {
    return "Duration varies";
  }

  const minutes = parseDurationToMinutes(durationSource);
  if (minutes === null) {
    return typeof durationSource === "string" ? durationSource : "Duration varies";
  }

  return formatDuration(minutes);
}

function parseDurationToMinutes(duration?: string | number | null): number | null {
  if (duration == null) {
    return null;
  }

  if (typeof duration === "number") {
    return duration;
  }

  const isoMatch = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (isoMatch) {
    const hours = isoMatch[1] ? parseInt(isoMatch[1], 10) : 0;
    const minutes = isoMatch[2] ? parseInt(isoMatch[2], 10) : 0;
    return hours * 60 + minutes;
  }

  const simpleMatch = duration.match(/(\d+)h\s*(\d+)?m?/i);
  if (simpleMatch) {
    const hours = parseInt(simpleMatch[1], 10);
    const minutes = simpleMatch[2] ? parseInt(simpleMatch[2], 10) : 0;
    return hours * 60 + minutes;
  }

  const numeric = parseInt(duration, 10);
  return Number.isNaN(numeric) ? null : numeric;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

function getFlightEndpointInfo(
  flight: any,
  key: "departure" | "arrival",
  fallbackLocation?: string,
): { location: string; timeLabel: string } {
  const segments = Array.isArray(flight?.segments) ? flight.segments : flight?.itineraries?.[0]?.segments;
  const segmentIndex = key === "departure" ? 0 : Math.max((segments?.length ?? 1) - 1, 0);
  const segment = segments?.[segmentIndex];
  const endpoint = flight?.[key] || segment?.[key] || segment?.[key === "departure" ? "origin" : "destination"] || {};

  const airportName =
    endpoint?.airport ||
    endpoint?.name ||
    endpoint?.city ||
    endpoint?.iataCode ||
    endpoint?.iata ||
    (key === "departure" ? flight?.departureAirport : flight?.arrivalAirport) ||
    extractAirportName(fallbackLocation) ||
    fallbackLocation ||
    "TBD";

  const airportCode =
    endpoint?.iataCode ||
    endpoint?.iata ||
    endpoint?.code ||
    (key === "departure" ? flight?.departureCode : flight?.arrivalCode) ||
    extractAirportCode(fallbackLocation) ||
    null;

  let location = airportName;
  if (airportCode && !location.includes(airportCode)) {
    location = `${location} (${airportCode})`;
  }

  const timeSource =
    endpoint?.time ||
    endpoint?.at ||
    endpoint?.dateTime ||
    (key === "departure" ? flight?.departureTime : flight?.arrivalTime);

  const timeLabel = timeSource
    ? new Date(timeSource).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "Time varies";

  return { location, timeLabel };
}

function getFlightStops(flight: any): number | null {
  if (typeof flight?.stops === "number") {
    return flight.stops;
  }

  if (typeof flight?.numberOfStops === "number") {
    return flight.numberOfStops;
  }

  const segments = Array.isArray(flight?.segments)
    ? flight.segments
    : Array.isArray(flight?.itineraries?.[0]?.segments)
    ? flight.itineraries[0].segments
    : null;

  if (segments && segments.length > 0) {
    return Math.max(segments.length - 1, 0);
  }

  return null;
}

function extractAirportCode(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 3) {
    return trimmed.toUpperCase();
  }

  const match = trimmed.match(/\(([A-Z]{3})\)/);
  return match ? match[1] : null;
}

function extractAirportName(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*)\s+\([A-Z]{3}\)$/);
  if (match) {
    return match[1].trim();
  }

  return value;
}

function getFlightAirlineName(flight: any): string {
  let airlineCode = "";

  if (Array.isArray(flight?.airlines) && flight.airlines.length > 0) {
    airlineCode = flight.airlines[0];
  } else if (typeof flight?.airline === "string") {
    airlineCode = flight.airline;
  } else if (Array.isArray(flight?.segments) && flight.segments.length > 0) {
    airlineCode = flight.segments[0]?.airline || flight.segments[0]?.carrierCode || "";
  } else if (Array.isArray(flight?.validatingAirlineCodes) && flight.validatingAirlineCodes.length > 0) {
    airlineCode = flight.validatingAirlineCodes[0];
  }

  airlineCode = airlineCode.toString().trim().toUpperCase();

  if (airlineCode && airlineCode.length >= 2 && airlineCode.length <= 3) {
    return getAirlineName(airlineCode);
  }

  if (airlineCode && airlineCode.length > 3) {
    return airlineCode;
  }

  return "Flight";
}

function getAirlineName(code: string): string {
  const airlineMap: Record<string, string> = {
    AA: "American Airlines",
    DL: "Delta Air Lines",
    UA: "United Airlines",
    SW: "Southwest Airlines",
    WN: "Southwest Airlines",
    AS: "Alaska Airlines",
    B6: "JetBlue Airways",
    F9: "Frontier Airlines",
    NK: "Spirit Airlines",
    G4: "Allegiant Air",
    SY: "Sun Country Airlines",
    VS: "Virgin Atlantic",
    BA: "British Airways",
    LH: "Lufthansa",
    AF: "Air France",
    KL: "KLM",
    IB: "Iberia",
    OS: "Austrian Airlines",
    EY: "Etihad Airways",
    QR: "Qatar Airways",
    EK: "Emirates",
    TK: "Turkish Airlines",
    JL: "Japan Airlines",
    NH: "All Nippon Airways",
    CX: "Cathay Pacific",
    SQ: "Singapore Airlines",
    AC: "Air Canada",
    WS: "WestJet",
  };

  return airlineMap[code] ?? code;
}

// Hotel Booking Component
function HotelBooking({ tripId, user, trip }: { tripId: number; user: any; trip?: TripWithDetails | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoading } = useQuery<HotelWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/hotels`],
    enabled: !!tripId,
  });

  const { data: hotelProposals = [] } = useQuery<HotelProposalWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/hotel-proposals`],
    enabled: !!tripId,
  });

  const {
    showModal: showBookingModal,
    bookingData,
    storeBookingIntent,
    closeModal: closeBookingModal,
  } = useBookingConfirmation();

  const searchPanelRef = useRef<HotelSearchPanelRef>(null);
  const [isManualHotelFormOpen, setIsManualHotelFormOpen] = useState(false);

  const focusSearchPanel = useCallback(() => {
    searchPanelRef.current?.focusForm();
  }, []);

  const openManualForm = useCallback(() => {
    setIsManualHotelFormOpen(true);
  }, []);

  const shareHotelWithGroup = useCallback(
    async (hotel: HotelSearchResult) => {
      try {
        await apiRequest(`/api/trips/${tripId}/hotel-proposals`, {
          method: "POST",
          body: JSON.stringify({
            hotelName: hotel.name,
            location: hotel.location,
            price: hotel.price,
            pricePerNight: hotel.pricePerNight || hotel.price,
            rating: hotel.rating || 4,
            amenities: hotel.amenities || "WiFi, Breakfast",
            platform: hotel.platform,
            bookingUrl: hotel.bookingUrl,
          }),
        });

        toast({
          title: "Added to Group Hotels!",
          description: `${hotel.name} is now ready for everyone to review and rank.`,
        });

        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        if (isUnauthorizedError(errorObj)) {
          toast({
            title: "Unauthorized",
            description: "You need to be logged in to propose hotels.",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/login";
          }, 500);
          return;
        }
        toast({
          title: "Error",
          description: "Failed to propose hotel. Please try again.",
          variant: "destructive",
        });
      }
    },
    [queryClient, toast, tripId],
  );

  const formDefaults = useCallback(
    () => createHotelFormDefaults(tripId, { startDate: trip?.startDate, endDate: trip?.endDate }),
    [tripId, trip?.startDate, trip?.endDate],
  );

  const form = useForm<HotelFormValues>({
    resolver: zodResolver(hotelFormSchema),
    defaultValues: formDefaults(),
  });

  useEffect(() => {
    form.reset(formDefaults());
  }, [form, formDefaults]);

  const createHotelMutation = useMutation({
    mutationFn: async (payload: InsertHotel) => {
      return await apiRequest(`/api/trips/${tripId}/hotels`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
      toast({
        title: "Hotel added",
        description: "Your hotel booking has been saved to the trip.",
      });
      form.reset(formDefaults());
      setIsManualHotelFormOpen(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to add hotels.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add hotel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: HotelFormValues) => {
    createHotelMutation.mutate(transformHotelFormValues(values));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Hotel Booking</h2>
            <p className="text-gray-600">Find and book accommodations</p>
          </div>
          <Button
            onClick={focusSearchPanel}
            className="bg-primary hover:bg-red-600 text-white"
          >
            <Search className="w-4 h-4 mr-2" />
            Search Hotels
          </Button>
        </div>

        <HotelSearchPanel
          ref={searchPanelRef}
          tripId={tripId}
          trip={trip ?? null}
          onLogHotelManually={openManualForm}
          onShareHotelWithGroup={shareHotelWithGroup}
          storeBookingIntent={storeBookingIntent}
          hotelProposalsCount={hotelProposals.length}
          toast={toast}
        />

        <Collapsible open={isManualHotelFormOpen} onOpenChange={setIsManualHotelFormOpen}>
          <div className="rounded-lg border border-dashed bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">Manual entry</p>
                <p className="text-sm text-muted-foreground">
                  Record a stay that isn't imported from the hotel search results.
                </p>
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-between sm:justify-center"
                >
                  <span>{isManualHotelFormOpen ? "Close" : "Add a Hotel"}</span>
                  <ChevronDown
                    className={`ml-2 h-4 w-4 transition-transform ${isManualHotelFormOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-6 p-4 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <HotelFormFields
                    form={form}
                    isSubmitting={createHotelMutation.isPending}
                    submitLabel={createHotelMutation.isPending ? "Saving..." : "Save Hotel"}
                    showCancelButton
                    onCancel={() => {
                      form.reset(formDefaults());
                      setIsManualHotelFormOpen(false);
                    }}
                  />
                </form>
              </Form>
            </CollapsibleContent>
          </div>
        </Collapsible>

      </div>

      <BookingConfirmationModal
        isOpen={showBookingModal}
        onClose={closeBookingModal}
        bookingType={bookingData?.type || "hotel"}
        bookingData={bookingData?.data}
        tripId={tripId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
          queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
        }}
      />
    </>
  );
}
// Restaurant Booking Component
function RestaurantBooking({
  tripId,
  user,
  trip,
}: {
  tripId: number;
  user: any;
  trip?: TripWithDetails;
}) {
  const { data: restaurants = [], isLoading } = useQuery<RestaurantWithDetails[]>({
    queryKey: ["/api/trips", tripId, "restaurants"],
    enabled: !!tripId,
  });
  const [, setLocation] = useLocation();
  const searchPanelRef = useRef<HTMLDivElement | null>(null);

  const focusSearchPanel = useCallback(() => {
    if (!searchPanelRef.current) {
      return;
    }

    searchPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstFocusable = searchPanelRef.current.querySelector<HTMLElement>(
      "input, button, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
  }, []);

  const handleBookingLinkClick = useCallback(
    (_restaurant: any, link: { text: string; url: string }) => {
      if (!link?.url) {
        return;
      }

      if (typeof window !== "undefined") {
        window.open(link.url, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const hasRestaurants = Array.isArray(restaurants) && restaurants.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Restaurant Reservations</h2>
          <p className="text-gray-600">
            Make dining plans for your group and keep everything in one place.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button
            onClick={focusSearchPanel}
            className="bg-primary hover:bg-red-600 text-white w-full sm:w-auto"
          >
            <Search className="w-4 h-4 mr-2" />
            Search Restaurants
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setLocation(`/trip/${tripId}/restaurants?manual=1`)}
          >
            <NotebookPen className="w-4 h-4 mr-2" />
            Log Restaurant Manually
          </Button>
          <Link href={`/trip/${tripId}/restaurants`}>
            <Button variant="outline" className="w-full sm:w-auto">
              Open Full Planner
            </Button>
          </Link>
        </div>
      </div>

      <RestaurantSearchPanel
        ref={searchPanelRef}
        tripId={tripId}
        trip={trip}
        user={user}
        onBookingLinkClick={handleBookingLinkClick}
        onLogRestaurantManually={() => setLocation(`/trip/${tripId}/restaurants?manual=1`)}
      />

      <Card>
        <CardContent className="p-6">
          {hasRestaurants ? (
            <div className="space-y-4">
              {restaurants.slice(0, 3).map((restaurant) => {
                const displayName = (restaurant as any).restaurantName ?? restaurant.name ?? "Restaurant";
                const displayAddress = restaurant.address ?? (restaurant as any).location ?? "";
                const reservationStatus = restaurant.reservationStatus ?? "planned";
                const reservationDate = restaurant.reservationDate
                  ? format(new Date(restaurant.reservationDate), "MMM dd")
                  : null;
                const reservationTime = restaurant.reservationTime ?? (restaurant as any).reservation_start_time ?? "";

                return (
                  <div
                    key={restaurant.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{displayName}</p>
                        {displayAddress && (
                          <p className="text-sm text-gray-600">{displayAddress}</p>
                        )}
                        {reservationDate && (
                          <p className="text-sm text-gray-500">
                            {reservationDate}
                            {reservationTime ? ` at ${reservationTime}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <Badge variant="outline" className="uppercase tracking-wide">
                        {reservationStatus}
                      </Badge>
                      {restaurant.partySize && (
                        <p className="mt-1 text-sm text-gray-500">{restaurant.partySize} people</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {restaurants.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{restaurants.length - 3} more restaurants
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Utensils className="mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No restaurants added yet</h3>
              <p className="mb-4 max-w-md text-gray-600">
                Start planning meals for your trip. Search for restaurants and add them directly to your itinerary.
              </p>
              <Button
                onClick={focusSearchPanel}
                className="bg-primary hover:bg-red-600 text-white"
              >
                <Search className="w-4 h-4 mr-2" />
                Search Restaurants
              </Button>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => setLocation(`/trip/${tripId}/restaurants?manual=1`)}
              >
                <NotebookPen className="w-4 h-4 mr-2" />
                Log Restaurant Manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Members Modal Component
function MembersModal({ open, onOpenChange, trip }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  trip: TripWithDetails; 
}) {
  const { user } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trip Members</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {trip.members && trip.members.length > 0 ? (
            <div className="space-y-3">
              {(trip as any).members.map((member: any) => (
                <div key={member.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    {member.user?.firstName ? member.user.firstName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {member.user?.firstName} {member.user?.lastName}
                      {member.userId === (trip as any).createdBy && (
                        <Badge variant="secondary" className="ml-2 text-xs">Trip Creator</Badge>
                      )}
                      {member.userId === user?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">{member.user?.email}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No members found</p>
            </div>
          )}
          
          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-2">
              {trip.members?.length || 0} member{(trip.members?.length || 0) !== 1 ? 's' : ''} total
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                // You could add invite functionality here
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Invite More People
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Weather interfaces
interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface CurrentWeather {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  cloudiness: number;
  uvIndex?: number;
  sunrise: number;
  sunset: number;
  conditions: WeatherCondition[];
  lastUpdated: Date;
}

interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
    day: number;
    night: number;
  };
  humidity: number;
  windSpeed: number;
  cloudiness: number;
  conditions: WeatherCondition[];
  precipitationChance: number;
}

interface WeatherResponse {
  current: CurrentWeather;
  forecast: WeatherForecast[];
  advice: string[];
  metadata?: {
    requestedStart?: string;
    requestedEnd?: string;
    forecastCoverageStart?: string;
    forecastCoverageEnd?: string;
    outOfRange: boolean;
  };
}

// Weather Report Component
function WeatherReport({ trip }: { trip: TripWithDetails }) {
  const { data: weatherData, isLoading: weatherLoading, error: weatherError, refetch } = useQuery<WeatherResponse>({
    queryKey: ['weather', {
      location: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      units: 'F'
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        location: trip.destination,
        units: 'F',
        startDate: new Date(trip.startDate).toISOString().split('T')[0],
        endDate: new Date(trip.endDate).toISOString().split('T')[0]
      });
      
      const response = await apiFetch(`/api/weather?${params}`);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!trip.destination && !!trip.startDate && !!trip.endDate,
    staleTime: 10 * 60 * 1000, // Consider fresh for 10 minutes
    retry: 2,
  });

  if (weatherLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Weather Forecast</h2>
            <p className="text-gray-600">Weather for {trip.destination}</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <TravelLoading variant="weather" size="lg" text="Loading weather data..." />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (weatherError || !weatherData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Weather Forecast</h2>
            <p className="text-gray-600">Weather for {trip.destination}</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load weather</h3>
              <p className="text-gray-600 mb-4">
                We couldn't fetch weather data for {trip.destination}. Please check your connection and try again.
              </p>
              <Button 
                onClick={() => refetch()}
                variant="outline"
                className="mt-2"
                data-testid="button-retry-weather"
              >
                <Cloud className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { current, forecast, advice, metadata } = weatherData;

  // Helper function to get weather icon
  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('rain') || lowerCondition.includes('shower')) {
      return '🌧️';
    } else if (lowerCondition.includes('snow')) {
      return '❄️';
    } else if (lowerCondition.includes('cloud')) {
      return '☁️';
    } else if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) {
      return '☀️';
    } else if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) {
      return '⛈️';
    } else if (lowerCondition.includes('fog') || lowerCondition.includes('mist')) {
      return '🌫️';
    }
    return '🌤️';
  };

  // Filter forecast to only show days within trip dates
  const tripStartDate = new Date(trip.startDate);
  const tripEndDate = new Date(trip.endDate);
  const tripForecast = forecast.filter((day: WeatherForecast) => {
    const forecastDate = new Date(day.date);
    return forecastDate >= tripStartDate && forecastDate <= tripEndDate;
  });

  return (
    <div className="space-y-6" data-testid="weather-report">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Weather Forecast</h2>
          <p className="text-gray-600">Weather for {trip.destination}</p>
        </div>
      </div>

      {/* Out of Range Notice */}
      {metadata?.outOfRange && metadata.requestedStart && metadata.requestedEnd && (
        <Card className="border-yellow-200 bg-yellow-50" data-testid="weather-out-of-range-notice">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-yellow-800 mb-1">
                  Weather forecast not available for your trip dates
                </h3>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p>
                    <strong>Your trip:</strong> {format(new Date(metadata.requestedStart), 'MMM dd')} - {format(new Date(metadata.requestedEnd), 'MMM dd, yyyy')}
                  </p>
                  {metadata.forecastCoverageStart && metadata.forecastCoverageEnd && (
                    <p>
                      <strong>Available forecast:</strong> {format(new Date(metadata.forecastCoverageStart), 'MMM dd')} - {format(new Date(metadata.forecastCoverageEnd), 'MMM dd, yyyy')}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-yellow-600">
                    Showing the nearest available weather forecast. For more accurate trip planning, check closer to your departure date.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Weather Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cloud className="w-5 h-5" />
            <span>Current Conditions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">{getWeatherIcon(current.conditions[0]?.main || 'Clear')}</div>
              <div className="text-2xl font-bold text-gray-900">{current.temperature}°F</div>
              <div className="text-sm text-gray-600">Feels like {current.feelsLike}°F</div>
              <div className="text-sm font-medium text-gray-800 mt-1 capitalize">
                {current.conditions[0]?.description || 'Clear'}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Humidity:</span>
                <span className="font-medium">{current.humidity}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Wind:</span>
                <span className="font-medium">{current.windSpeed} mph</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Visibility:</span>
                <span className="font-medium">{Math.round(current.visibility / 1000)} km</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Pressure:</span>
                <span className="font-medium">{current.pressure} hPa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cloudiness:</span>
                <span className="font-medium">{current.cloudiness}%</span>
              </div>
              {current.uvIndex && (
                <div className="flex justify-between">
                  <span className="text-gray-600">UV Index:</span>
                  <span className="font-medium">{current.uvIndex}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Sunrise:</span>
                <span className="font-medium">{format(new Date(current.sunrise * 1000), 'h:mm a')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sunset:</span>
                <span className="font-medium">{format(new Date(current.sunset * 1000), 'h:mm a')}</span>
              </div>
              <div className="text-xs text-gray-500">
                Updated {formatDistanceToNow(current.lastUpdated)} ago
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trip Forecast */}
      {tripForecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>
                {metadata?.outOfRange 
                  ? `Available Forecast ${metadata.forecastCoverageStart && metadata.forecastCoverageEnd ? `(${format(new Date(metadata.forecastCoverageStart), 'MMM dd')} - ${format(new Date(metadata.forecastCoverageEnd), 'MMM dd')})` : ''}`
                  : `Trip Forecast (${format(tripStartDate, 'MMM dd')} - ${format(tripEndDate, 'MMM dd')})`
                }
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tripForecast.map((day: WeatherForecast, index: number) => (
                <div key={day.date} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="font-medium text-gray-900 mb-2">
                    {format(new Date(day.date), 'MMM dd')}
                  </div>
                  <div className="text-2xl mb-2">{getWeatherIcon(day.conditions[0]?.main || 'Clear')}</div>
                  <div className="text-sm font-medium text-gray-800 mb-2 capitalize">
                    {day.conditions[0]?.description || 'Clear'}
                  </div>
                  <div className="text-lg font-bold text-gray-900 mb-1">
                    {day.temperature.max}° / {day.temperature.min}°F
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>💧 {day.precipitationChance}% chance</div>
                    <div>💨 {day.windSpeed} mph</div>
                    <div>💧 {day.humidity}% humidity</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Travel Advice */}
      {advice && advice.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Travel Advice</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {advice.map((tip: string, index: number) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="text-blue-600 mt-0.5">💡</div>
                  <p className="text-blue-900 text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extended Forecast */}
      {forecast.length > tripForecast.length && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cloud className="w-5 h-5" />
              <span>Extended Forecast</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {forecast.slice(0, 5).map((day: WeatherForecast, index: number) => (
                <div key={day.date} className="text-center p-3 border rounded-lg">
                  <div className="font-medium text-gray-900 mb-2 text-sm">
                    {format(new Date(day.date), 'EEE, MMM dd')}
                  </div>
                  <div className="text-xl mb-2">{getWeatherIcon(day.conditions[0]?.main || 'Clear')}</div>
                  <div className="text-sm font-medium text-gray-800 mb-2 capitalize">
                    {day.conditions[0]?.main || 'Clear'}
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {day.temperature.max}° / {day.temperature.min}°F
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    💧 {day.precipitationChance}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

