import { Restaurant } from './foursquareService';
import { detectCurrencyByLocation, formatCurrency } from './currencyService';

export interface Activity {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  price: number;
  currency: string;
  rating: number;
  duration: string;
  category: string;
  location: string;
  latitude: number;
  longitude: number;
  images: string[];
  bookingUrl?: string;
  provider: string;
  website?: string;
  phone?: string;
  openingHours?: string[];
  openNow?: boolean;
  reviews?: Array<{
    text: string;
    rating: number;
    author: string;
  }>;
  totalReviews?: number;
  placeTypes?: string[];
}

interface GoogleMapsAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleMapsPlace {
  place_id: string;
  name: string;
  formatted_address: string;
  address_components?: GoogleMapsAddressComponent[];
  types: string[];
  rating?: number;
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
    width: number;
    height: number;
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now: boolean;
    weekday_text?: string[];
  };
  formatted_phone_number?: string;
  website?: string;
  reviews?: Array<{
    text: string;
    rating: number;
    author_name: string;
  }>;
  user_ratings_total?: number;
}

interface GoogleMapsSearchResponse {
  results: GoogleMapsPlace[];
  status: string;
  next_page_token?: string;
}

interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface GoogleSearchOptions {
  limit?: number;
  radius?: number;
  cuisine?: string;
  priceRange?: string;
  type?: 'restaurant' | 'lodging' | 'activity';
  activityTypes?: string[];
}

class GoogleMapsService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  GOOGLE_MAPS_API_KEY not found - Google Maps integration disabled');
    }
  }

  private getCacheKey(query: string, location: string, options: GoogleSearchOptions = {}) {
    return `gmaps_${query}_${location.toLowerCase()}_${JSON.stringify(options)}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    return cacheAge < maxAge;
  }

  private async geocodeLocation(location: string): Promise<LocationCoordinates | null> {
    try {
      console.log(`🌍 Geocoding location with Google Maps: ${location}`);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${this.apiKey}`
      );

      if (!response.ok) {
        console.log(`❌ Google Geocoding API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.log(`❌ No coordinates found via Google Geocoding for: ${location}`);
        return null;
      }

      const result = data.results[0];
      const coordinates = {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      };

      console.log(`✅ Found coordinates via Google Geocoding for ${location}: ${coordinates.lat}, ${coordinates.lng}`);
      return coordinates;
      
    } catch (error) {
      console.error(`❌ Google Geocoding error for ${location}:`, error);
      return null;
    }
  }

  private async getPlaceDetails(placeId: string): Promise<GoogleMapsPlace | null> {
    try {
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'place_id,name,formatted_address,address_components,types,rating,price_level,photos,geometry,opening_hours,formatted_phone_number,website,reviews,user_ratings_total',
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/details/json?${params}`);

      if (!response.ok) {
        console.log(`❌ Place details API error for ${placeId}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.result) {
        console.log(`❌ Place details API returned status for ${placeId}: ${data.status}`);
        return null;
      }

      return data.result as GoogleMapsPlace;
    } catch (error) {
      console.error(`❌ Error fetching place details for ${placeId}:`, error);
      return null;
    }
  }

  private formatEnhancedAddress(place: GoogleMapsPlace): string {
    // Always prefer formatted_address for nearby search results 
    // since address_components are not always included in nearby search
    if (place.formatted_address) {
      return place.formatted_address;
    }
    
    // If no formatted address, try address components as fallback
    if (!place.address_components || place.address_components.length === 0) {
      return 'Address not available';
    }

    const components = place.address_components;
    
    // Extract address components
    const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
    const route = components.find(c => c.types.includes('route'))?.long_name || '';
    const locality = components.find(c => c.types.includes('locality'))?.long_name || '';
    const adminAreaLevel1 = components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '';
    const postalCode = components.find(c => c.types.includes('postal_code'))?.long_name || '';
    const country = components.find(c => c.types.includes('country'))?.short_name || '';
    
    // Build formatted address parts
    const addressParts: string[] = [];
    
    // Street address (number + route)
    if (streetNumber && route) {
      addressParts.push(`${streetNumber} ${route}`);
    } else if (route) {
      addressParts.push(route);
    }
    
    // City, State ZIP format for US addresses
    if (country === 'US' && locality && adminAreaLevel1) {
      if (postalCode) {
        addressParts.push(`${locality}, ${adminAreaLevel1} ${postalCode}`);
      } else {
        addressParts.push(`${locality}, ${adminAreaLevel1}`);
      }
    } else {
      // International format
      if (locality) addressParts.push(locality);
      if (adminAreaLevel1) addressParts.push(adminAreaLevel1);
      if (postalCode) addressParts.push(postalCode);
      if (country && country !== 'US') addressParts.push(country);
    }
    
    const formattedAddress = addressParts.filter(part => part.length > 0).join(', ');
    
    // Fallback to formatted_address if our formatting resulted in empty string
    return formattedAddress || place.formatted_address || 'Address not available';
  }

  private createBookingLinks(place: GoogleMapsPlace, type: 'restaurant' | 'hotel'): Array<{ text: string; url: string; type: string }> {
    const links = [];

    // Website first
    if (place.website) {
      links.push({
        text: type === 'restaurant' ? "Restaurant Website" : "Hotel Website",
        url: place.website,
        type: "direct"
      });
    }

    if (type === 'restaurant') {
      // OpenTable search for restaurants - safely extract city name
      const cityName = place.formatted_address?.split(',')[1]?.trim() || '';
      const openTableSearch = `https://www.opentable.com/s?term=${encodeURIComponent(place.name + ' ' + cityName)}`;
      links.push({
        text: "Search OpenTable",
        url: openTableSearch,
        type: "search"
      });

      // Phone number
      if (place.formatted_phone_number) {
        links.push({
          text: `Call ${place.formatted_phone_number}`,
          url: `tel:${place.formatted_phone_number.replace(/\s+/g, '')}`,
          type: "phone"
        });
      }

      // Google search as fallback
      const googleSearch = `https://www.google.com/search?q=${encodeURIComponent(place.name + ' ' + cityName + ' restaurant reservation')}`;
      links.push({
        text: "Search Google",
        url: googleSearch,
        type: "search"
      });
    } else {
      // Hotel booking links
      const hotelSearch = `https://www.booking.com/search.html?ss=${encodeURIComponent(place.name)}`;
      links.push({
        text: "Search Booking.com",
        url: hotelSearch,
        type: "search"
      });

      const expediaSearch = `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(place.name)}`;
      links.push({
        text: "Search Expedia",
        url: expediaSearch,
        type: "search"
      });

      // Phone number for hotels
      if (place.formatted_phone_number) {
        links.push({
          text: `Call ${place.formatted_phone_number}`,
          url: `tel:${place.formatted_phone_number.replace(/\s+/g, '')}`,
          type: "phone"
        });
      }
    }

    return links;
  }

  private formatRestaurant(place: GoogleMapsPlace): Restaurant {
    // Extract cuisine from types - ensure place.types exists
    const cuisineTypes = (place.types || []).filter(type => 
      ['restaurant', 'food', 'meal_takeaway', 'meal_delivery'].includes(type)
    );
    const cuisine = cuisineTypes.length > 0 ? cuisineTypes[0].replace('_', ' ') : 'Restaurant';
    
    // Google Maps rating is already 1-5, convert to our 0-10 scale
    const rating = place.rating ? Math.round(place.rating * 2 * 10) / 10 : 0;
    
    // Convert price level to dollar signs (Google uses 0-4, we use $-$$$$)
    const priceRange = place.price_level ? '$'.repeat(place.price_level + 1) : '$';
    
    // Extract reviews as tips - safely handle undefined reviews
    const tips = place.reviews?.slice(0, 2).map(review => review.text) || [];

    // Use enhanced address formatting with fallback to formatted_address
    const formattedAddress = this.formatEnhancedAddress(place);

    return {
      id: place.place_id || '',
      name: place.name || 'Restaurant',
      address: formattedAddress,
      cuisine: cuisine,
      rating: rating,
      priceRange: priceRange,
      phone: place.formatted_phone_number || undefined,
      website: place.website || undefined,
      distance: 0, // Google doesn't provide distance in nearby search
      tips: tips,
      bookingLinks: this.createBookingLinks(place, 'restaurant')
    };
  }

  public async searchRestaurants(location: string, options: GoogleSearchOptions = {}): Promise<Restaurant[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    console.log(`🔍 Searching restaurants with Google Maps in: ${location}`);
    const cacheKey = this.getCacheKey('restaurants', location, options);
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`💨 Returning cached Google Maps results for ${location}`);
      return this.cache.get(cacheKey)!.data;
    }

    try {
      // Get location coordinates
      const coordinates = await this.geocodeLocation(location);
      if (!coordinates) {
        throw new Error(`Could not find coordinates for location: ${location}`);
      }

      // Build search parameters
      const params = new URLSearchParams({
        location: `${coordinates.lat},${coordinates.lng}`,
        radius: (options.radius || 5000).toString(),
        type: 'restaurant',
        key: this.apiKey
      });

      // Add cuisine keyword if specified
      if (options.cuisine) {
        params.set('keyword', options.cuisine);
      }

      const response = await fetch(`${this.baseUrl}/nearbysearch/json?${params}`);

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
      }

      const data: GoogleMapsSearchResponse = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API returned status: ${data.status}`);
      }

      if (!data.results || data.results.length === 0) {
        console.log('No restaurants found with Google Maps API');
        return [];
      }

      // Filter restaurants first
      const basicRestaurants = data.results
        .filter(place => 
          place.types.some(type => ['restaurant', 'food', 'meal_takeaway'].includes(type))
        )
        .slice(0, options.limit || 20);

      // Fetch detailed information including address components for each restaurant
      console.log(`🔍 Fetching detailed address information for ${basicRestaurants.length} restaurants`);
      const detailedRestaurants = await Promise.all(
        basicRestaurants.map(async (place) => {
          const detailedPlace = await this.getPlaceDetails(place.place_id);
          return detailedPlace || place; // Fallback to basic place if details fetch fails
        })
      );

      let restaurants = detailedRestaurants
        .map(place => this.formatRestaurant(place));

      // Filter by price range if specified
      if (options.priceRange) {
        restaurants = restaurants.filter(restaurant => 
          restaurant.priceRange === options.priceRange
        );
      }

      // Cache the results
      this.cache.set(cacheKey, {
        data: restaurants,
        timestamp: Date.now()
      });

      console.log(`✅ Found ${restaurants.length} restaurants with Google Maps in ${location}`);
      return restaurants;

    } catch (error) {
      console.error('❌ Google Maps restaurant search error:', error);
      throw error;
    }
  }

  public async searchHotels(
    location: string, 
    options: GoogleSearchOptions & { checkInDate?: string; checkOutDate?: string } = {}
  ): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    console.log(`🔍 Searching hotels with Google Maps in: ${location}`);
    const cacheKey = this.getCacheKey('hotels', location, options);
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`💨 Returning cached Google Maps hotel results for ${location}`);
      return this.cache.get(cacheKey)!.data;
    }

    try {
      // Get location coordinates
      const coordinates = await this.geocodeLocation(location);
      if (!coordinates) {
        throw new Error(`Could not find coordinates for location: ${location}`);
      }

      // Build search parameters
      const params = new URLSearchParams({
        location: `${coordinates.lat},${coordinates.lng}`,
        radius: (options.radius || 10000).toString(), // 10km for hotels
        type: 'lodging',
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/nearbysearch/json?${params}`);

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
      }

      const data: GoogleMapsSearchResponse = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API returned status: ${data.status}`);
      }

      if (!data.results || data.results.length === 0) {
        console.log('No hotels found with Google Maps API');
        return [];
      }

      const hotels = data.results
        .filter(place => 
          place.types.some(type => ['lodging', 'accommodation'].includes(type))
        )
        .map(place => {
          const priceLevel = place.price_level || 2; // Default to mid-range if not specified
          const estimatedPricePerNight = this.estimateHotelPrice(place, location);
          const enhancedAddress = this.formatHotelLocationDisplay(place, location);
          const amenities = this.generateHotelAmenities(place);
          
          // 🌍 INTEGRATION FIX: International currency detection
          const detectedCurrency = detectCurrencyByLocation(location);
          const nights = this.calculateNights(options.checkInDate, options.checkOutDate);
          const totalPriceValue = Math.round(estimatedPricePerNight * nights);
          
          return {
            id: place.place_id,
            name: place.name,
            // Map to frontend expected fields
            location: enhancedAddress,
            address: place.formatted_address || enhancedAddress, // Keep original for compatibility
            rating: place.rating || 0,
            totalReviews: place.user_ratings_total || 0,
            // 🔧 INTEGRATION FIX: Both numeric values (for filtering/sorting) AND formatted strings (for display)
            pricePerNightValue: estimatedPricePerNight, // Numeric for filtering/sorting
            totalPriceValue: totalPriceValue, // Numeric for filtering/sorting
            currencyCode: detectedCurrency,
            pricePerNight: formatCurrency(estimatedPricePerNight, detectedCurrency), // Formatted for display
            totalPrice: formatCurrency(totalPriceValue, detectedCurrency), // Formatted for display
            currency: detectedCurrency, // For backward compatibility
            priceRange: place.price_level ? '$'.repeat(place.price_level + 1) : '$$',
            nights: nights, // Include nights for transparency
            // Enhanced details
            amenities: amenities,
            description: `${place.name} - ${enhancedAddress}`,
            // Contact information
            phone: place.formatted_phone_number,
            website: place.website,
            // Media and booking
            photos: place.photos?.map(photo => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height,
              url: `/api/gmaps/photo?ref=${encodeURIComponent(photo.photo_reference)}&maxwidth=400`
            })) || [],
            bookingLinks: this.createBookingLinks(place, 'hotel'),
            // Location data
            coordinates: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng
            },
            // Additional helpful information
            openNow: place.opening_hours?.open_now,
            platform: 'Google Maps',
            source: 'Google Places API'
          };
        })
        .slice(0, options.limit || 20);

      // Cache the results
      this.cache.set(cacheKey, {
        data: hotels,
        timestamp: Date.now()
      });

      console.log(`✅ Found ${hotels.length} hotels with Google Maps in ${location}`);
      return hotels;

    } catch (error) {
      console.error('❌ Google Maps hotel search error:', error);
      throw error;
    }
  }

  private getActivityCategory(place: GoogleMapsPlace): string {
    const categoryMapping: { [key: string]: string } = {
      'tourist_attraction': 'sightseeing',
      'museum': 'cultural',
      'amusement_park': 'entertainment',
      'park': 'outdoor',
      'zoo': 'family',
      'aquarium': 'family',
      'church': 'cultural',
      'art_gallery': 'cultural',
      'shopping_mall': 'shopping',
      'stadium': 'sports',
      'casino': 'entertainment',
      'night_club': 'nightlife',
      'spa': 'wellness'
    };

    // Find the first matching category
    for (const type of place.types) {
      if (categoryMapping[type]) {
        return categoryMapping[type];
      }
    }
    return 'sightseeing'; // Default category
  }

  private estimateActivityPrice(place: GoogleMapsPlace): number {
    // Estimate price based on place types and price level
    const priceEstimates: { [key: string]: number } = {
      'tourist_attraction': 25,
      'museum': 30,
      'amusement_park': 75,
      'park': 10,
      'zoo': 35,
      'aquarium': 40,
      'church': 5,
      'art_gallery': 20,
      'spa': 80,
      'stadium': 50,
      'casino': 20,
      'night_club': 30
    };

    let basePrice = 25; // Default price

    // Use place types to estimate price
    for (const type of place.types) {
      if (priceEstimates[type]) {
        basePrice = priceEstimates[type];
        break;
      }
    }

    // Adjust based on Google's price level if available
    if (place.price_level) {
      basePrice = basePrice * (place.price_level + 1) * 0.8;
    }

    return Math.round(basePrice);
  }

  private calculateNights(checkInDate?: string, checkOutDate?: string): number {
    // Calculate actual nights between check-in and check-out dates
    if (checkInDate && checkOutDate) {
      try {
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const timeDiff = checkOut.getTime() - checkIn.getTime();
        const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        // Ensure reasonable range (1-30 nights)
        if (nights >= 1 && nights <= 30) {
          return nights;
        }
      } catch (error) {
        console.log('Could not parse check-in/check-out dates, using default');
      }
    }
    
    // Default to 2 nights if dates not provided or invalid
    return 2;
  }

  private estimateHotelPrice(place: GoogleMapsPlace, location: string): number {
    // Base price estimates for hotels based on price level and location context
    const basePricesByLevel = {
      1: 80,   // Budget hotels ($)
      2: 150,  // Mid-range hotels ($$)
      3: 280,  // High-end hotels ($$$)
      4: 450,  // Luxury hotels ($$$$)
    };

    const priceLevel = place.price_level || 2; // Default to mid-range
    let basePrice = basePricesByLevel[priceLevel as keyof typeof basePricesByLevel] || 150;

    // Adjust price based on location context
    const locationLower = location.toLowerCase();
    
    // Major city multipliers
    if (locationLower.includes('new york') || locationLower.includes('manhattan') || locationLower.includes('nyc')) {
      basePrice *= 2.2;
    } else if (locationLower.includes('san francisco') || locationLower.includes('tokyo') || locationLower.includes('london') || locationLower.includes('paris')) {
      basePrice *= 2.0;
    } else if (locationLower.includes('los angeles') || locationLower.includes('miami') || locationLower.includes('chicago') || locationLower.includes('boston')) {
      basePrice *= 1.7;
    } else if (locationLower.includes('vegas') || locationLower.includes('orlando') || locationLower.includes('seattle')) {
      basePrice *= 1.5;
    } else if (locationLower.includes('atlanta') || locationLower.includes('denver') || locationLower.includes('phoenix')) {
      basePrice *= 1.3;
    }

    // Adjust based on rating if available
    if (place.rating) {
      if (place.rating >= 4.5) {
        basePrice *= 1.3;
      } else if (place.rating >= 4.0) {
        basePrice *= 1.1;
      } else if (place.rating < 3.5) {
        basePrice *= 0.9;
      }
    }

    // Round to reasonable price points
    return Math.round(basePrice / 10) * 10; // Round to nearest $10
  }

  private generateHotelAmenities(place: GoogleMapsPlace): string {
    const priceLevel = place.price_level || 2;
    const rating = place.rating || 3.5;
    
    // Base amenities that most hotels have
    const baseAmenities = ['WiFi', 'Air Conditioning'];
    
    // Add amenities based on price level
    const amenitiesByLevel = {
      1: ['24-hour Front Desk', 'Parking'], // Budget
      2: ['24-hour Front Desk', 'Parking', 'Room Service', 'Gym'], // Mid-range
      3: ['24-hour Front Desk', 'Concierge', 'Room Service', 'Gym', 'Restaurant', 'Business Center'], // High-end
      4: ['24-hour Front Desk', 'Concierge', '24-hour Room Service', 'Gym', 'Spa', 'Multiple Restaurants', 'Business Center', 'Valet Parking'] // Luxury
    };

    const levelAmenities = amenitiesByLevel[priceLevel as keyof typeof amenitiesByLevel] || amenitiesByLevel[2];
    
    // Add rating-based amenities
    const ratingAmenities = [];
    if (rating >= 4.5) {
      ratingAmenities.push('Premium Bedding', 'Turndown Service');
    }
    if (rating >= 4.0) {
      ratingAmenities.push('Daily Housekeeping');
    }
    
    // Combine and deduplicate amenities
    const allAmenities = [...new Set([...baseAmenities, ...levelAmenities, ...ratingAmenities])];
    
    return allAmenities.join(', ');
  }

  private formatHotelLocationDisplay(place: GoogleMapsPlace, searchLocation: string): string {
    // Try formatted address first if available
    if (place.formatted_address) {
      return place.formatted_address;
    }
    
    // If no formatted address, construct location from available data
    const locationParts: string[] = [];
    
    // Add the general area where we searched
    if (searchLocation) {
      locationParts.push(searchLocation);
    }
    
    // Add coordinates-based location info if available
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;
      
      // Determine general location description based on coordinates
      // These are rough approximations for common US cities
      if (searchLocation.toLowerCase().includes('atlanta')) {
        if (lat > 33.75) {
          locationParts.push('North Atlanta Area');
        } else if (lat < 33.74) {
          locationParts.push('South Atlanta Area');
        } else {
          locationParts.push('Downtown Atlanta Area');
        }
      } else if (searchLocation.toLowerCase().includes('new york')) {
        if (lat > 40.76) {
          locationParts.push('Upper Manhattan');
        } else if (lat < 40.74) {
          locationParts.push('Lower Manhattan');
        } else {
          locationParts.push('Midtown Manhattan');
        }
      } else if (searchLocation.toLowerCase().includes('los angeles')) {
        if (lat > 34.08) {
          locationParts.push('North LA Area');
        } else if (lat < 34.04) {
          locationParts.push('South LA Area');
        } else {
          locationParts.push('Central LA Area');
        }
      } else {
        // Generic location description
        locationParts.push('City Center Area');
      }
    }
    
    // Return the best available location description
    if (locationParts.length > 0) {
      return locationParts.filter(part => part).join(', ');
    }
    
    // Final fallback
    return `${searchLocation} Area`;
  }

  private estimateDuration(place: GoogleMapsPlace): string {
    const durationMapping: { [key: string]: string } = {
      'tourist_attraction': '1-2 hours',
      'museum': '2-3 hours',
      'amusement_park': 'Full day',
      'park': '2-4 hours',
      'zoo': '3-4 hours',
      'aquarium': '2-3 hours',
      'church': '30-60 minutes',
      'art_gallery': '1-2 hours',
      'spa': '2-4 hours',
      'stadium': '3 hours',
      'casino': '2-4 hours',
      'night_club': '3-4 hours'
    };

    // Find the first matching duration
    for (const type of place.types) {
      if (durationMapping[type]) {
        return durationMapping[type];
      }
    }
    return '2-3 hours'; // Default duration
  }

  private formatActivity(place: GoogleMapsPlace, location: string): Activity {
    // Generate photo URLs from references via secure proxy (no API key exposure)
    const images = place.photos?.slice(0, 5).map(photo => 
      `/api/gmaps/photo?ref=${encodeURIComponent(photo.photo_reference)}&maxwidth=800`
    ) || [];

    // Transform reviews
    const reviews = place.reviews?.slice(0, 3).map(review => ({
      text: review.text,
      rating: review.rating,
      author: review.author_name
    })) || [];

    // Create booking URL based on place types
    let bookingUrl = '';
    if (place.website) {
      bookingUrl = place.website;
    } else {
      // Generate search URLs for popular booking platforms
      const searchQuery = encodeURIComponent(`${place.name} ${location}`);
      if (place.types.includes('amusement_park') || place.types.includes('zoo') || place.types.includes('aquarium')) {
        bookingUrl = `https://www.viator.com/searchResults?query=${searchQuery}`;
      } else if (place.types.includes('museum') || place.types.includes('art_gallery')) {
        bookingUrl = `https://www.getyourguide.com/s/?q=${searchQuery}`;
      } else {
        bookingUrl = `https://www.google.com/search?q=${searchQuery}+tickets+booking`;
      }
    }

    return {
      id: place.place_id,
      name: place.name,
      description: place.types.join(', ').replace(/_/g, ' '),
      longDescription: place.reviews?.[0]?.text || `Visit ${place.name}, a popular ${this.getActivityCategory(place)} destination in ${location}.`,
      price: this.estimateActivityPrice(place),
      currency: 'USD',
      rating: place.rating || 4.0,
      duration: this.estimateDuration(place),
      category: this.getActivityCategory(place),
      location: location,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      images: images,
      bookingUrl: bookingUrl,
      provider: 'Google Maps',
      website: place.website,
      phone: place.formatted_phone_number,
      openingHours: place.opening_hours?.weekday_text || [],
      openNow: place.opening_hours?.open_now,
      reviews: reviews,
      totalReviews: place.user_ratings_total || 0,
      placeTypes: place.types
    };
  }

  public async searchActivities(location: string, options: GoogleSearchOptions = {}): Promise<Activity[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    console.log(`🔍 Searching activities with Google Maps in: ${location}`);
    const cacheKey = this.getCacheKey('activities', location, options);
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`💨 Returning cached Google Maps activity results for ${location}`);
      return this.cache.get(cacheKey)!.data;
    }

    try {
      // Get location coordinates
      const coordinates = await this.geocodeLocation(location);
      if (!coordinates) {
        throw new Error(`Could not find coordinates for location: ${location}`);
      }

      // Define activity types to search for
      const activityTypes = options.activityTypes || [
        'tourist_attraction',
        'museum', 
        'amusement_park',
        'park',
        'zoo',
        'aquarium',
        'church',
        'art_gallery'
      ];

      let allActivities: GoogleMapsPlace[] = [];

      // Search for each activity type
      for (const type of activityTypes) {
        try {
          const params = new URLSearchParams({
            location: `${coordinates.lat},${coordinates.lng}`,
            radius: (options.radius ? options.radius * 1000 : 10000).toString(), // Convert km to meters
            type: type,
            key: this.apiKey
          });

          const response = await fetch(`${this.baseUrl}/nearbysearch/json?${params}`);

          if (!response.ok) {
            console.log(`❌ Google Maps API error for ${type}: ${response.status} ${response.statusText}`);
            continue;
          }

          const data: GoogleMapsSearchResponse = await response.json();

          if (data.status !== 'OK') {
            console.log(`❌ Google Maps API returned status for ${type}: ${data.status}`);
            continue;
          }

          if (data.results && data.results.length > 0) {
            console.log(`✅ Found ${data.results.length} ${type} activities`);
            allActivities = allActivities.concat(data.results);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Error searching for ${type} activities:`, error);
        }
      }

      if (allActivities.length === 0) {
        console.log('❌ No activities found with Google Maps API');
        return [];
      }

      // Remove duplicates based on place_id and filter by rating
      const uniqueActivities = allActivities.filter((activity, index, self) =>
        index === self.findIndex(a => a.place_id === activity.place_id) &&
        (!activity.rating || activity.rating >= 3.0) // Filter low-rated places
      );

      // Transform to our format
      let activities = uniqueActivities
        .map(place => this.formatActivity(place, location))
        .sort((a, b) => b.rating - a.rating) // Sort by rating descending
        .slice(0, options.limit || 30);

      // Cache the results
      this.cache.set(cacheKey, {
        data: activities,
        timestamp: Date.now()
      });

      console.log(`✅ Found ${activities.length} activities with Google Maps in ${location}`);
      return activities;

    } catch (error) {
      console.error('❌ Google Maps activity search error:', error);
      throw error;
    }
  }

  public async autocompleteLocation(input: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const params = new URLSearchParams({
        input: input,
        types: 'geocode',
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}/autocomplete/json?${params}`);

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        console.log(`Google Places Autocomplete returned status: ${data.status}`);
        return [];
      }

      return data.predictions?.map((prediction: any) => {
        console.log(`🔍 Google Places prediction:`, {
          description: prediction.description,
          main_text: prediction.structured_formatting?.main_text,
          types: prediction.types
        });
        
        return {
          place_id: prediction.place_id,
          name: prediction.structured_formatting?.main_text || prediction.description,
          displayName: prediction.description,
          description: prediction.description,
          types: prediction.types || []
        };
      }) || [];

    } catch (error) {
      console.error('❌ Google Maps autocomplete error:', error);
      return [];
    }
  }
}

export const googleMapsService = new GoogleMapsService();
export default googleMapsService;