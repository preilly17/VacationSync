import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plane, Globe, Building, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";

export interface LocationResult {
  type: 'airport' | 'city' | 'metro' | 'state' | 'country';
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

const VALID_LOCATION_TYPES: Array<LocationResult['type']> = [
  'airport',
  'city',
  'metro',
  'state',
  'country',
];

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

  const normalisedAllowedTypes = allowedTypes && allowedTypes.length > 0
    ? Array.from(
        new Set(
          allowedTypes.filter((type): type is LocationResult['type'] =>
            VALID_LOCATION_TYPES.includes(type),
          ),
        ),
      )
    : null;

  const buildSearchUrl = (searchQuery: string) => {
    const params = new URLSearchParams({ q: searchQuery });
    if (normalisedAllowedTypes) {
      params.set('types', normalisedAllowedTypes.join(','));
    }
    return `/api/locations/search?${params.toString()}`;
  };

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

      const currentAllowedTypesKey = normalisedAllowedTypes?.join(",") ?? "all";
      const currentSearchKey = `${currentQuery}|${currentAllowedTypesKey}`;

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
        const response = await apiFetch(buildSearchUrl(currentQuery));
        if (response.ok) {
          const data = await response.json();
          // ROOT CAUSE 2 FIX: Ensure results is always an array and limit suggestions
          const safeResults = Array.isArray(data) ? data.slice(0, 7) : [];
          const filteredResults = normalisedAllowedTypes
            ? safeResults.filter((location) => normalisedAllowedTypes.includes(location.type))
            : safeResults;
          setResults(filteredResults);
          lastFetchedQueryKeyRef.current = currentSearchKey;
          // Keep dropdown state controlled by user intent
        } else {
          lastFetchedQueryKeyRef.current = "";
        }
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
  }, [query, selectedLocation, normalisedAllowedTypes]);

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
    onLocationSelect(location);
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'airport': return <Plane className="w-4 h-4" />;
      case 'city': return <Building className="w-4 h-4" />;
      case 'metro': return <Building className="w-4 h-4" />;
      case 'state': return <MapPin className="w-4 h-4" />;
      case 'country': return <Globe className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
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
                {results.map((location, index) => {
                  if (!location || typeof location !== "object") {
                    return null;
                  }

                  const safeLocation = {
                    ...location,
                    type: location.type || "city",
                    name: location.name || location.displayName || "Unknown Location",
                    code: location.code || location.iata || location.icao || "N/A",
                    displayName: location.displayName || location.name || "Unknown Location",
                    label: location.label || location.displayName || location.name || "Unknown Location",
                    country: location.country || location.countryName || "Unknown Country",
                    countryName:
                      typeof location.countryName === "string" && location.countryName.length > 0
                        ? location.countryName
                        : typeof location.country === "string" && location.country.length > 0
                          ? location.country
                          : null,
                    cityName:
                      typeof location.cityName === "string" && location.cityName.length > 0
                        ? location.cityName
                        : null,
                    state: location.state,
                    airports: Array.isArray(location.airports) ? location.airports : [],
                    iata:
                      typeof location.iata === "string" && location.iata.trim().length > 0
                        ? location.iata.trim().toUpperCase()
                        : null,
                    icao:
                      typeof location.icao === "string" && location.icao.trim().length > 0
                        ? location.icao.trim().toUpperCase()
                        : null,
                    distanceKm:
                      typeof location.distanceKm === "number" && Number.isFinite(location.distanceKm)
                        ? location.distanceKm
                        : null,
                  } satisfies LocationResult;

                  const isActive = index === activeIndex;

                  return (
                    <div
                      key={`${safeLocation.type}-${safeLocation.code}-${index}`}
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
                      onClick={() => handleLocationClick(safeLocation)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        {getLocationIcon(safeLocation.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{safeLocation.displayName}</span>
                            <Badge variant="outline" className={getTypeColor(safeLocation.type)}>
                              {safeLocation.type === "metro" ? "metro area" : safeLocation.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {safeLocation.type === "airport"
                              ? [safeLocation.cityName, safeLocation.countryName ?? safeLocation.country]
                                  .filter(Boolean)
                                  .join(", ")
                              : safeLocation.countryName ?? safeLocation.country}
                            {safeLocation.type === "metro" && safeLocation.airports && (
                              <div className="mt-1 text-xs text-blue-600">
                                Multiple airports: {safeLocation.airports.join(", ")}
                              </div>
                            )}
                          </div>
                          {safeLocation.type === "city" && safeLocation.airports && safeLocation.airports.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              Airports: {safeLocation.airports.slice(0, 3).join(", ")}
                              {safeLocation.airports.length > 3 && ` +${safeLocation.airports.length - 3} more`}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-mono text-gray-600">
                          {safeLocation.iata ?? safeLocation.code}
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
