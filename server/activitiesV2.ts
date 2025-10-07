import { randomUUID } from "crypto";

import { pool, query } from "./db";
import type { TripWithDetails } from "@shared/schema";
import {
  createActivityRequestSchema,
  type ActivityInvitee,
  type ActivityRsvp,
  type ActivityRsvpResponse,
  type ActivityVote,
  type ActivityVoteValue,
  type ActivityWithDetails,
  type CreateActivityRequest,
  type CreateActivityResponse,
} from "@shared/activitiesV2";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const shouldEnsureTables = process.env.NODE_ENV !== "test";

const ensureActivitiesTablePromise = shouldEnsureTables
  ? (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS activities_v2 (
        id UUID PRIMARY KEY,
        trip_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NULL,
        category TEXT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NULL,
        timezone TEXT NOT NULL,
        location TEXT NULL,
        cost_per_person NUMERIC NULL,
        max_participants INTEGER NULL,
        status TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'trip',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        version INTEGER NOT NULL DEFAULT 1,
        idempotency_key TEXT NOT NULL,
        UNIQUE (trip_id, idempotency_key)
    )
  `);

    await query(`
      CREATE TABLE IF NOT EXISTS activity_invitees_v2 (
        activity_id UUID NOT NULL REFERENCES activities_v2(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'participant',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (activity_id, user_id)
    )
  `);

    await query(`
      CREATE TABLE IF NOT EXISTS activity_votes_v2 (
        activity_id UUID NOT NULL REFERENCES activities_v2(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (activity_id, user_id)
    )
  `);

    await query(`
      CREATE TABLE IF NOT EXISTS activity_rsvps_v2 (
        activity_id UUID NOT NULL REFERENCES activities_v2(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        response TEXT NOT NULL,
        responded_at TIMESTAMPTZ NULL,
        PRIMARY KEY (activity_id, user_id)
      )
    `);
  })()
  : Promise.resolve();

const toTimeValue = (value: string): number => {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error("Invalid time format");
  }
  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  return hours * 60 + minutes;
};

const toIsoDate = (value: unknown): string => {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
};

const toIsoDateTime = (value: unknown): string => {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const str = String(value);
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const normalizeTime = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  const str = String(value ?? "");
  if (str.includes(":")) {
    return str.slice(0, 5);
  }
  return "00:00";
};

const normalizeUserProvidedTime = (value: string): string => {
  const trimmed = value.trim();
  if (TIME_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const basicMatch = /^([0-2]?\d)(?::([0-5]?\d))?$/.exec(trimmed);
  if (!basicMatch) {
    return trimmed;
  }

  const hours = Number.parseInt(basicMatch[1] ?? "0", 10);
  const minutes = Number.parseInt(basicMatch[2] ?? "0", 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return trimmed;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return trimmed;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const mapActivityRow = (row: Record<string, unknown>): ActivityWithDetails => {
  const base: ActivityWithDetails = {
    id: String(row.id),
    tripId: String(row.trip_id),
    creatorId: String(row.creator_id),
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    date: toIsoDate(row.date),
    startTime: normalizeTime(row.start_time),
    endTime: row.end_time === null ? null : normalizeTime(row.end_time),
    timezone: row.timezone as string,
    location: (row.location as string | null) ?? null,
    costPerPerson: row.cost_per_person === null ? null : Number(row.cost_per_person),
    maxParticipants: row.max_participants === null ? null : Number(row.max_participants),
    status: row.status as ActivityWithDetails["status"],
    visibility: (row.visibility as string) === "private" ? "private" : "trip",
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    version: Number(row.version ?? 1),
    invitees: [],
    votes: [],
    rsvps: [],
    creator: row.creator_id
      ? {
          id: String(row.creator_id),
          email: (row.creator_email as string | null) ?? "",
          username: (row.creator_username as string | null) ?? null,
          firstName: (row.creator_first_name as string | null) ?? null,
          lastName: (row.creator_last_name as string | null) ?? null,
          phoneNumber: (row.creator_phone_number as string | null) ?? null,
          passwordHash: null,
          profileImageUrl: (row.creator_profile_image_url as string | null) ?? null,
          cashAppUsername: null,
          cashAppUsernameLegacy: null,
          cashAppPhone: null,
          cashAppPhoneLegacy: null,
          venmoUsername: null,
          venmoPhone: null,
          timezone: (row.creator_timezone as string | null) ?? null,
          defaultLocation: null,
          defaultLocationCode: null,
          defaultCity: null,
          defaultCountry: null,
          authProvider: null,
          notificationPreferences: null,
          hasSeenHomeOnboarding: false,
          hasSeenTripOnboarding: false,
          createdAt: null,
          updatedAt: null,
        }
      : null,
  };

  return base;
};

const attachRelations = (
  base: ActivityWithDetails,
  inviteeRows: any[],
  voteRows: any[],
  rsvpRows: any[],
): ActivityWithDetails => {
  const invitees: ActivityInvitee[] = inviteeRows.map((row) => ({
    activityId: String(row.activity_id),
    userId: String(row.user_id),
    role: (row.role as string) === "viewer" ? "viewer" : "participant",
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    user: row.user_id
      ? {
          id: String(row.user_id),
          email: (row.user_email as string | null) ?? "",
          username: (row.user_username as string | null) ?? null,
          firstName: (row.user_first_name as string | null) ?? null,
          lastName: (row.user_last_name as string | null) ?? null,
          phoneNumber: (row.user_phone_number as string | null) ?? null,
          passwordHash: null,
          profileImageUrl: (row.user_profile_image_url as string | null) ?? null,
          cashAppUsername: null,
          cashAppUsernameLegacy: null,
          cashAppPhone: null,
          cashAppPhoneLegacy: null,
          venmoUsername: null,
          venmoPhone: null,
          timezone: (row.user_timezone as string | null) ?? null,
          defaultLocation: null,
          defaultLocationCode: null,
          defaultCity: null,
          defaultCountry: null,
          authProvider: null,
          notificationPreferences: null,
          hasSeenHomeOnboarding: false,
          hasSeenTripOnboarding: false,
          createdAt: null,
          updatedAt: null,
        }
      : null,
  }));

  const votes: ActivityVote[] = voteRows.map((row) => ({
    activityId: String(row.activity_id),
    userId: String(row.user_id),
    value: (row.value as string) === "down" ? "down" : "up",
    createdAt: (row.created_at as Date).toISOString(),
    user: row.user_id
      ? {
          id: String(row.user_id),
          email: (row.vote_user_email as string | null) ?? "",
          username: (row.vote_user_username as string | null) ?? null,
          firstName: (row.vote_user_first_name as string | null) ?? null,
          lastName: (row.vote_user_last_name as string | null) ?? null,
          phoneNumber: (row.vote_user_phone_number as string | null) ?? null,
          passwordHash: null,
          profileImageUrl: (row.vote_user_profile_image_url as string | null) ?? null,
          cashAppUsername: null,
          cashAppUsernameLegacy: null,
          cashAppPhone: null,
          cashAppPhoneLegacy: null,
          venmoUsername: null,
          venmoPhone: null,
          timezone: (row.vote_user_timezone as string | null) ?? null,
          defaultLocation: null,
          defaultLocationCode: null,
          defaultCity: null,
          defaultCountry: null,
          authProvider: null,
          notificationPreferences: null,
          hasSeenHomeOnboarding: false,
          hasSeenTripOnboarding: false,
          createdAt: null,
          updatedAt: null,
        }
      : null,
  }));

  const rsvps: ActivityRsvp[] = rsvpRows.map((row) => ({
    activityId: String(row.activity_id),
    userId: String(row.user_id),
    response: (row.response as string) === "no"
      ? "no"
      : (row.response as string) === "maybe"
        ? "maybe"
        : (row.response as string) === "yes"
          ? "yes"
          : "pending",
    respondedAt: row.responded_at ? (row.responded_at as Date).toISOString() : null,
    user: row.user_id
      ? {
          id: String(row.user_id),
          email: (row.rsvp_user_email as string | null) ?? "",
          username: (row.rsvp_user_username as string | null) ?? null,
          firstName: (row.rsvp_user_first_name as string | null) ?? null,
          lastName: (row.rsvp_user_last_name as string | null) ?? null,
          phoneNumber: (row.rsvp_user_phone_number as string | null) ?? null,
          passwordHash: null,
          profileImageUrl: (row.rsvp_user_profile_image_url as string | null) ?? null,
          cashAppUsername: null,
          cashAppUsernameLegacy: null,
          cashAppPhone: null,
          cashAppPhoneLegacy: null,
          venmoUsername: null,
          venmoPhone: null,
          timezone: (row.rsvp_user_timezone as string | null) ?? null,
          defaultLocation: null,
          defaultLocationCode: null,
          defaultCity: null,
          defaultCountry: null,
          authProvider: null,
          notificationPreferences: null,
          hasSeenHomeOnboarding: false,
          hasSeenTripOnboarding: false,
          createdAt: null,
          updatedAt: null,
        }
      : null,
  }));

  return {
    ...base,
    invitees,
    votes,
    rsvps,
  };
};

const fetchActivityWithRelations = async (activityId: string): Promise<ActivityWithDetails | null> => {
  const { rows } = await query(
    `
    SELECT a.*, u.email AS creator_email, u.username AS creator_username, u.first_name AS creator_first_name,
           u.last_name AS creator_last_name, u.phone_number AS creator_phone_number, u.profile_image_url AS creator_profile_image_url,
           u.timezone AS creator_timezone
    FROM activities_v2 a
    LEFT JOIN users u ON u.id = a.creator_id
    WHERE a.id = $1
    LIMIT 1
  `,
    [activityId],
  );

  const baseRow = rows[0];
  if (!baseRow) {
    return null;
  }

  const [invitees, votes, rsvps] = await Promise.all([
    query(
      `
      SELECT ai.*, u.email AS user_email, u.username AS user_username, u.first_name AS user_first_name,
             u.last_name AS user_last_name, u.phone_number AS user_phone_number, u.profile_image_url AS user_profile_image_url,
             u.timezone AS user_timezone
      FROM activity_invitees_v2 ai
      LEFT JOIN users u ON u.id = ai.user_id
      WHERE ai.activity_id = $1
    `,
      [activityId],
    ),
    query(
      `
      SELECT av.*, u.email AS vote_user_email, u.username AS vote_user_username, u.first_name AS vote_user_first_name,
             u.last_name AS vote_user_last_name, u.phone_number AS vote_user_phone_number, u.profile_image_url AS vote_user_profile_image_url,
             u.timezone AS vote_user_timezone
      FROM activity_votes_v2 av
      LEFT JOIN users u ON u.id = av.user_id
      WHERE av.activity_id = $1
    `,
      [activityId],
    ),
    query(
      `
      SELECT ar.*, u.email AS rsvp_user_email, u.username AS rsvp_user_username, u.first_name AS rsvp_user_first_name,
             u.last_name AS rsvp_user_last_name, u.phone_number AS rsvp_user_phone_number, u.profile_image_url AS rsvp_user_profile_image_url,
             u.timezone AS rsvp_user_timezone
      FROM activity_rsvps_v2 ar
      LEFT JOIN users u ON u.id = ar.user_id
      WHERE ar.activity_id = $1
    `,
      [activityId],
    ),
  ]);

  const base = mapActivityRow(baseRow as Record<string, unknown>);
  return attachRelations(base, invitees.rows, votes.rows, rsvps.rows);
};

const buildInitialState = (
  activity: ActivityWithDetails,
): Record<string, ActivityVoteValue | ActivityRsvpResponse | null> => {
  const state: Record<string, ActivityVoteValue | ActivityRsvpResponse | null> = {};

  if (activity.status === "scheduled") {
    activity.rsvps.forEach((rsvp) => {
      state[rsvp.userId] = rsvp.response;
    });
    return state;
  }

  activity.invitees.forEach((invitee) => {
    const vote = activity.votes.find((v) => v.userId === invitee.userId);
    state[invitee.userId] = vote ? vote.value : null;
  });

  return state;
};

export interface CreateActivityParams {
  trip: TripWithDetails;
  creatorId: string;
  body: CreateActivityRequest;
}

export async function createActivityV2({
  trip,
  creatorId,
  body,
}: CreateActivityParams): Promise<CreateActivityResponse> {
  await ensureActivitiesTablePromise;

  const sanitizedBody: CreateActivityRequest = {
    ...body,
    start_time: body.start_time.trim(),
    end_time: typeof body.end_time === "string" ? body.end_time.trim() : body.end_time,
    idempotency_key:
      typeof body.idempotency_key === "string" && body.idempotency_key.trim().length > 0
        ? body.idempotency_key.trim()
        : randomUUID(),
  };

  const validation = createActivityRequestSchema.safeParse(sanitizedBody);
  if (!validation.success) {
    const friendlyErrors = validation.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    const error = new Error("validation_failed");
    (error as any).code = "VALIDATION";
    (error as any).details = friendlyErrors;
    throw error;
  }

  const data = validation.data;
  const startTime = normalizeUserProvidedTime(data.start_time);
  const rawEndTime = typeof data.end_time === "string" ? data.end_time : data.end_time;
  const normalizedEndTime =
    rawEndTime && rawEndTime.length > 0 ? normalizeUserProvidedTime(rawEndTime) : null;

  if (!TIME_PATTERN.test(startTime)) {
    const error = new Error("invalid_time");
    (error as any).code = "VALIDATION";
    (error as any).details = [{ field: "start_time", message: "Start time must be in HH:MM format." }];
    throw error;
  }

  if (normalizedEndTime) {
    if (!TIME_PATTERN.test(normalizedEndTime)) {
      const error = new Error("invalid_time");
      (error as any).code = "VALIDATION";
      (error as any).details = [{ field: "end_time", message: "End time must be in HH:MM format." }];
      throw error;
    }

    if (toTimeValue(normalizedEndTime) <= toTimeValue(startTime)) {
      const error = new Error("invalid_time_order");
      (error as any).code = "VALIDATION";
      (error as any).details = [{ field: "end_time", message: "End time must be after the start time." }];
      throw error;
    }
  }

  const inviteeSet = new Set(
    (data.invitee_ids ?? []).map((id) => String(id).trim()).filter((id) => id.length > 0),
  );

  const tripMemberIds = new Set(
    trip.members.map((member) => String(member.userId)).filter((id) => id.trim().length > 0),
  );

  const invalidInvitees = Array.from(inviteeSet).filter((id) => !tripMemberIds.has(id));
  if (invalidInvitees.length > 0) {
    const error = new Error("invalid_invitees");
    (error as any).code = "VALIDATION";
    (error as any).details = [
      {
        field: "invitee_ids",
        message: "All invitees must be members of this trip.",
      },
    ];
    throw error;
  }

  const creatorIdValue = String(creatorId).trim();
  if (creatorIdValue.length === 0) {
    const error = new Error("invalid_creator");
    (error as any).code = "VALIDATION";
    (error as any).details = [
      {
        field: "creator_id",
        message: "A valid activity creator is required.",
      },
    ];
    throw error;
  }

  inviteeSet.add(creatorIdValue);

  const participants = Array.from(inviteeSet);

  if (data.max_participants !== null && data.max_participants !== undefined) {
    if (Number(data.max_participants) < participants.length) {
      const error = new Error("max_participants_too_low");
      (error as any).code = "VALIDATION";
      (error as any).details = [
        {
          field: "max_participants",
          message: "Max participants cannot be less than the number of invitees.",
        },
      ];
      throw error;
    }
  }

  const status = data.mode === "proposed" ? "proposed" : "scheduled";
  const tripIdValue = String(trip.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      `SELECT id FROM activities_v2 WHERE trip_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [tripIdValue, data.idempotency_key],
    );

    if (existingRows.length > 0) {
      await client.query("COMMIT");
      const existing = await fetchActivityWithRelations(String(existingRows[0]?.id));
      if (!existing) {
        throw new Error("idempotent_activity_missing");
      }
      return {
        ...existing,
        initialVoteOrRsvpState: buildInitialState(existing),
        wasDeduplicated: true,
      };
    }

    const insertedId = randomUUID();
    await client.query(
      `
      INSERT INTO activities_v2 (
        id, trip_id, creator_id, title, description, category, date, start_time, end_time, timezone,
        location, cost_per_person, max_participants, status, visibility, idempotency_key
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, 'trip', $15
      )
    `,
      [
        insertedId,
        tripIdValue,
        creatorIdValue,
        data.title,
        data.description ?? null,
        data.category ?? null,
        data.date,
        startTime,
        normalizedEndTime,
        data.timezone,
        data.location ?? null,
        data.cost_per_person ?? null,
        data.max_participants ?? null,
        status,
        data.idempotency_key,
      ],
    );

    for (const inviteeId of participants) {
      await client.query(
        `
        INSERT INTO activity_invitees_v2 (activity_id, user_id, role)
        VALUES ($1, $2, 'participant')
        ON CONFLICT (activity_id, user_id) DO UPDATE
          SET role = EXCLUDED.role,
              updated_at = NOW()
      `,
        [insertedId, inviteeId],
      );
    }

    if (status === "scheduled") {
      for (const inviteeId of participants) {
        const response = inviteeId === creatorIdValue ? "yes" : "pending";
        await client.query(
          `
          INSERT INTO activity_rsvps_v2 (activity_id, user_id, response, responded_at)
          VALUES ($1, $2, $3, CASE WHEN $3 = 'yes' THEN NOW() ELSE NULL END)
          ON CONFLICT (activity_id, user_id) DO UPDATE
            SET response = EXCLUDED.response,
                responded_at = CASE
                  WHEN EXCLUDED.response = 'yes' THEN NOW()
                  WHEN EXCLUDED.response IN ('no', 'maybe') THEN NOW()
                  ELSE NULL
                END
        `,
          [insertedId, inviteeId, response],
        );
      }
    }

    await client.query("COMMIT");

    const created = await fetchActivityWithRelations(insertedId);
    if (!created) {
      throw new Error("activity_not_found_after_create");
    }

    return {
      ...created,
      initialVoteOrRsvpState: buildInitialState(created),
      wasDeduplicated: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
