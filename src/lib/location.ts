import * as Location from 'expo-location';

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  address: string | null;
  postalCode: string | null;
  place: string | null;
};

function formatGeocodedAddress(place: Location.LocationGeocodedAddress): string | null {
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
  const city = place.city || place.subregion || place.district;
  const regionPostal = [place.region, place.postalCode].filter(Boolean).join(' ').trim();
  const parts = [street || place.name, city, regionPostal].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Requests foreground location permission and reads the device's GPS coordinates plus an optional
 * reverse-geocoded street address. Returns `null` if permission is denied or location is unavailable.
 */
export async function detectDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const latitude = Number(position.coords.latitude.toFixed(6));
    const longitude = Number(position.coords.longitude.toFixed(6));

    return { latitude, longitude, ...(await reverseGeocodeLocation(latitude, longitude)) };
  } catch {
    return null;
  }
}

/**
 * The street address, postal code and place name at `(latitude, longitude)`, e.g. for a pin placed
 * on the map. Each is `null` when unknown: reverse geocoding can be unavailable offline or on web.
 */
export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<Pick<DeviceLocation, 'address' | 'postalCode' | 'place'>> {
  try {
    const first = (await Location.reverseGeocodeAsync({ latitude, longitude }))[0];
    if (first) {
      return {
        address: formatGeocodedAddress(first),
        postalCode: first.postalCode ?? null,
        place: first.district || first.street || first.city || first.name || null,
      };
    }
  } catch {
    // Coordinates stay valid without an address.
  }
  return { address: null, postalCode: null, place: null };
}

/**
 * Coordinates for a typed address, e.g. a spot seen while driving. Addresses without a city are
 * looked up in Montréal. `null` when nothing is found or geocoding is unavailable.
 */
export async function geocodeAddress(
  query: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const text = query.trim();
  if (!text) return null;
  const withCity = /montr[ée]al/i.test(text) ? text : `${text}, Montréal, QC`;
  try {
    const first = (await Location.geocodeAsync(withCity))[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch {
    return null;
  }
}
