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

    let address: string | null = null;
    let postalCode: string | null = null;
    let place: string | null = null;

    try {
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = geocoded[0];
      if (first) {
        address = formatGeocodedAddress(first);
        postalCode = first.postalCode ?? null;
        place = first.district || first.street || first.city || first.name || null;
      }
    } catch {
      // Reverse geocoding can be unavailable offline or on web; coordinates are still valid.
    }

    return { latitude, longitude, address, postalCode, place };
  } catch {
    return null;
  }
}
