// Duffel API Service - Alternative Flight Search Provider
// Provides access to major US airlines (American, United, Delta) missing from Amadeus Self-Service

import { Duffel } from '@duffel/api';

// TypeScript interfaces for Duffel API responses
interface DuffelAirline {
  id: string;
  iata_code: string;
  icao_code: string;
  name: string;
}

interface DuffelAirport {
  id: string;
  iata_code: string;
  icao_code: string;
  name: string;
  city_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  time_zone: string;
}

interface DuffelCabin {
  amenities: {
    [key: string]: any;
  };
  marketing_name: string;
}

interface DuffelSegment {
  id: string;
  aircraft: {
    id: string;
    iata_code: string;
    name: string;
  };
  arriving_at: string;
  departing_at: string;
  destination: DuffelAirport;
  distance: string;
  duration: string;
  marketing_carrier: DuffelAirline;
  marketing_carrier_flight_number: string;
  operating_carrier: DuffelAirline;
  operating_carrier_flight_number: string;
  origin: DuffelAirport;
  passengers: Array<{
    id: string;
    baggages: Array<{
      type: string;
      quantity: number;
    }>;
    cabin: DuffelCabin;
    cabin_class: string;
    cabin_class_marketing_name: string;
    fare_basis_code: string;
    passenger_id: string;
  }>;
  stops: Array<{
    id: string;
    airport: DuffelAirport;
    arriving_at: string;
    departing_at: string;
    duration: string;
  }>;
}

interface DuffelSlice {
  id: string;
  destination: DuffelAirport;
  destination_type: string;
  duration: string;
  origin: DuffelAirport;
  origin_type: string;
  segments: DuffelSegment[];
}

interface DuffelOffer {
  id: string;
  allowed_passenger_identity_document_types: string[];
  available_services: any[];
  base_amount: string;
  base_currency: string;
  conditions: {
    advance_seat_selection: boolean;
    change_before_departure?: {
      allowed: boolean;
      penalty_amount?: string;
      penalty_currency?: string;
    };
    cancellation_before_departure?: {
      allowed: boolean;
      penalty_amount?: string;
      penalty_currency?: string;
    };
    refund_before_departure?: {
      allowed: boolean;
      penalty_amount?: string;
      penalty_currency?: string;
    };
  };
  created_at: string;
  expires_at: string;
  live_mode: boolean;
  owner: DuffelAirline;
  partial: boolean;
  passenger_identity_documents_required: boolean;
  passengers: Array<{
    id: string;
    type: string;
  }>;
  payment_requirements: {
    payment_required_by?: string;
    price_guarantee_expires_at?: string;
    requires_instant_payment: boolean;
  };
  private_fares: any[];
  slices: DuffelSlice[];
  supported_passenger_identity_document_types: string[];
  tax_amount: string;
  tax_currency: string;
  total_amount: string;
  total_currency: string;
  total_emissions_kg: string;
  updated_at: string;
}

interface DuffelOfferRequest {
  id: string;
  cabin_class: string;
  live_mode: boolean;
  passengers: Array<{
    id: string;
    type: string;
  }>;
  slices: Array<{
    id: string;
    destination: string;
    departure_date: string;
    destination_type: string;
    origin: string;
    origin_type: string;
  }>;
}

interface DuffelSearchResponse {
  data: DuffelOffer[];
  meta: {
    count: number;
    limit: number;
    offset: number;
  };
}

// Import AmadeusFlightOffer interface from amadeusService for compatibility
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

// Airline name to IATA code mapping for major US carriers
const AIRLINE_NAME_TO_IATA: { [key: string]: string } = {
  'american': 'AA',
  'american airlines': 'AA',
  'united': 'UA',
  'united airlines': 'UA',
  'delta': 'DL',
  'delta airlines': 'DL',
  'delta air lines': 'DL',
  'southwest': 'WN',
  'southwest airlines': 'WN',
  'jetblue': 'B6',
  'jetblue airways': 'B6',
  'alaska': 'AS',
  'alaska airlines': 'AS',
  'spirit': 'NK',
  'spirit airlines': 'NK',
  'frontier': 'F9',
  'frontier airlines': 'F9',
  'allegiant': 'G4',
  'allegiant air': 'G4',
  'hawaiian': 'HA',
  'hawaiian airlines': 'HA',
  'sun country': 'SY',
  'sun country airlines': 'SY',
  'breeze': 'MX',
  'breeze airways': 'MX',
};

// Helper function to convert airline name to IATA code
function getAirlineIataCode(airlineName?: string): string | undefined {
  if (!airlineName) return undefined;
  
  const cleanName = airlineName.toLowerCase().trim();
  return AIRLINE_NAME_TO_IATA[cleanName] || airlineName.toUpperCase();
}

// Helper function to convert travel class to Duffel cabin class
function mapTravelClassToDuffelCabin(travelClass: string): 'economy' | 'premium_economy' | 'business' | 'first' {
  const classMap: { [key: string]: 'economy' | 'premium_economy' | 'business' | 'first' } = {
    'ECONOMY': 'economy',
    'PREMIUM_ECONOMY': 'premium_economy',
    'BUSINESS': 'business',
    'FIRST': 'first',
  };
  
  return classMap[travelClass] || 'economy';
}

// Helper function to calculate duration in ISO 8601 format
function calculateDuration(departureTime: string, arrivalTime: string): string {
  const departure = new Date(departureTime);
  const arrival = new Date(arrivalTime);
  const durationMs = arrival.getTime() - departure.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  return `PT${hours}H${minutes}M`;
}

// Helper function to map Duffel offer to Amadeus flight offer format
function mapDuffelOfferToAmadeus(duffelOffer: DuffelOffer): AmadeusFlightOffer {
  const itineraries = duffelOffer.slices.map((slice, sliceIndex) => {
    const segments = slice.segments.map((segment, segmentIndex) => ({
      departure: {
        iataCode: segment.origin.iata_code,
        terminal: undefined,
        at: segment.departing_at,
      },
      arrival: {
        iataCode: segment.destination.iata_code,
        terminal: undefined,
        at: segment.arriving_at,
      },
      carrierCode: segment.marketing_carrier?.iata_code || 'XX',
      number: segment.marketing_carrier_flight_number || '',
      aircraft: {
        code: segment.aircraft?.iata_code || 'XXX',
      },
      operating: segment.operating_carrier?.iata_code && segment.operating_carrier.iata_code !== segment.marketing_carrier?.iata_code ? {
        carrierCode: segment.operating_carrier.iata_code,
      } : undefined,
      duration: segment.duration,
      id: `${sliceIndex}_${segmentIndex}`,
      numberOfStops: segment.stops.length,
    }));

    return {
      duration: slice.duration,
      segments,
    };
  });

  // Calculate tax amount
  const taxAmount = (parseFloat(duffelOffer.total_amount) - parseFloat(duffelOffer.base_amount)).toString();

  // Get primary airline from first segment
  const primaryAirline = duffelOffer.slices[0]?.segments[0]?.marketing_carrier.iata_code || 'XX';
  
  // Create traveler pricings
  const travelerPricings = duffelOffer.passengers.map((passenger, index) => ({
    travelerId: passenger.id,
    fareOption: 'STANDARD',
    travelerType: passenger.type.toUpperCase(),
    price: {
      currency: duffelOffer.total_currency,
      total: (parseFloat(duffelOffer.total_amount) / duffelOffer.passengers.length).toFixed(2),
      base: (parseFloat(duffelOffer.base_amount) / duffelOffer.passengers.length).toFixed(2),
    },
    fareDetailsBySegment: duffelOffer.slices.flatMap((slice, sliceIndex) =>
      slice.segments.map((segment, segmentIndex) => {
        const passengerSegment = segment.passengers.find(p => p.passenger_id === passenger.id);
        return {
          segmentId: `${sliceIndex}_${segmentIndex}`,
          cabin: passengerSegment?.cabin_class || 'ECONOMY',
          fareBasis: passengerSegment?.fare_basis_code || '',
          brandedFare: passengerSegment?.cabin_class_marketing_name,
          class: passengerSegment?.cabin_class?.charAt(0) || 'Y',
          includedCheckedBags: {
            quantity: passengerSegment?.baggages?.filter(b => b.type === 'checked').reduce((sum, b) => sum + b.quantity, 0) || 0,
          },
        };
      })
    ),
  }));

  return {
    id: duffelOffer.id,
    source: 'DUFFEL',
    instantTicketingRequired: duffelOffer.payment_requirements.requires_instant_payment,
    lastTicketingDate: duffelOffer.expires_at,
    numberOfBookableSeats: 9, // Duffel doesn't provide this, so we use a default
    itineraries,
    price: {
      currency: duffelOffer.total_currency,
      total: duffelOffer.total_amount,
      base: duffelOffer.base_amount,
      fees: [{
        amount: taxAmount,
        type: 'TAXES',
      }],
      grandTotal: duffelOffer.total_amount,
    },
    pricingOptions: {
      fareType: ['PUBLISHED'],
      includedCheckedBagsOnly: false,
    },
    validatingAirlineCodes: [primaryAirline],
    travelerPricings,
  };
}

// Main flight search function with same signature as Amadeus plus included_carriers optimization
export async function searchDuffelFlights(
  origin: string,
  destination: string,
  departureDate: string,
  adults: number = 1,
  returnDate?: string,
  travelClass: string = 'ECONOMY',
  airline?: string,
  includedCarriers?: string[] // New parameter for major airline optimization
): Promise<AmadeusFlightOffer[]> {
  try {
    console.log(`🔍 Duffel: Searching flights: ${origin} → ${destination} on ${departureDate}`);
    if (returnDate) {
      console.log(`🔍 Duffel: Return flight: ${destination} → ${origin} on ${returnDate}`);
    }
    console.log(`🔍 Duffel: Passengers: ${adults}, Class: ${travelClass}, Airline: ${airline || 'Any'}`);
    if (includedCarriers && includedCarriers.length > 0) {
      console.log(`🔍 Duffel: Including major carriers: ${includedCarriers.join(', ')}`);
    }

    // Validate required environment variable
    if (!process.env.DUFFEL_ACCESS_TOKEN) {
      console.error('❌ Duffel: DUFFEL_ACCESS_TOKEN environment variable not found');
      throw new Error('DUFFEL_ACCESS_TOKEN environment variable is required');
    }
    
    console.log('✅ Duffel: Access token found, proceeding with API call...');

    // Initialize Duffel client with proper validation
    const duffel = new Duffel({
      token: process.env.DUFFEL_ACCESS_TOKEN,
    });

    // Convert airline name to IATA code if provided
    const airlineIataCode = getAirlineIataCode(airline);
    if (airline && airlineIataCode) {
      console.log(`🔍 Duffel: Filtering by airline: ${airline} (${airlineIataCode})`);
    }

    // Map travel class to Duffel cabin class
    const cabinClass = mapTravelClassToDuffelCabin(travelClass);

    // Create passengers array (Duffel assigns IDs automatically, we only provide type or age)
    const passengers = Array.from({ length: adults }, () => ({
      type: 'adult'
    }));

    // Create slices for the trip
    const slices: any[] = [
      {
        origin,
        destination,
        departure_date: departureDate,
      },
    ];

    // Add return slice if it's a round trip
    if (returnDate) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: returnDate,
      });
    }

    // Create the offer request with return_offers parameter and included_carriers optimization
    const offerRequestData: any = {
      slices,
      passengers,
      cabin_class: cabinClass,
      return_offers: true,
    };

    // Add included_carriers for major airline optimization
    if (includedCarriers && includedCarriers.length > 0) {
      offerRequestData.included_carriers = includedCarriers;
      console.log(`✈️ Duffel: Optimizing search for carriers: ${includedCarriers.join(', ')}`);
    }

    console.log('🔍 Duffel: Creating offer request with data:', JSON.stringify({
      ...offerRequestData,
      // Only log first slice and first passenger to avoid clutter
      slices: offerRequestData.slices.slice(0, 1),
      passengers: offerRequestData.passengers.slice(0, 1)
    }, null, 2));
    console.log('🔍 Duffel: Passengers array length:', passengers.length);
    console.log('🔍 Duffel: Slices array length:', slices.length);
    console.log('🔍 Duffel: Passengers array content:', JSON.stringify(passengers, null, 2));
    console.log('🔍 Duffel: Slices array content:', JSON.stringify(slices, null, 2));

    // Create offer request
    let offerRequest;
    try {
      offerRequest = await duffel.offerRequests.create(offerRequestData);
      console.log('✅ Duffel: Offer request API call completed successfully');
    } catch (error) {
      console.error('❌ Duffel: Failed to create offer request:', error);
      console.error('🔍 Duffel: Error details:', error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error);
      throw error;
    }

    if (!offerRequest || !offerRequest.data) {
      console.error('❌ Duffel: No offer request created - API returned empty response');
      console.error('🔍 Duffel: Offer request response:', offerRequest);
      return [];
    }

    console.log(`✅ Duffel: Created offer request ${offerRequest.data.id}`);

    // Get offers from the offer request
    let offers;
    try {
      console.log(`🔍 Duffel: Fetching offers for request ${offerRequest.data.id}`);
      offers = await duffel.offers.list({
        offer_request_id: offerRequest.data.id,
        limit: 50, // Maximum limit for Duffel API
      });
      console.log('✅ Duffel: Offers list API call completed successfully');
    } catch (error) {
      console.error('❌ Duffel: Failed to fetch offers:', error);
      console.error('🔍 Duffel: Error details:', error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error);
      throw error;
    }

    if (!offers || !offers.data || offers.data.length === 0) {
      console.log('❌ Duffel: No offers found for the given criteria');
      console.log('🔍 Duffel: Offers response:', offers);
      return [];
    }

    console.log(`✅ Duffel: Found ${offers.data.length} flight offers`);

    // Map Duffel offers to Amadeus format for compatibility
    const mappedOffers = offers.data.map((offer: any) => mapDuffelOfferToAmadeus(offer as DuffelOffer));

    // Filter by airline if specified using offer.owner.iata_code
    let filteredOffers = mappedOffers;
    if (airlineIataCode) {
      filteredOffers = offers.data
        .filter((offer: any) => offer.owner.iata_code === airlineIataCode)
        .map((offer: any) => mapDuffelOfferToAmadeus(offer as DuffelOffer));
      console.log(`🔍 Duffel: Filtered to ${filteredOffers.length} offers for airline ${airlineIataCode}`);
    }

    return filteredOffers;

  } catch (error) {
    console.error('❌ Duffel flight search error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('DUFFEL_ACCESS_TOKEN')) {
        throw new Error('Duffel API access token is not configured. Please set DUFFEL_ACCESS_TOKEN environment variable.');
      }
      if (error.message.includes('401')) {
        throw new Error('Duffel API authentication failed. Please check your access token.');
      }
      if (error.message.includes('400')) {
        throw new Error('Invalid flight search parameters for Duffel API.');
      }
      if (error.message.includes('429')) {
        throw new Error('Duffel API rate limit exceeded. Please try again later.');
      }
    }
    
    throw error;
  }
}

// Export the search function with the same name as Amadeus for easy replacement
export { searchDuffelFlights as searchFlights };

// Export airline mapping for external use
export { AIRLINE_NAME_TO_IATA };