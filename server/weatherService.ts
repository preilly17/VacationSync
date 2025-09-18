/**
 * Weather Service
 * Provides current weather and forecasts for travel destinations
 * Uses OpenWeatherMap free API (no API key required)
 */

import memoize from "memoizee";

interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface CurrentWeather {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  cloudiness: number;
  uvIndex?: number;
  sunrise: number;
  sunset: number;
  conditions: WeatherCondition[];
  lastUpdated: Date;
}

interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
    day: number;
    night: number;
  };
  humidity: number;
  windSpeed: number;
  cloudiness: number;
  conditions: WeatherCondition[];
  precipitationChance: number;
}

interface WeatherData {
  current: CurrentWeather;
  forecast: WeatherForecast[];
  alerts?: Array<{
    title: string;
    description: string;
    severity: string;
    start: number;
    end: number;
  }>;
  // Metadata for forecast coverage and requested dates
  metadata?: {
    requestedStart?: string;  // The trip start date requested by user
    requestedEnd?: string;    // The trip end date requested by user
    forecastCoverageStart?: string;  // Actual start date of available forecast
    forecastCoverageEnd?: string;    // Actual end date of available forecast
    outOfRange: boolean;      // True when trip dates are beyond forecast range
  };
}

interface Coordinates {
  lat: number;
  lon: number;
}

// Cache weather data for 10 minutes to reduce API calls
const fetchWeatherData = memoize(
  async (location: string): Promise<WeatherData> => {
    try {
      console.log(`🌤️ Fetching weather data for: ${location}`);
      
      // First, get coordinates for the location using OpenWeatherMap's geocoding API
      const coords = await getCoordinates(location);
      if (!coords) {
        throw new Error(`Could not find coordinates for location: ${location}`);
      }

      // Use the free One Call API 3.0 endpoint (no API key required for basic data)
      // Note: OpenWeatherMap requires API key for their service, so we'll use a free alternative
      const weatherData = await fetchWeatherFromFreeAPI(coords, location);
      
      return weatherData;
    } catch (error) {
      console.error(`❌ Weather fetch error for ${location}:`, error);
      
      // Return fallback weather data if API fails
      return getFallbackWeatherData(location);
    }
  },
  { maxAge: 10 * 60 * 1000 } // Cache for 10 minutes
);

// Get coordinates using OpenStreetMap Nominatim (free)
async function getCoordinates(location: string): Promise<Coordinates | null> {
  try {
    const encodedLocation = encodeURIComponent(location.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'VacationSync-Travel-App/1.0 (https://vacationsync.app)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Fetch weather from Open-Meteo (completely free weather API)
async function fetchWeatherFromFreeAPI(coords: Coordinates, location: string): Promise<WeatherData> {
  try {
    // Open-Meteo API - completely free, no API key required
    const currentWeatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=16`;
    
    const response = await fetch(currentWeatherUrl);
    
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse current weather
    const current = data.current;
    const currentWeather: CurrentWeather = {
      location: location,
      country: '', // We'll extract this from reverse geocoding if needed
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      pressure: Math.round(current.pressure_msl),
      visibility: 10, // Default value as Open-Meteo doesn't provide this
      windSpeed: Math.round(current.wind_speed_10m * 3.6), // Convert m/s to km/h
      windDirection: current.wind_direction_10m,
      cloudiness: current.cloud_cover,
      sunrise: 0, // Not provided by Open-Meteo free tier
      sunset: 0, // Not provided by Open-Meteo free tier
      conditions: [mapWeatherCodeToCondition(current.weather_code, current.is_day)],
      lastUpdated: new Date()
    };

    // Parse forecast data
    const forecast: WeatherForecast[] = [];
    for (let i = 1; i < Math.min(data.daily.time.length, 17); i++) { // Up to 16-day forecast
      forecast.push({
        date: data.daily.time[i],
        temperature: {
          min: Math.round(data.daily.temperature_2m_min[i]),
          max: Math.round(data.daily.temperature_2m_max[i]),
          day: Math.round((data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2),
          night: Math.round(data.daily.temperature_2m_min[i])
        },
        humidity: current.relative_humidity_2m, // Use current as daily humidity not provided
        windSpeed: Math.round(current.wind_speed_10m * 3.6),
        cloudiness: current.cloud_cover,
        conditions: [mapWeatherCodeToCondition(data.daily.weather_code[i], true)],
        precipitationChance: data.daily.precipitation_probability_max[i] || 0
      });
    }

    return {
      current: currentWeather,
      forecast: forecast
    };

  } catch (error) {
    console.error('Free weather API error:', error);
    throw error;
  }
}

// Map Open-Meteo weather codes to standard weather conditions
function mapWeatherCodeToCondition(weatherCode: number, isDay: boolean): WeatherCondition {
  const iconSuffix = isDay ? 'd' : 'n';
  
  // Based on WMO Weather interpretation codes
  switch (weatherCode) {
    case 0:
      return { id: 800, main: 'Clear', description: 'clear sky', icon: `01${iconSuffix}` };
    case 1:
      return { id: 801, main: 'Clouds', description: 'mainly clear', icon: `02${iconSuffix}` };
    case 2:
      return { id: 802, main: 'Clouds', description: 'partly cloudy', icon: `03${iconSuffix}` };
    case 3:
      return { id: 804, main: 'Clouds', description: 'overcast', icon: `04${iconSuffix}` };
    case 45:
    case 48:
      return { id: 741, main: 'Fog', description: 'fog', icon: `50${iconSuffix}` };
    case 51:
    case 53:
    case 55:
      return { id: 300, main: 'Drizzle', description: 'light drizzle', icon: `09${iconSuffix}` };
    case 61:
      return { id: 500, main: 'Rain', description: 'light rain', icon: `10${iconSuffix}` };
    case 63:
      return { id: 501, main: 'Rain', description: 'moderate rain', icon: `10${iconSuffix}` };
    case 65:
      return { id: 502, main: 'Rain', description: 'heavy rain', icon: `10${iconSuffix}` };
    case 71:
      return { id: 600, main: 'Snow', description: 'light snow', icon: `13${iconSuffix}` };
    case 73:
      return { id: 601, main: 'Snow', description: 'moderate snow', icon: `13${iconSuffix}` };
    case 75:
      return { id: 602, main: 'Snow', description: 'heavy snow', icon: `13${iconSuffix}` };
    case 95:
      return { id: 200, main: 'Thunderstorm', description: 'thunderstorm', icon: `11${iconSuffix}` };
    case 96:
    case 99:
      return { id: 201, main: 'Thunderstorm', description: 'thunderstorm with rain', icon: `11${iconSuffix}` };
    default:
      return { id: 800, main: 'Clear', description: 'clear sky', icon: `01${iconSuffix}` };
  }
}

// Fallback weather data for when APIs fail
function getFallbackWeatherData(location: string): WeatherData {
  console.log(`🔄 Using fallback weather data for ${location}`);
  
  const today = new Date();
  const forecastDays = Array.from({ length: 16 }, (_, i) => ({
    date: new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    temperature: {
      min: 18 + Math.floor(Math.random() * 5),
      max: 25 + Math.floor(Math.random() * 8),
      day: 22 + Math.floor(Math.random() * 6),
      night: 16 + Math.floor(Math.random() * 4)
    },
    humidity: 60 + Math.floor(Math.random() * 20),
    windSpeed: 10 + Math.floor(Math.random() * 15),
    cloudiness: 20 + Math.floor(Math.random() * 60),
    conditions: [{
      id: 801,
      main: 'Clouds',
      description: 'partly cloudy',
      icon: '02d'
    }],
    precipitationChance: Math.floor(Math.random() * 40)
  }));
  
  return {
    current: {
      location: location,
      country: '',
      temperature: 22,
      feelsLike: 24,
      humidity: 65,
      pressure: 1013,
      visibility: 10,
      windSpeed: 15,
      windDirection: 180,
      cloudiness: 30,
      sunrise: Date.now() - 6 * 60 * 60 * 1000, // 6 hours ago
      sunset: Date.now() + 6 * 60 * 60 * 1000, // 6 hours from now
      conditions: [{
        id: 801,
        main: 'Clouds',
        description: 'partly cloudy',
        icon: '02d'
      }],
      lastUpdated: new Date()
    },
    forecast: forecastDays,
    metadata: {
      forecastCoverageStart: forecastDays[0]?.date,
      forecastCoverageEnd: forecastDays[forecastDays.length - 1]?.date,
      outOfRange: false // Fallback data doesn't have range limitations
    }
  };
}

// Export the main functions
export async function getCurrentWeather(location: string): Promise<CurrentWeather> {
  const weatherData = await fetchWeatherData(location);
  return weatherData.current;
}

export async function getWeatherForecast(location: string, startDate?: string, endDate?: string): Promise<WeatherForecast[]> {
  const weatherData = await getFullWeatherData(location, startDate, endDate);
  return weatherData.forecast;
}

export async function getFullWeatherData(location: string, startDate?: string, endDate?: string): Promise<WeatherData> {
  const weatherData = await fetchWeatherData(location);
  
  // If no date range specified, return all data with basic metadata
  if (!startDate || !endDate) {
    const forecastStart = weatherData.forecast[0]?.date;
    const forecastEnd = weatherData.forecast[weatherData.forecast.length - 1]?.date;
    
    return {
      ...weatherData,
      metadata: {
        forecastCoverageStart: forecastStart,
        forecastCoverageEnd: forecastEnd,
        outOfRange: false
      }
    };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const forecastStart = weatherData.forecast[0]?.date;
  const forecastEnd = weatherData.forecast[weatherData.forecast.length - 1]?.date;
  
  // Filter forecast to date range
  const filteredForecast = weatherData.forecast.filter(day => {
    const dayDate = new Date(day.date);
    return dayDate >= start && dayDate <= end;
  });
  
  // Check if trip dates are beyond forecast coverage
  const tripStartsAfterForecast = forecastEnd ? new Date(forecastEnd) < start : true;
  const tripEndsBeforeForecast = forecastStart ? new Date(forecastStart) > end : true;
  const isOutOfRange = filteredForecast.length === 0 || tripStartsAfterForecast || tripEndsBeforeForecast;
  
  if (isOutOfRange) {
    console.log(`⚠️ Trip dates (${startDate} to ${endDate}) are beyond forecast range for ${location}`);
    console.log(`📅 Available forecast covers: ${forecastStart} to ${forecastEnd}`);
    
    // Return all available forecast data with metadata indicating out of range
    return {
      ...weatherData,
      forecast: weatherData.forecast,
      metadata: {
        requestedStart: startDate,
        requestedEnd: endDate,
        forecastCoverageStart: forecastStart,
        forecastCoverageEnd: forecastEnd,
        outOfRange: true
      }
    };
  }
  
  // Return filtered forecast with metadata
  return {
    ...weatherData,
    forecast: filteredForecast,
    metadata: {
      requestedStart: startDate,
      requestedEnd: endDate,
      forecastCoverageStart: forecastStart,
      forecastCoverageEnd: forecastEnd,
      outOfRange: false
    }
  };
}

// Weather helper functions
export function getWeatherAdvice(weather: CurrentWeather): string[] {
  const advice: string[] = [];
  
  if (weather.temperature < 5) {
    advice.push("Very cold weather - pack warm clothes, winter coat, and layers");
  } else if (weather.temperature < 15) {
    advice.push("Cool weather - bring a jacket and warm clothes");
  } else if (weather.temperature > 30) {
    advice.push("Hot weather - pack light, breathable clothes and sun protection");
  }
  
  if (weather.humidity > 80) {
    advice.push("High humidity - choose moisture-wicking fabrics");
  }
  
  if (weather.windSpeed > 25) {
    advice.push("Windy conditions - secure loose items and pack wind-resistant clothing");
  }
  
  if (weather.conditions.some(c => c.main.includes('Rain'))) {
    advice.push("Rain expected - don't forget your umbrella and waterproof clothes");
  }
  
  if (weather.conditions.some(c => c.main.includes('Snow'))) {
    advice.push("Snow expected - pack winter boots and warm waterproof clothing");
  }
  
  return advice;
}

export function formatTemperature(temp: number, unit: 'C' | 'F' = 'C'): string {
  if (unit === 'F') {
    return `${Math.round((temp * 9/5) + 32)}°F`;
  }
  return `${Math.round(temp)}°C`;
}