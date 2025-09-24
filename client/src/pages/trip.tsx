import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  Clock,
  User as UserIcon,
  Package,
  DollarSign,
  ShoppingCart,
  Plane,
  Hotel,
  Utensils,
  Star,
  Trash2,
  ExternalLink,
  Cloud,
  Sparkles,
  CheckCircle,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiFetch } from "@/lib/api";
import { CalendarGrid } from "@/components/calendar-grid";
import { ActivityCard } from "@/components/activity-card";
import { AddActivityModal } from "@/components/add-activity-modal";
import { EditTripModal } from "@/components/edit-trip-modal";
import { InviteLinkModal } from "@/components/invite-link-modal";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { PackingList } from "@/components/packing-list";
import { ExpenseTracker } from "@/components/expense-tracker";
import { GroceryList } from "@/components/grocery-list";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationIcon } from "@/components/notification-icon";
import { LeaveTripButton } from "@/components/leave-trip-button";
import { TravelLoading } from "@/components/LoadingSpinners";
import ActivitySearch from "@/components/activity-search";
import { WishListBoard } from "@/components/wish-list-board";
import Proposals from "@/pages/proposals";
import type { TripWithDetails, ActivityWithDetails, User } from "@shared/schema";
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

interface DayViewProps {
  date: Date;
  activities: ActivityWithDetails[];
  onPreviousDay: () => void;
  onNextDay: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  emptyStateMessage?: string;
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
}: DayViewProps) {
  const dayActivities = activities
    .filter((activity) => isSameDay(new Date(activity.startTime), date))
    .sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

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
            const participants = activity.acceptances.map((acceptance) =>
              getParticipantDisplayName(acceptance.user),
            );

            return (
              <div
                key={activity.id}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {activity.name}
                  </h3>
                  <div className="flex items-center text-sm font-medium text-neutral-700">
                    <Clock className="mr-2 h-4 w-4" />
                    {formatActivityTimeRange(activity.startTime, activity.endTime)}
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
                  {participants.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {participants.map((name, index) => (
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

  const tripStartDate = trip?.startDate ? startOfDay(new Date(trip.startDate)) : null;
  const tripEndDate = trip?.endDate ? startOfDay(new Date(trip.endDate)) : null;

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
    if (trip?.startDate) {
      const start = startOfDay(new Date(trip.startDate));
      setGroupViewDate((prev) => (prev ? prev : start));
      setScheduleViewDate((prev) => (prev ? prev : start));
      setSelectedDate((prev) => (prev ? prev : start));
    }
  }, [trip?.startDate]);

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

  // Filter activities by category and people
  const getFilteredActivities = () => {
    let filtered = activities;
    
    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((activity) => activity.category === categoryFilter);
    }
    
    // Filter by people
    if (peopleFilter !== "all") {
      filtered = filtered.filter((activity) => {
        // Show activities accepted by the selected person
        return activity.acceptances?.some((acceptance) => acceptance.userId === peopleFilter);
      });
    }
    
    return filtered;
  };

  // Get user's personal schedule (only accepted activities)
  const getMySchedule = () => {
    if (!user) return [];
    return activities.filter((activity) => {
      return activity.acceptances?.some((acceptance) => acceptance.userId === user.id);
    });
  };

  const myScheduleActivities = getMySchedule();
  const filteredActivities = getFilteredActivities();
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

  const now = new Date();
  const upcomingActivities = activities
    .map((activity) => ({
      activity,
      start: new Date(activity.startTime),
    }))
    .filter(({ start }) => !Number.isNaN(start.getTime()) && start.getTime() >= now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const nextActivityEntry = upcomingActivities[0];
  const nextActivity = nextActivityEntry?.activity;
  const nextActivityStart = nextActivityEntry?.start;
  const nextActivityCountdown = nextActivityStart
    ? formatDistanceToNow(nextActivityStart, { addSuffix: true })
    : null;
  const nextActivityDateLabel = nextActivityStart
    ? format(nextActivityStart, "MMM d • h:mm a")
    : null;

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

  return (
    <>
      <div className="min-h-screen bg-neutral-100">
        {/* Mobile Navigation */}
        <MobileNav 
          trip={trip}
          user={user}
        />

        {/* Main Content Container */}
        <div className="relative">
          <div className="flex">
            {/* Vertical Tab Navigation */}
            <div className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-screen fixed left-0 top-0 z-40" data-tutorial="trip-navigation">
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
            </div>

            {/* Main Content */}
            <div className="flex-1 lg:ml-64">
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
                      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-500">Activities planned</p>
                            <p className="mt-1 text-2xl font-semibold text-neutral-900">{activities.length}</p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-neutral-500">Track everything happening across the trip.</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-500">Your RSVPs</p>
                            <p className="mt-1 text-2xl font-semibold text-neutral-900">{myScheduleActivities.length}</p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserIcon className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-neutral-500">Keep tabs on the plans you’ve accepted.</p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
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
                  <FlightCoordination tripId={parseInt(id || "0")} user={user} />
                )}
                
                {activeTab === "hotels" && (
                  <HotelBooking tripId={parseInt(id || "0")} user={user} />
                )}
                
                {activeTab === "restaurants" && (
                  <RestaurantBooking tripId={parseInt(id || "0")} user={user} />
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
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
            <div className="flex justify-around">
              <button 
                onClick={() => setActiveTab("calendar")}
                className={`flex flex-col items-center py-2 ${activeTab === "calendar" ? "text-primary" : "text-neutral-600"}`}
              >
                <Calendar className="w-5 h-5" />
                <span className="text-xs mt-1 font-medium">Group</span>
              </button>
              <button 
                onClick={() => setActiveTab("schedule")}
                className={`flex flex-col items-center py-2 ${activeTab === "schedule" ? "text-primary" : "text-neutral-600"}`}
              >
                <Clock className="w-5 h-5" />
                <span className="text-xs mt-1">Personal</span>
              </button>
              <button 
                onClick={() => setActiveTab("packing")}
                className={`flex flex-col items-center py-2 ${activeTab === "packing" ? "text-primary" : "text-neutral-600"}`}
              >
                <Package className="w-5 h-5" />
                <span className="text-xs mt-1">Packing</span>
              </button>
              <button 
                onClick={() => setActiveTab("expenses")}
                className={`flex flex-col items-center py-2 ${activeTab === "expenses" ? "text-primary" : "text-neutral-600"}`}
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-xs mt-1">Expenses</span>
              </button>
              <button 
                onClick={() => setActiveTab("flights")}
                className={`flex flex-col items-center py-2 ${activeTab === "flights" ? "text-primary" : "text-neutral-600"}`}
              >
                <Plane className="w-5 h-5" />
                <span className="text-xs mt-1">Flights</span>
              </button>
              <button 
                onClick={() => setActiveTab("hotels")}
                className={`flex flex-col items-center py-2 ${activeTab === "hotels" ? "text-primary" : "text-neutral-600"}`}
              >
                <Hotel className="w-5 h-5" />
                <span className="text-xs mt-1">Hotels</span>
              </button>
              <button 
                onClick={() => setActiveTab("proposals")}
                className={`flex flex-col items-center py-2 ${activeTab === "proposals" ? "text-primary" : "text-neutral-600"}`}
                data-testid="mobile-button-proposals"
              >
                <CheckCircle className="w-5 h-5" />
                <span className="text-xs mt-1">Proposals</span>
              </button>
              <button
                onClick={() => setActiveTab("wish-list")}
                className={`flex flex-col items-center py-2 ${activeTab === "wish-list" ? "text-primary" : "text-neutral-600"}`}
                data-testid="mobile-button-wish-list"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-xs mt-1">Wish List</span>
              </button>
              <button 
                onClick={() => setShowAddActivity(true)}
                className="flex flex-col items-center py-2 text-neutral-600"
              >
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mb-1">
                  <Plus className="text-white w-4 h-4" />
                </div>
                <span className="text-xs text-primary font-medium">Add</span>
              </button>
            </div>
          </div>
        </div>

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
      </div>

    </>
  );
}

// Flight Coordination Component
function FlightCoordination({ tripId, user }: { tripId: number; user: any }) {
  const [, setLocation] = useLocation();
  const { data: flights, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/flights`],
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Flight Coordination</h2>
          <p className="text-gray-600">Coordinate flights with your group</p>
        </div>
        <Button 
          onClick={() => {
            setLocation(`/trip/${tripId}/flights`);
          }}
          className="bg-primary hover:bg-red-600 text-white"
        >
          <Plane className="w-4 h-4 mr-2" />
          Manage Flights
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {(flights as any) && (flights as any).length > 0 ? (
            <div className="space-y-4">
              {(flights as any).slice(0, 3).map((flight: any) => (
                <div key={flight.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Plane className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold">{flight.flightNumber}</p>
                      <p className="text-sm text-gray-600">
                        {flight.departureCode} → {flight.arrivalCode}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(flight.departureTime), 'MMM dd, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{flight.status}</Badge>
                </div>
              ))}
              {(flights as any).length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{(flights as any).length - 3} more flights
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Plane className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No flights added yet</h3>
              <p className="text-gray-600 mb-4">
                Add and coordinate flights with your travel group
              </p>
              <Button 
                onClick={() => setLocation(`/trip/${tripId}/flights`)}
                className="bg-primary hover:bg-red-600 text-white"
              >
                <Plane className="w-4 h-4 mr-2" />
                Add Flight
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Hotel Booking Component
function HotelBooking({ tripId, user }: { tripId: number; user: any }) {
  const [, setLocation] = useLocation();
  const { data: hotels, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/hotels`],
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Hotel Booking</h2>
          <p className="text-gray-600">Find and book accommodations</p>
        </div>
        <Button 
          onClick={() => {
            setLocation(`/trip/${tripId}/hotels`);
          }}
          className="bg-primary hover:bg-red-600 text-white"
        >
          <Hotel className="w-4 h-4 mr-2" />
          Manage Hotels
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {(hotels as any) && (hotels as any).length > 0 ? (
            <div className="space-y-4">
              {(hotels as any).slice(0, 3).map((hotel: any) => (
                <div key={hotel.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Hotel className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold">{hotel.hotelName}</p>
                      <p className="text-sm text-gray-600">{hotel.address}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(hotel.checkInDate), 'MMM dd')} - {format(new Date(hotel.checkOutDate), 'MMM dd')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {hotel.totalPrice && (
                      <p className="font-semibold">${hotel.totalPrice}</p>
                    )}
                    {hotel.hotelRating && (
                      <div className="flex items-center">
                        {Array.from({ length: hotel.hotelRating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(hotels as any).length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{(hotels as any).length - 3} more hotels
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Hotel className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hotels added yet</h3>
              <p className="text-gray-600 mb-4">
                Search and book accommodations for your trip
              </p>
              <Button 
                onClick={() => setLocation(`/trip/${tripId}/hotels`)}
                className="bg-primary hover:bg-red-600 text-white"
              >
                <Hotel className="w-4 h-4 mr-2" />
                Search Hotels
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Restaurant Booking Component
function RestaurantBooking({ tripId, user }: { tripId: number; user: any }) {
  const [, setLocation] = useLocation();
  const { data: restaurants, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/restaurants`],
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Restaurant Reservations</h2>
          <p className="text-gray-600">Make dining reservations for your group</p>
        </div>
        <Button 
          onClick={() => {
            setLocation(`/trip/${tripId}/restaurants`);
          }}
          className="bg-primary hover:bg-red-600 text-white"
        >
          <Utensils className="w-4 h-4 mr-2" />
          Manage Restaurants
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {(restaurants as any) && (restaurants as any).length > 0 ? (
            <div className="space-y-4">
              {(restaurants as any).slice(0, 3).map((restaurant: any) => (
                <div key={restaurant.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Utensils className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-semibold">{restaurant.restaurantName}</p>
                      <p className="text-sm text-gray-600">{restaurant.address}</p>
                      {restaurant.reservationDate && (
                        <p className="text-sm text-gray-500">
                          {format(new Date(restaurant.reservationDate), 'MMM dd')} at {restaurant.reservationTime}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{restaurant.reservationStatus || 'pending'}</Badge>
                    {restaurant.partySize && (
                      <p className="text-sm text-gray-500 mt-1">{restaurant.partySize} people</p>
                    )}
                  </div>
                </div>
              ))}
              {(restaurants as any).length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  +{(restaurants as any).length - 3} more restaurants
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No restaurants added yet</h3>
              <p className="text-gray-600 mb-4">
                Find and make reservations at great restaurants
              </p>
              <Button 
                onClick={() => setLocation(`/trip/${tripId}/restaurants`)}
                className="bg-primary hover:bg-red-600 text-white"
              >
                <Utensils className="w-4 h-4 mr-2" />
                Find Restaurants
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

