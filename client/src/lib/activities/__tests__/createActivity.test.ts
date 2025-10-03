import { ATTENDEE_REQUIRED_MESSAGE, END_TIME_AFTER_START_MESSAGE } from "@shared/activityValidation";

import { mapClientErrorToValidation } from "../clientValidation";

describe("mapClientErrorToValidation", () => {
  it("maps known validation messages to the correct field", () => {
    const attendeeError = mapClientErrorToValidation(new Error(ATTENDEE_REQUIRED_MESSAGE));
    expect(attendeeError.fieldErrors).toEqual([
      { field: "attendeeIds", message: ATTENDEE_REQUIRED_MESSAGE },
    ]);
    expect(attendeeError.formMessage).toBeUndefined();

    const endTimeError = mapClientErrorToValidation(new Error(END_TIME_AFTER_START_MESSAGE));
    expect(endTimeError.fieldErrors).toEqual([
      { field: "endTime", message: END_TIME_AFTER_START_MESSAGE },
    ]);
  });

  it("falls back to a form-level message for unknown errors", () => {
    const unexpectedError = mapClientErrorToValidation(new Error("Something odd"));
    expect(unexpectedError.fieldErrors).toEqual([]);
    expect(unexpectedError.formMessage).toBe("Something odd");
  });

  it("returns a helpful fallback message when the error is not an Error", () => {
    const fallback = mapClientErrorToValidation(null);
    expect(fallback.fieldErrors).toEqual([]);
    expect(fallback.formMessage).toMatch(/We couldn’t prepare your activity/);
  });
});
