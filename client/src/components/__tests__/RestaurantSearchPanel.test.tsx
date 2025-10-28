/**
 * @jest-environment jsdom
 */

import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RestaurantSearchPanel } from "../restaurant-search-panel";
import { TooltipProvider } from "@/components/ui/tooltip";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(async () => ({
    ok: true,
    json: async () => [],
  })),
}));

jest.mock("@/components/SmartLocationSearch", () => {
  const MockLocationSearch = ({ onLocationSelect }: { onLocationSelect: (location: any) => void }) => {
    const mockLocation = {
      name: "Atlanta",
      cityName: "Atlanta",
      displayName: "Atlanta, GA",
      state: "GA",
      latitude: 33.749,
      longitude: -84.388,
    };

    return (
      <button type="button" onClick={() => onLocationSelect(mockLocation)} data-testid="mock-select-location">
        Choose Atlanta
      </button>
    );
  };

  return {
    __esModule: true,
    default: MockLocationSearch,
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (global as any).ResizeObserver = ResizeObserverMock;
});

describe("RestaurantSearchPanel", () => {
  const originalWindowOpen = window.open;

  const renderWithClient = (ui: ReactElement) => {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <TooltipProvider>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    window.open = jest.fn();
  });

  afterEach(() => {
    (window.open as jest.Mock).mockClear();
  });

  afterAll(() => {
    window.open = originalWindowOpen;
  });

  it("disables the OpenTable search when time is missing", () => {
    renderWithClient(<RestaurantSearchPanel initialSearchTime="" />);

    const openTableButton = screen.getByTestId("button-search-open-table") as HTMLButtonElement;
    const resyButton = screen.getByTestId("button-search-resy") as HTMLButtonElement;

    expect(openTableButton.disabled).toBe(true);
    expect(resyButton.disabled).toBe(false);
  });

  it("opens a Resy link using the current form state", async () => {
    const user = userEvent.setup();
    const onExternalSearch = jest.fn();

    renderWithClient(
      <RestaurantSearchPanel
        initialSearchDate={new Date("2025-10-28T12:00:00Z")}
        initialPartySize={2}
        initialSearchTime="7:00 PM"
        onExternalSearch={onExternalSearch}
      />,
    );

    await user.click(screen.getByTestId("mock-select-location"));
    await user.click(screen.getByTestId("button-search-resy"));

    expect(window.open).toHaveBeenCalledWith(
      "https://resy.com/cities/atlanta-ga/search?date=2025-10-28&seats=2",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onExternalSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "resy",
        city: "Atlanta",
        date: "2025-10-28",
        partySize: 2,
        url: "https://resy.com/cities/atlanta-ga/search?date=2025-10-28&seats=2",
      }),
    );
  });

  it("builds an OpenTable link with coordinates and opens the manual add flow", async () => {
    const user = userEvent.setup();
    const onExternalSearch = jest.fn();

    renderWithClient(
      <RestaurantSearchPanel
        initialSearchDate={new Date("2025-10-28T12:00:00Z")}
        initialSearchTime="7:00 PM"
        initialPartySize={4}
        onExternalSearch={onExternalSearch}
      />,
    );

    await user.click(screen.getByTestId("mock-select-location"));
    await user.click(screen.getByTestId("button-search-open-table"));

    expect(window.open).toHaveBeenCalledWith(
      "https://www.opentable.com/s?dateTime=2025-10-28T19%3A00%3A00&covers=4&searchedLocationName=Atlanta&shouldUseLatLongSearch=true&latitude=33.749&longitude=-84.388",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onExternalSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "open_table",
        city: "Atlanta",
        date: "2025-10-28",
        time: "19:00",
        partySize: 4,
      }),
    );
  });
});
