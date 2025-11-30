import axios from 'axios';
import { locationTimezoneService } from './timezone.service';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const geocodeUrlBase = `https://maps.googleapis.com/maps/api/geocode/json?key=${GOOGLE_API_KEY}`;
const timezoneUrlBase = `https://maps.googleapis.com/maps/api/timezone/json?key=${GOOGLE_API_KEY}`;

interface GoogleGeocodeResponse {
    results: Array<{
        formatted_address: string;
        geometry: {
            location: {
                lat: number;
                lng: number;
            };
        };
    }>;
    status: string;
}

interface GoogleTimezoneResponse {
    timeZoneId: string;
    timeZoneName: string;
    status: string;
}

/**
 * Sanitize location input to improve matching and prevent abuse
 * Removes special characters, brackets, digits, and normalizes whitespace
 */
function sanitizeLocation(location: string): string {
    return location
        .replace(/[<>\[\]()]/gi, '') // Remove brackets and angle brackets
        .replace(/[_　]+/gi, ' ')    // Replace underscores and full-width spaces with regular space
        .replace(/[@!?\d]*/gi, '')   // Remove @ ! ? and digits
        .trim();
}

/**
 * Get timezone and formatted address for a location using Google Maps API
 * Results are stored in DynamoDB to minimize API calls
 */
export const getTimezoneFromLocation = async (
    location: string
): Promise<{ timezone: string; address: string } | null> => {
    try {
        if (!location) {
            return null;
        }

        if (!GOOGLE_API_KEY) {
            console.error('GOOGLE_API_KEY not set in environment');
            return null;
        }

        // Sanitize the input
        const sanitizedLocation = sanitizeLocation(location);
        if (!sanitizedLocation) {
            return null;
        }

        // Check if location is already stored
        const stored = await locationTimezoneService.getLocation(sanitizedLocation);
        if (stored) {
            console.log(`Found stored location: ${sanitizedLocation}`);
            return {
                timezone: stored.timezone,
                address: stored.display_location
            };
        }

        // Make API request for geocoding
        console.log(`Making Google Geocoding API request for: ${sanitizedLocation}`);
        const geocodeUrl = `${geocodeUrlBase}&address=${encodeURIComponent(sanitizedLocation)}`;
        const geocodeResponse = await axios.get<GoogleGeocodeResponse>(geocodeUrl);

        if (!geocodeResponse.data.results || geocodeResponse.data.results.length === 0) {
            console.log(`No geocoding results for: ${sanitizedLocation}`);
            return null;
        }

        const geocodeResult = geocodeResponse.data.results[0];
        const { lat, lng } = geocodeResult.geometry.location;
        const formattedAddress = geocodeResult.formatted_address;

        // Make API request for timezone
        const timestamp = Math.floor(Date.now() / 1000);
        const timezoneUrl = `${timezoneUrlBase}&location=${lat},${lng}&timestamp=${timestamp}`;
        const timezoneResponse = await axios.get<GoogleTimezoneResponse>(timezoneUrl);

        if (timezoneResponse.data.status !== 'OK') {
            console.log(`Timezone API failed for ${lat},${lng}: ${timezoneResponse.data.status}`);
            return null;
        }

        const timezone = timezoneResponse.data.timeZoneId;

        // Store the result for future lookups
        await locationTimezoneService.setLocation(sanitizedLocation, timezone, formattedAddress);

        return {
            timezone,
            address: formattedAddress
        };
    } catch (error) {
        console.error('Geo Error:', error);
        return null;
    }
};
