import {
  COVER_PHOTO_MIN_HEIGHT,
  COVER_PHOTO_MIN_WIDTH,
  COVER_PHOTO_RECOMMENDED_HEIGHT,
  COVER_PHOTO_RECOMMENDED_WIDTH,
} from "@shared/constants";

const COVER_PHOTO_ASPECT_RATIO =
  COVER_PHOTO_RECOMMENDED_WIDTH / COVER_PHOTO_RECOMMENDED_HEIGHT;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      reject(event instanceof Error ? event : new Error("Failed to load image"));
    };
    image.src = objectUrl;
  });

const toBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create image blob"));
        }
      },
      mimeType,
      quality,
    );
  });

const getExtensionFromMime = (mimeType: string): string => {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
};

const selectOutputMimeType = (inputMime: string): string => {
  if (inputMime === "image/png" || inputMime === "image/webp") {
    return inputMime;
  }
  return "image/jpeg";
};

const updateFileExtension = (name: string, extension: string): string => {
  const normalizedExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "cover-photo"}${normalizedExtension}`;
};

export type CoverPhotoProcessingOptions = {
  focalX?: number | null;
  focalY?: number | null;
};

export type CoverPhotoProcessingResult = {
  file: File;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasUpscaled: boolean;
};

export const prepareCoverPhotoForUpload = async (
  file: File,
  { focalX = 0.5, focalY = 0.5 }: CoverPhotoProcessingOptions = {},
): Promise<CoverPhotoProcessingResult> => {
  const image = await loadImageFromFile(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error("Invalid image dimensions");
  }

  const normalizedFocalX = clamp(
    Number.isFinite(focalX as number) ? (focalX as number) : 0.5,
    0,
    1,
  );
  const normalizedFocalY = clamp(
    Number.isFinite(focalY as number) ? (focalY as number) : 0.5,
    0,
    1,
  );

  let cropWidth = originalWidth;
  let cropHeight = Math.round(cropWidth / COVER_PHOTO_ASPECT_RATIO);

  if (cropHeight > originalHeight) {
    cropHeight = originalHeight;
    cropWidth = Math.round(cropHeight * COVER_PHOTO_ASPECT_RATIO);
  }

  const halfCropWidth = cropWidth / 2;
  const halfCropHeight = cropHeight / 2;

  const centerX = clamp(
    normalizedFocalX * originalWidth,
    halfCropWidth,
    originalWidth - halfCropWidth,
  );
  const centerY = clamp(
    normalizedFocalY * originalHeight,
    halfCropHeight,
    originalHeight - halfCropHeight,
  );

  const cropX = Math.round(centerX - halfCropWidth);
  const cropY = Math.round(centerY - halfCropHeight);

  let outputWidth = cropWidth;
  let outputHeight = cropHeight;

  if (outputWidth > COVER_PHOTO_RECOMMENDED_WIDTH) {
    const scale = COVER_PHOTO_RECOMMENDED_WIDTH / outputWidth;
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);
  }

  if (outputWidth < COVER_PHOTO_MIN_WIDTH) {
    const scale = COVER_PHOTO_MIN_WIDTH / outputWidth;
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);
  }

  if (outputHeight < COVER_PHOTO_MIN_HEIGHT) {
    const scale = COVER_PHOTO_MIN_HEIGHT / outputHeight;
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);
  }

  outputWidth = Math.max(outputWidth, COVER_PHOTO_MIN_WIDTH);
  outputHeight = Math.round(outputWidth / COVER_PHOTO_ASPECT_RATIO);
  outputHeight = Math.max(outputHeight, COVER_PHOTO_MIN_HEIGHT);
  outputWidth = Math.round(outputHeight * COVER_PHOTO_ASPECT_RATIO);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser");
  }

  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const outputMimeType = selectOutputMimeType(file.type);
  const blob = await toBlob(
    canvas,
    outputMimeType,
    outputMimeType === "image/jpeg" ? 0.92 : undefined,
  );

  const processedFile = new File(
    [blob],
    updateFileExtension(file.name, getExtensionFromMime(outputMimeType)),
    { type: outputMimeType },
  );

  const wasUpscaled = canvas.width > cropWidth || canvas.height > cropHeight;

  return {
    file: processedFile,
    width: canvas.width,
    height: canvas.height,
    originalWidth,
    originalHeight,
    wasUpscaled,
  };
};
