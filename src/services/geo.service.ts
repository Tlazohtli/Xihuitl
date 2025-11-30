import * as GeoTZ from 'geo-tz';

interface OpenMeteoResult {
    name?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    country?: string;
    admin1?: string;
    admin2?: string;
}

export const getTimezoneFromCity = async (
    city: string
): Promise<{ timezone: string; address: string } | null> => {
    try {
        const params = new URLSearchParams({
            name: city,
            count: '1',
            language: 'en',
            format: 'json'
        });

        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
        if (!response.ok) {
            console.error("Geo Error: Unable to query Open-Meteo geocoding API", response.statusText);
            return null;
        }

        const data = await response.json() as { results?: OpenMeteoResult[] };
        const result = data.results && data.results[0];

        if (!result || !result.latitude || !result.longitude) return null;

        const timezone =
            result.timezone ||
            (GeoTZ.find(result.latitude, result.longitude)?.[0] ?? null);

        if (!timezone) return null;

        const addressParts = [...new Set([result.name, result.admin2,result.admin1, result.country].filter(Boolean))];
        const address = addressParts.length > 0 ? addressParts.join(', ') : city;

        return {
            timezone,
            address
        };
    } catch (error) {
        console.error("Geo Error:", error);
        return null;
    }
};
