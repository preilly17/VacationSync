import { useEffect, useState } from "react";

const STORAGE_KEY = "feature:new-activity-create";

export function useNewActivityCreate(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "off") {
        setEnabled(false);
      } else if (stored === "on") {
        setEnabled(true);
      }
    } catch {
      // Ignore storage access issues and keep default
    }
  }, []);

  return enabled;
}

