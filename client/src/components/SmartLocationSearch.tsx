import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plane, Globe, Building, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface LocationResult {
  type: 'airport' | 'city' | 'metro' | 'state' | 'country';
  name: string;
  code: string;
  displayName: string;
  country: string;
  state?: string;
  airports?: string[];
  id?: string | number;
  label?: string;
  geonameId?: number | string;
  cityName?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  population?: number | null;
  source?: string;
}

interface SmartLocationSearchProps {
  id?: string;
  placeholder?: string;
  value?: string;
  onLocationSelect: (location: LocationResult) => void;
  className?: string;
}

const SmartLocationSearch = forwardRef<HTMLInputElement, SmartLocationSearchProps>(function SmartLocationSearch({
  id,
  placeholder = "Enter city, airport, or state...",
  value = "",
  onLocationSelect,
  className = ""
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

  // ROOT CAUSE 1 FIX: Sync value prop changes to internal query state
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  useEffect(() => {
    // FIXED: Add null/undefined safety check for query
    if (!query || query.length < 2) {
      setResults([]);
      setSelectedLocation(null);
      setActiveIndex(-1);
      return;
    }

    // Don't search if we have a selected location with the same display name
    if (selectedLocation && selectedLocation.displayName === query) {
      return;
    }

    // Clear selected location when user starts typing again
    if (selectedLocation) {
      setSelectedLocation(null);
    }

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await apiFetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          // ROOT CAUSE 2 FIX: Ensure results is always an array and limit suggestions
          const safeResults = Array.isArray(data) ? data.slice(0, 7) : [];
          setResults(safeResults);
          // Keep dropdown state controlled by user intent
        }
      } catch (error) {
        console.error('Location search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, [query, selectedLocation]);

  const handleLocationClick = (location: LocationResult) => {
    setSelectedLocation(location);
    setQuery(location.displayName);
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
          onChange={(e) => setQuery(e.target.value)}
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
                    name: location.name || "Unknown Location",
                    code: location.code || "N/A",
                    displayName: location.displayName || location.name || "Unknown Location",
                    label: location.label || location.displayName || location.name || "Unknown Location",
                    country: location.country || "Unknown Country",
                    state: location.state,
                    airports: Array.isArray(location.airports) ? location.airports : [],
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
                            <span className="font-medium">{safeLocation.name}</span>
                            <Badge variant="outline" className={getTypeColor(safeLocation.type)}>
                              {safeLocation.type === "metro" ? "metro area" : safeLocation.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {safeLocation.country}
                            {safeLocation.state && safeLocation.state !== safeLocation.country && `, ${safeLocation.state}`}
                            {safeLocation.type === "metro" && safeLocation.airports && (
                              <div className="mt-1 text-xs text-blue-600">
                                Multiple airports: {safeLocation.airports.join(", ")}
                              </div>
                            )}
                          </div>
                          {safeLocation.airports && safeLocation.airports.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              Airports: {safeLocation.airports.slice(0, 3).join(", ")}
                              {safeLocation.airports.length > 3 && ` +${safeLocation.airports.length - 3} more`}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-mono text-gray-600">{safeLocation.code}</div>
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
