export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && /^401: .*Unauthorized/.test(error.message);
}