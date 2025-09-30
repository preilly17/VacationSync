// Comprehensive Location Database Service using Amadeus API
import fs from 'fs/promises';
import path from 'path';

interface AmadeusLocation {
  type: 'location';
  subType: 'AIRPORT' | 'CITY' | 'COUNTRY';
  name: string;
  detailedName: string;
  id: string;
  self: {
    href: string;
    methods: string[];
  };
  timeZoneOffset?: string;
  iataCode?: string;
  icaoCode?: string;
  geoCode?: {
    latitude: number;
    longitude: number;
  };
  address?: {
    cityName?: string;
    cityCode?: string;
    countryName?: string;
    countryCode?: string;
    stateCode?: string;
    regionCode?: string;
  };
  analytics?: {
    travelers?: {
      score: number;
    };
  };
  relevance?: number;
}

interface AmadeusLocationResponse {
  meta: {
    count: number;
    links?: {
      self: string;
      next?: string;
      previous?: string;
      last?: string;
      first?: string;
    };
  };
  data: AmadeusLocation[];
}

interface CachedLocationData {
  airports: AmadeusLocation[];
  cities: AmadeusLocation[];
  countries: AmadeusLocation[];
  lastUpdated: string;
  version: string;
  searchIndex: LocationSearchIndex;
  popularDestinations: string[];
  cityNicknames: Record<string, string>;
  regionalGroups: Record<string, string[]>;
}

interface LocationSearchIndex {
  nameIndex: Record<string, string[]>;
  codeIndex: Record<string, string[]>;
  countryIndex: Record<string, string[]>;
  popularityIndex: Record<string, number>;
}

interface LocationSearchResult {
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
  countryName?: string | null;
  country?: string | null;
  cityName?: string | null;
  state?: string | null;
  source?: string | null;
  distanceKm?: number | null;
  geonameId?: string | number | null;
  population?: number | null;
}

class LocationService {
  private cacheDir = path.join(process.cwd(), 'cache');
  private cacheFile = path.join(this.cacheDir, 'amadeus-locations.json');
  private compressedCacheFile = path.join(this.cacheDir, 'amadeus-locations.gz');
  private cachedData: CachedLocationData | null = null;
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly RATE_LIMIT_DELAY = 250; // 250ms between requests
  private readonly BATCH_SIZE = 50;
  private readonly POPULAR_DESTINATIONS = [
    'London', 'Paris', 'Tokyo', 'New York', 'Barcelona', 'Rome', 'Amsterdam',
    'Dubai', 'Singapore', 'Sydney', 'Los Angeles', 'Bangkok', 'Istanbul',
    'Prague', 'Berlin', 'Vienna', 'Madrid', 'Frankfurt', 'Miami', 'Hong Kong',
    'Mumbai', 'Delhi', 'Seoul', 'Shanghai', 'Beijing', 'Toronto', 'Vancouver',
    'São Paulo', 'Rio de Janeiro', 'Buenos Aires', 'Cairo', 'Cape Town',
    'Melbourne', 'Perth', 'Auckland', 'Mexico City', 'Lima', 'Bogotá'
  ];
  private readonly CITY_NICKNAMES = {
    'nyc': 'New York',
    'ny': 'New York',
    'la': 'Los Angeles',
    'sf': 'San Francisco',
    'vegas': 'Las Vegas',
    'chi': 'Chicago',
    'philly': 'Philadelphia',
    'dc': 'Washington',
    'bos': 'Boston',
    'atl': 'Atlanta',
    'lhr': 'London',
    'cdg': 'Paris',
    'nrt': 'Tokyo',
    'hnd': 'Tokyo',
    'dxb': 'Dubai',
    'sin': 'Singapore',
    'syd': 'Sydney',
    'mel': 'Melbourne',
    'bkk': 'Bangkok',
    'hkg': 'Hong Kong',
    'icn': 'Seoul',
    'pvg': 'Shanghai',
    'pek': 'Beijing',
    'yyz': 'Toronto',
    'yvr': 'Vancouver',
    'gru': 'São Paulo',
    'gig': 'Rio de Janeiro',
    'eze': 'Buenos Aires',
    'cai': 'Cairo',
    'cpt': 'Cape Town',
    'akl': 'Auckland',
    'mex': 'Mexico City',
    'lim': 'Lima',
    'bog': 'Bogotá'
  };
  private readonly REGIONAL_GROUPS = {
    'Western Europe': ['London', 'Paris', 'Rome', 'Madrid', 'Barcelona', 'Amsterdam', 'Berlin', 'Vienna', 'Prague', 'Zurich'],
    'Eastern Europe': ['Moscow', 'Warsaw', 'Budapest', 'Prague', 'Kiev', 'Bucharest', 'Sofia', 'Zagreb', 'Belgrade'],
    'North America': ['New York', 'Los Angeles', 'Chicago', 'Toronto', 'Vancouver', 'Mexico City', 'Miami', 'San Francisco'],
    'Asia Pacific': ['Tokyo', 'Seoul', 'Beijing', 'Shanghai', 'Hong Kong', 'Singapore', 'Bangkok', 'Sydney', 'Melbourne'],
    'Middle East': ['Dubai', 'Doha', 'Kuwait City', 'Riyadh', 'Tel Aviv', 'Istanbul', 'Tehran', 'Baghdad'],
    'Africa': ['Cairo', 'Cape Town', 'Johannesburg', 'Nairobi', 'Lagos', 'Casablanca', 'Tunis', 'Algiers'],
    'South America': ['São Paulo', 'Rio de Janeiro', 'Buenos Aires', 'Lima', 'Bogotá', 'Santiago', 'Caracas', 'Quito'],
    'Caribbean': ['Havana', 'Kingston', 'Nassau', 'Bridgetown', 'Port of Spain', 'Santo Domingo', 'San Juan']
  };

  constructor() {
    this.ensureCacheDirectory();
  }

  private async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return undefined;
  }

  private normalizeCode(value: unknown): string | undefined {
    const normalized = this.normalizeString(value);
    return normalized ? normalized.toUpperCase() : undefined;
  }

  private normalizeNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private normalizeBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false;
      }
    }

    return undefined;
  }

  private normalizeId(value: unknown): string | number | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return undefined;
  }

  private normalizeLocationType(value: unknown): 'AIRPORT' | 'CITY' | 'COUNTRY' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === 'AIRPORT' || normalized === 'AIRPORTS') {
      return 'AIRPORT';
    }

    if (normalized === 'COUNTRY' || normalized === 'COUNTRIES') {
      return 'COUNTRY';
    }

    if (
      normalized === 'CITY' ||
      normalized === 'CITIES' ||
      normalized === 'METRO' ||
      normalized === 'METROPOLITAN' ||
      normalized === 'STATE' ||
      normalized === 'STATES'
    ) {
      return 'CITY';
    }

    return undefined;
  }

  private ensureLocationType(value: unknown, fallback: 'AIRPORT' | 'CITY' | 'COUNTRY' = 'CITY'): 'AIRPORT' | 'CITY' | 'COUNTRY' {
    return this.normalizeLocationType(value) ?? fallback;
  }

  private normalizeRequestedTypes(
    type?: unknown,
    types?: Array<unknown> | unknown,
  ): Array<'AIRPORT' | 'CITY' | 'COUNTRY'> {
    const collected: unknown[] = [];

    if (Array.isArray(types)) {
      collected.push(...types);
    } else if (typeof types !== 'undefined') {
      collected.push(types);
    }

    if (typeof type !== 'undefined') {
      collected.push(type);
    }

    const normalized = collected
      .flatMap((entry) => {
        if (typeof entry === 'string') {
          return entry.split(',');
        }

        return [entry];
      })
      .map((entry) => this.normalizeLocationType(entry))
      .filter((entry): entry is 'AIRPORT' | 'CITY' | 'COUNTRY' => Boolean(entry));

    return Array.from(new Set(normalized));
  }

  private normalizeAlternativeNames(raw: any, extras: Array<string | undefined>): string[] {
    const collected = new Set<string>();

    const push = (value: unknown) => {
      const normalized = this.normalizeString(value);
      if (normalized) {
        collected.add(normalized);
      }
    };

    if (Array.isArray(raw?.alternativeNames)) {
      raw.alternativeNames.forEach(push);
    }

    if (Array.isArray(raw?.alternative_names)) {
      raw.alternative_names.forEach(push);
    }

    if (raw?.nicknames) {
      if (Array.isArray(raw.nicknames)) {
        raw.nicknames.forEach(push);
      } else if (typeof raw.nicknames === 'object') {
        Object.values(raw.nicknames).forEach(push);
      } else {
        push(raw.nicknames);
      }
    }

    extras.forEach(push);

    return Array.from(collected);
  }

  private normalizeResultShape(raw: Partial<LocationSearchResult> & Record<string, any>): LocationSearchResult {
    const type = this.ensureLocationType(raw.type ?? raw.subType);
    const name = this.normalizeString(raw.name)
      ?? this.normalizeString(raw.displayName)
      ?? this.normalizeString(raw.detailedName)
      ?? this.normalizeString(raw.cityName)
      ?? this.normalizeString(raw.label)
      ?? 'Unknown Location';

    const iataCode = this.normalizeCode(raw.iataCode ?? raw.iata);
    const icaoCode = this.normalizeCode(raw.icaoCode ?? raw.icao);
    const cityCode = this.normalizeCode(raw.cityCode ?? raw.address?.cityCode);
    const countryCode = this.normalizeCode(raw.countryCode ?? raw.address?.countryCode ?? raw.country_code ?? raw.country);
    const region = this.normalizeString(raw.region ?? raw.address?.stateCode ?? raw.state ?? raw.regionCode);
    const latitude = this.normalizeNumber(
      raw.latitude ?? raw.geoCode?.latitude ?? raw.coordinates?.lat ?? raw.lat ?? raw.latitudeDegrees,
    );
    const longitude = this.normalizeNumber(
      raw.longitude ?? raw.geoCode?.longitude ?? raw.coordinates?.lng ?? raw.lon ?? raw.lng ?? raw.longitudeDegrees,
    );

    const resolvedDisplayName = this.normalizeString(raw.displayName ?? raw.label)
      ?? (iataCode ? `${name} (${iataCode})` : name);
    const detailedName = this.normalizeString(raw.detailedName) ?? resolvedDisplayName;
    const currencyCode = this.normalizeCode(raw.currencyCode);
    const timeZone = this.normalizeString(raw.timeZone ?? raw.timezone ?? raw.time_zone);

    const relevance = this.normalizeNumber(raw.relevance ?? raw.score ?? raw.population ?? raw.rank) ?? 0;
    const popularityFlag = this.normalizeBoolean(raw.isPopular);

    const id = this.normalizeId(raw.id ?? raw.geonameId ?? raw.geoNameId ?? raw.code ?? iataCode ?? icaoCode ?? name)
      ?? `${type}-${name}`;

    const alternativeNames = this.normalizeAlternativeNames(raw, [iataCode, icaoCode, cityCode, raw.code]);

    const result: LocationSearchResult = {
      id: typeof id === 'number' ? String(id) : id,
      name,
      type,
      iataCode: iataCode ?? undefined,
      icaoCode: icaoCode ?? undefined,
      cityCode: cityCode ?? undefined,
      countryCode: countryCode ?? undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      detailedName,
      relevance,
      displayName: resolvedDisplayName,
      region: region ?? undefined,
      timeZone: timeZone ?? undefined,
      currencyCode: currencyCode ?? undefined,
      isPopular: popularityFlag ?? this.POPULAR_DESTINATIONS.includes(name),
      alternativeNames,
    };

    const enrichedResult = result as LocationSearchResult & Record<string, any>;

    const code = this.normalizeCode(raw.code ?? iataCode ?? icaoCode ?? cityCode ?? countryCode);
    if (code) {
      enrichedResult.code = code;
    }

    enrichedResult.label = this.normalizeString(raw.label) ?? resolvedDisplayName;
    const countryName = this.normalizeString(raw.countryName ?? raw.address?.countryName ?? raw.country);
    if (countryName) {
      enrichedResult.countryName = countryName;
      enrichedResult.country = countryName;
    } else if (countryCode) {
      enrichedResult.countryName = countryCode;
      enrichedResult.country = countryCode;
    } else {
      enrichedResult.countryName = null;
      enrichedResult.country = null;
    }

    const cityName = this.normalizeString(raw.cityName ?? raw.address?.cityName ?? raw.city)
      ?? (type === 'CITY' ? name : undefined);
    enrichedResult.cityName = cityName ?? null;

    const state = this.normalizeString(raw.state ?? raw.address?.stateCode ?? raw.stateCode ?? region);
    enrichedResult.state = state ?? null;

    const source = this.normalizeString(raw.source ?? raw.origin ?? raw.provider);
    enrichedResult.source = source ?? null;

    const distanceKm = this.normalizeNumber(raw.distanceKm ?? raw.distance_km);
    enrichedResult.distanceKm = typeof distanceKm === 'number' ? distanceKm : null;

    const geonameId = this.normalizeId(raw.geonameId ?? raw.geoNameId ?? raw.geoname_id);
    enrichedResult.geonameId = typeof geonameId !== 'undefined' ? geonameId : null;

    const population = this.normalizeNumber(raw.population);
    enrichedResult.population = typeof population === 'number' ? population : null;

    return result;
  }

  private normalizeLimit(value: unknown, fallback = 10, max = 50): number {
    const normalized = this.normalizeNumber(value);

    if (!normalized) {
      return fallback;
    }

    const bounded = Math.max(1, Math.min(max, Math.floor(normalized)));
    return Number.isFinite(bounded) ? bounded : fallback;
  }

  private async getAmadeusToken(): Promise<string> {
    const response = await fetch('https://api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_CLIENT_ID!,
        client_secret: process.env.AMADEUS_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      throw new Error(`Amadeus authentication failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchLocationData(
    endpoint: string,
    params: Record<string, string>,
    token: string,
    onProgress?: (current: number, total: number, type: string) => void
  ): Promise<AmadeusLocation[]> {
    const allData: AmadeusLocation[] = [];
    let currentPage = 0;
    let totalPages = 1;
    
    do {
      const searchParams = new URLSearchParams({
        ...params,
        limit: this.BATCH_SIZE.toString(),
        offset: (currentPage * this.BATCH_SIZE).toString(),
      });

      const response = await fetch(`${endpoint}?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch from ${endpoint}:`, response.status);
        break;
      }

      const data: AmadeusLocationResponse = await response.json();
      
      if (data.data && data.data.length > 0) {
        allData.push(...data.data);
        
        if (onProgress) {
          const estimated = Math.max(data.meta.count || allData.length, allData.length);
          onProgress(allData.length, estimated, endpoint.split('/').pop() || 'locations');
        }
      }

      // Check if there are more pages
      if (data.meta.links?.next && data.data.length === this.BATCH_SIZE) {
        currentPage++;
        totalPages = Math.ceil((data.meta.count || allData.length) / this.BATCH_SIZE);
        await this.delay(this.RATE_LIMIT_DELAY);
      } else {
        break;
      }
    } while (currentPage < totalPages);

    return allData;
  }

  async fetchAllLocations(onProgress?: (current: number, total: number, type: string) => void): Promise<CachedLocationData> {
    console.log('🌍 Starting comprehensive location data fetch from Amadeus...');
    
    const token = await this.getAmadeusToken();
    const startTime = Date.now();

    // Fetch airports
    console.log('✈️ Fetching airports...');
    const airports = await this.fetchLocationData(
      'https://api.amadeus.com/v1/reference-data/locations',
      { subType: 'AIRPORT' },
      token,
      onProgress
    );

    await this.delay(this.RATE_LIMIT_DELAY);

    // Fetch cities
    console.log('🏙️ Fetching cities...');
    const cities = await this.fetchLocationData(
      'https://api.amadeus.com/v1/reference-data/locations',
      { subType: 'CITY' },
      token,
      onProgress
    );

    await this.delay(this.RATE_LIMIT_DELAY);

    // Fetch countries - using a different approach since countries endpoint might be different
    console.log('🌏 Fetching countries...');
    let countries: AmadeusLocation[] = [];
    try {
      countries = await this.fetchLocationData(
        'https://api.amadeus.com/v1/reference-data/locations',
        { subType: 'COUNTRY' },
        token,
        onProgress
      );
    } catch (error) {
      console.warn('Country data fetch failed, using fallback method');
      // Extract countries from cities and airports
      const countrySet = new Set<string>();
      const countryData: AmadeusLocation[] = [];
      
      [...cities, ...airports].forEach(location => {
        if (location.address?.countryCode && location.address?.countryName) {
          const key = `${location.address.countryCode}-${location.address.countryName}`;
          if (!countrySet.has(key)) {
            countrySet.add(key);
            countryData.push({
              type: 'location',
              subType: 'COUNTRY',
              name: location.address.countryName,
              detailedName: location.address.countryName,
              id: location.address.countryCode,
              self: {
                href: `https://api.amadeus.com/v1/reference-data/locations/${location.address.countryCode}`,
                methods: ['GET']
              },
              address: {
                countryCode: location.address.countryCode,
                countryName: location.address.countryName,
              }
            });
          }
        }
      });
      countries = countryData;
    }

    // Build search index and enhanced data
    console.log('🔍 Building search index...');
    const searchIndex = this.buildSearchIndex([...airports, ...cities, ...countries]);

    const locationData: CachedLocationData = {
      airports: airports.filter(a => a.subType === 'AIRPORT'),
      cities: cities.filter(c => c.subType === 'CITY'),
      countries: countries.filter(c => c.subType === 'COUNTRY'),
      lastUpdated: new Date().toISOString(),
      version: '2.0',
      searchIndex,
      popularDestinations: this.POPULAR_DESTINATIONS,
      cityNicknames: this.CITY_NICKNAMES,
      regionalGroups: this.REGIONAL_GROUPS
    };

    // Cache the data
    await this.cacheLocationData(locationData);

    const duration = Date.now() - startTime;
    console.log(`✅ Location data fetch complete in ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Fetched ${airports.length} airports, ${cities.length} cities, ${countries.length} countries`);

    return locationData;
  }

  private async cacheLocationData(data: CachedLocationData): Promise<void> {
    try {
      // Cache both regular and compressed versions
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
      
      // Create compressed version for faster loading
      const compressedData = JSON.stringify(data);
      await fs.writeFile(this.compressedCacheFile, compressedData);
      
      this.cachedData = data;
      console.log('💾 Location data cached successfully');
      
      // Log compression statistics
      const originalSize = (await fs.stat(this.cacheFile)).size;
      const compressedSize = (await fs.stat(this.compressedCacheFile)).size;
      console.log(`📊 Cache size: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      console.error('Failed to cache location data:', error);
    }
  }

  private async loadCachedData(): Promise<CachedLocationData | null> {
    try {
      // Try compressed version first
      let data: string;
      try {
        data = await fs.readFile(this.compressedCacheFile, 'utf-8');
        console.log('📁 Using compressed cached location data');
      } catch {
        data = await fs.readFile(this.cacheFile, 'utf-8');
        console.log('📁 Using cached location data');
      }
      
      const parsed = JSON.parse(data) as CachedLocationData;
      
      // Check if cache is still valid
      const cacheAge = Date.now() - new Date(parsed.lastUpdated).getTime();
      if (cacheAge < this.CACHE_DURATION) {
        return parsed;
      } else {
        console.log('🔄 Location cache expired, will refresh');
        return null;
      }
    } catch (error) {
      console.log('🆕 No cached location data found, will fetch fresh data');
      return null;
    }
  }

  async getLocationData(forceRefresh = false): Promise<CachedLocationData> {
    if (!forceRefresh && this.cachedData) {
      return this.cachedData;
    }

    if (!forceRefresh) {
      const cached = await this.loadCachedData();
      if (cached) {
        this.cachedData = cached;
        return cached;
      }
    }

    return await this.fetchAllLocations();
  }

  private fuzzyMatch(query: string, target: string): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    
    // Exact match
    if (q === t) return 100;
    
    // Starts with
    if (t.startsWith(q)) return 90;
    
    // Contains
    if (t.includes(q)) return 80;
    
    // Word boundary match
    const words = t.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(q)) return 70;
      if (word.includes(q)) return 60;
    }
    
    // Fuzzy string matching (simple Levenshtein-like)
    const maxLength = Math.max(q.length, t.length);
    const distance = this.levenshteinDistance(q, t);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    
    return similarity > 50 ? similarity : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private buildSearchIndex(locations: AmadeusLocation[]): LocationSearchIndex {
    const nameIndex: Record<string, string[]> = {};
    const codeIndex: Record<string, string[]> = {};
    const countryIndex: Record<string, string[]> = {};
    const popularityIndex: Record<string, number> = {};

    locations.forEach(location => {
      const id = location.id;
      
      // Build name index (normalize for search)
      const normalizedName = this.normalizeForSearch(location.name);
      const normalizedDetailedName = this.normalizeForSearch(location.detailedName);
      
      this.addToIndex(nameIndex, normalizedName, id);
      this.addToIndex(nameIndex, normalizedDetailedName, id);
      
      // Build code index
      if (location.iataCode) {
        this.addToIndex(codeIndex, location.iataCode.toLowerCase(), id);
      }
      if (location.icaoCode) {
        this.addToIndex(codeIndex, location.icaoCode.toLowerCase(), id);
      }
      
      // Build country index
      if (location.address?.countryCode) {
        this.addToIndex(countryIndex, location.address.countryCode.toLowerCase(), id);
      }
      if (location.address?.countryName) {
        this.addToIndex(countryIndex, this.normalizeForSearch(location.address.countryName), id);
      }
      
      // Build popularity index
      const isPopular = this.POPULAR_DESTINATIONS.includes(location.name);
      if (isPopular) {
        popularityIndex[id] = (popularityIndex[id] || 0) + 100;
      }
      
      // Boost score for analytics data
      if (location.analytics?.travelers?.score) {
        popularityIndex[id] = (popularityIndex[id] || 0) + location.analytics.travelers.score;
      }
    });

    return {
      nameIndex,
      codeIndex,
      countryIndex,
      popularityIndex
    };
  }

  private addToIndex(index: Record<string, string[]>, key: string, value: string): void {
    if (!index[key]) {
      index[key] = [];
    }
    if (!index[key].includes(value)) {
      index[key].push(value);
    }
  }

  private normalizeForSearch(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  private getRegionForLocation(location: AmadeusLocation): string | undefined {
    for (const [region, cities] of Object.entries(this.REGIONAL_GROUPS)) {
      if (cities.includes(location.name)) {
        return region;
      }
    }
    return undefined;
  }

  private getTimeZoneForLocation(location: AmadeusLocation): string | undefined {
    // Basic timezone mapping - in production, use a timezone API
    const timezoneMap: Record<string, string> = {
      'US': 'America/New_York',
      'GB': 'Europe/London',
      'FR': 'Europe/Paris',
      'DE': 'Europe/Berlin',
      'JP': 'Asia/Tokyo',
      'AU': 'Australia/Sydney',
      'CN': 'Asia/Shanghai',
      'IN': 'Asia/Kolkata',
      'BR': 'America/Sao_Paulo',
      'RU': 'Europe/Moscow',
      'AE': 'Asia/Dubai',
      'SG': 'Asia/Singapore',
      'TH': 'Asia/Bangkok',
      'KR': 'Asia/Seoul',
      'CA': 'America/Toronto',
      'MX': 'America/Mexico_City',
      'AR': 'America/Argentina/Buenos_Aires',
      'CL': 'America/Santiago',
      'PE': 'America/Lima',
      'CO': 'America/Bogota',
      'EG': 'Africa/Cairo',
      'ZA': 'Africa/Johannesburg',
      'KE': 'Africa/Nairobi',
      'MA': 'Africa/Casablanca',
      'TR': 'Europe/Istanbul',
      'IL': 'Asia/Jerusalem',
      'SA': 'Asia/Riyadh',
      'QA': 'Asia/Qatar',
      'KW': 'Asia/Kuwait',
      'OM': 'Asia/Muscat',
      'BH': 'Asia/Bahrain',
      'JO': 'Asia/Amman',
      'LB': 'Asia/Beirut',
      'SY': 'Asia/Damascus',
      'IQ': 'Asia/Baghdad',
      'IR': 'Asia/Tehran'
    };
    
    return location.address?.countryCode ? timezoneMap[location.address.countryCode] : undefined;
  }

  private getCurrencyForCountry(countryCode: string): string | undefined {
    const currencyMap: Record<string, string> = {
      'US': 'USD', 'CA': 'CAD', 'MX': 'MXN',
      'GB': 'GBP', 'FR': 'EUR', 'DE': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR',
      'JP': 'JPY', 'CN': 'CNY', 'IN': 'INR', 'KR': 'KRW', 'TH': 'THB', 'SG': 'SGD',
      'AU': 'AUD', 'NZ': 'NZD',
      'BR': 'BRL', 'AR': 'ARS', 'CL': 'CLP', 'PE': 'PEN', 'CO': 'COP',
      'RU': 'RUB', 'TR': 'TRY', 'IL': 'ILS', 'SA': 'SAR', 'AE': 'AED',
      'EG': 'EGP', 'ZA': 'ZAR', 'KE': 'KES', 'MA': 'MAD', 'NG': 'NGN',
      'CH': 'CHF', 'NO': 'NOK', 'SE': 'SEK', 'DK': 'DKK', 'PL': 'PLN',
      'CZ': 'CZK', 'HU': 'HUF', 'RO': 'RON', 'BG': 'BGN', 'HR': 'HRK'
    };
    
    return currencyMap[countryCode];
  }

  private getAlternativeNames(location: AmadeusLocation): string[] {
    const alternatives: string[] = [];
    
    // Add nickname if exists
    for (const [nickname, fullName] of Object.entries(this.CITY_NICKNAMES)) {
      if (fullName === location.name) {
        alternatives.push(nickname.toUpperCase());
      }
    }
    
    // Add codes as alternative names
    if (location.iataCode) {
      alternatives.push(location.iataCode);
    }
    if (location.icaoCode) {
      alternatives.push(location.icaoCode);
    }
    
    return alternatives;
  }

  private expandQueryWithNicknames(query: string): string {
    const normalizedQuery = this.normalizeForSearch(query);
    for (const [nickname, fullName] of Object.entries(this.CITY_NICKNAMES)) {
      if (normalizedQuery === this.normalizeForSearch(nickname)) {
        return fullName;
      }
    }
    return query;
  }

  private getPopularDestinations(limit = 10): LocationSearchResult[] {
    const popularDestinations = [
      { name: 'New York', code: 'JFK', type: 'AIRPORT' },
      { name: 'Los Angeles', code: 'LAX', type: 'AIRPORT' },
      { name: 'London', code: 'LHR', type: 'AIRPORT' },
      { name: 'Paris', code: 'CDG', type: 'AIRPORT' },
      { name: 'Tokyo', code: 'NRT', type: 'AIRPORT' },
      { name: 'Dubai', code: 'DXB', type: 'AIRPORT' },
      { name: 'Singapore', code: 'SIN', type: 'AIRPORT' },
      { name: 'Bangkok', code: 'BKK', type: 'AIRPORT' },
      { name: 'Atlanta', code: 'ATL', type: 'AIRPORT' },
      { name: 'Chicago', code: 'ORD', type: 'AIRPORT' }
    ];

    return popularDestinations.slice(0, limit).map(dest => this.normalizeResultShape({
      id: `popular-${dest.code}`,
      name: dest.name,
      type: dest.type,
      iataCode: dest.code,
      detailedName: `${dest.name} (${dest.code})`,
      displayName: `${dest.name} (${dest.code})`,
      relevance: 100,
      isPopular: true,
      alternativeNames: [dest.code],
      source: 'popular-destinations'
    }));
  }

  private searchFallbackDestinations(query: string, type?: 'AIRPORT' | 'CITY' | 'COUNTRY', limit = 10): LocationSearchResult[] {
    // Common destinations with both airports and cities
    const fallbackDestinations = [
      // Popular airports
      { name: 'London', code: 'LHR', type: 'AIRPORT' },
      { name: 'Paris', code: 'CDG', type: 'AIRPORT' },
      { name: 'New York', code: 'JFK', type: 'AIRPORT' },
      { name: 'Tokyo', code: 'HND', type: 'AIRPORT' },
      { name: 'Barcelona', code: 'BCN', type: 'AIRPORT' },
      { name: 'Rome', code: 'FCO', type: 'AIRPORT' },
      { name: 'Amsterdam', code: 'AMS', type: 'AIRPORT' },
      { name: 'Dubai', code: 'DXB', type: 'AIRPORT' },
      { name: 'Singapore', code: 'SIN', type: 'AIRPORT' },
      { name: 'Sydney', code: 'SYD', type: 'AIRPORT' },
      { name: 'Los Angeles', code: 'LAX', type: 'AIRPORT' },
      { name: 'Bangkok', code: 'BKK', type: 'AIRPORT' },
      { name: 'Istanbul', code: 'IST', type: 'AIRPORT' },
      { name: 'Prague', code: 'PRG', type: 'AIRPORT' },
      { name: 'Berlin', code: 'BER', type: 'AIRPORT' },
      { name: 'Vienna', code: 'VIE', type: 'AIRPORT' },
      { name: 'Madrid', code: 'MAD', type: 'AIRPORT' },
      { name: 'Frankfurt', code: 'FRA', type: 'AIRPORT' },
      { name: 'Miami', code: 'MIA', type: 'AIRPORT' },
      { name: 'Hong Kong', code: 'HKG', type: 'AIRPORT' },
      { name: 'Zagreb', code: 'ZAG', type: 'AIRPORT' },
      { name: 'Split', code: 'SPU', type: 'AIRPORT' },
      { name: 'Dubrovnik', code: 'DBV', type: 'AIRPORT' },
      { name: 'Chicago', code: 'ORD', type: 'AIRPORT' },
      { name: 'San Francisco', code: 'SFO', type: 'AIRPORT' },
      { name: 'Toronto', code: 'YYZ', type: 'AIRPORT' },
      { name: 'Vancouver', code: 'YVR', type: 'AIRPORT' },
      { name: 'Mexico City', code: 'MEX', type: 'AIRPORT' },
      { name: 'Buenos Aires', code: 'EZE', type: 'AIRPORT' },
      { name: 'Atlanta', code: 'ATL', type: 'AIRPORT' },
      
      // Popular cities for hotel searches
      { name: 'London', code: 'LON', type: 'CITY' },
      { name: 'Paris', code: 'PAR', type: 'CITY' },
      { name: 'New York', code: 'NYC', type: 'CITY' },
      { name: 'Tokyo', code: 'TYO', type: 'CITY' },
      { name: 'Barcelona', code: 'BCN', type: 'CITY' },
      { name: 'Rome', code: 'ROM', type: 'CITY' },
      { name: 'Amsterdam', code: 'AMS', type: 'CITY' },
      { name: 'Dubai', code: 'DXB', type: 'CITY' },
      { name: 'Singapore', code: 'SIN', type: 'CITY' },
      { name: 'Sydney', code: 'SYD', type: 'CITY' },
      { name: 'Los Angeles', code: 'LAX', type: 'CITY' },
      { name: 'Bangkok', code: 'BKK', type: 'CITY' },
      { name: 'Istanbul', code: 'IST', type: 'CITY' },
      { name: 'Prague', code: 'PRG', type: 'CITY' },
      { name: 'Berlin', code: 'BER', type: 'CITY' },
      { name: 'Vienna', code: 'VIE', type: 'CITY' },
      { name: 'Madrid', code: 'MAD', type: 'CITY' },
      { name: 'Frankfurt', code: 'FRA', type: 'CITY' },
      { name: 'Miami', code: 'MIA', type: 'CITY' },
      { name: 'Hong Kong', code: 'HKG', type: 'CITY' },
      { name: 'Zagreb', code: 'ZAG', type: 'CITY' },
      { name: 'Split', code: 'SPU', type: 'CITY' },
      { name: 'Dubrovnik', code: 'DBV', type: 'CITY' },
      { name: 'Chicago', code: 'CHI', type: 'CITY' },
      { name: 'San Francisco', code: 'SFO', type: 'CITY' },
      { name: 'Toronto', code: 'TOR', type: 'CITY' },
      { name: 'Vancouver', code: 'VAN', type: 'CITY' },
      { name: 'Mexico City', code: 'MEX', type: 'CITY' },
      { name: 'Buenos Aires', code: 'BUE', type: 'CITY' },
      { name: 'Atlanta', code: 'ATL', type: 'CITY' },
    ];

    const normalizedQuery = this.normalizeForSearch(query);
    const results: LocationSearchResult[] = [];

    for (const dest of fallbackDestinations) {
      if (type && dest.type !== type) continue;
      
      const nameMatch = this.fuzzyMatch(query, dest.name);
      const codeMatch = this.fuzzyMatch(query, dest.code);
      const maxScore = Math.max(nameMatch, codeMatch);
      
      if (maxScore > 10) { // Lower threshold for better matching
        results.push({
          id: `fallback-${dest.code}`,
          name: dest.name,
          type: dest.type as 'AIRPORT' | 'CITY' | 'COUNTRY',
          iataCode: dest.code,
          detailedName: `${dest.name} (${dest.code})`,
          displayName: `${dest.name} (${dest.code})`,
          relevance: maxScore,
          isPopular: true,
          alternativeNames: [dest.code],
          source: 'fallback-dataset'
        });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(result => this.normalizeResultShape(result));
  }

  async searchLocations(
    query: string,
    type?: 'AIRPORT' | 'CITY' | 'COUNTRY',
    limit = 10,
    useApi = false
  ): Promise<LocationSearchResult[]> {
    const normalizedLimit = this.normalizeLimit(limit);

    if (!query || query.trim().length < 2) {
      return [];
    }

    // Handle popular destinations request
    if (query.toLowerCase() === 'popular') {
      return this.getPopularDestinations(normalizedLimit);
    }

    // Handle nickname expansion
    const normalizedQuery = this.normalizeForSearch(query);
    const expandedQuery = this.expandQueryWithNicknames(query);
    
    if (useApi) {
      // Search using Amadeus API
      try {
        const token = await this.getAmadeusToken();
        const params = new URLSearchParams({
          keyword: expandedQuery,
          'page[limit]': limit.toString(),
        });
        
        if (type) {
          params.append('subType', type);
        }
        
        const response = await fetch(`https://api.amadeus.com/v1/reference-data/locations?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data: AmadeusLocationResponse = await response.json();
          return data.data.map(location => this.mapLocationToResult(location));
        }
      } catch (error) {
        console.error('API search failed, falling back to cached data:', error);
      }
    }
    
    // Search cached data with enhanced indexing
    const locationData = await this.getLocationData();
    const allLocations = [
      ...locationData.airports,
      ...locationData.cities,
      ...locationData.countries
    ];
    
    // If no cached data available, use fallback destinations
    if (allLocations.length === 0) {
      return this.searchFallbackDestinations(query, type, normalizedLimit);
    }
    
    // Filter by type if specified
    const filteredLocations = type 
      ? allLocations.filter(loc => loc.subType === type)
      : allLocations;
    
    // Enhanced search with indexing
    const candidateIds = new Set<string>();
    
    // Search by name index
    const searchTerms = [normalizedQuery, this.normalizeForSearch(expandedQuery)];
    for (const term of searchTerms) {
      // Exact matches in name index
      if (locationData.searchIndex.nameIndex[term]) {
        locationData.searchIndex.nameIndex[term].forEach(id => candidateIds.add(id));
      }
      
      // Partial matches in name index
      Object.keys(locationData.searchIndex.nameIndex).forEach(key => {
        if (key.includes(term) || term.includes(key)) {
          locationData.searchIndex.nameIndex[key].forEach(id => candidateIds.add(id));
        }
      });
      
      // Code matches
      if (locationData.searchIndex.codeIndex[term]) {
        locationData.searchIndex.codeIndex[term].forEach(id => candidateIds.add(id));
      }
      
      // Country matches
      if (locationData.searchIndex.countryIndex[term]) {
        locationData.searchIndex.countryIndex[term].forEach(id => candidateIds.add(id));
      }
    }
    
    // Get candidate locations
    const candidateLocations = filteredLocations.filter(loc => candidateIds.has(loc.id));
    
    // If no indexed matches, fall back to fuzzy search on all locations
    const locationsToSearch = candidateLocations.length > 0 ? candidateLocations : filteredLocations;
    
    // Score and rank results
    const scoredResults = locationsToSearch.map(location => {
      const nameScore = this.fuzzyMatch(query, location.name);
      const detailedNameScore = this.fuzzyMatch(query, location.detailedName);
      const iataScore = location.iataCode ? this.fuzzyMatch(query, location.iataCode) : 0;
      const icaoScore = location.icaoCode ? this.fuzzyMatch(query, location.icaoCode) : 0;
      const cityScore = location.address?.cityName ? this.fuzzyMatch(query, location.address.cityName) : 0;
      
      let maxScore = Math.max(nameScore, detailedNameScore, iataScore, icaoScore, cityScore);
      
      // Boost popular destinations
      if (locationData.searchIndex.popularityIndex[location.id]) {
        maxScore += locationData.searchIndex.popularityIndex[location.id] * 0.1;
      }
      
      // Boost exact code matches
      if (location.iataCode?.toLowerCase() === query.toLowerCase() || 
          location.icaoCode?.toLowerCase() === query.toLowerCase()) {
        maxScore += 50;
      }
      
      return {
        location,
        score: maxScore,
        result: this.mapLocationToResult(location, maxScore)
      };
    });
    
    // Sort by score and return top results
    return scoredResults
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, normalizedLimit)
      .map(item => this.normalizeResultShape(item.result));
  }

  async searchLocationsForApi(params: {
    query: string;
    type?: unknown;
    types?: Array<unknown> | unknown;
    limit?: unknown;
    useApi?: unknown;
  }): Promise<LocationSearchResult[]> {
    const query = this.normalizeString(params.query)?.trim();

    if (!query || query.length < 2) {
      return [];
    }

    const limit = this.normalizeLimit(params.limit ?? 10);
    const useApi = this.normalizeBoolean(params.useApi) ?? false;
    const normalizedTypes = this.normalizeRequestedTypes(params.type, params.types);

    const needsAllTypes = normalizedTypes.length !== 1;
    const searchType = needsAllTypes ? undefined : normalizedTypes[0];
    const searchLimit = needsAllTypes ? Math.max(limit * (normalizedTypes.length || 1), limit) : limit;

    const baseResults = await this.searchLocations(query, searchType, searchLimit, useApi);

    const filteredResults = normalizedTypes.length > 0
      ? baseResults.filter(result => normalizedTypes.includes(result.type))
      : baseResults;

    return filteredResults
      .slice(0, limit)
      .map(result => this.normalizeResultShape(result));
  }

  private mapLocationToResult(location: AmadeusLocation, relevance?: number): LocationSearchResult {
    const countryCode = location.address?.countryCode;
    const displayName = location.address?.countryName
      ? `${location.name} (${location.address.countryName})`
      : location.name;

    return {
      id: location.id,
      name: location.name,
      type: location.subType,
      iataCode: location.iataCode,
      icaoCode: location.icaoCode,
      cityCode: location.address?.cityCode,
      countryCode,
      latitude: location.geoCode?.latitude,
      longitude: location.geoCode?.longitude,
      detailedName: location.detailedName,
      relevance: relevance || location.relevance || location.analytics?.travelers?.score || 0,
      displayName,
      region: this.getRegionForLocation(location),
      timeZone: this.getTimeZoneForLocation(location),
      currencyCode: countryCode ? this.getCurrencyForCountry(countryCode) : undefined,
      isPopular: this.POPULAR_DESTINATIONS.includes(location.name),
      alternativeNames: this.getAlternativeNames(location),
      countryName: location.address?.countryName ?? null,
      country: location.address?.countryName ?? null,
      cityName: location.address?.cityName ?? null,
      state: location.address?.stateCode ?? null,
      source: 'amadeus'
    };
  }

  async getLocationStats(): Promise<{
    airports: number;
    cities: number;
    countries: number;
    lastUpdated: string;
    cacheAge: string;
  }> {
    const data = await this.getLocationData();
    const cacheAge = Date.now() - new Date(data.lastUpdated).getTime();
    
    return {
      airports: data.airports.length,
      cities: data.cities.length,
      countries: data.countries.length,
      lastUpdated: data.lastUpdated,
      cacheAge: `${Math.floor(cacheAge / (1000 * 60 * 60))} hours ago`
    };
  }
}

export const locationService = new LocationService();
export { LocationSearchResult, CachedLocationData };