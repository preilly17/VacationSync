import type { TripMember, User } from "@shared/schema";

export const getMemberDisplayName = (member?: User | null) => {
  if (!member) return "Trip member";
  const first = member.firstName?.trim();
  const last = member.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (member.username) return member.username;
  return member.email || "Trip member";
};

export type ManualMemberOption = { id: string; name: string };

export const buildManualMemberOptions = (
  members: (TripMember & { user: User })[],
  currentUser: User | null,
  currentUserId?: string,
): ManualMemberOption[] => {
  const uniqueOptions = new Map<string, ManualMemberOption>();

  for (const member of members) {
    const id = String(member.userId);
    if (!id) {
      continue;
    }

    if (!uniqueOptions.has(id)) {
      uniqueOptions.set(id, {
        id,
        name: getMemberDisplayName(member.user),
      });
    }
  }

  const normalizedCurrentUserId = (currentUserId ?? "").trim();
  const options = Array.from(uniqueOptions.values());

  if (normalizedCurrentUserId && !uniqueOptions.has(normalizedCurrentUserId)) {
    const baseName = currentUser ? getMemberDisplayName(currentUser) : "You";
    const label = baseName === "Trip member" || baseName === "You" ? "You" : `${baseName} (You)`;

    return [
      {
        id: normalizedCurrentUserId,
        name: label,
      },
      ...options,
    ];
  }

  if (normalizedCurrentUserId && uniqueOptions.has(normalizedCurrentUserId)) {
    const existing = uniqueOptions.get(normalizedCurrentUserId);
    if (existing) {
      const baseName = currentUser ? getMemberDisplayName(currentUser) : existing.name;
      const label = baseName === "Trip member" || baseName === "You" ? "You" : `${baseName} (You)`;
      return [
        { id: existing.id, name: label },
        ...options.filter((option) => option.id !== existing.id),
      ];
    }
  }

  return options;
};

