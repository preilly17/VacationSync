import { filterActiveProposals, filterProposalsByStatus } from "../proposalStatusFilters";

describe("filterProposalsByStatus", () => {
  const proposals = [
    { id: 1, status: "canceled" },
    { id: 2, status: "void" },
    { id: 3, status: "active" },
    { id: 4, status: "scheduled" },
  ];

  it("includes canceled proposals when the canceled filter is active", () => {
    const result = filterProposalsByStatus(proposals, "canceled");

    expect(result.map((proposal) => proposal.id)).toEqual([1, 2]);
  });

  it("excludes canceled proposals from the active filter results", () => {
    const result = filterProposalsByStatus(proposals, "active");

    expect(result.map((proposal) => proposal.id)).toEqual([3, 4]);
  });

  it("treats the all filter as active proposals", () => {
    const result = filterProposalsByStatus(proposals, "all");

    expect(result.map((proposal) => proposal.id)).toEqual([3, 4]);
  });

  it("returns only active proposals when filtering for active proposals directly", () => {
    const result = filterActiveProposals(proposals);

    expect(result.map((proposal) => proposal.id)).toEqual([3, 4]);
  });
});
