import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, MapPin, Plane, Building, Globe, X, Star, Clock, DollarSign } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface LocationResult {
  id: string;
  name: string;
  type: 'AIRPORT' | 'CITY' | 'COUNTRY';
  iataCode?: string;
  icaoCode?: string;
  cityCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  detailedName: string;
  relevance: number;
  displayName: string;
  region?: string;
  timeZone?: string;
  currencyCode?: string;
  isPopular: boolean;
  alternativeNames: string[];
  code?: string;
  label?: string;
  cityName?: string | null;
  countryName?: string | null;
  country?: string | null;
  airports?: string[];
  distanceKm?: number | null;
}

export interface LocationSearchProps {
  value?: LocationResult | null;
  onChange?: (location: LocationResult | null) => void;
  placeholder?: string;
  type?: 'AIRPORT' | 'CITY' | 'COUNTRY';
  className?: string;
  disabled?: boolean;
  showClearButton?: boolean;
  showPopularDestinations?: boolean;
  showRegionalGroups?: boolean;
  showMultipleAirports?: boolean;
  maxResults?: number;
}

const determineSearchType = (
  query: string,
  preferredType?: LocationSearchProps["type"],
): LocationSearchProps["type"] | undefined => {
  if (!preferredType) {
    return undefined;
  }

  if (preferredType === 'CITY') {
    const trimmed = query.trim();
    if (/^[a-z]{3}$/i.test(trimmed)) {
      return 'AIRPORT';
    }
  }

  return preferredType;
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toUpper = (value?: string): string | undefined =>
  value ? value.toUpperCase() : undefined;

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .flatMap((entry) => toStringArray(entry))
      .filter((entry, index, array) => array.indexOf(entry) === index);
  }

  return [];
};

const inferCityNameFromDetailedName = (detailedName?: string): string | undefined => {
  if (!detailedName) {
    return undefined;
  }

  const parts = detailedName
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return undefined;
  }

  return parts[0];
};

const inferCountryNameFromDetailedName = (detailedName?: string): string | undefined => {
  if (!detailedName) {
    return undefined;
  }

  const parts = detailedName
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 2) {
    return undefined;
  }

  return parts[parts.length - 1];
};

const normalizeLocationResult = (raw: unknown): LocationResult | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;

  const typeCandidate = coerceString(record.type) ?? coerceString(record.subType);
  const rawType = typeCandidate ? typeCandidate.toUpperCase() : 'CITY';
  const normalizedType = (rawType === 'AIRPORTS' ? 'AIRPORT' : rawType) as LocationResult["type"];

  const name =
    coerceString(record.name) ||
    coerceString(record.cityName) ||
    coerceString(record.city_name) ||
    coerceString(record.displayName) ||
    coerceString(record.display_name);

  if (!name) {
    return null;
  }

  const displayName =
    coerceString(record.displayName) ||
    coerceString(record.display_name) ||
    coerceString(record.label) ||
    name;

  const detailedName =
    coerceString(record.detailedName) ||
    coerceString(record.detailed_name) ||
    displayName;

  const iataCode = toUpper(
    coerceString(record.iataCode) ||
    coerceString(record.iata) ||
    coerceString(record.code),
  );
  const icaoCode = toUpper(coerceString(record.icaoCode) || coerceString(record.icao));
  const cityCode = toUpper(coerceString(record.cityCode) || coerceString(record.city_code));
  const countryCode = toUpper(
    coerceString(record.countryCode) ||
    coerceString(record.country_code) ||
    (coerceString(record.country) && coerceString(record.country)!.length === 2
      ? coerceString(record.country)
      : undefined),
  );

  const code =
    toUpper(coerceString(record.code)) ||
    iataCode ||
    icaoCode ||
    cityCode ||
    undefined;

  const latitude = coerceNumber(record.latitude);
  const longitude = coerceNumber(record.longitude);
  const relevance = coerceNumber(record.relevance) ?? 0;
  const region =
    coerceString(record.region) ||
    coerceString(record.state) ||
    coerceString(record.stateCode) ||
    coerceString(record.state_code);
  const timeZone =
    coerceString(record.timeZone) ||
    coerceString(record.timezone) ||
    coerceString(record.time_zone);
  const currencyCode = toUpper(
    coerceString(record.currencyCode) ||
    coerceString(record.currency_code) ||
    coerceString(record.currency),
  );
  const isPopular = typeof record.isPopular === 'boolean' ? record.isPopular : Boolean(record.popular);
  const distanceKm = coerceNumber(record.distanceKm) ?? coerceNumber(record.distance_km) ?? null;

  const rawCityName = coerceString(record.cityName) ?? coerceString(record.city_name);
  const rawCountryName =
    coerceString(record.countryName) ??
    coerceString(record.country_name) ??
    coerceString(record.country);

  const alternativeNames = [
    ...toStringArray(record.alternativeNames ?? record.alternative_names ?? record.keywords ?? []),
    coerceString(record.label),
    displayName,
    detailedName,
    iataCode,
    icaoCode,
    cityCode,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .reduce<string[]>((accumulator, entry) => {
      if (!accumulator.includes(entry)) {
        accumulator.push(entry);
      }
      return accumulator;
    }, []);

  const airports = toStringArray(record.airports);

  const id =
    coerceString(record.id) ||
    code ||
    iataCode ||
    icaoCode ||
    cityCode ||
    name;

  const inferredCityName =
    rawCityName ??
    (normalizedType === 'CITY' ? name : inferCityNameFromDetailedName(detailedName));
  const inferredCountryName = rawCountryName ?? inferCountryNameFromDetailedName(detailedName);

  return {
    id,
    name,
    type: normalizedType,
    iataCode,
    icaoCode,
    cityCode,
    countryCode,
    latitude,
    longitude,
    detailedName,
    relevance,
    displayName,
    region,
    timeZone,
    currencyCode,
    isPopular,
    alternativeNames,
    code: code ?? id,
    label: coerceString(record.label),
    cityName: inferredCityName ?? null,
    countryName: inferredCountryName ?? null,
    country: (rawCountryName ?? inferredCountryName ?? countryCode) ?? null,
    airports,
    distanceKm,
  };
};

const fetchLocations = async (
  query: string,
  options: {
    type?: LocationSearchProps["type"];
    limit: number;
    useApi?: boolean;
  },
): Promise<LocationResult[]> => {
  const payload: Record<string, unknown> = {
    query,
    limit: options.limit,
    useApi: options.useApi ?? true,
  };

  const searchType = determineSearchType(query, options.type);
  const typeParam = searchType ? searchType.toUpperCase() : undefined;
  if (typeParam) {
    payload.type = typeParam;
  }

  const response = await apiFetch('/api/locations/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Location search failed (${response.status})`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => normalizeLocationResult(item))
    .filter((item): item is LocationResult => Boolean(item));
};

const mergeWithAdditionalAirports = async (
  results: LocationResult[],
  maxAirportsPerCity = 3,
) => {
  const enhancedResults: LocationResult[] = [];

  for (const result of results) {
    enhancedResults.push(result);

    if (result.type && result.type.toUpperCase() === 'CITY') {
      try {
        const airports = await fetchLocations(result.name, {
          type: 'AIRPORT',
          limit: 5,
          useApi: true,
        });

        for (const airport of airports.slice(0, maxAirportsPerCity)) {
          if (!enhancedResults.find((existing) => existing.id === airport.id)) {
            enhancedResults.push(airport);
          }
        }
      } catch (error) {
        console.error('Failed to find airports for city:', result.name, error);
      }
    }
  }

  return enhancedResults;
};

const fetchPopularDestinations = async (
  type: LocationSearchProps["type"] | undefined,
  limit: number,
) => fetchLocations('popular', { type, limit, useApi: false });

const LocationSearch = forwardRef<HTMLInputElement, LocationSearchProps>(function LocationSearch({
  value = null,
  onChange,
  placeholder = 'Search for a location...',
  type,
  className = '',
  disabled = false,
  showClearButton = true,
  showPopularDestinations = false,
  showRegionalGroups = false,
  showMultipleAirports = true,
  maxResults = 10
}, ref) {
  const [query, setQuery] = useState(value?.name || '');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(value);
  const [popularDestinations, setPopularDestinations] = useState<LocationResult[]>([]);
  const [regionalGroups, setRegionalGroups] = useState<Record<string, LocationResult[]>>({});
  const [showingPopular, setShowingPopular] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useImperativeHandle(ref, () => inputRef.current!);

  // Initialize selected location from value
  useEffect(() => {
    if (value) {
      const hasChanged = selectedLocation?.id !== value.id;
      if (hasChanged) {
        setSelectedLocation(value);
        setQuery(value.displayName || value.name || '');
      }
    } else if (!value && selectedLocation) {
      setSelectedLocation(null);
      setQuery('');
    }
  }, [value, selectedLocation]);

  // Load popular destinations when component mounts
  useEffect(() => {
    if (showPopularDestinations) {
      loadPopularDestinations();
    }
  }, [showPopularDestinations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPopularDestinations = async () => {
    try {
      const results = await fetchPopularDestinations(type, 20);
      const popular = results.filter((r: LocationResult) => r.isPopular);
      setPopularDestinations(popular);

      // Group by region if requested
      if (showRegionalGroups) {
        const groups: Record<string, LocationResult[]> = {};
        popular.forEach((location: LocationResult) => {
          const region = location.region || 'Other';
          if (!groups[region]) {
            groups[region] = [];
          }
          groups[region].push(location);
        });
        setRegionalGroups(groups);
      }
    } catch (error) {
      console.error('Failed to load popular destinations:', error);
    }
  };

  const searchLocations = async (searchQuery: string, isInitial = false) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowingPopular(false);
      if (showPopularDestinations && !isInitial) {
        setShowingPopular(true);
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
      return;
    }

    setLoading(true);
    setShowingPopular(false);
    
    try {
      const searchResults = await fetchLocations(searchQuery, {
        type,
        limit: maxResults,
        useApi: true,
      });

      let processedResults = searchResults;
      if (showMultipleAirports) {
        processedResults = await mergeWithAdditionalAirports(searchResults);
      }

      setResults(processedResults);

      // If this is initial load and we have an exact match, select it
      if (isInitial && searchResults.length > 0) {
        const exactMatch = searchResults.find((r: LocationResult) => {
          const loweredQuery = searchQuery.toLowerCase();
          return (
            r.name.toLowerCase() === loweredQuery ||
            r.displayName.toLowerCase() === loweredQuery ||
            r.iataCode?.toLowerCase() === loweredQuery ||
            r.icaoCode?.toLowerCase() === loweredQuery ||
            r.code?.toLowerCase() === loweredQuery
          );
        });

        if (exactMatch) {
          setSelectedLocation(exactMatch);
          onChange?.(exactMatch);
        }
      }

      if (!isInitial) {
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Location search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Clear selection if user is typing
    if (selectedLocation) {
      setSelectedLocation(null);
      onChange?.(null);
    }
    
    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchLocations(newQuery);
    }, 200); // Faster debounce for better UX
  };

  const handleSelectLocation = (location: LocationResult) => {
    setSelectedLocation(location);
    setQuery(location.displayName);
    setIsOpen(false);
    setShowingPopular(false);
    onChange?.(location);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedLocation(null);
    setResults([]);
    setShowingPopular(false);
    setIsOpen(false);
    onChange?.(null);
    inputRef.current?.focus();
  };

  const getTypeIcon = (locationType: string) => {
    switch (locationType) {
      case 'AIRPORT': return <Plane className="w-4 h-4 text-blue-500" />;
      case 'CITY': return <Building className="w-4 h-4 text-green-500" />;
      case 'COUNTRY': return <Globe className="w-4 h-4 text-purple-500" />;
      default: return <MapPin className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (locationType: string) => {
    switch (locationType) {
      case 'AIRPORT': return 'bg-blue-100 text-blue-800';
      case 'CITY': return 'bg-green-100 text-green-800';
      case 'COUNTRY': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : (
            <Search className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-10 ${showClearButton && (query || selectedLocation) ? 'pr-10' : ''}`}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            } else if (showPopularDestinations && popularDestinations.length > 0 && !query.trim() && !selectedLocation) {
              setShowingPopular(true);
              setIsOpen(true);
            }
            // Don't clear selected location on focus - let user manually clear if needed
          }}
        />
        
        {showClearButton && (query || selectedLocation) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
            onClick={handleClear}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Selected location display - only show when dropdown is closed */}
      {selectedLocation && !isOpen && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-2">
            {getTypeIcon(selectedLocation.type)}
            <span className="font-medium">{selectedLocation.name}</span>
            <Badge className={getTypeColor(selectedLocation.type)}>
              {selectedLocation.type}
            </Badge>
            {selectedLocation.iataCode && (
              <Badge variant="outline">{selectedLocation.iataCode}</Badge>
            )}
            {selectedLocation.countryCode && (
              <Badge variant="outline">{selectedLocation.countryCode}</Badge>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {selectedLocation.detailedName}
          </div>
        </div>
      )}

      {/* Search results dropdown */}
      {isOpen && !showingPopular && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-[9999] max-h-80 overflow-y-auto shadow-lg border bg-white" onMouseDown={(e) => e.stopPropagation()}>
          <CardContent className="p-0">
            {results.map((result, index) => (
              <div key={`${result.id}-${index}`}>
                <div
                  className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelectLocation(result); }}
                >
                  <div className="flex items-center gap-3">
                    {getTypeIcon(result.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.displayName}</span>
                        {result.isPopular && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{result.detailedName}</div>
                      {result.alternativeNames.length > 0 && (
                        <div className="text-xs text-gray-500">
                          Also known as: {result.alternativeNames.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor(result.type)}>
                      {result.type}
                    </Badge>
                    
                    {result.iataCode && (
                      <Badge variant="outline">{result.iataCode}</Badge>
                    )}
                    
                    {result.icaoCode && (
                      <Badge variant="outline">{result.icaoCode}</Badge>
                    )}
                    
                    {result.cityCode && (
                      <Badge variant="outline">{result.cityCode}</Badge>
                    )}
                    
                    {result.countryCode && (
                      <Badge variant="outline">{result.countryCode}</Badge>
                    )}
                    
                    {result.region && (
                      <Badge variant="secondary" className="text-xs">
                        {result.region}
                      </Badge>
                    )}
                    
                    {result.timeZone && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {result.timeZone.split('/').pop()}
                      </Badge>
                    )}
                    
                    {result.currencyCode && (
                      <Badge variant="outline" className="text-xs">
                        <DollarSign className="w-3 h-3 mr-1" />
                        {result.currencyCode}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Popular destinations dropdown */}
      {isOpen && showingPopular && popularDestinations.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto">
          <CardContent className="p-0">
            <div className="p-3 bg-gray-50 border-b">
              <div className="text-sm font-medium text-gray-700">Popular Destinations</div>
            </div>
            
            {showRegionalGroups ? (
              Object.entries(regionalGroups).map(([region, locations]) => (
                <div key={region}>
                  <div className="p-2 bg-gray-100 border-b">
                    <div className="text-xs font-medium text-gray-600">{region}</div>
                  </div>
                  {locations.map((location) => (
                    <div
                      key={location.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => handleSelectLocation(location)}
                    >
                      <div className="flex items-center gap-3">
                        {getTypeIcon(location.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{location.displayName}</span>
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          </div>
                          <div className="text-sm text-gray-600">{location.detailedName}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getTypeColor(location.type)}>
                          {location.type}
                        </Badge>
                        
                        {location.iataCode && (
                          <Badge variant="outline">{location.iataCode}</Badge>
                        )}
                        
                        {location.currencyCode && (
                          <Badge variant="outline" className="text-xs">
                            {location.currencyCode}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              popularDestinations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleSelectLocation(location)}
                >
                  <div className="flex items-center gap-3">
                    {getTypeIcon(location.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{location.displayName}</span>
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      </div>
                      <div className="text-sm text-gray-600">{location.detailedName}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor(location.type)}>
                      {location.type}
                    </Badge>
                    
                    {location.iataCode && (
                      <Badge variant="outline">{location.iataCode}</Badge>
                    )}
                    
                    {location.currencyCode && (
                      <Badge variant="outline" className="text-xs">
                        {location.currencyCode}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* No results message */}
      {isOpen && results.length === 0 && !loading && !showingPopular && query.trim() && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50">
          <CardContent className="p-3 text-center text-gray-500">
            <div className="mb-2">No locations found for "{query}".</div>
            <div className="text-sm">
              Try searching for:
              <ul className="list-disc list-inside mt-1 text-left">
                <li>City names (e.g., "London", "Tokyo", "NYC")</li>
                <li>Airport codes (e.g., "LAX", "JFK", "LHR")</li>
                <li>Country names (e.g., "United States", "Japan")</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

export default LocationSearch;
