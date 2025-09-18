import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plane, Building, MapPin, Calendar, Users, Database } from 'lucide-react';
import { Link } from 'wouter';

interface FlightResult {
  id: string;
  airline: string;
  flightNumber: string;
  departure: { airport: string; time: string; terminal?: string };
  arrival: { airport: string; time: string; terminal?: string };
  duration: string;
  price: number;
  currency: string;
  stops: number;
  aircraft: string;
  bookingUrl: string;
  source: string;
}

interface HotelResult {
  id: string;
  name: string;
  rating: number;
  price: string;
  currency: string;
  location: string;
  amenities: string;
  description: string;
  bookingUrl: string;
  platform: string;
  latitude?: number;
  longitude?: number;
}

interface ActivityResult {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  rating: number;
  duration: string;
  category: string;
  location: string;
  bookingUrl: string;
  provider: string;
}

export default function AmadeusTest() {
  // Flight search state
  const [flightForm, setFlightForm] = useState({
    origin: 'New York',
    destination: 'Tokyo',
    departureDate: '2025-08-15',
    returnDate: '2025-08-22',
    passengers: 2,
    class: 'ECONOMY'
  });
  const [flightResults, setFlightResults] = useState<FlightResult[]>([]);
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);

  // Hotel search state
  const [hotelForm, setHotelForm] = useState({
    location: 'Tokyo',
    checkInDate: '2025-08-15',
    checkOutDate: '2025-08-20',
    adults: 2
  });
  const [hotelResults, setHotelResults] = useState<HotelResult[]>([]);
  const [hotelLoading, setHotelLoading] = useState(false);
  const [hotelError, setHotelError] = useState<string | null>(null);

  // Activity search state
  const [activityForm, setActivityForm] = useState({
    location: 'Tokyo',
    radius: 1
  });
  const [activityResults, setActivityResults] = useState<ActivityResult[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const searchFlights = async () => {
    setFlightLoading(true);
    setFlightError(null);
    try {
      const response = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flightForm)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const flights = await response.json();
      setFlightResults(flights);
    } catch (error) {
      setFlightError(error instanceof Error ? error.message : 'Flight search failed');
      setFlightResults([]);
    } finally {
      setFlightLoading(false);
    }
  };

  const searchHotels = async () => {
    setHotelLoading(true);
    setHotelError(null);
    try {
      const response = await fetch('/api/hotels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hotelForm)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const hotels = await response.json();
      setHotelResults(hotels);
    } catch (error) {
      setHotelError(error instanceof Error ? error.message : 'Hotel search failed');
      setHotelResults([]);
    } finally {
      setHotelLoading(false);
    }
  };

  const searchActivities = async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const response = await fetch('/api/activities/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const activities = await response.json();
      setActivityResults(activities);
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'Activity search failed');
      setActivityResults([]);
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Amadeus API Integration Test</h1>
            <p className="text-gray-600">Test your production Amadeus API integration with real travel data</p>
          </div>
          <Link href="/location-database">
            <Button variant="outline" size="sm">
              <Database className="w-4 h-4 mr-2" />
              Location Database
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="flights" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="flights" className="flex items-center gap-2">
              <Plane className="w-4 h-4" />
              Flights
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Hotels
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Activities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Flight Search</CardTitle>
                <CardDescription>Search for flights using Amadeus v2/shopping/flight-offers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="origin">Origin City</Label>
                    <Input
                      id="origin"
                      value={flightForm.origin}
                      onChange={(e) => setFlightForm({...flightForm, origin: e.target.value})}
                      placeholder="e.g., New York, London, Paris, Sydney"
                    />
                  </div>
                  <div>
                    <Label htmlFor="destination">Destination City</Label>
                    <Input
                      id="destination"
                      value={flightForm.destination}
                      onChange={(e) => setFlightForm({...flightForm, destination: e.target.value})}
                      placeholder="e.g., Tokyo, London, Paris, Barcelona, Dubai"
                    />
                  </div>
                  <div>
                    <Label htmlFor="departureDate">Departure Date</Label>
                    <Input
                      id="departureDate"
                      type="date"
                      value={flightForm.departureDate}
                      onChange={(e) => setFlightForm({...flightForm, departureDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="returnDate">Return Date</Label>
                    <Input
                      id="returnDate"
                      type="date"
                      value={flightForm.returnDate}
                      onChange={(e) => setFlightForm({...flightForm, returnDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="passengers">Passengers</Label>
                    <Input
                      id="passengers"
                      type="number"
                      min="1"
                      max="9"
                      value={flightForm.passengers}
                      onChange={(e) => setFlightForm({...flightForm, passengers: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="class">Class</Label>
                    <select
                      id="class"
                      value={flightForm.class}
                      onChange={(e) => setFlightForm({...flightForm, class: e.target.value})}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="ECONOMY">Economy</option>
                      <option value="PREMIUM_ECONOMY">Premium Economy</option>
                      <option value="BUSINESS">Business</option>
                      <option value="FIRST">First</option>
                    </select>
                  </div>
                </div>
                <Button onClick={searchFlights} disabled={flightLoading} className="w-full">
                  {flightLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plane className="w-4 h-4 mr-2" />}
                  Search Flights
                </Button>
              </CardContent>
            </Card>

            {flightError && (
              <Alert variant="destructive">
                <AlertDescription>{flightError}</AlertDescription>
              </Alert>
            )}

            {flightResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Flight Results ({flightResults.length})</h3>
                <div className="grid gap-4">
                  {flightResults.map((flight) => (
                    <Card key={flight.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{flight.airline} {flight.flightNumber}</h4>
                            <p className="text-sm text-gray-600">{flight.aircraft}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div>
                                <p className="font-medium">{flight.departure.airport}</p>
                                <p className="text-sm text-gray-600">{new Date(flight.departure.time).toLocaleString()}</p>
                              </div>
                              <div className="text-gray-400">→</div>
                              <div>
                                <p className="font-medium">{flight.arrival.airport}</p>
                                <p className="text-sm text-gray-600">{new Date(flight.arrival.time).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">${flight.price}</p>
                            <p className="text-sm text-gray-600">{flight.currency}</p>
                            <p className="text-sm text-gray-600">{flight.stops} stops</p>
                            <Button size="sm" className="mt-2" onClick={() => window.open(flight.bookingUrl, '_blank')}>
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hotels" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Hotel Search</CardTitle>
                <CardDescription>Search for hotels using Amadeus v3/shopping/hotel-offers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="hotelLocation">Location</Label>
                    <Input
                      id="hotelLocation"
                      value={hotelForm.location}
                      onChange={(e) => setHotelForm({...hotelForm, location: e.target.value})}
                      placeholder="e.g., Tokyo, London, Paris, Barcelona, Dubai"
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkInDate">Check-in Date</Label>
                    <Input
                      id="checkInDate"
                      type="date"
                      value={hotelForm.checkInDate}
                      onChange={(e) => setHotelForm({...hotelForm, checkInDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkOutDate">Check-out Date</Label>
                    <Input
                      id="checkOutDate"
                      type="date"
                      value={hotelForm.checkOutDate}
                      onChange={(e) => setHotelForm({...hotelForm, checkOutDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="adults">Adults</Label>
                    <Input
                      id="adults"
                      type="number"
                      min="1"
                      max="8"
                      value={hotelForm.adults}
                      onChange={(e) => setHotelForm({...hotelForm, adults: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <Button onClick={searchHotels} disabled={hotelLoading} className="w-full">
                  {hotelLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building className="w-4 h-4 mr-2" />}
                  Search Hotels
                </Button>
              </CardContent>
            </Card>

            {hotelError && (
              <Alert variant="destructive">
                <AlertDescription>{hotelError}</AlertDescription>
              </Alert>
            )}

            {hotelResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Hotel Results ({hotelResults.length})</h3>
                <div className="grid gap-4">
                  {hotelResults.map((hotel) => (
                    <Card key={hotel.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{hotel.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-yellow-500">★</span>
                              <span className="text-sm">{hotel.rating}/5</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{hotel.location}</p>
                            <p className="text-sm text-gray-600 mt-1">{hotel.amenities}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">${hotel.price}</p>
                            <p className="text-sm text-gray-600">{hotel.currency}/night</p>
                            <Button size="sm" className="mt-2" onClick={() => window.open(hotel.bookingUrl, '_blank')}>
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Search</CardTitle>
                <CardDescription>Search for activities using Amadeus v1/shopping/activities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="activityLocation">Location</Label>
                    <Input
                      id="activityLocation"
                      value={activityForm.location}
                      onChange={(e) => setActivityForm({...activityForm, location: e.target.value})}
                      placeholder="e.g., Tokyo, London, Paris, Barcelona, Dubai"
                    />
                  </div>
                  <div>
                    <Label htmlFor="radius">Search Radius (km)</Label>
                    <Input
                      id="radius"
                      type="number"
                      min="1"
                      max="50"
                      value={activityForm.radius}
                      onChange={(e) => setActivityForm({...activityForm, radius: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <Button onClick={searchActivities} disabled={activityLoading} className="w-full">
                  {activityLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                  Search Activities
                </Button>
              </CardContent>
            </Card>

            {activityError && (
              <Alert variant="destructive">
                <AlertDescription>{activityError}</AlertDescription>
              </Alert>
            )}

            {activityResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Activity Results ({activityResults.length})</h3>
                <div className="grid gap-4">
                  {activityResults.map((activity) => (
                    <Card key={activity.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{activity.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1">
                                <span className="text-yellow-500">★</span>
                                <span className="text-sm">{activity.rating}/5</span>
                              </div>
                              <span className="text-sm text-gray-600">{activity.duration}</span>
                              <span className="text-sm text-gray-600">{activity.category}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">${activity.price}</p>
                            <p className="text-sm text-gray-600">{activity.currency}</p>
                            <Button size="sm" className="mt-2" onClick={() => window.open(activity.bookingUrl, '_blank')}>
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}