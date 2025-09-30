import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plane, Building } from "lucide-react";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import type { LocationResult } from "@/components/SmartLocationSearch";

interface FlightLocationSearchProps {
  id?: string;
  placeholder?: string;
  value?: string;
  onLocationSelect: (location: LocationResult) => void;
  className?: string;
  onQueryChange?: (value: string) => void;
  types?: string;
}

interface NormalisedSuggestion {
  location: LocationResult;
  label: string;
}

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normaliseSuggestion = (raw: Record<string, any>): NormalisedSuggestion | null => {
  if (!raw) {
    return null;
  }

  const type = typeof raw.type === "string" ? (raw.type.toLowerCase() as LocationResult["type"]) : "city";
  const safeType: LocationResult["type"] =
    type === "airport" || type === "city" || type === "metro" || type === "state" || type === "country"
      ? type
      : "city";

  const name = typeof raw.name === "string" && raw.name.trim().length > 0
    ? raw.name.trim()
    : typeof raw.displayName === "string" && raw.displayName.trim().length > 0
      ? raw.displayName.trim()
      : "";

  if (!name) {
    return null;
  }

  const iataRaw = typeof raw.iata === "string" ? raw.iata : raw.iata_code;
  const iata = typeof iataRaw === "string" && iataRaw.trim().length > 0 ? iataRaw.trim().toUpperCase() : null;
  const icaoRaw = typeof raw.icao === "string" ? raw.icao : raw.icao_code;
  const icao = typeof icaoRaw === "string" && icaoRaw.trim().length > 0 ? icaoRaw.trim().toUpperCase() : null;

  const cityName = typeof raw.cityName === "string" && raw.cityName.trim().length > 0
    ? raw.cityName.trim()
    : typeof raw.municipality === "string" && raw.municipality.trim().length > 0
      ? raw.municipality.trim()
      : null;

  const countryName = typeof raw.countryName === "string" && raw.countryName.trim().length > 0
    ? raw.countryName.trim()
    : typeof raw.country === "string" && raw.country.trim().length > 0
      ? raw.country.trim()
      : null;

  const distanceKm = parseNumber(raw.distanceKm ?? raw.distance_km);
  const latitude = parseNumber(raw.latitude);
  const longitude = parseNumber(raw.longitude);
  const population = parseNumber(raw.population);

  const airportLabelBase = [name, iata ? `(${iata})` : null].filter(Boolean).join(" ");
  const airportDistance = typeof distanceKm === "number" ? ` · ${distanceKm.toFixed(1)} km` : "";
  const airportLabel = `${airportLabelBase}${airportDistance}`;

  const cityLabelParts = [cityName ?? name, countryName].filter((part): part is string => Boolean(part));
  const cityLabel = cityLabelParts.join(", ") || name;

  const label = safeType === "airport" ? airportLabel : cityLabel;

  if (!label) {
    return null;
  }

  const code = typeof raw.code === "string" && raw.code.trim().length > 0
    ? raw.code.trim()
    : iata ?? icao ?? label;

  const location: LocationResult = {
    type: safeType,
    name,
    code,
    displayName: label,
    label,
    country: typeof raw.country === "string" ? raw.country : countryName ?? "",
    state: typeof raw.state === "string" ? raw.state : undefined,
    airports: Array.isArray(raw.airports) ? raw.airports : [],
    id: raw.id ?? raw.geonameId ?? raw.geoname_id ?? code,
    iata,
    icao,
    geonameId: raw.geonameId ?? raw.geoname_id ?? null,
    cityName: cityName ?? (safeType === "city" ? name : null),
    countryName: countryName ?? null,
    latitude,
    longitude,
    population,
    distanceKm,
    source: typeof raw.source === "string" ? raw.source : undefined,
  };

  return { location, label };
};

const FlightLocationSearch = forwardRef<HTMLInputElement, FlightLocationSearchProps>(function FlightLocationSearch({
  id,
  placeholder = "Search city or airport",
  value = "",
  onLocationSelect,
  className = "",
  onQueryChange,
  types = "city,airport",
}, ref) {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<NormalisedSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const [tried, setTried] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debouncedValue = useDebouncedValue(inputValue, 300);
  const apiBase = useMemo(() => (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, ""), []);
  const normalisedTypes = useMemo(() => (types ?? "city,airport").trim() || "city,airport", [types]);
  const enabled = true;
  const debug = true;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    setInputValue(value ?? "");
    if (!value || value.trim().length === 0) {
      setHasSelected(false);
      setTried(false);
      setResults([]);
      setLoading(false);
    }
  }, [value]);

  const mapToOptions = useCallback((data: unknown): NormalisedSuggestion[] => {
    const arrayData = Array.isArray(data) ? data : [];
    return arrayData
      .map((item) => normaliseSuggestion(item))
      .filter((item): item is NormalisedSuggestion => Boolean(item));
  }, []);

  useEffect(() => {
    const q = debouncedValue.trim();

    if (debug) {
      console.debug("[FLS] effect", { q, len: q.length, hasSelected, enabled, types: normalisedTypes });
    }

    if (!enabled) {
      if (debug) console.debug("[FLS] skip: not enabled");
      return;
    }

    if (hasSelected) {
      if (debug) console.debug("[FLS] skip: hasSelected");
      return;
    }

    if (q.length < 2) {
      if (debug) console.debug("[FLS] skip: too short");
      setResults([]);
      setLoading(false);
      setTried(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTried(true);

    const baseUrl = apiBase || "";
    const url = `${baseUrl}/api/locations/search?q=${encodeURIComponent(q)}&types=${encodeURIComponent(normalisedTypes)}`;

    if (debug) {
      console.debug("[FLS] fetching", url);
    }

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setResults(mapToOptions(data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (debug) {
            console.debug("[FLS] fetch error", error);
          }
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase, debouncedValue, enabled, hasSelected, mapToOptions, normalisedTypes, debug]);

  const handleSelect = useCallback(
    (suggestion: NormalisedSuggestion) => {
      setInputValue(suggestion.label);
      setHasSelected(true);
      setIsOpen(false);
      setResults([]);
      setLoading(false);
      setTried(false);
      onQueryChange?.(suggestion.label);
      onLocationSelect(suggestion.location);
      requestAnimationFrame(() => {
        inputRef.current?.blur();
      });
    },
    [onLocationSelect, onQueryChange],
  );

  const getIconForType = (type: LocationResult["type"]) => {
    switch (type) {
      case "airport":
        return <Plane className="h-4 w-4" />;
      case "city":
      case "metro":
        return <Building className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => {
        const nextIndex = results.length === 0 ? -1 : (prev + 1) % results.length;
        return nextIndex;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => {
        if (results.length === 0) {
          return -1;
        }
        const nextIndex = prev <= 0 ? results.length - 1 : prev - 1;
        return nextIndex;
      });
    } else if (event.key === "Enter") {
      if (isOpen && activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setActiveIndex(-1);
  }, [isOpen]);

  const setInputNode = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref && typeof ref === "object") {
      (ref as MutableRefObject<HTMLInputElement | null>).current = node;
    }
  };

  const trimmedValue = inputValue.trim();
  const showNoResults = tried && !loading && results.length === 0 && trimmedValue.length >= 2;
  const shouldShowDropdown = isOpen && (results.length > 0 || loading || showNoResults || trimmedValue.length < 2);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Input
        id={id}
        ref={setInputNode}
        value={inputValue}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          setHasSelected(false);
          setTried(false);
          setIsOpen(true);
          onQueryChange?.(nextValue);
        }}
        onFocus={() => {
          setIsOpen(true);
        }}
        onBlur={() => {
          requestAnimationFrame(() => {
            if (containerRef.current && document.activeElement && !containerRef.current.contains(document.activeElement)) {
              setIsOpen(false);
            }
          });
        }}
        onKeyDown={handleKeyDown}
        className="w-full pr-10"
        aria-autocomplete="list"
        aria-expanded={shouldShowDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        role="combobox"
      />
      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      )}

      {shouldShowDropdown && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto shadow-lg">
          <CardContent className="p-0" role="listbox" id={listboxId}>
            {trimmedValue.length < 2 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">Type at least 2 characters.</div>
            ) : (
              <>
                {results.map((suggestion, index) => (
                  <button
                    type="button"
                    key={`${suggestion.location.type}-${suggestion.location.code}-${index}`}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`flex w-full items-start gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 transition-colors ${
                      index === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="mt-1 text-muted-foreground">{getIconForType(suggestion.location.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{suggestion.label}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {suggestion.location.type === "metro" ? "metro area" : suggestion.location.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {suggestion.location.type === "airport"
                          ? [
                              suggestion.location.cityName,
                              suggestion.location.countryName ?? suggestion.location.country,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : suggestion.location.countryName ?? suggestion.location.country}
                      </div>
                    </div>
                  </button>
                ))}
                {!loading && showNoResults ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No locations found for "{trimmedValue}". Try a different search term.
                  </div>
                ) : null}
                {loading && results.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
                    <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    Loading suggestions...
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

export default FlightLocationSearch;
