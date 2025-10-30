// TODO(activities-unification): Remove this feature flag hook once the legacy activity create flow
// is deleted and only the unified implementation remains.
import { useEffect, useState } from "react";

const STORAGE_KEY = "feature:new-activity-create";

export function useNewActivityCreate(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "on") {
        setEnabled(true);
      } else if (stored === "off") {
        setEnabled(false);
      }
    } catch {
      // Ignore storage access issues and keep default
    }
  }, []);

  return enabled;
}

