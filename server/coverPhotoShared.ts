import path from "path";

export const COVER_PHOTO_SUBDIRECTORY = "cover-photos";
const UPLOADS_ROOT_DIRECTORY = "uploads";

export const COVER_PHOTO_PUBLIC_PREFIX = `/${path.posix.join(
  UPLOADS_ROOT_DIRECTORY,
  COVER_PHOTO_SUBDIRECTORY,
)}`;

export const toCoverPhotoStorageKey = (filename: string) =>
  path.posix.join(COVER_PHOTO_SUBDIRECTORY, filename);

export const sanitizeStorageKey = (key: string) => {
  const normalized = key.replace(/\\+/g, "/");
  if (!normalized.startsWith(`${COVER_PHOTO_SUBDIRECTORY}/`)) {
    return null;
  }

  const parts = normalized.split("/");
  if (parts.some((segment) => segment === ".." || segment === "")) {
    return null;
  }

  return parts.join("/");
};

export const buildCoverPhotoPublicUrlFromStorageKey = (
  storageKey: string | null | undefined,
): string | null => {
  if (!storageKey) {
    return null;
  }

  const sanitized = sanitizeStorageKey(storageKey);
  if (!sanitized) {
    return null;
  }

  const segments = sanitized
    .split("/")
    .map((segment) => encodeURIComponent(segment));
  return `/${[UPLOADS_ROOT_DIRECTORY, ...segments].join("/")}`;
};

export const buildCoverPhotoPublicUrlFromFilename = (filename: string) =>
  `${COVER_PHOTO_PUBLIC_PREFIX}/${encodeURIComponent(filename)}`;
