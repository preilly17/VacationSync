import type { ActivityType } from "@shared/schema";
import { log } from "./vite";

type ActivityFailureStep = "validate" | "save" | "notify";

interface ActivityFailureContext {
  correlationId: string;
  step: ActivityFailureStep;
  userId?: string | null;
  tripId?: number | null;
  error: unknown;
  mode?: ActivityType;
  validationFields?: string[];
  payloadSummary?: Record<string, unknown>;
}

type ActivityCreationOutcome = "success" | "failure";

type ActivityCreationMetricContext = {
  mode: ActivityType;
  outcome: ActivityCreationOutcome;
  reason?: string;
  validationFields?: string[];
};

const activityCreationCounters: Record<string, number> = {
  activity_create_scheduled_success: 0,
  activity_create_scheduled_failure: 0,
  activity_create_proposal_success: 0,
  activity_create_proposal_failure: 0,
};

const getActivityMetricKey = (mode: ActivityType, outcome: ActivityCreationOutcome) => {
  const modeLabel = mode === "PROPOSE" ? "proposal" : "scheduled";
  return `activity_create_${modeLabel}_${outcome}`;
};

export const trackActivityCreationMetric = ({
  mode,
  outcome,
  reason,
  validationFields,
}: ActivityCreationMetricContext) => {
  const key = getActivityMetricKey(mode, outcome);
  activityCreationCounters[key] = (activityCreationCounters[key] ?? 0) + 1;

  const reasonSegment = reason ? ` reason=${reason}` : "";
  const fieldSegment =
    validationFields && validationFields.length > 0
      ? ` fields=${validationFields.slice(0, 3).join("|")}`
      : "";

  log(`📈 metrics.${key}=${activityCreationCounters[key]}${reasonSegment}${fieldSegment}`, "activity");
};

type CounterName = "upload_failed" | "save_failed" | "processing_timeout";

type FailureStep = "validate" | "upload" | "save" | "process";

type FailureContext = {
  step: FailureStep;
  userId?: string | null;
  tripId?: number | null;
  fileSize?: number | null;
  fileType?: string | null;
  storageKey?: string | null;
  error: unknown;
};

const counters: Record<CounterName, number> = {
  upload_failed: 0,
  save_failed: 0,
  processing_timeout: 0,
};

const stepToCounter: Record<FailureStep, CounterName> = {
  validate: "upload_failed",
  upload: "upload_failed",
  save: "save_failed",
  process: "processing_timeout",
};

export const incrementCounter = (name: CounterName) => {
  counters[name] += 1;
  log(`📈 metrics.${name}=${counters[name]}`, "metrics");
};

export const logCoverPhotoFailure = ({
  step,
  userId,
  tripId,
  fileSize,
  fileType,
  storageKey,
  error,
}: FailureContext) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  const counter = stepToCounter[step];
  incrementCounter(counter);

  log(
    `cover-photo ${step} failure :: user=${userId ?? "unknown"} trip=${
      tripId ?? "unknown"
    } size=${fileSize ?? "n/a"} type=${fileType ?? "n/a"} key=${
      storageKey ?? "n/a"
    } :: ${message}`,
    "cover-photo",
  );
};

export const logActivityCreationFailure = ({
  correlationId,
  step,
  userId,
  tripId,
  error,
  mode,
  validationFields,
  payloadSummary,
}: ActivityFailureContext) => {
  const timestamp = new Date().toISOString();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  const modeLabel = mode ?? "SCHEDULED";
  const fieldSegment = validationFields && validationFields.length > 0 ? ` fields=${validationFields.join("|")}` : "";
  const payloadSegment = payloadSummary
    ? ` payload=${JSON.stringify(payloadSummary, (_key, value) => (value instanceof Date ? value.toISOString() : value))}`
    : "";

  log(
    `activity.create failure :: ts=${timestamp} correlation=${correlationId} user=${
      userId ?? "unknown"
    } trip=${tripId ?? "unknown"} step=${step} mode=${modeLabel} :: ${message}${fieldSegment}${payloadSegment}`,
    "activity",
  );
};
