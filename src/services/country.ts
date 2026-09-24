// ── Country Selection Service ────────────────────────────────────
// Persists the shopper's selected country (ISO2) in AsyncStorage and
// exposes it to the API client (X-Country-Code header) so the backend
// can scope catalogs and currencies per country — Jumia-style.

import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTRY_KEY = 'diilzo_country_iso2';
const DEFAULT_COUNTRY = 'UG';

// In-memory cache — the request interceptor reads this on every API
// call; AsyncStorage would be a native round-trip each time.
let memCache: string | null = null;

/** Current selected country ISO2 (e.g. 'UG'). Defaults to 'UG'. */
export async function getCountryIso2(): Promise<string> {
  if (memCache) return memCache;
  try {
    memCache = (await AsyncStorage.getItem(COUNTRY_KEY)) || DEFAULT_COUNTRY;
  } catch {
    memCache = DEFAULT_COUNTRY;
  }
  return memCache;
}

/** Persist a new selected country. Subsequent API calls pick it up. */
export async function setCountryIso2(iso2: string): Promise<void> {
  memCache = iso2.trim().toUpperCase() || DEFAULT_COUNTRY;
  try {
    await AsyncStorage.setItem(COUNTRY_KEY, memCache);
  } catch {
    // ignore — in-memory value still applies for this session
  }
}
