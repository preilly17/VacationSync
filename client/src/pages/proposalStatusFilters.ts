export type StatusFilter = "all" | "active" | "canceled";

const CANCELED_STATUSES = new Set(["canceled", "cancelled", "void", "voided", "archived"]);

export const normalizeProposalStatus = (status?: string | null): string =>
  (status ?? "active").toLowerCase();

export const isCanceledStatus = (status?: string | null): boolean =>
  CANCELED_STATUSES.has(normalizeProposalStatus(status));

export const filterActiveProposals = <T extends { status?: string | null }>(items: T[]): T[] =>
  items.filter((item) => !isCanceledStatus(item.status));

export const filterProposalsByStatus = <T extends { status?: string | null }>(
  items: T[],
  statusFilter: StatusFilter,
): T[] => {
  if (statusFilter === "canceled") {
    return items.filter((item) => isCanceledStatus(item.status));
  }

  return filterActiveProposals(items);
};
