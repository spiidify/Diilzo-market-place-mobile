// ── Location Service ─────────────────────────────────────────────
// API functions for the Alibaba-style location hierarchy.
// Used by seller onboarding, address forms, and search filters.

import { apiRequest } from './api';

// ── Types ────────────────────────────────────────────────────────

export interface Country {
  id: number;
  iso2: string;
  iso3: string;
  name: string;
  phone_code: string;
  currency_code: string;
  currency_name: string;
  continent: string;
  is_active: boolean;
}

export interface Region {
  id: number;
  country: number;
  country_code: string;
  country_name: string;
  code: string;
  name: string;
  region_type: string;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
}

export interface City {
  id: number;
  region: number;
  region_name: string;
  country_code: string;
  country_name: string;
  geoname_id: number;
  name: string;
  latitude: string | null;
  longitude: string | null;
  population: number;
  timezone: string;
  is_active: boolean;
}

export interface District {
  id: number;
  city: number;
  city_name: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
}

export interface LocationSearchResult {
  level: 'country' | 'region' | 'city';
  id: number;
  name: string;
  iso2?: string;
  iso3?: string;
  code?: string;
  country?: string;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
  source: 'mapbox' | 'nominatim';
}

// ── API Functions ────────────────────────────────────────────────

/** GET /locations/countries/ — list all active countries */
export async function fetchCountries(continent?: string): Promise<Country[]> {
  const params: Record<string, string> = {};
  if (continent) params.continent = continent;
  return apiRequest<Country[]>({
    method: 'GET',
    url: '/locations/countries/',
    params,
  });
}

/** GET /locations/regions/?country=UG — list regions for a country */
export async function fetchRegions(countryIso2: string): Promise<Region[]> {
  return apiRequest<Region[]>({
    method: 'GET',
    url: '/locations/regions/',
    params: { country: countryIso2 },
  });
}

/** GET /locations/cities/?region=<id> — list cities for a region */
export async function fetchCitiesByRegion(regionId: number): Promise<City[]> {
  return apiRequest<City[]>({
    method: 'GET',
    url: '/locations/cities/',
    params: { region: regionId },
  });
}

/** GET /locations/cities/?country=UG — list cities for a country */
export async function fetchCitiesByCountry(countryIso2: string, q?: string): Promise<City[]> {
  const params: Record<string, string> = { country: countryIso2 };
  if (q) params.q = q;
  return apiRequest<City[]>({
    method: 'GET',
    url: '/locations/cities/',
    params,
  });
}

/** GET /locations/districts/?city=<id> — list districts for a city */
export async function fetchDistricts(cityId: number): Promise<District[]> {
  return apiRequest<District[]>({
    method: 'GET',
    url: '/locations/districts/',
    params: { city: cityId },
  });
}

/** GET /locations/search/?q=kampala — global autocomplete */
export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  if (query.trim().length < 2) return [];
  const data = await apiRequest<{ results: LocationSearchResult[] }>({
    method: 'GET',
    url: '/locations/search/',
    params: { q: query.trim() },
  });
  return data.results || [];
}

/** GET /locations/geocode/?q=kampala+uganda — geocode address to lat/lng */
export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  return apiRequest<GeocodeResult>({
    method: 'GET',
    url: '/locations/geocode/',
    params: { q: query.trim() },
  });
}
