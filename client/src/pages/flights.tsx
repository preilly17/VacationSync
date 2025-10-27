import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Plane, Clock, Users, Edit, Trash2, Plus, Search, ArrowLeft, PlaneTakeoff, PlaneLanding, ExternalLink, Loader2 } from "lucide-react";
import { TravelLoading } from "@/components/LoadingSpinners";
import LocationSearch, { type LocationResult } from "@/components/LocationSearch";
import type {
  FlightWithDetails,
  InsertFlight,
  TripWithDetails,
  User,
} from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatCurrency } from "@/lib/utils";
import { fetchNearestAirportsForLocation, type NearbyAirport, extractCoordinates } from "@/lib/nearestAirports";

// Helper function to format duration in minutes to "Xh Ym" format
function formatDuration(minutes: number | string): string {
  const mins = typeof minutes === 'string' ? parseInt(minutes) || 0 : minutes;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return `${hours}h ${remainder}m`;
}

// Helper function to format layovers
function formatLayovers(layoversStr: string | any[]): string {
  if (Array.isArray(layoversStr)) {
    return layoversStr.map((layover: any) => `${layover.airport} (${layover.duration}min)`).join(", ");
  }
  try {
    const layovers = JSON.parse(layoversStr);
    return layovers.map((layover: any) => `${layover.airport} (${layover.duration}min)`).join(", ");
  } catch {
    return layoversStr;
  }
}

const parseNumericAmount = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const formatPriceDisplay = (
  value: unknown,
  currency?: string | null,
  fallback = "N/A",
): string => {
  const amount = parseNumericAmount(value);
  if (amount !== null) {
    return formatCurrency(amount, { currency: currency ?? "USD" });
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return fallback;
};

const parseApiErrorResponse = (
  error: unknown,
): { status: number; data: unknown } | null => {
  if (error instanceof ApiError) {
    return { status: error.status, data: error.data };
  }
  if (error instanceof Error) {
    const match = error.message.match(/^(\d{3}):\s*(.*)$/);
    if (match) {
      const status = Number.parseInt(match[1], 10);
      try {
        return { status, data: JSON.parse(match[2]) };
      } catch {
        return { status, data: match[2] };
      }
    }
  }
  return null;
};

// Helper function to get flight status color
function getFlightStatusColor(status: string): string {
  switch (status) {
    case "confirmed": return "bg-green-100 text-green-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "delayed": return "bg-yellow-100 text-yellow-800";
    case "completed": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

const extractAirportCode = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 3) {
    return trimmed.toUpperCase();
  }

  const match = trimmed.match(/\(([A-Z]{3})\)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return null;
};

const extractAirportName = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*)\s+\([A-Z]{3}\)$/i);
  if (match) {
    return match[1].trim();
  }

  return value;
};

const formatAirportDisplay = (name?: string | null, code?: string | null): string => {
  const trimmedName = name?.trim();
  const trimmedCode = code?.trim()?.toUpperCase();
  if (trimmedName && trimmedCode) {
    return `${trimmedName} (${trimmedCode})`;
  }
  if (trimmedCode) {
    return trimmedCode;
  }
  return trimmedName ?? '';
};

const parseManualLocationInput = (value: string): { code: string; name: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const extractedCode = extractAirportCode(trimmed);
  const extractedName = extractAirportName(trimmed) ?? trimmed;

  if (extractedCode && /^[A-Z]{3}$/i.test(extractedCode)) {
    const code = extractedCode.toUpperCase();
    return { code, name: extractedName.trim() || code };
  }

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return { code, name: code };
  }

  return null;
};

interface ParsedAirlineFlight {
  flightNumber: string;
  airlineCode: string;
  airlineName: string;
}

const parseManualAirlineFlight = (value: string): ParsedAirlineFlight | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, ' ');
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const reversedIndex = tokens
    .slice()
    .reverse()
    .findIndex((token) => /\d/.test(token));

  if (reversedIndex === -1) {
    return null;
  }

  const flightTokenIndex = tokens.length - 1 - reversedIndex;
  const flightToken = tokens[flightTokenIndex];
  const letterPart = flightToken.match(/[A-Za-z]+/g)?.join('') ?? '';
  const digitPart = flightToken.match(/\d+/g)?.join('') ?? '';

  const airlineCodeCandidate = letterPart.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(airlineCodeCandidate) || digitPart.length === 0) {
    return null;
  }

  const airlineCode = airlineCodeCandidate;
  const flightNumber = `${airlineCode}${digitPart}`;
  const airlineNameTokens = tokens.slice(0, flightTokenIndex);
  const airlineName = airlineNameTokens.join(' ').trim() || getAirlineName(airlineCode) || airlineCode;

  return {
    flightNumber: flightNumber.toUpperCase(),
    airlineCode,
    airlineName,
  };
};

const formatManualAirlineFlightDisplay = (flight: FlightWithDetails): string => {
  const parts = [flight.airline?.trim(), flight.flightNumber?.trim()].filter(Boolean);
  return parts.join(' ').trim();
};

const extractFlightNotes = (flight: FlightWithDetails): string => {
  const baggage = flight.baggage;
  if (!baggage) {
    return '';
  }

  if (typeof baggage === 'string') {
    const trimmed = baggage.trim();
    if (!trimmed) {
      return '';
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).notes === 'string') {
        return (parsed as Record<string, unknown>).notes as string;
      }
    } catch {
      return trimmed;
    }
    return '';
  }

  if (typeof baggage === 'object' && !Array.isArray(baggage)) {
    const notesValue = (baggage as Record<string, unknown>).notes;
    if (typeof notesValue === 'string') {
      return notesValue;
    }
  }

  return '';
};

const buildBaggageWithNotes = (existing: unknown, notes: string): unknown => {
  const trimmed = notes.trim();
  if (!trimmed) {
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      const copy = { ...(existing as Record<string, unknown>) };
      delete copy.notes;
      return Object.keys(copy).length > 0 ? copy : null;
    }
    return null;
  }

  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>), notes: trimmed };
  }

  return { notes: trimmed };
};

const ensureIsoString = (value?: string | Date | null): string => {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const maybeDate = new Date(value);
  if (!Number.isNaN(maybeDate.getTime())) {
    return maybeDate.toISOString();
  }

  return value;
};

const parseDurationToMinutes = (duration?: string | null): number | null => {
  if (!duration) {
    return null;
  }

  const isoMatch = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (isoMatch) {
    const hours = isoMatch[1] ? parseInt(isoMatch[1], 10) : 0;
    const minutes = isoMatch[2] ? parseInt(isoMatch[2], 10) : 0;
    return hours * 60 + minutes;
  }

  const parts = duration.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m?/i);
  if (parts) {
    const hours = parts[1] ? parseInt(parts[1], 10) : 0;
    const minutes = parts[2] ? parseInt(parts[2], 10) : 0;
    return hours * 60 + minutes;
  }

  const numeric = parseInt(duration, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

const getSearchFlightKey = (flight: any): string => {
  const identifierParts = [
    flight?.id,
    flight?.flightNumber,
    flight?.departure?.time || flight?.departureTime,
    flight?.arrival?.time || flight?.arrivalTime,
  ].filter(Boolean);

  if (identifierParts.length === 0) {
    return JSON.stringify(flight);
  }

  return identifierParts.join("-");
};

const getComparableFlightKey = (flight: any): string => {
  const number = (flight?.flightNumber || flight?.number || flight?.id || "")
    ?.toString()
    .trim();
  const departure = (flight?.departure?.time || flight?.departureTime || "")
    ?.toString()
    .trim();
  const arrival = (flight?.arrival?.time || flight?.arrivalTime || "")
    ?.toString()
    .trim();
  const origin = (
    flight?.departure?.iataCode ||
    flight?.departureCode ||
    flight?.origin ||
    flight?.from
  )
    ?.toString()
    .trim();
  const destination = (
    flight?.arrival?.iataCode ||
    flight?.arrivalCode ||
    flight?.destination ||
    flight?.to
  )
    ?.toString()
    .trim();

  const parts = [number, departure, arrival, origin, destination].filter(
    (part) => typeof part === "string" && part.length > 0,
  );

  if (parts.length === 0) {
    return JSON.stringify(flight);
  }

  return parts.join("|#|");
};

const TRIP_ADMIN_ROLES = new Set(["admin", "owner", "organizer"]);

type FlightOwnershipCandidate = Partial<FlightWithDetails> & {
  user?: Partial<User> | null;
  createdBy?: string | null;
  created_by?: string | null;
};

type DeleteFlightResponse = {
  success?: boolean;
  removedProposalIds?: number[];
  remainingProposalIds?: number[];
};

const getFlightCreatorId = (flight: FlightOwnershipCandidate): string | null => {
  if (typeof flight.userId === "string" && flight.userId) {
    return flight.userId;
  }

  if (flight.user && typeof flight.user.id === "string" && flight.user.id) {
    return flight.user.id;
  }

  if (typeof flight.createdBy === "string" && flight.createdBy) {
    return flight.createdBy;
  }

  if (typeof flight.created_by === "string" && flight.created_by) {
    return flight.created_by;
  }

  return null;
};

const isUserTripAdmin = (
  trip: TripWithDetails | null | undefined,
  userId: string | null | undefined,
): boolean => {
  if (!trip || !userId) {
    return false;
  }

  if (trip.createdBy === userId) {
    return true;
  }

  const membership = trip.members?.find((member) => member.userId === userId);
  if (!membership) {
    return false;
  }

  return TRIP_ADMIN_ROLES.has(membership.role);
};

const getFlightPermissions = (
  flight: FlightOwnershipCandidate,
  trip: TripWithDetails | null | undefined,
  currentUserId: string | null | undefined,
) => {
  const creatorId = getFlightCreatorId(flight);
  const isCreator = Boolean(currentUserId && creatorId && creatorId === currentUserId);
  const admin = isUserTripAdmin(trip, currentUserId);
  const canManageStatus = Boolean(currentUserId && (isCreator || admin));

  return {
    canEdit: isCreator,
    canDelete: isCreator,
    canManageStatus,
    isCreator,
    isAdminOverride: Boolean(admin && !isCreator),
  };
};

const AIRLINE_IATA_MAP: Record<string, string> = {
  'AA': 'American Airlines',
  'DL': 'Delta Air Lines',
  'UA': 'United Airlines',
  'SW': 'Southwest Airlines',
  'AS': 'Alaska Airlines',
  'B6': 'JetBlue Airways',
  'F9': 'Frontier Airlines',
  'NK': 'Spirit Airlines',
  'G4': 'Allegiant Air',
  'SY': 'Sun Country Airlines',
  'WN': 'Southwest Airlines',
  'VS': 'Virgin Atlantic',
  'BA': 'British Airways',
  'LH': 'Lufthansa',
  'AF': 'Air France',
  'KL': 'KLM',
  'IB': 'Iberia',
  'LX': 'Swiss International',
  'OS': 'Austrian Airlines',
  'SK': 'SAS',
  'AY': 'Finnair',
  'TP': 'TAP Air Portugal',
  'EI': 'Aer Lingus',
  'EY': 'Etihad Airways',
  'QR': 'Qatar Airways',
  'EK': 'Emirates',
  'TK': 'Turkish Airlines',
  'SV': 'Saudi Arabian Airlines',
  'MS': 'EgyptAir',
  'ET': 'Ethiopian Airlines',
  'KE': 'Korean Air',
  'SA': 'South African Airways',
  'JL': 'Japan Airlines',
  'NH': 'All Nippon Airways',
    'CX': 'Cathay Pacific',
    'SQ': 'Singapore Airlines',
    'TG': 'Thai Airways',
    'MH': 'Malaysia Airlines',
    'PR': 'Philippine Airlines',
    'CI': 'China Airlines',
    'BR': 'EVA Air',
    'OZ': 'Asiana Airlines',
    'VN': 'Vietnam Airlines',
    'CA': 'Air China',
    'MU': 'China Eastern',
    'CZ': 'China Southern',
    'AI': 'Air India',
    '6E': 'IndiGo',
    'SG': 'SpiceJet',
    'UK': 'Vistara',
    'I5': 'AirAsia India',
    'QF': 'Qantas',
    'JQ': 'Jetstar',
    'VA': 'Virgin Australia',
    'NZ': 'Air New Zealand',
    'LA': 'LATAM Airlines',
    'AR': 'Aerolíneas Argentinas',
    'G3': 'Gol Linhas Aéreas',
    'JJ': 'TAM Airlines',
    'CM': 'Copa Airlines',
    'AV': 'Avianca',
    'AC': 'Air Canada',
    'WS': 'WestJet'
};

// Helper function to get airline name from code
function getAirlineName(airlineCode: string): string {
  return AIRLINE_IATA_MAP[airlineCode] || airlineCode;
}

type TripType = "oneway" | "roundtrip";
type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

const kayakCabinMap: Record<CabinClass, string> = {
  ECONOMY: "e",
  PREMIUM_ECONOMY: "p",
  BUSINESS: "b",
  FIRST: "f",
};

const expediaCabinMap: Record<CabinClass, string> = {
  ECONOMY: "economy",
  PREMIUM_ECONOMY: "premium_economy",
  BUSINESS: "business",
  FIRST: "first",
};

interface FlightFormState {
  flightNumber: string;
  airline: string;
  airlineCode: string;
  departureAirport: string;
  departureCode: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalCode: string;
  arrivalTime: string;
  price: string;
  seatClass: string;
  flightType: string;
  bookingReference: string;
  aircraft: string;
  status: string;
}

interface FlightSearchFormState {
  departure: string;
  departureCity: string;
  departureLatitude: number | null;
  departureLongitude: number | null;
  arrival: string;
  arrivalCity: string;
  arrivalLatitude: number | null;
  arrivalLongitude: number | null;
  departureDate: string;
  returnDate: string;
  passengers: string;
  airline: string;
  tripType: TripType;
  cabinClass: CabinClass;
}

type FlightFilterKey = "best" | "cheapest" | "fastest";
type FlightSearchTrigger = "manual" | "auto";

interface FlightFilterCounts {
  best: number;
  cheapest: number;
  fastest: number;
}

interface FlightSearchFilterResults {
  best: any[];
  cheapest: any[];
  fastest: any[];
}

interface CachedFlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  originCode?: string;
  destinationCode?: string;
  tripType: TripType;
  cabinClass: CabinClass;
}

interface FlightSearchPanelProps {
  searchFormData: FlightSearchFormState;
  setSearchFormData: Dispatch<SetStateAction<FlightSearchFormState>>;
  onSearch: (trigger?: FlightSearchTrigger) => Promise<void>;
  isSearching: boolean;
  activeFilter: FlightFilterKey;
  filterLoading: boolean;
  filterResultCounts: FlightFilterCounts;
  filterResults: FlightSearchFilterResults;
  searchResults: any[];
  onFilterChange: (filter: FlightFilterKey) => void;
  cachedSearchParams: CachedFlightSearchParams | null;
  onShareFlight: (flight: any) => Promise<void>;
  onQuickAddFlight: (flight: any) => Promise<void>;
  user?: User | null;
  trip?: TripWithDetails | null;
  autoSearch?: boolean;
  isAddingFlight: boolean;
  addingFlightKey: string | null;
  tripFlights: FlightWithDetails[];
}

type ManualFlightPayload = InsertFlight & {
  departureTimeIso: string;
  arrivalTimeIso: string;
  priceCents: number | null;
  direction: 'OUTBOUND' | 'RETURN';
};

interface ManualFlightFormState {
  airlineFlight: string;
  direction: 'OUTBOUND' | 'RETURN';
  from: string;
  to: string;
  departure: string;
  arrival: string;
  cabin: CabinClass;
  notes: string;
}

interface ManualFlightFormErrors {
  airlineFlight?: string;
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
}

function FlightSearchPanel({
  searchFormData,
  setSearchFormData,
  onSearch,
  isSearching,
  activeFilter,
  filterLoading,
  filterResultCounts,
  filterResults,
  searchResults,
  onFilterChange,
  cachedSearchParams,
  onShareFlight,
  onQuickAddFlight,
  user,
  trip,
  autoSearch = false,
  isAddingFlight,
  addingFlightKey,
  tripFlights,
}: FlightSearchPanelProps) {
  const { toast } = useToast();
  const fromInputRef = useRef<HTMLInputElement>(null);
  const hasAutoSearchedRef = useRef(false);
  const [departureLocation, setDepartureLocation] = useState<LocationResult | null>(null);
  const [arrivalLocation, setArrivalLocation] = useState<LocationResult | null>(null);
  const [departureAirports, setDepartureAirports] = useState<NearbyAirport[]>([]);
  const [arrivalAirports, setArrivalAirports] = useState<NearbyAirport[]>([]);
  const [isLoadingDepartureAirports, setIsLoadingDepartureAirports] = useState(false);
  const [isLoadingArrivalAirports, setIsLoadingArrivalAirports] = useState(false);
  const [selectedDepartureAirport, setSelectedDepartureAirport] = useState(searchFormData.departure);
  const [selectedArrivalAirport, setSelectedArrivalAirport] = useState(searchFormData.arrival);
  const [expandedResultKey, setExpandedResultKey] = useState<string | null>(null);
  const currentUserId = user?.id ?? null;

  const savedFlightKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const flight of tripFlights) {
      keys.add(getComparableFlightKey(flight));
    }
    return keys;
  }, [tripFlights]);

  const filterOutSavedFlights = useCallback(
    (flights: any[] | undefined | null) => {
      if (!Array.isArray(flights)) {
        return [] as any[];
      }

      return flights.filter((flight) => {
        const key = getComparableFlightKey(flight);
        return !savedFlightKeys.has(key);
      });
    },
    [savedFlightKeys],
  );

  const visibleSearchResults = useMemo(
    () => filterOutSavedFlights(searchResults),
    [filterOutSavedFlights, searchResults],
  );

  const visibleFilterResults = useMemo(() => {
    return {
      best: filterOutSavedFlights(filterResults.best),
      cheapest: filterOutSavedFlights(filterResults.cheapest),
      fastest: filterOutSavedFlights(filterResults.fastest),
    };
  }, [filterOutSavedFlights, filterResults.best, filterResults.cheapest, filterResults.fastest]);

  const visibleFilterCounts = useMemo(() => {
    const adjustCount = (originalCount: number, originalList: any[], filteredList: any[]) => {
      if (!Array.isArray(originalList) || originalList.length === 0) {
        return originalCount;
      }

      const removed = originalList.length - filteredList.length;
      const base = typeof originalCount === "number" ? originalCount : originalList.length;
      return Math.max(0, base - removed);
    };

    return {
      best: adjustCount(filterResultCounts.best, filterResults.best, visibleFilterResults.best),
      cheapest: adjustCount(
        filterResultCounts.cheapest,
        filterResults.cheapest,
        visibleFilterResults.cheapest,
      ),
      fastest: adjustCount(
        filterResultCounts.fastest,
        filterResults.fastest,
        visibleFilterResults.fastest,
      ),
    };
  }, [
    filterResultCounts.best,
    filterResultCounts.cheapest,
    filterResultCounts.fastest,
    filterResults.best,
    filterResults.cheapest,
    filterResults.fastest,
    visibleFilterResults.best,
    visibleFilterResults.cheapest,
    visibleFilterResults.fastest,
  ]);

  const createLocationFromForm = (direction: 'departure' | 'arrival'): LocationResult | null => {
    const code = direction === 'departure' ? searchFormData.departure : searchFormData.arrival;
    const city = direction === 'departure' ? searchFormData.departureCity : searchFormData.arrivalCity;
    const latitude = direction === 'departure' ? searchFormData.departureLatitude : searchFormData.arrivalLatitude;
    const longitude = direction === 'departure' ? searchFormData.departureLongitude : searchFormData.arrivalLongitude;

    const name = city || code;
    if (!name) {
      return null;
    }

    const normalizedCode = typeof code === 'string' && code.trim().length > 0 ? code.trim().toUpperCase() : undefined;
    const type: LocationResult["type"] = normalizedCode ? 'AIRPORT' : 'CITY';

    return {
      id: `${direction}-${normalizedCode ?? name}`,
      name,
      type,
      iataCode: normalizedCode,
      icaoCode: undefined,
      cityCode: undefined,
      countryCode: undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      detailedName: name,
      relevance: 0,
      displayName: name,
      region: undefined,
      timeZone: undefined,
      currencyCode: undefined,
      isPopular: false,
      alternativeNames: [],
      code: normalizedCode,
      label: undefined,
      cityName: city ?? name,
      countryName: null,
      country: null,
      airports: undefined,
      distanceKm: null,
    };
  };

  useEffect(() => {
    const nextLocation = createLocationFromForm('departure');
    setDepartureLocation((previous) => {
      if (!nextLocation) {
        return null;
      }

      if (previous) {
        const previousCode = normaliseCode(previous.iataCode ?? previous.code ?? previous.cityCode);
        const nextCode = normaliseCode(nextLocation.iataCode ?? nextLocation.code ?? nextLocation.cityCode);

        if (previousCode && nextCode && previousCode === nextCode) {
          return previous;
        }

        if (!previousCode && !nextCode) {
          const prevName = (previous.displayName || previous.name || '').toLowerCase();
          const nextName = (nextLocation.displayName || nextLocation.name || '').toLowerCase();
          if (prevName && prevName === nextName) {
            return previous;
          }
        }
      }

      return nextLocation;
    });
  }, [
    searchFormData.departure,
    searchFormData.departureCity,
    searchFormData.departureLatitude,
    searchFormData.departureLongitude,
  ]);

  useEffect(() => {
    const nextLocation = createLocationFromForm('arrival');
    setArrivalLocation((previous) => {
      if (!nextLocation) {
        return null;
      }

      if (previous) {
        const previousCode = normaliseCode(previous.iataCode ?? previous.code ?? previous.cityCode);
        const nextCode = normaliseCode(nextLocation.iataCode ?? nextLocation.code ?? nextLocation.cityCode);

        if (previousCode && nextCode && previousCode === nextCode) {
          return previous;
        }

        if (!previousCode && !nextCode) {
          const prevName = (previous.displayName || previous.name || '').toLowerCase();
          const nextName = (nextLocation.displayName || nextLocation.name || '').toLowerCase();
          if (prevName && prevName === nextName) {
            return previous;
          }
        }
      }

      return nextLocation;
    });
  }, [
    searchFormData.arrival,
    searchFormData.arrivalCity,
    searchFormData.arrivalLatitude,
    searchFormData.arrivalLongitude,
  ]);

  useEffect(() => {
    setSelectedDepartureAirport(searchFormData.departure || '');
  }, [searchFormData.departure]);

  useEffect(() => {
    setSelectedArrivalAirport(searchFormData.arrival || '');
  }, [searchFormData.arrival]);

  useEffect(() => {
    if (!searchFormData.departureCity) {
      setDepartureAirports([]);
    }
  }, [searchFormData.departureCity]);

  useEffect(() => {
    if (!searchFormData.arrivalCity) {
      setArrivalAirports([]);
    }
  }, [searchFormData.arrivalCity]);

  const formatAirportLabel = (airport: NearbyAirport) => {
    const distanceSegment =
      typeof airport.distanceKm === 'number'
        ? ` · ${airport.distanceKm.toFixed(1)} km`
        : '';
    return `${airport.name} (${airport.iata})${distanceSegment}`;
  };

  const normaliseCode = (value?: string | null) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim().toUpperCase() : '';

  const resolveCityName = (location: LocationResult): string => {
    if (location.cityName && location.cityName.trim().length > 0) {
      return location.cityName.trim();
    }
    if (location.displayName && location.displayName.trim().length > 0) {
      return location.displayName.trim();
    }
    if (location.name && location.name.trim().length > 0) {
      return location.name.trim();
    }
    if (location.detailedName && location.detailedName.trim().length > 0) {
      const parts = location.detailedName
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (parts.length > 0) {
        return parts[0];
      }
      return location.detailedName.trim();
    }
    return location.displayName || location.name || '';
  };

  const handleDepartureLocationChange = async (location: LocationResult | null) => {
    if (!location) {
      setDepartureLocation(null);
      setDepartureAirports([]);
      setSelectedDepartureAirport('');
      setSearchFormData((prev) => ({
        ...prev,
        departure: '',
        departureCity: '',
        departureLatitude: null,
        departureLongitude: null,
      }));
      return;
    }

    setDepartureLocation(location);

    const { latitude, longitude } = extractCoordinates(location);
    const selectedAirportCode =
      normaliseCode(location.iataCode) ||
      normaliseCode(location.icaoCode) ||
      normaliseCode(location.code);

    const fallbackCityName = resolveCityName(location);
    const isoCountry =
      normaliseCode(location.countryCode) ||
      (location.countryName ? location.countryName : location.country ?? null);

    const applyAirportSelection = (airports: NearbyAirport[], cityNameOverride?: string) => {
      setDepartureAirports(airports);
      const defaultAirport = airports[0] ?? null;
      const defaultCode = defaultAirport?.iata ?? selectedAirportCode;
      setSelectedDepartureAirport(defaultCode ?? '');
      setSearchFormData((prev) => ({
        ...prev,
        departure: defaultCode ?? '',
        departureCity: cityNameOverride ?? fallbackCityName,
        departureLatitude: latitude,
        departureLongitude: longitude,
      }));
    };

    if (location.type === 'AIRPORT') {
      const airportDetails: NearbyAirport | null = selectedAirportCode
        ? {
            iata: selectedAirportCode,
            name: location.name,
            municipality: fallbackCityName || null,
            isoCountry: typeof isoCountry === 'string' && isoCountry.length === 2 ? isoCountry : null,
            latitude,
            longitude,
            distanceKm: typeof location.distanceKm === 'number' ? location.distanceKm : null,
          }
        : null;

      applyAirportSelection(airportDetails ? [airportDetails] : []);
      return;
    }

    setIsLoadingDepartureAirports(true);

    try {
      const lookup = await fetchNearestAirportsForLocation({
        ...location,
        cityName: fallbackCityName,
        countryName: typeof isoCountry === 'string' ? isoCountry : location.countryName ?? null,
      });
      applyAirportSelection(lookup.airports, lookup.cityName ?? fallbackCityName);

      setSearchFormData((prev) => ({
        ...prev,
        departure: lookup.airports[0]?.iata ?? '',
        departureCity: lookup.cityName ?? fallbackCityName,
        departureLatitude: lookup.latitude,
        departureLongitude: lookup.longitude,
      }));

      if (lookup.airports.length === 0) {
        toast({
          title: 'No nearby airports found',
          description: `We couldn't find commercial airports near ${lookup.cityName ?? (fallbackCityName || 'this city')}. Try another city.`,
        });
      }
    } catch (error) {
      console.error('Failed to load nearest departure airports:', error);
      setDepartureAirports([]);
      setSelectedDepartureAirport('');
      setSearchFormData((prev) => ({
        ...prev,
        departure: '',
        departureCity: fallbackCityName,
        departureLatitude: latitude,
        departureLongitude: longitude,
      }));
      toast({
        title: 'Airport lookup failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to find airports for this city. Please try a different search.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDepartureAirports(false);
    }
  };

  const handleArrivalLocationChange = async (location: LocationResult | null) => {
    if (!location) {
      setArrivalLocation(null);
      setArrivalAirports([]);
      setSelectedArrivalAirport('');
      setSearchFormData((prev) => ({
        ...prev,
        arrival: '',
        arrivalCity: '',
        arrivalLatitude: null,
        arrivalLongitude: null,
      }));
      return;
    }

    setArrivalLocation(location);

    const { latitude, longitude } = extractCoordinates(location);
    const selectedAirportCode =
      normaliseCode(location.iataCode) ||
      normaliseCode(location.icaoCode) ||
      normaliseCode(location.code);

    const fallbackCityName = resolveCityName(location);
    const isoCountry =
      normaliseCode(location.countryCode) ||
      (location.countryName ? location.countryName : location.country ?? null);

    const applyAirportSelection = (airports: NearbyAirport[], cityNameOverride?: string) => {
      setArrivalAirports(airports);
      const defaultAirport = airports[0] ?? null;
      const defaultCode = defaultAirport?.iata ?? selectedAirportCode;
      setSelectedArrivalAirport(defaultCode ?? '');
      setSearchFormData((prev) => ({
        ...prev,
        arrival: defaultCode ?? '',
        arrivalCity: cityNameOverride ?? fallbackCityName,
        arrivalLatitude: latitude,
        arrivalLongitude: longitude,
      }));
    };

    if (location.type === 'AIRPORT') {
      const airportDetails: NearbyAirport | null = selectedAirportCode
        ? {
            iata: selectedAirportCode,
            name: location.name,
            municipality: fallbackCityName || null,
            isoCountry: typeof isoCountry === 'string' && isoCountry.length === 2 ? isoCountry : null,
            latitude,
            longitude,
            distanceKm: typeof location.distanceKm === 'number' ? location.distanceKm : null,
          }
        : null;

      applyAirportSelection(airportDetails ? [airportDetails] : []);
      return;
    }

    setIsLoadingArrivalAirports(true);

    try {
      const lookup = await fetchNearestAirportsForLocation({
        ...location,
        cityName: fallbackCityName,
        countryName: typeof isoCountry === 'string' ? isoCountry : location.countryName ?? null,
      });
      applyAirportSelection(lookup.airports, lookup.cityName ?? fallbackCityName);

      setSearchFormData((prev) => ({
        ...prev,
        arrival: lookup.airports[0]?.iata ?? '',
        arrivalCity: lookup.cityName ?? fallbackCityName,
        arrivalLatitude: lookup.latitude,
        arrivalLongitude: lookup.longitude,
      }));

      if (lookup.airports.length === 0) {
        toast({
          title: 'No nearby airports found',
          description: `We couldn't find commercial airports near ${lookup.cityName ?? (fallbackCityName || 'this city')}. Try another city.`,
        });
      }
    } catch (error) {
      console.error('Failed to load nearest arrival airports:', error);
      setArrivalAirports([]);
      setSelectedArrivalAirport('');
      setSearchFormData((prev) => ({
        ...prev,
        arrival: '',
        arrivalCity: fallbackCityName,
        arrivalLatitude: latitude,
        arrivalLongitude: longitude,
      }));
      toast({
        title: 'Airport lookup failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to find airports for this city. Please try a different search.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingArrivalAirports(false);
    }
  };

  const handleDepartureAirportChange = (iata: string) => {
    const value = iata.toUpperCase();
    setSelectedDepartureAirport(value);
    setSearchFormData((prev) => ({
      ...prev,
      departure: value,
    }));
  };

  const handleArrivalAirportChange = (iata: string) => {
    const value = iata.toUpperCase();
    setSelectedArrivalAirport(value);
    setSearchFormData((prev) => ({
      ...prev,
      arrival: value,
    }));
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSearch("manual");
  };

  useEffect(() => {
    fromInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!autoSearch || hasAutoSearchedRef.current) {
      return;
    }

    if (searchFormData.departure && searchFormData.arrival && searchFormData.departureDate) {
      hasAutoSearchedRef.current = true;
      void onSearch("auto");
    }
  }, [autoSearch, onSearch, searchFormData.arrival, searchFormData.departure, searchFormData.departureDate]);

  return (
    <section className="rounded-2xl border bg-background p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Search flights</h2>
          <p className="text-sm text-muted-foreground">
            {trip?.name
              ? `Find flights for ${trip.name}.`
              : "Search flights for your upcoming trip."}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-col gap-6">
          <div className="order-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Flights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="departure">From</Label>
                    <LocationSearch
                      ref={fromInputRef}
                      placeholder="Search departure city or airport"
                      value={departureLocation}
                      onChange={handleDepartureLocationChange}
                      type="CITY"
                    />
                    {isLoadingDepartureAirports && (
                      <p className="text-xs text-muted-foreground">Loading nearby airports…</p>
                    )}
                    {!isLoadingDepartureAirports &&
                      departureAirports.length === 0 &&
                      searchFormData.departureCity && (
                        <p className="text-xs text-muted-foreground">
                          No nearby commercial airports found. Try a different city.
                        </p>
                      )}
                    {departureAirports.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">Departure airport</Label>
                        <Select
                          value={selectedDepartureAirport}
                          onValueChange={handleDepartureAirportChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a departure airport" />
                          </SelectTrigger>
                          <SelectContent>
                            {departureAirports.map((airport) => (
                              <SelectItem key={airport.iata} value={airport.iata}>
                                {formatAirportLabel(airport)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!user?.defaultLocation &&
                      !user?.defaultLocationCode &&
                      !searchFormData.departure && (
                        <p className="text-xs text-muted-foreground">
                          Save a default departure location in your profile to fill this automatically next time.
                        </p>
                      )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival">To</Label>
                    <LocationSearch
                      placeholder="Search arrival city or airport"
                      value={arrivalLocation}
                      onChange={handleArrivalLocationChange}
                      type="CITY"
                    />
                    {isLoadingArrivalAirports && (
                      <p className="text-xs text-muted-foreground">Loading nearby airports…</p>
                    )}
                    {!isLoadingArrivalAirports &&
                      arrivalAirports.length === 0 &&
                      searchFormData.arrivalCity && (
                        <p className="text-xs text-muted-foreground">
                          No nearby commercial airports found. Try a different city.
                        </p>
                      )}
                    {arrivalAirports.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">Arrival airport</Label>
                        <Select value={selectedArrivalAirport} onValueChange={handleArrivalAirportChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select an arrival airport" />
                          </SelectTrigger>
                          <SelectContent>
                            {arrivalAirports.map((airport) => (
                              <SelectItem key={airport.iata} value={airport.iata}>
                                {formatAirportLabel(airport)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="departureDate">Departure</Label>
                    <Input
                      id="departureDate"
                      type="date"
                      value={searchFormData.departureDate}
                      onChange={(e) => setSearchFormData((prev) => ({ ...prev, departureDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="returnDate">Return (Optional)</Label>
                    <Input
                      id="returnDate"
                      type="date"
                      value={searchFormData.tripType === "roundtrip" ? searchFormData.returnDate : ""}
                      onChange={(e) =>
                        setSearchFormData((prev) => ({
                          ...prev,
                          returnDate: e.target.value,
                          tripType: e.target.value ? "roundtrip" : prev.tripType,
                        }))
                      }
                      disabled={searchFormData.tripType === "oneway"}
                    />
                    {searchFormData.tripType === "oneway" && (
                      <p className="mt-1 text-xs text-muted-foreground">Return date not required for one-way trips.</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label htmlFor="passengers">Passengers</Label>
                    <Select
                      value={searchFormData.passengers}
                      onValueChange={(value) => setSearchFormData((prev) => ({ ...prev, passengers: value }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? "passenger" : "passengers"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[12rem]">
                    <Label>Trip Type</Label>
                    <ToggleGroup
                      type="single"
                      value={searchFormData.tripType}
                      onValueChange={(value) => {
                        if (!value) return;
                        setSearchFormData((prev) => ({
                          ...prev,
                          tripType: value as TripType,
                          returnDate: value === "oneway" ? "" : prev.returnDate,
                        }));
                      }}
                      className="justify-start"
                      size="sm"
                    >
                      <ToggleGroupItem value="oneway" className="flex-1 px-3">
                        One-way
                      </ToggleGroupItem>
                      <ToggleGroupItem value="roundtrip" className="flex-1 px-3">
                        Round-trip
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div>
                    <Label htmlFor="tripType">Trip Type</Label>
                    <Select
                      value={searchFormData.tripType}
                      onValueChange={(value) =>
                        setSearchFormData((prev) => ({
                          ...prev,
                          tripType: value as TripType,
                          returnDate: value === "oneway" ? "" : prev.returnDate,
                        }))
                      }
                    >
                      <SelectTrigger id="tripType" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roundtrip">Round-trip</SelectItem>
                        <SelectItem value="oneway">One-way</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="airline">Airline</Label>
                    <Select
                      value={searchFormData.airline}
                      onValueChange={(value) => setSearchFormData((prev) => ({ ...prev, airline: value }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Any airline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Airline</SelectItem>
                        <SelectItem value="AA">American Airlines</SelectItem>
                        <SelectItem value="DL">Delta Air Lines</SelectItem>
                        <SelectItem value="UA">United Airlines</SelectItem>
                        <SelectItem value="SW">Southwest Airlines</SelectItem>
                        <SelectItem value="AS">Alaska Airlines</SelectItem>
                        <SelectItem value="B6">JetBlue Airways</SelectItem>
                        <SelectItem value="F9">Frontier Airlines</SelectItem>
                        <SelectItem value="NK">Spirit Airlines</SelectItem>
                        <SelectItem value="G4">Allegiant Air</SelectItem>
                        <SelectItem value="VS">Virgin Atlantic</SelectItem>
                        <SelectItem value="BA">British Airways</SelectItem>
                        <SelectItem value="LH">Lufthansa</SelectItem>
                        <SelectItem value="AF">Air France</SelectItem>
                        <SelectItem value="KL">KLM</SelectItem>
                        <SelectItem value="IB">Iberia</SelectItem>
                        <SelectItem value="OS">Austrian Airlines</SelectItem>
                        <SelectItem value="EY">Etihad Airways</SelectItem>
                        <SelectItem value="QR">Qatar Airways</SelectItem>
                        <SelectItem value="EK">Emirates</SelectItem>
                        <SelectItem value="TK">Turkish Airlines</SelectItem>
                        <SelectItem value="JL">Japan Airlines</SelectItem>
                        <SelectItem value="NH">All Nippon Airways</SelectItem>
                        <SelectItem value="CX">Cathay Pacific</SelectItem>
                        <SelectItem value="SQ">Singapore Airlines</SelectItem>
                        <SelectItem value="AC">Air Canada</SelectItem>
                        <SelectItem value="WS">WestJet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cabinClass">Cabin Class</Label>
                    <Select
                      value={searchFormData.cabinClass}
                      onValueChange={(value) =>
                        setSearchFormData((prev) => ({
                          ...prev,
                          cabinClass: value as CabinClass,
                        }))
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ECONOMY">Economy</SelectItem>
                        <SelectItem value="PREMIUM_ECONOMY">Premium Economy</SelectItem>
                        <SelectItem value="BUSINESS">Business</SelectItem>
                        <SelectItem value="FIRST">First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching}
                    className="px-8"
                  >
                    {isSearching ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search Flights
                      </>
                    )}
                  </Button>
                </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {(visibleSearchResults.length > 0 ||
            visibleFilterResults.best.length > 0 ||
            visibleFilterResults.cheapest.length > 0 ||
            visibleFilterResults.fastest.length > 0) && (
            <div className="order-2">
              <div className="max-h-[60vh] overflow-auto pr-1">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Flight Search Results
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={activeFilter === "best" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onFilterChange("best")}
                          disabled={filterLoading}
                          className={`relative ${activeFilter === "best" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                          data-testid="filter-best"
                        >
                          {filterLoading && activeFilter === "best" && (
                            <div className="absolute inset-0 flex items-center justify-center rounded bg-blue-600">
                              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                            </div>
                          )}
                          🏆 Best
                          {visibleFilterCounts.best > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {visibleFilterCounts.best}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          variant={activeFilter === "cheapest" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onFilterChange("cheapest")}
                          disabled={filterLoading}
                          className={`relative ${activeFilter === "cheapest" ? "bg-green-600 text-white" : "hover:bg-green-50"}`}
                          data-testid="filter-cheapest"
                        >
                          {filterLoading && activeFilter === "cheapest" && (
                            <div className="absolute inset-0 flex items-center justify-center rounded bg-green-600">
                              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                            </div>
                          )}
                          💰 Cheapest
                          {visibleFilterCounts.cheapest > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {visibleFilterCounts.cheapest}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          variant={activeFilter === "fastest" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onFilterChange("fastest")}
                          disabled={filterLoading}
                          className={`relative ${activeFilter === "fastest" ? "bg-purple-600 text-white" : "hover:bg-purple-50"}`}
                          data-testid="filter-fastest"
                        >
                          {filterLoading && activeFilter === "fastest" && (
                            <div className="absolute inset-0 flex items-center justify-center rounded bg-purple-600">
                              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                            </div>
                          )}
                          ⚡ Fastest
                          {visibleFilterCounts.fastest > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {visibleFilterCounts.fastest}
                            </Badge>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const candidateResults =
                        visibleFilterResults[activeFilter].length > 0
                          ? visibleFilterResults[activeFilter]
                          : visibleSearchResults;
                      const currentResults = candidateResults;
                      if (currentResults.length === 0) {
                        return (
                          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-4 text-sm text-muted-foreground">
                            All flights from your latest search are already saved to this trip.
                          </div>
                        );
                      }

                      const flightCount = currentResults.length;
                      const prices = currentResults
                        .map((f: any) => f.price || f.totalPrice || 0)
                        .filter((p: number) => p > 0);
                      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

                      const durations = currentResults
                        .map((f: any) => {
                          if (!f.duration) return 0;
                          const hours = f.duration.match(/(\d+)h/)?.[1] || "0";
                          const minutes = f.duration.match(/(\d+)m/)?.[1] || "0";
                          return parseInt(hours) * 60 + parseInt(minutes);
                        })
                        .filter((d: number) => d > 0);

                      const avgDuration =
                        durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;
                      const avgHours = Math.floor(avgDuration / 60);
                      const avgMinutes = avgDuration % 60;

                      return (
                        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-700 dark:text-gray-300">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{flightCount}</span>
                                <span>flights found</span>
                              </div>
                              {prices.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">Price range:</span>
                                  <span className="font-medium">
                                    ${minPrice}
                                    {minPrice !== maxPrice && ` - $${maxPrice}`}
                                  </span>
                                </div>
                              )}
                              {avgDuration > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">Avg. flight time:</span>
                                  <span className="font-medium">{avgHours}h {avgMinutes}m</span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Filter: {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
                              {activeFilter === "best" && " (balanced price & time)"}
                              {activeFilter === "cheapest" && " (lowest price first)"}
                              {activeFilter === "fastest" && " (shortest duration first)"}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <Accordion
                      type="single"
                      collapsible
                      value={expandedResultKey ?? undefined}
                      onValueChange={(value) => setExpandedResultKey(value || null)}
                      className="space-y-3"
                    >
                      {currentResults.map(
                        (flight: any, index: number) => {
                          const normalizedPriceSource = flight.price ?? flight.totalPrice;
                          const priceLabel = formatPriceDisplay(normalizedPriceSource, flight.currency);
                          const hasNumericPrice = parseNumericAmount(normalizedPriceSource) !== null;
                          const flightKey = getComparableFlightKey(flight) || `flight-${index}`;
                          const departureCode =
                            flight.departure?.iataCode ||
                            flight.departureCode ||
                            cachedSearchParams?.originCode ||
                            extractAirportCode(cachedSearchParams?.origin) ||
                            extractAirportCode(searchFormData.departure) ||
                            searchFormData.departure;
                          const arrivalCode =
                            flight.arrival?.iataCode ||
                            flight.arrivalCode ||
                            cachedSearchParams?.destinationCode ||
                            extractAirportCode(cachedSearchParams?.destination) ||
                            extractAirportCode(searchFormData.arrival) ||
                            searchFormData.arrival;
                          const summaryDepartureCode =
                            typeof departureCode === "string" && departureCode
                              ? departureCode.toUpperCase()
                              : "Origin";
                          const summaryArrivalCode =
                            typeof arrivalCode === "string" && arrivalCode ? arrivalCode.toUpperCase() : "Destination";

                          const departureLabel =
                            flight.departure?.airport || flight.departureAirport || searchFormData.departure;
                          const arrivalLabel = flight.arrival?.airport || flight.arrivalAirport || searchFormData.arrival;

                          const formatDateTime = (value?: string) => {
                            if (!value) return null;
                            const parsed = new Date(value);
                            if (Number.isNaN(parsed.getTime())) {
                              return null;
                            }
                            return format(parsed, "MMM d, yyyy h:mm a");
                          };

                          const departureTimeLabel =
                            formatDateTime(flight.departure?.time || flight.departureTime) || "Departure time varies";
                          const arrivalTimeLabel =
                            formatDateTime(flight.arrival?.time || flight.arrivalTime) || "Arrival time varies";

                          const durationLabel = flight.duration
                            ? flight.duration.replace("PT", "").replace("H", "h ").replace("M", "m")
                            : "Duration varies";
                          const stopsLabel =
                            flight.stops !== undefined
                              ? flight.stops === 0
                                ? "Non-stop"
                                : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`
                              : null;

                          const aircraftSource = flight.aircraft ?? flight.segments?.[0]?.aircraft ?? null;
                          let aircraftLabel: string | null = null;
                          if (typeof aircraftSource === "string") {
                            aircraftLabel = aircraftSource;
                          } else if (aircraftSource && typeof aircraftSource === "object") {
                            aircraftLabel =
                              aircraftSource.code ||
                              aircraftSource.model ||
                              aircraftSource.name ||
                              (typeof aircraftSource.toString === "function" &&
                              aircraftSource.toString() !== "[object Object]"
                                ? aircraftSource.toString()
                                : null);
                          }

                          const isCurrentFlightAdding = isAddingFlight && addingFlightKey === flightKey;

                          return (
                            <AccordionItem
                              key={flightKey}
                              value={flightKey}
                              className="overflow-hidden rounded-lg border bg-card"
                            >
                              <AccordionTrigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-muted/50 [&[data-state=open]]:rounded-t-lg">
                                <div className="flex flex-col gap-2 text-left">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Plane className="h-4 w-4 text-blue-600" />
                                    <span className="font-semibold">{getFlightAirlineName(flight)}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {flight.flightNumber || `Flight ${index + 1}`}
                                    </span>
                                    <Badge className="bg-green-100 text-green-800">Available</Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {summaryDepartureCode} → {summaryArrivalCode}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {durationLabel}
                                    {stopsLabel ? ` • ${stopsLabel}` : ""}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-semibold text-green-600">{priceLabel}</div>
                                  {hasNumericPrice && <div className="text-xs text-muted-foreground">per person</div>}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pb-4">
                                <div className="grid gap-4 text-sm md:grid-cols-3">
                                  <div className="flex items-start gap-3">
                                    <PlaneTakeoff className="mt-1 h-4 w-4 text-green-600" />
                                    <div>
                                      <div className="font-medium">{departureLabel}</div>
                                      <div className="text-xs text-muted-foreground">{departureTimeLabel}</div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-center justify-center gap-1 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>{durationLabel}</span>
                                    {stopsLabel && <span>{stopsLabel}</span>}
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <PlaneLanding className="mt-1 h-4 w-4 text-red-600" />
                                    <div>
                                      <div className="font-medium">{arrivalLabel}</div>
                                      <div className="text-xs text-muted-foreground">{arrivalTimeLabel}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  {stopsLabel && <span>{stopsLabel}</span>}
                                  {flight.class && <span className="capitalize">{flight.class}</span>}
                                  {aircraftLabel && <span>Aircraft: {aircraftLabel}</span>}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                    asChild
                                    data-testid={`button-book-kayak-${index}`}
                                  >
                                    <a
                                      href={`https://www.kayak.com/flights/${cachedSearchParams?.originCode || "ATL"}-${
                                        cachedSearchParams?.destinationCode || "MIA"
                                      }/${searchFormData.departureDate}${
                                        searchFormData.tripType === "roundtrip" && searchFormData.returnDate
                                          ? `/${searchFormData.returnDate}`
                                          : ""
                                      }?sort=bestflight_a&cabin=${kayakCabinMap[searchFormData.cabinClass]}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="mr-1 h-3 w-3" />
                                      Book on Kayak
                                    </a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    asChild
                                    data-testid={`button-book-expedia-${index}`}
                                  >
                                    <a
                                      href={`https://www.expedia.com/Flights-Search?trip=${
                                        searchFormData.tripType === "roundtrip" ? "roundtrip" : "oneway"
                                      }&leg1=from:${cachedSearchParams?.originCode || "ATL"},to:${
                                        cachedSearchParams?.destinationCode || "MIA"
                                      },departure:${searchFormData.departureDate}TANYT${
                                        searchFormData.tripType === "roundtrip" && searchFormData.returnDate
                                          ? `&leg2=from:${cachedSearchParams?.destinationCode || "MIA"},to:${
                                              cachedSearchParams?.originCode || "ATL"
                                            },departure:${searchFormData.returnDate}TANYT`
                                          : ""
                                      }&cabinclass=${expediaCabinMap[searchFormData.cabinClass]}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Book on Expedia
                                    </a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onShareFlight(flight)}
                                    data-testid={`button-propose-flight-${index}`}
                                  >
                                    <Users className="mr-2 h-4 w-4" />
                                    Propose to Group
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      void onQuickAddFlight(flight);
                                    }}
                                    data-testid={`button-add-to-trip-${index}`}
                                    disabled={isAddingFlight}
                                  >
                                    {isCurrentFlightAdding ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Adding...
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add to Trip
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        },
                      )}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {visibleSearchResults.length === 0 &&
            visibleFilterResults.best.length === 0 &&
            visibleFilterResults.cheapest.length === 0 &&
            visibleFilterResults.fastest.length === 0 &&
            searchResults.length > 0 && (
              <div className="order-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-sm text-muted-foreground">
                All flights from your latest search are already saved to this trip.
              </div>
            )}

        </div>
      </div>
    </section>
  );
}


// Helper function to extract airline display name from flight data
function getFlightAirlineName(flight: any): string {
  // Handle different possible formats of airline data from API
  let airlineCode: string = '';

  // Try to get the primary airline code from various sources
  if (flight.airlines && Array.isArray(flight.airlines) && flight.airlines.length > 0) {
    // Use the first airline from the airlines array
    airlineCode = flight.airlines[0];
  } else if (flight.airline && typeof flight.airline === 'string') {
    // Use the airline field if it's a string
    airlineCode = flight.airline;
  } else if (flight.segments && Array.isArray(flight.segments) && flight.segments.length > 0) {
    // Get airline from the first segment
    airlineCode = flight.segments[0].airline || flight.segments[0].carrierCode || '';
  } else if (flight.validatingAirlineCodes && Array.isArray(flight.validatingAirlineCodes) && flight.validatingAirlineCodes.length > 0) {
    // Use validating airline codes as fallback
    airlineCode = flight.validatingAirlineCodes[0];
  }
  
  // Clean up the airline code (remove whitespace, convert to uppercase)
  airlineCode = airlineCode.toString().trim().toUpperCase();
  
  // If we have a valid airline code (2-3 characters), use the mapping
  if (airlineCode && airlineCode.length >= 2 && airlineCode.length <= 3) {
    return getAirlineName(airlineCode);
  }
  
  // If the airline code is longer, it might already be a full name
  if (airlineCode && airlineCode.length > 3) {
    return airlineCode;
  }

  // Fallback to 'Various Airlines' if we can't determine the airline
  return 'Various Airlines';
}

function getFlightAirlineCode(flight: any): string {
  const potentialCodes = [
    flight?.airlineCode,
    flight?.carrierCode,
    Array.isArray(flight?.airlines) ? flight.airlines[0] : undefined,
    Array.isArray(flight?.segments) ? flight.segments[0]?.airline || flight.segments[0]?.carrierCode : undefined,
    typeof flight?.airline === "string" && flight.airline.trim().length <= 3 ? flight.airline : undefined,
  ];

  for (const code of potentialCodes) {
    if (typeof code === "string" && code.trim().length > 0) {
      return code.trim().toUpperCase();
    }
  }

  return "UNK";
}

export default function FlightsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [location, setLocation] = useLocation();
  const [isAddFlightOpen, setIsAddFlightOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<FlightWithDetails | null>(null);
  const [autoSearchRequested, setAutoSearchRequested] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFormData, setSearchFormData] = useState<FlightSearchFormState>({
    departure: '',
    departureCity: '',
    departureLatitude: null,
    departureLongitude: null,
    arrival: '',
    arrivalCity: '',
    arrivalLatitude: null,
    arrivalLongitude: null,
    departureDate: '',
    returnDate: '',
    passengers: '1',
    airline: '',
    tripType: 'roundtrip',
    cabinClass: 'ECONOMY',
  });
  // Store cached search parameters to avoid re-triggering location searches
  const [cachedSearchParams, setCachedSearchParams] = useState<CachedFlightSearchParams | null>(null);
  const [addingFlightKey, setAddingFlightKey] = useState<string | null>(null);
  
  // Server-side filter state with caching
  const [activeFilter, setActiveFilter] = useState<'best' | 'cheapest' | 'fastest'>('best');
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterResultCounts, setFilterResultCounts] = useState({
    best: 0,
    cheapest: 0,
    fastest: 0
  });
  const [filterResults, setFilterResults] = useState({
    best: [] as any[],
    cheapest: [] as any[],
    fastest: [] as any[]
  });
  
  // Flight form state
  const defaultManualFlightForm: ManualFlightFormState = {
    airlineFlight: '',
    direction: 'OUTBOUND',
    from: '',
    to: '',
    departure: '',
    arrival: '',
    cabin: 'ECONOMY',
    notes: '',
  };
  const [manualFlightForm, setManualFlightForm] = useState<ManualFlightFormState>(defaultManualFlightForm);
  const [manualFlightErrors, setManualFlightErrors] = useState<ManualFlightFormErrors>({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const handleFlightSearch = useCallback(async (trigger: FlightSearchTrigger = "manual") => {
    if (!searchFormData.departure || !searchFormData.arrival || !searchFormData.departureDate) {
      if (trigger === "manual") {
        toast({
          title: "Missing Information",
          description: "Please fill in departure, arrival, and departure date",
          variant: "destructive",
        });
      }
      return;
    }

    setIsSearching(true);

    try {
      const isRoundTrip = searchFormData.tripType === "roundtrip";
      const normalizedReturnDate = isRoundTrip && searchFormData.returnDate
        ? searchFormData.returnDate
        : undefined;

      const response = await apiRequest("/api/search/flights", {
        method: "POST",
        body: {
          origin: searchFormData.departure,
          destination: searchFormData.arrival,
          departureDate: searchFormData.departureDate,
          returnDate: normalizedReturnDate,
          passengers: parseInt(searchFormData.passengers),
          airline: searchFormData.airline && searchFormData.airline !== "any" ? searchFormData.airline : undefined,
          class: searchFormData.cabinClass,
          tripType: searchFormData.tripType,
          provider: "both",
          page: 1,
          limit: 50,
        },
      });

      const searchResponse = await response.json();

      if (searchResponse && Array.isArray(searchResponse.flights) && searchResponse.flights.length > 0) {
        setSearchResults(searchResponse.flights);
        setCachedSearchParams({
          origin: searchFormData.departure,
          destination: searchFormData.arrival,
          departureDate: searchFormData.departureDate,
          returnDate: normalizedReturnDate,
          passengers: parseInt(searchFormData.passengers),
          originCode: searchFormData.departure.length === 3 ? searchFormData.departure : undefined,
          destinationCode: searchFormData.arrival.length === 3 ? searchFormData.arrival : undefined,
          tripType: searchFormData.tripType,
          cabinClass: searchFormData.cabinClass,
        });

        setFilterResults({
          best: searchResponse.flights,
          cheapest: [],
          fastest: [],
        });

        if (searchResponse.filters) {
          setFilterResultCounts(searchResponse.filters);
        } else {
          setFilterResultCounts({
            best: searchResponse.flights.length,
            cheapest: 0,
            fastest: 0,
          });
        }

        setActiveFilter("best");

        const totalFromSources =
          (searchResponse.sources?.amadeus || 0) +
          (searchResponse.sources?.duffel || 0) +
          (searchResponse.sources?.kayak || 0);

        if (trigger === "manual") {
          toast({
            title: "Flight Search Complete",
            description: `Found ${searchResponse.pagination?.total || searchResponse.flights.length} flights from ${totalFromSources} total sources - Amadeus: ${searchResponse.sources?.amadeus || 0}, Duffel: ${searchResponse.sources?.duffel || 0}, Kayak: ${searchResponse.sources?.kayak || 0}`,
          });
        }
      } else {
        setSearchResults([]);
        setFilterResults({
          best: [],
          cheapest: [],
          fastest: [],
        });
        setFilterResultCounts({
          best: 0,
          cheapest: 0,
          fastest: 0,
        });

        if (trigger === "manual") {
          toast({
            title: "No Flights Found",
            description: "Try adjusting your search criteria or dates",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Flight search error:", error);
      setSearchResults([]);
      if (trigger === "manual") {
        toast({
          title: "Search Failed",
          description: error?.message || "Unable to search flights. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSearching(false);

      if (trigger === "auto") {
        const [basePath, searchParams] = location.split("?");
        const params = new URLSearchParams(searchParams ?? "");
        params.delete("auto");
        const next = params.toString();
        setLocation(next ? `${basePath}?${next}` : basePath, { replace: true });
        setAutoSearchRequested(false);
      }
    }
  }, [location, searchFormData, setLocation, toast]);

  useEffect(() => {
    const [, searchParams] = location.split("?");
    const params = new URLSearchParams(searchParams ?? "");
    const shouldAutoSearch = params.get("auto") === "1";

    setAutoSearchRequested(shouldAutoSearch);
  }, [location]);

  // Handle filter switching with loading states - FIXED to prevent location searches
  const handleFilterChange = async (newFilter: 'best' | 'cheapest' | 'fastest') => {
    if (newFilter === activeFilter || filterLoading || searchResults.length === 0) return;
    
    setFilterLoading(true);
    setActiveFilter(newFilter);
    
    // If we already have results for this filter, just switch to them
    if (filterResults[newFilter].length > 0) {
      setFilterLoading(false);
      return;
    }
    
    // Use cached search parameters to avoid triggering location searches
    if (!cachedSearchParams) {
      console.warn('No cached search parameters available for filter change');
      // Apply local sorting as fallback
      const sortedResults = [...searchResults].sort((a: any, b: any) => {
        switch (newFilter) {
          case 'cheapest':
            return (a.price || a.totalPrice || 0) - (b.price || b.totalPrice || 0);
          case 'fastest':
            const getDurationMinutes = (durationStr: string) => {
              if (!durationStr) return 999999;
              const hours = durationStr.match(/(\d+)h/)?.[1] || '0';
              const minutes = durationStr.match(/(\d+)m/)?.[1] || '0';
              return parseInt(hours) * 60 + parseInt(minutes);
            };
            return getDurationMinutes(a.duration) - getDurationMinutes(b.duration);
          case 'best':
          default:
            const priceWeight = 0.6;
            const durationWeight = 0.4;
            const normalizePrice = (price: number) => Math.min(price / 1000, 1);
            const normalizeDuration = (duration: string) => {
              const minutes = getDurationMinutes(duration);
              return Math.min(minutes / 600, 1);
            };
            
            const aScore = (normalizePrice(a.price || a.totalPrice || 0) * priceWeight) + 
                         (normalizeDuration(a.duration) * durationWeight);
            const bScore = (normalizePrice(b.price || b.totalPrice || 0) * priceWeight) + 
                         (normalizeDuration(b.duration) * durationWeight);
            return aScore - bScore;
        }
      });
      
      setFilterResults(prev => ({
        ...prev,
        [newFilter]: sortedResults
      }));
      setFilterLoading(false);
      return;
    }
    
    // Use cached parameters with airport codes to prevent location searches
    try {
      const response = await apiRequest("/api/search/flights", {
        method: "POST",
        body: {
          // Use cached airport codes instead of location names to prevent location searches
          origin: cachedSearchParams.originCode || cachedSearchParams.origin,
          destination: cachedSearchParams.destinationCode || cachedSearchParams.destination,
          departureDate: cachedSearchParams.departureDate,
          returnDate:
            cachedSearchParams.tripType === "roundtrip" && cachedSearchParams.returnDate
              ? cachedSearchParams.returnDate
              : undefined,
          passengers: cachedSearchParams.passengers,
          airline: searchFormData.airline && searchFormData.airline !== 'any' ? searchFormData.airline : undefined,
          class: cachedSearchParams.cabinClass,
          tripType: cachedSearchParams.tripType,
          provider: 'both', // Use both Amadeus and Duffel providers
          filter: newFilter, // Add filter parameter
          page: 1,
          limit: 50
        }
      });

      const searchResponse = await response.json();
      console.log(`${newFilter} filter search response:`, searchResponse);
      
      if (searchResponse && searchResponse.flights && Array.isArray(searchResponse.flights) && searchResponse.flights.length > 0) {
        // Update filter results
        setFilterResults(prev => ({
          ...prev,
          [newFilter]: searchResponse.flights
        }));
        
        // Update result counts from server response
        if (searchResponse.filters) {
          setFilterResultCounts(searchResponse.filters);
        } else {
          setFilterResultCounts(prev => ({
            ...prev,
            [newFilter]: searchResponse.flights.length
          }));
        }
        
        toast({
          title: `${newFilter.charAt(0).toUpperCase() + newFilter.slice(1)} Filter Applied`,
          description: `Found ${searchResponse.flights.length} flights optimized for ${newFilter === 'best' ? 'best overall value' : newFilter === 'cheapest' ? 'lowest price' : 'shortest flight time'}`,
        });
      } else {
        // Use the current search results as fallback but apply local sorting
        const sortedResults = [...searchResults].sort((a: any, b: any) => {
          switch (newFilter) {
            case 'cheapest':
              return (a.price || a.totalPrice || 0) - (b.price || b.totalPrice || 0);
            case 'fastest':
              const getDurationMinutes = (durationStr: string) => {
                if (!durationStr) return 999999;
                const hours = durationStr.match(/(\d+)h/)?.[1] || '0';
                const minutes = durationStr.match(/(\d+)m/)?.[1] || '0';
                return parseInt(hours) * 60 + parseInt(minutes);
              };
              return getDurationMinutes(a.duration) - getDurationMinutes(b.duration);
            case 'best':
            default:
              // Best balance of price and duration
              const priceWeight = 0.6;
              const durationWeight = 0.4;
              const normalizePrice = (price: number) => Math.min(price / 1000, 1);
              const normalizeDuration = (duration: string) => {
                const minutes = getDurationMinutes(duration);
                return Math.min(minutes / 600, 1); // 10 hours = 1.0
              };
              
              const aScore = (normalizePrice(a.price || a.totalPrice || 0) * priceWeight) + 
                           (normalizeDuration(a.duration) * durationWeight);
              const bScore = (normalizePrice(b.price || b.totalPrice || 0) * priceWeight) + 
                           (normalizeDuration(b.duration) * durationWeight);
              return aScore - bScore;
          }
        });
        
        setFilterResults(prev => ({
          ...prev,
          [newFilter]: sortedResults
        }));
        
        setFilterResultCounts(prev => ({
          ...prev,
          [newFilter]: sortedResults.length
        }));
      }
    } catch (error: any) {
      console.error(`${newFilter} filter error:`, error);
      toast({
        title: "Filter Error",
        description: `Unable to apply ${newFilter} filter. Using current results.`,
        variant: "destructive",
      });
      
      // Fallback to current results with local sorting
      const sortedResults = [...searchResults];
      setFilterResults(prev => ({
        ...prev,
        [newFilter]: sortedResults
      }));
    } finally {
      setFilterLoading(false);
    }
  };

  const { data: flights, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/flights`, activeFilter], // Include filter in cache key
    enabled: !!tripId,
  });

  // Ensure flights is always an array
  const flightsArray = Array.isArray(flights) ? flights : [];

  const sortedFlights = useMemo(() => {
    return [...flightsArray].sort((a: FlightWithDetails, b: FlightWithDetails) => {
      const aTime = a?.departureTime ? new Date(a.departureTime).getTime() : Number.NaN;
      const bTime = b?.departureTime ? new Date(b.departureTime).getTime() : Number.NaN;

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    });
  }, [flightsArray]);

  const [expandedTripFlightId, setExpandedTripFlightId] = useState<string | null>(null);

  const { data: trip } = useQuery<TripWithDetails | undefined>({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId,
  });

  // Flight proposals for group voting
  // State to track if we've already prefilled to avoid overriding user changes
  const [hasPrefilledSearch, setHasPrefilledSearch] = useState(false);

  // Prefill flight search form with user default location and trip destination
  useEffect(() => {
    if (user && trip && !hasPrefilledSearch) {
      const newSearchData = { ...searchFormData };
      let hasChanges = false;

      // Prefill departure with user's default location (prefer airport code for flights)
      if (user.defaultLocationCode && !searchFormData.departure) {
        newSearchData.departure = user.defaultLocationCode;
        newSearchData.departureCity = user.defaultLocation ?? user.defaultLocationCode;
        newSearchData.departureLatitude = null;
        newSearchData.departureLongitude = null;
        hasChanges = true;
      } else if (user.defaultLocation && !searchFormData.departureCity) {
        newSearchData.departureCity = user.defaultLocation;
        newSearchData.departureLatitude = null;
        newSearchData.departureLongitude = null;
        hasChanges = true;
      }

      // Prefill arrival with trip destination
      if ((trip as any).destination) {
        if (!searchFormData.arrivalCity) {
          newSearchData.arrivalCity = (trip as any).destination;
          newSearchData.arrivalLatitude = null;
          newSearchData.arrivalLongitude = null;
          hasChanges = true;
        }

        if (!searchFormData.arrival) {
          newSearchData.arrival = '';
        }
      }

      // Prefill dates with trip dates
      if ((trip as any).startDate && !searchFormData.departureDate) {
        newSearchData.departureDate = format(new Date((trip as any).startDate), 'yyyy-MM-dd');
        hasChanges = true;
      }

      if ((trip as any).endDate && !searchFormData.returnDate) {
        newSearchData.returnDate = format(new Date((trip as any).endDate), 'yyyy-MM-dd');
        hasChanges = true;
      }

      if (hasChanges) {
        setSearchFormData(newSearchData);
        setHasPrefilledSearch(true);
      }
    }
  }, [user, trip, hasPrefilledSearch]); // FIXED: Removed searchFormData to prevent circular dependency

  const createFlightMutation = useMutation({
    mutationFn: async (flightData: ManualFlightPayload) => {
      const res = await apiRequest(`/api/trips/${tripId}/flights`, {
        method: "POST",
        body: flightData,
      });
      return (await res.json()) as FlightWithDetails;
    },
    onSuccess: (newFlight) => {
      const upsertFlights = (existing: unknown) => {
        const flightsList = Array.isArray(existing) ? existing : [];
        const filtered = flightsList.filter((flight: any) => flight.id !== newFlight.id);
        return [newFlight, ...filtered];
      };

      queryClient.setQueryData([`/api/trips/${tripId}/flights`, activeFilter], upsertFlights);
      queryClient.setQueryData([`/api/trips/${tripId}/flights`], upsertFlights);
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/calendar`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}`] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some(
            (key) => typeof key === 'string' && key.toLowerCase().includes('schedule'),
          ),
      });

      setIsAddFlightOpen(false);
      setEditingFlight(null);
      resetFlightForm();
      toast({
        title: "Flight added",
      });
    },
    onError: (error: unknown) => {
      const parsed = parseApiErrorResponse(error);

      if (parsed?.status === 400) {
        const nextErrors: ManualFlightFormErrors = {};
        const errorDetails = (parsed.data as any)?.errors;
        if (Array.isArray(errorDetails)) {
          for (const detail of errorDetails) {
            const field = Array.isArray(detail?.path) ? detail.path[0] : undefined;
            if (field === 'airlineCode') {
              nextErrors.airlineFlight = "Use a valid 2-letter airline IATA code (e.g., DL, AA).";
            }
            if (field === 'departureCode') {
              nextErrors.from = "Use a valid IATA code (e.g., LAX, JFK).";
            }
            if (field === 'arrivalCode') {
              nextErrors.to = "Use a valid IATA code (e.g., LAX, JFK).";
            }
          }
        }

        const rawMessage =
          typeof parsed.data === 'string'
            ? parsed.data
            : typeof (parsed.data as any)?.message === 'string'
              ? (parsed.data as any).message
              : '';

        if (typeof rawMessage === 'string' && rawMessage) {
          const normalized = rawMessage.toLowerCase();
          if (normalized.includes('airlinecode') || normalized.includes('airline code')) {
            nextErrors.airlineFlight = "Use a valid 2-letter airline code (e.g., DL1234).";
          }
          if (normalized.includes('departurecode') || normalized.includes('departure code')) {
            nextErrors.from = "Use a valid IATA code (e.g., ATL, JFK).";
          }
          if (normalized.includes('arrivalcode') || normalized.includes('arrival code')) {
            nextErrors.to = "Use a valid IATA code (e.g., LAX, JFK).";
          }
        }

        if (Object.keys(nextErrors).length > 0) {
          setManualFlightErrors((prev) => ({ ...prev, ...nextErrors }));
        }

        toast({
          title: "Couldn't add flight. Fix the highlighted fields.",
        });
        return;
      }

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add flight",
        variant: "destructive",
      });
    },
  });

  const updateFlightMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<InsertFlight> }) => {
      return apiRequest(`/api/flights/${data.id}`, {
        method: "PUT",
        body: data.updates,
      });
    },
    onSuccess: () => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flights`] });
      }
      setEditingFlight(null);
      toast({
        title: "Success",
        description: "Flight updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update flight",
        variant: "destructive",
      });
    },
  });

  const deleteFlightMutation = useMutation({
    mutationFn: async (flightId: number) => {
      const res = await apiRequest(`/api/flights/${flightId}`, {
        method: "DELETE",
      });
      return (await res.json()) as DeleteFlightResponse;
    },
    onSuccess: (data, flightId) => {
      if (tripId) {
        const removeFlight = (existing: unknown) => {
          if (!Array.isArray(existing)) {
            return existing;
          }

          return (existing as FlightWithDetails[]).filter((flight) => flight.id !== flightId);
        };

        queryClient.setQueryData([`/api/trips/${tripId}/flights`], removeFlight);
        queryClient.setQueryData([`/api/trips/${tripId}/flights`, activeFilter], removeFlight);
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flights`] });
      }

      if (tripId && data?.removedProposalIds?.length) {
        const ids = new Set<number>(data.removedProposalIds);
        const removeProposals = (existing: unknown) => {
          if (!Array.isArray(existing)) {
            return existing;
          }

          return (existing as { id: number }[]).filter((proposal) => !ids.has(proposal.id));
        };

        queryClient.setQueryData([`/api/trips/${tripId}/proposals/flights`], removeProposals);
        queryClient.setQueryData(
          [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
          removeProposals,
        );
      }

      if (tripId && data?.remainingProposalIds?.length) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/flights`] });
        queryClient.invalidateQueries({
          queryKey: [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
        });
      }

      if (tripId) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/calendar`] });
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}`] });
      }
      toast({
        title: "Success",
        description: "Flight deleted successfully!",
      });
    },
    onError: (error: unknown) => {
      let title = "Error";
      let description = "Failed to delete flight";

      if (error instanceof ApiError) {
        description = error.message;
        if (error.status === 403) {
          title = "Permission denied";
        }
      } else if (error instanceof Error && error.message) {
        description = error.message;
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const handleToggleFlightStatus = (flight: FlightWithDetails) => {
    const currentStatus = (flight.status ?? 'proposed').toLowerCase();
    const nextStatus = currentStatus === 'confirmed' ? 'proposed' : 'confirmed';

    updateFlightMutation.mutate({
      id: flight.id,
      updates: { status: nextStatus },
    });
  };

  // Flight ranking functionality
  // Share flight with group as a proposal
  const shareFlightWithGroup = async (flight: any) => {
    try {
      const departureAirportName =
        flight.departure?.airport ||
        flight.departureAirport ||
        extractAirportName(searchFormData.departure) ||
        searchFormData.departure ||
        "Departure TBD";

      const arrivalAirportName =
        flight.arrival?.airport ||
        flight.arrivalAirport ||
        extractAirportName(searchFormData.arrival) ||
        searchFormData.arrival ||
        "Arrival TBD";

      const departureTimeValue =
        flight.departure?.time ||
        flight.departureTime ||
        (typeof flight.departure_time === "string" ? flight.departure_time : undefined) ||
        new Date().toISOString();

      const arrivalTimeValue =
        flight.arrival?.time ||
        flight.arrivalTime ||
        (typeof flight.arrival_time === "string" ? flight.arrival_time : undefined) ||
        new Date().toISOString();

      const stopsValue = (() => {
        if (typeof flight.stops === "number") {
          return flight.stops;
        }
        if (Array.isArray(flight.layovers)) {
          return flight.layovers.length;
        }
        if (typeof flight.layovers === "string") {
          try {
            const parsed = JSON.parse(flight.layovers);
            if (Array.isArray(parsed)) {
              return parsed.length;
            }
          } catch {
            return 0;
          }
        }
        return 0;
      })();

      const durationValue =
        flight.duration ||
        (typeof flight.flightDuration === "number" && flight.flightDuration > 0
          ? formatDuration(flight.flightDuration)
          : undefined) ||
        "2h 30m";

      const aircraftSource = flight.aircraft ?? flight.segments?.[0]?.aircraft ?? null;
      let aircraftValue: string | null = null;
      if (typeof aircraftSource === "string") {
        aircraftValue = aircraftSource;
      } else if (aircraftSource && typeof aircraftSource === "object") {
        aircraftValue =
          aircraftSource.code ||
          aircraftSource.model ||
          aircraftSource.name ||
          (typeof aircraftSource.toString === "function" && aircraftSource.toString() !== "[object Object]"
            ? aircraftSource.toString()
            : null);
      }

      const bookingClassValue =
        flight.class ||
        flight.bookingClass ||
        (typeof flight.seatClass === "string" ? flight.seatClass : null) ||
        "Economy";

      const bookingUrlValue =
        flight.bookingUrls?.kayak ||
        flight.bookingUrls?.expedia ||
        flight.bookingUrl ||
        flight.purchaseUrl ||
        "#";

      const priceValue =
        parseNumericAmount(flight.price ?? flight.totalPrice) ??
        (typeof flight.price === "number" ? flight.price : 0);

      const proposalData = {
        airline:
          flight.airline ||
          flight.airlineName ||
          (typeof flight.airlineCode === "string" ? getAirlineName(flight.airlineCode) : undefined) ||
          getFlightAirlineName(flight) ||
          "Various Airlines",
        flightNumber: flight.flightNumber || flight.number || `Flight-${Date.now()}`,
        departure: departureAirportName,
        departureTime: departureTimeValue,
        arrival: arrivalAirportName,
        arrivalTime: arrivalTimeValue,
        duration: durationValue,
        stops: stopsValue,
        aircraft: aircraftValue || "Unknown Aircraft",
        price: priceValue,
        bookingClass: bookingClassValue,
        platform: flight.provider || flight.source || flight.bookingSource || "Trip",
        bookingUrl: bookingUrlValue,
      };

      await apiRequest(`/api/trips/${tripId}/flight-proposals`, {
        method: "POST",
        body: proposalData,
      });

      // Invalidate flight proposals cache to refresh the list
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/flights`] });
        queryClient.invalidateQueries({
          queryKey: [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
        });
      }
      
      toast({
        title: "Flight Proposed to Group!",
        description: `${proposalData.airline} flight ${proposalData.flightNumber} has been proposed to your group for ranking and voting.`,
      });
      
    } catch (error) {
      if (error instanceof Error && isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You need to be logged in to propose flights.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      console.error("Error proposing flight:", error);
      const description =
        error instanceof Error
          ? error.message
          : "Failed to propose flight to group. Please try again.";
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    }
  };

  // Form helper functions
  const resetFlightForm = () => {
    setManualFlightForm(defaultManualFlightForm);
    setManualFlightErrors({});
  };

  const openManualFlightDialog = () => {
    resetFlightForm();
    setEditingFlight(null);
    setIsAddFlightOpen(true);
  };

  const handleQuickAddFlight = useCallback(
    async (flight: any) => {
      if (!tripId) {
        toast({
          title: "Unable to add flight",
          description: "A trip must be selected before saving flights.",
          variant: "destructive",
        });
        return;
      }

      const flightIdentifier = getComparableFlightKey(flight);
      setAddingFlightKey(flightIdentifier);

      const fallbackDeparture = searchFormData.departureDate
        ? `${searchFormData.departureDate}T00:00:00`
        : undefined;
      const fallbackArrival =
        searchFormData.tripType === "roundtrip" && searchFormData.returnDate
          ? `${searchFormData.returnDate}T00:00:00`
          : searchFormData.departureDate
            ? `${searchFormData.departureDate}T00:00:00`
            : undefined;

      const airlineName = getFlightAirlineName(flight);
      const airlineCode = getFlightAirlineCode(flight);
      const normalizedPriceSource = flight.price ?? flight.totalPrice;
      const departureAirportName =
        flight.departure?.airport ||
        flight.departureAirport ||
        extractAirportName(searchFormData.departure) ||
        searchFormData.departure ||
        "Departure TBD";
      const arrivalAirportName =
        flight.arrival?.airport ||
        flight.arrivalAirport ||
        extractAirportName(searchFormData.arrival) ||
        searchFormData.arrival ||
        "Arrival TBD";
      const departureCode = (
        flight.departure?.iataCode ||
        flight.departureCode ||
        cachedSearchParams?.originCode ||
        extractAirportCode(cachedSearchParams?.origin) ||
        extractAirportCode(searchFormData.departure) ||
        "UNK"
      ).toString().toUpperCase();
      const arrivalCode = (
        flight.arrival?.iataCode ||
        flight.arrivalCode ||
        cachedSearchParams?.destinationCode ||
        extractAirportCode(cachedSearchParams?.destination) ||
        extractAirportCode(searchFormData.arrival) ||
        "UNK"
      ).toString().toUpperCase();

      const seatClassSource = flight.class ?? flight.cabin ?? null;
      const seatClassValue =
        typeof seatClassSource === "string"
          ? seatClassSource.toLowerCase()
          : seatClassSource
            ? seatClassSource.toString().toLowerCase()
            : null;
      const bookingSourceRaw = flight.provider ?? flight.source ?? null;
      const bookingSourceValue = bookingSourceRaw ? bookingSourceRaw.toString() : "search";
      const purchaseUrlValue =
        [flight.bookingUrls?.kayak, flight.bookingUrls?.expedia, flight.bookingUrl].find(
          (url) => typeof url === "string" && url.length > 0,
        ) ?? null;
      const aircraftSource = flight.aircraft ?? flight.segments?.[0]?.aircraft ?? null;
      let aircraftValue: string | null = null;
      if (typeof aircraftSource === "string") {
        aircraftValue = aircraftSource;
      } else if (aircraftSource && typeof aircraftSource === "object") {
        aircraftValue =
          aircraftSource.code ||
          aircraftSource.model ||
          aircraftSource.name ||
          (typeof aircraftSource.toString === "function" && aircraftSource.toString() !== "[object Object]"
            ? aircraftSource.toString()
            : JSON.stringify(aircraftSource));
      }
      const currencyValue =
        typeof flight.currency === "string" && flight.currency.trim().length > 0
          ? flight.currency
          : "USD";

      const flightPayload: InsertFlight = {
        tripId: parseInt(tripId, 10),
        flightNumber: (flight.flightNumber || flight.number || flight.id || `Flight-${Date.now()}`).toString(),
        airline: airlineName,
        airlineCode,
        departureAirport: departureAirportName,
        departureCode,
        departureTime: ensureIsoString(flight.departure?.time || flight.departureTime || fallbackDeparture),
        arrivalAirport: arrivalAirportName,
        arrivalCode,
        arrivalTime: ensureIsoString(flight.arrival?.time || flight.arrivalTime || fallbackArrival),
        flightType: "outbound",
        status: "confirmed",
        currency: currencyValue,
        bookingReference: null,
        departureTerminal: flight.departure?.terminal ?? null,
        departureGate: flight.departure?.gate ?? null,
        arrivalTerminal: flight.arrival?.terminal ?? null,
        arrivalGate: flight.arrival?.gate ?? null,
        seatNumber: null,
        seatClass: seatClassValue,
        price: parseNumericAmount(normalizedPriceSource),
        layovers: flight.layovers ?? flight.segments ?? null,
        bookingSource: bookingSourceValue,
        purchaseUrl: purchaseUrlValue,
        aircraft: aircraftValue,
        flightDuration: parseDurationToMinutes(flight.duration),
        baggage: flight.baggage ?? flight.includedBags ?? null,
      };

      try {
        await apiRequest(`/api/trips/${tripId}/flights`, {
          method: "POST",
          body: flightPayload,
        });

        const filterByKey = (list: any[]) =>
          Array.isArray(list)
            ? list.filter((item) => getComparableFlightKey(item) !== flightIdentifier)
            : [];

        const adjustCount = (count: number, original: any[], filtered: any[]) => {
          if (!Array.isArray(original) || original.length === 0) {
            return count;
          }

          const removed = original.length - filtered.length;
          const base = typeof count === "number" ? count : original.length;
          return Math.max(0, base - removed);
        };

        setSearchResults((previous) => filterByKey(previous));

        setFilterResults((previous) => {
          const nextBest = filterByKey(previous.best);
          const nextCheapest = filterByKey(previous.cheapest);
          const nextFastest = filterByKey(previous.fastest);

          setFilterResultCounts((counts) => ({
            best: adjustCount(counts.best, previous.best, nextBest),
            cheapest: adjustCount(counts.cheapest, previous.cheapest, nextCheapest),
            fastest: adjustCount(counts.fastest, previous.fastest, nextFastest),
          }));

          return {
            best: nextBest,
            cheapest: nextCheapest,
            fastest: nextFastest,
          };
        });

        await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flights`] });

        toast({
          title: "Flight added to Group Flights",
          description: `${airlineName} ${flightPayload.flightNumber} is now in your trip plan.`,
        });
      } catch (error) {
        if (error instanceof Error && isUnauthorizedError(error)) {
          toast({
            title: "Sign in required",
            description: "Log in to save flights to your trip.",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/login";
          }, 500);
        } else {
          toast({
            title: "Unable to add flight",
            description:
              error instanceof Error
                ? error.message
                : "Failed to add this flight to your trip. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        setAddingFlightKey(null);
      }
    },
    [
      cachedSearchParams,
      queryClient,
      searchFormData.arrival,
      searchFormData.departure,
      searchFormData.departureDate,
      searchFormData.returnDate,
      toast,
      tripId,
    ],
  );

  const populateFlightForm = (flight: FlightWithDetails) => {
    const directionValue: 'OUTBOUND' | 'RETURN' =
      (flight.flightType || 'OUTBOUND').toUpperCase() === 'RETURN' ? 'RETURN' : 'OUTBOUND';
    const departureValue = flight.departureTime
      ? new Date(flight.departureTime).toISOString().slice(0, 16)
      : '';
    const arrivalValue = flight.arrivalTime
      ? new Date(flight.arrivalTime).toISOString().slice(0, 16)
      : '';
    const seatClass = (flight.seatClass || 'ECONOMY').toUpperCase();
    const cabinValue: CabinClass = (['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as CabinClass[]).includes(
      seatClass as CabinClass,
    )
      ? (seatClass as CabinClass)
      : 'ECONOMY';

    setManualFlightForm({
      airlineFlight: formatManualAirlineFlightDisplay(flight),
      direction: directionValue,
      from: formatAirportDisplay(flight.departureAirport, flight.departureCode),
      to: formatAirportDisplay(flight.arrivalAirport, flight.arrivalCode),
      departure: departureValue,
      arrival: arrivalValue,
      cabin: cabinValue,
      notes: extractFlightNotes(flight),
    });
  };

  const handleFlightSubmit = () => {
    if (!tripId) {
      toast({
        title: "Trip required",
        description: "Select a trip before adding flights.",
        variant: "destructive",
      });
      return;
    }

    const errors: ManualFlightFormErrors = {};
    const airlineFlightInput = manualFlightForm.airlineFlight.trim();
    const parsedAirline = parseManualAirlineFlight(airlineFlightInput);
    if (!parsedAirline) {
      errors.airlineFlight = "Enter an airline and flight number (e.g., Delta DL1234).";
    }

    const fromLocation = parseManualLocationInput(manualFlightForm.from);
    if (!fromLocation) {
      errors.from = "Enter a departure airport code (e.g., ATL or Atlanta (ATL)).";
    }

    const toLocation = parseManualLocationInput(manualFlightForm.to);
    if (!toLocation) {
      errors.to = "Enter an arrival airport code (e.g., LAX or Los Angeles (LAX)).";
    }

    if (!manualFlightForm.departure) {
      errors.departure = "Departure date & time is required.";
    }

    if (!manualFlightForm.arrival) {
      errors.arrival = "Arrival date & time is required.";
    }

    if (Object.keys(errors).length > 0) {
      setManualFlightErrors(errors);
      return;
    }

    setManualFlightErrors({});

    const departureTimeIso = new Date(manualFlightForm.departure).toISOString();
    const arrivalTimeIso = new Date(manualFlightForm.arrival).toISOString();
    const direction: 'OUTBOUND' | 'RETURN' =
      manualFlightForm.direction === 'RETURN' ? 'RETURN' : 'OUTBOUND';
    const seatClassValue = manualFlightForm.cabin.toUpperCase() as CabinClass;
    const airlineDetails = parsedAirline!;

    const insertPayload: InsertFlight = {
      tripId: Number.parseInt(tripId, 10),
      flightNumber: airlineDetails.flightNumber,
      airline: airlineDetails.airlineName,
      airlineCode: airlineDetails.airlineCode,
      departureAirport: fromLocation!.name,
      departureCode: fromLocation!.code,
      departureTime: departureTimeIso,
      arrivalAirport: toLocation!.name,
      arrivalCode: toLocation!.code,
      arrivalTime: arrivalTimeIso,
      seatClass: seatClassValue,
      price: null,
      currency: 'USD',
      flightType: direction.toLowerCase(),
      status: editingFlight?.status || 'proposed',
      bookingReference: editingFlight?.bookingReference ?? null,
      aircraft: editingFlight?.aircraft ?? null,
      baggage: buildBaggageWithNotes(editingFlight?.baggage ?? null, manualFlightForm.notes),
    };

    const manualPayload: ManualFlightPayload = {
      ...insertPayload,
      departureTimeIso,
      arrivalTimeIso,
      priceCents: null,
      direction,
    };

    if (editingFlight) {
      updateFlightMutation.mutate({
        id: editingFlight.id,
        updates: insertPayload,
      });
    } else {
      createFlightMutation.mutate(manualPayload);
    }
  };

  const handleEditFlight = (flight: FlightWithDetails) => {
    setEditingFlight(flight);
    populateFlightForm(flight);
    setManualFlightErrors({});
    setIsAddFlightOpen(true);
  };

  const handleCancelEdit = () => {
    setIsAddFlightOpen(false);
    setEditingFlight(null);
    resetFlightForm();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <TravelLoading variant="plane" size="lg" text="Loading flight coordination..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/trip/${tripId}`}>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center hover:bg-gray-50"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trip
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Flight Coordination</h1>
              <p className="mt-1 text-gray-600">
                Manage flights for {(trip as any)?.name || 'your trip'}
              </p>
            </div>
          </div>
        </header>

        <FlightSearchPanel
          searchFormData={searchFormData}
          setSearchFormData={setSearchFormData}
          onSearch={handleFlightSearch}
          isSearching={isSearching}
          activeFilter={activeFilter}
          filterLoading={filterLoading}
          filterResultCounts={filterResultCounts}
          filterResults={filterResults}
          searchResults={searchResults}
          onFilterChange={handleFilterChange}
          cachedSearchParams={cachedSearchParams}
          onShareFlight={shareFlightWithGroup}
          onQuickAddFlight={handleQuickAddFlight}
          user={user}
          trip={trip as TripWithDetails | null}
          autoSearch={autoSearchRequested}
          isAddingFlight={addingFlightKey !== null}
          addingFlightKey={addingFlightKey}
          tripFlights={sortedFlights}
        />

        <section className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Trip flights</h2>
              <p className="text-sm text-muted-foreground">
                Review all flights saved to this trip. Click a flight to expand full details and manage it.
              </p>
            </div>
            <Button onClick={openManualFlightDialog} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add manual flight
            </Button>
          </div>

          {sortedFlights.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No flights have been added yet. Use the search above or add one manually.
              </CardContent>
            </Card>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={expandedTripFlightId ?? undefined}
              onValueChange={(value) => setExpandedTripFlightId(value || null)}
              className="space-y-3"
            >
              {sortedFlights.map((flight) => {
              const itemId = flight.id ? flight.id.toString() : `${flight.flightNumber}-${flight.departureTime}`;
              const directionLabel =
                (flight.flightType || "").toLowerCase() === "return" ? "Return" : "Outbound";
              const statusValue = (flight.status ?? "proposed").toLowerCase();
              const statusLabel = statusValue.charAt(0).toUpperCase() + statusValue.slice(1);
              const statusBadgeClass = getFlightStatusColor(statusValue);
              const departureLabel = formatAirportDisplay(flight.departureAirport, flight.departureCode);
              const arrivalLabel = formatAirportDisplay(flight.arrivalAirport, flight.arrivalCode);
              const departureDateTime = flight.departureTime
                ? format(new Date(flight.departureTime), "MMM d, yyyy h:mm a")
                : "Departure time TBD";
              const arrivalDateTime = flight.arrivalTime
                ? format(new Date(flight.arrivalTime), "MMM d, yyyy h:mm a")
                : "Arrival time TBD";
              const summaryTimeRange = flight.departureTime
                ? `${format(new Date(flight.departureTime), "h:mm a")} → ${
                    flight.arrivalTime ? format(new Date(flight.arrivalTime), "h:mm a") : "TBD"
                  }`
                : null;
              const summaryDate = flight.departureTime
                ? format(new Date(flight.departureTime), "MMM d, yyyy")
                : null;
              const priceLabel =
                typeof flight.price === "number"
                  ? formatCurrency(flight.price, { currency: flight.currency ?? "USD" })
                  : null;
              const durationLabel =
                typeof flight.flightDuration === "number" && flight.flightDuration > 0
                  ? formatDuration(flight.flightDuration)
                  : null;
              const layoverLabel = flight.layovers ? formatLayovers(flight.layovers) : null;
              const notes = extractFlightNotes(flight);
              const seatClassRaw = flight.seatClass ? flight.seatClass.toString().replace(/_/g, " ") : "";
              const seatClassLabel = seatClassRaw
                ? seatClassRaw
                    .toLowerCase()
                    .split(" ")
                    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" ")
                : null;
              const stopsCount = (() => {
                if (typeof (flight as any).stops === "number") {
                  return (flight as any).stops;
                }
                if (Array.isArray(flight.layovers)) {
                  return flight.layovers.length;
                }
                if (typeof flight.layovers === "string") {
                  try {
                    const parsed = JSON.parse(flight.layovers);
                    if (Array.isArray(parsed)) {
                      return parsed.length;
                    }
                  } catch {
                    return null;
                  }
                }
                return null;
              })();
              const stopsLabel =
                typeof stopsCount === "number"
                  ? stopsCount === 0
                    ? "Non-stop"
                    : `${stopsCount} stop${stopsCount > 1 ? "s" : ""}`
                  : null;
              const permissions = getFlightPermissions(flight, trip as TripWithDetails | null, currentUserId);
              const isManualEntry =
                !(flight.bookingSource ?? "") || (flight.bookingSource ?? "").toString().toLowerCase() === "manual";
              const notesLabel = notes ? `Notes: ${notes}` : null;
              const summaryDepartureCode =
                extractAirportCode(departureLabel) ?? flight.departureCode?.toUpperCase() ?? null;
              const summaryArrivalCode =
                extractAirportCode(arrivalLabel) ?? flight.arrivalCode?.toUpperCase() ?? null;
              const departureSummary =
                summaryDepartureCode ??
                (departureLabel && departureLabel.trim().length > 0 ? departureLabel : null) ??
                "Origin";
              const arrivalSummary =
                summaryArrivalCode ??
                (arrivalLabel && arrivalLabel.trim().length > 0 ? arrivalLabel : null) ??
                "Destination";
              const routeSummary = `${departureSummary} → ${arrivalSummary}`;
              const summaryFlightNumber =
                flight.flightNumber?.trim() ||
                formatManualAirlineFlightDisplay(flight) ||
                flight.airline?.trim() ||
                "Flight";
              const airlineDisplay = flight.airline || formatManualAirlineFlightDisplay(flight);

              return (
                <AccordionItem
                  key={itemId}
                  value={itemId}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  <AccordionTrigger className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-muted/50 [&[data-state=open]]:rounded-t-lg">
                    <div className="flex w-full flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-col gap-1 text-left">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Plane className="h-4 w-4 text-blue-600" />
                          <span className="text-base font-semibold">{summaryFlightNumber}</span>
                          {directionLabel && (
                            <Badge variant="secondary" className="uppercase">
                              {directionLabel}
                            </Badge>
                          )}
                          {isManualEntry && <Badge variant="outline">Manual</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">{routeSummary}</div>
                        {summaryTimeRange && (
                          <div className="text-xs text-muted-foreground">{summaryTimeRange}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right text-sm">
                        {summaryDate && <span className="font-medium text-foreground">{summaryDate}</span>}
                        <Badge className={statusBadgeClass}>{statusLabel}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid gap-4 text-sm md:grid-cols-3">
                      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <PlaneTakeoff className="h-4 w-4 text-green-600" />
                          Departure
                        </div>
                        <div className="font-medium">{departureLabel}</div>
                        <div className="text-xs text-muted-foreground">{departureDateTime}</div>
                        {flight.departureTerminal && (
                          <div className="text-xs text-muted-foreground">Terminal {flight.departureTerminal}</div>
                        )}
                        {flight.departureGate && (
                          <div className="text-xs text-muted-foreground">Gate {flight.departureGate}</div>
                        )}
                      </div>
                      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <PlaneLanding className="h-4 w-4 text-red-600" />
                          Arrival
                        </div>
                        <div className="font-medium">{arrivalLabel}</div>
                        <div className="text-xs text-muted-foreground">{arrivalDateTime}</div>
                        {flight.arrivalTerminal && (
                          <div className="text-xs text-muted-foreground">Terminal {flight.arrivalTerminal}</div>
                        )}
                        {flight.arrivalGate && (
                          <div className="text-xs text-muted-foreground">Gate {flight.arrivalGate}</div>
                        )}
                      </div>
                      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Trip summary
                        </div>
                        <div className="font-medium">{airlineDisplay}</div>
                        {directionLabel && <div>Direction: {directionLabel}</div>}
                        <div>Status: {statusLabel}</div>
                        {seatClassLabel && <div>Cabin: {seatClassLabel}</div>}
                        {durationLabel && <div>Duration: {durationLabel}</div>}
                        {stopsLabel && <div>Stops: {stopsLabel}</div>}
                        {flight.seatNumber && <div>Seat: {flight.seatNumber}</div>}
                        {priceLabel && <div>Price: {priceLabel}</div>}
                        {flight.bookingReference && <div>Reference: {flight.bookingReference}</div>}
                        {flight.bookingSource && <div>Source: {flight.bookingSource}</div>}
                        {flight.aircraft && <div>Aircraft: {flight.aircraft}</div>}
                        {flight.purchaseUrl && (
                          <a
                            href={flight.purchaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View booking
                          </a>
                        )}
                      </div>
                    </div>
                    {layoverLabel && (
                      <div className="mt-4 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                        Layovers: {layoverLabel}
                      </div>
                    )}
                    {notesLabel && (
                      <div className="mt-3 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                        {notesLabel}
                      </div>
                    )}
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Switch
                          checked={statusValue === 'confirmed'}
                          onCheckedChange={() => handleToggleFlightStatus(flight)}
                          disabled={!permissions.canManageStatus}
                        />
                        <span>{statusValue === 'confirmed' ? 'Confirmed' : 'Proposed'}</span>
                        {permissions.isAdminOverride && (
                          <Badge variant="outline" className="text-xs">
                            Admin override
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {permissions.isCreator && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditFlight(flight)}
                            disabled={!permissions.canEdit}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void shareFlightWithGroup(flight);
                          }}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Propose
                        </Button>
                        {permissions.isCreator && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteFlightMutation.mutate(flight.id)}
                            disabled={!permissions.canDelete}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
        )}
      </section>
    </div>

    <Dialog
      open={isAddFlightOpen}
      onOpenChange={(open) => {
        setIsAddFlightOpen(open);
        if (!open) {
          setManualFlightErrors({});
          setEditingFlight(null);
          resetFlightForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingFlight ? "Edit manual flight" : "Add manual flight"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="manual-airline-flight">Airline + flight number</Label>
            <Input
              id="manual-airline-flight"
              placeholder="e.g., Delta DL1234"
              value={manualFlightForm.airlineFlight}
              aria-invalid={manualFlightErrors.airlineFlight ? 'true' : 'false'}
              onChange={(event) => {
                const value = event.target.value;
                setManualFlightForm((prev) => ({ ...prev, airlineFlight: value }));
                setManualFlightErrors((prev) => ({ ...prev, airlineFlight: undefined }));
              }}
            />
            {manualFlightErrors.airlineFlight && (
              <p className="mt-1 text-sm text-destructive">{manualFlightErrors.airlineFlight}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-direction">Direction</Label>
              <Select
                value={manualFlightForm.direction}
                onValueChange={(value) =>
                  setManualFlightForm((prev) => ({ ...prev, direction: value as 'OUTBOUND' | 'RETURN' }))
                }
              >
                <SelectTrigger id="manual-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">Outbound</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manual-cabin">Cabin</Label>
              <Select
                value={manualFlightForm.cabin}
                onValueChange={(value) =>
                  setManualFlightForm((prev) => ({ ...prev, cabin: value as CabinClass }))
                }
              >
                <SelectTrigger id="manual-cabin">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ECONOMY">Economy</SelectItem>
                  <SelectItem value="PREMIUM_ECONOMY">Premium Economy</SelectItem>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                  <SelectItem value="FIRST">First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-from">From</Label>
              <Input
                id="manual-from"
                placeholder="City or airport (e.g., Atlanta (ATL))"
                value={manualFlightForm.from}
                aria-invalid={manualFlightErrors.from ? 'true' : 'false'}
                onChange={(event) => {
                  const value = event.target.value;
                  setManualFlightForm((prev) => ({ ...prev, from: value }));
                  setManualFlightErrors((prev) => ({ ...prev, from: undefined }));
                }}
              />
              {manualFlightErrors.from && (
                <p className="mt-1 text-sm text-destructive">{manualFlightErrors.from}</p>
              )}
            </div>
            <div>
              <Label htmlFor="manual-to">To</Label>
              <Input
                id="manual-to"
                placeholder="City or airport (e.g., Los Angeles (LAX))"
                value={manualFlightForm.to}
                aria-invalid={manualFlightErrors.to ? 'true' : 'false'}
                onChange={(event) => {
                  const value = event.target.value;
                  setManualFlightForm((prev) => ({ ...prev, to: value }));
                  setManualFlightErrors((prev) => ({ ...prev, to: undefined }));
                }}
              />
              {manualFlightErrors.to && (
                <p className="mt-1 text-sm text-destructive">{manualFlightErrors.to}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-departure">Departure date &amp; time (local)</Label>
              <Input
                id="manual-departure"
                type="datetime-local"
                value={manualFlightForm.departure}
                aria-invalid={manualFlightErrors.departure ? 'true' : 'false'}
                onChange={(event) => {
                  const value = event.target.value;
                  setManualFlightForm((prev) => ({ ...prev, departure: value }));
                  setManualFlightErrors((prev) => ({ ...prev, departure: undefined }));
                }}
              />
              {manualFlightErrors.departure && (
                <p className="mt-1 text-sm text-destructive">{manualFlightErrors.departure}</p>
              )}
            </div>
            <div>
              <Label htmlFor="manual-arrival">Arrival date &amp; time (local)</Label>
              <Input
                id="manual-arrival"
                type="datetime-local"
                value={manualFlightForm.arrival}
                aria-invalid={manualFlightErrors.arrival ? 'true' : 'false'}
                onChange={(event) => {
                  const value = event.target.value;
                  setManualFlightForm((prev) => ({ ...prev, arrival: value }));
                  setManualFlightErrors((prev) => ({ ...prev, arrival: undefined }));
                }}
              />
              {manualFlightErrors.arrival && (
                <p className="mt-1 text-sm text-destructive">{manualFlightErrors.arrival}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="manual-notes">Notes</Label>
            <Textarea
              id="manual-notes"
              placeholder="Add any optional notes"
              value={manualFlightForm.notes}
              onChange={(event) =>
                setManualFlightForm((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleFlightSubmit}
              disabled={createFlightMutation.isPending || updateFlightMutation.isPending}
            >
              {createFlightMutation.isPending || updateFlightMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  {editingFlight ? "Saving..." : "Adding..."}
                </>
              ) : (
                editingFlight ? "Update Flight" : "Save Flight"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
);
}
