import { useEffect, useState } from "react";

export const TRIP_COVER_GRADIENT =
  "linear-gradient(135deg, rgba(255, 126, 95, 0.88), rgba(254, 180, 123, 0.85), rgba(101, 78, 163, 0.85))";

type CoverPhotoSrcSetOptions = {
  full?: string | null | undefined;
  card?: string | null | undefined;
  thumb?: string | null | undefined;
};

export const buildCoverPhotoSrcSet = ({ full, card, thumb }: CoverPhotoSrcSetOptions): string | undefined => {
  const entries: string[] = [];

  if (thumb) {
    entries.push(`${thumb} 256w`);
  }

  if (card) {
    entries.push(`${card} 800w`);
  }

  if (full) {
    entries.push(`${full} 1920w`);
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
