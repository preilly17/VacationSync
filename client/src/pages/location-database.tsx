import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Database, MapPin, Plane, Building, Globe, RefreshCw, Download, TestTube, CheckCircle, XCircle } from 'lucide-react';
import LocationTestSuite, { TestResult } from '@/lib/locationTests';
import { apiFetch } from '@/lib/api';

interface LocationResult {
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
}

interface LocationStats {
  airports: number;
  cities: number;
  countries: number;
  lastUpdated: string;
  cacheAge: string;
}

interface RefreshProgress {
  current: number;
  total: number;
  type: string;
  percentage: number;
}

export default function LocationDatabase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'ALL' | 'AIRPORT' | 'CITY' | 'COUNTRY'>('ALL');
  const [useApi, setUseApi] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<LocationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);
  
  const [testSuite] = useState(() => new LocationTestSuite());
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testRunning, setTestRunning] = useState(false);

  // Load initial stats
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const response = await apiFetch('/api/locations/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const searchLocations = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      const response = await apiFetch('/api/locations/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          type: searchType === 'ALL' ? undefined : searchType,
          limit: 20,
          useApi: useApi
        }),
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      setSearchError('Failed to search locations');
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const refreshLocationData = async () => {
    setRefreshing(true);
    setRefreshError(null);
    setRefreshSuccess(null);
    setRefreshProgress(null);
    
    try {
      const response = await apiFetch('/api/locations/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Refresh failed');
      }
      
      const result = await response.json();
      setRefreshSuccess(`Successfully refreshed location data: ${result.stats.airports} airports, ${result.stats.cities} cities, ${result.stats.countries} countries`);
      await loadStats(); // Reload stats after refresh
    } catch (error) {
      setRefreshError('Failed to refresh location data');
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const runTestSuite = async () => {
    setTestRunning(true);
    setTestResults([]);
    
    try {
      const results = await testSuite.runAllTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setTestRunning(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'AIRPORT': return <Plane className="w-4 h-4" />;
      case 'CITY': return <Building className="w-4 h-4" />;
      case 'COUNTRY': return <Globe className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'AIRPORT': return 'bg-blue-100 text-blue-800';
      case 'CITY': return 'bg-green-100 text-green-800';
      case 'COUNTRY': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Database className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Global Location Database</h1>
      </div>
      
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search">Search Locations</TabsTrigger>
          <TabsTrigger value="stats">Database Stats</TabsTrigger>
          <TabsTrigger value="manage">Manage Data</TabsTrigger>
          <TabsTrigger value="test">Test Suite</TabsTrigger>
        </TabsList>
        
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Location Search
              </CardTitle>
              <CardDescription>
                Search through airports, cities, and countries worldwide. Use cached data or live Amadeus API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search-query">Search Query</Label>
                  <Input
                    id="search-query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., Tokyo, JFK, United States"
                    onKeyPress={(e) => e.key === 'Enter' && searchLocations()}
                  />
                </div>
                
                <div>
                  <Label htmlFor="search-type">Location Type</Label>
                  <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="AIRPORT">Airports</SelectItem>
                      <SelectItem value="CITY">Cities</SelectItem>
                      <SelectItem value="COUNTRY">Countries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="use-api"
                    checked={useApi}
                    onChange={(e) => setUseApi(e.target.checked)}
                  />
                  <Label htmlFor="use-api" className="text-sm">Use Live API</Label>
                </div>
                
                <div className="pt-6">
                  <Button 
                    onClick={searchLocations} 
                    disabled={searchLoading || !searchQuery.trim()}
                    className="w-full"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Search
                  </Button>
                </div>
              </div>
              
              {searchError && (
                <Alert variant="destructive">
                  <AlertDescription>{searchError}</AlertDescription>
                </Alert>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Search Results ({searchResults.length})</h3>
                  <div className="grid gap-2 max-h-96 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          {getTypeIcon(result.type)}
                          <div>
                            <div className="font-medium">{result.name}</div>
                            <div className="text-sm text-gray-600">{result.detailedName}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={getTypeColor(result.type)}>
                            {result.type}
                          </Badge>
                          
                          {result.iataCode && (
                            <Badge variant="outline">{result.iataCode}</Badge>
                          )}
                          
                          {result.icaoCode && (
                            <Badge variant="outline">{result.icaoCode}</Badge>
                          )}
                          
                          {result.cityCode && (
                            <Badge variant="outline">{result.cityCode}</Badge>
                          )}
                          
                          {result.countryCode && (
                            <Badge variant="outline">{result.countryCode}</Badge>
                          )}
                          
                          {result.latitude && result.longitude && (
                            <Badge variant="outline">
                              {result.latitude.toFixed(2)}, {result.longitude.toFixed(2)}
                            </Badge>
                          )}
                          
                          <Badge variant="secondary">
                            {Math.round(result.relevance)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Statistics
              </CardTitle>
              <CardDescription>
                Overview of cached location data from Amadeus API
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading statistics...
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <Plane className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{stats.airports.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Airports</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <Building className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{stats.cities.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Cities</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <Globe className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <div className="text-2xl font-bold">{stats.countries.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Countries</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                    <div className="text-sm font-bold">{stats.cacheAge}</div>
                    <div className="text-sm text-gray-600">Cache Age</div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No location data available. Try refreshing the database.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Data Management
              </CardTitle>
              <CardDescription>
                Refresh location data from Amadeus API and manage the cache
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={refreshLocationData}
                  disabled={refreshing}
                  size="lg"
                >
                  {refreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {refreshing ? 'Refreshing...' : 'Refresh All Location Data'}
                </Button>
                
                <Button
                  onClick={loadStats}
                  variant="outline"
                  disabled={statsLoading}
                >
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Reload Stats
                </Button>
              </div>
              
              {refreshProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Fetching {refreshProgress.type}...</span>
                    <span>{refreshProgress.current}/{refreshProgress.total}</span>
                  </div>
                  <Progress value={refreshProgress.percentage} />
                </div>
              )}
              
              {refreshError && (
                <Alert variant="destructive">
                  <AlertDescription>{refreshError}</AlertDescription>
                </Alert>
              )}
              
              {refreshSuccess && (
                <Alert>
                  <AlertDescription>{refreshSuccess}</AlertDescription>
                </Alert>
              )}
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Data Refresh Process:</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Fetches all airports worldwide from Amadeus API</li>
                  <li>• Fetches all cities supported by Amadeus</li>
                  <li>• Fetches all countries with their codes</li>
                  <li>• Includes geographic coordinates and codes</li>
                  <li>• Caches data locally for 7 days</li>
                  <li>• Includes rate limiting to respect API limits</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Location Database Test Suite
              </CardTitle>
              <CardDescription>
                Comprehensive tests to verify location database functionality, search accuracy, and performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button 
                  onClick={runTestSuite}
                  disabled={testRunning}
                  className="flex items-center gap-2"
                >
                  {testRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                  {testRunning ? 'Running Tests...' : 'Run All Tests'}
                </Button>
                
                {testResults.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {testResults.filter(r => r.passed).length}/{testResults.length} Passed
                    </Badge>
                    <Badge variant={testResults.every(r => r.passed) ? 'default' : 'destructive'}>
                      {testResults.every(r => r.passed) ? 'All Tests Passed' : 'Some Tests Failed'}
                    </Badge>
                  </div>
                )}
              </div>
              
              {testResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Test Results:</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {testResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {result.passed ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium">{result.name}</div>
                            <div className="text-sm text-gray-600">{result.message}</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.duration}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}