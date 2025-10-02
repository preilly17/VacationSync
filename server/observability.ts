import { log } from "./vite";

type ActivityFailureStep = "validate" | "save";

interface ActivityFailureContext {
  correlationId: string;
  step: ActivityFailureStep;
  userId?: string | null;
  tripId?: number | null;
  error: unknown;
}

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
}: ActivityFailureContext) => {
  const timestamp = new Date().toISOString();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  log(
    `activity.create failure :: ts=${timestamp} correlation=${correlationId} user=${
      userId ?? "unknown"
    } trip=${tripId ?? "unknown"} step=${step} :: ${message}`,
    "activity",
  );
};
