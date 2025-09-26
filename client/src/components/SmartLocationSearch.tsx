import { forwardRef, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plane, Globe, Building } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface LocationResult {
  type: 'airport' | 'city' | 'metro' | 'state' | 'country';
  name: string;
  code: string;
  displayName: string;
  country: string;
  state?: string;
  airports?: string[];
}

interface SmartLocationSearchProps {
  placeholder?: string;
  value?: string;
  onLocationSelect: (location: LocationResult) => void;
  className?: string;
}

const SmartLocationSearch = forwardRef<HTMLInputElement, SmartLocationSearchProps>(function SmartLocationSearch({
  placeholder = "Enter city, airport, or state...",
  value = "",
  onLocationSelect,
  className = ""
}, ref) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const internalInputRef = useRef<HTMLInputElement | null>(null);

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
      setShowResults(false);
      setSelectedLocation(null);
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
          // ROOT CAUSE 2 FIX: Ensure results is always an array
          const safeResults = Array.isArray(data) ? data : [];
          setResults(safeResults);
          setShowResults(true);
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
    setShowResults(false);
    setResults([]); // Clear results to prevent "No locations found" message
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

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={setInputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            // Only show results if we have actual search results
            // Don't show dropdown for pre-filled values without search results
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
          className="w-full"
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto">
          <CardContent className="p-0">
            {results.map((location, index) => {
              // ROOT CAUSE 2 FIX: Add safety checks for all location properties
              if (!location || typeof location !== 'object') {
                return null;
              }
              
              const safeLocation = {
                type: location.type || 'city',
                name: location.name || 'Unknown Location',
                code: location.code || 'N/A',
                displayName: location.displayName || location.name || 'Unknown Location',
                country: location.country || 'Unknown Country',
                state: location.state,
                airports: Array.isArray(location.airports) ? location.airports : []
              };
              
              return (
                <div
                  key={`${safeLocation.type}-${safeLocation.code}-${index}`}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                  onClick={() => handleLocationClick(safeLocation)}
                >
                  <div className="flex items-center gap-2">
                    {getLocationIcon(safeLocation.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{safeLocation.name}</span>
                        <Badge variant="outline" className={getTypeColor(safeLocation.type)}>
                          {safeLocation.type === 'metro' ? 'metro area' : safeLocation.type}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {safeLocation.country}
                        {safeLocation.state && safeLocation.state !== safeLocation.country && `, ${safeLocation.state}`}
                        {safeLocation.type === 'metro' && safeLocation.airports && (
                          <div className="text-xs text-blue-600 mt-1">
                            Multiple airports: {safeLocation.airports.join(', ')}
                          </div>
                        )}
                      </div>
                      {safeLocation.airports && safeLocation.airports.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Airports: {safeLocation.airports.slice(0, 3).join(', ')}
                          {safeLocation.airports.length > 3 && ` +${safeLocation.airports.length - 3} more`}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-mono text-gray-600">
                      {safeLocation.code}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {showResults && results.length === 0 && query.length >= 2 && !isLoading && !selectedLocation && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1">
          <CardContent className="p-3 text-center text-gray-500">
            No locations found for "{query}". Try a different search term.
          </CardContent>
        </Card>
      )}
    </div>
  );
});

export default SmartLocationSearch;
