const CANCELED_STATUSES = new Set(["canceled", "cancelled", "void", "voided", "archived"]);
const INACTIVE_STATUSES = new Set(["confirmed", "closed"]);

export const normalizeProposalStatus = (status?: string | null): string =>
  (status ?? "active").toLowerCase();

export const isCanceledStatus = (status?: string | null): boolean =>
  CANCELED_STATUSES.has(normalizeProposalStatus(status));

export const isInactiveStatus = (status?: string | null): boolean =>
  INACTIVE_STATUSES.has(normalizeProposalStatus(status));

export const filterActiveProposals = <T extends { status?: string | null }>(items: T[]): T[] =>
  items.filter((item) => !isCanceledStatus(item.status) && !isInactiveStatus(item.status));
