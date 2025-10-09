import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, DollarSign, Clock } from "lucide-react";
import { format } from "date-fns";
import type { ActivityWithDetails, ActivityInviteStatus, User } from "@shared/schema";
import { cn, formatCurrency } from "@/lib/utils";

interface ActivityCardProps {
  activity: ActivityWithDetails;
  currentUser?: User;
  onAccept: () => void;
  onDecline: () => void;
  onMaybe?: () => void;
  isLoading?: boolean;
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

const getUserDisplayName = (user: User) => {
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

export function ActivityCard({
  activity,
  currentUser,
  onAccept,
  onDecline,
  onMaybe,
  isLoading = false,
}: ActivityCardProps) {
  const formatDateTime = (dateTime: ActivityWithDetails["startTime"]) => {
    if (!dateTime) {
      return "Time TBD";
    }

    const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
    if (Number.isNaN(date.getTime())) {
      return "Time TBD";
    }

    return format(date, "MMM d, yyyy 'at' h:mm a");
  };

  const formatTimeRange = (
    startTime: ActivityWithDetails["startTime"],
    endTime?: ActivityWithDetails["endTime"],
  ) => {
    if (!startTime) {
      return "Time TBD";
    }

    const startDate = startTime instanceof Date ? startTime : new Date(startTime);

    if (Number.isNaN(startDate.getTime())) {
      return "Time TBD";
    }

    const startLabel = format(startDate, "h:mm a");

    if (!endTime) {
      return startLabel;
    }

    const endDate = endTime instanceof Date ? endTime : new Date(endTime);

    if (Number.isNaN(endDate.getTime())) {
      return startLabel;
    }

    return format(startDate, "MMM d") === format(endDate, "MMM d")
      ? `${startLabel} - ${format(endDate, "h:mm a")}`
      : `${startLabel} - ${format(endDate, "MMM d, h:mm a")}`;
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

  const acceptedInvites = activity.invites.filter((invite) => invite.status === "accepted");
  const pendingInvites = activity.invites.filter((invite) => invite.status === "pending");
  const declinedInvites = activity.invites.filter((invite) => invite.status === "declined");

  const currentInvite =
    activity.currentUserInvite ??
    activity.invites.find((invite) => invite.userId === currentUser?.id) ??
    null;

  const currentStatus: ActivityInviteStatus | undefined = currentInvite?.status
    ?? (activity.isAccepted ? "accepted" : undefined);

  const isCreator = Boolean(
    currentUser?.id &&
      (currentUser.id === activity.poster.id || currentUser.id === activity.postedBy),
  );

  const renderParticipants = (
    participants: typeof acceptedInvites,
    emptyLabel?: string,
  ) => {
    if (participants.length === 0) {
      return emptyLabel ? (
        <p className="text-xs text-neutral-500 italic">{emptyLabel}</p>
      ) : null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {participants.map((invite) => (
          <Badge
            key={`${invite.activityId}-${invite.userId}-${invite.status}`}
            variant="outline"
            className="border-neutral-200 bg-white text-neutral-700"
          >
            {getUserDisplayName(invite.user)}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Card className="shadow-sm border border-neutral-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${
                getCategoryColor(activity.category)
              }`}
            >
              {getCategoryIcon(activity.category)}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-neutral-900 truncate">
                  {activity.name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Avatar className="w-5 h-5">
                    <AvatarImage
                      src={activity.poster.profileImageUrl || undefined}
                      alt={activity.poster.firstName || "User"}
                    />
                    <AvatarFallback className="text-xs">
                      {(activity.poster.firstName?.[0] || activity.poster.email?.[0] || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    Posted by {activity.poster.firstName || activity.poster.email || "User"}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="bg-neutral-100 text-neutral-700">
                {activity.category.charAt(0).toUpperCase() + activity.category.slice(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm text-neutral-600 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{formatDateTime(activity.startTime)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{formatTimeRange(activity.startTime, activity.endTime ?? undefined)}</span>
              </div>
              {activity.location && (
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{activity.location}</span>
                </div>
              )}
              {typeof activity.cost === "number" && (
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{formatCurrency(activity.cost)} / person</span>
                </div>
              )}
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{getSpotsLeftText()}</span>
              </div>
            </div>

            {activity.description && (
              <p className="text-sm text-neutral-600 whitespace-pre-line">
                {activity.description}
              </p>
            )}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {acceptedInvites.slice(0, 3).map((invite) => (
                    <Avatar key={`${invite.activityId}-${invite.userId}`} className="w-7 h-7 border-2 border-white">
                      <AvatarImage
                        src={invite.user.profileImageUrl || undefined}
                        alt={invite.user.firstName || "User"}
                      />
                      <AvatarFallback className="text-xs">
                        {(invite.user.firstName?.[0] || invite.user.email?.[0] || "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {activity.acceptedCount > 3 && (
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-neutral-600">
                        +{activity.acceptedCount - 3}
                      </span>
                    </div>
                  )}
                </div>
                <Badge className="bg-primary/10 text-primary" variant="secondary">
                  {activity.acceptedCount} going
                  {activity.pendingCount > 0 && ` • ${activity.pendingCount} pending`}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {isCreator ? (
                  <Badge
                    variant="secondary"
                    className="bg-neutral-100 text-neutral-700 border border-neutral-200"
                    data-testid="badge-created-by-you"
                  >
                    You created this
                  </Badge>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDecline}
                      disabled={isLoading}
                      className={cn(
                        "border-neutral-300",
                        currentStatus === "declined" &&
                          "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200",
                      )}
                    >
                      Decline
                    </Button>
                    {onMaybe && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onMaybe}
                        disabled={isLoading || !onMaybe}
                        className={cn(
                          "border-neutral-300",
                          currentStatus === "pending" &&
                            "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
                        )}
                      >
                        Maybe
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAccept}
                      disabled={isLoading}
                      className={cn(
                        "border-neutral-300",
                        currentStatus === "accepted" &&
                          "bg-primary text-white border-primary hover:bg-primary/90",
                      )}
                    >
                      Accept
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Going
                </p>
                {renderParticipants(acceptedInvites, "No one has accepted yet.")}
              </div>
              {pendingInvites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Awaiting response
                  </p>
                  <p className="text-xs text-neutral-600">
                    {pendingInvites.map((invite) => getUserDisplayName(invite.user)).join(", ")}
                  </p>
                </div>
              )}
              {declinedInvites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Not going
                  </p>
                  <p className="text-xs text-neutral-500">
                    {declinedInvites.map((invite) => getUserDisplayName(invite.user)).join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
