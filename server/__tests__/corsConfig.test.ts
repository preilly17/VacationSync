import { describe, expect, it } from "@jest/globals";

import { CORS_ALLOWED_HEADERS, createCorsOptions } from "../corsConfig";

const toLowerSet = (values: readonly string[]) =>
  new Set(values.map((value) => value.toLowerCase()));

describe("CORS configuration", () => {
  it("includes the activities version header in the allow-list", () => {
    expect(toLowerSet(CORS_ALLOWED_HEADERS)).toContain("x-activities-version");
  });

  it("exposes the activities version header in generated options", () => {
    const options = createCorsOptions(() => true);
    const allowedHeaders = Array.isArray(options.allowedHeaders)
      ? options.allowedHeaders
      : typeof options.allowedHeaders === "string"
        ? options.allowedHeaders.split(",")
        : [];

    expect(toLowerSet(allowedHeaders as string[])).toContain("x-activities-version");
  });
});

