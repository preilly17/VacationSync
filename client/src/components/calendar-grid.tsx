import { Card } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
import { parseDateValue } from "@/lib/utils";
import type { ActivityWithDetails, TripWithDetails } from "@shared/schema";

interface CalendarGridProps {
  currentMonth: Date;
  activities: ActivityWithDetails[];
  trip: TripWithDetails;
  selectedDate?: Date | null;
  onDayClick?: (date: Date) => void;
  onActivityClick?: (activity: ActivityWithDetails) => void;
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

export function CalendarGrid({ currentMonth, activities, trip, selectedDate, onDayClick, onActivityClick }: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const tripStart = parseDateValue(trip.startDate) ?? new Date(trip.startDate);
  const tripEnd = parseDateValue(trip.endDate) ?? new Date(trip.endDate);

  const getActivitiesForDay = (day: Date) => {
    return activities.filter(activity => 
      isSameDay(new Date(activity.startTime), day)
    );
  };

  const isTripDay = (day: Date) => {
    if (
      !tripStart ||
      !tripEnd ||
      Number.isNaN(tripStart.getTime()) ||
      Number.isNaN(tripEnd.getTime())
    ) {
      return false;
    }

    return isWithinInterval(day, {
      start: tripStart,
      end: tripEnd,
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
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => isTripActive && onDayClick?.(day)}
              className={`h-32 lg:h-40 p-2 relative ${
                isTripActive 
                  ? `bg-white cursor-pointer hover:bg-blue-50 transition-colors ${
                      isSelected 
                        ? "ring-2 ring-primary ring-inset" 
                        : dayActivities.length > 0 
                          ? "border-2 border-primary" 
                          : "border border-gray-200"
                    }`
                  : "bg-gray-50"
              }`}
            >
              <span className={`text-sm font-medium ${
                isTripActive ? "text-neutral-900" : "text-neutral-400"
              }`}>
                {format(day, 'd')}
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
                <div className="mt-1 space-y-1">
                  {dayActivities.slice(0, 3).map(activity => (
                    <div
                      key={activity.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onActivityClick?.(activity);
                      }}
                      className={`text-xs px-2 py-1 rounded-md font-medium shadow-sm border ${
                        categoryColors[activity.category as keyof typeof categoryColors] || categoryColors.other
                      } truncate cursor-pointer transition-colors hover:brightness-95`}
                    >
                      {categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.other}{" "}
                      {activity.name.length > 15 ? `${activity.name.substring(0, 12)}...` : activity.name}
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-medium">
                        <span>{activity.acceptedCount} going</span>
                        {activity.pendingCount > 0 && <span>• {activity.pendingCount} pending</span>}
                      </div>
                    </div>
                  ))}
                  {dayActivities.length > 3 && (
                    <div className="text-xs text-neutral-600 px-2">
                      +{dayActivities.length - 3} more
                    </div>
                  )}
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
