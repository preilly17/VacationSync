import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, MapPin, DollarSign, Users, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import type { ActivityInviteStatus, ActivityWithDetails } from "@shared/schema";
import type { User } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ActivityDetailsDialogProps {
  activity: ActivityWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRespond: (status: ActivityInviteStatus) => void;
  isResponding?: boolean;
  currentUserId?: string;
}

const statusLabelMap: Record<ActivityInviteStatus, string> = {
  accepted: "Accepted",
  pending: "Pending",
  declined: "Declined",
  waitlisted: "Waitlisted",
};

const statusBadgeClasses: Record<ActivityInviteStatus, string> = {
  accepted: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  waitlisted: "bg-blue-100 text-blue-800 border-blue-200",
};

const getUserDisplayName = (user: User | undefined): string => {
  if (!user) {
    return "Trip member";
  }

  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first} ${last}`;
  }

  if (first) {
    return first;
  }

  if (user.username && user.username.trim()) {
    return user.username;
  }

  return user.email ?? "Trip member";
};

const formatDateTime = (value: ActivityWithDetails["startTime"]): string => {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "EEEE, MMM d · h:mm a");
};

const formatEndTime = (value: ActivityWithDetails["endTime"] | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "h:mm a");
};

export function ActivityDetailsDialog({
  activity,
  open,
  onOpenChange,
  onRespond,
  isResponding = false,
  currentUserId,
}: ActivityDetailsDialogProps) {
  const invites = activity?.invites ?? [];
  const currentInvite = invites.find((invite) => invite.userId === currentUserId);
  const derivedStatus: ActivityInviteStatus | null = currentInvite?.status
    ?? (activity?.isAccepted ? "accepted" : null);
  const waitlistedCount = activity
    ? activity.waitlistedCount
        ?? invites.filter((invite) => invite.status === "waitlisted").length
    : 0;
  const isCreator = Boolean(
    activity
      && currentUserId
      && (currentUserId === activity.postedBy || currentUserId === activity.poster.id),
  );
  const now = new Date();
  const isPastActivity = (() => {
    if (!activity) {
      return false;
    }
    const end = activity.endTime ? new Date(activity.endTime) : null;
    const start = new Date(activity.startTime);
    const comparisonTarget = end && !Number.isNaN(end.getTime()) ? end : start;
    if (Number.isNaN(comparisonTarget.getTime())) {
      return false;
    }
    return comparisonTarget.getTime() < now.getTime();
  })();
  const rsvpCloseDate = activity?.rsvpCloseTime ? new Date(activity.rsvpCloseTime) : null;
  const isRsvpClosed = Boolean(
    rsvpCloseDate && !Number.isNaN(rsvpCloseDate.getTime()) && rsvpCloseDate < now,
  );
  const activityType = activity?.type ?? "SCHEDULED";
  const isProposal = activityType === "PROPOSE";
  const capacityFull = Boolean(
    !isProposal && activity?.maxCapacity != null
      && activity.acceptedCount >= activity.maxCapacity,
  );

  const handleRespond = (status: ActivityInviteStatus) => {
    if (!activity || derivedStatus === status) {
      return;
    }
    onRespond(status);
  };

  const statusForDisplay: ActivityInviteStatus | null = currentInvite
    ? derivedStatus ?? "pending"
    : null;

  const renderActionButtons = () => {
    if (!activity || isCreator || !currentInvite) {
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
        <>
          <Button
            size="sm"
            onClick={() => handleRespond("accepted")}
            disabled={isResponding}
            aria-label="Accept invitation"
          >
            {acceptLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRespond("declined")}
            disabled={isResponding}
            aria-label="Decline invitation"
          >
            {declineLabel}
          </Button>
        </>
      );
    }

    if (statusForDisplay === "accepted") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="border-neutral-300"
              disabled={isResponding}
            >
              Change RSVP
              <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={() => handleRespond("declined")}
              disabled={isResponding}
            >
              Decline
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (statusForDisplay === "waitlisted") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRespond("pending")}
          disabled={isResponding}
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
        onClick={() => handleRespond("declined")}
        disabled={isResponding}
        aria-label="Decline invitation"
      >
        {declineLabel}
      </Button>
    );

    if (capacityFull) {
      return (
        <>
          <Button
            size="sm"
            onClick={() => handleRespond("waitlisted")}
            disabled={isResponding}
            aria-label="Join waitlist"
          >
            Join waitlist
          </Button>
          {declineButton}
        </>
      );
    }

    return (
      <>
        <Button
          size="sm"
          onClick={() => handleRespond("accepted")}
          disabled={isResponding}
          aria-label="Accept invitation"
        >
          {acceptLabel}
        </Button>
        {declineButton}
      </>
    );
  };

  const endTimeLabel = activity ? formatEndTime(activity.endTime) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="text-xl font-semibold text-neutral-900">
              {activity?.name ?? "Activity"}
            </DialogTitle>
            {isProposal && (
              <Badge className="bg-blue-100 text-blue-800 border border-blue-200">
                Proposed plan
              </Badge>
            )}
          </div>
          <DialogDescription className="text-sm text-neutral-600">
            {isProposal
              ? "Gauge interest from the group before scheduling this activity."
              : "Review the details and let everyone know if you’re joining."}
          </DialogDescription>
        </DialogHeader>

        {activity && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className={cn(
                  "flex items-start space-x-3 rounded-lg border bg-neutral-50 p-4",
                  isProposal && "border-blue-200 bg-blue-50",
                )}
              >
                <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">When</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {formatDateTime(activity.startTime)}
                  </p>
                  {endTimeLabel && (
                    <p className="text-xs text-neutral-500">Ends at {endTimeLabel}</p>
                  )}
                  {isProposal && (
                    <p className="text-xs text-blue-700">
                      Timing can change once the group confirms.
                    </p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start space-x-3 rounded-lg border bg-neutral-50 p-4",
                  isProposal && "border-blue-200 bg-blue-50",
                )}
              >
                <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {isProposal ? "Interest" : "RSVP summary"}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {activity.acceptedCount} {isProposal ? "interested" : "going"}
                    {activity.pendingCount > 0
                      && ` • ${activity.pendingCount} ${isProposal ? "considering" : "pending"}`}
                    {activity.declinedCount > 0
                      && ` • ${activity.declinedCount} ${isProposal ? "not interested" : "declined"}`}
                    {waitlistedCount > 0 && ` • ${waitlistedCount} waitlist`}
                  </p>
                </div>
              </div>

              {activity.location && (
                <div className="flex items-start space-x-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Where</p>
                    <p className="text-sm font-medium text-neutral-900">{activity.location}</p>
                  </div>
                </div>
              )}

              {typeof activity.cost === "number" && (
                <div className="flex items-start space-x-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Cost per person</p>
                    <p className="text-sm font-medium text-neutral-900">
                      ${activity.cost.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {activity.description && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Details</p>
                <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{activity.description}</p>
              </div>
            )}

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-neutral-900">Your response</p>
                  {isCreator ? (
                    <p className="text-xs text-neutral-500">You created this activity.</p>
                  ) : statusForDisplay ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`border ${statusBadgeClasses[statusForDisplay]}`}
                      >
                        {statusLabelMap[statusForDisplay]}
                      </Badge>
                      <span className="text-xs text-neutral-500">
                        {statusForDisplay === "pending"
                          ? "No response yet."
                          : `Marked as ${statusLabelMap[statusForDisplay]}.`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Ask the activity organizer to add you to the invite list if you want to join.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">{renderActionButtons()}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">Invite list</p>
                <p className="text-xs text-neutral-500">{invites.length} people invited</p>
              </div>
              <Separator className="my-3" />
              <div className="space-y-2">
                {invites.map((invite) => {
                  const name = getUserDisplayName(invite.user);
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={invite.user.profileImageUrl ?? undefined} alt={name} />
                          <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{name}</p>
                          <p className="text-xs text-neutral-500">
                            {invite.user.id === activity.postedBy ? 'Organizer' : 'Invitee'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('border', statusBadgeClasses[invite.status])}
                      >
                        {statusLabelMap[invite.status]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
