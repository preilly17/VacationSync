const BANNER_ASPECT_RATIO = 16 / 9;
const BANNER_TARGET_WIDTH = 1920;
const BANNER_MIN_WIDTH = 1280;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type CropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const computeCropBox = (
  width: number,
  height: number,
  focalX: number,
  focalY: number,
): CropBox => {
  const normalizedFocalX = clamp(focalX, 0, 1);
  const normalizedFocalY = clamp(focalY, 0, 1);

  let cropWidth = width;
  let cropHeight = Math.round(width / BANNER_ASPECT_RATIO);

  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = Math.round(height * BANNER_ASPECT_RATIO);
  }

  cropWidth = Math.min(cropWidth, width);
  cropHeight = Math.min(cropHeight, height);

  const focalXInPixels = normalizedFocalX * width;
  const focalYInPixels = normalizedFocalY * height;

  let left = Math.round(focalXInPixels - cropWidth / 2);
  let top = Math.round(focalYInPixels - cropHeight / 2);

  left = clamp(left, 0, Math.max(0, width - cropWidth));
  top = clamp(top, 0, Math.max(0, height - cropHeight));

  return {
    left,
    top,
    width: Math.max(1, cropWidth),
    height: Math.max(1, cropHeight),
  };
};

const resolveTargetWidth = (cropWidth: number) => {
  if (!Number.isFinite(cropWidth) || cropWidth <= 0) {
    return BANNER_TARGET_WIDTH;
  }
  if (cropWidth >= BANNER_TARGET_WIDTH) {
    return BANNER_TARGET_WIDTH;
  }
  return Math.max(BANNER_MIN_WIDTH, cropWidth);
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event instanceof ErrorEvent ? event.error ?? event : event);
    };
    image.src = url;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const buildOutputFileName = (inputName: string, extension: string) => {
  const base = inputName.replace(/\.[^./]+$/, "");
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${normalized || "cover-photo"}-banner${extension}`;
};

export const createCoverPhotoBannerFile = async (
  file: File,
  focalX: number,
  focalY: number,
): Promise<File> => {
  const image = await loadImageFromFile(file);
  const cropBox = computeCropBox(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    focalX,
    focalY,
  );

  const targetWidth = Math.round(resolveTargetWidth(cropBox.width));
  const targetHeight = Math.max(1, Math.round(targetWidth / BANNER_ASPECT_RATIO));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image");
  }

  context.drawImage(
    image,
    cropBox.left,
    cropBox.top,
    cropBox.width,
    cropBox.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  let blob = await canvasToBlob(canvas, "image/webp", 0.9);
  if (!blob) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  }

  if (!blob) {
    throw new Error("We couldn’t finalize the cover photo. Try a different image.");
  }

  const extension = blob.type === "image/jpeg" ? ".jpg" : ".webp";
  const outputName = buildOutputFileName(file.name, extension);

  return new File([blob], outputName, { type: blob.type });
};
