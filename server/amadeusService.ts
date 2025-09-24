// @ts-nocheck
// Clean Amadeus API Service - Production Only
// Using authentic Amadeus Global Distribution System endpoints

interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AmadeusFlightOffer {
  id: string;
  source: string;
  instantTicketingRequired: boolean;
  lastTicketingDate: string;
  numberOfBookableSeats: number;
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: {
        iataCode: string;
        terminal?: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        terminal?: string;
        at: string;
      };
      carrierCode: string;
      number: string;
      aircraft: {
        code: string;
      };
      operating?: {
        carrierCode: string;
      };
      duration: string;
      id: string;
      numberOfStops: number;
    }>;
  }>;
  price: {
    currency: string;
    total: string;
    base: string;
    fees: Array<{
      amount: string;
      type: string;
    }>;
    grandTotal: string;
  };
  pricingOptions: {
    fareType: string[];
    includedCheckedBagsOnly: boolean;
  };
  validatingAirlineCodes: string[];
  travelerPricings: Array<{
    travelerId: string;
    fareOption: string;
    travelerType: string;
    price: {
      currency: string;
      total: string;
      base: string;
    };
    fareDetailsBySegment: Array<{
      segmentId: string;
      cabin: string;
      fareBasis: string;
      brandedFare?: string;
      class: string;
      includedCheckedBags: {
        quantity: number;
      };
    }>;
  }>;
}

interface AmadeusHotelOffer {
  type: string;
  hotel: {
    type: string;
    hotelId: string;
    chainCode: string;
    dupeId: string;
    name: string;
    rating: string;
    cityCode: string;
    latitude: number;
    longitude: number;
    hotelDistance: {
      distance: number;
      distanceUnit: string;
    };
    address: {
      lines: string[];
      postalCode: string;
      cityName: string;
      countryCode: string;
    };
    contact: {
      phone: string;
      fax: string;
      email: string;
    };
    amenities: string[];
    media: Array<{
      uri: string;
      category: string;
    }>;
  };
  available: boolean;
  offers: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    rateCode: string;
    rateFamilyEstimated: {
      code: string;
      type: string;
    };
    room: {
      type: string;
      typeEstimated: {
        category: string;
        beds: number;
        bedType: string;
      };
      description: {
        text: string;
        lang: string;
      };
    };
    guests: {
      adults: number;
    };
    price: {
      currency: string;
      base: string;
      total: string;
      variations: {
        average: {
          base: string;
        };
        changes: Array<{
          startDate: string;
          endDate: string;
          base: string;
        }>;
      };
    };
    policies: {
      cancellations: Array<{
        type: string;
        amount: string;
        numberOfNights: number;
        percentage: string;
        deadline: string;
      }>;
      paymentType: string;
      guarantee: {
        acceptedPayments: {
          creditCards: string[];
          methods: string[];
        };
      };
    };
    self: string;
  }>;
  self: string;
}

interface AmadeusActivityOffer {
  type: string;
  id: string;
  self: string;
  name: string;
  shortDescription: string;
  description: string;
  geoCode: {
    latitude: number;
    longitude: number;
  };
  rating: string;
  pictures: string[];
  bookingLink: string;
  price: {
    currencyCode: string;
    amount: string;
  };
  minimumDuration: string;
  maximumDuration: string;
  destination: {
    name: string;
    destinationCode: string;
  };
}

// Token management
let cachedToken: string | null = null;
let tokenExpiryTime: number = 0;

async function getAmadeusToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < tokenExpiryTime) {
    return cachedToken;
  }

  console.log('🔐 Requesting new Amadeus access token...');
  
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
    const errorData = await response.text();
    throw new Error(`Amadeus authentication failed: ${response.status} ${errorData}`);
  }

  const tokenData: AmadeusTokenResponse = await response.json();
  
  if (!tokenData.access_token) {
    throw new Error('No access token received from Amadeus API');
  }

  // Cache the token with 5-minute buffer before expiry
  cachedToken = tokenData.access_token;
  tokenExpiryTime = Date.now() + (tokenData.expires_in - 300) * 1000;
  
  console.log('✅ Amadeus token obtained successfully');
  return cachedToken;
}

// Flight search using v2/shopping/flight-offers
export async function searchFlights(
  origin: string,
  destination: string,
  departureDate: string,
  adults: number = 1,
  returnDate?: string,
  travelClass: string = 'ECONOMY',
  airline?: string
): Promise<AmadeusFlightOffer[]> {
  try {
    console.log(`🔍 Searching flights: ${origin} → ${destination} on ${departureDate}`);
    
    const token = await getAmadeusToken();
    
    const params = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departureDate,
      adults: adults.toString(),
      travelClass: travelClass,
      max: '10'
    });

    if (returnDate) {
      params.append('returnDate', returnDate);
    }

    if (airline) {
      params.append('includedAirlineCodes', airline.toUpperCase());
      console.log(`🔍 AIRLINE DEBUG: Added includedAirlineCodes=${airline.toUpperCase()} to Amadeus params`);
    }

    const response = await fetch(
      `https://api.amadeus.com/v2/shopping/flight-offers?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Flight search failed: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.log('No flights found for the given criteria');
      return [];
    }

    console.log(`✅ Found ${data.data.length} flight offers`);
    return data.data;
  } catch (error) {
    console.error('❌ Flight search error:', error);
    throw error;
  }
}

// Hotel search using v3 API - two-step process
export async function searchHotels(
  cityCode: string,
  checkInDate: string,
  checkOutDate: string,
  adults: number = 1,
  radius: number = 5,
  radiusUnit: string = 'KM'
): Promise<AmadeusHotelOffer[]> {
  try {
    console.log(`🔍 Searching hotels in ${cityCode} from ${checkInDate} to ${checkOutDate}`);
    
    const token = await getAmadeusToken();
    
    // Step 1: Get hotel IDs by city
    console.log(`📍 Getting hotel IDs for city code: ${cityCode}`);
    const hotelListResponse = await fetch(
      `https://api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&radius=${radius}&radiusUnit=${radiusUnit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!hotelListResponse.ok) {
      const errorData = await hotelListResponse.text();
      throw new Error(`Hotel list failed: ${hotelListResponse.status} ${errorData}`);
    }

    const hotelListData = await hotelListResponse.json();
    
    if (!hotelListData.data || hotelListData.data.length === 0) {
      console.log('No hotels found in this city');
      return [];
    }

    // Get up to 20 hotel IDs (API limitation)
    const hotelIds = hotelListData.data.slice(0, 20).map((hotel: any) => hotel.hotelId).join(',');
    console.log(`🏨 Found ${hotelListData.data.length} hotels, searching offers for first 20`);

    // Step 2: Search for hotel offers using hotel IDs
    const params = new URLSearchParams({
      hotelIds: hotelIds,
      adults: adults.toString(),
      checkInDate: checkInDate,
      checkOutDate: checkOutDate
    });

    const offersResponse = await fetch(
      `https://api.amadeus.com/v3/shopping/hotel-offers?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!offersResponse.ok) {
      const errorData = await offersResponse.text();
      throw new Error(`Hotel offers search failed: ${offersResponse.status} ${errorData}`);
    }

    const offersData = await offersResponse.json();
    
    if (!offersData.data || offersData.data.length === 0) {
      console.log('No hotel offers found for the given criteria');
      return [];
    }

    console.log(`✅ Found ${offersData.data.length} hotel offers`);
    return offersData.data;
  } catch (error) {
    console.error('❌ Hotel search error:', error);
    throw error;
  }
}

// Activities search using v1/shopping/activities
export async function searchActivities(
  latitude: number,
  longitude: number,
  radius: number = 20
): Promise<AmadeusActivityOffer[]> {
  try {
    console.log(`🔍 Searching activities at ${latitude}, ${longitude} within ${radius}km`);
    
    const token = await getAmadeusToken();
    
    // Try multiple searches with different radii and strategies to get more diverse results
    const searchRadii = [radius, radius * 0.5, radius * 1.5, radius * 2]; // e.g., 20km, 10km, 30km, 40km
    let allActivities: AmadeusActivityOffer[] = [];
    
    for (const searchRadius of searchRadii) {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: searchRadius.toString()
      });

      try {
        const response = await fetch(
          `https://api.amadeus.com/v1/shopping/activities?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            console.log(`Found ${data.data.length} activities with radius ${searchRadius}km at ${latitude}, ${longitude}`);
            allActivities = allActivities.concat(data.data);
          } else {
            console.log(`No activities found with radius ${searchRadius}km at ${latitude}, ${longitude}`);
          }
        } else {
          console.log(`HTTP ${response.status} for radius ${searchRadius}km at ${latitude}, ${longitude}`);
        }
      } catch (radiusError) {
        console.log(`Search with radius ${searchRadius}km failed: ${radiusError}, trying next radius`);
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // If we still have very few results, try searching nearby major cities
    if (allActivities.length < 5) {
      console.log(`Only found ${allActivities.length} activities, searching nearby areas...`);
      
      // Try slightly different coordinates to find more activities
      const nearbyCoordinates = [
        { lat: latitude + 0.1, lng: longitude + 0.1 },
        { lat: latitude - 0.1, lng: longitude - 0.1 },
        { lat: latitude + 0.05, lng: longitude - 0.05 },
        { lat: latitude - 0.05, lng: longitude + 0.05 }
      ];
      
      for (const coords of nearbyCoordinates) {
        const params = new URLSearchParams({
          latitude: coords.lat.toString(),
          longitude: coords.lng.toString(),
          radius: (radius * 1.5).toString()
        });

        try {
          const response = await fetch(
            `https://api.amadeus.com/v1/shopping/activities?${params}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              console.log(`Found ${data.data.length} additional activities at nearby coordinates ${coords.lat}, ${coords.lng}`);
              allActivities = allActivities.concat(data.data);
            }
          }
        } catch (nearbyError) {
          console.log(`Nearby search failed for ${coords.lat}, ${coords.lng}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Remove duplicates based on activity name
    const uniqueActivities = allActivities.filter((activity, index, self) => 
      index === self.findIndex(a => a.name === activity.name)
    );
    
    if (uniqueActivities.length === 0) {
      console.log('No activities found for the given criteria');
      return [];
    }

    console.log(`✅ Found ${uniqueActivities.length} unique activity offers`);
    return uniqueActivities;
  } catch (error) {
    console.error('❌ Activities search error:', error);
    throw error;
  }
}

// Comprehensive global city coordinates database for activities search
export const cityCoordinates: { [key: string]: { lat: number; lng: number } } = {
  // North America
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'dallas': { lat: 32.7767, lng: -96.7970 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'washington': { lat: 38.9072, lng: -77.0369 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'nashville': { lat: 36.1627, lng: -86.7816 },
  'orlando': { lat: 28.5383, lng: -81.3792 },
  'toronto': { lat: 43.6532, lng: -79.3832 },
  'vancouver': { lat: 49.2827, lng: -123.1207 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'cancun': { lat: 21.1619, lng: -86.8515 },

  // Europe
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'munich': { lat: 48.1351, lng: 11.5820 },
  'frankfurt': { lat: 50.1109, lng: 8.6821 },
  'vienna': { lat: 48.2082, lng: 16.3738 },
  'zurich': { lat: 47.3769, lng: 8.5417 },
  'milan': { lat: 45.4642, lng: 9.1900 },
  'florence': { lat: 43.7696, lng: 11.2558 },
  'venice': { lat: 45.4408, lng: 12.3155 },
  'athens': { lat: 37.9838, lng: 23.7275 },
  'istanbul': { lat: 41.0082, lng: 28.9784 },
  'moscow': { lat: 55.7558, lng: 37.6173 },
  'stockholm': { lat: 59.3293, lng: 18.0686 },
  'copenhagen': { lat: 55.6761, lng: 12.5683 },
  'oslo': { lat: 59.9139, lng: 10.7522 },
  'helsinki': { lat: 60.1699, lng: 24.9384 },
  'dublin': { lat: 53.3498, lng: -6.2603 },
  'edinburgh': { lat: 55.9533, lng: -3.1883 },
  'brussels': { lat: 50.8503, lng: 4.3517 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'porto': { lat: 41.1579, lng: -8.6291 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  'budapest': { lat: 47.4979, lng: 19.0402 },
  'warsaw': { lat: 52.2297, lng: 21.0122 },
  'krakow': { lat: 50.0647, lng: 19.9450 },

  // Croatia destinations
  'croatia': { lat: 45.1000, lng: 15.2000 },
  'zagreb': { lat: 45.8150, lng: 15.9819 },
  'split': { lat: 43.5081, lng: 16.4402 },
  'dubrovnik': { lat: 42.6507, lng: 18.0944 },
  'pula': { lat: 44.8683, lng: 13.8481 },
  'rovinj': { lat: 45.0811, lng: 13.6387 },
  'hvar': { lat: 43.1729, lng: 16.4414 },
  'korcula': { lat: 42.9597, lng: 17.1358 },
  'zadar': { lat: 44.1194, lng: 15.2314 },
  'rijeka': { lat: 45.3271, lng: 14.4422 },
  'plitvice': { lat: 44.8654, lng: 15.5820 },

  // Asia
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'hiroshima': { lat: 34.3853, lng: 132.4553 },
  'nagoya': { lat: 35.1815, lng: 136.9066 },
  'sapporo': { lat: 43.0642, lng: 141.3469 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'busan': { lat: 35.1796, lng: 129.0756 },
  'jeju': { lat: 33.4996, lng: 126.5312 },
  'beijing': { lat: 40.0583, lng: 116.4014 },
  'shanghai': { lat: 31.2304, lng: 121.4737 },
  'guangzhou': { lat: 23.1291, lng: 113.2644 },
  'shenzhen': { lat: 22.5431, lng: 114.0579 },
  'chengdu': { lat: 30.5728, lng: 104.0668 },
  'xian': { lat: 34.3416, lng: 108.9398 },
  'hangzhou': { lat: 30.2741, lng: 120.1551 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'macau': { lat: 22.1987, lng: 113.5439 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'phuket': { lat: 7.8804, lng: 98.3923 },
  'chiang mai': { lat: 18.7883, lng: 98.9853 },
  'pattaya': { lat: 12.9236, lng: 100.8825 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'goa': { lat: 15.2993, lng: 74.1240 },
  'kerala': { lat: 10.8505, lng: 76.2711 },
  'agra': { lat: 27.1767, lng: 78.0081 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'abu dhabi': { lat: 24.2539, lng: 54.3773 },
  'doha': { lat: 25.2854, lng: 51.5310 },
  'riyadh': { lat: 24.7136, lng: 46.6753 },
  'kuwait city': { lat: 29.3759, lng: 47.9774 },
  'jakarta': { lat: -6.2088, lng: 106.8456 },
  'bali': { lat: -8.4095, lng: 115.1889 },
  'yogyakarta': { lat: -7.7956, lng: 110.3695 },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869 },
  'penang': { lat: 5.4164, lng: 100.3327 },
  'manila': { lat: 14.5995, lng: 120.9842 },
  'cebu': { lat: 10.3157, lng: 123.8854 },
  'boracay': { lat: 11.9674, lng: 121.9248 },
  'ho chi minh city': { lat: 10.8231, lng: 106.6297 },
  'hanoi': { lat: 21.0285, lng: 105.8542 },
  'danang': { lat: 16.0544, lng: 108.2022 },
  'phnom penh': { lat: 11.5564, lng: 104.9282 },
  'siem reap': { lat: 13.3671, lng: 103.8448 },
  'vientiane': { lat: 17.9757, lng: 102.6331 },
  'yangon': { lat: 16.8409, lng: 96.1735 },
  'colombo': { lat: 6.9271, lng: 79.8612 },
  'dhaka': { lat: 23.8103, lng: 90.4125 },
  'kathmandu': { lat: 27.7172, lng: 85.3240 },
  'islamabad': { lat: 33.7294, lng: 73.0931 },
  'karachi': { lat: 24.8607, lng: 67.0011 },
  'lahore': { lat: 31.5804, lng: 74.3587 },
  'tashkent': { lat: 41.2995, lng: 69.2401 },
  'almaty': { lat: 43.2220, lng: 76.8512 },
  'tbilisi': { lat: 41.7151, lng: 44.8271 },
  'yerevan': { lat: 40.1792, lng: 44.4991 },
  'baku': { lat: 40.4093, lng: 49.8671 },

  // Oceania
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  'brisbane': { lat: -27.4698, lng: 153.0251 },
  'perth': { lat: -31.9505, lng: 115.8605 },
  'adelaide': { lat: -34.9285, lng: 138.6007 },
  'auckland': { lat: -36.8485, lng: 174.7633 },
  'wellington': { lat: -41.2865, lng: 174.7762 },
  'christchurch': { lat: -43.5321, lng: 172.6362 },

  // South America
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  'buenos aires': { lat: -34.6118, lng: -58.3960 },
  'lima': { lat: -12.0464, lng: -77.0428 },
  'bogota': { lat: 4.7110, lng: -74.0721 },
  'santiago': { lat: -33.4489, lng: -70.6693 },
  'quito': { lat: -0.1807, lng: -78.4678 },
  'caracas': { lat: 10.4806, lng: -66.9036 },

  // Africa
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  'johannesburg': { lat: -26.2041, lng: 28.0473 },
  'nairobi': { lat: -1.2921, lng: 36.8219 },
  'marrakech': { lat: 31.6295, lng: -7.9811 },
  'casablanca': { lat: 33.5731, lng: -7.5898 },
  'tunis': { lat: 36.8065, lng: 10.1815 },
  'lagos': { lat: 6.5244, lng: 3.3792 },
  'addis ababa': { lat: 9.0320, lng: 38.7469 },

  // Middle East
  'tel aviv': { lat: 32.0853, lng: 34.7818 },
  'jerusalem': { lat: 31.7683, lng: 35.2137 },
  'doha': { lat: 25.2854, lng: 51.5310 },
  'abu dhabi': { lat: 24.4539, lng: 54.3773 },
  'riyadh': { lat: 24.7136, lng: 46.6753 },
  'kuwait city': { lat: 29.3117, lng: 47.4818 },
  'amman': { lat: 31.9454, lng: 35.9284 },
  'beirut': { lat: 33.8547, lng: 35.8623 },

  // Popular Island Destinations
  'phuket': { lat: 7.8804, lng: 98.3923 },
  'maldives': { lat: 3.2028, lng: 73.2207 },
  'santorini': { lat: 36.3932, lng: 25.4615 },
  'mykonos': { lat: 37.4467, lng: 25.3289 },
  'crete': { lat: 35.2401, lng: 24.8093 },
  'mallorca': { lat: 39.6953, lng: 2.9101 },
  'ibiza': { lat: 38.9067, lng: 1.4206 },
  'sicily': { lat: 37.5999, lng: 14.0154 },
  'corsica': { lat: 41.9260, lng: 8.7369 },
  'sardinia': { lat: 39.2238, lng: 9.1217 },
  'hawaii': { lat: 21.3099, lng: -157.8581 },
  'jamaica': { lat: 18.1096, lng: -77.2975 },
  'barbados': { lat: 13.1939, lng: -59.5432 },
  'mauritius': { lat: -20.3484, lng: 57.5522 },
  'seychelles': { lat: -4.6796, lng: 55.4920 },
  'fiji': { lat: -18.1248, lng: 178.4501 },
  'tahiti': { lat: -17.6797, lng: -149.4068 },
  'iceland': { lat: 64.1466, lng: -21.9426 },
  'reykjavik': { lat: 64.1466, lng: -21.9426 },

  // Additional European Cities
  'salzburg': { lat: 47.8095, lng: 13.0550 },
  'innsbruck': { lat: 47.2692, lng: 11.4041 },
  'venice': { lat: 45.4408, lng: 12.3155 },
  'naples': { lat: 40.8518, lng: 14.2681 },
  'turin': { lat: 45.0703, lng: 7.6869 },
  'genoa': { lat: 44.4056, lng: 8.9463 },
  'bologna': { lat: 44.4949, lng: 11.3426 },
  'palermo': { lat: 38.1157, lng: 13.3615 },
  'catania': { lat: 37.5079, lng: 15.0830 },
  'seville': { lat: 37.3886, lng: -5.9823 },
  'valencia': { lat: 39.4699, lng: -0.3763 },
  'bilbao': { lat: 43.2627, lng: -2.9253 },
  'granada': { lat: 37.1773, lng: -3.5986 },
  'toledo': { lat: 39.8628, lng: -4.0273 },
  'santiago de compostela': { lat: 42.8805, lng: -8.5457 },
  'lyon': { lat: 45.7640, lng: 4.8357 },
  'marseille': { lat: 43.2965, lng: 5.3698 },
  'nice': { lat: 43.7102, lng: 7.2620 },
  'cannes': { lat: 43.5528, lng: 7.0174 },
  'monaco': { lat: 43.7384, lng: 7.4246 },
  'montpellier': { lat: 43.6108, lng: 3.8767 },
  'toulouse': { lat: 43.6047, lng: 1.4442 },
  'bordeaux': { lat: 44.8378, lng: -0.5792 },
  'lille': { lat: 50.6292, lng: 3.0573 },
  'strasbourg': { lat: 48.5734, lng: 7.7521 },
  'reims': { lat: 49.2583, lng: 4.0317 },
  'nantes': { lat: 47.2184, lng: -1.5536 },
  'rennes': { lat: 48.1173, lng: -1.6778 },
  'hannover': { lat: 52.3759, lng: 9.7320 },
  'dortmund': { lat: 51.5136, lng: 7.4653 },
  'stuttgart': { lat: 48.7758, lng: 9.1829 },
  'nuremberg': { lat: 49.4521, lng: 11.0767 },
  'dresden': { lat: 51.0504, lng: 13.7373 },
  'leipzig': { lat: 51.3397, lng: 12.3731 },
  'bremen': { lat: 53.0793, lng: 8.8017 },
  'rotterdam': { lat: 51.9225, lng: 4.4792 },
  'utrecht': { lat: 52.0907, lng: 5.1214 },
  'eindhoven': { lat: 51.4416, lng: 5.4697 },
  'the hague': { lat: 52.0705, lng: 4.3007 },
  'groningen': { lat: 53.2194, lng: 6.5665 },
  'ghent': { lat: 51.0543, lng: 3.7174 },
  'bruges': { lat: 51.2093, lng: 3.2247 },
  'antwerp': { lat: 51.2194, lng: 4.4025 },
  'geneva': { lat: 46.2044, lng: 6.1432 },
  'basel': { lat: 47.5596, lng: 7.5886 },
  'lucerne': { lat: 47.0502, lng: 8.3093 },
  'interlaken': { lat: 46.6863, lng: 7.8632 },
  'zermatt': { lat: 46.0207, lng: 7.7491 },
  'bern': { lat: 46.9481, lng: 7.4474 },
  'gothenburg': { lat: 57.7089, lng: 11.9746 },
  'malmo': { lat: 55.6050, lng: 13.0038 },
  'uppsala': { lat: 59.8586, lng: 17.6389 },
  'aarhus': { lat: 56.1629, lng: 10.2039 },
  'odense': { lat: 55.4038, lng: 10.4024 },
  'aalborg': { lat: 57.0488, lng: 9.9217 },
  'bergen': { lat: 60.3913, lng: 5.3221 },
  'trondheim': { lat: 63.4305, lng: 10.3951 },
  'stavanger': { lat: 58.9700, lng: 5.7331 },
  'tampere': { lat: 61.4991, lng: 23.7871 },
  'turku': { lat: 60.4518, lng: 22.2666 },
  'oulu': { lat: 65.0121, lng: 25.4651 },
  'tallinn': { lat: 59.4370, lng: 24.7536 },
  'riga': { lat: 56.9496, lng: 24.1052 },
  'vilnius': { lat: 54.6872, lng: 25.2797 },
  'kaunas': { lat: 54.8985, lng: 23.9036 },
  'minsk': { lat: 53.9006, lng: 27.5590 },
  'kyiv': { lat: 50.4501, lng: 30.5234 },
  'odessa': { lat: 46.4825, lng: 30.7233 },
  'lviv': { lat: 49.8397, lng: 24.0297 },
  'chisinau': { lat: 47.0105, lng: 28.8638 },
  'bucharest': { lat: 44.4268, lng: 26.1025 },
  'cluj-napoca': { lat: 46.7712, lng: 23.6236 },
  'timisoara': { lat: 45.7489, lng: 21.2087 },
  'iasi': { lat: 47.1585, lng: 27.6014 },
  'brasov': { lat: 45.6427, lng: 25.5887 },
  'constanta': { lat: 44.1598, lng: 28.6348 },
  'sofia': { lat: 42.6977, lng: 23.3219 },
  'plovdiv': { lat: 42.1354, lng: 24.7453 },
  'varna': { lat: 43.2141, lng: 27.9147 },
  'burgas': { lat: 42.5048, lng: 27.4626 },
  'belgrade': { lat: 44.7866, lng: 20.4489 },
  'novi sad': { lat: 45.2671, lng: 19.8335 },
  'nis': { lat: 43.3209, lng: 21.8958 },
  'sarajevo': { lat: 43.8563, lng: 18.4131 },
  'mostar': { lat: 43.3438, lng: 17.8078 },
  'banja luka': { lat: 44.7722, lng: 17.1910 },
  'skopje': { lat: 41.9973, lng: 21.4280 },
  'ohrid': { lat: 41.1179, lng: 20.8019 },
  'bitola': { lat: 41.0297, lng: 21.3347 },
  'tirana': { lat: 41.3275, lng: 19.8187 },
  'durres': { lat: 41.3236, lng: 19.4565 },
  'vlore': { lat: 40.4686, lng: 19.4905 },
  'podgorica': { lat: 42.4304, lng: 19.2594 },
  'kotor': { lat: 42.4248, lng: 18.7712 },
  'budva': { lat: 42.2864, lng: 18.8403 },
  'pristina': { lat: 42.6629, lng: 21.1655 },
  'prizren': { lat: 42.2139, lng: 20.7397 },

  // Additional Asian Cities
  'kobe': { lat: 34.6901, lng: 135.1956 },
  'fukuoka': { lat: 33.5904, lng: 130.4017 },
  'sendai': { lat: 38.2682, lng: 140.8694 },
  'kawasaki': { lat: 35.5206, lng: 139.7172 },
  'yokohama': { lat: 35.4437, lng: 139.6380 },
  'saitama': { lat: 35.8617, lng: 139.6455 },
  'chiba': { lat: 35.6074, lng: 140.1065 },
  'nara': { lat: 34.6851, lng: 135.8048 },
  'kanazawa': { lat: 36.5613, lng: 136.6562 },
  'takayama': { lat: 36.1390, lng: 137.2530 },
  'nikko': { lat: 36.7561, lng: 139.6170 },
  'hakone': { lat: 35.2323, lng: 139.1071 },
  'atami': { lat: 35.0954, lng: 139.0736 },
  'mount fuji': { lat: 35.3606, lng: 138.7274 },
  'daegu': { lat: 35.8714, lng: 128.6014 },
  'incheon': { lat: 37.4563, lng: 126.7052 },
  'gwangju': { lat: 35.1595, lng: 126.8526 },
  'daejeon': { lat: 36.3504, lng: 127.3845 },
  'ulsan': { lat: 35.5384, lng: 129.3114 },
  'suwon': { lat: 37.2636, lng: 127.0286 },
  'jeonju': { lat: 35.8242, lng: 127.1480 },
  'gyeongju': { lat: 35.8562, lng: 129.2247 },
  'andong': { lat: 36.5684, lng: 128.7294 },
  'pyeongchang': { lat: 37.3706, lng: 128.3900 },
  'tianjin': { lat: 39.3434, lng: 117.3616 },
  'chongqing': { lat: 29.4316, lng: 106.9123 },
  'wuhan': { lat: 30.5928, lng: 114.3055 },
  'nanjing': { lat: 32.0603, lng: 118.7969 },
  'suzhou': { lat: 31.2989, lng: 120.5853 },
  'qingdao': { lat: 36.0671, lng: 120.3826 },
  'dalian': { lat: 38.9140, lng: 121.6147 },
  'harbin': { lat: 45.8038, lng: 126.5349 },
  'changchun': { lat: 43.8868, lng: 125.3245 },
  'shenyang': { lat: 41.8057, lng: 123.4315 },
  'kunming': { lat: 25.0389, lng: 102.7183 },
  'guilin': { lat: 25.2342, lng: 110.1760 },
  'lijiang': { lat: 26.8721, lng: 100.2240 },
  'dali': { lat: 25.6066, lng: 100.2667 },
  'lhasa': { lat: 29.6625, lng: 91.1106 },
  'urumqi': { lat: 43.8256, lng: 87.6168 },
  'kashgar': { lat: 39.4704, lng: 75.9897 },
  'hohhot': { lat: 40.8414, lng: 111.7519 },
  'yinchuan': { lat: 38.4681, lng: 106.2731 },
  'lanzhou': { lat: 36.0611, lng: 103.8343 },
  'xining': { lat: 36.6197, lng: 101.7758 },
  'zhengzhou': { lat: 34.7466, lng: 113.6253 },
  'changsha': { lat: 28.2282, lng: 112.9388 },
  'nanchang': { lat: 28.6820, lng: 115.8581 },
  'hefei': { lat: 31.8206, lng: 117.2272 },
  'fuzhou': { lat: 26.0745, lng: 119.2965 },
  'xiamen': { lat: 24.4798, lng: 118.0894 },
  'haikou': { lat: 20.0458, lng: 110.3417 },
  'sanya': { lat: 18.2528, lng: 109.5113 },
  'taipei': { lat: 25.0330, lng: 121.5654 },
  'kaohsiung': { lat: 22.6273, lng: 120.3014 },
  'taichung': { lat: 24.1477, lng: 120.6736 },
  'tainan': { lat: 22.9999, lng: 120.2269 },
  'hualien': { lat: 23.9759, lng: 121.6014 },
  'taitung': { lat: 22.7583, lng: 121.1444 },
  'kenting': { lat: 22.0069, lng: 120.7975 },
  'taroko': { lat: 24.1640, lng: 121.6211 },
  'sun moon lake': { lat: 23.8563, lng: 120.9154 },
  'alishan': { lat: 23.5119, lng: 120.8022 },

  // Additional US Cities
  'portland': { lat: 45.5152, lng: -122.6784 },
  'sacramento': { lat: 38.5816, lng: -121.4944 },
  'san jose': { lat: 37.3382, lng: -121.8863 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'salt lake city': { lat: 40.7608, lng: -111.8910 },
  'kansas city': { lat: 39.0997, lng: -94.5786 },
  'st louis': { lat: 38.6270, lng: -90.1994 },
  'minneapolis': { lat: 44.9778, lng: -93.2650 },
  'milwaukee': { lat: 43.0389, lng: -87.9065 },
  'cleveland': { lat: 41.4993, lng: -81.6944 },
  'columbus': { lat: 39.9612, lng: -82.9988 },
  'cincinnati': { lat: 39.1031, lng: -84.5120 },
  'indianapolis': { lat: 39.7684, lng: -86.1581 },
  'pittsburgh': { lat: 40.4406, lng: -79.9959 },
  'buffalo': { lat: 42.8864, lng: -78.8784 },
  'albany': { lat: 42.6526, lng: -73.7562 },
  'rochester': { lat: 43.1566, lng: -77.6088 },
  'syracuse': { lat: 43.0481, lng: -76.1474 },
  'richmond': { lat: 37.5407, lng: -77.4360 },
  'norfolk': { lat: 36.8468, lng: -76.2852 },
  'virginia beach': { lat: 36.8529, lng: -75.9780 },
  'charleston': { lat: 32.7765, lng: -79.9311 },
  'savannah': { lat: 32.0835, lng: -81.0998 },
  'jacksonville': { lat: 30.3322, lng: -81.6557 },
  'st petersburg': { lat: 27.7676, lng: -82.6403 },
  'fort lauderdale': { lat: 26.1224, lng: -80.1373 },
  'key west': { lat: 24.5551, lng: -81.7800 },
  'memphis': { lat: 35.1495, lng: -90.0490 },
  'new orleans': { lat: 29.9511, lng: -90.0715 },
  'baton rouge': { lat: 30.4515, lng: -91.1871 },
  'birmingham': { lat: 33.5207, lng: -86.8025 },
  'montgomery': { lat: 32.3617, lng: -86.2792 },
  'mobile': { lat: 30.6954, lng: -88.0399 },
  'little rock': { lat: 34.7465, lng: -92.2896 },
  'oklahoma city': { lat: 35.4676, lng: -97.5164 },
  'tulsa': { lat: 36.1540, lng: -95.9928 },
  'wichita': { lat: 37.6872, lng: -97.3301 },
  'omaha': { lat: 41.2524, lng: -95.9980 },
  'des moines': { lat: 41.5868, lng: -93.6250 },
  'madison': { lat: 43.0732, lng: -89.4012 },
  'green bay': { lat: 44.5133, lng: -88.0133 },
  'grand rapids': { lat: 42.9634, lng: -85.6681 },
  'ann arbor': { lat: 42.2808, lng: -83.7430 },
  'toledo': { lat: 41.6528, lng: -83.5379 },
  'dayton': { lat: 39.7589, lng: -84.1916 },
  'akron': { lat: 41.0814, lng: -81.5190 },
  'youngstown': { lat: 41.0998, lng: -80.6495 },
  'erie': { lat: 42.1292, lng: -80.0851 },
  'allentown': { lat: 40.6084, lng: -75.4902 },
  'reading': { lat: 40.3356, lng: -75.9269 },
  'scranton': { lat: 41.4090, lng: -75.6624 },
  'harrisburg': { lat: 40.2732, lng: -76.8839 },
  'wilmington': { lat: 39.7391, lng: -75.5398 },
  'dover': { lat: 39.1612, lng: -75.5264 },
  'manchester': { lat: 42.9956, lng: -71.4548 },
  'burlington': { lat: 44.4759, lng: -73.2121 },
  'portland': { lat: 43.6591, lng: -70.2568 },
  'bangor': { lat: 44.8016, lng: -68.7712 },
  'spokane': { lat: 47.6587, lng: -117.4260 },
  'tacoma': { lat: 47.2529, lng: -122.4443 },
  'olympia': { lat: 47.0379, lng: -122.9015 },
  'bellingham': { lat: 48.7519, lng: -122.4787 },
  'anchorage': { lat: 61.2181, lng: -149.9003 },
  'fairbanks': { lat: 64.8378, lng: -147.7164 },
  'juneau': { lat: 58.3019, lng: -134.4197 },
  'honolulu': { lat: 21.3099, lng: -157.8581 },
  'hilo': { lat: 19.7297, lng: -155.0900 },
  'kailua-kona': { lat: 19.6400, lng: -155.9969 },
  'lahaina': { lat: 20.8783, lng: -156.6825 },
  'lihue': { lat: 21.9788, lng: -159.3710 },

  // Additional Canadian Cities
  'ottawa': { lat: 45.4215, lng: -75.6972 },
  'quebec city': { lat: 46.8139, lng: -71.2080 },
  'winnipeg': { lat: 49.8951, lng: -97.1384 },
  'calgary': { lat: 51.0447, lng: -114.0719 },
  'edmonton': { lat: 53.5461, lng: -113.4938 },
  'halifax': { lat: 44.6488, lng: -63.5752 },
  'st johns': { lat: 47.5615, lng: -52.7126 },
  'charlottetown': { lat: 46.2382, lng: -63.1311 },
  'fredericton': { lat: 45.9636, lng: -66.6431 },
  'whitehorse': { lat: 60.7212, lng: -135.0568 },
  'yellowknife': { lat: 62.4540, lng: -114.3718 },
  'iqaluit': { lat: 63.7467, lng: -68.5170 },
  'victoria': { lat: 48.4284, lng: -123.3656 },
  'kelowna': { lat: 49.8880, lng: -119.4960 },
  'saskatoon': { lat: 52.1579, lng: -106.6702 },
  'regina': { lat: 50.4452, lng: -104.6189 },
  'thunder bay': { lat: 48.3809, lng: -89.2477 },
  'sudbury': { lat: 46.4917, lng: -80.9930 },
  'kingston': { lat: 44.2312, lng: -76.4860 },
  'london': { lat: 42.9849, lng: -81.2453 },
  'kitchener': { lat: 43.4516, lng: -80.4925 },
  'hamilton': { lat: 43.2557, lng: -79.8711 },
  'windsor': { lat: 42.3149, lng: -83.0364 },
  'sherbrooke': { lat: 45.4042, lng: -71.8929 },
  'trois-rivieres': { lat: 46.3432, lng: -72.5434 },
  'chicoutimi': { lat: 48.4284, lng: -71.0568 },
  'rimouski': { lat: 48.4489, lng: -68.5236 },
  'moncton': { lat: 46.0878, lng: -64.7782 },
  'saint john': { lat: 45.2734, lng: -66.0633 },
  'sydney': { lat: 46.1351, lng: -60.1831 },

  // Additional Mexican Cities
  'guadalajara': { lat: 20.6597, lng: -103.3496 },
  'monterrey': { lat: 25.6866, lng: -100.3161 },
  'tijuana': { lat: 32.5027, lng: -117.0039 },
  'puebla': { lat: 19.0414, lng: -98.2063 },
  'juarez': { lat: 31.6904, lng: -106.4245 },
  'leon': { lat: 21.1619, lng: -101.6970 },
  'zapopan': { lat: 20.7223, lng: -103.3890 },
  'nezahualcoyotl': { lat: 19.4003, lng: -99.0145 },
  'chihuahua': { lat: 28.6353, lng: -106.0889 },
  'naucalpan': { lat: 19.4779, lng: -99.2386 },
  'merida': { lat: 20.9674, lng: -89.5926 },
  'san luis potosi': { lat: 22.1565, lng: -100.9855 },
  'aguascalientes': { lat: 21.8853, lng: -102.2916 },
  'hermosillo': { lat: 29.0729, lng: -110.9559 },
  'saltillo': { lat: 25.4232, lng: -101.0053 },
  'mexicali': { lat: 32.6245, lng: -115.4523 },
  'culiacan': { lat: 24.7993, lng: -107.3741 },
  'acapulco': { lat: 16.8531, lng: -99.8237 },
  'tlalnepantla': { lat: 19.5398, lng: -99.1951 },
  'guadalupe': { lat: 25.6767, lng: -100.2562 },
  'queretaro': { lat: 20.5888, lng: -100.3899 },
  'chimalhuacan': { lat: 19.4214, lng: -98.9542 },
  'morelia': { lat: 19.7069, lng: -101.1955 },
  'reynosa': { lat: 26.0807, lng: -98.2644 },
  'tlaquepaque': { lat: 20.6401, lng: -103.2964 },
  'tuxtla gutierrez': { lat: 16.7516, lng: -93.1161 },
  'acapulco de juarez': { lat: 16.8531, lng: -99.8237 },
  'irapuato': { lat: 20.6767, lng: -101.3542 },
  'mazatlan': { lat: 23.2494, lng: -106.4103 },
  'veracruz': { lat: 19.1738, lng: -96.1342 },
  'xalapa': { lat: 19.5438, lng: -96.9102 },
  'tampico': { lat: 22.2331, lng: -97.8611 },
  'oaxaca': { lat: 17.0732, lng: -96.7266 },
  'villahermosa': { lat: 17.9892, lng: -92.9475 },
  'campeche': { lat: 19.8301, lng: -90.5349 },
  'chetumal': { lat: 18.5001, lng: -88.2960 },
  'la paz': { lat: 24.1426, lng: -110.3128 },
  'cabo san lucas': { lat: 22.8905, lng: -109.9167 },
  'puerto vallarta': { lat: 20.6534, lng: -105.2253 },
  'playa del carmen': { lat: 20.6296, lng: -87.0739 },
  'cozumel': { lat: 20.5083, lng: -86.9458 },
  'tulum': { lat: 20.2114, lng: -87.4654 },
  'chichen itza': { lat: 20.6843, lng: -88.5678 },
  'palenque': { lat: 17.5087, lng: -92.0456 },
  'guanajuato': { lat: 21.0190, lng: -101.2574 },
  'san miguel de allende': { lat: 20.9153, lng: -100.7436 },
  'taxco': { lat: 18.5569, lng: -99.6057 },
  'puerto escondido': { lat: 15.8515, lng: -97.0707 },
  'huatulco': { lat: 15.7305, lng: -96.1268 },
  'zihuatanejo': { lat: 17.6403, lng: -101.5507 },
  'ixtapa': { lat: 17.6569, lng: -101.5506 },
  'rosarito': { lat: 32.3481, lng: -117.0473 },
  'ensenada': { lat: 31.8670, lng: -116.5953 },
  'loreto': { lat: 26.0124, lng: -111.3485 },
  'todos santos': { lat: 23.4452, lng: -110.2256 },
};



// Comprehensive global airport code mapping
export const airportCodes: { [key: string]: string } = {
  // North America
  'new york': 'JFK',
  'nyc': 'JFK',
  'jfk': 'JFK',
  'los angeles': 'LAX',
  'la': 'LAX',
  'lax': 'LAX',
  'chicago': 'ORD',
  'ord': 'ORD',
  'miami': 'MIA',
  'mia': 'MIA',
  'san francisco': 'SFO',
  'sfo': 'SFO',
  'las vegas': 'LAS',
  'las': 'LAS',
  'boston': 'BOS',
  'bos': 'BOS',
  'seattle': 'SEA',
  'sea': 'SEA',
  'denver': 'DEN',
  'den': 'DEN',
  'phoenix': 'PHX',
  'phx': 'PHX',
  'dallas': 'DFW',
  'dfw': 'DFW',
  'houston': 'IAH',
  'iah': 'IAH',
  'atlanta': 'ATL',
  'atl': 'ATL',
  'detroit': 'DTW',
  'dtw': 'DTW',
  'minneapolis': 'MSP',
  'msp': 'MSP',
  'orlando': 'MCO',
  'mco': 'MCO',
  'tampa': 'TPA',
  'tpa': 'TPA',
  'nashville': 'BNA',
  'bna': 'BNA',
  'charlotte': 'CLT',
  'clt': 'CLT',
  'washington': 'DCA',
  'dc': 'DCA',
  'dca': 'DCA',
  'philadelphia': 'PHL',
  'phl': 'PHL',
  'toronto': 'YYZ',
  'vancouver': 'YVR',
  'montreal': 'YUL',
  'mexico city': 'MEX',
  'cancun': 'CUN',
  'guadalajara': 'GDL',
  'gdl': 'GDL',
  'monterrey': 'MTY',
  'mty': 'MTY',
  'tijuana': 'TIJ',
  'tij': 'TIJ',
  'puerto vallarta': 'PVR',
  'pvr': 'PVR',
  'cabo san lucas': 'SJD',
  'sjd': 'SJD',
  'merida': 'MID',
  'mid': 'MID',
  'acapulco': 'ACA',
  'aca': 'ACA',
  'mazatlan': 'MZT',
  'mzt': 'MZT',
  'cozumel': 'CZM',
  'czm': 'CZM',
  'veracruz': 'VER',
  'ver': 'VER',
  'oaxaca': 'OAX',
  'oax': 'OAX',
  'villahermosa': 'VSA',
  'vsa': 'VSA',
  'la paz': 'LAP',
  'lap': 'LAP',
  'zihuatanejo': 'ZIH',
  'zih': 'ZIH',
  'huatulco': 'HUX',
  'hux': 'HUX',
  'tuxtla gutierrez': 'TGZ',
  'tgz': 'TGZ',
  'chihuahua': 'CUU',
  'cuu': 'CUU',
  'hermosillo': 'HMO',
  'hmo': 'HMO',
  'culiacan': 'CUL',
  'cul': 'CUL',
  'tampico': 'TAM',
  'tam': 'TAM',
  'reynosa': 'REX',
  'rex': 'REX',
  'saltillo': 'SLW',
  'slw': 'SLW',
  'aguascalientes': 'AGU',
  'agu': 'AGU',
  'ottawa': 'YOW',
  'yow': 'YOW',
  'quebec city': 'YQB',
  'yqb': 'YQB',
  'winnipeg': 'YWG',
  'ywg': 'YWG',
  'calgary': 'YYC',
  'yyc': 'YYC',
  'edmonton': 'YEG',
  'yeg': 'YEG',
  'halifax': 'YHZ',
  'yhz': 'YHZ',
  'portland': 'PDX',
  'pdx': 'PDX',
  'sacramento': 'SMF',
  'smf': 'SMF',
  'san jose': 'SJC',
  'sjc': 'SJC',
  'san diego': 'SAN',
  'san': 'SAN',
  'salt lake city': 'SLC',
  'slc': 'SLC',
  'kansas city': 'MCI',
  'mci': 'MCI',
  'st louis': 'STL',
  'stl': 'STL',
  'milwaukee': 'MKE',
  'mke': 'MKE',
  'cleveland': 'CLE',
  'cle': 'CLE',
  'columbus': 'CMH',
  'cmh': 'CMH',
  'cincinnati': 'CVG',
  'cvg': 'CVG',
  'indianapolis': 'IND',
  'ind': 'IND',
  'pittsburgh': 'PIT',
  'pit': 'PIT',
  'buffalo': 'BUF',
  'buf': 'BUF',
  'richmond': 'RIC',
  'ric': 'RIC',
  'charleston': 'CHS',
  'chs': 'CHS',
  'savannah': 'SAV',
  'sav': 'SAV',
  'jacksonville': 'JAX',
  'jax': 'JAX',
  'fort lauderdale': 'FLL',
  'fll': 'FLL',
  'key west': 'EYW',
  'eyw': 'EYW',
  'memphis': 'MEM',
  'mem': 'MEM',
  'new orleans': 'MSY',
  'msy': 'MSY',
  'birmingham': 'BHM',
  'bhm': 'BHM',
  'little rock': 'LIT',
  'lit': 'LIT',
  'oklahoma city': 'OKC',
  'okc': 'OKC',
  'tulsa': 'TUL',
  'tul': 'TUL',
  'wichita': 'ICT',
  'ict': 'ICT',
  'omaha': 'OMA',
  'oma': 'OMA',
  'des moines': 'DSM',
  'dsm': 'DSM',
  'madison': 'MSN',
  'msn': 'MSN',
  'green bay': 'GRB',
  'grb': 'GRB',
  'grand rapids': 'GRR',
  'grr': 'GRR',
  'spokane': 'GEG',
  'geg': 'GEG',
  'tacoma': 'SEA',
  'anchorage': 'ANC',
  'anc': 'ANC',
  'honolulu': 'HNL',
  'hnl': 'HNL',

  // Europe
  'london': 'LHR',
  'lhr': 'LHR',
  'paris': 'CDG',
  'cdg': 'CDG',
  'rome': 'FCO',
  'fco': 'FCO',
  'barcelona': 'BCN',
  'bcn': 'BCN',
  'madrid': 'MAD',
  'mad': 'MAD',
  'amsterdam': 'AMS',
  'ams': 'AMS',
  'berlin': 'BER',
  'ber': 'BER',
  'munich': 'MUC',
  'muc': 'MUC',
  'frankfurt': 'FRA',
  'fra': 'FRA',
  'vienna': 'VIE',
  'vie': 'VIE',
  'zurich': 'ZUR',
  'zur': 'ZUR',
  'milan': 'MXP',
  'mxp': 'MXP',
  'florence': 'FLR',
  'flr': 'FLR',
  'venice': 'VCE',
  'vce': 'VCE',
  'athens': 'ATH',
  'ath': 'ATH',
  'istanbul': 'IST',
  'ist': 'IST',
  'moscow': 'SVO',
  'svo': 'SVO',
  'stockholm': 'ARN',
  'arn': 'ARN',
  'copenhagen': 'CPH',
  'cph': 'CPH',
  'oslo': 'OSL',
  'osl': 'OSL',
  'helsinki': 'HEL',
  'hel': 'HEL',
  'dublin': 'DUB',
  'dub': 'DUB',
  'edinburgh': 'EDI',
  'edi': 'EDI',
  'brussels': 'BRU',
  'bru': 'BRU',
  'lisbon': 'LIS',
  'lis': 'LIS',
  'porto': 'OPO',
  'opo': 'OPO',
  'prague': 'PRG',
  'prg': 'PRG',
  'budapest': 'BUD',
  'bud': 'BUD',
  'warsaw': 'WAW',
  'waw': 'WAW',
  'krakow': 'KRK',
  'salzburg': 'SZG',
  'szg': 'SZG',
  'innsbruck': 'INN',
  'inn': 'INN',
  'naples': 'NAP',
  'nap': 'NAP',
  'turin': 'TRN',
  'trn': 'TRN',
  'genoa': 'GOA',
  'goa': 'GOA',
  'bologna': 'BLQ',
  'blq': 'BLQ',
  'palermo': 'PMO',
  'pmo': 'PMO',
  'catania': 'CTA',
  'cta': 'CTA',
  'seville': 'SVQ',
  'svq': 'SVQ',
  'valencia': 'VLC',
  'vlc': 'VLC',
  'bilbao': 'BIO',
  'bio': 'BIO',
  'granada': 'GRX',
  'grx': 'GRX',
  'santiago de compostela': 'SCQ',
  'scq': 'SCQ',
  'lyon': 'LYS',
  'lys': 'LYS',
  'marseille': 'MRS',
  'mrs': 'MRS',
  'nice': 'NCE',
  'nce': 'NCE',
  'cannes': 'NCE',
  'montpellier': 'MPL',
  'mpl': 'MPL',
  'toulouse': 'TLS',
  'tls': 'TLS',
  'bordeaux': 'BOD',
  'bod': 'BOD',
  'lille': 'LIL',
  'lil': 'LIL',
  'strasbourg': 'SXB',
  'sxb': 'SXB',
  'nantes': 'NTE',
  'nte': 'NTE',
  'rennes': 'RNS',
  'rns': 'RNS',
  'hannover': 'HAJ',
  'haj': 'HAJ',
  'dortmund': 'DTM',
  'dtm': 'DTM',
  'stuttgart': 'STR',
  'str': 'STR',
  'nuremberg': 'NUE',
  'nue': 'NUE',
  'dresden': 'DRS',
  'drs': 'DRS',
  'leipzig': 'LEJ',
  'lej': 'LEJ',
  'bremen': 'BRE',
  'bre': 'BRE',
  'rotterdam': 'RTM',
  'rtm': 'RTM',
  'eindhoven': 'EIN',
  'ein': 'EIN',
  'groningen': 'GRQ',
  'grq': 'GRQ',
  'geneva': 'GVA',
  'gva': 'GVA',
  'basel': 'BSL',
  'bsl': 'BSL',
  'bern': 'BRN',
  'brn': 'BRN',
  'gothenburg': 'GOT',
  'got': 'GOT',
  'malmo': 'MMX',
  'mmx': 'MMX',
  'aarhus': 'AAR',
  'aar': 'AAR',
  'aalborg': 'AAL',
  'aal': 'AAL',
  'bergen': 'BGO',
  'bgo': 'BGO',
  'trondheim': 'TRD',
  'trd': 'TRD',
  'stavanger': 'SVG',
  'svg': 'SVG',
  'tampere': 'TMP',
  'tmp': 'TMP',
  'turku': 'TKU',
  'tku': 'TKU',
  'tallinn': 'TLL',
  'tll': 'TLL',
  'riga': 'RIX',
  'rix': 'RIX',
  'vilnius': 'VNO',
  'vno': 'VNO',
  'bucharest': 'OTP',
  'otp': 'OTP',
  'cluj-napoca': 'CLJ',
  'clj': 'CLJ',
  'timisoara': 'TSR',
  'tsr': 'TSR',
  'sofia': 'SOF',
  'sof': 'SOF',
  'plovdiv': 'PDV',
  'pdv': 'PDV',
  'varna': 'VAR',
  'var': 'VAR',
  'belgrade': 'BEG',
  'beg': 'BEG',
  'sarajevo': 'SJJ',
  'sjj': 'SJJ',
  'skopje': 'SKP',
  'skp': 'SKP',
  'tirana': 'TIA',
  'tia': 'TIA',
  'podgorica': 'TGD',
  'tgd': 'TGD',
  'pristina': 'PRN',
  'prn': 'PRN',

  // Croatia destinations
  'croatia': 'ZAG',
  'zagreb': 'ZAG',
  'split': 'SPU',
  'dubrovnik': 'DBV',
  'pula': 'PUY',
  'rijeka': 'RJK',
  'zadar': 'ZAD',

  // Asia
  'tokyo': 'HND',
  'osaka': 'KIX',
  'kyoto': 'KIX',
  'seoul': 'ICN',
  'beijing': 'PEK',
  'shanghai': 'PVG',
  'hong kong': 'HKG',
  'singapore': 'SIN',
  'bangkok': 'BKK',
  'mumbai': 'BOM',
  'delhi': 'DEL',
  'dubai': 'DXB',
  'jakarta': 'CGK',
  'kuala lumpur': 'KUL',
  'manila': 'MNL',
  'ho chi minh city': 'SGN',
  'hanoi': 'HAN',

  // Oceania
  'sydney': 'SYD',
  'melbourne': 'MEL',
  'brisbane': 'BNE',
  'perth': 'PER',
  'adelaide': 'ADL',
  'auckland': 'AKL',
  'wellington': 'WLG',
  'christchurch': 'CHC',

  // South America
  'sao paulo': 'GRU',
  'rio de janeiro': 'GIG',
  'buenos aires': 'EZE',
  'lima': 'LIM',
  'bogota': 'BOG',
  'santiago': 'SCL',
  'quito': 'UIO',
  'caracas': 'CCS',

  // Africa
  'cairo': 'CAI',
  'cape town': 'CPT',
  'johannesburg': 'JNB',
  'nairobi': 'NBO',
  'marrakech': 'RAK',
  'casablanca': 'CMN',
  'tunis': 'TUN',
  'lagos': 'LOS',
  'addis ababa': 'ADD',

  // Middle East
  'tel aviv': 'TLV',
  'jerusalem': 'TLV',
  'doha': 'DOH',
  'abu dhabi': 'AUH',
  'riyadh': 'RUH',
  'kuwait city': 'KWI',
  'amman': 'AMM',
  'beirut': 'BEY',

  // Popular Island Destinations
  'bali': 'DPS',
  'phuket': 'HKT',
  'maldives': 'MLE',
  'santorini': 'JTR',
  'mykonos': 'JMK',
  'crete': 'HER',
  'mallorca': 'PMI',
  'ibiza': 'IBZ',
  'sicily': 'CTA',
  'corsica': 'AJA',
  'sardinia': 'CAG',
  'hawaii': 'HNL',
  'jamaica': 'KIN',
  'barbados': 'BGI',
  'mauritius': 'MRU',
  'seychelles': 'SEZ',
  'fiji': 'NAN',
  'tahiti': 'PPT',
  'iceland': 'KEF',
  'reykjavik': 'KEF',
  
  // Additional Asian cities
  'kobe': 'UKB',
  'fukuoka': 'FUK',
  'sendai': 'SDJ',
  'kanazawa': 'KMQ',
  'daegu': 'TAE',
  'busan': 'PUS',
  'jeju': 'CJU',
  'tianjin': 'TSN',
  'chongqing': 'CKG',
  'wuhan': 'WUH',
  'nanjing': 'NKG',
  'qingdao': 'TAO',
  'dalian': 'DLC',
  'harbin': 'HRB',
  'shenyang': 'SHE',
  'kunming': 'KMG',
  'guilin': 'KWL',
  'taipei': 'TPE',
  'kaohsiung': 'KHH',
  'taichung': 'RMQ',
};

// Comprehensive global hotel city codes
export const hotelCityCodes: { [key: string]: string } = {
  // North America - Major US Cities
  'new york': 'NYC',
  'nyc': 'NYC',
  'new york city': 'NYC',
  'manhattan': 'NYC',
  'los angeles': 'LAX',
  'la': 'LAX',
  'chicago': 'CHI',
  'miami': 'MIA',
  'san francisco': 'SFO',
  'sf': 'SFO',
  'las vegas': 'LAS',
  'vegas': 'LAS',
  'denver': 'DEN',
  'seattle': 'SEA',
  'boston': 'BOS',
  'washington': 'WAS',
  'dc': 'WAS',
  'washington dc': 'WAS',
  'atlanta': 'ATL',
  'charlotte': 'CLT',
  'phoenix': 'PHX',
  'dallas': 'DFW',
  'houston': 'IAH',
  'detroit': 'DTW',
  'minneapolis': 'MSP',
  'orlando': 'MCO',
  'tampa': 'TPA',
  'nashville': 'BNA',
  'philadelphia': 'PHL',
  'portland': 'PDX',
  'sacramento': 'SMF',
  'san jose': 'SJC',
  'san diego': 'SAN',
  'salt lake city': 'SLC',
  'kansas city': 'MCI',
  'st louis': 'STL',
  'milwaukee': 'MKE',
  'cleveland': 'CLE',
  'columbus': 'CMH',
  'cincinnati': 'CVG',
  'indianapolis': 'IND',
  'pittsburgh': 'PIT',
  'buffalo': 'BUF',
  'richmond': 'RIC',
  'charleston': 'CHS',
  'savannah': 'SAV',
  'jacksonville': 'JAX',
  'fort lauderdale': 'FLL',
  'key west': 'EYW',
  'memphis': 'MEM',
  'new orleans': 'MSY',
  'raleigh': 'RDU',
  'norfolk': 'ORF',
  'baltimore': 'BWI',
  'albuquerque': 'ABQ',
  'tucson': 'TUS',
  'honolulu': 'HNL',
  'anchorage': 'ANC',
  'austin': 'AUS',
  'birmingham': 'BHM',
  'huntsville': 'HSV',
  'mobile': 'MOB',
  'little rock': 'LIT',
  'tulsa': 'TUL',
  'oklahoma city': 'OKC',
  'fresno': 'FAT',
  'bakersfield': 'BFL',
  'reno': 'RNO',
  'boise': 'BOI',
  'spokane': 'GEG',
  'fairbanks': 'FAI',
  'albany': 'ALB',
  'syracuse': 'SYR',
  'rochester': 'ROC',
  'newark': 'EWR',
  'saint louis': 'STL',
  
  // Canada
  'toronto': 'YTO',
  'vancouver': 'YVR',
  'montreal': 'YUL',
  'ottawa': 'YOW',
  'quebec city': 'YQB',
  'winnipeg': 'YWG',
  'calgary': 'YYC',
  'edmonton': 'YEG',
  'halifax': 'YHZ',
  
  // Mexico
  'mexico city': 'MEX',
  'cancun': 'CUN',
  'guadalajara': 'GDL',
  'monterrey': 'MTY',
  'tijuana': 'TIJ',
  'puerto vallarta': 'PVR',
  'cabo san lucas': 'SJD',
  'merida': 'MID',
  'acapulco': 'ACA',
  'mazatlan': 'MZT',
  'cozumel': 'CZM',

  // Europe
  'london': 'LON',
  'paris': 'PAR',
  'rome': 'ROM',
  'barcelona': 'BCN',
  'madrid': 'MAD',
  'amsterdam': 'AMS',
  'berlin': 'BER',
  'munich': 'MUC',
  'frankfurt': 'FRA',
  'vienna': 'VIE',
  'zurich': 'ZUR',
  'milan': 'MIL',
  'florence': 'FLR',
  'venice': 'VCE',
  'athens': 'ATH',
  'istanbul': 'IST',
  'moscow': 'MOW',
  'stockholm': 'STO',
  'copenhagen': 'CPH',
  'oslo': 'OSL',
  'helsinki': 'HEL',
  'dublin': 'DUB',
  'edinburgh': 'EDI',
  'brussels': 'BRU',
  'lisbon': 'LIS',
  'porto': 'OPO',
  'prague': 'PRG',
  'budapest': 'BUD',
  'warsaw': 'WAW',
  'krakow': 'KRK',
  'nice': 'NCE',
  'marseille': 'MRS',
  'lyon': 'LYS',
  'geneva': 'GVA',
  'naples': 'NAP',
  'palermo': 'PMO',
  'bologna': 'BLQ',
  'turin': 'TRN',
  'seville': 'SVQ',
  'valencia': 'VLC',
  'bilbao': 'BIO',
  'malaga': 'AGP',
  'palma': 'PMI',
  'ibiza': 'IBZ',
  'hamburg': 'HAM',
  'cologne': 'CGN',
  'dusseldorf': 'DUS',
  'stuttgart': 'STR',
  'thessaloniki': 'SKG',
  'santorini': 'JTR',
  'mykonos': 'JMK',
  'crete': 'HER',
  'rhodes': 'RHO',
  'bucharest': 'BUH',
  'sofia': 'SOF',
  'belgrade': 'BEG',
  'ljubljana': 'LJU',
  'riga': 'RIX',
  'tallinn': 'TLL',
  'vilnius': 'VNO',
  'kiev': 'KBP',
  'minsk': 'MSQ',

  // Croatia destinations
  'croatia': 'ZAG',
  'zagreb': 'ZAG',
  'split': 'SPU',
  'dubrovnik': 'DBV',
  'pula': 'PUY',
  'rijeka': 'RJK',
  'zadar': 'ZAD',

  // Asia
  'tokyo': 'TYO',
  'osaka': 'OSA',
  'kyoto': 'KYO',
  'hiroshima': 'HIJ',
  'fukuoka': 'FUK',
  'sapporo': 'CTS',
  'seoul': 'SEL',
  'busan': 'PUS',
  'jeju': 'CJU',
  'beijing': 'BJS',
  'shanghai': 'SHA',
  'guangzhou': 'CAN',
  'shenzhen': 'SZX',
  'chengdu': 'CTU',
  'chongqing': 'CKG',
  'xian': 'XIY',
  'hong kong': 'HKG',
  'hk': 'HKG',
  'macau': 'MFM',
  'taipei': 'TPE',
  'kaohsiung': 'KHH',
  'singapore': 'SIN',
  'bangkok': 'BKK',
  'phuket': 'HKT',
  'chiang mai': 'CNX',
  'mumbai': 'BOM',
  'delhi': 'DEL',
  'new delhi': 'DEL',
  'bangalore': 'BLR',
  'hyderabad': 'HYD',
  'chennai': 'MAA',
  'kolkata': 'CCU',
  'pune': 'PNQ',
  'goa': 'GOI',
  'kochi': 'COK',
  'dubai': 'DXB',
  'abu dhabi': 'AUH',
  'doha': 'DOH',
  'riyadh': 'RUH',
  'jeddah': 'JED',
  'kuwait city': 'KWI',
  'muscat': 'MCT',
  'tel aviv': 'TLV',
  'amman': 'AMM',
  'beirut': 'BEY',
  'jakarta': 'JKT',
  'bali': 'DPS',
  'denpasar': 'DPS',
  'yogyakarta': 'JOG',
  'surabaya': 'MLG',
  'kuala lumpur': 'KUL',
  'kl': 'KUL',
  'penang': 'PEN',
  'langkawi': 'LGK',
  'manila': 'MNL',
  'cebu': 'CEB',
  'boracay': 'MPH',
  'ho chi minh city': 'SGN',
  'saigon': 'SGN',
  'hanoi': 'HAN',
  'da nang': 'DAD',
  'phnom penh': 'PNH',
  'siem reap': 'REP',
  'vientiane': 'VTE',
  'yangon': 'RGN',
  'mandalay': 'MDL',
  'colombo': 'CMB',
  'male': 'MLE',
  'kathmandu': 'KTM',
  'dhaka': 'DAC',
  'karachi': 'KHI',
  'lahore': 'LHE',
  'islamabad': 'ISB',
  'almaty': 'ALA',
  'tashkent': 'TAS',
  'bishkek': 'FRU',
  'tbilisi': 'TBS',
  'yerevan': 'EVN',
  'baku': 'BAK',

  // Oceania
  'sydney': 'SYD',
  'melbourne': 'MEL',
  'brisbane': 'BNE',
  'perth': 'PER',
  'adelaide': 'ADL',
  'darwin': 'DRW',
  'hobart': 'HBA',
  'cairns': 'CNS',
  'gold coast': 'OOL',
  'canberra': 'CBR',
  'auckland': 'AKL',
  'wellington': 'WLG',
  'christchurch': 'CHC',
  'queenstown': 'ZQN',
  'rotorua': 'ROT',
  'suva': 'SUV',
  'nadi': 'NAN',
  'port vila': 'VLI',
  'noumea': 'NOU',
  'apia': 'APW',
  'papeete': 'PPT',

  // South America
  'sao paulo': 'SAO',
  'rio de janeiro': 'RIO',
  'brasilia': 'BSB',
  'salvador': 'SSA',
  'fortaleza': 'FOR',
  'recife': 'REC',
  'belo horizonte': 'CNF',
  'porto alegre': 'POA',
  'curitiba': 'CWB',
  'manaus': 'MAO',
  'buenos aires': 'BUE',
  'cordoba': 'COR',
  'mendoza': 'MDZ',
  'bariloche': 'BRC',
  'ushuaia': 'USH',
  'lima': 'LIM',
  'cusco': 'CUZ',
  'arequipa': 'AQP',
  'bogota': 'BOG',
  'medellin': 'MDE',
  'cartagena': 'CTG',
  'cali': 'CLO',
  'santiago': 'SCL',
  'valparaiso': 'VAP',
  'antofagasta': 'ANF',
  'punta arenas': 'PUQ',
  'quito': 'UIO',
  'guayaquil': 'GYE',
  'caracas': 'CCS',
  'maracaibo': 'MAR',
  'asuncion': 'ASU',
  'montevideo': 'MVD',
  'la paz': 'LPB',
  'santa cruz': 'VVI',
  'georgetown': 'GEO',
  'paramaribo': 'PBM',
  'cayenne': 'CAY',

  // Africa
  'cairo': 'CAI',
  'alexandria': 'HBE',
  'luxor': 'LXR',
  'aswan': 'ASW',
  'cape town': 'CPT',
  'johannesburg': 'JNB',
  'durban': 'DUR',
  'pretoria': 'WDH',
  'port elizabeth': 'PLZ',
  'bloemfontein': 'BFN',
  'nairobi': 'NBO',
  'mombasa': 'MBA',
  'addis ababa': 'ADD',
  'asmara': 'ASM',
  'khartoum': 'KRT',
  'kampala': 'EBB',
  'entebbe': 'EBB',
  'kigali': 'KGL',
  'bujumbura': 'BJM',
  'dar es salaam': 'DAR',
  'zanzibar': 'ZNZ',
  'lusaka': 'LUN',
  'harare': 'HRE',
  'maputo': 'MPM',
  'antananarivo': 'TNR',
  'port louis': 'MRU',
  'lagos': 'LOS',
  'abuja': 'ABV',
  'kano': 'KAN',
  'accra': 'ACC',
  'kumasi': 'KMS',
  'abidjan': 'ABJ',
  'yamoussoukro': 'ASK',
  'dakar': 'DKR',
  'bamako': 'BKO',
  'ouagadougou': 'OUA',
  'niamey': 'NIM',
  'ndjamena': 'NDJ',
  'libreville': 'LBV',
  'yaounde': 'NSI',
  'douala': 'DLA',
  'kinshasa': 'FIH',
  'luanda': 'LAD',
  'windhoek': 'WDH',
  'gaborone': 'GBE',
  'maseru': 'MSU',
  'mbabane': 'MTS',
  'moroni': 'HAH',
  'marrakech': 'RAK',
  'casablanca': 'CAS',
  'rabat': 'RBA',
  'fez': 'FEZ',
  'agadir': 'AGA',
  'tunis': 'TUN',
  'sfax': 'SFA',
  'algiers': 'ALG',
  'oran': 'ORN',
  'constantine': 'CZL',
  'tripoli': 'TIP',
  'benghazi': 'BEN',

  // Caribbean & Central America
  'havana': 'HAV',
  'santiago de cuba': 'SCU',
  'kingston': 'KIN',
  'montego bay': 'MBJ',
  'bridgetown': 'BGI',
  'port of spain': 'POS',
  'georgetown': 'GEO',
  'san juan': 'SJU',
  'ponce': 'PSE',
  'santo domingo': 'SDQ',
  'puerto plata': 'POP',
  'port au prince': 'PAP',
  'nassau': 'NAS',
  'freeport': 'FPO',
  'grand turk': 'GDT',
  'providenciales': 'PLS',
  'george town': 'GCM',
  'guatemala city': 'GUA',
  'flores': 'FRS',
  'belize city': 'BZE',
  'san salvador': 'SAL',
  'tegucigalpa': 'TGU',
  'san pedro sula': 'SAP',
  'managua': 'MGA',
  'san jose': 'SJO',
  'liberia': 'LIR',
  'panama city': 'PTY',
  'david': 'DAV',

  // Popular Island & Resort Destinations
  'maldives': 'MLE',
  'mauritius': 'MRU',
  'seychelles': 'SEZ',
  'fiji': 'NAN',
  'tahiti': 'PPT',
  'bora bora': 'BOB',
  'hawaii': 'HNL',
  'oahu': 'HNL',
  'maui': 'OGG',
  'kona': 'KOA',
  'hilo': 'ITO',
  'kauai': 'LIH',
  'molokai': 'MKK',
  'lanai': 'LNY',
  'iceland': 'REK',
  'reykjavik': 'REK',
  'akureyri': 'AEY',
  'keflavik': 'KEF',
  'faroe islands': 'FAE',
  'torshavn': 'FAE',
  'greenland': 'GOH',
  'nuuk': 'GOH',
  'malta': 'MLA',
  'valletta': 'MLA',
  'cyprus': 'LCA',
  'nicosia': 'NIC',
  'limassol': 'LIM',
  'paphos': 'PFO',

  // Additional US Regional Cities
  'birmingham': 'BHM',
  'little rock': 'LIT',
  'oklahoma city': 'OKC',
  'tulsa': 'TUL',
  'wichita': 'ICT',
  'omaha': 'OMA',
  'des moines': 'DSM',
  'madison': 'MSN',
  'green bay': 'GRB',
  'grand rapids': 'GRR',
  'spokane': 'GEG',
  'boise': 'BOI',
  'missoula': 'MSO',
  'billings': 'BIL',
  'fargo': 'FAR',
  'sioux falls': 'FSD',
  'rapid city': 'RAP',
  'casper': 'CPR',
  'cheyenne': 'CYS',
  'bozeman': 'BZN',
  'jackson': 'JAC',
  'sun valley': 'SUN',
  'steamboat springs': 'HDN',
  'aspen': 'ASE',
  'vail': 'EGE',
  'durango': 'DRO',
  'grand junction': 'GJT',
  'pueblo': 'PUB',
  'colorado springs': 'COS',
  'fort collins': 'FNL',
  'santa fe': 'SAF',
  'flagstaff': 'FLG',
  'yuma': 'YUM',
  'bakersfield': 'BFL',
  'fresno': 'FAT',
  'modesto': 'MOD',
  'monterey': 'MRY',
  'santa barbara': 'SBA',
  'oxnard': 'OXR',
  'san luis obispo': 'SBP',
  'eureka': 'ACV',
  'redding': 'RDD',
  'eugene': 'EUG',
  'bend': 'RDM',
  'medford': 'MFR',
  'yakima': 'YKM',
  'bellingham': 'BLI',
  'wenatchee': 'EAT',
  'kenai': 'ENA',
  'kodiak': 'ADQ',
  'nome': 'OME',
  'barrow': 'BRW',
  'bethel': 'BET',
  'hilo': 'ITO',
  'kona': 'KOA',
  'lihue': 'LIH',
  'molokai': 'MKK',
  'lanai': 'LNY',
  'kahului': 'OGG',

  // Additional European Cities
  'salzburg': 'SZG',
  'innsbruck': 'INN',
  'graz': 'GRZ',
  'linz': 'LNZ',
  'klagenfurt': 'KLU',
  'toulouse': 'TLS',
  'bordeaux': 'BOD',
  'lille': 'LIL',
  'strasbourg': 'SXB',
  'nantes': 'NTE',
  'rennes': 'RNS',
  'brest': 'BES',
  'clermont ferrand': 'CFE',
  'tours': 'TUF',
  'caen': 'CFR',
  'angers': 'ANE',
  'poitiers': 'PIS',
  'limoges': 'LIG',
  'perpignan': 'PGF',
  'pau': 'PUF',
  'biarritz': 'BIQ',
  'lourdes': 'LDE',
  'carcassonne': 'CCF',
  'beziers': 'BZR',
  'hannover': 'HAJ',
  'dortmund': 'DTM',
  'nuremberg': 'NUE',
  'dresden': 'DRS',
  'leipzig': 'LEJ',
  'bremen': 'BRE',
  'erfurt': 'ERF',
  'kassel': 'KSF',
  'munster': 'FMO',
  'magdeburg': 'CSO',
  'rostock': 'RLG',
  'lubeck': 'LBC',
  'kiel': 'KEL',
  'flensburg': 'FEL',
  'rotterdam': 'RTM',
  'eindhoven': 'EIN',
  'groningen': 'GRQ',
  'maastricht': 'MST',
  'basel': 'BSL',
  'bern': 'BRN',
  'lugano': 'LUG',
  'st moritz': 'SMV',
  'davos': 'DAV',
  'zermatt': 'ZUR',
  'interlaken': 'INT',
  'gothenburg': 'GOT',
  'malmo': 'MMX',
  'linkoping': 'LPI',
  'vasteras': 'VST',
  'umea': 'UME',
  'lulea': 'LLA',
  'kiruna': 'KRN',
  'aarhus': 'AAR',
  'aalborg': 'AAL',
  'odense': 'ODE',
  'esbjerg': 'EBJ',
  'bergen': 'BGO',
  'trondheim': 'TRD',
  'stavanger': 'SVG',
  'tromso': 'TOS',
  'alta': 'ALF',
  'bodo': 'BOO',
  'kristiansand': 'KRS',
  'tampere': 'TMP',
  'turku': 'TKU',
  'oulu': 'OUL',
  'rovaniemi': 'RVN',
  'kuopio': 'KUO',
  'jyvaskyla': 'JYV',
  'lahti': 'LAH',
  'joensuu': 'JOE',
  'cluj-napoca': 'CLJ',
  'timisoara': 'TSR',
  'iasi': 'IAS',
  'constanta': 'CND',
  'craiova': 'CRA',
  'sibiu': 'SBZ',
  'brasov': 'GHV',
  'plovdiv': 'PDV',
  'varna': 'VAR',
  'burgas': 'BOJ',
  'ruse': 'ROU',
  'stara zagora': 'SZR',
  'sarajevo': 'SJJ',
  'tuzla': 'TUZ',
  'banja luka': 'BNX',
  'mostar': 'OMO',
  'skopje': 'SKP',
  'ohrid': 'OHD',
  'tirana': 'TIA',
  'vlore': 'VOL',
  'podgorica': 'TGD',
  'tivat': 'TIV',
  'pristina': 'PRN',
  'novi sad': 'QND',
  'nis': 'INI',
  'kragujevac': 'KRG',

  // Additional Asian Cities
  'kobe': 'UKB',
  'fukuoka': 'FUK',
  'sendai': 'SDJ',
  'kanazawa': 'KMQ',
  'takayama': 'TAK',
  'matsuyama': 'MYJ',
  'kumamoto': 'KMJ',
  'kagoshima': 'KOJ',
  'naha': 'OKA',
  'miyazaki': 'KMI',
  'okayama': 'OKJ',
  'takamatsu': 'TAK',
  'kochi': 'KCZ',
  'tokushima': 'TKS',
  'daegu': 'TAE',
  'gwangju': 'KWJ',
  'ulsan': 'USN',
  'jeonju': 'JJU',
  'andong': 'AND',
  'sokcho': 'SHO',
  'tianjin': 'TSN',
  'wuhan': 'WUH',
  'nanjing': 'NKG',
  'qingdao': 'TAO',
  'dalian': 'DLC',
  'harbin': 'HRB',
  'shenyang': 'SHE',
  'kunming': 'KMG',
  'guilin': 'KWL',
  'lijiang': 'LJG',
  'dali': 'DLU',
  'xiamen': 'XMN',
  'fuzhou': 'FOC',
  'wenzhou': 'WNZ',
  'ningbo': 'NGB',
  'hefei': 'HFE',
  'nanchang': 'KHN',
  'changsha': 'CSX',
  'wuxi': 'WUX',
  'suzhou': 'SZV',
  'yangzhou': 'YTY',
  'zhenjiang': 'ZHE',
  'changzhou': 'CZX',
  'taiyuan': 'TYN',
  'datong': 'DAT',
  'yinchuan': 'INC',
  'lanzhou': 'LHW',
  'xining': 'XNN',
  'urumqi': 'URC',
  'kashgar': 'KHG',
  'hohhot': 'HET',
  'baotou': 'BAV',
  'haikou': 'HAK',
  'sanya': 'SYX',
  'zhuhai': 'ZUH',
  'dongguan': 'DGM',
  'foshan': 'FOS',
  'zhongshan': 'ZHM',
  'jiangmen': 'JMN',
  'huizhou': 'HUI',
  'taichung': 'RMQ',
  'tainan': 'TNN',
  'hualien': 'HUN',
  'taitung': 'TTT',
  'keelung': 'KEE',
  'chiayi': 'CYI',
  'changhua': 'CHG',
  'nantou': 'NTO',
  'pingtung': 'PTG',
  'yilan': 'YIL',

  // Additional Indian Cities
  'jaipur': 'JAI',
  'udaipur': 'UDR',
  'jodhpur': 'JDH',
  'bikaner': 'BKB',
  'ajmer': 'AJM',
  'kota': 'KTU',
  'bhopal': 'BHO',
  'indore': 'IDR',
  'gwalior': 'GWL',
  'jabalpur': 'JLR',
  'ujjain': 'UJN',
  'nagpur': 'NAG',
  'aurangabad': 'IXU',
  'nasik': 'ISK',
  'pune': 'PNQ',
  'kolhapur': 'KOP',
  'solapur': 'SSE',
  'mangalore': 'IXE',
  'mysore': 'MYQ',
  'hubli': 'HBX',
  'belgaum': 'IXG',
  'coimbatore': 'CJB',
  'madurai': 'IXM',
  'tiruchirapalli': 'TRZ',
  'salem': 'SXV',
  'tirunelveli': 'TEN',
  'tuticorin': 'TCR',
  'vellore': 'VLR',
  'pondicherry': 'PNY',
  'thanjavur': 'TJV',
  'erode': 'ERD',
  'tirupati': 'TIR',
  'vijayawada': 'VGA',
  'visakhapatnam': 'VTZ',
  'rajahmundry': 'RJA',
  'kakinada': 'KKD',
  'guntur': 'GNT',
  'nellore': 'NLR',
  'warangal': 'WGC',
  'karimnagar': 'KMR',
  'nizamabad': 'NZB',
  'khammam': 'KHM',
  'kadapa': 'CDP',
  'kurnool': 'KJB',
  'anantapur': 'ATP',
  'chittoor': 'CTO',
  'bhubaneswar': 'BBI',
  'cuttack': 'CTC',
  'rourkela': 'RRK',
  'berhampur': 'BAM',
  'sambalpur': 'SBP',
  'puri': 'PRI',
  'koraput': 'JGB',
  'jeypore': 'PYB',
  'jharsuguda': 'JRG',
  'ranchi': 'IXR',
  'jamshedpur': 'IXW',
  'dhanbad': 'DHN',
  'bokaro': 'CKU',
  'deoghar': 'DGH',
  'hazaribagh': 'HAZ',
  'gaya': 'GAY',
  'patna': 'PAT',
  'muzaffarpur': 'MFP',
  'darbhanga': 'DBR',
  'begusarai': 'RGH',
  'bhagalpur': 'BGR',
  'purnia': 'PUR',
  'siliguri': 'IXB',
  'darjeeling': 'DAR',
  'asansol': 'ASN',
  'durgapur': 'RDP',
  'malda': 'LDA',
  'cooch behar': 'COH',
  'agartala': 'IXA',
  'imphal': 'IMF',
  'kohima': 'KHM',
  'dimapur': 'DMU',
  'aizawl': 'AJL',
  'shillong': 'SHL',
  'guwahati': 'GAU',
  'tezpur': 'TEZ',
  'dibrugarh': 'DIB',
  'jorhat': 'JRH',
  'silchar': 'IXS',
  'itanagar': 'HGI',
  'gangtok': 'GAO',
  'bagdogra': 'IXB',
  'dehradun': 'DED',
  'haridwar': 'HRD',
  'rishikesh': 'RSH',
  'nainital': 'PBH',
  'mussoorie': 'MSR',
  'shimla': 'SLV',
  'manali': 'KUU',
  'dharamshala': 'DHM',
  'jammu': 'IXJ',
  'srinagar': 'SXR',
  'leh': 'IXL',
  'kargil': 'KGL',
  'chandigarh': 'IXC',
  'amritsar': 'ATQ',
  'ludhiana': 'LUH',
  'jalandhar': 'JUC',
  'bathinda': 'BUP',
  'patiala': 'PTA',
  'faridkot': 'FDK',
  'mohali': 'MOH',
  'zirakpur': 'ZRK',

  // Additional Southeast Asian Cities
  'chiang rai': 'CEI',
  'udon thani': 'UTH',
  'khon kaen': 'KKC',
  'nakhon ratchasima': 'NAK',
  'ubon ratchathani': 'UBP',
  'hat yai': 'HDY',
  'krabi': 'KBV',
  'koh samui': 'USM',
  'trang': 'TST',
  'surat thani': 'URT',
  'phitsanulok': 'PHS',
  'tak': 'TKT',
  'mae hong son': 'HGN',
  'nan': 'NNT',
  'phrae': 'PRH',
  'lampang': 'LPT',
  'sukhothai': 'THS',
  'phichit': 'PCT',
  'uttaradit': 'UTR',
  'loei': 'LOE',
  'nong khai': 'NKH',
  'sakon nakhon': 'SNO',
  'mukdahan': 'MDH',
  'yasothon': 'YSO',
  'roi et': 'ROI',
  'maha sarakham': 'MSH',
  'kalasin': 'KSN',
  'buriram': 'BUR',
  'surin': 'SRN',
  'si sa ket': 'SSK',
  'amnat charoen': 'ACN',
  'chaiyaphum': 'CYP',
  'nakhon phanom': 'NHP',
  'phayao': 'PYO',
  'chiang saen': 'CSN',
  'mae sai': 'MSI',
  'mae sot': 'MST',
  'three pagodas pass': 'TPP',
  'kanchanaburi': 'KCB',
  'ratchaburi': 'RCB',
  'phetchaburi': 'PCB',
  'hua hin': 'HHQ',
  'chumphon': 'CJM',
  'ranong': 'UNN',
  'phang nga': 'PGA',
  'satun': 'STN',
  'songkhla': 'SGZ',
  'pattani': 'PAN',
  'yala': 'YLA',
  'narathiwat': 'NWT',
  'betong': 'BTG',
  'su-ngai kolok': 'SGK',
  'padang besar': 'PDB',
  'danok': 'DNK',
  'sadao': 'SDO',
  'wang kelian': 'WKL',

  // Middle East Cities
  'isfahan': 'IFN',
  'shiraz': 'SYZ',
  'mashhad': 'MHD',
  'tabriz': 'TBZ',
  'ahvaz': 'AWZ',
  'abadan': 'ABD',
  'bandar abbas': 'BND',
  'kerman': 'KER',
  'yazd': 'AZD',
  'qom': 'QOM',
  'karaj': 'KRJ',
  'arak': 'AJK',
  'hamadan': 'HDM',
  'sanandaj': 'SDG',
  'kermanshah': 'KSH',
  'ilam': 'IIL',
  'khorramabad': 'KHD',
  'yasuj': 'YES',
  'bushehr': 'BUZ',
  'bandar lengeh': 'BDH',
  'chabahar': 'ZBR',
  'zahedan': 'ZAH',
  'birjand': 'XBJ',
  'bojnord': 'BJB',
  'gorgan': 'GBT',
  'sari': 'SRY',
  'babol': 'BBL',
  'amol': 'AML',
  'rasht': 'RAS',
  'bandar anzali': 'BAN',
  'astara': 'AST',
  'ardabil': 'ADU',
  'parsabad': 'PSD',
  'maku': 'MAK',
  'jolfa': 'JLF',
  'ahar': 'AHR',
  'marand': 'MRN',
  'shabestar': 'SBT',
  'maragheh': 'MGH',
  'bonab': 'BNB',
  'mianeh': 'MNH',
  'zanjan': 'JWN',
  'qazvin': 'GZW',
  'takestan': 'TKS',
  'abhar': 'ABH',
  'khorramdarreh': 'KHR',
  'mohammadiyeh': 'MOH',

  // Additional African Cities  
  'alexandria': 'HBE',
  'luxor': 'LXR',
  'aswan': 'ASW',
  'hurghada': 'HRG',
  'sharm el sheikh': 'SSH',
  'marsa alam': 'RMF',
  'el gouna': 'EGO',
  'dahab': 'DAB',
  'st catherine': 'STC',
  'siwa': 'SIW',
  'kharga': 'UVL',
  'dakhla': 'DAK',
  'farafra': 'FAR',
  'bahariya': 'BAH',
  'fayoum': 'FYM',
  'minya': 'MNY',
  'asyut': 'ASY',
  'sohag': 'SOH',
  'qena': 'QEN',
  'edfu': 'EDF',
  'kom ombo': 'KOM',
  'abu simbel': 'ABS',
  'wadi halfa': 'WDH',
  'port sudan': 'PZU',
  'kassala': 'KSL',
  'gedaref': 'GDF',
  'el obeid': 'EBD',
  'nyala': 'UYL',
  'el fasher': 'ELF',
  'geneina': 'EGN',
  'dongola': 'DOG',
  'karima': 'KRM',
  'merowe': 'MRW',
  'atbara': 'ATB',
  'wad medani': 'WMD',
  'sennar': 'SNR',
  'damazin': 'DMZ',
  'malakal': 'MAK',
  'juba': 'JUB',
  'wau': 'WUU',
  'rumbek': 'RBK',
  'yei': 'YEI',
  'torit': 'TRT',
  'bor': 'BOR',
  'bentiu': 'BNT',
  'aweil': 'AWL',
  'kuacjok': 'KCK',
  'pibor': 'PBR',
  'kapoeta': 'KPT',
  'yambio': 'YBO',
  'maridi': 'MRD',
  'pochalla': 'PCL',
  'nasir': 'NSR',
  'akobo': 'AKB',
  'ulang': 'ULG',
  'kodok': 'KDK',
  'renk': 'RNK',
  'melut': 'MLT',
  'pariang': 'PRG',
  'mankien': 'MKN',
  'mayom': 'MYM',
  'abiemnhom': 'ABM',
  'rubkona': 'RBN',
  'leer': 'LER',
  'adok': 'ADK',
  'koch': 'KCH',
  'mayendit': 'MYD',
  'panyijiar': 'PYR',
  'ler': 'LER',
  'old fangak': 'OFK',
  'ayod': 'AYD',
  'duk fadiat': 'DKF',
  'wuror': 'WRR',
  'nyirol': 'NYR',
  'uror': 'URR',
  'akobo': 'AKB',
  'pochalla': 'PCL',
  'pibor': 'PBR',
  'kapoeta east': 'KPE',
  'kapoeta north': 'KPN',
  'kapoeta south': 'KPS',
  'budi': 'BDI',
  'ikwoto': 'IKT',
  'magwi': 'MGI',
  'lafon': 'LFN',
  'ikotos': 'IKS',
  'torit': 'TRT',
  'lopa': 'LPA',
  'isoke': 'ISK',

  // Additional Caribbean Cities
  'oranjestad': 'AUA',
  'willemstad': 'CUR',
  'kralendijk': 'BON',
  'philipsburg': 'SXM',
  'gustavia': 'SBH',
  'marigot': 'SFG',
  'the bottom': 'SAB',
  'basseterre': 'SKB',
  'charlestown': 'NEV',
  'plymouth': 'MNI',
  'brades': 'MNI',
  'st johns': 'ANU',
  'codrington': 'BBQ',
  'roseau': 'DOM',
  'portsmouth': 'DOM',
  'castries': 'UVF',
  'vieux fort': 'UVF',
  'soufriere': 'UVF',
  'kingstown': 'SVD',
  'bequia': 'BQU',
  'mustique': 'MQS',
  'canouan': 'CIW',
  'union island': 'UNI',
  'carriacou': 'CRU',
  'petite martinique': 'PMV',
  'st george': 'GND',
  'grenville': 'GND',
  'gouyave': 'GND',
  'victoria': 'GND',
  'sauteurs': 'GND',
  'hillsborough': 'CRU',
  'windward': 'CRU',
  'tyrel bay': 'CRU',
  'harvey vale': 'CRU',
  'bogles': 'CRU',
  'grand bay': 'CRU',
  'l anse aux epines': 'GND',
  'grand anse': 'GND',
  'morne rouge': 'GND',
  'woburn': 'GND',
  'westerhall': 'GND',
  'calivigny': 'GND',
  'prickly bay': 'GND',
  'true blue': 'GND',
  'la sagesse': 'GND',
  'bathway': 'GND',
  'levera': 'GND',
  'sauteurs': 'GND',
  'victoria': 'GND',
  'gouyave': 'GND',
  'grenville': 'GND',

  // Pacific Island Destinations
  'port moresby': 'POM',
  'mount hagen': 'HGU',
  'lae': 'LAE',
  'madang': 'MAG',
  'wewak': 'WWK',
  'vanimo': 'VAI',
  'daru': 'DAU',
  'kerema': 'KMA',
  'popondetta': 'PNP',
  'hoskins': 'HKN',
  'kimbe': 'HKN',
  'rabaul': 'RAB',
  'kokopo': 'RAB',
  'mendi': 'MDU',
  'tari': 'TIZ',
  'tabubil': 'TBG',
  'kiunga': 'UNG',
  'balimo': 'OPU',
  'nomad': 'NOM',
  'telefomin': 'TFM',
  'oksapmin': 'OKS',
  'kompiam': 'KMP',
  'wabag': 'WAG',
  'tambul': 'TBL',
  'ialibu': 'ILB',
  'pangia': 'PNG',
  'kagua': 'KGU',
  'erave': 'ERV',
  'koroba': 'KRB',
  'kopiago': 'KPI',
  'nipa': 'NIP',
  'lake kopiago': 'LKP',
  'margarima': 'MGR',
  'kandep': 'KDP',
  'pogera': 'PGR',
  'porgera': 'PGR',
  'laiagam': 'LAG',
  'wapenamanda': 'WPN',
  'baiyer': 'BAY',
  'minj': 'MNJ',
  'kundiawa': 'KUD',
  'kerowagi': 'KRW',
  'chuave': 'CHV',
  'sinasina': 'SIN',
  'yongomugl': 'YGM',
  'bogia': 'BOG',
  'angoram': 'AGM',
  'ambunti': 'ABT',
  'maprik': 'MPK',
  'yangoru': 'YGR',
  'dagua': 'DAG',
  'but': 'BUT',
  'nuku': 'NUK',
  'aitape': 'ATP',
  'sandaun': 'SND',
  'telefomin': 'TFM',
  'oksapmin': 'OKS',
  'star mountains': 'STM',
  'green river': 'GRR',
  'frieda river': 'FRR',
  'april river': 'APR',
  'may river': 'MAR',
  'leonard schulze': 'LSR',
  'yapsiei': 'YPS',
  'binatang': 'BNT',
  'nomad river': 'NMR',
  'strickland river': 'STR',
  'murray river': 'MRR',
  'fly river': 'FLR',
  'palmer river': 'PLR',
  'alice river': 'ALR',
  'morehead': 'MHD',
  'wipim': 'WPM',
  'balamuk': 'BLM',
  'rouku': 'ROU',
  'mabudawan': 'MBD',
  'kunini': 'KUN',
  'wasua': 'WAS',
  'arufi': 'ARF',
  'gogodala': 'GOG',
  'aramia river': 'ARM',
  'bamu river': 'BAM',
  'turama river': 'TUR',
  'kikori river': 'KIK',
  'purari river': 'PUR',
  'vailala river': 'VAI',
  'era river': 'ERA',
  'tauri river': 'TAU',
  'omati river': 'OMA',
  'kaiam river': 'KAI',
  'baimuru': 'BIM',
  'ihu': 'IHU',
  'moveave': 'MOV',
  'kaintiba': 'KNT',
  'tapini': 'TPN',
  'woitape': 'WTP',
  'yule island': 'YUI',
  'amazon bay': 'AMB',
  'bereina': 'BRN',
  'kerema': 'KMA',
  'mendi': 'MDU',
  'nipa': 'NIP',
  'tari': 'TIZ',
};

import { searchLocations, getAirportFromLocation } from './locationDatabase';

export function getAirportCode(city: string): string {
  const key = city.toLowerCase().trim();
  console.log(`Looking up airport code for: "${city}" -> "${key}"`);
  
  // Handle specific trip names
  if (key.includes('croatia') || key.includes('girls trip')) {
    console.log(`Detected Croatia trip, returning ZAG`);
    return 'ZAG';
  }
  
  // Try new smart location search first
  const smartResult = getAirportFromLocation(city);
  if (smartResult !== 'JFK') {
    console.log(`Smart search found: ${smartResult}`);
    return smartResult;
  }
  
  // Fallback to existing mapping
  const code = airportCodes[key];
  if (!code) {
    console.log(`No airport code found for "${key}", using fallback JFK`);
    return 'JFK';
  }
  console.log(`Found airport code: ${code}`);
  return code;
}

export function getHotelCityCode(city: string): string {
  const key = city.toLowerCase().trim();
  
  // First try exact match
  if (hotelCityCodes[key]) {
    console.log(`Found exact hotel city code for ${key}: ${hotelCityCodes[key]}`);
    return hotelCityCodes[key];
  }
  
  // Try to extract city name from patterns like "Denver, Colorado (DEN)" or "New York, NY"
  const cityMatch = key.match(/^([^,(\s]+(?:\s+[^,(\s]+)*)/);
  if (cityMatch) {
    const extractedCity = cityMatch[1].trim();
    if (hotelCityCodes[extractedCity]) {
      console.log(`Found hotel city code via extraction for ${extractedCity}: ${hotelCityCodes[extractedCity]}`);
      return hotelCityCodes[extractedCity];
    }
  }
  
  // Smart search - try to extract city name from full location names (like airport function)
  for (const [cityName, code] of Object.entries(hotelCityCodes)) {
    if (key.includes(cityName)) {
      console.log(`Smart hotel search found: ${code}`);
      return code;
    }
  }
  
  console.log(`No hotel city code found for "${city}", using fallback NYC`);
  return 'NYC'; // Default fallback
}

export async function getCityCoordinates(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(`🌍 Geocoding location: ${city}`);
    
    // First try the fallback list for common cities (faster)
    const fallbackCoords = getFallbackCoordinates(city);
    if (fallbackCoords) {
      console.log(`✅ Found coordinates from fallback for ${city}: ${fallbackCoords.lat}, ${fallbackCoords.lng}`);
      return fallbackCoords;
    }
    
    // Use OpenStreetMap Nominatim API for free geocoding
    const encodedCity = encodeURIComponent(city.trim());
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedCity}&format=json&limit=1&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'TripSync-Travel-App/1.0 (https://tripsync.app)', // Required by Nominatim
      },
    });
    
    if (!response.ok) {
      console.log(`❌ Nominatim API error: ${response.status}, trying fallback for ${city}`);
      return getFallbackCoordinates(city);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log(`❌ No coordinates found via Nominatim for: ${city}, trying fallback`);
      return getFallbackCoordinates(city);
    }
    
    const location = data[0];
    const coordinates = {
      lat: parseFloat(location.lat),
      lng: parseFloat(location.lon)
    };
    
    console.log(`✅ Found coordinates via Nominatim for ${city}: ${coordinates.lat}, ${coordinates.lng}`);
    return coordinates;
    
  } catch (error) {
    console.error(`❌ Geocoding error for ${city}:`, error);
    console.log(`🔄 Trying fallback coordinates for ${city}`);
    return getFallbackCoordinates(city);
  }
}

function getFallbackCoordinates(cityName: string): { lat: number; lng: number } | null {
  const normalizedName = cityName.toLowerCase().trim();
  
  // Direct lookup
  if (cityCoordinates[normalizedName]) {
    return cityCoordinates[normalizedName];
  }
  
  // Fuzzy matching for common variations
  for (const [key, coords] of Object.entries(cityCoordinates)) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return coords;
    }
  }
  
  // Handle common abbreviations and variations
  const variations: { [key: string]: string } = {
    // US Cities
    'nyc': 'new york',
    'ny': 'new york',
    'la': 'los angeles',
    'sf': 'san francisco',
    'dc': 'washington',
    'atl': 'atlanta',
    'chi': 'chicago',
    'lv': 'las vegas',
    'vegas': 'las vegas',
    'phx': 'phoenix',
    'hou': 'houston',
    'dal': 'dallas',
    'sea': 'seattle',
    'bos': 'boston',
    'den': 'denver',
    'nash': 'nashville',
    'orl': 'orlando',
    'mia': 'miami',
    'pdx': 'portland',
    'sac': 'sacramento',
    'slc': 'salt lake city',
    'msp': 'minneapolis',
    'dtw': 'detroit',
    'clt': 'charlotte',
    'phl': 'philadelphia',
    'bna': 'nashville',
    'mco': 'orlando',
    'tpa': 'tampa',
    
    // International Cities
    'lon': 'london',
    'par': 'paris',
    'rom': 'rome',
    'bcn': 'barcelona',
    'mad': 'madrid',
    'ams': 'amsterdam',
    'ber': 'berlin',
    'mun': 'munich',
    'fra': 'frankfurt',
    'vie': 'vienna',
    'zur': 'zurich',
    'mil': 'milan',
    'flo': 'florence',
    'ven': 'venice',
    'ath': 'athens',
    'ist': 'istanbul',
    'dub': 'dublin',
    'cph': 'copenhagen',
    'sto': 'stockholm',
    'osl': 'oslo',
    'hel': 'helsinki',
    'bru': 'brussels',
    'lis': 'lisbon',
    'pra': 'prague',
    'bud': 'budapest',
    'war': 'warsaw',
    'kra': 'krakow',
    'vie': 'vienna',
    
    // Asian Cities
    'tyo': 'tokyo',
    'osa': 'osaka',
    'kyo': 'kyoto',
    'sel': 'seoul',
    'pek': 'beijing',
    'sha': 'shanghai',
    'hkg': 'hong kong',
    'sin': 'singapore',
    'bkk': 'bangkok',
    'bom': 'mumbai',
    'del': 'delhi',
    'blr': 'bangalore',
    'ccu': 'kolkata',
    'maa': 'chennai',
    'hyd': 'hyderabad',
    'dxb': 'dubai',
    'auh': 'abu dhabi',
    'doh': 'doha',
    'ruh': 'riyadh',
    'kwi': 'kuwait city',
    'cgk': 'jakarta',
    'kul': 'kuala lumpur',
    'mnl': 'manila',
    'sgn': 'ho chi minh city',
    'han': 'hanoi',
    'pnh': 'phnom penh',
    'rep': 'siem reap',
    'vte': 'vientiane',
    'rgn': 'yangon',
    'cmb': 'colombo',
    'dac': 'dhaka',
    'ktm': 'kathmandu',
    'isb': 'islamabad',
    'khi': 'karachi',
    'lhe': 'lahore',
    
    // African Cities
    'cai': 'cairo',
    'rak': 'marrakech',
    'cas': 'casablanca',
    'rab': 'rabat',
    'tun': 'tunis',
    'alg': 'algiers',
    'los': 'lagos',
    'acc': 'accra',
    'nbo': 'nairobi',
    'dar': 'dar es salaam',
    'cpt': 'cape town',
    'jnb': 'johannesburg',
    'dur': 'durban',
    'add': 'addis ababa',
    'krt': 'khartoum',
    'kin': 'kinshasa',
    'lad': 'luanda',
    'wdh': 'windhoek',
    'mpm': 'maputo',
    'tnr': 'antananarivo',
    
    // South American Cities
    'rio': 'rio de janeiro',
    'sao': 'sao paulo',
    'bsb': 'brasilia',
    'ssa': 'salvador',
    'for': 'fortaleza',
    'rec': 'recife',
    'cnf': 'belo horizonte',
    'mao': 'manaus',
    'bue': 'buenos aires',
    'cba': 'cordoba',
    'mdz': 'mendoza',
    'brc': 'bariloche',
    'scl': 'santiago',
    'vap': 'valparaiso',
    'lim': 'lima',
    'cuz': 'cusco',
    'aqp': 'arequipa',
    'bog': 'bogota',
    'mde': 'medellin',
    'ctg': 'cartagena',
    'cas': 'caracas',
    'uio': 'quito',
    'gye': 'guayaquil',
    'lpb': 'la paz',
    'vvi': 'santa cruz',
    'asu': 'asuncion',
    'mvd': 'montevideo',
    'geo': 'georgetown',
    'pbm': 'paramaribo',
    'cay': 'cayenne',
    
    // Australian/Oceania Cities
    'syd': 'sydney',
    'mel': 'melbourne',
    'bne': 'brisbane',
    'per': 'perth',
    'adl': 'adelaide',
    'ool': 'gold coast',
    'cns': 'cairns',
    'drw': 'darwin',
    'cbr': 'canberra',
    'hba': 'hobart',
    'akl': 'auckland',
    'wlg': 'wellington',
    'chc': 'christchurch',
    'zqn': 'queenstown',
    'rot': 'rotorua',
    'suv': 'suva',
    'nan': 'nadi',
    'vli': 'port vila',
    'nou': 'noumea',
    'ppt': 'papeete',
    
    // Popular tourist destinations
    'bali': 'bali',
    'phuket': 'phuket',
    'maldives': 'maldives',
    'santorini': 'santorini',
    'mykonos': 'mykonos',
    'crete': 'crete',
    'mallorca': 'mallorca',
    'ibiza': 'ibiza',
    'sicily': 'sicily',
    'corsica': 'corsica',
    'sardinia': 'sardinia',
    'hawaii': 'hawaii',
    'jamaica': 'jamaica',
    'barbados': 'barbados',
    'mauritius': 'mauritius',
    'seychelles': 'seychelles',
    'fiji': 'fiji',
    'tahiti': 'tahiti',
    'iceland': 'iceland',
    'reykjavik': 'reykjavik',
    
    // Additional abbreviations for new cities
    'guadalajara': 'guadalajara',
    'gdl': 'guadalajara',
    'monterrey': 'monterrey',
    'mty': 'monterrey',
    'tijuana': 'tijuana',
    'tij': 'tijuana',
    'puebla': 'puebla',
    'pue': 'puebla',
    'can': 'cancun',
    'cun': 'cancun',
    'pvr': 'puerto vallarta',
    'pdc': 'playa del carmen',
    'coz': 'cozumel',
    'tul': 'tulum',
    'chi': 'chichen itza',
    'gto': 'guanajuato',
    'sma': 'san miguel de allende',
    'tax': 'taxco',
    'pxm': 'puerto escondido',
    'hux': 'huatulco',
    'zih': 'zihuatanejo',
    'ixt': 'ixtapa',
    'ros': 'rosarito',
    'ens': 'ensenada',
    'lor': 'loreto',
    'tds': 'todos santos',
    'mex': 'mexico city',
    'acapulco': 'acapulco',
    'aca': 'acapulco',
    'maz': 'mazatlan',
    'ver': 'veracruz',
    'xal': 'xalapa',
    'tam': 'tampico',
    'oax': 'oaxaca',
    'vsa': 'villahermosa',
    'cam': 'campeche',
    'ctm': 'chetumal',
    'lap': 'la paz',
    'sjd': 'cabo san lucas',
    'cab': 'cabo san lucas',
    'cabo': 'cabo san lucas',
    'merida': 'merida',
    'mid': 'merida',
    'yucatan': 'merida',
    'palenque': 'palenque',
    'pal': 'palenque',
    
    // Additional European abbreviations
    'salzburg': 'salzburg',
    'sbg': 'salzburg',
    'innsbruck': 'innsbruck',
    'inn': 'innsbruck',
    'nap': 'naples',
    'naples': 'naples',
    'tur': 'turin',
    'turin': 'turin',
    'gen': 'genoa',
    'genoa': 'genoa',
    'bol': 'bologna',
    'bologna': 'bologna',
    'pmo': 'palermo',
    'palermo': 'palermo',
    'cta': 'catania',
    'catania': 'catania',
    'sev': 'seville',
    'seville': 'seville',
    'vlc': 'valencia',
    'valencia': 'valencia',
    'bil': 'bilbao',
    'bilbao': 'bilbao',
    'grx': 'granada',
    'granada': 'granada',
    'tol': 'toledo',
    'toledo': 'toledo',
    'scq': 'santiago de compostela',
    'santiago': 'santiago de compostela',
    'lyo': 'lyon',
    'lyon': 'lyon',
    'mrs': 'marseille',
    'marseille': 'marseille',
    'nce': 'nice',
    'nice': 'nice',
    'can': 'cannes',
    'cannes': 'cannes',
    'mon': 'monaco',
    'monaco': 'monaco',
    'mpl': 'montpellier',
    'montpellier': 'montpellier',
    'tls': 'toulouse',
    'toulouse': 'toulouse',
    'bod': 'bordeaux',
    'bordeaux': 'bordeaux',
    'lil': 'lille',
    'lille': 'lille',
    'sxb': 'strasbourg',
    'strasbourg': 'strasbourg',
    'rms': 'reims',
    'reims': 'reims',
    'nte': 'nantes',
    'nantes': 'nantes',
    'rns': 'rennes',
    'rennes': 'rennes',
    'haj': 'hannover',
    'hannover': 'hannover',
    'dtm': 'dortmund',
    'dortmund': 'dortmund',
    'str': 'stuttgart',
    'stuttgart': 'stuttgart',
    'nue': 'nuremberg',
    'nuremberg': 'nuremberg',
    'drs': 'dresden',
    'dresden': 'dresden',
    'lej': 'leipzig',
    'leipzig': 'leipzig',
    'bre': 'bremen',
    'bremen': 'bremen',
    'rtm': 'rotterdam',
    'rotterdam': 'rotterdam',
    'utr': 'utrecht',
    'utrecht': 'utrecht',
    'ein': 'eindhoven',
    'eindhoven': 'eindhoven',
    'hag': 'the hague',
    'the hague': 'the hague',
    'gro': 'groningen',
    'groningen': 'groningen',
    'gnt': 'ghent',
    'ghent': 'ghent',
    'brg': 'bruges',
    'bruges': 'bruges',
    'anr': 'antwerp',
    'antwerp': 'antwerp',
    'gva': 'geneva',
    'geneva': 'geneva',
    'bsl': 'basel',
    'basel': 'basel',
    'luc': 'lucerne',
    'lucerne': 'lucerne',
    'int': 'interlaken',
    'interlaken': 'interlaken',
    'zer': 'zermatt',
    'zermatt': 'zermatt',
    'brn': 'bern',
    'bern': 'bern',
    'got': 'gothenburg',
    'gothenburg': 'gothenburg',
    'mmo': 'malmo',
    'malmo': 'malmo',
    'upp': 'uppsala',
    'uppsala': 'uppsala',
    'aar': 'aarhus',
    'aarhus': 'aarhus',
    'ode': 'odense',
    'odense': 'odense',
    'aal': 'aalborg',
    'aalborg': 'aalborg',
    'bgn': 'bergen',
    'bergen': 'bergen',
    'trh': 'trondheim',
    'trondheim': 'trondheim',
    'svg': 'stavanger',
    'stavanger': 'stavanger',
    'tre': 'tampere',
    'tampere': 'tampere',
    'tku': 'turku',
    'turku': 'turku',
    'ouu': 'oulu',
    'oulu': 'oulu',
    'tll': 'tallinn',
    'tallinn': 'tallinn',
    'rix': 'riga',
    'riga': 'riga',
    'vno': 'vilnius',
    'vilnius': 'vilnius',
    'kau': 'kaunas',
    'kaunas': 'kaunas',
    'msk': 'moscow',
    'moscow': 'moscow',
    'led': 'st petersburg',
    'st petersburg': 'st petersburg',
    'spb': 'st petersburg',
    'mns': 'minsk',
    'minsk': 'minsk',
    'kyv': 'kyiv',
    'kyiv': 'kyiv',
    'kiev': 'kyiv',
    'ode': 'odessa',
    'odessa': 'odessa',
    'lvv': 'lviv',
    'lviv': 'lviv',
    'kis': 'chisinau',
    'chisinau': 'chisinau',
    'buh': 'bucharest',
    'bucharest': 'bucharest',
    'clj': 'cluj-napoca',
    'cluj': 'cluj-napoca',
    'tsr': 'timisoara',
    'timisoara': 'timisoara',
    'ias': 'iasi',
    'iasi': 'iasi',
    'brs': 'brasov',
    'brasov': 'brasov',
    'cnd': 'constanta',
    'constanta': 'constanta',
    'sof': 'sofia',
    'sofia': 'sofia',
    'pdv': 'plovdiv',
    'plovdiv': 'plovdiv',
    'var': 'varna',
    'varna': 'varna',
    'bog': 'burgas',
    'burgas': 'burgas',
    'beg': 'belgrade',
    'belgrade': 'belgrade',
    'nov': 'novi sad',
    'novi sad': 'novi sad',
    'ini': 'nis',
    'nis': 'nis',
    'sjj': 'sarajevo',
    'sarajevo': 'sarajevo',
    'omn': 'mostar',
    'mostar': 'mostar',
    'bjl': 'banja luka',
    'banja luka': 'banja luka',
    'skp': 'skopje',
    'skopje': 'skopje',
    'ohd': 'ohrid',
    'ohrid': 'ohrid',
    'bit': 'bitola',
    'bitola': 'bitola',
    'tia': 'tirana',
    'tirana': 'tirana',
    'dur': 'durres',
    'durres': 'durres',
    'vlr': 'vlore',
    'vlore': 'vlore',
    'tgd': 'podgorica',
    'podgorica': 'podgorica',
    'tiv': 'kotor',
    'kotor': 'kotor',
    'tiv': 'budva',
    'budva': 'budva',
    'prn': 'pristina',
    'pristina': 'pristina',
    'prz': 'prizren',
    'prizren': 'prizren',
  };
  
  if (variations[normalizedName]) {
    return cityCoordinates[variations[normalizedName]];
  }
  
  return null;
}