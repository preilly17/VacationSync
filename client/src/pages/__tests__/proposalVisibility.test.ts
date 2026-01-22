import { filterCategoryProposals, filterMyProposals } from "../proposalVisibility";

describe("proposal visibility filters", () => {
  const currentUserId = "user-123";
  const flightProposal = {
    id: 10,
    proposedBy: currentUserId,
    status: "OPEN",
  };
  const otherProposal = {
    id: 11,
    proposedBy: "user-999",
    status: "OPEN",
  };

  it("includes the current user's open proposal in category views by default", () => {
    const result = filterCategoryProposals([flightProposal, otherProposal], {
      userId: currentUserId,
      hideMine: false,
      statusFilter: "open",
    });

    expect(result.map((proposal) => proposal.id)).toEqual([10, 11]);
  });

  it("includes the current user's open proposal in My Proposals", () => {
    const result = filterMyProposals([flightProposal, otherProposal], {
      userId: currentUserId,
      statusFilter: "open",
    });

    expect(result.map((proposal) => proposal.id)).toEqual([10]);
  });

  it("moves closed proposals out of the open filter but into history and all", () => {
    const closedProposal = { ...flightProposal, status: "CLOSED" };

    const openResult = filterCategoryProposals([closedProposal], {
      userId: currentUserId,
      hideMine: false,
      statusFilter: "open",
    });
    const historyResult = filterCategoryProposals([closedProposal], {
      userId: currentUserId,
      hideMine: false,
      statusFilter: "history",
    });
    const allResult = filterCategoryProposals([closedProposal], {
      userId: currentUserId,
      hideMine: false,
      statusFilter: "all",
    });

    expect(openResult).toHaveLength(0);
    expect(historyResult.map((proposal) => proposal.id)).toEqual([10]);
    expect(allResult.map((proposal) => proposal.id)).toEqual([10]);
  });
});
