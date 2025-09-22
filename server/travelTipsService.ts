// Comprehensive Travel Tips Service for VacationSync
// Generates personalized travel tips based on destination, activities, and user preferences

import memoize from "memoizee";
import { query } from "./db";
import { storage } from "./storage";
import {
  type TripCalendar,
  type Activity,
  type User,
  type TravelTip as DBTravelTip,
  type InsertTravelTip,
  type UserTipPreferences as DBUserTipPreferences,
  type InsertUserTipPreferences,
  type TravelTipWithDetails,
} from "@shared/schema";

type TripCalendarRow = {
  id: number;
  name: string;
  destination: string;
  start_date: Date;
  end_date: Date;
  share_code: string;
  created_by: string;
  created_at: Date | null;
};

const mapTripCalendar = (row: TripCalendarRow): TripCalendar => ({
  id: row.id,
  name: row.name,
  destination: row.destination,
  startDate: row.start_date,
  endDate: row.end_date,
  shareCode: row.share_code,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

type ActivityRow = {
  id: number;
  trip_calendar_id: number;
  posted_by: string;
  name: string;
  description: string | null;
  start_time: Date;
  end_time: Date | null;
  location: string | null;
  cost: string | null;
  max_capacity: number | null;
  category: string;
  created_at: Date | null;
  updated_at: Date | null;
};

const mapActivity = (row: ActivityRow): Activity => ({
  id: row.id,
  tripCalendarId: row.trip_calendar_id,
  postedBy: row.posted_by,
  name: row.name,
  description: row.description,
  startTime: row.start_time,
  endTime: row.end_time,
  location: row.location,
  cost: row.cost,
  maxCapacity: row.max_capacity,
  category: row.category,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Use database types directly
export type TravelTip = DBTravelTip;
export type TravelTipWithUser = TravelTipWithDetails;
export type UserTipPreferences = DBUserTipPreferences;

// Legacy interface for compatibility with existing code
export interface LegacyTravelTip {
  id: string;
  title: string;
  description: string;
  category: TipCategory;
  tags: string[];
  destinations: string[];
  activityTypes: string[];
  priority: number;
  seasonality?: string[];
  userPreferenceTypes: string[];
  isGeneral: boolean;
  source?: string;
  lastUpdated: Date;
}

// Bridge function to convert database tips to legacy format for backward compatibility
function convertToLegacyTip(dbTip: DBTravelTip): LegacyTravelTip {
  const tipData = JSON.parse(dbTip.content);
  return {
    id: dbTip.id.toString(),
    title: tipData.title || '',
    description: tipData.description || dbTip.content,
    category: dbTip.category as TipCategory,
    tags: (dbTip.tags as string[]) || [],
    destinations: tipData.destinations || (dbTip.destination ? [dbTip.destination] : []),
    activityTypes: (dbTip.activityCategories as string[]) || [],
    priority: dbTip.priority,
    seasonality: (dbTip.seasonality as string[]) || undefined,
    userPreferenceTypes: tipData.userPreferenceTypes || [],
    isGeneral: !dbTip.destination || dbTip.destination === '*',
    source: dbTip.source || 'system',
    lastUpdated: dbTip.updatedAt || dbTip.createdAt || new Date()
  };
}

export interface TipMatchResult {
  tip: LegacyTravelTip;
  relevanceScore: number;
  matchingReasons: string[];
  applicableActivities?: Activity[];
}

export interface TipGenerationRequest {
  tripId: number;
  userId: string;
  destinationOverride?: string;
  activityFilter?: string[];
  maxTips?: number;
  categoryFilter?: TipCategory[];
}

export type TipCategory = 
  | 'packing'
  | 'local_customs'
  | 'transportation'
  | 'weather'
  | 'dining'
  | 'safety'
  | 'money'
  | 'communication'
  | 'health'
  | 'documents'
  | 'activities'
  | 'accommodation';

export type TravelStyle = 'budget' | 'comfort' | 'luxury' | 'adventure' | 'family' | 'business';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';

// Legacy in-memory travel tips database - to be migrated to database
const LEGACY_TRAVEL_TIPS_DATABASE: LegacyTravelTip[] = [
  // Packing Tips
  {
    id: 'pack-001',
    title: 'Pack a portable phone charger for long travel days',
    description: 'Always bring a portable battery pack when exploring new cities. Public charging stations may be scarce, and you\'ll need your phone for maps, translations, and photos.',
    category: 'packing',
    tags: ['electronics', 'essentials', 'battery'],
    destinations: ['*'], // Universal tip
    activityTypes: ['sightseeing', 'outdoor', 'cultural', 'adventure', 'other'],
    priority: 5,
    userPreferenceTypes: ['practical', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'pack-002',
    title: 'Bring comfortable walking shoes for European cobblestones',
    description: 'European old towns have uneven cobblestone streets that can be tough on feet. Pack sturdy, comfortable shoes with good grip to enjoy long walks without discomfort.',
    category: 'packing',
    tags: ['shoes', 'comfort', 'walking'],
    destinations: ['Europe', 'Italy', 'France', 'Spain', 'Germany', 'Prague', 'Rome', 'Paris'],
    activityTypes: ['sightseeing', 'cultural', 'walking tour'],
    priority: 4,
    userPreferenceTypes: ['comfort', 'practical'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'pack-003',
    title: 'Pack lightweight, breathable clothing for tropical destinations',
    description: 'In hot, humid climates, choose moisture-wicking fabrics and light colors. Bring more clothes than usual as you\'ll change frequently due to sweat and humidity.',
    category: 'packing',
    tags: ['clothing', 'tropical', 'climate'],
    destinations: ['Thailand', 'Indonesia', 'Philippines', 'Malaysia', 'Singapore', 'Vietnam', 'Cambodia'],
    activityTypes: ['outdoor', 'beach', 'adventure', 'sightseeing'],
    priority: 4,
    seasonality: ['summer', 'all'],
    userPreferenceTypes: ['comfort', 'practical'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'pack-004',
    title: 'Bring warm layers for mountain destinations',
    description: 'Mountain weather can change rapidly. Pack layers including a waterproof jacket, warm sweater, and thermal base layers, even in summer.',
    category: 'packing',
    tags: ['mountains', 'layers', 'weather'],
    destinations: ['Switzerland', 'Colorado', 'Nepal', 'Patagonia', 'Alps'],
    activityTypes: ['hiking', 'outdoor', 'adventure', 'skiing'],
    priority: 5,
    userPreferenceTypes: ['safety', 'practical'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'pack-005',
    title: 'Pack a universal power adapter for international trips',
    description: 'Different countries use different electrical outlets. A universal adapter with USB ports will keep all your devices charged throughout your trip.',
    category: 'packing',
    tags: ['electronics', 'adapter', 'international'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['practical', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Local Customs & Etiquette
  {
    id: 'customs-001',
    title: 'Remove shoes when entering homes in Asian countries',
    description: 'In most Asian countries, it\'s customary to remove shoes before entering someone\'s home, temples, or certain restaurants. Look for shoe racks at the entrance.',
    category: 'local_customs',
    tags: ['shoes', 'etiquette', 'homes', 'temples'],
    destinations: ['Japan', 'Korea', 'Thailand', 'Vietnam', 'China', 'Malaysia', 'Singapore'],
    activityTypes: ['cultural', 'dining', 'religious'],
    priority: 4,
    userPreferenceTypes: ['cultural', 'respect'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'customs-002',
    title: 'Tipping is not expected in Japan',
    description: 'Tipping can actually be considered rude in Japan. Excellent service is expected and included in the price. Simply say "arigatou gozaimasu" (thank you) to show appreciation.',
    category: 'local_customs',
    tags: ['tipping', 'service', 'etiquette'],
    destinations: ['Japan'],
    activityTypes: ['dining', 'transportation', 'accommodation'],
    priority: 3,
    userPreferenceTypes: ['cultural', 'etiquette'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'customs-003',
    title: 'Dress conservatively when visiting religious sites',
    description: 'Cover shoulders, knees, and sometimes heads when visiting churches, temples, or mosques. Many sites provide coverings, but it\'s better to dress appropriately.',
    category: 'local_customs',
    tags: ['dress code', 'religious', 'respect'],
    destinations: ['*'],
    activityTypes: ['religious', 'cultural', 'sightseeing'],
    priority: 4,
    userPreferenceTypes: ['cultural', 'respect'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'customs-004',
    title: 'Greet with "Namaste" in India and Nepal',
    description: 'Place palms together at chest level and bow slightly while saying "Namaste." This respectful greeting is appreciated and shows cultural awareness.',
    category: 'local_customs',
    tags: ['greeting', 'respect', 'gesture'],
    destinations: ['India', 'Nepal'],
    activityTypes: ['cultural', 'sightseeing', 'shopping'],
    priority: 3,
    userPreferenceTypes: ['cultural', 'respect'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },

  // Transportation Tips
  {
    id: 'transport-001',
    title: 'Download offline maps before traveling',
    description: 'Download Google Maps offline or use apps like Maps.me for navigation without internet. Essential for remote areas or when avoiding roaming charges.',
    category: 'transportation',
    tags: ['navigation', 'offline', 'maps', 'mobile'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['practical', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'transport-002',
    title: 'Book train tickets in advance in Europe',
    description: 'European train tickets can be significantly cheaper when booked early. Consider a Eurail pass for multiple countries, or book individual tickets 2-3 months ahead.',
    category: 'transportation',
    tags: ['train', 'booking', 'advance', 'savings'],
    destinations: ['Europe', 'France', 'Germany', 'Italy', 'Spain', 'Switzerland'],
    activityTypes: ['sightseeing', 'transportation'],
    priority: 4,
    userPreferenceTypes: ['budget', 'convenience'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'transport-003',
    title: 'Use ride-sharing apps for safe transportation in cities',
    description: 'Apps like Uber, Grab, or local equivalents provide safer transportation than unmarked taxis, especially late at night. Prices are usually transparent.',
    category: 'transportation',
    tags: ['ride-sharing', 'safety', 'urban'],
    destinations: ['*'],
    activityTypes: ['nightlife', 'dining', 'entertainment'],
    priority: 4,
    userPreferenceTypes: ['safety', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'transport-004',
    title: 'Keep taxi receipts for business expense tracking',
    description: 'Always request receipts from taxis and ride-shares for business trips. Many apps can automatically categorize and store these for expense reports.',
    category: 'transportation',
    tags: ['receipts', 'business', 'expenses'],
    destinations: ['*'],
    activityTypes: ['business', 'meetings'],
    priority: 3,
    userPreferenceTypes: ['business', 'organization'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Weather & Climate
  {
    id: 'weather-001',
    title: 'Pack rain gear for monsoon season in Southeast Asia',
    description: 'Monsoon season (roughly May-October) brings heavy daily downpours. Pack a quality rain jacket and quick-dry clothes. Umbrellas are less effective in strong winds.',
    category: 'weather',
    tags: ['monsoon', 'rain', 'seasonal'],
    destinations: ['Thailand', 'Vietnam', 'Cambodia', 'Laos', 'Myanmar', 'Malaysia'],
    activityTypes: ['outdoor', 'sightseeing', 'adventure'],
    priority: 4,
    seasonality: ['may', 'june', 'july', 'august', 'september', 'october'],
    userPreferenceTypes: ['practical', 'comfort'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'weather-002',
    title: 'Check altitude sickness precautions for high-elevation destinations',
    description: 'Cities above 8,000 feet (like Cusco, La Paz, or Lhasa) can cause altitude sickness. Arrive early to acclimatize, stay hydrated, and avoid alcohol initially.',
    category: 'weather',
    tags: ['altitude', 'health', 'acclimatization'],
    destinations: ['Peru', 'Bolivia', 'Tibet', 'Ecuador', 'Colorado'],
    activityTypes: ['adventure', 'hiking', 'sightseeing'],
    priority: 5,
    userPreferenceTypes: ['safety', 'health'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'weather-003',
    title: 'Pack sunscreen with high SPF for tropical destinations',
    description: 'The sun is much stronger near the equator. Bring SPF 30+ sunscreen and reapply frequently, especially when swimming or sweating. Don\'t forget lip balm with SPF.',
    category: 'weather',
    tags: ['sun protection', 'sunscreen', 'tropical'],
    destinations: ['Thailand', 'Indonesia', 'Philippines', 'Mexico', 'Caribbean', 'Hawaii'],
    activityTypes: ['beach', 'outdoor', 'water sports'],
    priority: 4,
    userPreferenceTypes: ['health', 'practical'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },

  // Dining & Food Safety
  {
    id: 'dining-001',
    title: 'Try street food from busy stalls with high turnover',
    description: 'Street food from popular, busy stalls is often safer and fresher than quiet ones. Look for long lines of locals - that\'s usually a good sign of both safety and quality.',
    category: 'dining',
    tags: ['street food', 'safety', 'local', 'turnover'],
    destinations: ['Thailand', 'Vietnam', 'India', 'Mexico', 'Malaysia', 'Taiwan'],
    activityTypes: ['dining', 'cultural', 'food tour'],
    priority: 3,
    userPreferenceTypes: ['adventure', 'cultural'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'dining-002',
    title: 'Drink bottled or filtered water in developing countries',
    description: 'Avoid tap water, ice cubes, and raw vegetables washed in tap water. Stick to bottled water, hot beverages, and cooked foods to prevent stomach issues.',
    category: 'dining',
    tags: ['water safety', 'health', 'hygiene'],
    destinations: ['India', 'Southeast Asia', 'Central America', 'Africa', 'South America'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['health', 'safety'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'dining-003',
    title: 'Learn basic dining etiquette for chopstick countries',
    description: 'Don\'t stick chopsticks upright in rice (resembles incense at funerals), don\'t pass food directly chopstick-to-chopstick, and don\'t point with them.',
    category: 'dining',
    tags: ['chopsticks', 'etiquette', 'cultural'],
    destinations: ['China', 'Japan', 'Korea', 'Vietnam', 'Taiwan'],
    activityTypes: ['dining', 'cultural'],
    priority: 3,
    userPreferenceTypes: ['cultural', 'respect'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'dining-004',
    title: 'Make restaurant reservations for popular spots',
    description: 'Research and book popular restaurants in advance, especially in major tourist cities. Use OpenTable, Resy, or call directly. Many top spots book weeks ahead.',
    category: 'dining',
    tags: ['reservations', 'planning', 'popular'],
    destinations: ['*'],
    activityTypes: ['dining', 'fine dining', 'romantic'],
    priority: 3,
    userPreferenceTypes: ['convenience', 'experience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Safety & Security
  {
    id: 'safety-001',
    title: 'Keep copies of important documents in separate locations',
    description: 'Scan and store digital copies of passport, visa, travel insurance, and important cards in email/cloud storage. Keep physical copies separate from originals.',
    category: 'safety',
    tags: ['documents', 'backup', 'security'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['safety', 'organization'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'safety-002',
    title: 'Research local emergency numbers and embassy contacts',
    description: 'Save local emergency numbers, your embassy contact, and travel insurance numbers in your phone. Include police, medical emergency, and fire department numbers.',
    category: 'safety',
    tags: ['emergency', 'contacts', 'preparation'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['safety', 'preparation'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'safety-003',
    title: 'Use hotel safe for valuables and extra cash',
    description: 'Store passport, extra credit cards, large amounts of cash, and expensive jewelry in your hotel safe. Only carry what you need for the day.',
    category: 'safety',
    tags: ['valuables', 'hotel safe', 'security'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['safety', 'security'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'safety-004',
    title: 'Be extra cautious at ATMs in tourist areas',
    description: 'Use ATMs inside banks or hotels when possible. Cover your PIN, check for card skimmers, and be aware of your surroundings. Tourist areas have higher crime rates.',
    category: 'safety',
    tags: ['ATM', 'money', 'crime prevention'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['safety', 'money'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Money & Finance
  {
    id: 'money-001',
    title: 'Notify your bank of travel plans',
    description: 'Inform your bank and credit card companies of your travel dates and destinations to prevent cards from being blocked for suspicious activity.',
    category: 'money',
    tags: ['banking', 'cards', 'notification'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['practical', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'money-002',
    title: 'Carry multiple payment methods',
    description: 'Bring at least two different credit cards and some cash. If one card is lost, stolen, or declined, you\'ll have backup options. Visa and Mastercard are most widely accepted.',
    category: 'money',
    tags: ['payment', 'backup', 'cards'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['practical', 'security'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'money-003',
    title: 'Research tipping customs for each destination',
    description: 'Tipping practices vary dramatically by country. Some places include service charges, others expect 15-20%. Research local customs to avoid under or over-tipping.',
    category: 'money',
    tags: ['tipping', 'customs', 'service'],
    destinations: ['*'],
    activityTypes: ['dining', 'transportation', 'accommodation'],
    priority: 3,
    userPreferenceTypes: ['cultural', 'etiquette'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'money-004',
    title: 'Use local currency for better exchange rates',
    description: 'When using cards abroad, always choose to pay in local currency rather than your home currency. Dynamic currency conversion has poor exchange rates.',
    category: 'money',
    tags: ['currency', 'exchange rate', 'cards'],
    destinations: ['*'],
    activityTypes: ['shopping', 'dining', 'accommodation'],
    priority: 3,
    userPreferenceTypes: ['budget', 'practical'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Communication & Connectivity
  {
    id: 'comm-001',
    title: 'Download Google Translate with offline languages',
    description: 'Download key languages for offline use in Google Translate. The camera translation feature works even offline and is invaluable for menus and signs.',
    category: 'communication',
    tags: ['translation', 'offline', 'language'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['practical', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'comm-002',
    title: 'Get local SIM card or international plan for data',
    description: 'Either buy a local SIM card at the airport or activate an international data plan. Having internet access is crucial for navigation, translation, and communication.',
    category: 'communication',
    tags: ['SIM card', 'data', 'internet'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['practical', 'convenience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'comm-003',
    title: 'Learn basic phrases in the local language',
    description: 'Learn hello, thank you, please, excuse me, and how to ask "Do you speak English?" in the local language. Locals appreciate the effort and are more helpful.',
    category: 'communication',
    tags: ['language', 'phrases', 'respect'],
    destinations: ['*'],
    activityTypes: ['cultural', 'dining', 'shopping'],
    priority: 3,
    userPreferenceTypes: ['cultural', 'respect'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Health & Medical
  {
    id: 'health-001',
    title: 'Get travel vaccinations 4-6 weeks before departure',
    description: 'Research required and recommended vaccinations for your destination. Some vaccines need multiple doses or time to become effective. Consult a travel medicine specialist.',
    category: 'health',
    tags: ['vaccinations', 'medical', 'preparation'],
    destinations: ['Africa', 'South America', 'Southeast Asia', 'India'],
    activityTypes: ['adventure', 'outdoor', 'rural'],
    priority: 5,
    userPreferenceTypes: ['health', 'safety'],
    isGeneral: false,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'health-002',
    title: 'Pack a basic first aid kit',
    description: 'Include band-aids, antiseptic wipes, pain relievers, anti-diarrheal medication, and any prescription medicines with extra supplies. Keep medications in original containers.',
    category: 'health',
    tags: ['first aid', 'medication', 'preparation'],
    destinations: ['*'],
    activityTypes: ['outdoor', 'adventure', 'hiking'],
    priority: 4,
    userPreferenceTypes: ['health', 'practical'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'health-003',
    title: 'Get travel insurance that covers medical emergencies',
    description: 'Travel insurance with medical coverage is essential, especially for adventure activities. Ensure it covers medical evacuation, which can cost hundreds of thousands.',
    category: 'health',
    tags: ['insurance', 'medical', 'emergency'],
    destinations: ['*'],
    activityTypes: ['adventure', 'outdoor', 'extreme sports'],
    priority: 5,
    userPreferenceTypes: ['safety', 'health'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Documents & Legal
  {
    id: 'docs-001',
    title: 'Check passport expiration and visa requirements',
    description: 'Many countries require passports valid for 6+ months beyond travel dates. Research visa requirements early as some take weeks to process.',
    category: 'documents',
    tags: ['passport', 'visa', 'requirements'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 5,
    userPreferenceTypes: ['practical', 'organization'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'docs-002',
    title: 'Register with your embassy for long-term travel',
    description: 'For trips longer than two weeks, register with your embassy. They can assist in emergencies, natural disasters, or political unrest.',
    category: 'documents',
    tags: ['embassy', 'registration', 'safety'],
    destinations: ['*'],
    activityTypes: ['long-term', 'work', 'study'],
    priority: 3,
    userPreferenceTypes: ['safety', 'preparation'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Activities & Experiences
  {
    id: 'activities-001',
    title: 'Book popular attractions and tours in advance',
    description: 'Major attractions like Machu Picchu, Alhambra, or Anne Frank House sell out weeks or months ahead. Book early or consider skip-the-line tours.',
    category: 'activities',
    tags: ['booking', 'attractions', 'advance'],
    destinations: ['*'],
    activityTypes: ['sightseeing', 'cultural', 'tours'],
    priority: 4,
    userPreferenceTypes: ['convenience', 'planning'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'activities-002',
    title: 'Join free walking tours for city orientation',
    description: 'Most major cities offer free walking tours that provide great orientation, history, and local tips. They run on tips, so bring small bills to show appreciation.',
    category: 'activities',
    tags: ['walking tours', 'orientation', 'budget'],
    destinations: ['*'],
    activityTypes: ['sightseeing', 'cultural', 'walking tour'],
    priority: 3,
    userPreferenceTypes: ['budget', 'cultural'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'activities-003',
    title: 'Wake up early to beat crowds at popular sites',
    description: 'Famous attractions are most crowded between 10am-3pm. Arrive early morning or late afternoon for better photos, shorter lines, and a more peaceful experience.',
    category: 'activities',
    tags: ['crowds', 'timing', 'photography'],
    destinations: ['*'],
    activityTypes: ['sightseeing', 'photography', 'cultural'],
    priority: 3,
    userPreferenceTypes: ['convenience', 'experience'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },

  // Accommodation
  {
    id: 'accommodation-001',
    title: 'Read recent reviews and check photos before booking',
    description: 'Hotel photos can be misleading. Read reviews from the last 6 months and look at guest photos to get an accurate picture of the property\'s current condition.',
    category: 'accommodation',
    tags: ['reviews', 'booking', 'research'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['quality', 'practical'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'accommodation-002',
    title: 'Check hotel location relative to your planned activities',
    description: 'A hotel might be cheaper but cost more in transportation. Consider proximity to main attractions, public transit, and the neighborhood\'s safety and character.',
    category: 'accommodation',
    tags: ['location', 'transportation', 'planning'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 4,
    userPreferenceTypes: ['convenience', 'budget'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  },
  {
    id: 'accommodation-003',
    title: 'Confirm check-in times and early arrival policies',
    description: 'Most hotels don\'t allow check-in before 3pm. If arriving early, confirm luggage storage options or pay for early check-in to avoid waiting around.',
    category: 'accommodation',
    tags: ['check-in', 'timing', 'planning'],
    destinations: ['*'],
    activityTypes: ['*'],
    priority: 3,
    userPreferenceTypes: ['convenience', 'planning'],
    isGeneral: true,
    lastUpdated: new Date('2024-01-01')
  }
];

// Default user preferences for new users
const DEFAULT_USER_PREFERENCES = {
  preferredCategories: ['safety', 'packing', 'transportation', 'dining', 'money'],
  dismissedTips: [],
  showSeasonalTips: true,
  showLocationTips: true,
  showActivityTips: true,
  tipFrequency: 'normal',
  preferredLanguage: 'en'
};

// Database seeding function to populate travel tips
export async function seedTravelTipsDatabase(): Promise<void> {
  try {
    // Check if database already has tips to avoid duplicate seeding
    const existingTips = await storage.getTravelTips({ limit: 1 });
    if (existingTips.length > 0) {
      console.log('🌱 Travel tips database already seeded');
      return;
    }

    console.log('🌱 Seeding travel tips database...');
    
    // Convert legacy tips to database format and insert them
    let seedCount = 0;
    for (const legacyTip of LEGACY_TRAVEL_TIPS_DATABASE) {
      try {
        const tipData = {
          category: legacyTip.category,
          destination: legacyTip.isGeneral ? '*' : legacyTip.destinations[0] || '*',
          content: JSON.stringify({
            title: legacyTip.title,
            description: legacyTip.description,
            destinations: legacyTip.destinations,
            userPreferenceTypes: legacyTip.userPreferenceTypes
          }),
          priority: legacyTip.priority,
          tags: legacyTip.tags,
          activityCategories: legacyTip.activityTypes.filter(type => type !== '*'),
          seasonality: legacyTip.seasonality || null,
          source: legacyTip.source || 'system'
        };
        
        await storage.createTravelTip(tipData);
        seedCount++;
      } catch (tipError) {
        console.error(`Error seeding tip ${legacyTip.id}:`, tipError);
      }
    }
    
    console.log(`✅ Successfully seeded ${seedCount} travel tips to database`);
  } catch (error) {
    console.error('❌ Error seeding travel tips database:', error);
    throw new Error('Failed to seed travel tips database');
  }
}

// Cache user preferences to avoid repeated database calls
const getUserPreferencesFromCache = memoize(
  async (userId: string): Promise<UserTipPreferences> => {
    // For now, return default preferences
    // In a full implementation, this would query the database for stored preferences
    return {
      id: 0, // Will be auto-generated when saved
      userId,
      createdAt: null,
      updatedAt: null,
      ...DEFAULT_USER_PREFERENCES
    };
  },
  { maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
);

// Cache trip data to avoid repeated database calls
const getTripDataFromCache = memoize(
  async (tripId: number): Promise<{ trip: TripCalendar; activities: Activity[] } | null> => {
    try {
      const { rows: tripRows } = await query<TripCalendarRow>(
        `
        SELECT id,
               name,
               destination,
               start_date,
               end_date,
               share_code,
               created_by,
               created_at
        FROM trip_calendars
        WHERE id = $1
        LIMIT 1
        `,
        [tripId],
      );

      if (tripRows.length === 0) {
        return null;
      }

      const trip = mapTripCalendar(tripRows[0]);

      const { rows: activityRows } = await query<ActivityRow>(
        `
        SELECT id,
               trip_calendar_id,
               posted_by,
               name,
               description,
               start_time,
               end_time,
               location,
               cost::text AS cost,
               max_capacity,
               category,
               created_at,
               updated_at
        FROM activities
        WHERE trip_calendar_id = $1
        ORDER BY start_time ASC
        `,
        [tripId],
      );

      const tripActivities = activityRows.map(mapActivity);

      return {
        trip,
        activities: tripActivities,
      };
    } catch (error) {
      console.error("Error fetching trip data:", error);
      return null;
    }
  },
  { maxAge: 2 * 60 * 1000 },
);

// Smart Matching Algorithm Functions
function calculateDestinationScore(tip: LegacyTravelTip, destination: string): number {
  if (tip.isGeneral || tip.destinations.includes('*')) {
    return 0.3; // General tips get a base score
  }

  const destinationLower = destination.toLowerCase();
  let score = 0;

  // Exact destination match (highest score)
  if (tip.destinations.some(dest => dest.toLowerCase() === destinationLower)) {
    score = 1.0;
  }
  // Partial match (city in country, region match)
  else if (tip.destinations.some(dest => 
    destinationLower.includes(dest.toLowerCase()) || 
    dest.toLowerCase().includes(destinationLower)
  )) {
    score = 0.8;
  }
  // Country match for city destinations
  else if (tip.destinations.some(dest => {
    // Basic country matching logic
    const commonCountryMappings: { [key: string]: string[] } = {
      'japan': ['tokyo', 'osaka', 'kyoto', 'hiroshima'],
      'thailand': ['bangkok', 'phuket', 'chiang mai', 'pattaya'],
      'italy': ['rome', 'florence', 'venice', 'milan'],
      'france': ['paris', 'nice', 'lyon', 'marseille'],
      'spain': ['madrid', 'barcelona', 'seville', 'valencia'],
      'india': ['mumbai', 'delhi', 'bangalore', 'goa'],
    };

    const destLower = dest.toLowerCase();
    if (commonCountryMappings[destLower]?.includes(destinationLower)) {
      return true;
    }
    return false;
  })) {
    score = 0.6;
  }

  return score;
}

function calculateActivityScore(tip: LegacyTravelTip, activities: Activity[]): number {
  if (tip.activityTypes.includes('*') || activities.length === 0) {
    return 0.3; // Base score for general tips or no activities
  }

  const activityCategories = activities.map(a => a.category);
  const uniqueCategories = Array.from(new Set(activityCategories));

  let matchingCategories = 0;
  for (const activityType of tip.activityTypes) {
    if (uniqueCategories.includes(activityType)) {
      matchingCategories++;
    }
  }

  return Math.min(matchingCategories / tip.activityTypes.length, 1.0);
}

function calculateSeasonalScore(tip: LegacyTravelTip, travelDate: Date): number {
  if (!tip.seasonality || tip.seasonality.includes('all')) {
    return 1.0; // No seasonal restriction
  }

  const month = travelDate.getMonth() + 1; // 1-12
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december'];
  const currentMonthName = monthNames[month - 1];

  if (tip.seasonality.includes(currentMonthName)) {
    return 1.0;
  }

  // Check for season names
  const seasons: { [key: string]: number[] } = {
    'spring': [3, 4, 5],
    'summer': [6, 7, 8],
    'fall': [9, 10, 11],
    'autumn': [9, 10, 11],
    'winter': [12, 1, 2]
  };

  for (const season of tip.seasonality) {
    if (seasons[season]?.includes(month)) {
      return 1.0;
    }
  }

  return 0.3; // Reduced score for out-of-season tips
}

function calculateUserPreferenceScore(tip: LegacyTravelTip, preferences: DBUserTipPreferences): number {
  let score = 0.5; // Base score
  
  // Check preferred categories
  const preferredCategories = (preferences.preferredCategories as string[]) || [];
  if (preferredCategories.includes(tip.category)) {
    score += 0.3;
  }
  
  // Check if tip is dismissed
  const dismissedTips = (preferences.dismissedTips as number[]) || [];
  const tipIdNum = parseInt(tip.id.replace(/\D/g, ''), 10);
  if (dismissedTips.includes(tipIdNum)) {
    return 0; // Dismissed tips get zero score
  }
  
  // Map legacy user preference types to user settings
  if (preferences.showSeasonalTips && tip.seasonality) {
    score += 0.1;
  }
  
  if (preferences.showLocationTips && !tip.isGeneral) {
    score += 0.1;
  }
  
  if (preferences.showActivityTips && tip.activityTypes.length > 0) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

// Core Service Functions

export async function generateTipsForTrip(
  tripId: number, 
  userId: string, 
  options: { maxTips?: number; categoryFilter?: TipCategory[] } = {}
): Promise<TipMatchResult[]> {
  try {
    console.log(`🎯 Generating tips for trip ${tripId}, user ${userId}`);

    const { maxTips = 10, categoryFilter } = options;

    // Get trip data and user preferences
    const [tripData, userPreferences] = await Promise.all([
      getTripDataFromCache(tripId),
      getUserPreferencesFromCache(userId)
    ]);

    if (!tripData) {
      console.warn(`Trip ${tripId} not found`);
      return [];
    }

    const { trip, activities } = tripData;

    // Ensure travel tips database is seeded
    await seedTravelTipsDatabase();

    // Get tips from database instead of in-memory array
    const dbTips = await storage.getTravelTips({
      category: categoryFilter && categoryFilter.length === 1 ? categoryFilter[0] : undefined,
      destination: trip.destination,
      limit: maxTips * 3 // Get more tips than needed for better scoring
    });

    // Convert database tips to legacy format for compatibility with existing scoring logic
    const availableTips = dbTips.map(convertToLegacyTip);

    // Filter by category if multiple categories specified
    const filteredTips = categoryFilter && categoryFilter.length > 1 
      ? availableTips.filter(tip => categoryFilter.includes(tip.category))
      : availableTips;

    // Calculate relevance scores for each tip
    const tipMatches: TipMatchResult[] = filteredTips.map(tip => {
      const destinationScore = calculateDestinationScore(tip, trip.destination);
      const activityScore = calculateActivityScore(tip, activities);
      const seasonalScore = calculateSeasonalScore(tip, new Date(trip.startDate));
      const userPrefScore = calculateUserPreferenceScore(tip, userPreferences);

      // Weighted relevance calculation
      const relevanceScore = 
        (destinationScore * 0.3) +
        (activityScore * 0.25) +
        (seasonalScore * 0.2) +
        (userPrefScore * 0.2) +
        (tip.priority / 5 * 0.05); // Priority contributes 5%

      // Generate matching reasons
      const matchingReasons: string[] = [];
      if (destinationScore > 0.5) matchingReasons.push('Destination match');
      if (activityScore > 0.5) matchingReasons.push('Activity relevance');
      if (seasonalScore > 0.8) matchingReasons.push('Seasonal relevance');
      if (userPrefScore > 0.7) matchingReasons.push('User preference match');
      if (tip.priority >= 4) matchingReasons.push('High priority');

      // Filter applicable activities
      const applicableActivities = activities.filter(activity =>
        tip.activityTypes.includes('*') || tip.activityTypes.includes(activity.category)
      );

      return {
        tip,
        relevanceScore,
        matchingReasons,
        applicableActivities
      };
    });

    // Sort by relevance score and take top results
    const sortedTips = tipMatches
      .filter(match => match.relevanceScore > 0.1) // Filter out very low relevance
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTips);

    console.log(`✅ Generated ${sortedTips.length} tips for trip ${tripId}`);
    return sortedTips;

  } catch (error) {
    console.error('Error generating tips for trip:', error);
    throw new Error('Failed to generate travel tips for trip');
  }
}



export async function getUserTipPreferences(userId: string): Promise<UserTipPreferences> {
  try {
    return await getUserPreferencesFromCache(userId);
  } catch (error) {
    console.error('Error getting user tip preferences:', error);
    throw new Error('Failed to get user tip preferences');
  }
}

export async function updateUserTipPreferences(
  userId: string, 
  preferences: Partial<InsertUserTipPreferences>
): Promise<DBUserTipPreferences> {
  try {
    console.log(`📝 Updating tip preferences for user ${userId}`);

    // Update preferences in database
    const updatedPrefs = await storage.createOrUpdateUserTipPreferences(userId, preferences);
    
    // Clear cache to force refresh
    getUserPreferencesFromCache.clear();
    
    console.log(`✅ Updated tip preferences for user ${userId}`);
    return updatedPrefs;

  } catch (error) {
    console.error('Error updating user tip preferences:', error);
    throw new Error('Failed to update user tip preferences');
  }
}

// Utility function to get all available tip categories
export function getAvailableTipCategories(): TipCategory[] {
  return [
    'packing',
    'local_customs',
    'transportation',
    'weather',
    'dining',
    'safety',
    'money',
    'communication',
    'health',
    'documents',
    'activities',
    'accommodation'
  ];
}

// Utility function to get tips by priority level
export async function getTipsByPriority(priority: number): Promise<LegacyTravelTip[]> {
  try {
    const dbTips = await storage.getTravelTips({ limit: 100 });
    const legacyTips = dbTips.map(convertToLegacyTip);
    return legacyTips.filter(tip => tip.priority === priority);
  } catch (error) {
    console.error('Error getting tips by priority:', error);
    return [];
  }
}

// Utility function to dismiss a tip for a user
export async function dismissTip(userId: string, tipId: string): Promise<void> {
  try {
    console.log(`❌ Dismissing tip ${tipId} for user ${userId}`);
    
    // Convert string tipId to number for database storage
    const tipIdNum = parseInt(tipId.replace(/\D/g, ''), 10);
    
    await storage.dismissTipForUser(userId, tipIdNum);
    
    // Clear cache to force refresh
    getUserPreferencesFromCache.clear();

    console.log(`✅ Dismissed tip ${tipId} for user ${userId}`);
  } catch (error) {
    console.error('Error dismissing tip:', error);
    throw new Error('Failed to dismiss tip');
  }
}

// Utility function to get tip statistics
export async function getTipStatistics(): Promise<{
  totalTips: number;
  tipsByCategory: { [key: string]: number };
  tipsByPriority: { [key: string]: number };
}> {
  try {
    const dbTips = await storage.getTravelTips({ limit: 1000 });
    const legacyTips = dbTips.map(convertToLegacyTip);
    
    const tipsByCategory: { [key: string]: number } = {};
    const tipsByPriority: { [key: string]: number } = {};

    legacyTips.forEach(tip => {
      // Count by category
      tipsByCategory[tip.category] = (tipsByCategory[tip.category] || 0) + 1;
      
      // Count by priority
      const priorityKey = `priority_${tip.priority}`;
      tipsByPriority[priorityKey] = (tipsByPriority[priorityKey] || 0) + 1;
    });

    return {
      totalTips: legacyTips.length,
      tipsByCategory,
      tipsByPriority
    };
  } catch (error) {
    console.error('Error getting tip statistics:', error);
    return {
      totalTips: 0,
      tipsByCategory: {},
      tipsByPriority: {}
    };
  }
}

// Search tips by destination
export async function searchTipsByDestination(
  destination: string,
  activityCategories?: string[],
  options: { limit?: number } = {}
): Promise<LegacyTravelTip[]> {
  try {
    console.log(`🔍 Searching tips for destination: ${destination}`);
    
    // Ensure database is seeded
    await seedTravelTipsDatabase();
    
    const { limit = 20 } = options;
    
    // Get tips from database
    const dbTips = await storage.getTravelTips({
      destination,
      limit: limit * 2 // Get more for better filtering
    });
    
    // Convert to legacy format
    const legacyTips = dbTips.map(convertToLegacyTip);
    
    // Filter by activity categories if provided
    let filteredTips = legacyTips;
    if (activityCategories && activityCategories.length > 0) {
      filteredTips = legacyTips.filter(tip => 
        tip.activityTypes.some(type => 
          type === '*' || activityCategories.includes(type)
        )
      );
    }
    
    // Sort by priority and relevance
    const sortedTips = filteredTips
      .sort((a, b) => {
        // Priority first
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by specificity (specific destinations before general)
        if (a.isGeneral !== b.isGeneral) {
          return a.isGeneral ? 1 : -1;
        }
        return 0;
      })
      .slice(0, limit);
    
    console.log(`✅ Found ${sortedTips.length} tips for ${destination}`);
    return sortedTips;
    
  } catch (error) {
    console.error('Error searching tips by destination:', error);
    return [];
  }
}

// Get tips by category
export async function getTipsByCategory(category: TipCategory, limit: number = 20): Promise<LegacyTravelTip[]> {
  try {
    console.log(`📂 Getting tips for category: ${category}`);
    
    // Ensure database is seeded
    await seedTravelTipsDatabase();
    
    const dbTips = await storage.getTravelTips({
      category,
      limit
    });
    
    const legacyTips = dbTips.map(convertToLegacyTip);
    
    console.log(`✅ Found ${legacyTips.length} tips for category ${category}`);
    return legacyTips;
    
  } catch (error) {
    console.error('Error getting tips by category:', error);
    return [];
  }
}

// Cache invalidation function - call when activities change to refresh travel tips
export function invalidateTravelTipsCache(tripId?: number): void {
  try {
    console.log(`🔄 Invalidating travel tips cache${tripId ? ` for trip ${tripId}` : ''}`);
    
    if (tripId) {
      // Clear specific trip data from cache
      const cacheKey = `${tripId}`;
      // Since getTripDataFromCache is memoized, we need to clear the specific cache entry
      // This will force travel tips to be regenerated when accessed next time
      getTripDataFromCache.clear();
      getUserPreferencesFromCache.clear();
    } else {
      // Clear all cache
      getTripDataFromCache.clear();
      getUserPreferencesFromCache.clear();
    }
    
    console.log(`✅ Travel tips cache invalidated`);
  } catch (error) {
    console.error('Error invalidating travel tips cache:', error);
  }
}
