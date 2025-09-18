// Quick test of Amadeus authentication
import axios from 'axios';

const clientId = 'gLMZMGd7DFvPtVG4e5op8vkCnVtZmUaF';
const clientSecret = 'WAv0oWouLj1MYL8A';

async function testAmadeus() {
  try {
    console.log('Testing Amadeus authentication...');
    const response = await axios.post('https://api.amadeus.com/v1/security/oauth2/token', 
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const tokenData = response.data;
    console.log('✓ Authentication successful!');
    console.log('Token type:', tokenData.token_type);
    console.log('Expires in:', tokenData.expires_in, 'seconds');

    // Test flight search
    const token = tokenData.access_token;
    const searchParams = new URLSearchParams({
      originLocationCode: 'JFK',
      destinationLocationCode: 'LAX',
      departureDate: '2025-08-15',
      adults: '1',
      travelClass: 'ECONOMY',
      max: '10',
      currencyCode: 'USD'
    });

    console.log('Testing flight search...');
    const flightResponse = await axios.get(`https://api.amadeus.com/v2/shopping/flight-offers?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (flightResponse.data && flightResponse.data.data) {
      console.log(`✓ Flight search successful! Found ${flightResponse.data.data.length} flights`);
      if (flightResponse.data.data.length > 0) {
        const flight = flightResponse.data.data[0];
        console.log(`Sample flight: ${flight.itineraries[0].segments[0].carrierCode} - $${flight.price.total}`);
      }
    } else {
      console.log('No flights found');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAmadeus();