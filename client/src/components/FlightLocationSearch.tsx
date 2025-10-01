import { forwardRef, useEffect, useMemo, useState } from "react";
import SmartLocationSearch, {
  type LocationResult,
} from "@/components/SmartLocationSearch";

type LocationType = LocationResult["type"];

interface FlightLocationSearchProps {
  id?: string;
  placeholder?: string;
  value?: string;
  onLocationSelect: (location: LocationResult) => void;
  className?: string;
  onQueryChange?: (value: string) => void;
  /**
   * Preferred search types when looking up cities.
   * Defaults to ["city"].
   */
  types?: string;
  allowedTypes?: Array<LocationType>;
}

const CITY_SEARCH_TYPES: LocationType[] = ["city"];
const AIRPORT_SEARCH_TYPES: LocationType[] = ["airport"];
const VALID_TYPES = new Set<LocationType>([
  "airport",
  "city",
  "metro",
  "state",
  "country",
]);

const IATA_PATTERN = /^[A-Za-z]{3}$/;

const parseTypes = (value?: string): LocationType[] => {
  if (!value) {
    return CITY_SEARCH_TYPES;
  }

  const parsed = value
    .split(",")
    .map((type) => type.trim().toLowerCase())
    .filter((type): type is LocationType => VALID_TYPES.has(type as LocationType));

  if (parsed.length === 0) {
    return CITY_SEARCH_TYPES;
  }

  return parsed;
};

const normalizeAllowedTypes = (values?: Array<LocationType>): LocationType[] => {
  if (!values || values.length === 0) {
    return [];
  }

  const normalized = values
    .map((value) => (value || "").toString().trim().toLowerCase())
    .filter((value): value is LocationType => VALID_TYPES.has(value as LocationType));

  return Array.from(new Set(normalized));
};

const resolveBaseTypes = (
  allowedTypes?: Array<LocationType>,
  legacyTypes?: string,
): LocationType[] => {
  const normalizedAllowed = normalizeAllowedTypes(allowedTypes);
  if (normalizedAllowed.length > 0) {
    return normalizedAllowed;
  }

  const parsedLegacy = parseTypes(legacyTypes);
  if (parsedLegacy.length > 0) {
    return parsedLegacy;
  }

  return CITY_SEARCH_TYPES;
};

const shouldUseAirportSearch = (query: string): boolean => {
  if (!query) {
    return false;
  }

  const normalised = query.trim();
  if (normalised.length === 0) {
    return false;
  }

  const upper = normalised.toUpperCase();
  if (IATA_PATTERN.test(upper)) {
    return true;
  }

  return normalised.toLowerCase().includes("airport");
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

    useEffect(() => {
      setQuery(value ?? "");
    }, [value]);

    const baseTypes = useMemo(
      () => resolveBaseTypes(allowedTypes, types),
      [allowedTypes, types],
    );

    const activeTypes = useMemo(() => {
      return shouldUseAirportSearch(query) ? AIRPORT_SEARCH_TYPES : baseTypes;
    }, [baseTypes, query]);

    return (
      <SmartLocationSearch
        ref={ref}
        id={id}
        placeholder={placeholder}
        value={query}
        className={className}
        allowedTypes={activeTypes}
        onQueryChange={(nextValue) => {
          setQuery(nextValue);
          onQueryChange?.(nextValue);
        }}
        onLocationSelect={(result) => {
          console.log("✈️ FlightLocationSearch: selected result", result);
          onLocationSelect(result);
        }}
      />
    );
  },
);

export type { LocationResult };
export default FlightLocationSearch;
