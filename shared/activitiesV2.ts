// TODO(activities-unification): Remove this parallel schema once activity types are consolidated
// into the canonical shared/schema.ts definitions.
import { z } from "zod";

import {
  ACTIVITY_CATEGORY_MESSAGE,
  ACTIVITY_CATEGORY_VALUES,
  ATTENDEE_REQUIRED_MESSAGE,
} from "./activityValidation";

import type { User } from "./schema";

export type ActivityStatus = "proposed" | "scheduled" | "cancelled";
export type ActivityVisibility = "trip" | "private";
export type ActivityInviteeRole = "participant" | "viewer";
export type ActivityVoteValue = "up" | "down";
export type ActivityRsvpResponse = "yes" | "no" | "maybe" | "pending";

export const activityStatusSchema = z.enum(["proposed", "scheduled", "cancelled"]);
export const activityVisibilitySchema = z.enum(["trip", "private"]);
export const activityInviteeRoleSchema = z.enum(["participant", "viewer"]);
export const activityVoteValueSchema = z.enum(["up", "down"]);
export const activityRsvpResponseSchema = z.enum(["yes", "no", "maybe", "pending"]);

export interface Activity {
  id: string;
  tripId: string;
  creatorId: string;
  title: string;
  description: string | null;
  category: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string | null;
  timezone: string;
  location: string | null;
  costPerPerson: number | null;
  maxParticipants: number | null;
  status: ActivityStatus;
  visibility: ActivityVisibility;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ActivityInvitee {
  activityId: string;
  userId: string;
  role: ActivityInviteeRole;
  createdAt: string;
  updatedAt: string;
  user?: User | null;
}

export interface ActivityVote {
  activityId: string;
  userId: string;
  value: ActivityVoteValue;
  createdAt: string;
  user?: User | null;
}

export interface ActivityRsvp {
  activityId: string;
  userId: string;
  response: ActivityRsvpResponse;
  respondedAt: string | null;
  user?: User | null;
}

export interface ActivityWithDetails extends Activity {
  invitees: ActivityInvitee[];
  votes: ActivityVote[];
  rsvps: ActivityRsvp[];
  creator: User | null;
  currentUserVote?: ActivityVote | null;
  currentUserRsvp?: ActivityRsvp | null;
}

const START_TIME_REQUIRED_MESSAGE = "Start time is required so we can place this on the calendar.";

export const createActivityRequestSchema = z
  .object({
    mode: z.enum(["proposed", "scheduled"]),
    title: z.string().min(1).max(120),
    description: z.string().max(5000).optional().nullable(),
    category: z
      .string({
        required_error: ACTIVITY_CATEGORY_MESSAGE,
        invalid_type_error: ACTIVITY_CATEGORY_MESSAGE,
      })
      .transform((value) => value.trim().toLowerCase())
      .refine((value) => value.length > 0, { message: ACTIVITY_CATEGORY_MESSAGE })
      .refine(
        (value) => ACTIVITY_CATEGORY_VALUES.includes(value as (typeof ACTIVITY_CATEGORY_VALUES)[number]),
        { message: ACTIVITY_CATEGORY_MESSAGE },
      ),
    date: z.string().min(1),
    start_time: z.string().optional().nullable(),
    end_time: z.string().optional().nullable(),
    timezone: z.string().min(1),
    location: z.string().max(500).optional().nullable(),
    cost_per_person: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((value) => {
        if (value === null || value === undefined || value === "") {
          return null;
        }
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }),
    max_participants: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((value) => {
        if (value === null || value === undefined || value === "") {
          return null;
        }
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
      }),
    invitee_ids: z
      .array(z.string().min(1), {
        required_error: ATTENDEE_REQUIRED_MESSAGE,
        invalid_type_error: ATTENDEE_REQUIRED_MESSAGE,
      })
      .nonempty({ message: ATTENDEE_REQUIRED_MESSAGE }),
    idempotency_key: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const normalizedStartTime =
      typeof data.start_time === "string" ? data.start_time.trim() : data.start_time;
    const mode = data.mode === "scheduled" ? "scheduled" : "proposed";

    if (mode === "scheduled" && (!normalizedStartTime || normalizedStartTime.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_time"],
        message: START_TIME_REQUIRED_MESSAGE,
      });
    }
  });

export type CreateActivityRequest = z.infer<typeof createActivityRequestSchema>;

export type CreateActivityResponse = ActivityWithDetails & {
  initialVoteOrRsvpState: Record<string, ActivityVoteValue | ActivityRsvpResponse | null>;
  wasDeduplicated?: boolean;
};
