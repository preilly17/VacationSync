/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

const okJson = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    headers: { get: () => "application/json" },
  });

type FlightProposal = {
  id: number;
  airline: string;
};

const FlightProposalsLoader = ({ tripId }: { tripId: number }) => {
  const { data } = useQuery<FlightProposal[]>({
    queryKey: [`/api/trips/${tripId}/proposals?type=flight&status=OPEN`],
  });

  const proposals = Array.isArray(data) ? data : [];

  return (
    <div>
      {proposals.map((proposal) => (
        <div key={proposal.id} data-testid="flight-proposal">
          {proposal.airline}
        </div>
      ))}
    </div>
  );
};

describe("flight proposals fetch", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn((input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url === "/api/trips/123/proposals?type=flight&status=OPEN") {
        return okJson([{ id: 1, airline: "Test Air" }]);
      }

      return okJson([]);
    });
  });

  it("loads flight proposals with the correct URL and auth credentials", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          queryFn: async ({ queryKey }) => {
            const res = await fetch(queryKey.join("/") as string, { credentials: "include" });
            return res.json();
          },
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FlightProposalsLoader tripId={123} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("flight-proposal")).toBeTruthy();
    });

    const fetchMock = global.fetch as jest.Mock;
    const flightCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/trips/123/proposals?type=flight&status=OPEN"),
    );

    expect(flightCall).toBeDefined();
    expect(flightCall?.[1]?.credentials).toBe("include");
  });
});
