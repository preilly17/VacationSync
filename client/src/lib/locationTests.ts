// Comprehensive test suite for location database system
import LocationUtils from './locationUtils';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
  duration: number;
}

export class LocationTestSuite {
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Location Database Test Suite...');
    
    this.results = [];
    
    // Basic functionality tests
    await this.runTest('Basic Search Test', () => this.testBasicSearch());
    await this.runTest('Nickname Recognition Test', () => this.testNicknameSearch());
    await this.runTest('Airport Code Search Test', () => this.testAirportCodes());
    await this.runTest('Fuzzy Search Test', () => this.testFuzzySearch());
    await this.runTest('Popular Destinations Test', () => this.testPopularDestinations());
    
    // Advanced functionality tests
    await this.runTest('Type Filtering Test', () => this.testTypeFiltering());
    await this.runTest('Database Statistics Test', () => this.testDatabaseStats());
    await this.runTest('Location Formatting Test', () => this.testLocationFormatting());
    await this.runTest('Coordinate Extraction Test', () => this.testCoordinateExtraction());
    await this.runTest('Multiple Results Test', () => this.testMultipleResults());
    
    // Edge cases and error handling
    await this.runTest('Empty Query Test', () => this.testEmptyQuery());
    await this.runTest('Invalid Input Test', () => this.testInvalidInput());
    await this.runTest('Non-existent Location Test', () => this.testNonExistentLocation());
    await this.runTest('Special Characters Test', () => this.testSpecialCharacters());
    
    // Performance tests
    await this.runTest('Search Performance Test', () => this.testSearchPerformance());
    await this.runTest('Cache Performance Test', () => this.testCachePerformance());
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    console.log(`✅ Test Suite Complete: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Location database system is working perfectly.');
    } else {
      console.log('⚠️ Some tests failed. Check the results for details.');
    }
    
    return this.results;
  }

  private async runTest(name: string, testFunction: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        passed: true,
        message: 'Test passed successfully',
        duration
      });
      console.log(`✅ ${name} - Passed (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
      console.log(`❌ ${name} - Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Basic functionality tests
  private async testBasicSearch(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: 'london',
      limit: 5
    });
    
    if (results.length === 0) {
      throw new Error('No results found for "london"');
    }
    
    const london = results.find(r => r.name.toLowerCase().includes('london'));
    if (!london) {
      throw new Error('London not found in results');
    }
    
    if (!london.countryCode) {
      throw new Error('London result missing country code');
    }
    
    console.log('✓ Found London:', london.displayName);
  }

  private async testNicknameSearch(): Promise<void> {
    const nyc = await LocationUtils.quickLookup('NYC');
    
    if (!nyc) {
      throw new Error('NYC nickname not recognized');
    }
    
    if (!nyc.name.toLowerCase().includes('new york')) {
      throw new Error('NYC nickname did not resolve to New York');
    }
    
    console.log('✓ NYC nickname resolved to:', nyc.displayName);
  }

  private async testAirportCodes(): Promise<void> {
    const testCodes = ['LAX', 'JFK', 'LHR', 'CDG', 'NRT'];
    
    for (const code of testCodes) {
      const airport = await LocationUtils.getLocationByIATA(code);
      
      if (!airport) {
        throw new Error(`Airport code ${code} not found`);
      }
      
      if (airport.type !== 'AIRPORT') {
        throw new Error(`${code} is not an airport type`);
      }
      
      console.log(`✓ ${code} airport found:`, airport.displayName);
    }
  }

  private async testFuzzySearch(): Promise<void> {
    const typoResults = await LocationUtils.searchLocations({
      query: 'tokoy', // Intentional typo
      limit: 3
    });
    
    if (typoResults.length === 0) {
      throw new Error('Fuzzy search failed - no results for "tokoy"');
    }
    
    const tokyo = typoResults.find(r => r.name.toLowerCase().includes('tokyo'));
    if (!tokyo) {
      throw new Error('Fuzzy search failed - Tokyo not found for "tokoy"');
    }
    
    console.log('✓ Fuzzy search found Tokyo for "tokoy":', tokyo.displayName);
  }

  private async testPopularDestinations(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: 'paris',
      limit: 5
    });
    
    const paris = results.find(r => r.name.toLowerCase().includes('paris'));
    if (!paris) {
      throw new Error('Paris not found in search results');
    }
    
    if (!paris.isPopular) {
      throw new Error('Paris is not marked as popular destination');
    }
    
    console.log('✓ Paris is marked as popular destination');
  }

  private async testTypeFiltering(): Promise<void> {
    const airportResults = await LocationUtils.searchLocations({
      query: 'new york',
      type: 'AIRPORT',
      limit: 10
    });
    
    if (airportResults.length === 0) {
      throw new Error('No airports found for New York');
    }
    
    const nonAirports = airportResults.filter(r => r.type !== 'AIRPORT');
    if (nonAirports.length > 0) {
      throw new Error('Type filtering failed - non-airports returned');
    }
    
    console.log('✓ Type filtering works correctly');
  }

  private async testDatabaseStats(): Promise<void> {
    const stats = await LocationUtils.getLocationStats();
    
    if (!stats) {
      throw new Error('Database statistics not available');
    }
    
    if (stats.airports < 100) {
      throw new Error('Too few airports in database');
    }
    
    if (stats.cities < 50) {
      throw new Error('Too few cities in database');
    }
    
    if (stats.countries < 50) {
      throw new Error('Too few countries in database');
    }
    
    console.log('✓ Database statistics:', stats);
  }

  private async testLocationFormatting(): Promise<void> {
    const location = await LocationUtils.quickLookup('London');
    
    if (!location) {
      throw new Error('Location not found for formatting test');
    }
    
    const formatted = LocationUtils.formatLocation(location);
    
    if (!formatted.includes('London')) {
      throw new Error('Formatted location missing city name');
    }
    
    if (location.iataCode && !formatted.includes(location.iataCode)) {
      throw new Error('Formatted location missing IATA code');
    }
    
    console.log('✓ Location formatting works:', formatted);
  }

  private async testCoordinateExtraction(): Promise<void> {
    const location = await LocationUtils.quickLookup('Tokyo');
    
    if (!location) {
      throw new Error('Tokyo not found for coordinate test');
    }
    
    const coordinates = LocationUtils.getCoordinates(location);
    
    if (!coordinates) {
      throw new Error('Coordinates not available for Tokyo');
    }
    
    const [lat, lng] = coordinates;
    if (lat < 30 || lat > 40 || lng < 130 || lng > 150) {
      throw new Error('Tokyo coordinates seem incorrect');
    }
    
    console.log('✓ Tokyo coordinates:', coordinates);
  }

  private async testMultipleResults(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: 'london',
      limit: 20
    });
    
    if (results.length < 2) {
      throw new Error('Expected multiple London results');
    }
    
    const uniqueCountries = new Set(results.map(r => r.countryCode));
    if (uniqueCountries.size < 2) {
      throw new Error('Expected London results from multiple countries');
    }
    
    console.log('✓ Multiple London results found:', results.length);
  }

  // Edge cases and error handling
  private async testEmptyQuery(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: '',
      limit: 10
    });
    
    if (results.length !== 0) {
      throw new Error('Empty query should return no results');
    }
    
    console.log('✓ Empty query handled correctly');
  }

  private async testInvalidInput(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: '!@#$%^&*()',
      limit: 10
    });
    
    // Should not throw errors, just return empty results
    console.log('✓ Invalid input handled gracefully');
  }

  private async testNonExistentLocation(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: 'NonExistentCityName12345',
      limit: 10
    });
    
    if (results.length !== 0) {
      throw new Error('Non-existent location should return no results');
    }
    
    console.log('✓ Non-existent location handled correctly');
  }

  private async testSpecialCharacters(): Promise<void> {
    const results = await LocationUtils.searchLocations({
      query: 'São Paulo',
      limit: 5
    });
    
    if (results.length === 0) {
      throw new Error('Special characters (accents) not handled properly');
    }
    
    const saoPaulo = results.find(r => r.name.toLowerCase().includes('são paulo') || r.name.toLowerCase().includes('sao paulo'));
    if (!saoPaulo) {
      throw new Error('São Paulo not found with special characters');
    }
    
    console.log('✓ Special characters handled correctly');
  }

  // Performance tests
  private async testSearchPerformance(): Promise<void> {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 10 }, (_, i) => 
      LocationUtils.searchLocations({
        query: `city${i}`,
        limit: 5
      })
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    
    if (duration > 5000) {
      throw new Error(`Search performance too slow: ${duration}ms for 10 concurrent searches`);
    }
    
    console.log(`✓ Search performance acceptable: ${duration}ms for 10 concurrent searches`);
  }

  private async testCachePerformance(): Promise<void> {
    // First search (may hit API)
    const startTime1 = Date.now();
    await LocationUtils.searchLocations({
      query: 'london',
      limit: 5
    });
    const duration1 = Date.now() - startTime1;
    
    // Second search (should use cache)
    const startTime2 = Date.now();
    await LocationUtils.searchLocations({
      query: 'london',
      limit: 5
    });
    const duration2 = Date.now() - startTime2;
    
    if (duration2 > duration1) {
      console.log(`⚠️ Cache may not be working optimally: ${duration1}ms vs ${duration2}ms`);
    } else {
      console.log(`✓ Cache performance good: ${duration1}ms -> ${duration2}ms`);
    }
  }

  // Helper methods
  getResults(): TestResult[] {
    return this.results;
  }

  getPassedTests(): TestResult[] {
    return this.results.filter(r => r.passed);
  }

  getFailedTests(): TestResult[] {
    return this.results.filter(r => !r.passed);
  }

  getTestSummary(): { passed: number; failed: number; total: number; passRate: number } {
    const passed = this.getPassedTests().length;
    const failed = this.getFailedTests().length;
    const total = this.results.length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    
    return { passed, failed, total, passRate };
  }
}

// Export utility functions for manual testing
export const locationTests = {
  // Quick test individual functions
  testBasicSearch: async () => {
    const results = await LocationUtils.searchLocations({ query: 'london', limit: 5 });
    console.log('Basic search results:', results);
    return results;
  },
  
  testNicknames: async () => {
    const nicknames = ['NYC', 'LA', 'SF', 'Vegas', 'Chi'];
    const results = await Promise.all(
      nicknames.map(async (nickname) => {
        const result = await LocationUtils.quickLookup(nickname);
        return { nickname, result: result?.displayName || 'Not found' };
      })
    );
    console.log('Nickname test results:', results);
    return results;
  },
  
  testAirportCodes: async () => {
    const codes = ['LAX', 'JFK', 'LHR', 'CDG', 'NRT', 'DXB'];
    const results = await Promise.all(
      codes.map(async (code) => {
        const result = await LocationUtils.getLocationByIATA(code);
        return { code, result: result?.displayName || 'Not found' };
      })
    );
    console.log('Airport code test results:', results);
    return results;
  },
  
  testPopularDestinations: async () => {
    const destinations = ['London', 'Paris', 'Tokyo', 'New York', 'Dubai'];
    const results = await Promise.all(
      destinations.map(async (dest) => {
        const result = await LocationUtils.getLocationByCity(dest);
        return { 
          destination: dest, 
          found: result?.displayName || 'Not found',
          isPopular: result?.isPopular || false
        };
      })
    );
    console.log('Popular destinations test:', results);
    return results;
  },
  
  testStats: async () => {
    const stats = await LocationUtils.getLocationStats();
    console.log('Database statistics:', stats);
    return stats;
  }
};

// Export the test suite
export default LocationTestSuite;