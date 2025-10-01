// Enhanced location utilities with IndexedDB caching and search optimization
import { apiFetch } from "./api";

interface LocationResult {
  id: string;
  name: string;
  type: 'AIRPORT' | 'CITY' | 'COUNTRY';
  iataCode?: string | null;
  icaoCode?: string | null;
  cityCode?: string | null;
  countryCode?: string | null;
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
  population?: number | null;
  geonameId?: string | number | null;
  source?: string | null;
}

interface LocationStats {
  airports: number;
  cities: number;
  countries: number;
  lastUpdated: string;
  cacheAge: string;
}

interface SearchOptions {
  query: string;
  type?: LocationResult['type'] | string;
  types?: string[];
  limit?: number;
  useApi?: boolean;
}

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expires: number;
}

class LocationUtils {
  private static readonly CACHE_DB_NAME = 'VacationSyncLocationCache';
  private static readonly CACHE_DB_VERSION = 1;
  private static readonly CACHE_STORE_NAME = 'locations';
  private static readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly BROWSER_STORAGE_KEY = 'location_cache';
  private static readonly NORMALISED_TYPES = new Set<LocationResult['type']>([
    'AIRPORT',
    'CITY',
    'COUNTRY',
  ]);

  private static db: IDBDatabase | null = null;
  private static indexedDBSupported = typeof indexedDB !== 'undefined';

  private static normaliseType(value: unknown): LocationResult['type'] {
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (this.NORMALISED_TYPES.has(upper as LocationResult['type'])) {
        return upper as LocationResult['type'];
      }

      if (upper === 'AIRPORTS') {
        return 'AIRPORT';
      }

      if (upper === 'METRO' || upper === 'METROPOLITAN') {
        return 'CITY';
      }
    }

    return 'CITY';
  }

  private static coerceString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return undefined;
  }

  private static coerceNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private static coerceNullableNumber(value: unknown): number | null {
    const coerced = this.coerceNumber(value);
    return typeof coerced === 'number' ? coerced : null;
  }

  private static toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.coerceString(entry))
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
        .flatMap((entry) => this.toStringArray(entry))
        .filter((entry, index, array) => array.indexOf(entry) === index);
    }

    return [];
  }

  private static normaliseAlternativeNames(
    rawNames: unknown,
    additional: Array<string | undefined>,
  ): string[] {
    const collected: string[] = [];

    const pushName = (name?: string) => {
      if (!name) {
        return;
      }
      const trimmed = name.trim();
      if (trimmed.length > 0) {
        collected.push(trimmed);
      }
    };

    if (Array.isArray(rawNames)) {
      for (const value of rawNames) {
        if (typeof value === 'string') {
          pushName(value);
        }
      }
    } else if (rawNames && typeof rawNames === 'object') {
      for (const value of Object.values(rawNames)) {
        if (typeof value === 'string') {
          pushName(value);
        } else if (Array.isArray(value)) {
          for (const nested of value) {
            if (typeof nested === 'string') {
              pushName(nested);
            }
          }
        }
      }
    } else if (typeof rawNames === 'string') {
      pushName(rawNames);
    }

    for (const value of additional) {
      pushName(value);
    }

    const unique = new Set(collected);
    return Array.from(unique);
  }

  private static mapToLocationResult(raw: unknown): LocationResult | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const record = raw as Record<string, unknown>;

    const type = this.normaliseType(record.type);
    const rawName = this.coerceString(record.name)
      ?? this.coerceString(record.cityName)
      ?? this.coerceString(record.city_name);

    const iataRaw = this.coerceString(record.iata)
      ?? this.coerceString(record.iataCode)
      ?? this.coerceString(record.iata_code);
    const icaoRaw = this.coerceString(record.icao)
      ?? this.coerceString(record.icaoCode)
      ?? this.coerceString(record.icao_code);

    const iataCode = iataRaw ? iataRaw.toUpperCase() : undefined;
    const icaoCode = icaoRaw ? icaoRaw.toUpperCase() : undefined;

    const countryCodeRaw = this.coerceString(record.countryCode)
      ?? this.coerceString(record.country_code)
      ?? this.coerceString(record.country);
    const countryName = this.coerceString(record.countryName)
      ?? this.coerceString(record.country_name);
    const countryCode = countryCodeRaw
      ? countryCodeRaw.toUpperCase()
      : countryName && countryName.length === 2
        ? countryName.toUpperCase()
        : undefined;

    const inferredCountry = countryName ?? countryCode ?? null;

    const label = this.coerceString(record.label);
    const displayNameRaw = this.coerceString(record.displayName)
      ?? this.coerceString(record.display_name)
      ?? label;
    const defaultDisplayName = [rawName, countryCode ?? countryName]
      .filter((value): value is string => Boolean(value))
      .join(', ');
    const displayName = displayNameRaw
      ?? (type === 'AIRPORT' && iataCode ? `${rawName ?? ''} (${iataCode})`.trim() : undefined)
      ?? defaultDisplayName
      ?? rawName
      ?? iataCode
      ?? icaoCode
      ?? '';

    const detailedName = this.coerceString(record.detailedName)
      ?? this.coerceString(record.detailed_name)
      ?? displayName;

    const codeRaw = this.coerceString(record.code)
      ?? iataCode
      ?? icaoCode
      ?? this.coerceString(record.cityCode)
      ?? this.coerceString(record.city_code);
    const code = codeRaw ? codeRaw.toUpperCase() : undefined;

    const id = this.coerceString(record.id)
      ?? code
      ?? (rawName ?? displayName);

    if (!id) {
      return null;
    }

    const cityCodeRaw = this.coerceString(record.cityCode)
      ?? this.coerceString(record.city_code);
    const cityCode = cityCodeRaw ? cityCodeRaw.toUpperCase() : undefined;
    const cityName = this.coerceString(record.cityName)
      ?? this.coerceString(record.city_name)
      ?? (type === 'CITY' ? rawName ?? displayName : undefined);

    const relevance = this.coerceNumber(record.relevance) ?? 0;
    const latitude = this.coerceNumber(record.latitude);
    const longitude = this.coerceNumber(record.longitude);
    const region = this.coerceString(record.region)
      ?? this.coerceString(record.state)
      ?? this.coerceString(record.stateCode)
      ?? this.coerceString(record.state_code);
    const timeZone = this.coerceString(record.timeZone)
      ?? this.coerceString(record.timezone)
      ?? this.coerceString(record.time_zone);
    const currencyCodeRaw = this.coerceString(record.currencyCode)
      ?? this.coerceString(record.currency_code)
      ?? this.coerceString(record.currency);
    const currencyCode = currencyCodeRaw ? currencyCodeRaw.toUpperCase() : undefined;
    const isPopular = typeof record.isPopular === 'boolean'
      ? record.isPopular
      : Boolean(record.popular);

    const alternativeNames = this.normaliseAlternativeNames(
      record.alternativeNames ?? record.alternative_names,
      [label, displayName, detailedName, rawName, countryName ?? undefined, cityCode, iataCode ?? undefined, icaoCode ?? undefined],
    );

    const airports = this.toStringArray(record.airports ?? record.nearbyAirports ?? record.nearby_airports);
    const distanceKm = this.coerceNullableNumber(record.distanceKm)
      ?? this.coerceNullableNumber(record.distance_km)
      ?? this.coerceNullableNumber(record.distance);
    const population = this.coerceNullableNumber(record.population);

    const geonameIdRaw = this.coerceString(record.geonameId)
      ?? this.coerceString(record.geoNameId)
      ?? this.coerceString(record.geoname_id);
    const geonameIdNumber = this.coerceNumber(record.geonameId);
    const geonameId = geonameIdRaw ?? (typeof geonameIdNumber === 'number' ? geonameIdNumber : null);

    const source = this.coerceString(record.source)
      ?? this.coerceString(record.dataSource)
      ?? null;

    return {
      id,
      name: rawName ?? displayName,
      type,
      iataCode: iataCode ?? null,
      icaoCode: icaoCode ?? null,
      cityCode: cityCode ?? null,
      countryCode: countryCode ?? null,
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
      code: code ?? undefined,
      label: label ?? undefined,
      cityName: cityName ?? null,
      countryName: countryName ?? inferredCountry,
      country: inferredCountry,
      airports,
      distanceKm,
      population,
      geonameId,
      source,
    };
  }

  private static normaliseSearchResults(data: unknown): LocationResult[] {
    if (!Array.isArray(data)) {
      return [];
    }

    const results: LocationResult[] = [];

    for (const item of data) {
      const normalised = this.mapToLocationResult(item);
      if (normalised) {
        results.push(normalised);
      }
    }

    return results;
  }

  // Initialize IndexedDB for client-side caching
  private static async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (!this.indexedDBSupported) {
      throw new Error('IndexedDB not supported');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.CACHE_DB_NAME, this.CACHE_DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.CACHE_STORE_NAME)) {
          const store = db.createObjectStore(this.CACHE_STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('expires', 'expires');
        }
      };
    });
  }

  // Store data in IndexedDB with compression
  private static async setCache(key: string, data: any, customExpires?: number): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.CACHE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE_NAME);
      
      const expires = customExpires || (Date.now() + this.CACHE_DURATION);
      const entry: CacheEntry = {
        key,
        data: JSON.stringify(data), // Simple compression
        timestamp: Date.now(),
        expires
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Also store in browser storage as fallback
      try {
        const browserEntry = {
          data,
          timestamp: Date.now(),
          expires
        };
        localStorage.setItem(`${this.BROWSER_STORAGE_KEY}_${key}`, JSON.stringify(browserEntry));
      } catch (e) {
        // Ignore localStorage errors
      }
    } catch (error) {
      console.warn('Failed to cache in IndexedDB:', error);
    }
  }

  // Retrieve data from IndexedDB
  private static async getCache(key: string): Promise<any | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.CACHE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.CACHE_STORE_NAME);
      
      const entry = await new Promise<CacheEntry | null>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      
      if (entry && entry.expires > Date.now()) {
        return JSON.parse(entry.data);
      }
      
      // Clean up expired entry
      if (entry) {
        this.removeCache(key);
      }
    } catch (error) {
      console.warn('Failed to retrieve from IndexedDB:', error);
    }
    
    // Fallback to browser storage
    try {
      const browserEntry = localStorage.getItem(`${this.BROWSER_STORAGE_KEY}_${key}`);
      if (browserEntry) {
        const parsed = JSON.parse(browserEntry);
        if (parsed.expires > Date.now()) {
          return parsed.data;
        }
        localStorage.removeItem(`${this.BROWSER_STORAGE_KEY}_${key}`);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    return null;
  }

  // Remove cache entry
  private static async removeCache(key: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.CACHE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE_NAME);
      
      await new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to remove from IndexedDB:', error);
    }
    
    // Also remove from browser storage
    try {
      localStorage.removeItem(`${this.BROWSER_STORAGE_KEY}_${key}`);
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  // Clear all cache entries
  private static async clearCache(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.CACHE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE_NAME);
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to clear IndexedDB:', error);
    }
    
    // Also clear browser storage
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.BROWSER_STORAGE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  // Main search function with caching
  static async searchLocations(options: SearchOptions): Promise<LocationResult[]> {
    const { query, type, types, limit = 10, useApi = false } = options;

    if (!query.trim()) {
      return [];
    }

    const hasTypesArray = Array.isArray(types) && types.length > 0;
    const requestedTypes = hasTypesArray
      ? types
      : type
        ? [type]
        : [];

    const normalisedTypes = Array.from(
      new Set(requestedTypes.map((entry) => this.normaliseType(entry))),
    );

    const typeKey = normalisedTypes.length > 0
      ? [...normalisedTypes].sort().join('-')
      : 'all';

    // Generate cache key
    const cacheKey = `search_${query}_${typeKey}_${limit}_${useApi}`;

    // Try cache first
    const cachedResult = await this.getCache(cacheKey);
    if (cachedResult) {
      return this.normaliseSearchResults(cachedResult);
    }

    // Make API request
    try {
      const params = new URLSearchParams({ q: query });
      if (normalisedTypes.length > 0) {
        params.set('types', normalisedTypes.join(','));
      }

      if (typeof limit === 'number') {
        params.set('limit', limit.toString());
      }

      if (useApi) {
        params.set('useApi', 'true');
      }

      const payload = {
        query,
        ...(normalisedTypes.length > 0 ? { types: normalisedTypes } : {}),
        ...(typeof limit === 'number' ? { limit } : {}),
        ...(useApi ? { useApi: true } : {}),
      };
      console.log('📡 LocationUtils.searchLocations payload:', payload);

      const response = await apiFetch(`/api/locations/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const results = await response.json();
      const normalisedResults = this.normaliseSearchResults(results);

      // Cache the results for 1 hour
      await this.setCache(cacheKey, normalisedResults, Date.now() + (60 * 60 * 1000));

      return normalisedResults;
    } catch (error) {
      console.error('Location search failed:', error);
      return [];
    }
  }

  // Quick lookup for common searches
  static async quickLookup(query: string): Promise<LocationResult | null> {
    const results = await this.searchLocations({ query, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  // Get location by IATA code
  static async getLocationByIATA(iataCode: string): Promise<LocationResult | null> {
    const results = await this.searchLocations({ 
      query: iataCode, 
      type: 'AIRPORT', 
      limit: 1 
    });
    
    return results.find(r => r.iataCode === iataCode.toUpperCase()) || null;
  }

  // Get location by city name
  static async getLocationByCity(cityName: string): Promise<LocationResult | null> {
    const results = await this.searchLocations({ 
      query: cityName, 
      type: 'CITY', 
      limit: 1 
    });
    
    return results.find(r => r.name.toLowerCase() === cityName.toLowerCase()) || null;
  }

  // Get database statistics
  static async getLocationStats(): Promise<LocationStats | null> {
    const cacheKey = 'location_stats';
    
    // Try cache first
    const cachedStats = await this.getCache(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }
    
    try {
      const response = await apiFetch('/api/locations/stats');
      
      if (!response.ok) {
        throw new Error(`Stats failed: ${response.status}`);
      }
      
      const stats = await response.json();
      
      // Cache stats for 30 minutes
      await this.setCache(cacheKey, stats, Date.now() + (30 * 60 * 1000));
      
      return stats;
    } catch (error) {
      console.error('Failed to get location stats:', error);
      return null;
    }
  }

  // Refresh all location data
  static async refreshLocationData(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiFetch('/api/locations/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Clear all cache after refresh
      await this.clearCache();
      
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Failed to refresh location data:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Format location for display
  static formatLocation(location: LocationResult): string {
    let formatted = location.displayName;
    
    if (location.iataCode) {
      formatted += ` (${location.iataCode})`;
    }
    
    if (location.region) {
      formatted += ` - ${location.region}`;
    }
    
    return formatted;
  }

  // Get coordinates from location
  static getCoordinates(location: LocationResult): [number, number] | null {
    if (location.latitude !== undefined && location.longitude !== undefined) {
      return [location.latitude, location.longitude];
    }
    return null;
  }

  // Calculate distance between two locations
  static calculateDistance(loc1: LocationResult, loc2: LocationResult): number | null {
    const coords1 = this.getCoordinates(loc1);
    const coords2 = this.getCoordinates(loc2);
    
    if (!coords1 || !coords2) return null;
    
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  // Convert degrees to radians
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Get popular destinations
  static async getPopularDestinations(type?: 'AIRPORT' | 'CITY' | 'COUNTRY', limit = 20): Promise<LocationResult[]> {
    const cacheKey = `popular_${type || 'all'}_${limit}`;
    
    // Try cache first
    const cachedResult = await this.getCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    try {
      const results = await this.searchLocations({ 
        query: 'popular', 
        type, 
        limit: limit * 2 // Get more to filter
      });
      
      const popular = results.filter(r => r.isPopular).slice(0, limit);
      
      // Cache for 4 hours
      await this.setCache(cacheKey, popular, Date.now() + (4 * 60 * 60 * 1000));
      
      return popular;
    } catch (error) {
      console.error('Failed to get popular destinations:', error);
      return [];
    }
  }

  // Find nearby locations
  static async findNearbyLocations(
    location: LocationResult, 
    type?: 'AIRPORT' | 'CITY' | 'COUNTRY',
    radiusKm = 100,
    limit = 10
  ): Promise<LocationResult[]> {
    const coords = this.getCoordinates(location);
    if (!coords) return [];
    
    // This is a simplified version - in production, use a proper geo search
    const allResults = await this.searchLocations({ 
      query: location.countryCode || location.name, 
      type, 
      limit: limit * 5 
    });
    
    const nearby = allResults
      .filter(r => r.id !== location.id)
      .map(r => ({
        ...r,
        distance: this.calculateDistance(location, r)
      }))
      .filter(r => r.distance !== null && r.distance! <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, limit);
    
    return nearby;
  }

  // Get cache size information
  static async getCacheInfo(): Promise<{ entries: number; size: string }> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.CACHE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.CACHE_STORE_NAME);
      
      const count = await new Promise<number>((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Estimate size (rough approximation)
      const avgEntrySize = 2048; // bytes
      const totalSize = count * avgEntrySize;
      const sizeFormatted = this.formatBytes(totalSize);
      
      return { entries: count, size: sizeFormatted };
    } catch (error) {
      console.warn('Failed to get cache info:', error);
      return { entries: 0, size: '0 B' };
    }
  }

  // Format bytes for display
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Clean up expired cache entries
  static async cleanupCache(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.CACHE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE_NAME);
      const index = store.index('expires');
      
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);
      
      await new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve(undefined);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to cleanup cache:', error);
    }
  }

  // Performance monitoring
  static async measureSearchPerformance(query: string, iterations = 5): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    results: number;
  }> {
    const times: number[] = [];
    let resultCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const results = await this.searchLocations({ query, limit: 10 });
      const end = performance.now();
      
      times.push(end - start);
      resultCount = results.length;
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      results: resultCount
    };
  }
}

export default LocationUtils;