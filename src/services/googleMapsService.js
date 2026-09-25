import logger from '../utils/logger.js';

/**
 * Modern Google Places API (New) Autocomplete
 * Endpoint: https://places.googleapis.com/v1/places:autocomplete
 */
export const searchPlaces = async (input) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  if (!input || !input.trim() || !apiKey) {
    return [];
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey.trim(),
      },
      body: JSON.stringify({
        input: input.trim(),
        includedRegionCodes: ['IN'],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn(`[GoogleMapsService] Places (New) autocomplete error: ${errText}`);
      return [];
    }

    const data = await response.json();
    const suggestions = data.suggestions || [];

    return suggestions
      .filter((s) => s.placePrediction)
      .map((s) => ({
        placeId: s.placePrediction.placeId,
        text: s.placePrediction.text?.text || '',
        mainText: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || '',
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || '',
      }));
  } catch (error) {
    logger.error(`[GoogleMapsService] Places search error: ${error.message}`);
    return [];
  }
};

/**
 * Modern Google Places API (New) Details
 * Endpoint: https://places.googleapis.com/v1/places/{placeId}
 */
export const getPlaceDetails = async (placeId) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  if (!placeId || !apiKey) {
    return null;
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(
      placeId
    )}?fields=id,displayName,formattedAddress,location&key=${encodeURIComponent(apiKey.trim())}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) {
      const errText = await response.text();
      logger.warn(`[GoogleMapsService] Places (New) details error: ${errText}`);
      return null;
    }

    const data = await response.json();
    return {
      placeId: data.id || placeId,
      name: data.displayName?.text || data.formattedAddress || '',
      formattedAddress: data.formattedAddress || data.displayName?.text || '',
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
    };
  } catch (error) {
    logger.error(`[GoogleMapsService] Place details error: ${error.message}`);
    return null;
  }
};

/**
 * Server-side Google Maps Routes Service
 *
 * Implements the Google Routes API (computeRoutes) with traffic awareness,
 * legacy Directions API fallback, and geodesic highway driving estimation fallback.
 * Reads GOOGLE_MAPS_API_KEY securely from backend environment.
 */
/**
 * Server-side Google Maps Routes Service
 *
 * Implements the Google Routes API (computeRoutes) supporting:
 * - CAR (DRIVE with traffic awareness)
 * - BIKE (TWO_WHEELER with traffic awareness)
 * - BUS (TRANSIT with BUS preference)
 * - TRAIN (TRANSIT with TRAIN preference)
 */
export const calculateRoute = async ({
  origin,
  destination,
  travelMode = 'CAR',
  transitMode = null,
}) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  const originLat = Number(origin?.latitude);
  const originLng = Number(origin?.longitude);
  const destLat = Number(destination?.latitude);
  const destLng = Number(destination?.longitude);

  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    throw new Error('Invalid origin or destination coordinates.');
  }

  const normalizedMode = (travelMode || 'CAR').toUpperCase();

  // If no server API key configured, compute geodesic distance fallback
  if (!apiKey || !apiKey.trim()) {
    logger.warn('[GoogleMapsService] No GOOGLE_MAPS_API_KEY configured on server.');
    return calculateFallbackRoute({ originLat, originLng, destLat, destLng, travelMode: normalizedMode });
  }

  // 1. Try Google Routes API v2
  try {
    let googleTravelMode = 'DRIVE';
    let routingPreference = undefined;
    let transitPreferences = undefined;

    if (normalizedMode === 'BIKE' || normalizedMode === 'TWO_WHEELER') {
      googleTravelMode = 'TWO_WHEELER';
      routingPreference = 'TRAFFIC_AWARE';
    } else if (normalizedMode === 'BUS') {
      googleTravelMode = 'TRANSIT';
      transitPreferences = { allowedTravelModes: ['BUS'] };
    } else if (normalizedMode === 'TRAIN') {
      googleTravelMode = 'TRANSIT';
      transitPreferences = { allowedTravelModes: ['TRAIN'] };
    } else if (normalizedMode === 'TRANSIT') {
      googleTravelMode = 'TRANSIT';
      if (transitMode) {
        transitPreferences = { allowedTravelModes: [transitMode.toUpperCase()] };
      }
    } else {
      googleTravelMode = 'DRIVE';
      routingPreference = 'TRAFFIC_AWARE';
    }

    const routesBody = {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destLat,
            longitude: destLng,
          },
        },
      },
      travelMode: googleTravelMode,
    };

    if (routingPreference) {
      routesBody.routingPreference = routingPreference;
    }
    if (transitPreferences) {
      routesBody.transitPreferences = transitPreferences;
    }

    const fieldMask =
      googleTravelMode === 'TRANSIT'
        ? 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.transitDetails'
        : 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline';

    const routesResponse = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey.trim(),
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(routesBody),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (routesResponse.ok) {
      const routesData = await routesResponse.json();
      if (routesData.routes && routesData.routes.length > 0) {
        const route = routesData.routes[0];
        const distanceMeters = route.distanceMeters || 0;
        const distanceKm = Math.round(distanceMeters / 1000);

        // duration format: "17624s" or integer
        const durationSecStr = String(route.duration || '0').replace('s', '');
        const durationSeconds = parseInt(durationSecStr, 10) || 0;

        const durH = Math.floor(durationSeconds / 3600);
        const durM = Math.round((durationSeconds % 3600) / 60);
        const durationText = durH > 0 ? `${durH} hr ${durM} min` : `${durM} min`;

        // Extract transit info if transit route
        let transitInfo = [];
        if (googleTravelMode === 'TRANSIT' && route.legs?.[0]?.steps) {
          const rawSteps = route.legs[0].steps.map((s) => s.transitDetails).filter(Boolean);
          transitInfo = rawSteps.map((t) => ({
            lineName: t.transitLine?.name || t.transitLine?.nameShort || '',
            vehicleType: t.transitLine?.vehicle?.name?.text || t.transitLine?.vehicle?.type || 'Transit',
            departureStop: t.stopDetails?.departureStop?.name || '',
            arrivalStop: t.stopDetails?.arrivalStop?.name || '',
            stopCount: t.stopCount || 0,
            headsign: t.headsign || '',
          }));
        }

        logger.info(
          `[GoogleMapsService] Routes API success for ${normalizedMode}: ${distanceKm} km, ${durationText}`
        );

        return {
          success: true,
          distanceMeters,
          distanceKm,
          durationSeconds,
          durationText,
          trafficAware: Boolean(routingPreference === 'TRAFFIC_AWARE'),
          travelMode: normalizedMode,
          transitInfo,
          overviewPolyline: route.polyline?.encodedPolyline || '',
        };
      } else {
        // Handle specific mode errors gracefully without silent fallbacks
        if (normalizedMode === 'BUS') {
          throw new Error('No bus route is currently available for this journey.');
        }
        if (normalizedMode === 'TRAIN') {
          throw new Error('No train route is currently available for this journey.');
        }
        if (normalizedMode === 'BIKE' || normalizedMode === 'TWO_WHEELER') {
          throw new Error('Two-wheeler routing is currently unavailable for this journey.');
        }
      }
    } else {
      const errJson = await routesResponse.json().catch(() => ({}));
      logger.warn(`[GoogleMapsService] Routes API returned status ${routesResponse.status}: ${JSON.stringify(errJson)}`);
      if (normalizedMode === 'BUS') {
        throw new Error('No bus route is currently available for this journey.');
      }
      if (normalizedMode === 'TRAIN') {
        throw new Error('No train route is currently available for this journey.');
      }
      if (normalizedMode === 'BIKE') {
        throw new Error('Two-wheeler routing is currently unavailable for this journey.');
      }
    }
  } catch (routesErr) {
    if (
      routesErr.message.includes('No bus route') ||
      routesErr.message.includes('No train route') ||
      routesErr.message.includes('Two-wheeler routing')
    ) {
      throw routesErr;
    }
    logger.warn(`[GoogleMapsService] Routes API v2 error: ${routesErr.message}`);
  }

  // 2. Fallback only for CAR if Google API quota is exceeded or network is offline
  if (normalizedMode === 'CAR') {
    return calculateFallbackRoute({ originLat, originLng, destLat, destLng, travelMode: 'CAR' });
  }

  throw new Error(`Route calculation is currently unavailable for ${normalizedMode}.`);
};

/**
 * Fallback route estimation using Haversine formula and average highway driving speed (55 km/h)
 * Used when Directions/Routes APIs are restricted or network is offline.
 */
function calculateFallbackRoute({ originLat, originLng, destLat, destLng }) {
  const R = 6371; // Earth radius in km
  const dLat = ((destLat - originLat) * Math.PI) / 180;
  const dLng = ((destLng - originLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((originLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;

  // Real road driving distance is approximately 1.3x straight-line distance
  const roadDistanceKm = Math.round(straightLineKm * 1.3);
  const distanceMeters = roadDistanceKm * 1000;

  // Assuming average road speed of 55 km/h for pilgrimage highways
  const hours = roadDistanceKm / 55;
  const durationSeconds = Math.round(hours * 3600);
  const durH = Math.floor(hours);
  const durM = Math.round((hours - durH) * 60);
  const durationText = durH > 0 ? `${durH} hr ${durM} min` : `${durM} min`;

  return {
    success: true,
    distanceMeters,
    distanceKm: roadDistanceKm,
    durationSeconds,
    durationText,
    trafficAware: false,
    travelMode: 'DRIVING',
    overviewPolyline: '',
  };
}

export default {
  calculateRoute,
  searchPlaces,
  getPlaceDetails,
};
