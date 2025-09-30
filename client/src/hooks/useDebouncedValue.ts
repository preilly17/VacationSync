import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedValue(value);
    }, Math.max(0, delayMs));

    return () => {
      clearTimeout(handle);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

export default useDebouncedValue;
