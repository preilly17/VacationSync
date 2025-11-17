import { describe, expect, it } from "@jest/globals";

import { CORS_ALLOWED_HEADERS, createCorsOptions } from "../corsConfig";

const toLowerSet = (values: readonly string[]) =>
  new Set(values.map((value) => value.toLowerCase()));

describe("CORS configuration", () => {
  it("only exposes the base allow-list headers", () => {
    const expectedHeaders = [
      "content-type",
      "authorization",
      "x-request-id",
      "x-filename",
      "x-content-type",
      "x-trip-share-code",
      "x-activities-version",
    ];

    expect(toLowerSet(CORS_ALLOWED_HEADERS)).toEqual(new Set(expectedHeaders));

    const options = createCorsOptions(() => true);
    const allowedHeaders = Array.isArray(options.allowedHeaders)
      ? options.allowedHeaders
      : typeof options.allowedHeaders === "string"
        ? options.allowedHeaders.split(",")
        : [];

    expect(toLowerSet(allowedHeaders as string[])).toEqual(new Set(expectedHeaders));
  });
});

