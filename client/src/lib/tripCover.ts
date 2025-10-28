import { useEffect, useState } from "react";

import { buildApiUrl } from "@/lib/api";

export const TRIP_COVER_GRADIENT =
  "linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(248, 250, 255, 0.86), rgba(168, 85, 247, 0.88))";

type CoverPhotoSrcSetOptions = {
  full?: string | null | undefined;
  card?: string | null | undefined;
  thumb?: string | null | undefined;
};

export const resolveCoverPhotoUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return buildApiUrl(value);
  }

  return value;
};

export const buildCoverPhotoSrcSet = ({ full, card, thumb }: CoverPhotoSrcSetOptions): string | undefined => {
  const entries: string[] = [];

  const resolvedThumb = resolveCoverPhotoUrl(thumb);
  if (resolvedThumb) {
    entries.push(`${resolvedThumb} 256w`);
  }

  const resolvedCard = resolveCoverPhotoUrl(card);
  if (resolvedCard) {
    entries.push(`${resolvedCard} 800w`);
  }

  const resolvedFull = resolveCoverPhotoUrl(full);
  if (resolvedFull) {
    entries.push(`${resolvedFull} 1920w`);
  }

  return entries.length > 0 ? entries.join(", ") : undefined;
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
