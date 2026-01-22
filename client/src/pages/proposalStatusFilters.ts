const OPEN_STATUSES = new Set(["open", "active", "proposed", "scheduled"]);
const CLOSED_STATUSES = new Set(["confirmed", "closed"]);
const CANCELED_STATUSES = new Set(["canceled", "cancelled", "void", "voided", "archived"]);

export type CategoryStatusFilter = "open" | "history" | "all";
export type MyProposalStatusFilter = "open" | "closed" | "cancelled" | "all";
export type ProposalStatusFilter = CategoryStatusFilter | MyProposalStatusFilter;

export const CATEGORY_STATUS_FILTER_OPTIONS: Array<{ value: CategoryStatusFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "history", label: "History" },
  { value: "all", label: "All" },
];

export const MY_PROPOSAL_STATUS_FILTER_OPTIONS: Array<{ value: MyProposalStatusFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed/Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export const normalizeProposalStatus = (status?: string | null): string =>
  (status ?? "active").toLowerCase();

export const isOpenStatus = (status?: string | null): boolean => {
  const normalized = normalizeProposalStatus(status);
  if (!normalized) {
    return true;
  }
  if (OPEN_STATUSES.has(normalized)) {
    return true;
  }
  if (CLOSED_STATUSES.has(normalized) || CANCELED_STATUSES.has(normalized)) {
    return false;
  }

  return true;
};

export const isCanceledStatus = (status?: string | null): boolean =>
  CANCELED_STATUSES.has(normalizeProposalStatus(status));

export const isInactiveStatus = (status?: string | null): boolean =>
  CLOSED_STATUSES.has(normalizeProposalStatus(status));

export const isClosedStatus = (status?: string | null): boolean =>
  CLOSED_STATUSES.has(normalizeProposalStatus(status));

export const filterActiveProposals = <T extends { status?: string | null }>(items: T[]): T[] =>
  items.filter((item) => isOpenStatus(item.status));

export const filterProposalsByStatus = <T extends { status?: string | null }>(
  items: T[],
  filter: ProposalStatusFilter,
): T[] => {
  switch (filter) {
    case "open":
      return items.filter((item) => isOpenStatus(item.status));
    case "closed":
      return items.filter((item) => isClosedStatus(item.status));
    case "cancelled":
      return items.filter((item) => isCanceledStatus(item.status));
    case "history":
      return items.filter((item) => !isOpenStatus(item.status));
    case "all":
    default:
      return items;
  }
};
