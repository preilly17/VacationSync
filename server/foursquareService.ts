import axios from 'axios';

interface FoursquareRestaurant {
  fsq_place_id: string;
  name: string;
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    formatted_address?: string;
  };
  categories: Array<{
    fsq_category_id: string;
    name: string;
    short_name: string;
    plural_name: string;
    icon: {
      prefix: string;
      suffix: string;
    };
  }>;
  rating?: number;
  price?: number;
  distance?: number;
  tel?: string;
  website?: string;
  tips?: Array<{
    text: string;
    user: {
      first_name: string;
    };
  }>;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  rating: number;
  priceRange: string;
  phone?: string;
  website?: string;
  distance?: number;
  tips?: string[];
  bookingLinks: Array<{
    text: string;
    url: string;
    type: string;
  }>;
}

interface SearchOptions {
  limit?: number;
  radius?: number;
  cuisine?: string;
  priceRange?: string;
}

class FoursquareService {
  private apiKey: string;
  private baseUrl = 'https://places-api.foursquare.com';
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor() {
    this.apiKey = process.env.FOURSQUARE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  FOURSQUARE_API_KEY not found - will use OpenStreetMap fallback only');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json',
      'X-Places-Api-Version': '2025-06-17',
    };
  }

  private getCacheKey(cityName: string, options: SearchOptions = {}) {
    return `restaurants_${cityName.toLowerCase()}_${JSON.stringify(options)}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    return cacheAge < maxAge;
  }

  private async getCityCoordinates(cityName: string): Promise<{ lat: number; lng: number } | null> {
    try {
      console.log(`🌍 Geocoding location: ${cityName}`);
      
      // First try the fallback list for common cities (faster)
      const fallbackCoords = this.getFallbackCoordinates(cityName);
      if (fallbackCoords) {
        console.log(`✅ Found coordinates from fallback for ${cityName}: ${fallbackCoords.lat}, ${fallbackCoords.lng}`);
        return fallbackCoords;
      }
      
      // Use OpenStreetMap Nominatim API for free geocoding
      const encodedCity = encodeURIComponent(cityName.trim());
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedCity}&format=json&limit=1&addressdetails=1`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'TripSync-Travel-App/1.0 (https://tripsync.app)', // Required by Nominatim
        },
      });
      
      if (!response.ok) {
        console.log(`❌ Nominatim API error: ${response.status}, trying fallback for ${cityName}`);
        return this.getFallbackCoordinates(cityName);
      }
      
      const data = await response.json();
      
      if (!data || data.length === 0) {
        console.log(`❌ No coordinates found via Nominatim for: ${cityName}, trying fallback`);
        return this.getFallbackCoordinates(cityName);
      }
      
      const location = data[0];
      const coordinates = {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lon)
      };
      
      console.log(`✅ Found coordinates via Nominatim for ${cityName}: ${coordinates.lat}, ${coordinates.lng}`);
      return coordinates;
      
    } catch (error) {
      console.error(`❌ Geocoding error for ${cityName}:`, error);
      console.log(`🔄 Trying fallback coordinates for ${cityName}`);
      return this.getFallbackCoordinates(cityName);
    }
  }

  // Fallback function for popular cities if geocoding fails
  private getFallbackCoordinates(cityName: string): { lat: number; lng: number } | null {
    const fallbackCities: { [key: string]: { lat: number; lng: number } } = {
      'paris': { lat: 48.8566, lng: 2.3522 },
      'london': { lat: 51.5074, lng: -0.1278 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'rome': { lat: 41.9028, lng: 12.4964 },
      'barcelona': { lat: 41.3851, lng: 2.1734 },
      'madrid': { lat: 40.4168, lng: -3.7038 },
      'milan': { lat: 45.4642, lng: 9.1900 },
      'amsterdam': { lat: 52.3676, lng: 4.9041 },
      'berlin': { lat: 52.5200, lng: 13.4050 },
      'vienna': { lat: 48.2082, lng: 16.3738 },
      'prague': { lat: 50.0755, lng: 14.4378 },
      'budapest': { lat: 47.4979, lng: 19.0402 },
      'athens': { lat: 37.9838, lng: 23.7275 },
      'lisbon': { lat: 38.7223, lng: -9.1393 },
      'dublin': { lat: 53.3498, lng: -6.2603 },
      'stockholm': { lat: 59.3293, lng: 18.0686 },
      'copenhagen': { lat: 55.6761, lng: 12.5683 },
      'oslo': { lat: 59.9139, lng: 10.7522 },
      'helsinki': { lat: 60.1699, lng: 24.9384 },
      'warsaw': { lat: 52.2297, lng: 21.0122 },
      'moscow': { lat: 55.7558, lng: 37.6173 },
      'istanbul': { lat: 41.0082, lng: 28.9784 },
      'zurich': { lat: 47.3769, lng: 8.5417 },
      'geneva': { lat: 46.2044, lng: 6.1432 },
      'munich': { lat: 48.1351, lng: 11.5820 },
      'frankfurt': { lat: 50.1109, lng: 8.6821 },
      'hamburg': { lat: 53.5511, lng: 9.9937 },
      'cologne': { lat: 50.9375, lng: 6.9603 },
      'florence': { lat: 43.7696, lng: 11.2558 },
      'venice': { lat: 45.4408, lng: 12.3155 },
      'naples': { lat: 40.8518, lng: 14.2681 },
      'brussels': { lat: 50.8503, lng: 4.3517 },
      'antwerp': { lat: 51.2194, lng: 4.4025 },
      'lyon': { lat: 45.7640, lng: 4.8357 },
      'marseille': { lat: 43.2965, lng: 5.3698 },
      'nice': { lat: 43.7102, lng: 7.2620 },
      'bordeaux': { lat: 44.8378, lng: -0.5792 },
      'toulouse': { lat: 43.6047, lng: 1.4442 },
      'seville': { lat: 37.3891, lng: -5.9845 },
      'valencia': { lat: 39.4699, lng: -0.3763 },
      'bilbao': { lat: 43.2627, lng: -2.9253 },
      'porto': { lat: 41.1579, lng: -8.6291 },
      'zagreb': { lat: 45.8150, lng: 15.9819 },
      'split': { lat: 43.5081, lng: 16.4402 },
      'dubrovnik': { lat: 42.6507, lng: 18.0944 },
      'ljubljana': { lat: 46.0569, lng: 14.5058 },
      'belgrade': { lat: 44.7866, lng: 20.4489 },
      'sarajevo': { lat: 43.8486, lng: 18.3564 },
      'sofia': { lat: 42.6977, lng: 23.3219 },
      'bucharest': { lat: 44.4268, lng: 26.1025 },
      'krakow': { lat: 50.0647, lng: 19.9450 },
      'gdansk': { lat: 54.3520, lng: 18.6466 },
      'tallinn': { lat: 59.4370, lng: 24.7536 },
      'riga': { lat: 56.9496, lng: 24.1052 },
      'vilnius': { lat: 54.6872, lng: 25.2797 },
      'beijing': { lat: 39.9042, lng: 116.4074 },
      'shanghai': { lat: 31.2304, lng: 121.4737 },
      'hong kong': { lat: 22.3193, lng: 114.1694 },
      'seoul': { lat: 37.5665, lng: 126.9780 },
      'singapore': { lat: 1.3521, lng: 103.8198 },
      'bangkok': { lat: 13.7563, lng: 100.5018 },
      'mumbai': { lat: 19.0760, lng: 72.8777 },
      'delhi': { lat: 28.7041, lng: 77.1025 },
      'dubai': { lat: 25.2048, lng: 55.2708 },
      'sydney': { lat: -33.8688, lng: 151.2093 },
      'melbourne': { lat: -37.8136, lng: 144.9631 },
      'brisbane': { lat: -27.4698, lng: 153.0251 },
      'perth': { lat: -31.9505, lng: 115.8605 },
      'auckland': { lat: -36.8485, lng: 174.7633 },
      'wellington': { lat: -41.2924, lng: 174.7787 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'san francisco': { lat: 37.7749, lng: -122.4194 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'miami': { lat: 25.7617, lng: -80.1918 },
      'las vegas': { lat: 36.1699, lng: -115.1398 },
      'seattle': { lat: 47.6062, lng: -122.3321 },
      'boston': { lat: 42.3601, lng: -71.0589 },
      'washington': { lat: 38.9072, lng: -77.0369 },
      'philadelphia': { lat: 39.9526, lng: -75.1652 },
      'atlanta': { lat: 33.7490, lng: -84.3880 },
      'denver': { lat: 39.7392, lng: -104.9903 },
      'phoenix': { lat: 33.4484, lng: -112.0740 },
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'charlotte': { lat: 35.2271, lng: -80.8431 },
      'austin': { lat: 30.2672, lng: -97.7431 },
      'nashville': { lat: 36.1627, lng: -86.7816 },
      'oklahoma city': { lat: 35.4676, lng: -97.5164 },
      'memphis': { lat: 35.1495, lng: -90.0490 },
      'new orleans': { lat: 29.9511, lng: -90.0715 },
      'raleigh': { lat: 35.7796, lng: -78.6382 },
      'birmingham': { lat: 33.5186, lng: -86.8104 },
      'salt lake city': { lat: 40.7608, lng: -111.8910 },
      'portland': { lat: 45.5152, lng: -122.6784 },
      'kansas city': { lat: 39.0997, lng: -94.5786 },
      'milwaukee': { lat: 43.0389, lng: -87.9065 },
      'cleveland': { lat: 41.4993, lng: -81.6944 },
      'cincinnati': { lat: 39.1031, lng: -84.5120 },
      'pittsburgh': { lat: 40.4406, lng: -79.9959 },
      'buffalo': { lat: 42.8864, lng: -78.8784 },
      'sacramento': { lat: 38.5816, lng: -121.4944 },
      'fresno': { lat: 36.7378, lng: -119.7871 },
      'reno': { lat: 39.5296, lng: -119.8138 },
      'boise': { lat: 43.6150, lng: -116.2023 },
      'spokane': { lat: 47.6587, lng: -117.4260 },
      'anchorage': { lat: 61.2181, lng: -149.9003 },
      'toronto': { lat: 43.6532, lng: -79.3832 },
      'montreal': { lat: 45.5017, lng: -73.5673 },
      'vancouver': { lat: 49.2827, lng: -123.1207 },
      'mexico city': { lat: 19.4326, lng: -99.1332 },
      'cancun': { lat: 21.1619, lng: -86.8515 },
      'guadalajara': { lat: 20.6597, lng: -103.3496 },
      'monterrey': { lat: 25.6866, lng: -100.3161 },
      'sao paulo': { lat: -23.5505, lng: -46.6333 },
      'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
      'buenos aires': { lat: -34.6118, lng: -58.3960 },
      'lima': { lat: -12.0464, lng: -77.0428 },
      'bogota': { lat: 4.7110, lng: -74.0721 },
      'santiago': { lat: -33.4489, lng: -70.6693 },
      'quito': { lat: -0.1807, lng: -78.4678 },
      'caracas': { lat: 10.4806, lng: -66.9036 },
      'cairo': { lat: 30.0444, lng: 31.2357 },
      'casablanca': { lat: 33.5731, lng: -7.5898 },
      'marrakech': { lat: 31.6295, lng: -7.9811 },
      'tunis': { lat: 36.8065, lng: 10.1815 },
      'cape town': { lat: -33.9249, lng: 18.4241 },
      'johannesburg': { lat: -26.2041, lng: 28.0473 },
      'nairobi': { lat: -1.2921, lng: 36.8219 },
      'lagos': { lat: 6.5244, lng: 3.3792 },
      'addis ababa': { lat: 9.1450, lng: 40.4897 },
      'tel aviv': { lat: 32.0853, lng: 34.7818 },
      'jerusalem': { lat: 31.7683, lng: 35.2137 },
      'doha': { lat: 25.2767, lng: 51.5200 },
      'abu dhabi': { lat: 24.2539, lng: 54.3773 },
      'riyadh': { lat: 24.7136, lng: 46.6753 },
      'kuwait city': { lat: 29.3759, lng: 47.9774 },
      'amman': { lat: 31.9454, lng: 35.9284 },
      'beirut': { lat: 33.8938, lng: 35.5018 },
      'bali': { lat: -8.4095, lng: 115.1889 },
      'phuket': { lat: 7.8804, lng: 98.3923 },
      'maldives': { lat: 3.2028, lng: 73.2207 },
      'santorini': { lat: 36.3932, lng: 25.4615 },
      'mykonos': { lat: 37.4467, lng: 25.3289 },
      'crete': { lat: 35.2401, lng: 24.8093 },
      'mallorca': { lat: 39.6953, lng: 2.9088 },
      'ibiza': { lat: 38.9067, lng: 1.4206 },
      'sicily': { lat: 37.5079, lng: 15.0830 },
      'corsica': { lat: 42.0396, lng: 9.0129 },
      'sardinia': { lat: 40.1209, lng: 9.0129 },
      'hawaii': { lat: 21.3099, lng: -157.8581 },
      'jamaica': { lat: 18.1096, lng: -77.2975 },
      'barbados': { lat: 13.1939, lng: -59.5432 },
      'mauritius': { lat: -20.3484, lng: 57.5522 },
      'seychelles': { lat: -4.6796, lng: 55.492 },
      'fiji': { lat: -16.5782, lng: 179.4144 },
      'tahiti': { lat: -17.6797, lng: -149.4068 },
      'iceland': { lat: 64.1466, lng: -21.9426 },
      'reykjavik': { lat: 64.1466, lng: -21.9426 }
    };

    const lowerCity = cityName.toLowerCase().trim();
    return fallbackCities[lowerCity] || null;
  }

  private createBookingLinks(restaurant: FoursquareRestaurant): Array<{ text: string; url: string; type: string }> {
    const links = [];

    // Restaurant website first
    if (restaurant.website) {
      links.push({
        text: "Restaurant Website",
        url: restaurant.website,
        type: "direct"
      });
    }

    // Generic OpenTable search
    const cityName = restaurant.location?.locality || restaurant.location?.region || '';
    const openTableSearch = `https://www.opentable.com/s?term=${encodeURIComponent(restaurant.name + ' ' + cityName)}`;
    links.push({
      text: "Search OpenTable",
      url: openTableSearch,
      type: "search"
    });

    // Phone number
    if (restaurant.tel) {
      links.push({
        text: `Call ${restaurant.tel}`,
        url: `tel:${restaurant.tel}`,
        type: "phone"
      });
    }

    // Google search as fallback
    const googleSearch = `https://www.google.com/search?q=${encodeURIComponent(restaurant.name + ' ' + cityName + ' restaurant reservation')}`;
    links.push({
      text: "Search Google",
      url: googleSearch,
      type: "search"
    });

    return links;
  }

  private formatRestaurant(restaurant: FoursquareRestaurant): Restaurant {
    const primaryCategory = restaurant.categories[0];
    const cuisine = primaryCategory ? primaryCategory.name : 'Restaurant';
    
    // Convert Foursquare rating (0-10) to more familiar format
    const rating = restaurant.rating ? Math.round(restaurant.rating * 10) / 10 : 0;
    
    // Convert price level to dollar signs
    const priceRange = restaurant.price ? '$'.repeat(restaurant.price) : '$';
    
    // Format address
    const address = restaurant.location?.formatted_address || 
                   `${restaurant.location?.address || ''}, ${restaurant.location?.locality || ''}`.trim() || 'Address not available';
    
    // Extract tips
    const tips = restaurant.tips?.slice(0, 2).map(tip => tip.text) || [];

    return {
      id: restaurant.fsq_place_id,
      name: restaurant.name,
      address: address,
      cuisine: cuisine,
      rating: rating,
      priceRange: priceRange,
      phone: restaurant.tel,
      website: restaurant.website,
      distance: restaurant.distance,
      tips: tips,
      bookingLinks: this.createBookingLinks(restaurant)
    };
  }

  async searchRestaurants(cityName: string, options: SearchOptions = {}): Promise<Restaurant[]> {
    console.log(`🔍 Searching restaurants in: ${cityName}`);
    const cacheKey = this.getCacheKey(cityName, options);
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`💨 Returning cached results for ${cityName}`);
      return this.cache.get(cacheKey)!.data;
    }

    // If no API key, skip Foursquare and use OpenStreetMap fallback directly
    if (!this.apiKey) {
      console.log(`🔄 No Foursquare API key - using OpenStreetMap fallback for ${cityName}`);
      try {
        const fallbackResults = await this.searchRestaurantsOpenStreetMap(cityName, options);
        if (fallbackResults.length > 0) {
          console.log(`✅ Found ${fallbackResults.length} restaurants using OpenStreetMap fallback`);
          
          // Cache the fallback results
          this.cache.set(cacheKey, {
            data: fallbackResults,
            timestamp: Date.now()
          });
          
          return fallbackResults;
        }
      } catch (fallbackError) {
        console.error('OpenStreetMap fallback failed:', fallbackError);
      }
      return []; // Return empty array if fallback also fails
    }

    try {
      // Get city coordinates
      const coordinates = await this.getCityCoordinates(cityName);
      if (!coordinates) {
        throw new Error(`Could not find coordinates for city: ${cityName}`);
      }

      const params: any = {
        ll: `${coordinates.lat},${coordinates.lng}`,
        categories: '13065,13236,13148,13099,13303,13031,13263,13199,13352,13339', // Restaurant and cuisine categories
        limit: options.limit || 20,
        radius: options.radius || 5000,
        sort: 'RATING',
        fields: 'fsq_place_id,name,location,categories,rating,price,distance,tel,website,tips'
      };

      // Add cuisine filter if specified
      if (options.cuisine) {
        const cuisineMap: { [key: string]: string } = {
          'italian': '13236',
          'french': '13148',
          'asian': '13099',
          'mexican': '13303',
          'american': '13031',
          'chinese': '13099',
          'japanese': '13263',
          'indian': '13199',
          'thai': '13352',
          'spanish': '13339'
        };
        
        if (cuisineMap[options.cuisine.toLowerCase()]) {
          params.categories = cuisineMap[options.cuisine.toLowerCase()];
        }
      }

      const response = await axios.get(`${this.baseUrl}/places/search`, {
        headers: this.getHeaders(),
        params
      });

      if (!response.data.results) {
        throw new Error('No results returned from Foursquare API');
      }

      let restaurants = response.data.results.map((restaurant: FoursquareRestaurant) => 
        this.formatRestaurant(restaurant)
      );

      // Filter by price range if specified
      if (options.priceRange) {
        restaurants = restaurants.filter((restaurant: Restaurant) => 
          restaurant.priceRange === options.priceRange
        );
      }

      // Cache the results
      this.cache.set(cacheKey, {
        data: restaurants,
        timestamp: Date.now()
      });

      console.log(`Found ${restaurants.length} restaurants in ${cityName}`);
      return restaurants;

    } catch (error) {
      console.error('Error searching restaurants:', error);
      console.log('🔄 Foursquare failed, trying OpenStreetMap fallback...');
      
      // Try OpenStreetMap fallback when Foursquare fails
      try {
        const fallbackResults = await this.searchRestaurantsOpenStreetMap(cityName, options);
        if (fallbackResults.length > 0) {
          console.log(`✅ Found ${fallbackResults.length} restaurants using OpenStreetMap fallback`);
          
          // Cache the fallback results
          this.cache.set(cacheKey, {
            data: fallbackResults,
            timestamp: Date.now()
          });
          
          return fallbackResults;
        }
      } catch (fallbackError) {
        console.error('OpenStreetMap fallback also failed:', fallbackError);
      }
      
      throw new Error(`Failed to search restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRestaurantDetails(fsqId: string): Promise<Restaurant | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/places/${fsqId}`, {
        headers: this.getHeaders(),
        params: {
          fields: 'name,location,categories,rating,price,distance,tel,website,tips'
        }
      });

      if (!response.data) {
        return null;
      }

      return this.formatRestaurant(response.data);
    } catch (error) {
      console.error('Error getting restaurant details:', error);
      return null;
    }
  }

  // Fallback method using OpenStreetMap Overpass API (completely free)
  private async searchRestaurantsOpenStreetMap(cityName: string, options: SearchOptions = {}): Promise<Restaurant[]> {
    try {
      console.log(`🗺️ Searching restaurants using OpenStreetMap for: ${cityName}`);
      
      // Get city coordinates first
      const coordinates = await this.getCityCoordinates(cityName);
      if (!coordinates) {
        throw new Error(`Could not find coordinates for city: ${cityName}`);
      }

      // Get search radius in meters (options.radius is already in meters, not km!)
      const radiusMeters = options.radius || 5000; // Default to 5000 meters (5 km)

      // Build Overpass QL query for restaurants (simplified format that works)
      let cuisineFilter = '';
      if (options.cuisine) {
        const cuisineKeywords = this.getCuisineKeywords(options.cuisine);
        cuisineFilter = cuisineKeywords.map(keyword => `["cuisine"~"${keyword}",i]`).join('');
      }
      const overpassQuery = `[out:json][timeout:30];(node["amenity"="restaurant"]${cuisineFilter}(around:${radiusMeters},${coordinates.lat},${coordinates.lng});node["amenity"="fast_food"]${cuisineFilter}(around:${radiusMeters},${coordinates.lat},${coordinates.lng});node["amenity"="cafe"]${cuisineFilter}(around:${radiusMeters},${coordinates.lat},${coordinates.lng}););out body;`;

      console.log(`🌐 Making request to Overpass API...`);
      console.log(`📝 Query: ${overpassQuery}`);
      console.log(`🎯 Coordinates: ${coordinates.lat}, ${coordinates.lng}`);
      console.log(`📏 Radius: ${radiusMeters}m`);
      
      // Create the exact request body format that worked in curl
      const requestBody = `data=${encodeURIComponent(overpassQuery)}`;
      console.log(`📦 Request body length: ${requestBody.length}`);
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'VacationSync-Travel-App/1.0',
        },
        body: requestBody
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`❌ OpenStreetMap API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`❌ Error response body:`, errorText);
        throw new Error(`OpenStreetMap API error: ${response.status} - ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log(`📄 Raw response length: ${responseText.length} characters`);
      console.log(`🔍 Response preview:`, responseText.substring(0, 200) + '...');
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ JSON parsing error:`, parseError);
        console.error(`📄 Full response text:`, responseText);
        throw new Error(`Failed to parse JSON response from OpenStreetMap: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      }

      console.log(`📊 Parsed response structure:`, {
        hasElements: !!data.elements,
        elementsLength: data.elements?.length || 0,
        hasVersion: !!data.version,
        hasGenerator: !!data.generator,
        keys: Object.keys(data || {})
      });
      
      if (data.elements && data.elements.length > 0) {
        console.log(`🔍 First 3 elements sample:`, data.elements.slice(0, 3).map((el: any) => ({
          id: el.id,
          tags: el.tags,
          hasName: !!el.tags?.name,
          amenity: el.tags?.amenity
        })));
      }
      
      console.log(`📍 OpenStreetMap API returned ${data.elements?.length || 0} total elements`);
      
      if (!data.elements || data.elements.length === 0) {
        console.log('No restaurants found in OpenStreetMap data');
        return [];
      }

      // Filter elements with names first
      const elementsWithNames = data.elements.filter((element: any) => element.tags?.name);
      console.log(`🏷️ Found ${elementsWithNames.length} restaurants with names out of ${data.elements.length} total`);
      
      if (elementsWithNames.length === 0) {
        console.log('No restaurants with names found in OpenStreetMap data');
        return [];
      }

      // Transform OpenStreetMap data to our Restaurant format
      let restaurants = elementsWithNames
        .slice(0, options.limit || 20) // Limit results
        .map((element: any) => this.formatOpenStreetMapRestaurant(element, coordinates));

      console.log(`🍽️ Formatted ${restaurants.length} restaurants successfully`);

      // Filter by price range if specified (basic filtering based on amenity type)
      if (options.priceRange) {
        const originalCount = restaurants.length;
        restaurants = restaurants.filter((restaurant: Restaurant) => {
          // Simple price range estimation based on restaurant type
          if (options.priceRange === '$' && restaurant.cuisine.includes('fast_food')) return true;
          if (options.priceRange === '$$' && !restaurant.cuisine.includes('fast_food')) return true;
          if (options.priceRange === '$$$') return true;
          if (options.priceRange === '$$$$') return true;
          return false;
        });
        console.log(`💰 Price range filter (${options.priceRange}) reduced results from ${originalCount} to ${restaurants.length}`);
      }

      console.log(`✅ Returning ${restaurants.length} restaurants from OpenStreetMap`);
      return restaurants;

    } catch (error) {
      console.error('OpenStreetMap restaurant search error:', error);
      throw error;
    }
  }

  // Helper method to get cuisine keywords for OpenStreetMap search
  private getCuisineKeywords(cuisine: string): string[] {
    const cuisineMap: { [key: string]: string[] } = {
      'italian': ['italian', 'pizza', 'pasta'],
      'french': ['french'],
      'asian': ['asian', 'chinese', 'japanese', 'thai', 'korean', 'vietnamese'],
      'mexican': ['mexican', 'tacos'],
      'american': ['american', 'burger'],
      'chinese': ['chinese'],
      'japanese': ['japanese', 'sushi'],
      'indian': ['indian'],
      'thai': ['thai'],
      'spanish': ['spanish', 'tapas']
    };
    
    return cuisineMap[cuisine.toLowerCase()] || [cuisine.toLowerCase()];
  }

  // Format OpenStreetMap restaurant data to our Restaurant interface
  private formatOpenStreetMapRestaurant(element: any, centerCoords: { lat: number; lng: number }): Restaurant {
    const tags = element.tags || {};
    
    // Calculate distance from center coordinates
    const distance = this.calculateDistance(
      centerCoords.lat, 
      centerCoords.lng, 
      element.lat, 
      element.lon
    );

    // Extract cuisine information
    let cuisine = tags.cuisine || tags.amenity || 'restaurant';
    if (Array.isArray(cuisine)) {
      cuisine = cuisine[0];
    }
    
    // Basic price range estimation
    let priceRange = '$$';
    if (tags.amenity === 'fast_food') priceRange = '$';
    if (tags['price:range'] === 'expensive') priceRange = '$$$';

    // Build address
    const addressParts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'] || tags['addr:village']
    ].filter(Boolean);
    
    const address = addressParts.length > 0 
      ? addressParts.join(' ') 
      : `${element.lat.toFixed(4)}, ${element.lon.toFixed(4)}`;

    return {
      id: `osm-${element.id}`,
      name: tags.name || 'Restaurant',
      address: address,
      cuisine: cuisine,
      rating: tags.rating ? parseFloat(tags.rating) : 3.5, // Default rating
      priceRange: priceRange,
      phone: tags.phone || tags['contact:phone'],
      website: tags.website || tags['contact:website'],
      distance: Math.round(distance * 1000), // Convert to meters
      tips: [],
      bookingLinks: [
        {
          text: 'View on OpenStreetMap',
          url: `https://www.openstreetmap.org/node/${element.id}`,
          type: 'info'
        }
      ]
    };
  }

  // Calculate distance between two coordinates (Haversine formula)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const foursquareService = new FoursquareService();
export type { Restaurant, SearchOptions };