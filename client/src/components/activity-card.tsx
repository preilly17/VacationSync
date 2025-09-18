import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, DollarSign, Check, X } from "lucide-react";
import { format } from "date-fns";
import type { ActivityWithDetails, User } from "@shared/schema";

interface ActivityCardProps {
  activity: ActivityWithDetails;
  currentUser?: User;
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
  isScheduleView?: boolean;
}

const categoryColors = {
  food: "bg-red-100 text-red-800",
  sightseeing: "bg-green-100 text-green-800",
  transport: "bg-blue-100 text-blue-800",
  entertainment: "bg-purple-100 text-purple-800",
  shopping: "bg-pink-100 text-pink-800",
  culture: "bg-yellow-100 text-yellow-800",
  outdoor: "bg-indigo-100 text-indigo-800",
  other: "bg-gray-100 text-gray-800",
};

const categoryIcons = {
  food: "🍜",
  sightseeing: "🏯",
  transport: "🚊",
  entertainment: "🎤",
  shopping: "🛍️",
  culture: "🎭",
  outdoor: "🏔️",
  other: "📍",
};

export function ActivityCard({
  activity,
  currentUser,
  onAccept,
  onDecline,
  isLoading = false,
  isScheduleView = false,
}: ActivityCardProps) {
  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return format(date, "MMM d, yyyy 'at' h:mm a");
  };

  const getCategoryIcon = (category: string) => {
    return categoryIcons[category as keyof typeof categoryIcons] || categoryIcons.other;
  };

  const getCategoryColor = (category: string) => {
    return categoryColors[category as keyof typeof categoryColors] || categoryColors.other;
  };

  const getSpotsLeftText = () => {
    if (!activity.maxCapacity) return "No limit";
    const spotsLeft = activity.maxCapacity - activity.acceptedCount;
    return spotsLeft > 0 ? `${spotsLeft} spots left` : "Full";
  };

  return (
    <div className="p-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${
            getCategoryColor(activity.category).replace('text-', 'text-').replace('bg-', 'bg-')
          }`}>
            {getCategoryIcon(activity.category)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-neutral-900 truncate">
                {activity.name}
              </h3>
              <div className="flex items-center mt-1">
                <Avatar className="w-5 h-5 mr-2">
                  <AvatarImage 
                    src={activity.poster.profileImageUrl || undefined} 
                    alt={activity.poster.firstName || 'User'} 
                  />
                  <AvatarFallback className="text-xs">
                    {(activity.poster.firstName?.[0] || activity.poster.email?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-neutral-600">
                  Posted by {activity.poster.firstName || activity.poster.email || 'User'}
                </span>
              </div>
            </div>
            <Badge 
              variant="secondary"
              className={getCategoryColor(activity.category)}
            >
              {activity.category.charAt(0).toUpperCase() + activity.category.slice(1)}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-neutral-600 mb-3">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">{formatDateTime(activity.startTime)}</span>
            </div>
            {activity.location && (
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{activity.location}</span>
              </div>
            )}
            {activity.cost && (
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{activity.cost}/person</span>
              </div>
            )}
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{getSpotsLeftText()}</span>
            </div>
          </div>
          
          {activity.description && (
            <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
              {activity.description}
            </p>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {activity.acceptances.slice(0, 3).map((acceptance) => (
                    <Avatar key={acceptance.id} className="w-6 h-6 border-2 border-white">
                      <AvatarImage 
                        src={acceptance.user.profileImageUrl || undefined} 
                        alt={acceptance.user.firstName || 'User'} 
                      />
                      <AvatarFallback className="text-xs">
                        {(acceptance.user.firstName?.[0] || acceptance.user.email?.[0] || 'U').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {activity.acceptedCount > 3 && (
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        +{activity.acceptedCount - 3}
                      </span>
                    </div>
                  )}
                </div>
                <span className="ml-3 text-sm text-neutral-600">
                  {activity.acceptedCount} going{activity.isAccepted ? " (including you)" : ""}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {activity.isAccepted ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDecline}
                    disabled={isLoading}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    {isScheduleView ? "Remove" : "Leave"}
                  </Button>
                  <Button
                    size="sm"
                    disabled
                    className="bg-secondary text-white"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accepted
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDecline}
                    disabled={isLoading}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={onAccept}
                    disabled={isLoading}
                    className="bg-primary hover:bg-red-600 text-white"
                  >
                    Accept
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
