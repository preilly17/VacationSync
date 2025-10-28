/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RestaurantLinkBuilderModal } from "../RestaurantLinkBuilderModal";

describe("RestaurantLinkBuilderModal", () => {
  const originalWindowOpen = window.open;

  beforeEach(() => {
    window.open = jest.fn();
  });

  afterEach(() => {
    (window.open as jest.Mock).mockRestore?.();
    window.open = originalWindowOpen;
  });

  it("opens a Resy link with defaults", async () => {
    const user = userEvent.setup();
    const onLinkOpened = jest.fn();

    render(
      <RestaurantLinkBuilderModal
        open
        onOpenChange={() => {}}
        defaultCity="Atlanta"
        stateCode="GA"
        startDate="2025-10-28"
        endDate="2025-10-30"
        defaultPartySize={2}
        onLinkOpened={onLinkOpened}
      />,
    );

    await screen.findByText(/Build a restaurant link/i);
    const openButton = screen.getByRole("button", { name: /open link/i }) as HTMLButtonElement;
    await waitFor(() => expect(openButton.disabled).toBe(false));

    await user.click(openButton);

    expect(window.open).toHaveBeenCalledWith(
      "https://resy.com/cities/atlanta-ga/search?date=2025-10-28&seats=2",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onLinkOpened).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "resy",
        url: "https://resy.com/cities/atlanta-ga/search?date=2025-10-28&seats=2",
        date: "2025-10-28",
        partySize: 2,
      }),
    );
  });

  it("requires a time for OpenTable and includes coordinates", async () => {
    const user = userEvent.setup();
    const onLinkOpened = jest.fn();

    render(
      <RestaurantLinkBuilderModal
        open
        onOpenChange={() => {}}
        defaultCity="Atlanta"
        startDate="2025-10-28"
        endDate="2025-10-30"
        defaultPartySize={2}
        defaultLatitude={33.874320594174755}
        defaultLongitude={-84.35580064660194}
        onLinkOpened={onLinkOpened}
      />,
    );

    await screen.findByText(/Build a restaurant link/i);
    const openTableToggle = screen.getByRole("radio", { name: /OpenTable/i });
    await user.click(openTableToggle);

    const openButton = screen.getByRole("button", { name: /open link/i }) as HTMLButtonElement;
    expect(openButton.disabled).toBe(true);

    const timeInput = screen.getByLabelText(/Time/i) as HTMLInputElement;
    await user.clear(timeInput);
    await user.type(timeInput, "19:00");

    expect(openButton.disabled).toBe(false);
    await user.click(openButton);

    expect(window.open).toHaveBeenCalledWith(
      "https://www.opentable.com/s?dateTime=2025-10-28T19%3A00%3A00&covers=2&searchedLocationName=Atlanta&shouldUseLatLongSearch=true&latitude=33.874320594174755&longitude=-84.35580064660194",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onLinkOpened).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "open_table",
        time: "19:00",
        latitude: 33.874320594174755,
        longitude: -84.35580064660194,
      }),
    );
  });
});
