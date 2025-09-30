import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const UNSPLASH_PRESETS: { url: string; label: string; attribution: string }[] = [
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (src.startsWith("http")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const toDataUrl = async (
  image: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  outputWidth: number,
  ratio: number,
): Promise<string> => {
  const canvas = document.createElement("canvas");
  const outputHeight = Math.round(outputWidth / ratio);
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to prepare canvas context");
  }
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return canvas.toDataURL("image/webp", 0.9);
};

const deriveCrop = (
  width: number,
  height: number,
  focusX: number,
  focusY: number,
  ratio: number,
) => {
  const centerX = clamp((focusX / 100) * width, 0, width);
  const centerY = clamp((focusY / 100) * height, 0, height);
  const maxWidthFromHeight = height * ratio;
  const cropWidth = Math.min(width, maxWidthFromHeight);
  const cropHeight = cropWidth / ratio;
  const startX = clamp(centerX - cropWidth / 2, 0, width - cropWidth);
  const startY = clamp(centerY - cropHeight / 2, 0, height - cropHeight);
  return { x: startX, y: startY, width: cropWidth, height: cropHeight };
};

export type CoverPhotoValue = {
  coverPhotoUrl: string | null;
  coverPhotoCardUrl: string | null;
  coverPhotoThumbUrl: string | null;
  coverPhotoAlt: string | null;
  coverPhotoAttribution: string | null;
};

interface CoverPhotoSectionProps {
  value: CoverPhotoValue;
  onChange: (value: CoverPhotoValue) => void;
  defaultAltText: string;
}

type EditorState = {
  source: string;
  width: number;
  height: number;
  attribution: string | null;
};

export function CoverPhotoSection({ value, onChange, defaultAltText }: CoverPhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [altText, setAltText] = useState<string>(value.coverPhotoAlt ?? defaultAltText);

  const hasImage = Boolean(value.coverPhotoUrl);

  useEffect(() => {
    if (!hasImage) {
      setFocusX(50);
      setFocusY(50);
    }
  }, [hasImage]);

  useEffect(() => {
    if (value.coverPhotoAlt && value.coverPhotoAlt !== altText) {
      setAltText(value.coverPhotoAlt);
    }
  }, [value.coverPhotoAlt]);

  useEffect(() => {
    if (!value.coverPhotoAlt && hasImage) {
      setAltText(defaultAltText);
      onChange({
        coverPhotoUrl: value.coverPhotoUrl,
        coverPhotoCardUrl: value.coverPhotoCardUrl,
        coverPhotoThumbUrl: value.coverPhotoThumbUrl,
        coverPhotoAlt: defaultAltText,
        coverPhotoAttribution: value.coverPhotoAttribution,
      });
    }
  }, [
    defaultAltText,
    hasImage,
    onChange,
    value.coverPhotoAlt,
    value.coverPhotoAttribution,
    value.coverPhotoCardUrl,
    value.coverPhotoThumbUrl,
    value.coverPhotoUrl,
  ]);

  useEffect(() => {
    if (!editorState) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        setIsProcessing(true);
        const image = await loadImage(editorState.source);
        if (cancelled) {
          return;
        }
        const bannerCrop = deriveCrop(editorState.width, editorState.height, focusX, focusY, 16 / 9);
        const cardCrop = deriveCrop(editorState.width, editorState.height, focusX, focusY, 4 / 3);
        const thumbCrop = deriveCrop(editorState.width, editorState.height, focusX, focusY, 1);
        const [banner, card, thumb] = await Promise.all([
          toDataUrl(image, bannerCrop, 1920, 16 / 9),
          toDataUrl(image, cardCrop, 800, 4 / 3),
          toDataUrl(image, thumbCrop, 256, 1),
        ]);
        onChange({
          coverPhotoUrl: banner,
          coverPhotoCardUrl: card,
          coverPhotoThumbUrl: thumb,
          coverPhotoAlt: altText,
          coverPhotoAttribution: editorState.attribution,
        });
        setError(null);
      } catch (processingError) {
        console.error(processingError);
        if (!cancelled) {
          setError("We couldn't process that image. Try another one.");
        }
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [altText, editorState, focusX, focusY, onChange]);

  const setEditorFromImage = useCallback(
    (src: string, width: number, height: number, attribution: string | null) => {
      setEditorState({ source: src, width, height, attribution });
      setFocusX(50);
      setFocusY(50);
    },
    [],
  );

  useEffect(() => {
    if (!value.coverPhotoUrl || editorState) {
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      try {
        const image = await loadImage(value.coverPhotoUrl!);
        if (cancelled) {
          return;
        }
        setEditorFromImage(
          value.coverPhotoUrl!,
          image.naturalWidth,
          image.naturalHeight,
          value.coverPhotoAttribution ?? null,
        );
      } catch (hydrateError) {
        console.error(hydrateError);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [editorState, setEditorFromImage, value.coverPhotoAttribution, value.coverPhotoUrl]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPG, PNG, or WEBP).");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`Images must be ${MAX_FILE_SIZE_MB}MB or smaller.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const src = typeof reader.result === "string" ? reader.result : "";
          const image = await loadImage(src);
          setAltText((prev) => prev || defaultAltText);
          setEditorFromImage(src, image.naturalWidth, image.naturalHeight, null);
        } catch (fileError) {
          console.error(fileError);
          setError("We couldn't read that image. Try another file.");
        }
      };
      reader.onerror = () => setError("We couldn't read that image. Try another file.");
      reader.readAsDataURL(file);
    },
    [defaultAltText, setEditorFromImage],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer.files?.length) {
        await handleFile(event.dataTransfer.files[0]!);
      }
    },
    [handleFile],
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) {
      setError("Enter an image URL to preview it.");
      return;
    }
    try {
      const src = urlInput.trim();
      const image = await loadImage(src);
      setAltText((prev) => prev || defaultAltText);
      setEditorFromImage(src, image.naturalWidth, image.naturalHeight, null);
      setUrlInput("");
    } catch (loadError) {
      console.error(loadError);
      setError("Couldn't load this image. Try another link or upload.");
    }
  }, [defaultAltText, setEditorFromImage, urlInput]);

  const handleUnsplashSelect = useCallback(
    async (preset: (typeof UNSPLASH_PRESETS)[number]) => {
      try {
        const image = await loadImage(preset.url);
        setAltText(`${preset.label} – ${defaultAltText}`);
        setEditorFromImage(preset.url, image.naturalWidth, image.naturalHeight, preset.attribution);
      } catch (presetError) {
        console.error(presetError);
        setError("We couldn't load that Unsplash image. Try another option.");
      }
    },
    [defaultAltText, setEditorFromImage],
  );

  const focusControls = useMemo(
    () => (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Horizontal focus</span>
            <Input
              type="range"
              min={0}
              max={100}
              value={focusX}
              onChange={(event) => setFocusX(Number(event.target.value))}
              aria-label="Adjust horizontal focus"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Vertical focus</span>
            <Input
              type="range"
              min={0}
              max={100}
              value={focusY}
              onChange={(event) => setFocusY(Number(event.target.value))}
              aria-label="Adjust vertical focus"
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Fine-tune the focal point. We’ll regenerate crops for the banner, card, and chip automatically.
        </p>
      </div>
    ),
    [focusX, focusY],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-slate-700">Cover photo</Label>
        <p className="text-xs text-slate-500">
          Upload an image to personalize your trip banner. We’ll optimize it for the dashboard and cards automatically.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {hasImage ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <div className="relative aspect-video">
              <img
                src={value.coverPhotoUrl ?? undefined}
                alt={altText || "Trip cover photo"}
                className={cn("h-full w-full object-cover", isProcessing && "opacity-70")}
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4">
                <p className="text-sm font-medium text-white">Trip banner preview</p>
              </div>
            </div>
            <div className="grid gap-4 bg-white p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Upcoming trip card</p>
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <div className="aspect-[4/3]">
                    <img
                      src={value.coverPhotoCardUrl ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Trip chip</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200">
                    <img
                      src={value.coverPhotoThumbUrl ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-medium text-slate-700">Preview</span>
                </div>
              </div>
            </div>
          </div>

          {editorState ? focusControls : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              Replace photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => {
                onChange({
                  coverPhotoUrl: null,
                  coverPhotoCardUrl: null,
                  coverPhotoThumbUrl: null,
                  coverPhotoAlt: null,
                  coverPhotoAttribution: null,
                });
                setEditorState(null);
                setAltText(defaultAltText);
                setError(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400",
              isProcessing && "opacity-70",
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <p className="text-sm font-semibold text-slate-700">Add a cover photo</p>
            <p className="text-xs text-slate-500">Drag & drop or choose a JPG, PNG, or WEBP (max {MAX_FILE_SIZE_MB}MB).</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                Upload photo
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                    event.target.value = "";
                  }
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Label htmlFor="cover-photo-url" className="text-sm font-medium text-slate-700">
              Paste image URL
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="cover-photo-url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="flex-1"
              />
              <Button type="button" onClick={handleUrlSubmit} disabled={isProcessing}>
                Preview
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              We’ll fetch the image and show a preview. If the link is private or blocked, uploading is more reliable.
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">Choose from Unsplash</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {UNSPLASH_PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => void handleUnsplashSelect(preset)}
                  className="group overflow-hidden rounded-xl border border-slate-200 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-slate-700">{preset.label}</p>
                    <p className="text-xs text-slate-500">{preset.attribution}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasImage ? (
        <div className="space-y-2">
          <Label htmlFor="cover-photo-alt" className="text-sm font-medium text-slate-700">
            Alt text (optional)
          </Label>
          <Textarea
            id="cover-photo-alt"
            value={altText}
            onChange={(event) => {
              const next = event.target.value;
              setAltText(next);
              onChange({
                ...value,
                coverPhotoAlt: next || null,
              });
            }}
            placeholder={defaultAltText}
            className="min-h-[60px]"
          />
          <p className="text-xs text-slate-500">
            Describe the image for travelers using screen readers. Leave blank to use the default description.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">Recommended size 1920×1080 or larger for the sharpest banner.</p>
    </div>
  );
}
