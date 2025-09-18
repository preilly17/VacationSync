from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
import re
from datetime import datetime, timedelta

# Validation helper functions
def validate_city_code(city_code):
    """Validate city code format (3 letters only)"""
    if not city_code or len(city_code) != 3 or not city_code.isalpha():
        raise ValueError("City code must be exactly 3 letters")
    return city_code.upper()

def validate_date(date_str, field_name):
    """Validate date format (YYYY-MM-DD)"""
    if not date_str or not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format")
    try:
        # Validate it's a real date
        datetime.strptime(date_str, '%Y-%m-%d')
        return date_str
    except ValueError:
        raise ValueError(f"{field_name} is not a valid date")

def validate_positive_int(value_str, field_name, min_val=1, max_val=30):
    """Validate positive integer within range"""
    if not value_str:
        raise ValueError(f"{field_name} is required")
    try:
        num = int(value_str)
        if num < min_val or num > max_val:
            raise ValueError(f"{field_name} must be between {min_val} and {max_val}")
        return num
    except (ValueError, TypeError):
        if "must be between" not in str(ValueError):
            raise ValueError(f"{field_name} must be a valid integer")
        raise

def validate_latitude(lat_str):
    """Validate latitude (-90 to 90)"""
    if not lat_str:
        raise ValueError("Latitude is required")
    try:
        lat = float(lat_str)
        if lat < -90 or lat > 90:
            raise ValueError("Latitude must be between -90 and 90")
        return lat
    except (ValueError, TypeError):
        if "must be between" not in str(ValueError):
            raise ValueError("Latitude must be a valid number")
        raise

def validate_longitude(lng_str):
    """Validate longitude (-180 to 180)"""
    if not lng_str:
        raise ValueError("Longitude is required")
    try:
        lng = float(lng_str)
        if lng < -180 or lng > 180:
            raise ValueError("Longitude must be between -180 and 180")
        return lng
    except (ValueError, TypeError):
        if "must be between" not in str(ValueError):
            raise ValueError("Longitude must be a valid number")
        raise

def validate_radius(radius_str):
    """Validate radius (1 to 100 km)"""
    if not radius_str:
        return 20  # Default value
    try:
        radius = int(radius_str)
        if radius < 1 or radius > 100:
            raise ValueError("Radius must be between 1 and 100 km")
        return radius
    except (ValueError, TypeError):
        if "must be between" not in str(ValueError):
            raise ValueError("Radius must be a valid integer")
        raise

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────────────────────────────────────
# Amadeus API Configuration - Production environment (defaults)
# You can override these via Replit Secrets: AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, AMADEUS_ENV, AMADEUS_BASE_URL
AMADEUS_CLIENT_ID = os.getenv("AMADEUS_CLIENT_ID", "gLMZMGd7DFvPtVG4e5op8vkCnVtZmUaF")
AMADEUS_CLIENT_SECRET = os.getenv("AMADEUS_CLIENT_SECRET", "WAv0oWouLj1MYL8A")
# AMADEUS_ENV can be "prod" or "test"
AMADEUS_ENV = os.getenv("AMADEUS_ENV", "prod").lower()
AMADEUS_BASE_URL = os.getenv(
    "AMADEUS_BASE_URL",
    "https://api.amadeus.com" if AMADEUS_ENV == "prod" else "https://test.api.amadeus.com"
)
# ─────────────────────────────────────────────────────────────────────────────

# Global access token storage
access_token = None
token_expires_at = None

def get_amadeus_token():
    """Get a valid Amadeus API access token (cached with expiry buffer)."""
    global access_token, token_expires_at

    # Return cached token if still valid
    if access_token and token_expires_at and datetime.now() < token_expires_at:
        return access_token

    token_url = f"{AMADEUS_BASE_URL}/v1/security/oauth2/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": AMADEUS_CLIENT_ID,
        "client_secret": AMADEUS_CLIENT_SECRET
    }

    try:
        resp = requests.post(token_url, headers=headers, data=data, timeout=15)
        resp.raise_for_status()
        token_data = resp.json()
        new_token = token_data["access_token"]
        expires_in = int(token_data.get("expires_in", 1800))  # seconds
        # buffer of 5 minutes
        expiry = datetime.now() + timedelta(seconds=max(expires_in - 300, 60))
        access_token, token_expires_at = new_token, expiry
        print(f"[Amadeus] New token obtained; expires at {token_expires_at} (env={AMADEUS_ENV})")
        return access_token
    except requests.exceptions.RequestException as e:
        print(f"[Amadeus] Error obtaining token: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"[Amadeus] Response: {e.response.text}")
        return None

def make_amadeus_request(endpoint, params=None):
    """Make an authenticated GET request to Amadeus."""
    token = get_amadeus_token()
    if not token:
        return None

    url = f"{AMADEUS_BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        print(f"[Amadeus] API error: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"[Amadeus] Response: {e.response.text}")
        return None

# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/search/flights", methods=["GET"])
def search_flights():
    """Search for flight offers using Amadeus Flight Offers (v2)."""
    try:
        origin = request.args.get("origin")
        destination = request.args.get("destination")
        departure_date = request.args.get("departureDate")
        return_date = request.args.get("returnDate")
        adults = request.args.get("adults", "1")
        travel_class = request.args.get("travelClass", "ECONOMY")
        airline = request.args.get("airline")
        
        print(f"🔍 AIRLINE DEBUG: Received airline parameter: {airline}")

        if not all([origin, destination, departure_date]):
            return jsonify({
                "success": False,
                "error": "Missing required parameters",
                "required": ["origin", "destination", "departureDate"]
            }), 400

        params = {
            "originLocationCode": origin.upper(),
            "destinationLocationCode": destination.upper(),
            "departureDate": departure_date,
            "adults": adults,
            "travelClass": travel_class.upper(),
            "currencyCode": "USD",
            "max": 50
        }
        if return_date:
            params["returnDate"] = return_date
        if airline:
            params["includedAirlineCodes"] = airline.upper()
            print(f"🔍 AIRLINE DEBUG: Added includedAirlineCodes={airline.upper()} to Amadeus params")

        print(f"[Flights] {origin} -> {destination} on {departure_date} (return: {return_date})")
        if airline:
            print(f"🔍 AIRLINE DEBUG: Filtering for airline: {airline}")
        result = make_amadeus_request("/v2/shopping/flight-offers", params)

        if result and "data" in result:
            return jsonify({"success": True, "data": result["data"], "meta": result.get("meta", {}), "source": "Amadeus"})
        else:
            return jsonify({"success": False, "error": "No flights found"}), 404

    except Exception as e:
        print(f"[Flights] Error: {e}")
        return jsonify({"success": False, "error": "Internal server error", "message": str(e)}), 500

@app.route("/search/hotels", methods=["GET"])
def search_hotels():
    """Search for hotel offers using Amadeus Hotel Offers (v3) with validation."""
    try:
        # Validate input parameters
        city_code = request.args.get("cityCode")
        check_in = request.args.get("checkInDate")
        check_out = request.args.get("checkOutDate")
        adults_str = request.args.get("adults", "1")
        room_qty_str = request.args.get("roomQuantity", "1")

        # Required parameter validation
        if not all([city_code, check_in, check_out]):
            return jsonify({
                "success": False,
                "error": "Missing required parameters",
                "required": ["cityCode", "checkInDate", "checkOutDate"]
            }), 400
        
        # Validate each parameter with proper error handling
        try:
            validated_city_code = validate_city_code(city_code)
            validated_check_in = validate_date(check_in, "checkInDate")
            validated_check_out = validate_date(check_out, "checkOutDate")
            validated_adults = validate_positive_int(adults_str, "adults", 1, 30)
            validated_room_qty = validate_positive_int(room_qty_str, "roomQuantity", 1, 10)
        except ValueError as validation_error:
            return jsonify({
                "success": False,
                "error": "Invalid parameter",
                "message": str(validation_error)
            }), 400

        params = {
            "cityCode": validated_city_code,
            "checkInDate": validated_check_in,
            "checkOutDate": validated_check_out,
            "adults": str(validated_adults),
            "roomQuantity": str(validated_room_qty),
            # Optional: "ratings": "3,4,5", "amenities": "WIFI,PARKING"
        }

        print(f"[Hotels] {validated_city_code} {validated_check_in} → {validated_check_out}")
        result = make_amadeus_request("/v3/shopping/hotel-offers", params)

        if result and "data" in result:
            return jsonify({"success": True, "data": result["data"], "meta": result.get("meta", {}), "source": "Amadeus"})
        else:
            return jsonify({"success": False, "error": "No hotels found"}), 404

    except Exception as e:
        print(f"[Hotels] Error: {e}")
        return jsonify({"success": False, "error": "Internal server error", "message": str(e)}), 500

@app.route("/search/activities", methods=["GET"])
def search_activities():
    """Search for activities using Amadeus Activities (v1) with validation."""
    try:
        # Get input parameters
        latitude_str = request.args.get("latitude")
        longitude_str = request.args.get("longitude")
        radius_str = request.args.get("radius", "20")

        # Required parameter validation
        if not all([latitude_str, longitude_str]):
            return jsonify({
                "success": False,
                "error": "Missing required parameters",
                "required": ["latitude", "longitude"]
            }), 400
        
        # Validate each parameter with proper error handling
        try:
            validated_latitude = validate_latitude(latitude_str)
            validated_longitude = validate_longitude(longitude_str)
            validated_radius = validate_radius(radius_str)
        except ValueError as validation_error:
            return jsonify({
                "success": False,
                "error": "Invalid parameter",
                "message": str(validation_error)
            }), 400

        params = {
            "latitude": validated_latitude,
            "longitude": validated_longitude,
            "radius": str(validated_radius)
        }

        print(f"[Activities] lat={validated_latitude}, lon={validated_longitude}, r={validated_radius}km")
        result = make_amadeus_request("/v1/shopping/activities", params)

        if result and "data" in result:
            return jsonify({"success": True, "data": result["data"], "meta": result.get("meta", {}), "source": "Amadeus"})
        else:
            return jsonify({"success": False, "error": "No activities found"}), 404

    except Exception as e:
        print(f"[Activities] Error: {e}")
        return jsonify({"success": False, "error": "Internal server error", "message": str(e)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    """Health check with token status and timestamp."""
    token = get_amadeus_token()
    return jsonify({
        "status": "healthy",
        "amadeus_env": AMADEUS_ENV,
        "amadeus_token": "valid" if token else "invalid",
        "timestamp": datetime.now().isoformat()
    })

@app.route("/", methods=["GET"])
def index():
    """API information endpoint."""
    return jsonify({
        "name": "TripSync Amadeus API Backend",
        "version": "1.0.1",
        "endpoints": {
            "/search/flights": "Search flight offers",
            "/search/hotels": "Search hotel offers",
            "/search/activities": "Search activities",
            "/health": "Health check"
        },
        "amadeus_base_url": AMADEUS_BASE_URL,
        "env": AMADEUS_ENV
    })

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "3000"))
    print(f"Starting TripSync Amadeus API Backend on {host}:{port} ...")
    print("Endpoints:")
    print("  GET /search/flights?origin=JFK&destination=LAX&departureDate=2025-08-20")
    print("  GET /search/hotels?cityCode=LAX&checkInDate=2025-08-20&checkOutDate=2025-08-22")
    print("  GET /search/activities?latitude=40.7128&longitude=-74.0060")
    print("  GET /health")
    app.run(debug=True, host=host, port=port)
