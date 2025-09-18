# TripSync Amadeus API Backend

A Python Flask backend that integrates exclusively with the Amadeus Global Distribution System API for travel data.

## Features

- **Flight Search**: Live flight offers using Amadeus v2/shopping/flight-offers
- **Hotel Search**: Hotel listings by city using Amadeus reference data
- **Activities Search**: Activities and attractions using Amadeus activities API
- **Token Management**: Automatic OAuth2 token refresh
- **CORS Support**: Ready for frontend integration

## API Endpoints

### GET /search/flights
Search for flight offers
```
Parameters:
- origin (required): IATA airport code (e.g., JFK)
- destination (required): IATA airport code (e.g., LAX)  
- departureDate (required): Date in YYYY-MM-DD format
- returnDate (optional): Return date for round-trip
- adults (optional): Number of passengers (default: 1)
- travelClass (optional): ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST

Example:
GET /search/flights?origin=JFK&destination=LAX&departureDate=2025-08-01&adults=2
```

### GET /search/hotels
Search for hotel offers
```
Parameters:
- cityCode (required): IATA city code (e.g., NYC)
- checkInDate (required): Date in YYYY-MM-DD format
- checkOutDate (required): Date in YYYY-MM-DD format
- adults (optional): Number of guests (default: 1)
- radius (optional): Search radius in KM (default: 20)

Example:
GET /search/hotels?cityCode=NYC&checkInDate=2025-08-01&checkOutDate=2025-08-05
```

### GET /search/activities
Search for activities and attractions
```
Parameters:
- latitude (required): Latitude coordinate
- longitude (required): Longitude coordinate
- radius (optional): Search radius in KM (default: 20)

Example:
GET /search/activities?latitude=40.7128&longitude=-74.0060&radius=25
```

### GET /health
Health check and API status

## Running the Application

1. Install dependencies:
```bash
cd flask_backend
pip install -r requirements.txt
```

2. Start the server:
```bash
python app.py
```

The server will start on port 3000 at http://localhost:3000

## Configuration

The application uses your Amadeus test API credentials:
- Client ID: pGIvETojRHx7Sxs6pyYefMP8KCY1E8oH
- Environment: Amadeus Test API (test.api.amadeus.com)

## Response Format

All endpoints return JSON with this structure:
```json
{
  "success": true,
  "data": [...],
  "meta": {...},
  "source": "Amadeus API"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```