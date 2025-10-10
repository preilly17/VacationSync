import express, { type Express, type NextFunction, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { nanoid } from "nanoid";
import {
  COVER_PHOTO_MAX_FILE_SIZE_BYTES,
  COVER_PHOTO_MAX_FILE_SIZE_MB,
} from "@shared/constants";
import { log } from "./vite";
import { logCoverPhotoFailure } from "./observability";

type GetUserId = (req: Request) => string | undefined;

type RegisterOptions = {
  isAuthenticated: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: GetUserId;
};

const UPLOAD_ROOT = path.resolve(process.cwd(), "cache", "uploads");
export const COVER_PHOTO_SUBDIRECTORY = "cover-photos";
const COVER_PHOTO_DIRECTORY = path.join(UPLOAD_ROOT, COVER_PHOTO_SUBDIRECTORY);
const PUBLIC_PREFIX = `/${path.posix.join("uploads", COVER_PHOTO_SUBDIRECTORY)}`;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const ensureDirectory = (directory: string) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const resolveFilename = (originalName: string, mimeType: string) => {
  const originalExt = path.extname(originalName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(originalExt)) {
    return `${Date.now()}-${nanoid(8)}${originalExt}`;
  }

  const fallbackExt =
    mimeType === "image/png"
      ? ".png"
      : mimeType === "image/webp"
        ? ".webp"
        : ".jpg";
  return `${Date.now()}-${nanoid(8)}${fallbackExt}`;
};

const toStorageKey = (filename: string) =>
  path.posix.join(COVER_PHOTO_SUBDIRECTORY, filename);

const toPublicUrl = (filename: string) =>
  `${PUBLIC_PREFIX}/${encodeURIComponent(filename)}`;

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

  const segments = sanitized.split("/").map((segment) => encodeURIComponent(segment));
  return `/${["uploads", ...segments].join("/")}`;
};

const coverPhotoRawMiddleware = express.raw({
  type: "application/octet-stream",
  limit: COVER_PHOTO_MAX_FILE_SIZE_BYTES,
});

const validateUploadHeaders = (
  req: Request,
): { mimeType: string; originalName: string } | null => {
  const mimeType = (req.headers["x-content-type"] as string | undefined) ?? "";
  const originalName = (req.headers["x-filename"] as string | undefined) ?? "";

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return null;
  }

  const extension = path.extname(originalName).toLowerCase();
  if (originalName && ALLOWED_EXTENSIONS.has(extension)) {
    return { mimeType, originalName };
  }

  if (!originalName) {
    return { mimeType, originalName: `cover-photo-${Date.now()}` };
  }

  // Extension not in allow-list
  return null;
};

export const registerCoverPhotoUploadRoutes = (
  app: Express,
  { isAuthenticated, getUserId }: RegisterOptions,
) => {
  ensureDirectory(COVER_PHOTO_DIRECTORY);
  app.use("/uploads", express.static(UPLOAD_ROOT));

  app.post(
    "/api/uploads/cover-photo",
    isAuthenticated,
    coverPhotoRawMiddleware,
    async (req: Request, res: Response) => {
      const userId = getUserId(req) ?? null;
      const metadata = validateUploadHeaders(req);

      if (!metadata) {
        logCoverPhotoFailure({
          step: "validate",
          userId,
          tripId: null,
          fileSize: null,
          fileType: req.headers["x-content-type"] as string | null,
          storageKey: null,
          error: new Error("Unsupported file type"),
        });
        return res
          .status(400)
          .json({ message: "That file type isn’t supported. Use JPG, PNG, or WebP." });
      }

      const buffer = req.body as Buffer;
      if (!buffer || buffer.length === 0) {
        logCoverPhotoFailure({
          step: "upload",
          userId,
          tripId: null,
          fileSize: 0,
          fileType: metadata.mimeType,
          storageKey: null,
          error: new Error("Empty upload"),
        });
        return res
          .status(400)
          .json({ message: "We couldn’t upload that image. Try again with a new file." });
      }

      if (buffer.length > COVER_PHOTO_MAX_FILE_SIZE_BYTES) {
        logCoverPhotoFailure({
          step: "upload",
          userId,
          tripId: null,
          fileSize: buffer.length,
          fileType: metadata.mimeType,
          storageKey: null,
          error: new Error("File exceeds limit"),
        });
        return res.status(413).json({
          message: `We couldn’t upload that image. Try JPG/PNG/WebP under ${COVER_PHOTO_MAX_FILE_SIZE_MB}MB.`,
        });
      }

      const filename = resolveFilename(metadata.originalName, metadata.mimeType);
      const destination = path.join(COVER_PHOTO_DIRECTORY, filename);

      try {
        await fsPromises.writeFile(destination, buffer);
      } catch (error) {
        logCoverPhotoFailure({
          step: "upload",
          userId,
          tripId: null,
          fileSize: buffer.length,
          fileType: metadata.mimeType,
          storageKey: null,
          error,
        });
        return res.status(500).json({
          message:
            "We couldn’t save the image to storage. Please check your permissions and try again.",
        });
      }

      const storageKey = toStorageKey(filename);
      const publicUrl = toPublicUrl(filename);
      log(
        `cover-photo upload success :: user=${userId ?? "unknown"} key=${storageKey} size=${buffer.length} type=${metadata.mimeType}`,
        "cover-photo",
      );

      return res.json({
        storageKey,
        publicUrl,
        size: buffer.length,
        mimeType: metadata.mimeType,
      });
    },
  );

  app.use(
    "/api/uploads/cover-photo",
    (error: any, req: Request, res: Response, next: NextFunction) => {
      if (!error) {
        return next();
      }

      const userId = getUserId(req) ?? null;
      if (error?.type === "entity.too.large") {
        logCoverPhotoFailure({
          step: "upload",
          userId,
          tripId: null,
          fileSize: COVER_PHOTO_MAX_FILE_SIZE_BYTES,
          fileType: (req.headers["x-content-type"] as string) ?? null,
          storageKey: null,
          error,
        });
        return res.status(413).json({
          message: `We couldn’t upload that image. Try JPG/PNG/WebP under ${COVER_PHOTO_MAX_FILE_SIZE_MB}MB.`,
        });
      }

      logCoverPhotoFailure({
        step: "upload",
        userId,
        tripId: null,
        fileSize: null,
        fileType: (req.headers["x-content-type"] as string) ?? null,
        storageKey: null,
        error,
      });
      return res.status(500).json({
        message:
          "We couldn’t save the image to storage. Please check your permissions and try again.",
      });
    },
  );

  app.delete(
    "/api/uploads/cover-photo/:key",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req) ?? null;
      const rawKey = req.params.key;
      const sanitized = sanitizeStorageKey(rawKey);
      if (!sanitized) {
        logCoverPhotoFailure({
          step: "upload",
          userId,
          tripId: null,
          fileSize: null,
          fileType: null,
          storageKey: rawKey,
          error: new Error("Invalid storage key"),
        });
        return res.status(400).json({ message: "Invalid storage key" });
      }

      const absolutePath = path.resolve(UPLOAD_ROOT, sanitized);
      if (!absolutePath.startsWith(UPLOAD_ROOT)) {
        return res.status(400).json({ message: "Invalid storage key" });
      }

      try {
        await fsPromises.unlink(absolutePath);
        res.status(204).end();
      } catch (error: any) {
        if (error?.code === "ENOENT") {
          return res.status(204).end();
        }

        logCoverPhotoFailure({
          step: "upload",
          userId,
          tripId: null,
          fileSize: null,
          fileType: null,
          storageKey: sanitized,
          error,
        });
        res.status(500).json({ message: "Failed to remove uploaded image" });
      }
    },
  );
};
