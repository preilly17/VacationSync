// TODO(activities-unification): Remove this feature flag hook once the legacy activity create flow
// is deleted and only the unified implementation remains.
import { useEffect, useState } from "react";

const STORAGE_KEY = "feature:new-activity-create";
const ENVIRONMENT_FLAG = import.meta.env.VITE_ENABLE_NEW_ACTIVITY_CREATE === "true";

export function useNewActivityCreate(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!ENVIRONMENT_FLAG || typeof window === "undefined") {
      setEnabled(false);
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
  }, [ENVIRONMENT_FLAG]);

  return ENVIRONMENT_FLAG && enabled;
}

