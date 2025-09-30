import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, MapPin, Plane, Building, Globe, X, Star, Clock, DollarSign } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface LocationResult {
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
}

interface LocationSearchProps {
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

const toTypeParam = (value?: LocationSearchProps["type"]): string | null => {
  if (!value) {
    return null;
  }

  switch (value) {
    case 'AIRPORT':
      return 'airport';
    case 'CITY':
      return 'city';
    case 'COUNTRY':
      return 'country';
    default:
      return null;
  }
};

const buildSearchUrl = (
  query: string,
  options: {
    type?: LocationSearchProps["type"];
    limit?: number;
  } = {},
) => {
  const params = new URLSearchParams({ q: query });
  const typeParam = toTypeParam(options.type);
  if (typeParam) {
    params.set('types', typeParam);
  }

  if (typeof options.limit === 'number') {
    params.set('limit', options.limit.toString());
  }

  return `/api/locations/search?${params.toString()}`;
};

export default function LocationSearch({ 
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
}: LocationSearchProps) {
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

  // Initialize selected location from value
  useEffect(() => {
    if (value && !selectedLocation) {
      setSelectedLocation(value);
      setQuery(value.name || '');
    }
  }, [value]);

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
      const response = await apiFetch(
        buildSearchUrl('popular', { type, limit: 20 }),
      );

      if (response.ok) {
        const results = await response.json();
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
      const response = await apiFetch(
        buildSearchUrl(searchQuery, { type, limit: maxResults }),
      );

      if (response.ok) {
        const searchResults = await response.json();
        
        // Show multiple airports for cities if requested
        let processedResults = searchResults;
        if (showMultipleAirports && type === 'AIRPORT') {
          processedResults = await enhanceWithMultipleAirports(searchResults);
        }
        
        setResults(processedResults);
        
        // If this is initial load and we have an exact match, select it
        if (isInitial && searchResults.length > 0) {
          const exactMatch = searchResults.find((r: LocationResult) => 
            r.name.toLowerCase() === searchQuery.toLowerCase() ||
            r.iataCode?.toLowerCase() === searchQuery.toLowerCase() ||
            r.icaoCode?.toLowerCase() === searchQuery.toLowerCase()
          );
          if (exactMatch) {
            setSelectedLocation(exactMatch);
            onChange?.(exactMatch);
          }
        }
        
        if (!isInitial) {
          setIsOpen(true);
        }
      }
    } catch (error) {
      console.error('Location search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const enhanceWithMultipleAirports = async (results: LocationResult[]): Promise<LocationResult[]> => {
    // For cities, find all airports in that city
    const enhanced: LocationResult[] = [];
    
    for (const result of results) {
      enhanced.push(result);
      
      if (result.type === 'CITY') {
        try {
          const airportResponse = await apiFetch(
            buildSearchUrl(result.name, { type: 'AIRPORT', limit: 5 }),
          );
          
          if (airportResponse.ok) {
            const airports = await airportResponse.json();
            enhanced.push(...airports.slice(0, 3)); // Limit to 3 airports per city
          }
        } catch (error) {
          console.error('Failed to find airports for city:', result.name);
        }
      }
    }
    
    return enhanced;
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
}