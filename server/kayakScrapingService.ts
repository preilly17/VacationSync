// Kayak Scraping Service - Web Scraping Flight Search Provider
// Scrapes Kayak.com for flight data to supplement Amadeus/Duffel results

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import type { Browser, Page } from 'puppeteer';

// Configure plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// Import AmadeusFlightOffer interface for compatibility
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

// Interface for raw scraped flight data from Kayak
interface KayakFlightData {
  id: string;
  price: {
    total: string;
    currency: string;
  };
  duration: {
    outbound: string;
    return?: string;
  };
  stops: {
    outbound: number;
    return?: number;
  };
  airlines: string[];
  airlineCodes: string[];
  departure: {
    time: string;
    airport: string;
    date: string;
  };
  arrival: {
    time: string;
    airport: string;
    date: string;
  };
  returnDeparture?: {
    time: string;
    airport: string;
    date: string;
  };
  returnArrival?: {
    time: string;
    airport: string;
    date: string;
  };
  flightNumbers: string[];
  aircraft?: string[];
  cabin?: string;
  provider: string;
  bookingUrl?: string;
}

// Kayak search sorting options
type KayakSortType = 'price_a' | 'duration_a' | 'bestflight_a';

// Airline IATA code mapping for common carriers
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
  'air canada': 'AC',
  'lufthansa': 'LH',
  'british airways': 'BA',
  'virgin atlantic': 'VS',
  'klm': 'KL',
  'air france': 'AF',
  'emirates': 'EK',
  'qatar': 'QR',
  'turkish': 'TK',
  'cathay pacific': 'CX',
  'singapore airlines': 'SQ',
  'japan airlines': 'JL',
  'ana': 'NH',
  'korean air': 'KE',
  'swiss': 'LX',
  'austrian': 'OS',
  'scandinavian': 'SK',
  'tap air portugal': 'TP',
  'iberia': 'IB',
  'alitalia': 'AZ',
  'aeroflot': 'SU',
  'el al': 'LY',
  'thai airways': 'TG',
  'malaysia airlines': 'MH',
  'philippine airlines': 'PR',
  'cebu pacific': '5J',
  'airasia': 'AK',
  'vietnam airlines': 'VN',
  'china airlines': 'CI',
  'eva air': 'BR',
  'china eastern': 'MU',
  'china southern': 'CZ',
  'air china': 'CA',
  'hainan airlines': 'HU',
  'xiamen air': 'MF',
  'jetstar': 'JQ',
  'virgin australia': 'VA',
  'qantas': 'QF',
  'air new zealand': 'NZ',
  'latam': 'LA',
  'avianca': 'AV',
  'copa airlines': 'CM',
  'volaris': 'Y4',
  'interjet': '4O',
  'aeromexico': 'AM',
  'westjet': 'WS',
  'porter airlines': 'PD',
  'flair airlines': 'F8',
  'swoop': 'WO',
  'air transat': 'TS',
  'neos': 'NO',
  'condor': 'DE',
  'eurowings': 'EW',
  'wizz air': 'W6',
  'ryanair': 'FR',
  'easyjet': 'U2',
  'vueling': 'VY',
  'norwegian': 'DY',
  'finnair': 'AY',
  'icelandair': 'FI',
  'wow air': 'WW',
  'sun country': 'SY',
  'breeze': 'MX'
};

// Airport code mapping for major airports
const AIRPORT_NAME_TO_IATA: { [key: string]: string } = {
  // US Major Airports
  'john f. kennedy international': 'JFK',
  'kennedy': 'JFK',
  'jfk': 'JFK',
  'laguardia': 'LGA',
  'newark': 'EWR',
  'los angeles international': 'LAX',
  'lax': 'LAX',
  'chicago ohare': 'ORD',
  'ohare': 'ORD',
  'ord': 'ORD',
  'chicago midway': 'MDW',
  'midway': 'MDW',
  'denver international': 'DEN',
  'denver': 'DEN',
  'den': 'DEN',
  'dallas fort worth': 'DFW',
  'dfw': 'DFW',
  'dallas love field': 'DAL',
  'love field': 'DAL',
  'phoenix sky harbor': 'PHX',
  'phoenix': 'PHX',
  'phx': 'PHX',
  'miami international': 'MIA',
  'miami': 'MIA',
  'mia': 'MIA',
  'fort lauderdale': 'FLL',
  'fll': 'FLL',
  'orlando': 'MCO',
  'mco': 'MCO',
  'atlanta hartsfield': 'ATL',
  'atlanta': 'ATL',
  'atl': 'ATL',
  'boston logan': 'BOS',
  'boston': 'BOS',
  'bos': 'BOS',
  'washington dulles': 'IAD',
  'dulles': 'IAD',
  'iad': 'IAD',
  'ronald reagan': 'DCA',
  'reagan': 'DCA',
  'dca': 'DCA',
  'baltimore washington': 'BWI',
  'bwi': 'BWI',
  'philadelphia': 'PHL',
  'phl': 'PHL',
  'detroit': 'DTW',
  'dtw': 'DTW',
  'minneapolis': 'MSP',
  'msp': 'MSP',
  'houston intercontinental': 'IAH',
  'houston bush': 'IAH',
  'iah': 'IAH',
  'houston hobby': 'HOU',
  'hobby': 'HOU',
  'hou': 'HOU',
  'seattle tacoma': 'SEA',
  'seattle': 'SEA',
  'sea': 'SEA',
  'portland': 'PDX',
  'pdx': 'PDX',
  'san francisco': 'SFO',
  'sfo': 'SFO',
  'oakland': 'OAK',
  'oak': 'OAK',
  'san jose': 'SJC',
  'sjc': 'SJC',
  'san diego': 'SAN',
  'san': 'SAN',
  'las vegas': 'LAS',
  'vegas': 'LAS',
  'las': 'LAS',
  'salt lake city': 'SLC',
  'slc': 'SLC',
  'anchorage': 'ANC',
  'anc': 'ANC',
  'honolulu': 'HNL',
  'hnl': 'HNL',
  
  // International Major Airports
  'london heathrow': 'LHR',
  'heathrow': 'LHR',
  'lhr': 'LHR',
  'london gatwick': 'LGW',
  'gatwick': 'LGW',
  'lgw': 'LGW',
  'london stansted': 'STN',
  'stansted': 'STN',
  'stn': 'STN',
  'london luton': 'LTN',
  'luton': 'LTN',
  'ltn': 'LTN',
  'paris charles de gaulle': 'CDG',
  'charles de gaulle': 'CDG',
  'cdg': 'CDG',
  'paris orly': 'ORY',
  'orly': 'ORY',
  'ory': 'ORY',
  'frankfurt': 'FRA',
  'fra': 'FRA',
  'amsterdam schiphol': 'AMS',
  'schiphol': 'AMS',
  'ams': 'AMS',
  'madrid barajas': 'MAD',
  'madrid': 'MAD',
  'mad': 'MAD',
  'barcelona': 'BCN',
  'bcn': 'BCN',
  'rome fiumicino': 'FCO',
  'fiumicino': 'FCO',
  'fco': 'FCO',
  'milan malpensa': 'MXP',
  'malpensa': 'MXP',
  'mxp': 'MXP',
  'zurich': 'ZUR',
  'zur': 'ZUR',
  'vienna': 'VIE',
  'vie': 'VIE',
  'copenhagen': 'CPH',
  'cph': 'CPH',
  'stockholm arlanda': 'ARN',
  'arlanda': 'ARN',
  'arn': 'ARN',
  'oslo': 'OSL',
  'osl': 'OSL',
  'helsinki': 'HEL',
  'hel': 'HEL',
  'reykjavik': 'KEF',
  'kef': 'KEF',
  'dublin': 'DUB',
  'dub': 'DUB',
  'toronto pearson': 'YYZ',
  'toronto': 'YYZ',
  'yyz': 'YYZ',
  'vancouver': 'YVR',
  'yvr': 'YVR',
  'montreal': 'YUL',
  'yul': 'YUL',
  'tokyo narita': 'NRT',
  'narita': 'NRT',
  'nrt': 'NRT',
  'tokyo haneda': 'HND',
  'haneda': 'HND',
  'hnd': 'HND',
  'osaka kansai': 'KIX',
  'kansai': 'KIX',
  'kix': 'KIX',
  'seoul incheon': 'ICN',
  'incheon': 'ICN',
  'icn': 'ICN',
  'beijing capital': 'PEK',
  'beijing': 'PEK',
  'pek': 'PEK',
  'shanghai pudong': 'PVG',
  'pudong': 'PVG',
  'pvg': 'PVG',
  'hong kong': 'HKG',
  'hkg': 'HKG',
  'singapore changi': 'SIN',
  'changi': 'SIN',
  'sin': 'SIN',
  'bangkok suvarnabhumi': 'BKK',
  'suvarnabhumi': 'BKK',
  'bangkok': 'BKK',
  'bkk': 'BKK',
  'kuala lumpur': 'KUL',
  'kul': 'KUL',
  'jakarta soekarno hatta': 'CGK',
  'jakarta': 'CGK',
  'cgk': 'CGK',
  'manila': 'MNL',
  'mnl': 'MNL',
  'mumbai': 'BOM',
  'bom': 'BOM',
  'delhi': 'DEL',
  'del': 'DEL',
  'dubai': 'DXB',
  'dxb': 'DXB',
  'doha': 'DOH',
  'doh': 'DOH',
  'abu dhabi': 'AUH',
  'auh': 'AUH',
  'istanbul': 'IST',
  'ist': 'IST',
  'melbourne': 'MEL',
  'mel': 'MEL',
  'sydney': 'SYD',
  'syd': 'SYD',
  'brisbane': 'BNE',
  'bne': 'BNE',
  'perth': 'PER',
  'per': 'PER',
  'auckland': 'AKL',
  'akl': 'AKL'
};

// Helper functions
function getAirlineIataCode(airlineName: string): string {
  const cleanName = airlineName.toLowerCase().trim();
  return AIRLINE_NAME_TO_IATA[cleanName] || airlineName.substring(0, 2).toUpperCase();
}

function getAirportIataCode(airportName: string): string {
  const cleanName = airportName.toLowerCase().trim();
  return AIRPORT_NAME_TO_IATA[cleanName] || airportName.substring(0, 3).toUpperCase();
}

function parseDuration(durationText: string): string {
  // Convert "5h 30m" or "330 min" to "PT5H30M" (ISO 8601)
  const hourMatch = durationText.match(/(\d+)h/);
  const minMatch = durationText.match(/(\d+)m/);
  const totalMinMatch = durationText.match(/(\d+)\s*min/);
  
  let hours = 0;
  let minutes = 0;
  
  if (totalMinMatch) {
    const totalMin = parseInt(totalMinMatch[1]);
    hours = Math.floor(totalMin / 60);
    minutes = totalMin % 60;
  } else {
    hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    minutes = minMatch ? parseInt(minMatch[1]) : 0;
  }
  
  return `PT${hours}H${minutes}M`;
}

function parsePrice(priceText: string): { amount: string; currency: string } {
  // Extract price and currency from text like "$1,234", "€1.234", etc.
  const match = priceText.match(/([€$£¥])?([\d,\.]+)/);
  if (match) {
    const currencySymbol = match[1] || '$';
    const amount = match[2].replace(/,/g, '');
    
    const currencyMap: { [key: string]: string } = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY'
    };
    
    return {
      amount,
      currency: currencyMap[currencySymbol] || 'USD'
    };
  }
  
  return { amount: '0', currency: 'USD' };
}

function formatDateTime(date: string, time: string): string {
  // Convert to ISO 8601 format
  try {
    const dateTime = new Date(`${date} ${time}`);
    return dateTime.toISOString();
  } catch {
    // Fallback for parsing issues
    return new Date().toISOString();
  }
}

// Generate unique ID for flights
function generateFlightId(flightData: Partial<KayakFlightData>, sortType: string): string {
  const key = `${flightData.departure?.airport}-${flightData.arrival?.airport}-${flightData.departure?.time}-${flightData.price?.total}-${sortType}`;
  return Buffer.from(key).toString('base64').substring(0, 20);
}

// Build Kayak search URL
function buildKayakUrl(
  origin: string,
  destination: string,
  departureDate: string,
  passengers: number = 1,
  returnDate?: string,
  cabinClass: string = 'ECONOMY',
  sortBy: KayakSortType = 'price_a'
): string {
  const baseUrl = 'https://www.kayak.com/flights';
  
  // Format cabin class for Kayak
  const cabinMap: { [key: string]: string } = {
    'ECONOMY': 'e',
    'PREMIUM_ECONOMY': 'p',
    'BUSINESS': 'b',
    'FIRST': 'f'
  };
  
  const cabin = cabinMap[cabinClass] || 'e';
  const tripType = returnDate ? 'roundtrip' : 'oneway';
  
  // Format dates for Kayak (YYYY-MM-DD)
  const formattedDepartDate = departureDate;
  const formattedReturnDate = returnDate || '';
  
  let url = `${baseUrl}/${origin}-${destination}/${formattedDepartDate}`;
  if (returnDate) {
    url += `/${formattedReturnDate}`;
  }
  url += `?sort=${sortBy}&fs=stops=~0;stops=~1;stops=~2&passengers=${passengers}&cabin=${cabin}`;
  
  return url;
}

// Browser management
let browser: Browser | null = null;

async function initializeBrowser(): Promise<Browser> {
  if (browser && browser.connected) {
    return browser;
  }
  
  console.log('🚀 Kayak: Initializing Puppeteer browser with stealth mode...');
  
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1920,1080'
    ],
    defaultViewport: { width: 1920, height: 1080 },
    timeout: 30000,
  });
  
  console.log('✅ Kayak: Browser initialized successfully');
  return browser;
}

async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('🔒 Kayak: Browser closed');
  }
}

// Scrape flight results from a single Kayak page
async function scrapeKayakPage(url: string, sortType: KayakSortType, maxRetries: number = 3): Promise<KayakFlightData[]> {
  let page: Page | undefined;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`🔍 Kayak: Scraping page (attempt ${attempt}/${maxRetries}) - ${sortType}: ${url}`);
      
      const browserInstance = await initializeBrowser();
      page = await browserInstance.newPage();
      
      // Set realistic headers
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to the search results page
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      // Wait for flight results to load
      console.log('⏳ Kayak: Waiting for flight results to load...');
      await page.waitForSelector('[data-resultid]', { timeout: 30000 });
      
      // Allow additional time for all results to render
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract flight data
      const flights = await page.evaluate((sort) => {
        const flightElements = document.querySelectorAll('[data-resultid]');
        console.log(`Found ${flightElements.length} flight elements on page`);
        
        const results: any[] = [];
        
        flightElements.forEach((element, index) => {
          try {
            // Skip if this is not a flight result
            if (!element.querySelector('.price')) return;
            
            // Extract price
            const priceElement = element.querySelector('.price-text, .price');
            const priceText = priceElement?.textContent?.trim() || '$0';
            
            // Extract airline information
            const airlineElements = element.querySelectorAll('.segment-airline-name, .carrier-text, .airline-name, [data-test-id*="airline"]');
            const airlines: string[] = [];
            airlineElements.forEach(el => {
              const name = el.textContent?.trim();
              if (name) airlines.push(name);
            });
            
            // Extract flight numbers
            const flightNumbers: string[] = [];
            const flightNumElements = element.querySelectorAll('.flight-number, [data-test-id*="flight-number"], .segment-flight-number');
            flightNumElements.forEach(el => {
              const num = el.textContent?.trim();
              if (num && /\d+/.test(num)) flightNumbers.push(num);
            });
            
            // Extract departure info
            const depTimeElement = element.querySelector('.depart-time, .departure-time, [data-test-id*="departure-time"]');
            const depAirportElement = element.querySelector('.depart-airport, .departure-airport, [data-test-id*="departure-airport"]');
            const departureTime = depTimeElement?.textContent?.trim() || '';
            const departureAirport = depAirportElement?.textContent?.trim() || '';
            
            // Extract arrival info
            const arrTimeElement = element.querySelector('.arrive-time, .arrival-time, [data-test-id*="arrival-time"]');
            const arrAirportElement = element.querySelector('.arrive-airport, .arrival-airport, [data-test-id*="arrival-airport"]');
            const arrivalTime = arrTimeElement?.textContent?.trim() || '';
            const arrivalAirport = arrAirportElement?.textContent?.trim() || '';
            
            // Extract duration
            const durationElement = element.querySelector('.duration, .flight-duration, [data-test-id*="duration"]');
            const duration = durationElement?.textContent?.trim() || '';
            
            // Extract stops
            const stopsElement = element.querySelector('.stops, .segment-stops, [data-test-id*="stops"]');
            const stopsText = stopsElement?.textContent?.trim() || '';
            let stops = 0;
            if (stopsText.includes('nonstop') || stopsText.includes('direct')) {
              stops = 0;
            } else if (stopsText.includes('1 stop')) {
              stops = 1;
            } else if (stopsText.includes('2 stop')) {
              stops = 2;
            } else if (stopsText.match(/\d+\s*stop/)) {
              const match = stopsText.match(/(\d+)\s*stop/);
              stops = match ? parseInt(match[1]) : 0;
            }
            
            // Extract aircraft type if available
            const aircraftElements = element.querySelectorAll('.aircraft-type, .plane-type, [data-test-id*="aircraft"]');
            const aircraft: string[] = [];
            aircraftElements.forEach(el => {
              const type = el.textContent?.trim();
              if (type) aircraft.push(type);
            });
            
            // Skip if essential data is missing
            if (!priceText || !departureTime || !arrivalTime) {
              console.log(`Skipping flight ${index} due to missing essential data`);
              return;
            }
            
            const result = {
              id: `kayak_${sort}_${index}`,
              price: {
                total: priceText,
                currency: 'USD' // Will be parsed properly later
              },
              duration: {
                outbound: duration
              },
              stops: {
                outbound: stops
              },
              airlines: airlines,
              airlineCodes: airlines, // Will be mapped later
              departure: {
                time: departureTime,
                airport: departureAirport,
                date: '' // Will be filled from search params
              },
              arrival: {
                time: arrivalTime,
                airport: arrivalAirport,
                date: '' // Will be filled from search params  
              },
              flightNumbers: flightNumbers,
              aircraft: aircraft.length > 0 ? aircraft : undefined,
              provider: 'Kayak',
              cabin: 'Economy' // Default, could be enhanced
            };
            
            results.push(result);
            console.log(`Extracted flight ${index}:`, { price: priceText, airline: airlines[0], departure: departureTime, arrival: arrivalTime });
            
          } catch (error) {
            console.log(`Error extracting flight ${index}:`, error);
          }
        });
        
        return results;
      }, sortType);
      
      console.log(`✅ Kayak: Successfully extracted ${flights.length} flights from ${sortType} page`);
      
      await page.close();
      return flights;
      
    } catch (error) {
      console.error(`❌ Kayak: Error scraping page (attempt ${attempt}/${maxRetries}):`, error);
      
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.error('Error closing page:', closeError);
        }
      }
      
      if (attempt === maxRetries) {
        console.error(`❌ Kayak: Failed to scrape ${sortType} page after ${maxRetries} attempts`);
        return [];
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  return [];
}

// Transform scraped Kayak data to AmadeusFlightOffer format
function mapKayakDataToAmadeus(
  kayakFlights: KayakFlightData[],
  searchParams: {
    origin: string;
    destination: string;
    departureDate: string;
    passengers: number;
    returnDate?: string;
    cabinClass: string;
  }
): AmadeusFlightOffer[] {
  return kayakFlights.map((flight, index) => {
    try {
      // Parse price
      const priceData = parsePrice(flight.price.total);
      const totalPrice = parseFloat(priceData.amount);
      const basePrice = totalPrice * 0.85; // Estimate base price (85% of total)
      const taxAmount = totalPrice - basePrice;
      
      // Map airline names to IATA codes
      const airlineCodes = flight.airlines.map(airline => getAirlineIataCode(airline));
      const primaryAirline = airlineCodes[0] || 'XX';
      
      // Parse duration
      const duration = parseDuration(flight.duration.outbound);
      
      // Format departure and arrival times
      const departureDateTime = formatDateTime(searchParams.departureDate, flight.departure.time);
      const arrivalDateTime = formatDateTime(searchParams.departureDate, flight.arrival.time);
      
      // Map airport names to IATA codes if needed
      const originCode = getAirportIataCode(flight.departure.airport) || searchParams.origin;
      const destinationCode = getAirportIataCode(flight.arrival.airport) || searchParams.destination;
      
      // Create segments
      const segments = [{
        departure: {
          iataCode: originCode,
          at: departureDateTime,
        },
        arrival: {
          iataCode: destinationCode,
          at: arrivalDateTime,
        },
        carrierCode: primaryAirline,
        number: flight.flightNumbers[0] || '1234',
        aircraft: {
          code: flight.aircraft?.[0]?.substring(0, 3) || 'XXX',
        },
        duration: duration,
        id: `0`,
        numberOfStops: flight.stops.outbound,
      }];
      
      // Create itineraries
      const itineraries = [{
        duration: duration,
        segments: segments,
      }];
      
      // Create traveler pricings
      const travelerPricings = Array.from({ length: searchParams.passengers }, (_, i) => ({
        travelerId: `passenger_${i + 1}`,
        fareOption: 'STANDARD',
        travelerType: 'ADULT',
        price: {
          currency: priceData.currency,
          total: (totalPrice / searchParams.passengers).toFixed(2),
          base: (basePrice / searchParams.passengers).toFixed(2),
        },
        fareDetailsBySegment: segments.map(segment => ({
          segmentId: segment.id,
          cabin: searchParams.cabinClass,
          fareBasis: 'KAYAK',
          class: searchParams.cabinClass.charAt(0),
          includedCheckedBags: {
            quantity: 0, // Default, could be enhanced
          },
        })),
      }));
      
      return {
        id: generateFlightId(flight, 'kayak'),
        source: 'KAYAK',
        instantTicketingRequired: false,
        lastTicketingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        numberOfBookableSeats: 9, // Default
        itineraries: itineraries,
        price: {
          currency: priceData.currency,
          total: totalPrice.toFixed(2),
          base: basePrice.toFixed(2),
          fees: [{
            amount: taxAmount.toFixed(2),
            type: 'TAXES',
          }],
          grandTotal: totalPrice.toFixed(2),
        },
        pricingOptions: {
          fareType: ['PUBLISHED'],
          includedCheckedBagsOnly: false,
        },
        validatingAirlineCodes: [primaryAirline],
        travelerPricings: travelerPricings,
      };
    } catch (error) {
      console.error(`❌ Kayak: Error transforming flight ${index}:`, error);
      
      // Return a minimal valid flight offer in case of errors
      return {
        id: `kayak_error_${index}`,
        source: 'KAYAK',
        instantTicketingRequired: false,
        lastTicketingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        numberOfBookableSeats: 9,
        itineraries: [{
          duration: 'PT2H0M',
          segments: [{
            departure: {
              iataCode: searchParams.origin,
              at: new Date().toISOString(),
            },
            arrival: {
              iataCode: searchParams.destination,
              at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            },
            carrierCode: 'XX',
            number: '1234',
            aircraft: { code: 'XXX' },
            duration: 'PT2H0M',
            id: '0',
            numberOfStops: 0,
          }],
        }],
        price: {
          currency: 'USD',
          total: '299.00',
          base: '249.00',
          fees: [{ amount: '50.00', type: 'TAXES' }],
          grandTotal: '299.00',
        },
        pricingOptions: {
          fareType: ['PUBLISHED'],
          includedCheckedBagsOnly: false,
        },
        validatingAirlineCodes: ['XX'],
        travelerPricings: [{
          travelerId: 'passenger_1',
          fareOption: 'STANDARD',
          travelerType: 'ADULT',
          price: {
            currency: 'USD',
            total: '299.00',
            base: '249.00',
          },
          fareDetailsBySegment: [{
            segmentId: '0',
            cabin: searchParams.cabinClass,
            fareBasis: 'ERROR',
            class: searchParams.cabinClass.charAt(0),
            includedCheckedBags: { quantity: 0 },
          }],
        }],
      };
    }
  });
}

// Remove duplicate flights based on key characteristics
function removeDuplicates(flights: AmadeusFlightOffer[]): AmadeusFlightOffer[] {
  const seen = new Set<string>();
  const uniqueFlights: AmadeusFlightOffer[] = [];
  
  for (const flight of flights) {
    const key = `${flight.itineraries[0]?.segments[0]?.departure.iataCode}-${flight.itineraries[0]?.segments[0]?.arrival.iataCode}-${flight.itineraries[0]?.segments[0]?.departure.at}-${flight.price.total}-${flight.itineraries[0]?.segments[0]?.carrierCode}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFlights.push(flight);
    }
  }
  
  console.log(`🧹 Kayak: Removed ${flights.length - uniqueFlights.length} duplicate flights`);
  return uniqueFlights;
}

// Main function to search Kayak flights
export async function searchKayakFlights(
  origin: string,
  destination: string,
  departureDate: string,
  passengers: number = 1,
  returnDate?: string,
  cabinClass: string = 'ECONOMY',
  filter: 'best' | 'cheapest' | 'fastest' = 'best'
): Promise<AmadeusFlightOffer[]> {
  const startTime = Date.now();
  console.log(`🔍 Kayak: Starting flight search - ${origin} → ${destination} on ${departureDate}`);
  console.log(`🔍 Kayak: Passengers: ${passengers}, Class: ${cabinClass}${returnDate ? `, Return: ${returnDate}` : ''}`);
  
  // Map filter to Kayak sort parameter
  const sortParam: KayakSortType = filter === 'cheapest' ? 'price_a' : 
                                   filter === 'fastest' ? 'duration_a' : 
                                   'bestflight_a'; // default for 'best'
  
  console.log(`🎯 Kayak: Using filter '${filter}' with sort parameter '${sortParam}'`);
  
  try {
    const searchParams = {
      origin,
      destination,
      departureDate,
      passengers,
      returnDate,
      cabinClass,
    };
    
    // Only scrape the specific page for the requested filter
    const sortNames = {
      'price_a': 'Cheapest',
      'duration_a': 'Fastest', 
      'bestflight_a': 'Best'
    };
    
    console.log(`🔍 Kayak: Will scrape only the ${sortNames[sortParam]} page for filter '${filter}'`);
    
    // Build URL for the specific filter
    const url = buildKayakUrl(origin, destination, departureDate, passengers, returnDate, cabinClass, sortParam);
    console.log(`🌐 Kayak: ${sortNames[sortParam]} URL: ${url}`);
    
    // Scrape the specific page
    const allKayakFlights = await scrapeKayakPage(url, sortParam);
    console.log(`🔍 Kayak: Found ${allKayakFlights.length} flights for ${sortNames[sortParam]} filter`);
    
    if (allKayakFlights.length === 0) {
      console.log('❌ Kayak: No flights found from any search type');
      return [];
    }
    
    // Transform to Amadeus format
    const transformedFlights = mapKayakDataToAmadeus(allKayakFlights, searchParams);
    console.log(`🔄 Kayak: Transformed ${transformedFlights.length} flights to Amadeus format`);
    
    // Remove duplicates
    const uniqueFlights = removeDuplicates(transformedFlights);
    console.log(`✅ Kayak: Final result: ${uniqueFlights.length} unique flights`);
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Kayak: Search completed in ${elapsedTime}s`);
    
    return uniqueFlights;
    
  } catch (error) {
    console.error('❌ Kayak: Fatal error during flight search:', error);
    
    // Always try to close browser on error
    try {
      await closeBrowser();
    } catch (closeError) {
      console.error('Error closing browser after fatal error:', closeError);
    }
    
    return [];
  } finally {
    // Clean up browser resources after search
    try {
      await closeBrowser();
    } catch (closeError) {
      console.error('Error during browser cleanup:', closeError);
    }
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('🔄 Kayak: Received SIGTERM, closing browser...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Kayak: Received SIGINT, closing browser...');
  await closeBrowser();
  process.exit(0);
});