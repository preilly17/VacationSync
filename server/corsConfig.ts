import type { CorsOptions } from "cors";

const BASE_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Request-ID",
  "X-Filename",
  "X-Content-Type",
];

const ACTIVITIES_HEADERS = ["X-Activities-Version"];

export const CORS_ALLOWED_HEADERS = [...BASE_ALLOWED_HEADERS, ...ACTIVITIES_HEADERS];

export const createCorsOptions = (
  isOriginAllowed: (origin?: string | null) => boolean,
): CorsOptions => ({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    const error = new Error(
      origin ? `Not allowed by CORS: ${origin}` : "Not allowed by CORS",
    );
    return callback(error);
  },
  credentials: true,
  allowedHeaders: CORS_ALLOWED_HEADERS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
});

