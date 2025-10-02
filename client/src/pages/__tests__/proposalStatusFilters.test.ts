import { filterProposalsByStatus } from "../proposalStatusFilters";

describe("filterProposalsByStatus", () => {
  const proposals = [
    { id: 1, status: "canceled" },
    { id: 2, status: "active" },
    { id: 3, status: "scheduled" },
  ];

  it("includes canceled proposals when the canceled filter is active", () => {
    const result = filterProposalsByStatus(proposals, "canceled");

    expect(result.map((proposal) => proposal.id)).toEqual([1]);
  });

  it("excludes canceled proposals from the active filter results", () => {
    const result = filterProposalsByStatus(proposals, "active");

    expect(result.map((proposal) => proposal.id)).toEqual([2, 3]);
  });

  it("returns everything when using the all filter", () => {
    const result = filterProposalsByStatus(proposals, "all");

    expect(result.map((proposal) => proposal.id)).toEqual([1, 2, 3]);
  });
});
