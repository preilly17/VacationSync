import type { ActivityInviteStatus, ActivityWithDetails, User } from "@shared/schema";

type UpdateOptions = {
  nextStatus: ActivityInviteStatus;
  user?: User | null;
  targetUserId?: string | null;
};

const cloneInvites = (
  invites: ActivityWithDetails["invites"],
): ActivityWithDetails["invites"] => invites.map((invite) => ({ ...invite }));

const normaliseTargetUserId = (
  candidate: string | null | undefined,
  fallbackInvite?: ActivityWithDetails["currentUserInvite"],
  fallbackUser?: User | null,
): string | null => {
  if (candidate && candidate.trim().length > 0) {
    return candidate;
  }

  const inviteUserId = fallbackInvite?.userId;
  if (inviteUserId && inviteUserId.trim().length > 0) {
    return inviteUserId.trim();
  }

  const fallbackUserId = fallbackUser?.id;
  if (fallbackUserId && fallbackUserId.trim().length > 0) {
    return fallbackUserId.trim();
  }

  return null;
};

const cloneInviteWithStatus = (
  invite: ActivityWithDetails["invites"][number],
  nextStatus: ActivityInviteStatus,
  nowIso: string,
  user?: User | null,
) => ({
  ...invite,
  status: nextStatus,
  respondedAt: nextStatus === "pending" ? null : nowIso,
  updatedAt: nowIso,
  user: invite.user ?? user ?? invite.user,
});

const buildAcceptanceList = (
  invites: ActivityWithDetails["invites"],
): ActivityWithDetails["acceptances"] => invites
  .filter((invite) => invite.status === "accepted")
  .map((invite, index) => ({
    id: invite.id ?? index,
    activityId: invite.activityId,
    userId: invite.userId,
    acceptedAt: invite.respondedAt,
    user: invite.user,
  }));

const recomputeInviteCounts = (
  invites: ActivityWithDetails["invites"],
) => invites.reduce(
  (acc, invite) => {
    if (invite.status === "accepted") {
      acc.accepted += 1;
    } else if (invite.status === "declined") {
      acc.declined += 1;
    } else if (invite.status === "waitlisted") {
      acc.waitlisted += 1;
    } else {
      acc.pending += 1;
    }
    return acc;
  },
  { accepted: 0, declined: 0, pending: 0, waitlisted: 0 },
);

export const updateActivityInviteStatus = (
  activity: ActivityWithDetails,
  { nextStatus, user, targetUserId }: UpdateOptions,
): ActivityWithDetails => {
  const nowIso = new Date().toISOString();
  const invites = activity.invites ? cloneInvites(activity.invites) : [];

  const resolvedTargetUserId = normaliseTargetUserId(
    targetUserId,
    activity.currentUserInvite,
    user ?? activity.currentUserInvite?.user ?? null,
  );

  if (!resolvedTargetUserId) {
    return activity;
  }

  const inviteIndex = invites.findIndex((invite) => invite.userId === resolvedTargetUserId);
  let updatedInvite: ActivityWithDetails["invites"][number] | null = null;

  if (inviteIndex >= 0) {
    updatedInvite = cloneInviteWithStatus(invites[inviteIndex], nextStatus, nowIso, user ?? null);
    invites[inviteIndex] = updatedInvite;
  } else if (user && user.id === resolvedTargetUserId) {
    updatedInvite = {
      id: -Math.abs(Date.now()),
      activityId: activity.id,
      userId: resolvedTargetUserId,
      status: nextStatus,
      respondedAt: nextStatus === "pending" ? null : nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      user,
    } as ActivityWithDetails["invites"][number];
    invites.push(updatedInvite);
  }

  if (!updatedInvite) {
    return activity;
  }

  const counts = recomputeInviteCounts(invites);
  const acceptances = buildAcceptanceList(invites);

  return {
    ...activity,
    invites,
    acceptances,
    currentUserInvite: updatedInvite,
    acceptedCount: counts.accepted,
    pendingCount: counts.pending,
    declinedCount: counts.declined,
    waitlistedCount: counts.waitlisted,
    isAccepted: nextStatus === "accepted" ? true : undefined,
    hasResponded: nextStatus === "pending" ? undefined : true,
  } satisfies ActivityWithDetails;
};

export type { UpdateOptions as UpdateActivityInviteOptions };

