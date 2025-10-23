import { buildCoverPhotoPublicUrlFromStorageKey } from "../coverPhotoShared";

describe("buildCoverPhotoPublicUrlFromStorageKey", () => {
  it("returns a public URL for a valid storage key", () => {
    expect(
      buildCoverPhotoPublicUrlFromStorageKey("cover-photos/example-image.webp"),
    ).toBe("/uploads/cover-photos/example-image.webp");
  });

  it("encodes unsafe filename characters", () => {
    expect(
      buildCoverPhotoPublicUrlFromStorageKey("cover-photos/my photo 1.png"),
    ).toBe("/uploads/cover-photos/my%20photo%201.png");
  });

  it("rejects keys outside the cover photo directory", () => {
    expect(buildCoverPhotoPublicUrlFromStorageKey("other/path.png")).toBeNull();
  });

  it("rejects directory traversal attempts", () => {
    expect(
      buildCoverPhotoPublicUrlFromStorageKey("cover-photos/../../evil.png"),
    ).toBeNull();
  });

  it("returns null for empty keys", () => {
    expect(buildCoverPhotoPublicUrlFromStorageKey(null)).toBeNull();
    expect(buildCoverPhotoPublicUrlFromStorageKey(undefined)).toBeNull();
    expect(buildCoverPhotoPublicUrlFromStorageKey("")).toBeNull();
  });
});
