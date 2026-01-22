import { filterActiveProposals, filterProposalsByStatus } from "../proposalStatusFilters";

describe("filterActiveProposals", () => {
  const proposals = [
    { id: 1, status: "canceled" },
    { id: 2, status: "void" },
    { id: 3, status: "active" },
    { id: 4, status: "scheduled" },
  ];

  it("returns only active proposals", () => {
    const result = filterActiveProposals(proposals);

    expect(result.map((proposal) => proposal.id)).toEqual([3, 4]);
  });

  it("treats unknown statuses as active", () => {
    const result = filterActiveProposals([
      ...proposals,
      { id: 5, status: "in_review" },
      { id: 6, status: null },
    ]);

    expect(result.map((proposal) => proposal.id)).toEqual([3, 4, 5, 6]);
  });
});

describe("filterProposalsByStatus", () => {
  const proposals = [
    { id: 1, status: "OPEN" },
    { id: 2, status: "closed" },
    { id: 3, status: "confirmed" },
    { id: 4, status: "cancelled" },
    { id: 5, status: null },
  ];

  it("filters open proposals", () => {
    const result = filterProposalsByStatus(proposals, "open");

    expect(result.map((proposal) => proposal.id)).toEqual([1, 5]);
  });

  it("filters closed proposals", () => {
    const result = filterProposalsByStatus(proposals, "closed");

    expect(result.map((proposal) => proposal.id)).toEqual([2, 3]);
  });

  it("filters cancelled proposals", () => {
    const result = filterProposalsByStatus(proposals, "cancelled");

    expect(result.map((proposal) => proposal.id)).toEqual([4]);
  });

  it("filters history proposals", () => {
    const result = filterProposalsByStatus(proposals, "history");

    expect(result.map((proposal) => proposal.id)).toEqual([2, 3, 4]);
  });

  it("returns all proposals", () => {
    const result = filterProposalsByStatus(proposals, "all");

    expect(result.map((proposal) => proposal.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
