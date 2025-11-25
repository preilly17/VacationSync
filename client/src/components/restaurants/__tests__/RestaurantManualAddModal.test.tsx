/**
 * @jest-environment jsdom
 */

import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RestaurantManualAddModal } from "../RestaurantManualAddModal";
import type { RestaurantManualAddPrefill } from "@/types/restaurants";
import { addRestaurant } from "@/lib/restaurants";

jest.mock("@/lib/restaurants", () => ({
  addRestaurant: jest.fn(),
}));

describe("RestaurantManualAddModal", () => {
  const renderWithClient = (ui: ReactElement) => {
    const client = new QueryClient();
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  };

  beforeEach(() => {
    (addRestaurant as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("submits minimal restaurant data", async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    const onSuccess = jest.fn();
    const prefill: RestaurantManualAddPrefill = {
      platform: "open_table",
      url: "https://www.opentable.com/s?dateTime=2025-10-28T19:00:00",
      date: "2025-10-28",
      time: "19:00",
      partySize: 4,
      city: "Atlanta",
      country: "USA",
    };

    renderWithClient(
      <RestaurantManualAddModal
        tripId={7}
        open
        onOpenChange={onOpenChange}
        prefill={prefill}
        onSuccess={onSuccess}
      />,
    );

    await user.type(screen.getByLabelText(/Restaurant name/i), "Staplehouse");
    await user.type(screen.getByLabelText(/Address/i), "541 Edgewood Ave");

    const saveButton = screen.getByRole("button", { name: /save restaurant/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    await user.click(saveButton);

    await waitFor(() => expect(addRestaurant).toHaveBeenCalledTimes(1));
    expect(addRestaurant).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        name: "Staplehouse",
        address: "541 Edgewood Ave",
        city: "Atlanta",
        country: "USA",
        reservationDate: "2025-10-28",
        reservationTime: "19:00",
        partySize: 4,
        openTableUrl: "https://www.opentable.com/s?dateTime=2025-10-28T19:00:00",
        priceRange: "$$",
        reservationStatus: "pending",
      }),
    );

    expect(onSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables submission while trip context is unavailable", async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    const prefill: RestaurantManualAddPrefill = {
      platform: "open_table",
      url: "https://www.opentable.com/s?dateTime=2025-10-28T19:00:00",
      date: "2025-10-28",
      time: "19:00",
      partySize: 4,
      city: "Atlanta",
      country: "USA",
    };

    renderWithClient(
      <RestaurantManualAddModal
        tripId={0}
        open
        onOpenChange={onOpenChange}
        prefill={prefill}
      />,
    );

    await user.type(screen.getByLabelText(/Restaurant name/i), "Staplehouse");
    await user.type(screen.getByLabelText(/Address/i), "541 Edgewood Ave");

    const saveButton = screen.getByRole("button", { name: /save restaurant/i }) as HTMLButtonElement;

    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });

    expect(addRestaurant).not.toHaveBeenCalled();
  });
});
