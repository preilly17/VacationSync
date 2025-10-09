import { useEffect, useState } from "react";
import { ensureAbsoluteApiUrl } from "./api";

export const TRIP_COVER_GRADIENT =
  "linear-gradient(135deg, rgba(255, 126, 95, 0.88), rgba(254, 180, 123, 0.85), rgba(101, 78, 163, 0.85))";

type CoverPhotoSrcSetOptions = {
  full?: string | null | undefined;
  card?: string | null | undefined;
  thumb?: string | null | undefined;
};

export const buildCoverPhotoSrcSet = ({ full, card, thumb }: CoverPhotoSrcSetOptions): string | undefined => {
  const entries: string[] = [];

  const thumbUrl = ensureAbsoluteApiUrl(thumb);
  if (thumbUrl) {
    entries.push(`${thumbUrl} 256w`);
  }

  const cardUrl = ensureAbsoluteApiUrl(card);
  if (cardUrl) {
    entries.push(`${cardUrl} 800w`);
  }

  const fullUrl = ensureAbsoluteApiUrl(full);
  if (fullUrl) {
    entries.push(`${fullUrl} 1920w`);
  }

  return entries.length > 0 ? entries.join(", ") : undefined;
};

export const pickCoverPhotoSource = (
  ...candidates: Array<string | null | undefined>
): string | null => {
  for (const candidate of candidates) {
    const resolved = ensureAbsoluteApiUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

type ImageStatus = "idle" | "loaded" | "error";

type CoverPhotoImageState = {
  showImage: boolean;
  isLoaded: boolean;
  handleLoad: () => void;
  handleError: () => void;
};

export const useCoverPhotoImage = (src: string | null | undefined): CoverPhotoImageState => {
  const hasSource = Boolean(src);
  const [status, setStatus] = useState<ImageStatus>(hasSource ? "idle" : "error");

  useEffect(() => {
    setStatus(Boolean(src) ? "idle" : "error");
  }, [src]);

  return {
    showImage: hasSource && status !== "error",
    isLoaded: status === "loaded",
    handleLoad: () => setStatus("loaded"),
    handleError: () => setStatus("error"),
  };
};

export const buildCoverPhotoAltText = (tripName: string): string => `Trip cover photo for ${tripName}`;

export const getCoverPhotoObjectPosition = (
  focalX?: number | null,
  focalY?: number | null,
) => {
  const normalizedX = typeof focalX === "number" ? focalX : 0.5;
  const normalizedY = typeof focalY === "number" ? focalY : 0.5;
  const xPercent = clampPercent(normalizedX * 100);
  const yPercent = clampPercent(normalizedY * 100);
  return `${xPercent}% ${yPercent}%`;
};

const clampPercent = (value: number) => {
  if (Number.isNaN(value)) {
    return 50;
  }
  return Math.min(Math.max(value, 0), 100);
};
