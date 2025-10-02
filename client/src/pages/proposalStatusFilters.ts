export type StatusFilter = "all" | "active" | "canceled";

export const normalizeProposalStatus = (status?: string | null): string =>
  (status ?? "active").toLowerCase();

export const filterProposalsByStatus = <T extends { status?: string | null }>(
  items: T[],
  statusFilter: StatusFilter,
): T[] => {
  if (statusFilter === "all") {
    return items;
  }

  return items.filter((item) => {
    const normalizedStatus = normalizeProposalStatus(item.status);

    if (statusFilter === "canceled") {
      return normalizedStatus === "canceled" || normalizedStatus === "cancelled";
    }

    return normalizedStatus !== "canceled" && normalizedStatus !== "cancelled";
  });
};
