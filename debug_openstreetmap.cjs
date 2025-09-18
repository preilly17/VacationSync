// Debug script to test OpenStreetMap processing logic
const fetch = require('node-fetch');

// Copy of the exact logic from foursquareService.ts
async function debugOpenStreetMapSearch(cityName, options = {}) {
  try {
    console.log(`🗺️ Starting OpenStreetMap search for: ${cityName}`);
    
    // Get coordinates for Charlotte, NC (hardcoded for testing)
    const coordinates = { lat: 35.2271, lng: -80.8431 };
    console.log(`📍 Using coordinates: ${coordinates.lat}, ${coordinates.lng}`);

    // Define search radius (convert km to degrees approximately)
    const radiusKm = (options.radius || 5);
    console.log(`📏 Search radius: ${radiusKm} km`);

    // Build Overpass QL query for restaurants
    let cuisineFilter = '';
    if (options.cuisine) {
      const cuisineKeywords = getCuisineKeywords(options.cuisine);
      cuisineFilter = cuisineKeywords.map(keyword => `["cuisine"~"${keyword}",i]`).join('');
      console.log(`🍽️ Cuisine filter: ${cuisineFilter}`);
    }

    const overpassQuery = `
      [out:json][timeout:10];
      (
        node["amenity"="restaurant"]${cuisineFilter}(around:${radiusKm * 1000},${coordinates.lat},${coordinates.lng});
        node["amenity"="fast_food"]${cuisineFilter}(around:${radiusKm * 1000},${coordinates.lat},${coordinates.lng});
        node["amenity"="cafe"]${cuisineFilter}(around:${radiusKm * 1000},${coordinates.lat},${coordinates.lng});
      );
      out body;
    `;

    console.log(`📝 Overpass Query:`, overpassQuery.trim());

    console.log(`🌐 Making request to Overpass API...`);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VacationSync-Travel-App/1.0 (https://vacationsync.app)',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    if (!response.ok) {
      console.error(`❌ OpenStreetMap API error: ${response.status} ${response.statusText}`);
      throw new Error(`OpenStreetMap API error: ${response.status}`);
    }

    console.log(`✅ Got response from API, parsing JSON...`);
    const data = await response.json();
    console.log(`📊 Raw API response: ${data.elements?.length || 0} total elements`);
    
    if (!data.elements || data.elements.length === 0) {
      console.log('❌ No restaurants found in OpenStreetMap data');
      console.log('📋 Full response:', JSON.stringify(data, null, 2));
      return [];
    }

    // Show sample of raw elements
    console.log('🔍 Sample raw elements:');
    data.elements.slice(0, 3).forEach((element, i) => {
      console.log(`  ${i + 1}. ID: ${element.id}, tags: ${JSON.stringify(element.tags, null, 2)}`);
    });

    // Filter elements with names first
    const elementsWithNames = data.elements.filter((element) => element.tags?.name);
    console.log(`🏷️ Found ${elementsWithNames.length} restaurants with names out of ${data.elements.length} total`);
    
    if (elementsWithNames.length === 0) {
      console.log('❌ No restaurants with names found in OpenStreetMap data');
      console.log('🔍 Sample elements without names:');
      data.elements.slice(0, 5).forEach((element, i) => {
        console.log(`  ${i + 1}. ID: ${element.id}, tags: ${JSON.stringify(element.tags, null, 2)}`);
      });
      return [];
    }

    // Transform OpenStreetMap data to our Restaurant format
    let restaurants = elementsWithNames
      .slice(0, options.limit || 20) // Limit results
      .map((element) => formatOpenStreetMapRestaurant(element, coordinates));

    console.log(`🍽️ Formatted ${restaurants.length} restaurants successfully`);

    // Sample first restaurant
    if (restaurants.length > 0) {
      console.log('📋 Sample restaurant:', JSON.stringify(restaurants[0], null, 2));
    }

    return restaurants;

  } catch (error) {
    console.error('❌ OpenStreetMap restaurant search error:', error);
    throw error;
  }
}

function getCuisineKeywords(cuisine) {
  const cuisineMap = {
    'italian': ['italian', 'pizza', 'pasta'],
    'french': ['french'],
    'asian': ['asian', 'chinese', 'japanese', 'thai', 'korean', 'vietnamese'],
    'mexican': ['mexican', 'tacos'],
    'american': ['american', 'burger'],
    'chinese': ['chinese'],
    'japanese': ['japanese', 'sushi'],
    'indian': ['indian'],
    'thai': ['thai'],
    'spanish': ['spanish', 'tapas']
  };
  
  return cuisineMap[cuisine.toLowerCase()] || [cuisine.toLowerCase()];
}

function formatOpenStreetMapRestaurant(element, centerCoords) {
  console.log(`🔄 Processing element ID: ${element.id}`);
  
  const tags = element.tags || {};
  
  // Calculate distance from center coordinates
  const distance = calculateDistance(
    centerCoords.lat, 
    centerCoords.lng, 
    element.lat, 
    element.lon
  );

  // Extract cuisine information
  let cuisine = tags.cuisine || tags.amenity || 'restaurant';
  if (Array.isArray(cuisine)) {
    cuisine = cuisine[0];
  }
  
  // Basic price range estimation
  let priceRange = '$$';
  if (tags.amenity === 'fast_food') priceRange = '$';
  if (tags['price:range'] === 'expensive') priceRange = '$$$';

  // Build address
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:village']
  ].filter(Boolean);
  
  const address = addressParts.length > 0 
    ? addressParts.join(' ') 
    : `${element.lat.toFixed(4)}, ${element.lon.toFixed(4)}`;

  const restaurant = {
    id: `osm-${element.id}`,
    name: tags.name || 'Restaurant',
    address: address,
    cuisine: cuisine,
    rating: tags.rating ? parseFloat(tags.rating) : 3.5, // Default rating
    priceRange: priceRange,
    phone: tags.phone || tags['contact:phone'],
    website: tags.website || tags['contact:website'],
    distance: Math.round(distance * 1000), // Convert to meters
    tips: [],
    bookingLinks: [
      {
        text: 'View on OpenStreetMap',
        url: `https://www.openstreetmap.org/node/${element.id}`,
        type: 'info'
      }
    ]
  };

  console.log(`✅ Formatted restaurant: ${restaurant.name} at ${restaurant.address}`);
  return restaurant;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Run the debug test
debugOpenStreetMapSearch('charlotte')
  .then(restaurants => {
    console.log(`\n🎉 SUCCESS: Found ${restaurants.length} restaurants`);
    restaurants.forEach((r, index) => {
      console.log(`${index + 1}. ${r.name} - ${r.cuisine} - ${r.priceRange}`);
    });
  })
  .catch(error => {
    console.error('\n💥 ERROR:', error.message);
    console.error(error.stack);
  });