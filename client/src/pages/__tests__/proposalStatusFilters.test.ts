import { filterActiveProposals } from "../proposalStatusFilters";

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
