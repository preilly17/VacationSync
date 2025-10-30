import { ApiError, apiRequest } from "@/lib/queryClient";

jest.mock("@/lib/api", () => ({
  buildApiUrl: (path: string) => path,
}));

describe("apiRequest", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("throws an unauthorized ApiError when the response is an HTML redirect to the login page", async () => {
    const response = new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "redirected", { value: true });
    Object.defineProperty(response, "url", { value: "https://example.com/login" });

    global.fetch = jest.fn().mockResolvedValue(response);

    const request = apiRequest("/api/trips/1/wish-list");
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized",
    });
  });

  it("throws an ApiError when the response is unexpected HTML", async () => {
    const response = new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "redirected", { value: false });
    Object.defineProperty(response, "url", { value: "https://example.com/api/trips" });

    global.fetch = jest.fn().mockResolvedValue(response);

    const request = apiRequest("/api/trips/1/wish-list");
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 200,
      message: "API returned HTML instead of JSON",
    });
  });
});
