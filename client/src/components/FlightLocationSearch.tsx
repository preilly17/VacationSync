import { forwardRef, useEffect, useState } from "react";
import SmartLocationSearch, {
  type LocationResult,
} from "@/components/SmartLocationSearch";

interface FlightLocationSearchProps {
  id?: string;
  placeholder?: string;
  value?: string;
  onLocationSelect: (location: LocationResult) => void;
  className?: string;
  onQueryChange?: (value: string) => void;
  allowedTypes?: Array<LocationResult["type"]>;
}

const DEFAULT_ALLOWED_TYPES: Array<LocationResult["type"]> = ["city", "airport"];

const FlightLocationSearch = forwardRef<HTMLInputElement, FlightLocationSearchProps>(
  function FlightLocationSearch(
    {
      id,
      placeholder = "Search city or airport",
      value = "",
      onLocationSelect,
      className = "",
      onQueryChange,
      allowedTypes = DEFAULT_ALLOWED_TYPES,
    },
    ref,
  ) {
    const [query, setQuery] = useState(value);

    useEffect(() => {
      setQuery(value ?? "");
    }, [value]);

    return (
      <SmartLocationSearch
        ref={ref}
        id={id}
        placeholder={placeholder}
        value={query}
        className={className}
        allowedTypes={allowedTypes}
        onQueryChange={(nextValue) => {
          setQuery(nextValue);
          onQueryChange?.(nextValue);
        }}
        onLocationSelect={onLocationSelect}
      />
    );
  },
);

export type { LocationResult };
export default FlightLocationSearch;
