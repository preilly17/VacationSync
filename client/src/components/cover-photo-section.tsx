import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nanoid } from "nanoid";
import {
  COVER_PHOTO_MAX_FILE_SIZE_BYTES,
  COVER_PHOTO_MAX_FILE_SIZE_MB,
  COVER_PHOTO_MIN_HEIGHT,
  COVER_PHOTO_MIN_WIDTH,
} from "@shared/constants";

const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const loadImageDimensions = (src: string): Promise<{
  width: number;
  height: number;
}> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });

export type CoverPhotoValue = {
  coverPhotoUrl: string | null;
  coverPhotoCardUrl?: string | null;
  coverPhotoThumbUrl?: string | null;
  coverPhotoAlt: string | null;
  coverPhotoAttribution?: string | null;
  coverPhotoStorageKey: string | null;
  coverPhotoOriginalUrl: string | null;
  coverPhotoFocalX: number | null;
  coverPhotoFocalY: number | null;
};

interface CoverPhotoSectionProps {
  value: CoverPhotoValue;
  onChange: (value: CoverPhotoValue) => void;
  defaultAltText: string;
  onPendingFileChange: (file: File | null, previewUrl: string | null) => void;
  isBusy?: boolean;
  label?: string;
  uploadButtonLabel?: string;
}

type SelectedFileInfo = {
  name: string;
  size: number;
  width?: number;
  height?: number;
};

const buildFileName = (label: string, extension: string) => {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${normalized || "cover-photo"}-${nanoid(6)}${extension}`;
};

const createFileFromUrl = async (
  url: string,
  label: string,
): Promise<File> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch remote image");
  }
  const blob = await response.blob();
  const mimeType = blob.type || "image/jpeg";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  const extension =
    mimeType === "image/png"
      ? ".png"
      : mimeType === "image/webp"
        ? ".webp"
        : ".jpg";
  return new File([blob], buildFileName(label, extension), { type: mimeType });
};

export function CoverPhotoSection({
  value,
  onChange,
  defaultAltText,
  onPendingFileChange,
  isBusy = false,
  label,
  uploadButtonLabel,
}: CoverPhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const [altText, setAltText] = useState<string>(
    value.coverPhotoAlt ?? defaultAltText,
  );
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState<SelectedFileInfo | null>(null);

  const hasPersistedImage = Boolean(
    value.coverPhotoUrl || value.coverPhotoOriginalUrl,
  );
  const hasPendingFile = Boolean(selectedFileInfo);
  const hasImage = hasPendingFile || hasPersistedImage;

  useEffect(() => {
    if (value.coverPhotoAlt && value.coverPhotoAlt !== altText) {
      setAltText(value.coverPhotoAlt);
    }
    if (!value.coverPhotoAlt && hasImage) {
      setAltText(defaultAltText);
      onChange({
        ...value,
        coverPhotoAlt: defaultAltText,
      });
    }
  }, [value.coverPhotoAlt, hasImage, defaultAltText, onChange, value, altText]);

  useEffect(() => {
    setSelectedFileInfo(null);
    setWarning(null);
    setError(null);
  }, [value.coverPhotoUrl, value.coverPhotoOriginalUrl, value.coverPhotoStorageKey]);

  const updateValue = useCallback(
    (patch: Partial<CoverPhotoValue>) => {
      const nextAlt =
        patch.coverPhotoAlt !== undefined ? patch.coverPhotoAlt : altText;
      onChange({
        coverPhotoUrl: patch.coverPhotoUrl ?? value.coverPhotoUrl ?? null,
        coverPhotoCardUrl:
          patch.coverPhotoCardUrl ?? value.coverPhotoCardUrl ?? null,
        coverPhotoThumbUrl:
          patch.coverPhotoThumbUrl ?? value.coverPhotoThumbUrl ?? null,
        coverPhotoAlt: nextAlt ?? null,
        coverPhotoAttribution:
          patch.coverPhotoAttribution ?? value.coverPhotoAttribution ?? null,
        coverPhotoStorageKey:
          patch.coverPhotoStorageKey ?? value.coverPhotoStorageKey ?? null,
        coverPhotoOriginalUrl:
          patch.coverPhotoOriginalUrl ?? value.coverPhotoOriginalUrl ?? null,
        coverPhotoFocalX:
          typeof patch.coverPhotoFocalX === "number"
            ? patch.coverPhotoFocalX
            : typeof value.coverPhotoFocalX === "number"
              ? value.coverPhotoFocalX
              : 0.5,
        coverPhotoFocalY:
          typeof patch.coverPhotoFocalY === "number"
            ? patch.coverPhotoFocalY
            : typeof value.coverPhotoFocalY === "number"
              ? value.coverPhotoFocalY
              : 0.5,
      });
    },
    [altText, onChange, value],
  );

  const formatFileSize = useCallback((size: number) => {
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${size} B`;
  }, []);

  const applyFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setError("That file type isn’t supported. Use JPG, PNG, or WebP.");
        return;
      }

      if (file.size > COVER_PHOTO_MAX_FILE_SIZE_BYTES) {
        setError(
          `This file is over ${COVER_PHOTO_MAX_FILE_SIZE_MB}MB. Try compressing it and upload again.`,
        );
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      try {
        const dimensions = await loadImageDimensions(objectUrl);
        const belowMinimum =
          dimensions.width < COVER_PHOTO_MIN_WIDTH ||
          dimensions.height < COVER_PHOTO_MIN_HEIGHT;

        if (belowMinimum) {
          setWarning(
            `Images under ${COVER_PHOTO_MIN_WIDTH}×${COVER_PHOTO_MIN_HEIGHT} may look soft on large screens. This one is ${dimensions.width}×${dimensions.height}.`,
          );
        } else {
          setWarning(null);
        }
        setError(null);
        const nextAlt = altText?.trim() ? altText : defaultAltText;
        setAltText(nextAlt);
        setSelectedFileInfo({
          name: file.name,
          size: file.size,
          width: dimensions.width,
          height: dimensions.height,
        });
        onPendingFileChange(file, null);
        updateValue({
          coverPhotoAlt: nextAlt,
          coverPhotoStorageKey: null,
          coverPhotoOriginalUrl: value.coverPhotoOriginalUrl ?? null,
          coverPhotoFocalX: 0.5,
          coverPhotoFocalY: 0.5,
        });
      } catch (applyError) {
        setError("We couldn’t read that image. Try another one.");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [altText, defaultAltText, onPendingFileChange, updateValue, value.coverPhotoOriginalUrl],
  );

  const handleFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      await applyFile(file);
      event.target.value = "";
    },
    [applyFile],
  );

  const openFilePicker = useCallback(() => {
    if (isBusy || isFetchingRemote) {
      return;
    }
    const input = fileInputRef.current;
    if (!input) {
      return;
    }
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (pickerError) {
      console.warn("File picker showPicker failed, falling back to click.", pickerError);
      input.click();
    }
  }, [isBusy, isFetchingRemote]);

  const applyRemoteImage = useCallback(
    async (src: string, label: string) => {
      try {
        const file = await createFileFromUrl(src, label);
        await applyFile(file);
        return true;
      } catch (remoteError) {
        if ((remoteError as Error).message === "UNSUPPORTED_TYPE") {
          setError("That file type isn’t supported. Use JPG, PNG, or WebP.");
        } else {
          setError("Couldn't load this image. Try another link or upload.");
        }
        return false;
      }
    },
    [applyFile],
  );

  const handleUrlSubmit = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      return;
    }

    let candidate: URL;
    try {
      candidate = new URL(trimmed);
    } catch {
      setError("Enter a valid image URL.");
      return;
    }

    setIsFetchingRemote(true);
    setError(null);
    const success = await applyRemoteImage(candidate.toString(), candidate.toString());
    if (success) {
      setUrlInput("");
    }
    setIsFetchingRemote(false);
  }, [urlInput, applyRemoteImage]);

  const handleAltChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      setAltText(next);
      updateValue({ coverPhotoAlt: next });
    },
    [updateValue],
  );

  const handleRemove = useCallback(() => {
    setAltText(defaultAltText);
    setWarning(null);
    setError(null);
    setSelectedFileInfo(null);
    onPendingFileChange(null, null);
    updateValue({
      coverPhotoUrl: null,
      coverPhotoCardUrl: null,
      coverPhotoThumbUrl: null,
      coverPhotoAlt: null,
      coverPhotoAttribution: null,
      coverPhotoStorageKey: null,
      coverPhotoOriginalUrl: null,
      coverPhotoFocalX: 0.5,
      coverPhotoFocalY: 0.5,
    });
  }, [defaultAltText, onPendingFileChange, updateValue]);

  return (
    <div className="space-y-6">
      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={handleFileInput}
        aria-hidden="true"
      />

      <div className="space-y-2">
        <Label htmlFor={fileInputId}>{label ?? "Cover photo"}</Label>
        <p className="text-sm text-slate-500">
          We’ll fit your photo automatically. Images under {COVER_PHOTO_MIN_WIDTH}×{COVER_PHOTO_MIN_HEIGHT} may look soft on large screens.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={openFilePicker}
            disabled={isBusy || isFetchingRemote}
          >
            {uploadButtonLabel ?? `Upload photo (JPG/PNG/WebP, ≤${COVER_PHOTO_MAX_FILE_SIZE_MB}MB)`}
          </Button>
          {hasImage ? (
            <Button
              type="button"
              variant="ghost"
              className="text-slate-600 hover:text-slate-900"
              onClick={handleRemove}
              disabled={isBusy || isFetchingRemote}
            >
              Remove photo
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover-photo-url">Image URL (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="cover-photo-url"
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              disabled={isBusy || isFetchingRemote}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleUrlSubmit}
              disabled={
                isBusy || isFetchingRemote || !urlInput.trim()
              }
            >
              Preview
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            We’ll validate the link and use the image if it’s accessible. If the link is private or blocked, uploading is more reliable.
          </p>
        </div>

        {selectedFileInfo ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-700">{selectedFileInfo.name}</p>
            <p className="text-xs text-slate-500">
              {[
                selectedFileInfo.width && selectedFileInfo.height
                  ? `${selectedFileInfo.width}×${selectedFileInfo.height}`
                  : null,
                formatFileSize(selectedFileInfo.size),
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
        ) : hasPersistedImage ? (
          <p className="text-xs text-slate-500">
            A cover photo is already set. Upload a new one to replace it or remove it to use the gradient.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover-photo-alt">Alt text (optional)</Label>
        <Textarea
          id="cover-photo-alt"
          value={altText}
          onChange={handleAltChange}
          placeholder="Describe the image for screen readers"
          disabled={isBusy || isFetchingRemote || !hasImage}
          rows={3}
        />
        <p className="text-xs text-slate-500">
          Helpful for travelers using screen readers. If left blank, we’ll reuse the trip name.
        </p>
      </div>

      {warning ? (
        <p className="text-sm text-amber-600">{warning}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
