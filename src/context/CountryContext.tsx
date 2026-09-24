// ── Country Context ──────────────────────────────────────────────
// Holds the shopper's selected country (Jumia-style per-country
// storefront): the ISO2 persisted via services/country, plus the list
// of active countries fetched from the backend for the picker.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getCountryIso2, setCountryIso2 } from '@/services/country';
import { fetchCountries, type Country } from '@/services/locations';

interface CountryContextValue {
  /** Selected country ISO2, e.g. 'UG'. */
  countryIso2: string;
  /** Selected Country object (null until the countries list loads). */
  country: Country | null;
  /** All active countries for the picker. */
  countries: Country[];
  /** Display currency for the selected country (e.g. 'UGX'). */
  currencyCode: string;
  /** Persist + apply a new country. Caller should refetch catalog data. */
  setCountry: (iso2: string) => Promise<void>;
}

const CountryContext = createContext<CountryContextValue | undefined>(undefined);

export function CountryProvider({ children }: { children: ReactNode }) {
  const [countryIso2, setIso2] = useState('UG');
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    getCountryIso2().then(setIso2).catch(() => {});
    fetchCountries()
      .then(setCountries)
      .catch(() => {
        // Countries list is non-critical — picker simply stays empty
      });
  }, []);

  const setCountry = useCallback(async (iso2: string) => {
    const code = iso2.trim().toUpperCase();
    await setCountryIso2(code);
    setIso2(code);
  }, []);

  const country = useMemo(
    () => countries.find((c) => c.iso2.toUpperCase() === countryIso2) ?? null,
    [countries, countryIso2]
  );

  const value = useMemo<CountryContextValue>(() => ({
    countryIso2,
    country,
    countries,
    currencyCode: country?.currency_code || 'UGX',
    setCountry,
  }), [countryIso2, country, countries, setCountry]);

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry(): CountryContextValue {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error('useCountry must be used within a CountryProvider');
  return ctx;
}
