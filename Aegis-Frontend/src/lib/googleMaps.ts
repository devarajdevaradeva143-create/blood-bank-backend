// Shared Google Maps helpers — key comes from .env (user-managed), never hardcoded.
const _rawKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
export const GOOGLE_MAPS_KEY = _rawKey?.trim() ? _rawKey.trim() : '';

export function hasGoogleMapsKey(): boolean {
  return GOOGLE_MAPS_KEY.length > 0;
}

export const MAP_PROVIDER_KEY = 'aegis-map-provider';

export type MapProvider = 'osm' | 'google';

export function storedMapProvider(): MapProvider {
  try {
    return localStorage.getItem(MAP_PROVIDER_KEY) === 'google' ? 'google' : 'osm';
  } catch {
    return 'osm';
  }
}

export function storeMapProvider(p: MapProvider): void {
  try {
    localStorage.setItem(MAP_PROVIDER_KEY, p);
  } catch {
    // storage unavailable (private mode) — session default stays
  }
}

/** Colored dot marker matching the Leaflet dot style (circle + optional order number). */
export function googleMarkerIcon(color: string, label?: string): google.maps.Icon {
  const inner = label
    ? `<text x="11" y="15" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${label}</text>`
    : `<circle cx="11" cy="11" r="4" fill="#fff"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">` +
    `<circle cx="11" cy="11" r="10" fill="${color}" stroke="#fff" stroke-width="2"/>${inner}</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    // eslint-disable-next-line no-undef
    scaledSize: new google.maps.Size(22, 22),
    // eslint-disable-next-line no-undef
    anchor: new google.maps.Point(11, 11),
  };
}
