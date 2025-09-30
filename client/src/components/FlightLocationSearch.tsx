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
  /**
   * Legacy prop – accepts comma separated list (e.g. "city,airport")
   */
  types?: string;
  allowedTypes?: Array<LocationResult["type"]>;
}

const DEFAULT_ALLOWED_TYPES: Array<LocationResult["type"]> = ["city", "airport"];

const VALID_ALLOWED_TYPES = new Set<LocationResult["type"]>([
  "airport",
  "city",
  "metro",
  "state",
  "country",
]);

const normalizeAllowedTypes = (
  allowedTypes?: Array<LocationResult["type"]>,
  types?: string,
): Array<LocationResult["type"]> => {
  const parseTypesString = (value?: string): Array<LocationResult["type"]> => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return [];
    }

    return value
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part): part is LocationResult["type"] => VALID_ALLOWED_TYPES.has(part as LocationResult["type"]));
  };

  const normaliseArray = (
    values?: Array<LocationResult["type"]>,
  ): Array<LocationResult["type"]> => {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    return values
      .map((value) => value.toLowerCase() as LocationResult["type"])
      .filter((value): value is LocationResult["type"] => VALID_ALLOWED_TYPES.has(value));
  };

  const fromAllowedTypes = normaliseArray(allowedTypes);
  const fromTypesString = parseTypesString(types);

  const combined = fromAllowedTypes.length > 0
    ? fromAllowedTypes
    : fromTypesString.length > 0
      ? fromTypesString
      : DEFAULT_ALLOWED_TYPES;

  return Array.from(new Set(combined));
};

const FlightLocationSearch = forwardRef<HTMLInputElement, FlightLocationSearchProps>(
  function FlightLocationSearch(
    {
      id,
      placeholder = "Search city or airport",
      value = "",
      onLocationSelect,
      className = "",
      onQueryChange,
      types,
      allowedTypes,
    },
    ref,
  ) {
    const [query, setQuery] = useState(value);
    const normalisedAllowedTypes = normalizeAllowedTypes(allowedTypes, types);

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
        allowedTypes={normalisedAllowedTypes}
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
