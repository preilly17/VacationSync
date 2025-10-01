import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plane, Globe, Building, ChevronDown } from "lucide-react";
import LocationUtils from "@/lib/locationUtils";

type LocationTypeLower = 'airport' | 'city' | 'metro' | 'state' | 'country';
type LocationTypeUpper = Uppercase<LocationTypeLower>;
type LocationType = LocationTypeLower | LocationTypeUpper;

export interface LocationResult {
  type: LocationType;
  name: string;
  code: string;
  displayName: string;
  country: string;
  state?: string;
  airports?: string[];
  id?: string | number;
  label?: string;
  iata?: string | null;
  icao?: string | null;
  geonameId?: number | string;
  cityName?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  population?: number | null;
  distanceKm?: number | null;
  source?: string;
}

const VALID_LOCATION_TYPES: LocationTypeLower[] = [
  'airport',
  'city',
  'metro',
  'state',
  'country',
];

const parseLocationType = (value: unknown): LocationTypeLower | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase() as LocationTypeLower;
  return VALID_LOCATION_TYPES.includes(lower) ? lower : null;
};

const toUpperLocationTypeOrNull = (value: unknown): LocationTypeUpper | null => {
  const parsed = parseLocationType(value);
  return parsed ? (parsed.toUpperCase() as LocationTypeUpper) : null;
};

const toUpperLocationType = (
  value: unknown,
  fallback: LocationTypeUpper = 'CITY',
): LocationTypeUpper => toUpperLocationTypeOrNull(value) ?? fallback;

const toLowerLocationType = (
  value: unknown,
  fallback: LocationTypeLower = 'city',
): LocationTypeLower => parseLocationType(value) ?? fallback;

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toOptionalId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : null))
    .filter((item): item is string => Boolean(item && item.length > 0));
};

const normalizeAllowedTypes = (
  allowedTypes?: Array<LocationResult['type']>,
): Array<LocationTypeUpper> | null => {
  if (!allowedTypes || allowedTypes.length === 0) {
    return null;
  }

  const deduped = Array.from(
    new Set(
      allowedTypes
        .map((type) => toUpperLocationTypeOrNull(type))
        .filter((type): type is LocationTypeUpper => Boolean(type)),
    ),
  );

  return deduped.length > 0 ? deduped : null;
};

const mapToLocationUtilsType = (type: LocationResult['type']): 'AIRPORT' | 'CITY' | 'COUNTRY' => {
  const upperType = toUpperLocationType(type);
  switch (upperType) {
    case 'AIRPORT':
      return 'AIRPORT';
    case 'COUNTRY':
      return 'COUNTRY';
    case 'STATE':
    case 'METRO':
    case 'CITY':
    default:
      return 'CITY';
  }
};

const getLowercaseTypeCandidate = (record: Record<string, unknown>): string | null => {
  const rawType = toTrimmedString(record.type);
  if (rawType) {
    return rawType.toLowerCase();
  }

  const rawSubType = toTrimmedString(record.subType);
  return rawSubType ? rawSubType.toLowerCase() : null;
};

const normalizeFetchedLocation = (rawLocation: unknown): LocationResult | null => {
  if (!rawLocation || typeof rawLocation !== 'object') {
    return null;
  }

  const record = rawLocation as Record<string, unknown>;
  const lowerCaseType = getLowercaseTypeCandidate(record);
  const type = toUpperLocationType(lowerCaseType);

  const rawName = toTrimmedString(record.name);
  const rawDisplayName = toTrimmedString(record.displayName);
  const name = rawName ?? rawDisplayName ?? 'Unknown Location';
  const displayName = rawDisplayName ?? name;
  const label = toTrimmedString(record.label) ?? displayName;

  const rawCountryName = toTrimmedString(record.countryName);
  const rawCountry = toTrimmedString(record.country);
  const countryName = rawCountryName ?? rawCountry ?? null;
  const country = rawCountry ?? countryName ?? 'Unknown Country';

  const cityName = toTrimmedString(record.cityName);
  const state = toTrimmedString(record.state) ?? undefined;

  const airports = toStringArray(record.airports);

  const codeCandidates = [
    record.code,
    record.iata,
    record.iataCode,
    record.icao,
    record.icaoCode,
  ]
    .map((value) => toTrimmedString(value)?.toUpperCase())
    .filter((value): value is string => Boolean(value));

  const iata = [record.iata, record.iataCode]
    .map((value) => toTrimmedString(value)?.toUpperCase())
    .find((value): value is string => Boolean(value)) ?? null;

  const icao = [record.icao, record.icaoCode]
    .map((value) => toTrimmedString(value)?.toUpperCase())
    .find((value): value is string => Boolean(value)) ?? null;

  const code = codeCandidates.length > 0 ? codeCandidates[0] : '';

  const latitude = toFiniteNumber(record.latitude);
  const longitude = toFiniteNumber(record.longitude);
  const population = toFiniteNumber(record.population);
  const distanceKm = toFiniteNumber(record.distanceKm);

  const geonameIdRaw = record.geonameId ?? record.geoNameId ?? record.geoname_id;
  const geonameId =
    typeof geonameIdRaw === 'string'
      ? geonameIdRaw.trim()
      : typeof geonameIdRaw === 'number' && Number.isFinite(geonameIdRaw)
        ? geonameIdRaw
        : undefined;

  const source = toTrimmedString(record.source) ?? undefined;

  return {
    type,
    name,
    code,
    displayName,
    country,
    state,
    airports,
    id: toOptionalId(record.id),
    label,
    iata,
    icao,
    geonameId,
    cityName: cityName ?? null,
    countryName,
    latitude,
    longitude,
    population,
    distanceKm,
    source,
  } satisfies LocationResult;
};

interface SmartLocationSearchProps {
  id?: string;
  placeholder?: string;
  value?: string;
  onLocationSelect: (location: LocationResult) => void;
  className?: string;
  allowedTypes?: Array<LocationResult['type']>;
  onQueryChange?: (value: string) => void;
}

const SmartLocationSearch = forwardRef<HTMLInputElement, SmartLocationSearchProps>(function SmartLocationSearch({
  id,
  placeholder = "Enter city, airport, or state...",
  value = "",
  onLocationSelect,
  className = "",
  allowedTypes,
  onQueryChange,
}, ref) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debounceRef = useRef<NodeJS.Timeout>();
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userInitiatedSearchRef = useRef(false);
  const pendingUserSearchCountRef = useRef(0);
  const isUserEditingRef = useRef(false);
  const initialSelectedQuery = typeof value === "string" ? value.trim() : "";
  const lastSelectedQueryRef = useRef<string | null>(
    initialSelectedQuery.length > 0 ? initialSelectedQuery : null,
  );
  const lastFetchedQueryKeyRef = useRef<string>("");
  const listboxId = useId();
  const hintId = useId();

  const setInputRef = (node: HTMLInputElement | null) => {
    internalInputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      (ref as MutableRefObject<HTMLInputElement | null>).current = node;
    }
  };

  // Sync value prop changes to internal query state without interrupting user edits
  const previousValueRef = useRef(value);
  useEffect(() => {
    if (value === undefined) {
      previousValueRef.current = value;
      return;
    }

    if (value !== previousValueRef.current) {
      const nextValue = value || "";
      setQuery(nextValue);

      const trimmedValue = nextValue.trim();
      lastSelectedQueryRef.current = trimmedValue.length > 0 ? trimmedValue : null;
      isUserEditingRef.current = false;
      lastFetchedQueryKeyRef.current = "";
      previousValueRef.current = value;
    }
  }, [value]);

  const normalisedAllowedTypes = useMemo(
    () => normalizeAllowedTypes(allowedTypes),
    [allowedTypes],
  );

  const allowedTypesKey = useMemo(
    () => (normalisedAllowedTypes ? normalisedAllowedTypes.join(",") : "all"),
    [normalisedAllowedTypes],
  );

  const locationUtilsTypes = useMemo(() => {
    if (!normalisedAllowedTypes) {
      return null;
    }

    const mapped = normalisedAllowedTypes.map((type) => mapToLocationUtilsType(type));
    return Array.from(new Set(mapped));
  }, [normalisedAllowedTypes]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setSelectedLocation(null);
      setActiveIndex(-1);
      pendingUserSearchCountRef.current = 0;
      lastFetchedQueryKeyRef.current = "";
      setIsLoading(false);
      return;
    }

    if (selectedLocation && selectedLocation.displayName === trimmedQuery) {
      return;
    }

    if (!isUserEditingRef.current && lastSelectedQueryRef.current === trimmedQuery) {
      return;
    }

    if (selectedLocation) {
      setSelectedLocation(null);
    }

    debounceRef.current = setTimeout(async () => {
      // Skip if the user has since cleared or changed the input
      const currentQuery = internalInputRef.current?.value?.trim() ?? "";
      if (currentQuery.length < 2) {
        return;
      }

      if (!isUserEditingRef.current && lastSelectedQueryRef.current === currentQuery) {
        return;
      }

      const currentSearchKey = `${currentQuery}|${allowedTypesKey}`;

      if (lastFetchedQueryKeyRef.current === currentSearchKey) {
        return;
      }

      const shouldShowLoadingIndicator = userInitiatedSearchRef.current;

      if (shouldShowLoadingIndicator) {
        pendingUserSearchCountRef.current += 1;
        setIsLoading(true);
        userInitiatedSearchRef.current = false;
      }

      try {
        const normalizedTypesForSearch = locationUtilsTypes?.map((type) => type.toUpperCase());

        console.log(
          "🔎 Sending search with query:",
          currentQuery,
          "types:",
          normalizedTypesForSearch,
        );

        const rawResults = await LocationUtils.searchLocations({
          query: currentQuery,
          limit: 7,
          ...(normalizedTypesForSearch ? { types: normalizedTypesForSearch } : {}),
        });

        console.log("🔎 SmartLocationSearch: rawResults from API", rawResults);
        console.log("🔎 Query:", currentQuery, "Allowed types:", locationUtilsTypes);

        const safeResults = Array.isArray(rawResults) ? rawResults.slice(0, 7) : [];
        const processedResults = safeResults.reduce<
          Array<{ normalized: LocationResult; typeForFilter: LocationTypeUpper }>
        >(
          (accumulator, rawLocation) => {
            const normalized = normalizeFetchedLocation(rawLocation);
            if (!normalized) {
              console.log("⚠️ Skipped rawLocation", rawLocation);
              return accumulator;
            }

            console.log("✅ Normalized result:", normalized);

            let typeForFilter = toUpperLocationType(normalized.type);

            const rawRecord = rawLocation as unknown;
            if (rawRecord && typeof rawRecord === 'object') {
              const candidate = getLowercaseTypeCandidate(rawRecord as Record<string, unknown>);
              const candidateUpper = candidate ? toUpperLocationTypeOrNull(candidate) : null;
              if (candidateUpper) {
                typeForFilter = candidateUpper;
              }
            }

            const normalizedWithUppercaseType = {
              ...normalized,
              type: typeForFilter,
            } as LocationResult;

            accumulator.push({ normalized: normalizedWithUppercaseType, typeForFilter });
            return accumulator;
          },
          [],
        );

        const filteredResults = normalisedAllowedTypes
          ? processedResults.filter(({ typeForFilter }) => {
              return normalisedAllowedTypes.includes(typeForFilter);
            })
          : processedResults;

        console.log("📊 Processed results before filtering:", processedResults);
        console.log("📊 Filtered results (by allowedTypes):", filteredResults);

        setResults(
          filteredResults.map(({ normalized, typeForFilter }) => ({
            ...normalized,
            type: typeForFilter,
          })),
        );
        lastFetchedQueryKeyRef.current = currentSearchKey;
      } catch (error) {
        console.error('Location search error:', error);
        setResults([]);
        lastFetchedQueryKeyRef.current = "";
      } finally {
        if (shouldShowLoadingIndicator) {
          pendingUserSearchCountRef.current = Math.max(0, pendingUserSearchCountRef.current - 1);
          if (pendingUserSearchCountRef.current === 0) {
            setIsLoading(false);
          }
        }
      }
    }, 300);
  }, [
    query,
    selectedLocation,
    normalisedAllowedTypes,
    allowedTypesKey,
    locationUtilsTypes,
  ]);

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const handleLocationClick = (location: LocationResult) => {
    pendingUserSearchCountRef.current = 0;
    userInitiatedSearchRef.current = false;
    isUserEditingRef.current = false;
    lastFetchedQueryKeyRef.current = "";
    setIsLoading(false);
    setSelectedLocation(location);
    const displayValue = location.displayName.trim();
    lastSelectedQueryRef.current = displayValue.length > 0 ? displayValue : null;
    setQuery(displayValue);
    onQueryChange?.(displayValue);
    setIsDropdownOpen(false);
    setResults([]); // Clear results to prevent "No locations found" message
    setActiveIndex(-1);
    const result = location;
    console.log("🧩 SmartLocationSearch: normalized result", result);
    onLocationSelect(result);
  };

  const getLocationIcon = (type: LocationResult['type']) => {
    switch (toLowerLocationType(type)) {
      case 'airport': return <Plane className="w-4 h-4" />;
      case 'city': return <Building className="w-4 h-4" />;
      case 'metro': return <Building className="w-4 h-4" />;
      case 'state': return <MapPin className="w-4 h-4" />;
      case 'country': return <Globe className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: LocationResult['type']) => {
    switch (toLowerLocationType(type)) {
      case 'airport': return 'bg-blue-100 text-blue-800';
      case 'city': return 'bg-green-100 text-green-800';
      case 'metro': return 'bg-cyan-100 text-cyan-800';
      case 'state': return 'bg-purple-100 text-purple-800';
      case 'country': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const openDropdown = () => {
    setIsDropdownOpen(true);
  };

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (activeIndex >= results.length) {
      setActiveIndex(results.length > 0 ? results.length - 1 : -1);
    }
  }, [activeIndex, results.length]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setIsDropdownOpen(false);
      setResults([]);
      setActiveIndex(-1);
    }
  }, [query]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isDropdownOpen) {
        openDropdown();
        setActiveIndex(results.length > 0 ? 0 : -1);
        return;
      }

      setActiveIndex((prev) => {
        const nextIndex = results.length === 0 ? -1 : (prev + 1) % results.length;
        return nextIndex;
      });
    } else if (event.key === "ArrowUp" && isDropdownOpen) {
      event.preventDefault();
      setActiveIndex((prev) => {
        if (results.length === 0) return -1;
        const nextIndex = prev <= 0 ? results.length - 1 : prev - 1;
        return nextIndex;
      });
    } else if (event.key === "Enter") {
      if (isDropdownOpen) {
        if (activeIndex >= 0 && results[activeIndex]) {
          event.preventDefault();
          handleLocationClick(results[activeIndex]);
          return;
        }
        closeDropdown();
      }
    } else if (event.key === "Escape" && isDropdownOpen) {
      event.preventDefault();
      closeDropdown();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (isDropdownOpen) {
        closeDropdown();
      } else {
        openDropdown();
        setActiveIndex(results.length > 0 ? 0 : -1);
      }
    }
  };

  const handleBlur = () => {
    // Delay closing to allow click events on suggestions
    requestAnimationFrame(() => {
      if (containerRef.current && document.activeElement && !containerRef.current.contains(document.activeElement)) {
        closeDropdown();
      }
    });
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          id={id}
          ref={setInputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            const newValue = event.target.value;
            setQuery(newValue);
            isUserEditingRef.current = true;
            lastSelectedQueryRef.current = null;
            lastFetchedQueryKeyRef.current = "";
            userInitiatedSearchRef.current = true;
            onQueryChange?.(newValue);

            if (newValue.trim().length > 0) {
              setIsDropdownOpen(true);
            } else {
              setIsDropdownOpen(false);
              setResults([]);
              setActiveIndex(-1);
              pendingUserSearchCountRef.current = 0;
              userInitiatedSearchRef.current = false;
              setIsLoading(false);
            }
          }}
          className="w-full pr-10"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isDropdownOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-describedby={hintId}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-1 my-1 h-7 w-7"
          aria-label={isDropdownOpen ? "Hide suggestions" : "Show suggestions"}
          onClick={() => {
            if (isDropdownOpen) {
              closeDropdown();
            } else {
              openDropdown();
              setActiveIndex(results.length > 0 ? 0 : -1);
              internalInputRef.current?.focus();
            }
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        {isLoading && (
          <div className="pointer-events-none absolute right-10 top-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      <p id={hintId} className="mt-1 hidden text-xs text-muted-foreground sm:block">
        Press ↓ to see suggestions
      </p>

      {isDropdownOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto shadow-lg">
          <CardContent className="p-0" role="listbox" id={listboxId} aria-label="Location suggestions">
            {query.length < 2 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Type at least 2 characters to load suggestions.
              </div>
            ) : (
              <>
                {isLoading && results.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
                    <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    Loading suggestions...
                  </div>
                ) : null}
                {!isLoading && results.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No locations found for "{query}". Try a different search term.
                  </div>
                ) : null}
                {results.map((rawLocation, index) => {
                  console.log("🎨 Rendering result:", rawLocation);
                  if (!rawLocation || typeof rawLocation !== "object") {
                    return null;
                  }

                  const normalizedType = toUpperLocationType(rawLocation.type);
                  const location: LocationResult = {
                    ...rawLocation,
                    type: normalizedType,
                  };
                  const displayType = toLowerLocationType(normalizedType);

                  const isActive = index === activeIndex;

                  return (
                    <div
                      key={`${displayType}-${location.code}-${index}`}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                      className={`flex cursor-pointer items-center gap-3 border-b p-3 last:border-b-0 transition-colors ${
                        isActive ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onMouseDown={(event) => {
                        // Prevent blur before click handler executes
                        event.preventDefault();
                      }}
                      onClick={() => handleLocationClick(location)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        {getLocationIcon(location.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{location.displayName}</span>
                            <Badge variant="outline" className={getTypeColor(location.type)}>
                              {displayType === "metro" ? "metro area" : displayType}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {displayType === "airport"
                              ? [location.cityName, location.countryName ?? location.country]
                                  .filter(Boolean)
                                  .join(", ")
                              : location.countryName ?? location.country}
                            {displayType === "metro" && location.airports && (
                              <div className="mt-1 text-xs text-blue-600">
                                Multiple airports: {location.airports.join(", ")}
                              </div>
                            )}
                          </div>
                          {displayType === "city" && location.airports && location.airports.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              Airports: {location.airports.slice(0, 3).join(", ")}
                              {location.airports.length > 3 && ` +${location.airports.length - 3} more`}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-mono text-gray-600">
                          {location.iata ?? location.code}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

export default SmartLocationSearch;
