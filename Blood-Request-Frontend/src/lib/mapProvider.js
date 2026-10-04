// Map provider preference (OSM <-> Google) — no Google imports here,
// so this module stays tiny and safe to import anywhere.
const PROVIDER_KEY = 'tnbb-map-provider'

// Office location shown on the contact page (same point as the OSM embed).
export const OFFICE_CENTER = { lat: 13.081, lng: 80.2694 }
export const OFFICE_ZOOM = 15

export function getGoogleMapsKey() {
  const raw = import.meta.env.VITE_GOOGLE_MAPS_KEY
  const key = String(raw ?? '').trim()
  return key.length > 0 ? key : ''
}

export function storedMapProvider() {
  try {
    return localStorage.getItem(PROVIDER_KEY) === 'google' ? 'google' : 'osm'
  } catch {
    return 'osm'
  }
}

export function storeMapProvider(p) {
  try {
    localStorage.setItem(PROVIDER_KEY, p)
  } catch {
    // storage unavailable — session default stays
  }
}

export default { storedMapProvider, storeMapProvider }
