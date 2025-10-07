import type { ActivityCreateFormValues, ActivityValidationError } from "./activityCreation";

import {
  ACTIVITY_CATEGORY_MESSAGE,
  ATTENDEE_REQUIRED_MESSAGE,
  COST_NUMBER_MESSAGE,
  END_TIME_AFTER_START_MESSAGE,
  MAX_ACTIVITY_DESCRIPTION_LENGTH,
  MAX_ACTIVITY_LOCATION_LENGTH,
  MAX_CAPACITY_MESSAGE,
} from "@shared/activityValidation";

export const CLIENT_VALIDATION_FALLBACK_MESSAGE =
  "We couldn’t prepare your activity. Please review the details and try again.";

const clientValidationMessageMap: Array<{
  field: keyof ActivityCreateFormValues;
  messages: string[];
}> = [
  { field: "name", messages: ["Activity name is required."] },
  {
    field: "description",
    messages: [`Description must be ${MAX_ACTIVITY_DESCRIPTION_LENGTH} characters or fewer.`],
  },
  { field: "startDate", messages: ["Date is required.", "Date must be a valid date/time."] },
  {
    field: "startTime",
    messages: [
      "Start time is required so we can place this on the calendar.",
      "Start time must be in HH:MM format.",
      "Start time must be a valid date/time.",
    ],
  },
  {
    field: "endTime",
    messages: [
      "End time must be in HH:MM format.",
      "End time must be a valid date/time.",
      END_TIME_AFTER_START_MESSAGE,
    ],
  },
  {
    field: "location",
    messages: [`Location must be ${MAX_ACTIVITY_LOCATION_LENGTH} characters or fewer.`],
  },
  { field: "cost", messages: [COST_NUMBER_MESSAGE] },
  { field: "maxCapacity", messages: [MAX_CAPACITY_MESSAGE] },
  { field: "attendeeIds", messages: [ATTENDEE_REQUIRED_MESSAGE] },
  { field: "category", messages: [ACTIVITY_CATEGORY_MESSAGE] },
];

export const mapClientErrorToValidation = (error: unknown): ActivityValidationError => {
  if (!(error instanceof Error)) {
    return { fieldErrors: [], formMessage: CLIENT_VALIDATION_FALLBACK_MESSAGE };
  }

  const message = error.message?.trim();
  if (!message) {
    return { fieldErrors: [], formMessage: CLIENT_VALIDATION_FALLBACK_MESSAGE };
  }

  const matchedField = clientValidationMessageMap.find(({ messages }) => messages.includes(message));

  if (matchedField) {
    return {
      fieldErrors: [
        {
          field: matchedField.field,
          message,
        },
      ],
    } satisfies ActivityValidationError;
  }

  return {
    fieldErrors: [],
    formMessage: message,
  } satisfies ActivityValidationError;
};
