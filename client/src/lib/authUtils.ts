export function isUnauthorizedError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const maybeStatus = (error as { status?: unknown }).status;
    if (typeof maybeStatus === "number") {
      return maybeStatus === 401;
    }
  }

  if (error instanceof Error) {
    return /^401\b.*unauthorized/i.test(error.message);
  }

  return false;
}
