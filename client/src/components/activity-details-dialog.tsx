import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, DollarSign, Users } from "lucide-react";
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
};

const statusBadgeClasses: Record<ActivityInviteStatus, string> = {
  accepted: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  declined: "bg-red-100 text-red-800 border-red-200",
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
  const currentStatus = currentInvite?.status;

  const handleRespond = (status: ActivityInviteStatus) => {
    if (!activity || currentStatus === status) {
      return;
    }
    onRespond(status);
  };

  const endTimeLabel = activity ? formatEndTime(activity.endTime) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-neutral-900">
            {activity?.name ?? "Activity"}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-600">
            Review the details and let everyone know if you’re joining.
          </DialogDescription>
        </DialogHeader>

        {activity && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start space-x-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">When</p>
                  <p className="text-sm font-medium text-neutral-900">{formatDateTime(activity.startTime)}</p>
                  {endTimeLabel && (
                    <p className="text-xs text-neutral-500">Ends at {endTimeLabel}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">RSVP summary</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {activity.acceptedCount} going
                    {activity.pendingCount > 0 && ` • ${activity.pendingCount} pending`}
                    {activity.declinedCount > 0 && ` • ${activity.declinedCount} declined`}
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
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Your response</p>
                  <p className="text-xs text-neutral-500">
                    {currentStatus ? `Currently marked as ${statusLabelMap[currentStatus]}.` : 'You are not on the invite list for this activity.'}
                  </p>
                </div>
                {currentStatus && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={currentStatus === 'accepted' ? 'default' : 'outline'}
                      size="sm"
                      disabled={isResponding}
                      onClick={() => handleRespond('accepted')}
                    >
                      Going
                    </Button>
                    <Button
                      variant={currentStatus === 'pending' ? 'default' : 'outline'}
                      size="sm"
                      disabled={isResponding}
                      onClick={() => handleRespond('pending')}
                    >
                      Decide later
                    </Button>
                    <Button
                      variant={currentStatus === 'declined' ? 'default' : 'outline'}
                      size="sm"
                      disabled={isResponding}
                      onClick={() => handleRespond('declined')}
                    >
                      Can't make it
                    </Button>
                  </div>
                )}
              </div>
              {!currentStatus && (
                <p className="mt-2 text-sm text-neutral-600">
                  Ask the activity organizer to add you to the invite list if you want to join.
                </p>
              )}
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
