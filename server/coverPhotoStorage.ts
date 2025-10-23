import { query } from "./db";

const TABLE_NAME = "cover_photo_uploads";

type CoverPhotoUploadRow = {
  storage_key: string;
  mime_type: string;
  size: number;
  data: Buffer;
  created_at: Date;
};

type CoverPhotoUpload = {
  storageKey: string;
  mimeType: string;
  size: number;
  data: Buffer;
  createdAt: Date;
};

const toCoverPhotoUpload = (row: CoverPhotoUploadRow): CoverPhotoUpload => ({
  storageKey: row.storage_key,
  mimeType: row.mime_type,
  size: row.size,
  data: row.data,
  createdAt: row.created_at,
});

let initializationPromise: Promise<void> | null = null;

const ensureTable = () => {
  if (!initializationPromise) {
    initializationPromise = query(
      `
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          storage_key TEXT PRIMARY KEY,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL CHECK (size >= 0),
          data BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
    ).then(() => undefined);
  }

  return initializationPromise;
};

export const saveCoverPhotoUpload = async ({
  storageKey,
  mimeType,
  data,
}: {
  storageKey: string;
  mimeType: string;
  data: Buffer;
}) => {
  await ensureTable();
  await query(
    `
      INSERT INTO ${TABLE_NAME} (storage_key, mime_type, size, data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (storage_key)
      DO UPDATE SET
        mime_type = EXCLUDED.mime_type,
        size = EXCLUDED.size,
        data = EXCLUDED.data,
        created_at = NOW()
    `,
    [storageKey, mimeType, data.length, data],
  );
};

export const getCoverPhotoUpload = async (
  storageKey: string,
): Promise<CoverPhotoUpload | null> => {
  await ensureTable();
  const result = await query<CoverPhotoUploadRow>(
    `SELECT storage_key, mime_type, size, data, created_at FROM ${TABLE_NAME} WHERE storage_key = $1`,
    [storageKey],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return toCoverPhotoUpload(result.rows[0]!);
};

export const deleteCoverPhotoUpload = async (storageKey: string) => {
  await ensureTable();
  await query(`DELETE FROM ${TABLE_NAME} WHERE storage_key = $1`, [storageKey]);
};
