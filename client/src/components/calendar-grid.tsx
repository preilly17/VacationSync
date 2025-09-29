import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
import type { ActivityWithDetails, TripWithDetails } from "@shared/schema";

interface CalendarGridProps {
  currentMonth: Date;
  activities: ActivityWithDetails[];
  trip: TripWithDetails;
  selectedDate?: Date | null;
  onDayClick?: (date: Date) => void;
  onActivityClick?: (activity: ActivityWithDetails) => void;
  currentUserId?: string;
  highlightPersonalProposals?: boolean;
}

const categoryColors = {
  // Travel essentials with distinct colors for quick scanning
  flights: "bg-sky-500 text-white border-sky-600", // Bright blue for flights
  hotels: "bg-emerald-500 text-white border-emerald-600", // Green for hotels
  transport: "bg-blue-500 text-white border-blue-600", // Blue for other transport
  
  // Food & dining
  food: "bg-orange-500 text-white border-orange-600", // Orange for food
  restaurants: "bg-red-500 text-white border-red-600", // Red for restaurants
  
  // Activities with warm colors
  activities: "bg-purple-500 text-white border-purple-600", // Purple for activities
  sightseeing: "bg-green-500 text-white border-green-600", // Green for sightseeing
  entertainment: "bg-pink-500 text-white border-pink-600", // Pink for entertainment
  outdoor: "bg-teal-500 text-white border-teal-600", // Teal for outdoor
  culture: "bg-yellow-500 text-black border-yellow-600", // Yellow for culture
  shopping: "bg-indigo-500 text-white border-indigo-600", // Indigo for shopping
  
  // Default
  other: "bg-gray-500 text-white border-gray-600",
};

const categoryIcons = {
  // Travel essentials
  flights: "✈️",
  hotels: "🏨", 
  transport: "🚊",
  
  // Food & dining
  food: "🍜",
  restaurants: "🍴",
  
  // Activities
  activities: "🎯",
  sightseeing: "🏯",
  entertainment: "🎤",
  outdoor: "🏔️",
  culture: "🎭",
  shopping: "🛍️",
  
  // Default
  other: "📍",
};

const MAX_VISIBLE_EVENTS = 3;

const formatBadgeTime = (dateInput: string | Date) => {
  const dateValue = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return format(dateValue, "h:mmaaa").toLowerCase().replace("m", "");
};

const formatActivityAriaLabel = (activity: ActivityWithDetails, day: Date) => {
  const start = new Date(activity.startTime);
  const timeLabel = format(start, "h:mm a");
  const dateLabel = format(day, "MMM d");
  return `${activity.name} at ${timeLabel} on ${dateLabel}`;
};

export function CalendarGrid({
  currentMonth,
  activities,
  trip,
  selectedDate,
  onDayClick,
  onActivityClick,
  currentUserId,
  highlightPersonalProposals,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getActivitiesForDay = (day: Date) => {
    return activities
      .filter(activity => isSameDay(new Date(activity.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const isTripDay = (day: Date) => {
    return isWithinInterval(day, {
      start: new Date(trip.startDate),
      end: new Date(trip.endDate)
    });
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get unique categories from current activities for the legend
  const activeCategories = Array.from(new Set(activities.map(a => a.category || 'other')));

  const legendItems = [
    { category: 'flights', name: 'Flights', icon: '✈️' },
    { category: 'hotels', name: 'Hotels', icon: '🏨' },
    { category: 'restaurants', name: 'Restaurants', icon: '🍴' },
    { category: 'activities', name: 'Activities', icon: '🎯' },
    { category: 'sightseeing', name: 'Sightseeing', icon: '🏯' },
    { category: 'entertainment', name: 'Entertainment', icon: '🎤' },
  ].filter(item => activeCategories.includes(item.category));

  return (
    <div className="space-y-4">
      {/* Color Legend - only show if there are activities */}
      {activities.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-neutral-900 mb-3">Activity Categories</h3>
          <div className="flex flex-wrap gap-2">
            {legendItems.map(({ category, name, icon }) => (
              <div key={category} className="flex items-center space-x-1">
                <div className={`text-xs px-2 py-1 rounded-md font-medium shadow-sm border ${
                  categoryColors[category as keyof typeof categoryColors] || categoryColors.other
                }`}>
                  {icon}
                </div>
                <span className="text-xs text-neutral-600">{name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Calendar */}
      <Card>
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
        {weekdays.map(day => (
          <div key={day} className="bg-white px-4 py-3 text-center">
            <span className="text-sm font-medium text-neutral-900">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
        {/* Empty cells for days before month start */}
        {Array.from({ length: monthStart.getDay() }, (_, i) => (
          <div key={`empty-${i}`} className="bg-gray-50 h-32 lg:h-40" />
        ))}
        
        {/* Days of the month */}
        {days.map(day => {
          const dayActivities = getActivitiesForDay(day);
          const isTripActive = isTripDay(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          
          const visibleActivities = dayActivities.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = Math.max(dayActivities.length - visibleActivities.length, 0);

          return (
            <div
              key={day.toISOString()}
              role={isTripActive ? "button" : undefined}
              tabIndex={isTripActive ? 0 : -1}
              onClick={() => isTripActive && onDayClick?.(day)}
              onKeyDown={event => {
                if (!isTripActive) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onDayClick?.(day);
                }
              }}
              aria-label={format(day, "MMMM d, yyyy")}
              className={`h-32 lg:h-40 p-2 relative flex flex-col ${
                isTripActive
                  ? `bg-white cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      isSelected
                        ? "ring-2 ring-primary ring-inset"
                        : dayActivities.length > 0
                          ? "border-2 border-primary"
                          : "border border-gray-200"
                    } hover:bg-blue-50`
                  : "bg-gray-50"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  isTripActive ? "text-neutral-900" : "text-neutral-400"
                }`}
              >
                {format(day, "d")}
              </span>

              {isSelected && (
                <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white"></div>
              )}

              {isTripActive && dayActivities.length === 0 && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 opacity-0 hover:opacity-100 transition-opacity">
                  Click to add
                </div>
              )}

              {dayActivities.length > 0 && (
                <div className="mt-1 flex-1 min-h-0 overflow-hidden">
                  <div className="flex h-full flex-col gap-1 overflow-hidden">
                    {visibleActivities.map(activity => {
                      const activityType = (activity.type ?? "SCHEDULED").toUpperCase();
                      const isProposal = activityType === "PROPOSE";
                      const isCreator = Boolean(
                        currentUserId
                          && (activity.postedBy === currentUserId || activity.poster?.id === currentUserId),
                      );
                      const showProposedChip = Boolean(highlightPersonalProposals && isProposal && isCreator);

                      return (
                      <Tooltip key={activity.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              onActivityClick?.(activity);
                            }}
                            className={`group flex w-full items-center gap-2 rounded-md border px-2 py-1 text-[12px] leading-5 font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                              categoryColors[activity.category as keyof typeof categoryColors] || categoryColors.other
                            }`}
                            aria-label={formatActivityAriaLabel(activity, day)}
                          >
                            <span className="shrink-0 text-sm">
                              {categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.other}
                            </span>
                            <span className="flex-1 truncate text-left">
                              {activity.name}
                            </span>
                            {showProposedChip && (
                              <span className="shrink-0 rounded-sm bg-white/80 px-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                Proposed
                              </span>
                            )}
                            <span className="shrink-0 rounded-sm bg-white/20 px-1 text-[10px] uppercase tracking-tight">
                              {formatBadgeTime(activity.startTime)}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs" side="top" align="start">
                          <div className="font-medium text-neutral-900">{activity.name}</div>
                          <div className="text-[11px] text-neutral-600">
                            {format(new Date(activity.startTime), "h:mm a")}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          onDayClick?.(day);
                        }}
                        className="mt-auto w-full truncate rounded-md border border-dashed border-neutral-300 bg-white/70 px-2 py-1 text-left text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                        aria-label={`${hiddenCount} more activities on ${format(day, "MMMM d")}`}
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </Card>
    </div>
  );
}
