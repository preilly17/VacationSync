import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { resolveCoverPhotoUrl } from "@/lib/tripCover";
import { Loader2 } from "lucide-react";
import { nanoid } from "nanoid";
import {
  COVER_PHOTO_MAX_FILE_SIZE_BYTES,
  COVER_PHOTO_MAX_FILE_SIZE_MB,
  COVER_PHOTO_MIN_HEIGHT,
  COVER_PHOTO_MIN_WIDTH,
  COVER_PHOTO_RECOMMENDED_HEIGHT,
  COVER_PHOTO_RECOMMENDED_WIDTH,
} from "@shared/constants";

const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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

const UNSPLASH_PRESETS: {
  url: string;
  label: string;
  attribution: string;
}[] = [
  {
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=90",
    label: "Tropical sunrise",
    attribution: "Photo by Sean O. on Unsplash",
  },
  {
    url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=2400&q=90",
    label: "Mountain escape",
    attribution: "Photo by Dominik Schröder on Unsplash",
  },
  {
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90",
    label: "City skyline",
    attribution: "Photo by Denys Nevozhai on Unsplash",
  },
];

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
}

type SelectedImageMeta = {
  previewUrl: string;
  width: number;
  height: number;
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
}: CoverPhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<SelectedImageMeta | null>(null);
  const [altText, setAltText] = useState<string>(
    value.coverPhotoAlt ?? defaultAltText,
  );
  const [focusX, setFocusX] = useState<number>(
    (value.coverPhotoFocalX ?? 0.5) * 100,
  );
  const [focusY, setFocusY] = useState<number>(
    (value.coverPhotoFocalY ?? 0.5) * 100,
  );
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const previousPreviewRef = useRef<string | null>(null);
  const fileInputId = useId();

  const hasImage = Boolean(preview?.previewUrl || value.coverPhotoUrl);

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
    if (preview) {
      return;
    }
    if (typeof value.coverPhotoFocalX === "number") {
      setFocusX(clamp(value.coverPhotoFocalX * 100, 0, 100));
    }
    if (typeof value.coverPhotoFocalY === "number") {
      setFocusY(clamp(value.coverPhotoFocalY * 100, 0, 100));
    }
  }, [value.coverPhotoFocalX, value.coverPhotoFocalY, preview]);

  useEffect(() => {
    return () => {
      if (previousPreviewRef.current) {
        URL.revokeObjectURL(previousPreviewRef.current);
        previousPreviewRef.current = null;
      }
    };
  }, []);

  const displayedImage =
    preview?.previewUrl ??
    resolveCoverPhotoUrl(
      value.coverPhotoUrl ?? value.coverPhotoOriginalUrl ?? null,
    );

  const updateValue = useCallback(
    (patch: Partial<CoverPhotoValue>) => {
      const nextAlt =
        patch.coverPhotoAlt !== undefined ? patch.coverPhotoAlt : altText;
      onChange({
        coverPhotoUrl: patch.coverPhotoUrl ?? value.coverPhotoUrl ?? null,
        coverPhotoCardUrl: patch.coverPhotoCardUrl ?? value.coverPhotoCardUrl ?? null,
        coverPhotoThumbUrl: patch.coverPhotoThumbUrl ?? value.coverPhotoThumbUrl ?? null,
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
            : clamp(focusX / 100, 0, 1),
        coverPhotoFocalY:
          typeof patch.coverPhotoFocalY === "number"
            ? patch.coverPhotoFocalY
            : clamp(focusY / 100, 0, 1),
      });
    },
    [altText, focusX, focusY, onChange, value],
  );

  const resetPreview = useCallback(() => {
    if (previousPreviewRef.current) {
      URL.revokeObjectURL(previousPreviewRef.current);
      previousPreviewRef.current = null;
    }
    setPreview(null);
  }, []);

  const applyFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setError("That file type isn’t supported. Use JPG, PNG, or WebP.");
        return;
      }

      if (file.size > COVER_PHOTO_MAX_FILE_SIZE_BYTES) {
        setError(
          `We couldn’t upload that image. Try JPG/PNG/WebP under ${COVER_PHOTO_MAX_FILE_SIZE_MB}MB.`,
        );
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      try {
        const dimensions = await loadImageDimensions(objectUrl);
        if (dimensions.width < COVER_PHOTO_MIN_WIDTH || dimensions.height < COVER_PHOTO_MIN_HEIGHT) {
          setError(
            `This image is too small. Choose one at least ${COVER_PHOTO_MIN_WIDTH}×${COVER_PHOTO_MIN_HEIGHT}.`,
          );
          URL.revokeObjectURL(objectUrl);
          return;
        }

        const belowRecommendation =
          dimensions.width < COVER_PHOTO_RECOMMENDED_WIDTH ||
          dimensions.height < COVER_PHOTO_RECOMMENDED_HEIGHT;

        setWarning(
          belowRecommendation
            ? `For best results, use at least ${COVER_PHOTO_RECOMMENDED_WIDTH}×${COVER_PHOTO_RECOMMENDED_HEIGHT}. This one is ${dimensions.width}×${dimensions.height}.`
            : null,
        );
        setError(null);
        setFocusX(50);
        setFocusY(50);
        const nextAlt = altText?.trim() ? altText : defaultAltText;
        setAltText(nextAlt);
        previousPreviewRef.current && URL.revokeObjectURL(previousPreviewRef.current);
        previousPreviewRef.current = objectUrl;
        setPreview({ previewUrl: objectUrl, width: dimensions.width, height: dimensions.height });
        onPendingFileChange(file, objectUrl);
        updateValue({
          coverPhotoAlt: nextAlt,
          coverPhotoStorageKey: null,
          coverPhotoOriginalUrl: value.coverPhotoOriginalUrl ?? null,
          coverPhotoFocalX: 0.5,
          coverPhotoFocalY: 0.5,
        });
      } catch (applyError) {
        URL.revokeObjectURL(objectUrl);
        setError("We couldn’t read that image. Try another one.");
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

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isBusy || isFetchingRemote) {
        return;
      }
      const file = event.dataTransfer.files?.[0];
      if (file) {
        await applyFile(file);
      }
    },
    [applyFile, isBusy, isFetchingRemote],
  );

  const openFilePicker = useCallback(() => {
    if (isBusy || isFetchingRemote) {
      return;
    }
    const input = fileInputRef.current as (HTMLInputElement & {
      showPicker?: () => void;
    }) | null;
    if (!input) {
      return;
    }
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (error) {
      console.warn("File picker showPicker failed, falling back to click.", error);
      input.click();
    }
  }, [isBusy, isFetchingRemote]);

  const applyRemoteImage = useCallback(
    async (src: string, label: string) => {
      try {
        setIsFetchingRemote(true);
        const file = await createFileFromUrl(src, label);
        await applyFile(file);
      } catch (remoteError) {
        if ((remoteError as Error).message === "UNSUPPORTED_TYPE") {
          setError("That file type isn’t supported. Use JPG, PNG, or WebP.");
        } else {
          setError("Couldn't load this image. Try another link or upload.");
        }
      } finally {
        setIsFetchingRemote(false);
      }
    },
    [applyFile],
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) {
      setError("Enter an image URL to preview it.");
      return;
    }
    await applyRemoteImage(urlInput.trim(), "cover-photo");
    setUrlInput("");
  }, [applyRemoteImage, urlInput]);

  const handleUnsplashSelect = useCallback(
    async (preset: (typeof UNSPLASH_PRESETS)[number]) => {
      await applyRemoteImage(preset.url, preset.label);
      setAltText(`${preset.label} – ${defaultAltText}`);
      updateValue({
        coverPhotoAlt: `${preset.label} – ${defaultAltText}`,
        coverPhotoAttribution: preset.attribution,
        coverPhotoStorageKey: null,
      });
    },
    [applyRemoteImage, defaultAltText, updateValue],
  );

  const objectPosition = useMemo(
    () => `${clamp(focusX, 0, 100)}% ${clamp(focusY, 0, 100)}%`,
    [focusX, focusY],
  );

  const handleFocusXChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      setFocusX(next);
      updateValue({
        coverPhotoFocalX: clamp(next / 100, 0, 1),
      });
    },
    [updateValue],
  );

  const handleFocusYChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      setFocusY(next);
      updateValue({
        coverPhotoFocalY: clamp(next / 100, 0, 1),
      });
    },
    [updateValue],
  );

  const handleAltChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      setAltText(next);
      updateValue({ coverPhotoAlt: next });
    },
    [updateValue],
  );

  const handleRemove = useCallback(() => {
    resetPreview();
    setAltText(defaultAltText);
    setFocusX(50);
    setFocusY(50);
    setWarning(null);
    setError(null);
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
  }, [defaultAltText, onPendingFileChange, resetPreview, updateValue]);

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
        <Label htmlFor={fileInputId}>Cover photo</Label>
        <p className="text-sm text-slate-500">
          Upload a JPG, PNG, or WebP under {COVER_PHOTO_MAX_FILE_SIZE_MB}MB.
        </p>
      </div>

      {displayedImage ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <div className="relative aspect-video">
              <img
                src={displayedImage}
                alt={altText || "Trip cover photo"}
                className="h-full w-full object-cover"
                style={{ objectPosition }}
                loading="lazy"
              />
              {(isBusy || isFetchingRemote) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/50 text-white">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  <span className="text-xs font-medium">
                    {isBusy ? "Uploading…" : "Loading photo…"}
                  </span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4">
                <p className="text-sm font-medium text-white">Trip banner preview</p>
              </div>
            </div>
            <div className="grid gap-4 bg-white p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Upcoming trip card
                </p>
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <div className="aspect-[4/3]">
                    <img
                      src={displayedImage}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition }}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Trip chip
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200">
                    <img
                      src={displayedImage}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition }}
                      loading="lazy"
                    />
                  </div>
                  <span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-medium text-slate-700">
                    Preview
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700">Horizontal focus</span>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={focusX}
                  onChange={handleFocusXChange}
                  aria-label="Adjust horizontal focus"
                  disabled={isBusy || isFetchingRemote}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700">Vertical focus</span>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={focusY}
                  onChange={handleFocusYChange}
                  aria-label="Adjust vertical focus"
                  disabled={isBusy || isFetchingRemote}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Fine-tune the focal point. We’ll regenerate crops for the banner, card, and chip automatically when the new photo saves.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openFilePicker}
              disabled={isBusy || isFetchingRemote}
            >
              Replace photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={isBusy || isFetchingRemote}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400",
            (isBusy || isFetchingRemote) && "opacity-70",
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-sm font-semibold text-slate-700">Add a cover photo</p>
          <p className="text-xs text-slate-500">
            Drag &amp; drop or choose a JPG, PNG, or WebP (max {COVER_PHOTO_MAX_FILE_SIZE_MB}MB).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openFilePicker}
              disabled={isBusy || isFetchingRemote}
            >
              Upload photo
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cover-photo-url">Use an image URL</Label>
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
                onClick={handleUrlSubmit}
                disabled={isBusy || isFetchingRemote || !urlInput.trim()}
              >
                Preview
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              We’ll fetch the image and show a preview. If the link is private or blocked, uploading is more reliable.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Or start from Unsplash
            </p>
            <div className="flex flex-wrap gap-2">
              {UNSPLASH_PRESETS.map((preset) => (
                <Button
                  key={preset.url}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnsplashSelect(preset)}
                  disabled={isBusy || isFetchingRemote}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {warning ? (
        <p className="text-sm text-amber-600">{warning}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
