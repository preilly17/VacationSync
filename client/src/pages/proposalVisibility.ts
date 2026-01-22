import type { ProposalPermissions } from "@shared/schema";
import {
  filterProposalsByStatus,
  type CategoryStatusFilter,
  type MyProposalStatusFilter,
} from "./proposalStatusFilters";

type ProposalOwnership = {
  proposedBy?: string | null;
  proposer?: { id?: string | null } | null;
  permissions?: ProposalPermissions | null;
};

const normalizeUserId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

export const isProposalOwnedByUser = (
  proposal: ProposalOwnership,
  userId?: string | null,
): boolean => {
  if (proposal.permissions?.canCancel) {
    return true;
  }

  const viewerId = normalizeUserId(userId);
  if (!viewerId) {
    return false;
  }

  const proposedById = normalizeUserId(proposal.proposedBy);
  const proposerFallbackId = normalizeUserId(proposal.proposer?.id);
  const proposerId = proposedById ?? proposerFallbackId ?? null;

  return proposerId !== null && proposerId === viewerId;
};

export const filterCategoryProposals = <T extends ProposalOwnership & { status?: string | null }>(
  proposals: T[],
  options: {
    userId?: string | null;
    hideMine?: boolean;
    statusFilter: CategoryStatusFilter;
  },
): T[] => {
  const visible = options.hideMine
    ? proposals.filter((proposal) => !isProposalOwnedByUser(proposal, options.userId))
    : proposals;

  return filterProposalsByStatus(visible, options.statusFilter);
};

export const filterMyProposals = <T extends ProposalOwnership & { status?: string | null }>(
  proposals: T[],
  options: {
    userId?: string | null;
    statusFilter: MyProposalStatusFilter;
  },
): T[] =>
  filterProposalsByStatus(
    proposals.filter((proposal) => isProposalOwnedByUser(proposal, options.userId)),
    options.statusFilter,
  );
