// Comprehensive location database for smart flight search
export interface LocationResult {
  type: 'airport' | 'city' | 'metro' | 'state' | 'country';
  name: string;
  code: string;
  displayName: string;
  country: string;
  state?: string;
  airports?: string[];
  coordinates?: { lat: number; lng: number };
}

// Major metropolitan areas with multiple airports
export const metroAreas = {
  'new york': {
    name: 'New York Metro Area',
    airports: ['JFK', 'LGA', 'EWR'],
    mainAirport: 'JFK',
    state: 'New York',
    country: 'United States'
  },
  'nyc': {
    name: 'New York Metro Area', 
    airports: ['JFK', 'LGA', 'EWR'],
    mainAirport: 'JFK',
    state: 'New York',
    country: 'United States'
  },
  'new york city': {
    name: 'New York Metro Area',
    airports: ['JFK', 'LGA', 'EWR'],
    mainAirport: 'JFK',
    state: 'New York',
    country: 'United States'
  },
  'los angeles': {
    name: 'Los Angeles Metro Area',
    airports: ['LAX', 'BUR', 'LGB', 'SNA'],
    mainAirport: 'LAX',
    state: 'California',
    country: 'United States'
  },
  'la': {
    name: 'Los Angeles Metro Area',
    airports: ['LAX', 'BUR', 'LGB', 'SNA'],
    mainAirport: 'LAX',
    state: 'California',
    country: 'United States'
  },
  'chicago': {
    name: 'Chicago Metro Area',
    airports: ['ORD', 'MDW'],
    mainAirport: 'ORD',
    state: 'Illinois',
    country: 'United States'
  },
  'washington': {
    name: 'Washington DC Metro Area',
    airports: ['DCA', 'IAD', 'BWI'],
    mainAirport: 'DCA',
    state: 'District of Columbia',
    country: 'United States'
  },
  'dc': {
    name: 'Washington DC Metro Area',
    airports: ['DCA', 'IAD', 'BWI'],
    mainAirport: 'DCA',
    state: 'District of Columbia',
    country: 'United States'
  },
  'washington dc': {
    name: 'Washington DC Metro Area',
    airports: ['DCA', 'IAD', 'BWI'],
    mainAirport: 'DCA',
    state: 'District of Columbia',
    country: 'United States'
  },
  'san francisco': {
    name: 'San Francisco Bay Area',
    airports: ['SFO', 'OAK', 'SJC'],
    mainAirport: 'SFO',
    state: 'California',
    country: 'United States'
  },
  'sf': {
    name: 'San Francisco Bay Area',
    airports: ['SFO', 'OAK', 'SJC'],
    mainAirport: 'SFO',
    state: 'California',
    country: 'United States'
  },
  'bay area': {
    name: 'San Francisco Bay Area',
    airports: ['SFO', 'OAK', 'SJC'],
    mainAirport: 'SFO',
    state: 'California',
    country: 'United States'
  },
  'houston': {
    name: 'Houston Metro Area',
    airports: ['IAH', 'HOU'],
    mainAirport: 'IAH',
    state: 'Texas',
    country: 'United States'
  },
  'dallas': {
    name: 'Dallas-Fort Worth Metro Area',
    airports: ['DFW', 'DAL'],
    mainAirport: 'DFW',
    state: 'Texas',
    country: 'United States'
  },
  'london': {
    name: 'London Metro Area',
    airports: ['LHR', 'LGW', 'STN', 'LTN'],
    mainAirport: 'LHR',
    state: 'England',
    country: 'United Kingdom'
  },
  'paris': {
    name: 'Paris Metro Area',
    airports: ['CDG', 'ORY'],
    mainAirport: 'CDG',
    state: 'Île-de-France',
    country: 'France'
  },
  'tokyo': {
    name: 'Tokyo Metro Area',
    airports: ['NRT', 'HND'],
    mainAirport: 'NRT',
    state: 'Tokyo',
    country: 'Japan'
  },
  'milan': {
    name: 'Milan Metro Area',
    airports: ['MXP', 'LIN', 'BGY'],
    mainAirport: 'MXP',
    state: 'Lombardy',
    country: 'Italy'
  },
  'berlin': {
    name: 'Berlin Metro Area',
    airports: ['BER', 'SXF', 'TXL'],
    mainAirport: 'BER',
    state: 'Berlin',
    country: 'Germany'
  },
  'stockholm': {
    name: 'Stockholm Metro Area',
    airports: ['ARN', 'BMA', 'NYO'],
    mainAirport: 'ARN',
    state: 'Stockholm',
    country: 'Sweden'
  }
};

// US States and their major airports
export const usStates = {
  'california': ['LAX', 'SFO', 'SAN', 'OAK', 'BUR', 'LGB', 'SJC'],
  'ca': ['LAX', 'SFO', 'SAN', 'OAK', 'BUR', 'LGB', 'SJC'],
  'new york': ['JFK', 'LGA', 'EWR', 'BUF', 'ROC', 'SYR', 'ALB'],
  'ny': ['JFK', 'LGA', 'EWR', 'BUF', 'ROC', 'SYR', 'ALB'],
  'florida': ['MIA', 'MCO', 'FLL', 'TPA', 'JAX', 'PBI', 'RSW'],
  'fl': ['MIA', 'MCO', 'FLL', 'TPA', 'JAX', 'PBI', 'RSW'],
  'texas': ['DFW', 'IAH', 'AUS', 'SAT', 'HOU', 'ELP', 'DAL'],
  'tx': ['DFW', 'IAH', 'AUS', 'SAT', 'HOU', 'ELP', 'DAL'],
  'georgia': ['ATL', 'SAV', 'AGS', 'CSG', 'VLD'],
  'ga': ['ATL', 'SAV', 'AGS', 'CSG', 'VLD'],
  'illinois': ['ORD', 'MDW', 'PIA', 'RFD', 'SPI'],
  'il': ['ORD', 'MDW', 'PIA', 'RFD', 'SPI'],
  'massachusetts': ['BOS', 'PVD', 'HYA', 'MVY', 'ACK'],
  'ma': ['BOS', 'PVD', 'HYA', 'MVY', 'ACK'],
  'washington': ['SEA', 'BFI', 'PAE', 'BLI', 'YKM'],
  'wa': ['SEA', 'BFI', 'PAE', 'BLI', 'YKM'],
  'colorado': ['DEN', 'COS', 'GJT', 'ASE', 'EGE'],
  'co': ['DEN', 'COS', 'GJT', 'ASE', 'EGE'],
  'arizona': ['PHX', 'TUS', 'FLG', 'YUM', 'GCN'],
  'az': ['PHX', 'TUS', 'FLG', 'YUM', 'GCN'],
  'nevada': ['LAS', 'RNO', 'ELY', 'VGT', 'TNX'],
  'nv': ['LAS', 'RNO', 'ELY', 'VGT', 'TNX'],
  'utah': ['SLC', 'SGU', 'CNY', 'PVU', 'OGD'],
  'ut': ['SLC', 'SGU', 'CNY', 'PVU', 'OGD'],
  'oregon': ['PDX', 'EUG', 'MFR', 'RDM', 'LMT'],
  'or': ['PDX', 'EUG', 'MFR', 'RDM', 'LMT'],
  'michigan': ['DTW', 'GRR', 'FNT', 'LAN', 'MKG'],
  'mi': ['DTW', 'GRR', 'FNT', 'LAN', 'MKG'],
  'north carolina': ['CLT', 'RDU', 'GSO', 'FAY', 'ILM'],
  'nc': ['CLT', 'RDU', 'GSO', 'FAY', 'ILM'],
  'virginia': ['DCA', 'IAD', 'ORF', 'RIC', 'ROA'],
  'va': ['DCA', 'IAD', 'ORF', 'RIC', 'ROA'],
  'pennsylvania': ['PHL', 'PIT', 'ABE', 'ERI', 'AVP'],
  'pa': ['PHL', 'PIT', 'ABE', 'ERI', 'AVP'],
  'ohio': ['CLE', 'CMH', 'CVG', 'DAY', 'TOL'],
  'oh': ['CLE', 'CMH', 'CVG', 'DAY', 'TOL'],
  'minnesota': ['MSP', 'DLH', 'RST', 'STC', 'BJI'],
  'mn': ['MSP', 'DLH', 'RST', 'STC', 'BJI'],
  'wisconsin': ['MKE', 'MSN', 'GRB', 'CWA', 'EAU'],
  'wi': ['MKE', 'MSN', 'GRB', 'CWA', 'EAU'],
  'tennessee': ['BNA', 'MEM', 'TYS', 'CHA', 'TRI'],
  'tn': ['BNA', 'MEM', 'TYS', 'CHA', 'TRI'],
  'missouri': ['STL', 'MCI', 'SGF', 'COU', 'JLN'],
  'mo': ['STL', 'MCI', 'SGF', 'COU', 'JLN'],
  'louisiana': ['MSY', 'BTR', 'SHV', 'LFT', 'MLU'],
  'la': ['MSY', 'BTR', 'SHV', 'LFT', 'MLU'],
  'alabama': ['BHM', 'HSV', 'MOB', 'MGM', 'DHN'],
  'al': ['BHM', 'HSV', 'MOB', 'MGM', 'DHN'],
  'south carolina': ['CHS', 'CAE', 'GSP', 'FLO', 'MYR'],
  'sc': ['CHS', 'CAE', 'GSP', 'FLO', 'MYR'],
  'kentucky': ['SDF', 'LEX', 'CVG', 'PAH', 'OWB'],
  'ky': ['SDF', 'LEX', 'CVG', 'PAH', 'OWB'],
  'indiana': ['IND', 'FWA', 'SBN', 'EVV', 'HUF'],
  'in': ['IND', 'FWA', 'SBN', 'EVV', 'HUF'],
  'maryland': ['BWI', 'DCA', 'IAD', 'SBY', 'HGR'],
  'md': ['BWI', 'DCA', 'IAD', 'SBY', 'HGR'],
  'connecticut': ['BDL', 'HVN', 'GON', 'DXR', 'MMK'],
  'ct': ['BDL', 'HVN', 'GON', 'DXR', 'MMK'],
  'maine': ['PWM', 'BGR', 'AUG', 'RKD', 'PQI'],
  'me': ['PWM', 'BGR', 'AUG', 'RKD', 'PQI'],
  'new hampshire': ['MHT', 'PSM', 'LEB', 'CON', 'EEN'],
  'nh': ['MHT', 'PSM', 'LEB', 'CON', 'EEN'],
  'vermont': ['BTV', 'RUT', 'MVL', 'MPV', 'VSF'],
  'vt': ['BTV', 'RUT', 'MVL', 'MPV', 'VSF'],
  'rhode island': ['PVD', 'WST', 'NPT', 'BID', 'OQU'],
  'ri': ['PVD', 'WST', 'NPT', 'BID', 'OQU'],
  'alaska': ['ANC', 'FAI', 'JNU', 'KTN', 'SIT'],
  'ak': ['ANC', 'FAI', 'JNU', 'KTN', 'SIT'],
  'hawaii': ['HNL', 'OGG', 'KOA', 'ITO', 'LIH'],
  'hi': ['HNL', 'OGG', 'KOA', 'ITO', 'LIH'],
};

// Countries and their major airports
export const countries = {
  'united states': ['JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'SFO', 'SEA', 'LAS', 'BOS', 'MIA'],
  'usa': ['JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'SFO', 'SEA', 'LAS', 'BOS', 'MIA'],
  'us': ['JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'SFO', 'SEA', 'LAS', 'BOS', 'MIA'],
  'united kingdom': ['LHR', 'LGW', 'STN', 'LTN', 'MAN', 'EDI', 'BHX', 'GLA'],
  'uk': ['LHR', 'LGW', 'STN', 'LTN', 'MAN', 'EDI', 'BHX', 'GLA'],
  'england': ['LHR', 'LGW', 'STN', 'LTN', 'MAN', 'BHX', 'LPL', 'NCL'],
  'france': ['CDG', 'ORY', 'NCE', 'LYS', 'MRS', 'TLS', 'BOD', 'NTE'],
  'germany': ['FRA', 'MUC', 'BER', 'DUS', 'HAM', 'STR', 'CGN', 'LEJ'],
  'italy': ['FCO', 'MXP', 'VCE', 'NAP', 'FLR', 'BLQ', 'CTA', 'BRI'],
  'spain': ['MAD', 'BCN', 'PMI', 'LPA', 'AGP', 'VLC', 'SVQ', 'BIO'],
  'netherlands': ['AMS', 'RTM', 'EIN', 'GRQ', 'MST', 'ENS'],
  'belgium': ['BRU', 'ANR', 'LGG', 'OST', 'CRL'],
  'austria': ['VIE', 'SZG', 'INN', 'GRZ', 'LNZ'],
  'switzerland': ['ZUR', 'GVA', 'BSL', 'BRN', 'SIR'],
  'portugal': ['LIS', 'OPO', 'FAO', 'FNC', 'PDL'],
  'greece': ['ATH', 'SKG', 'HER', 'RHO', 'CFU'],
  'turkey': ['IST', 'SAW', 'ESB', 'ADB', 'AYT'],
  'poland': ['WAW', 'KRK', 'GDN', 'KTW', 'WRO'],
  'czech republic': ['PRG', 'BRQ', 'OSR', 'PED', 'UHE'],
  'hungary': ['BUD', 'DEB', 'SOB', 'PEV', 'MCQ'],
  'croatia': ['ZAG', 'SPU', 'DBV', 'PUY', 'RJK'],
  'sweden': ['ARN', 'GOT', 'MMX', 'BMA', 'UME'],
  'norway': ['OSL', 'BGO', 'TRD', 'SVG', 'BOO'],
  'denmark': ['CPH', 'BLL', 'AAL', 'EBJ', 'RON'],
  'finland': ['HEL', 'OUL', 'TMP', 'TKU', 'JOE'],
  'canada': ['YYZ', 'YVR', 'YUL', 'YYC', 'YEG'],
  'japan': ['NRT', 'HND', 'KIX', 'ITM', 'CTS'],
  'china': ['PEK', 'PVG', 'CAN', 'SZX', 'XIY'],
  'australia': ['SYD', 'MEL', 'BNE', 'PER', 'ADL'],
  'brazil': ['GRU', 'GIG', 'BSB', 'CGH', 'REC'],
  'india': ['DEL', 'BOM', 'BLR', 'MAA', 'HYD'],
  'russia': ['SVO', 'DME', 'VKO', 'LED', 'KZN'],
  'mexico': ['MEX', 'CUN', 'GDL', 'PVR', 'SJD'],
  'south korea': ['ICN', 'GMP', 'PUS', 'CJU', 'TAE'],
  'thailand': ['BKK', 'DMK', 'HKT', 'CNX', 'HDY'],
  'singapore': ['SIN', 'XSP', 'QPG', 'QRA', 'QPR'],
  'malaysia': ['KUL', 'PEN', 'JHB', 'KCH', 'MYY'],
  'indonesia': ['CGK', 'DPS', 'SUB', 'MLG', 'PLM'],
  'philippines': ['MNL', 'CEB', 'DVO', 'CRK', 'ILO'],
  'vietnam': ['SGN', 'HAN', 'DAD', 'UIH', 'VCA'],
  'south africa': ['JNB', 'CPT', 'DUR', 'PLZ', 'ELS'],
  'egypt': ['CAI', 'HRG', 'SSH', 'ASW', 'LXR'],
  'uae': ['DXB', 'AUH', 'SHJ', 'RKT', 'DWC'],
  'israel': ['TLV', 'SDV', 'VDA', 'ETH', 'EIY'],
  'argentina': ['EZE', 'AEP', 'COR', 'MDZ', 'IGR'],
  'chile': ['SCL', 'IQQ', 'CCP', 'LSC', 'PMC'],
  'colombia': ['BOG', 'MDE', 'CTG', 'CLO', 'BAQ'],
  'peru': ['LIM', 'CUZ', 'AQP', 'TRU', 'PIU'],
  'new zealand': ['AKL', 'CHC', 'WLG', 'ZQN', 'DUD'],
};

// Airport information database
export const airportInfo = {
  // Major US airports
  'ATL': { name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', state: 'Georgia', country: 'United States' },
  'LAX': { name: 'Los Angeles International', city: 'Los Angeles', state: 'California', country: 'United States' },
  'ORD': { name: 'O\'Hare International', city: 'Chicago', state: 'Illinois', country: 'United States' },
  'DFW': { name: 'Dallas/Fort Worth International', city: 'Dallas', state: 'Texas', country: 'United States' },
  'JFK': { name: 'John F. Kennedy International', city: 'New York', state: 'New York', country: 'United States' },
  'SFO': { name: 'San Francisco International', city: 'San Francisco', state: 'California', country: 'United States' },
  'SEA': { name: 'Seattle-Tacoma International', city: 'Seattle', state: 'Washington', country: 'United States' },
  'LAS': { name: 'McCarran International', city: 'Las Vegas', state: 'Nevada', country: 'United States' },
  'BOS': { name: 'Logan International', city: 'Boston', state: 'Massachusetts', country: 'United States' },
  'MIA': { name: 'Miami International', city: 'Miami', state: 'Florida', country: 'United States' },
  'MCO': { name: 'Orlando International', city: 'Orlando', state: 'Florida', country: 'United States' },
  'PHX': { name: 'Sky Harbor International', city: 'Phoenix', state: 'Arizona', country: 'United States' },
  'IAH': { name: 'George Bush Intercontinental', city: 'Houston', state: 'Texas', country: 'United States' },
  'DEN': { name: 'Denver International', city: 'Denver', state: 'Colorado', country: 'United States' },
  'CLT': { name: 'Charlotte Douglas International', city: 'Charlotte', state: 'North Carolina', country: 'United States' },
  'MSP': { name: 'Minneapolis-St. Paul International', city: 'Minneapolis', state: 'Minnesota', country: 'United States' },
  'DTW': { name: 'Detroit Metropolitan Wayne County', city: 'Detroit', state: 'Michigan', country: 'United States' },
  'PHL': { name: 'Philadelphia International', city: 'Philadelphia', state: 'Pennsylvania', country: 'United States' },
  'LGA': { name: 'LaGuardia Airport', city: 'New York', state: 'New York', country: 'United States' },
  'EWR': { name: 'Newark Liberty International', city: 'Newark', state: 'New Jersey', country: 'United States' },
  'BWI': { name: 'Baltimore/Washington International', city: 'Baltimore', state: 'Maryland', country: 'United States' },
  'DCA': { name: 'Ronald Reagan Washington National', city: 'Washington', state: 'District of Columbia', country: 'United States' },
  'IAD': { name: 'Washington Dulles International', city: 'Washington', state: 'Virginia', country: 'United States' },
  'SAN': { name: 'San Diego International', city: 'San Diego', state: 'California', country: 'United States' },
  'TPA': { name: 'Tampa International', city: 'Tampa', state: 'Florida', country: 'United States' },
  'PDX': { name: 'Portland International', city: 'Portland', state: 'Oregon', country: 'United States' },
  'STL': { name: 'Lambert-St. Louis International', city: 'St. Louis', state: 'Missouri', country: 'United States' },
  'HNL': { name: 'Honolulu International', city: 'Honolulu', state: 'Hawaii', country: 'United States' },
  
  // Major international airports
  'LHR': { name: 'Heathrow Airport', city: 'London', country: 'United Kingdom' },
  'CDG': { name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
  'FRA': { name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
  'AMS': { name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands' },
  'MAD': { name: 'Madrid-Barajas Airport', city: 'Madrid', country: 'Spain' },
  'FCO': { name: 'Leonardo da Vinci International', city: 'Rome', country: 'Italy' },
  'MUC': { name: 'Munich Airport', city: 'Munich', country: 'Germany' },
  'ZUR': { name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland' },
  'VIE': { name: 'Vienna International Airport', city: 'Vienna', country: 'Austria' },
  'ARN': { name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden' },
  'CPH': { name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark' },
  'OSL': { name: 'Oslo Airport', city: 'Oslo', country: 'Norway' },
  'HEL': { name: 'Helsinki Airport', city: 'Helsinki', country: 'Finland' },
  'IST': { name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey' },
  'SVO': { name: 'Sheremetyevo International', city: 'Moscow', country: 'Russia' },
  'NRT': { name: 'Narita International', city: 'Tokyo', country: 'Japan' },
  'HND': { name: 'Haneda Airport', city: 'Tokyo', country: 'Japan' },
  'ICN': { name: 'Incheon International', city: 'Seoul', country: 'South Korea' },
  'PEK': { name: 'Beijing Capital International', city: 'Beijing', country: 'China' },
  'PVG': { name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China' },
  'HKG': { name: 'Hong Kong International', city: 'Hong Kong', country: 'China' },
  'SIN': { name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
  'BKK': { name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand' },
  'KUL': { name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia' },
  'CGK': { name: 'Soekarno-Hatta International', city: 'Jakarta', country: 'Indonesia' },
  'DEL': { name: 'Indira Gandhi International', city: 'Delhi', country: 'India' },
  'BOM': { name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'India' },
  'DXB': { name: 'Dubai International', city: 'Dubai', country: 'UAE' },
  'DOH': { name: 'Hamad International', city: 'Doha', country: 'Qatar' },
  'SYD': { name: 'Kingsford Smith Airport', city: 'Sydney', country: 'Australia' },
  'MEL': { name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia' },
  'YYZ': { name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada' },
  'YVR': { name: 'Vancouver International', city: 'Vancouver', country: 'Canada' },
  'GRU': { name: 'São Paulo-Guarulhos International', city: 'São Paulo', country: 'Brazil' },
  'EZE': { name: 'Ezeiza International', city: 'Buenos Aires', country: 'Argentina' },
  'MEX': { name: 'Mexico City International', city: 'Mexico City', country: 'Mexico' },
  'ZAG': { name: 'Zagreb Airport', city: 'Zagreb', country: 'Croatia' },
  'SPU': { name: 'Split Airport', city: 'Split', country: 'Croatia' },
  'DBV': { name: 'Dubrovnik Airport', city: 'Dubrovnik', country: 'Croatia' },
  'JNB': { name: 'OR Tambo International', city: 'Johannesburg', country: 'South Africa' },
  'CPT': { name: 'Cape Town International', city: 'Cape Town', country: 'South Africa' },
  'CAI': { name: 'Cairo International', city: 'Cairo', country: 'Egypt' },
  'TLV': { name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel' },
};

// Smart location search function - completely flexible
export function searchLocations(query: string): LocationResult[] {
  const results: LocationResult[] = [];
  const searchTerm = query.toLowerCase().trim();
  
  if (!searchTerm || searchTerm.length < 2) return results;
  
  // Helper function to calculate similarity between strings
  function calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length);
  }
  
  // Levenshtein distance for fuzzy matching
  function levenshteinDistance(str1: string, str2: string): number {
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
  
  // Split search for comma-separated queries
  const searchParts = searchTerm.split(',').map(part => part.trim());
  const cityPart = searchParts[0];
  const locationPart = searchParts[1]; // Could be state, country, or region
  
  // Normalize common abbreviations and variations
  const normalizeLocation = (text: string): string[] => {
    const variations = [text];
    
    // State abbreviations
    const stateAbbreviations: Record<string, string> = {
      'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas', 'ca': 'california',
      'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware', 'fl': 'florida', 'ga': 'georgia',
      'hi': 'hawaii', 'id': 'idaho', 'il': 'illinois', 'in': 'indiana', 'ia': 'iowa',
      'ks': 'kansas', 'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
      'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi', 'mo': 'missouri',
      'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada', 'nh': 'new hampshire', 'nj': 'new jersey',
      'nm': 'new mexico', 'ny': 'new york', 'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio',
      'ok': 'oklahoma', 'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
      'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah', 'vt': 'vermont',
      'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia', 'wi': 'wisconsin', 'wy': 'wyoming'
    };
    
    // Add abbreviation expansion
    if (stateAbbreviations[text]) {
      variations.push(stateAbbreviations[text]);
    }
    
    // Add partial matching for states
    const partialStates: Record<string, string> = {
      'north': 'north carolina', 'north c': 'north carolina', 'north ca': 'north carolina',
      'south': 'south carolina', 'south c': 'south carolina', 'south ca': 'south carolina',
      'new': 'new york', 'west': 'west virginia'
    };
    
    if (partialStates[text]) {
      variations.push(partialStates[text]);
    }
    
    return variations;
  };
  
  // PRIORITY 1: Exact match for airport codes
  const upperQuery = query.toUpperCase().replace(/[^A-Z]/g, '');
  if (upperQuery.length === 3 && airportInfo[upperQuery]) {
    const airport = airportInfo[upperQuery];
    results.push({
      type: 'airport',
      name: airport.name,
      code: upperQuery,
      displayName: `${airport.name} (${upperQuery})`,
      country: airport.country,
      state: airport.state,
    });
  }
  
  // PRIORITY 2: Metro areas with fuzzy matching
  for (const [key, metro] of Object.entries(metroAreas)) {
    const similarity = calculateSimilarity(searchTerm, key);
    if (similarity > 0.6 || key.includes(cityPart) || searchTerm.includes(key)) {
      if (!results.find(r => r.name === metro.name)) {
        results.push({
          type: 'metro',
          name: metro.name,
          code: metro.mainAirport,
          displayName: `${metro.name} (${metro.airports.join(', ')})`,
          country: metro.country,
          state: metro.state,
          airports: metro.airports,
        });
      }
    }
  }
  
  // PRIORITY 3: Comprehensive airport/city search with flexible matching
  for (const [code, info] of Object.entries(airportInfo)) {
    let shouldInclude = false;
    
    // City name matching with fuzzy logic
    const cityLower = info.city.toLowerCase();
    const cityWords = cityLower.split(' ');
    
    // Check various matching criteria
    const criteriaChecks = [
      // Exact contains
      cityLower.includes(cityPart),
      // Word starts with search term
      cityWords.some(word => word.startsWith(cityPart)),
      // Fuzzy similarity
      calculateSimilarity(cityPart, cityLower) > 0.7,
      // Airport name contains search
      info.name.toLowerCase().includes(searchTerm),
      // Full search term in city
      cityLower.includes(searchTerm)
    ];
    
    shouldInclude = criteriaChecks.some(check => check);
    
    // Enhanced location matching for comma-separated searches
    if (shouldInclude && locationPart && (info.state || info.country)) {
      const locationVariations = normalizeLocation(locationPart);
      const stateMatch = info.state && locationVariations.some(variation => 
        info.state!.toLowerCase().includes(variation) || 
        variation.includes(info.state!.toLowerCase()) ||
        calculateSimilarity(variation, info.state!.toLowerCase()) > 0.6
      );
      const countryMatch = info.country && locationVariations.some(variation =>
        info.country.toLowerCase().includes(variation) ||
        variation.includes(info.country.toLowerCase()) ||
        calculateSimilarity(variation, info.country.toLowerCase()) > 0.6
      );
      
      shouldInclude = shouldInclude && (stateMatch || countryMatch);
    }
    
    if (shouldInclude && !results.find(r => r.code === code)) {
      results.push({
        type: 'city',
        name: info.city,
        code: code,
        displayName: `${info.city}, ${info.state || info.country} (${code})`,
        country: info.country,
        state: info.state,
      });
    }
  }
  
  // PRIORITY 4: State and country fallbacks with flexible matching
  for (const [stateName, airports] of Object.entries(usStates)) {
    if (searchTerm.includes(stateName) || stateName.includes(searchTerm) || 
        calculateSimilarity(searchTerm, stateName) > 0.7) {
      if (!results.find(r => r.name === stateName && r.type === 'state')) {
        results.push({
          type: 'state',
          name: stateName,
          code: stateName.toUpperCase().replace(/\s+/g, '_'),
          displayName: `${stateName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} (State)`,
          country: 'United States',
          airports: airports,
        });
      }
    }
  }
  
  for (const [countryName, airports] of Object.entries(countries)) {
    if (searchTerm.includes(countryName) || countryName.includes(searchTerm) ||
        calculateSimilarity(searchTerm, countryName) > 0.7) {
      if (!results.find(r => r.name === countryName && r.type === 'country')) {
        results.push({
          type: 'country',
          name: countryName,
          code: countryName.toUpperCase().replace(/\s+/g, '_'),
          displayName: `${countryName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} (Country)`,
          country: countryName,
          airports: airports,
        });
      }
    }
  }
  
  // Sort by relevance (exact matches first, then by similarity)
  return results
    .sort((a, b) => {
      const aExact = a.name.toLowerCase() === cityPart ? 1 : 0;
      const bExact = b.name.toLowerCase() === cityPart ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      
      const aSimilarity = calculateSimilarity(cityPart, a.name.toLowerCase());
      const bSimilarity = calculateSimilarity(cityPart, b.name.toLowerCase());
      return bSimilarity - aSimilarity;
    })
    .slice(0, 10);
}

// Get multiple airport codes from location search (supports metro areas)
export function getAirportCodes(location: string): string[] {
  // First try to extract airport code from parentheses like "Atlanta, Georgia (ATL)"
  const parenthesesMatch = location.match(/\(([A-Z]{3})\)/);
  if (parenthesesMatch) {
    console.log(`Extracted airport code from parentheses: ${parenthesesMatch[1]}`);
    return [parenthesesMatch[1]];
  }

  // Check for metro areas first
  const searchTerm = location.toLowerCase().trim();
  const metroArea = metroAreas[searchTerm];
  if (metroArea) {
    console.log(`Found metro area ${metroArea.name} with airports: ${metroArea.airports.join(', ')}`);
    return metroArea.airports;
  }

  // Fallback to single airport code
  const singleCode = getAirportFromLocation(location);
  return [singleCode];
}

// Get airport code from location search
export function getAirportFromLocation(location: string): string {
  // First try to extract airport code from parentheses like "Atlanta, Georgia (ATL)"
  const parenthesesMatch = location.match(/\(([A-Z]{3})\)/);
  if (parenthesesMatch) {
    console.log(`Extracted airport code from parentheses: ${parenthesesMatch[1]}`);
    return parenthesesMatch[1];
  }

  // COMPREHENSIVE DALLAS FIX: Handle before searchLocations
  if (location.toLowerCase().includes('dallas')) {
    console.log(`🛠️ COMPREHENSIVE FIX: Dallas detected in "${location}", returning DFW`);
    return 'DFW';
  }

  const results = searchLocations(location);
  console.log(`🐛 DEBUG: searchLocations for "${location}" returned:`, results);
  if (results.length > 0) {
    console.log(`🐛 DEBUG: First result:`, results[0]);
    // For states/countries, return the first (most major) airport
    if (results[0].airports && results[0].airports.length > 0) {
      console.log(`Found airports for ${location}: ${results[0].airports[0]}`);
      return results[0].airports[0];
    }
    if (results[0].code && results[0].code.length === 3) {
      console.log(`Found airport code for ${location}: ${results[0].code}`);
      return results[0].code;
    }
  }
  
  // Try simple city name lookup from pre-defined airport codes
  const simpleLocation = location.toLowerCase()
    .replace(/,.*/, '') // Remove everything after comma
    .replace(/\(.*\)/, '') // Remove everything in parentheses
    .trim();
    
  // HOTFIX: Handle Dallas specifically to avoid LA matching bug
  if (simpleLocation === 'dallas') {
    console.log(`🛠️ HOTFIX: Dallas detected, returning DFW`);
    return 'DFW';
  }
  
  const airportMappings: { [key: string]: string } = {
    // Major US Airports
    'atlanta': 'ATL',
    'charlotte': 'CLT',
    'new york': 'JFK',
    'los angeles': 'LAX',
    'chicago': 'ORD',
    'miami': 'MIA',
    'san francisco': 'SFO',
    'las vegas': 'LAS',
    'boston': 'BOS',
    'seattle': 'SEA',
    'denver': 'DEN',
    'phoenix': 'PHX',
    'dallas': 'DFW',
    'houston': 'IAH',
    'washington': 'DCA',
    'philadelphia': 'PHL',
    'orlando': 'MCO',
    'minneapolis': 'MSP',
    'detroit': 'DTW',
    'baltimore': 'BWI',
    'newark': 'EWR',
    'san diego': 'SAN',
    'tampa': 'TPA',
    'portland': 'PDX',
    'st. louis': 'STL',
    'saint louis': 'STL',
    'honolulu': 'HNL',
    'nashville': 'BNA',
    'austin': 'AUS',
    'memphis': 'MEM',
    'cleveland': 'CLE',
    'pittsburgh': 'PIT',
    'cincinnati': 'CVG',
    'kansas city': 'MCI',
    'indianapolis': 'IND',
    'milwaukee': 'MKE',
    'raleigh': 'RDU',
    'new orleans': 'MSY',
    'sacramento': 'SMF',
    'jacksonville': 'JAX',
    'richmond': 'RIC',
    'norfolk': 'ORF',
    'buffalo': 'BUF',
    'albany': 'ALB',
    'syracuse': 'SYR',
    'rochester': 'ROC',
    'charleston': 'CHS',
    'savannah': 'SAV',
    'birmingham': 'BHM',
    'huntsville': 'HSV',
    'mobile': 'MOB',
    'little rock': 'LIT',
    'tulsa': 'TUL',
    'oklahoma city': 'OKC',
    'salt lake city': 'SLC',
    'albuquerque': 'ABQ',
    'tucson': 'TUS',
    'fresno': 'FAT',
    'bakersfield': 'BFL',
    'reno': 'RNO',
    'boise': 'BOI',
    'spokane': 'GEG',
    'anchorage': 'ANC',
    'fairbanks': 'FAI',
    // International Major Cities
    'tokyo': 'NRT',
    'haneda': 'HND',
    'london': 'LHR',
    'paris': 'CDG',
    'rome': 'FCO',
    'barcelona': 'BCN',
    'madrid': 'MAD',
    'amsterdam': 'AMS',
    'berlin': 'BER',
    'munich': 'MUC',
    'frankfurt': 'FRA',
    'zurich': 'ZUR',
    'vienna': 'VIE',
    'dubai': 'DXB',
    'singapore': 'SIN',
    'hong kong': 'HKG',
    'beijing': 'PEK',
    'shanghai': 'PVG',
    'seoul': 'ICN',
    'bangkok': 'BKK',
    'kuala lumpur': 'KUL',
    'mumbai': 'BOM',
    'delhi': 'DEL',
    'sydney': 'SYD',
    'melbourne': 'MEL',
    'toronto': 'YYZ',
    'vancouver': 'YVR',
    'montreal': 'YUL',
    'mexico city': 'MEX',
    'cancun': 'CUN',
    'guatemala city': 'GUA',
    'san jose': 'SJO',
    'panama city': 'PTY',
    'lima': 'LIM',
    'bogota': 'BOG',
    'quito': 'UIO',
    'caracas': 'CCS',
    'sao paulo': 'GRU',
    'rio de janeiro': 'GIG',
    'buenos aires': 'EZE',
    'santiago': 'SCL',
    'johannesburg': 'JNB',
    'cape town': 'CPT',
    'cairo': 'CAI',
    'casablanca': 'CMN',
    'addis ababa': 'ADD',
    'nairobi': 'NBO',
    'lagos': 'LOS',
    'accra': 'ACC',
    'tel aviv': 'TLV',
    'istanbul': 'IST',
    'athens': 'ATH',
    'lisbon': 'LIS',
    'dublin': 'DUB',
    'copenhagen': 'CPH',
    'stockholm': 'ARN',
    'oslo': 'OSL',
    'helsinki': 'HEL',
    'reykjavik': 'KEF',
    'brussels': 'BRU',
    'geneva': 'GVA',
    'milan': 'MXP',
    'venice': 'VCE',
    'florence': 'FLR',
    'naples': 'NAP',
    'nice': 'NCE',
    'lyon': 'LYS',
    'marseille': 'MRS',
    'bordeaux': 'BOD',
    'toulouse': 'TLS',
    'manchester': 'MAN',
    'birmingham': 'BHX',
    'glasgow': 'GLA',
    'edinburgh': 'EDI'
  };
  
  // First try direct mapping
  let mappedCode = airportMappings[simpleLocation];
  if (mappedCode) {
    console.log(`Found mapped airport code for ${simpleLocation}: ${mappedCode}`);
    return mappedCode;
  }
  
  // Try to extract city name from full airport names
  for (const [city, code] of Object.entries(airportMappings)) {
    if (simpleLocation.includes(city)) {
      console.log(`Smart search found: ${code}`);
      return code;
    }
  }
  
  console.log(`No airport code found for "${location}", using fallback JFK`);
  return 'JFK'; // Ultimate fallback
}