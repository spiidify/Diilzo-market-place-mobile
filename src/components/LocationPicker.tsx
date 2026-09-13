// ── Location Picker Component ─────────────────────────────────────
// Reusable cascading location selector: Country → Region → City.
// Used by seller onboarding, address forms, and store settings.
// Follows the Alibaba-style hierarchy from apps/locations.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import {
  City,
  Country,
  Region,
  fetchCitiesByCountry,
  fetchCitiesByRegion,
  fetchCountries,
  fetchRegions,
} from '@/services/locations';

interface LocationValue {
  country_ref?: number | null;
  region_ref?: number | null;
  city_ref?: number | null;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (val: LocationValue) => void;
  label?: string;
}

type PickerLevel = 'country' | 'region' | 'city';

export function LocationPicker({ value, onChange, label = 'Location' }: LocationPickerProps) {
  const [modalLevel, setModalLevel] = useState<PickerLevel | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected display names
  const [selCountry, setSelCountry] = useState<Country | null>(null);
  const [selRegion, setSelRegion] = useState<Region | null>(null);
  const [selCity, setSelCity] = useState<City | null>(null);

  // Load countries on mount
  useEffect(() => {
    fetchCountries().then(setCountries).catch(() => { });
  }, []);

  // Resolve display names from current value
  useEffect(() => {
    if (value.country_ref && countries.length > 0) {
      const c = countries.find((c) => c.id === value.country_ref);
      setSelCountry(c || null);
    } else {
      setSelCountry(null);
    }
  }, [value.country_ref, countries]);

  useEffect(() => {
    if (value.region_ref && regions.length > 0) {
      const r = regions.find((r) => r.id === value.region_ref);
      setSelRegion(r || null);
    } else {
      setSelRegion(null);
    }
  }, [value.region_ref, regions]);

  useEffect(() => {
    if (value.city_ref && cities.length > 0) {
      const c = cities.find((c) => c.id === value.city_ref);
      setSelCity(c || null);
    } else {
      setSelCity(null);
    }
  }, [value.city_ref, cities]);

  // Load regions when a country is selected
  const loadRegions = useCallback(async (countryIso2: string) => {
    setLoading(true);
    try {
      const data = await fetchRegions(countryIso2);
      setRegions(data);
    } catch {
      setRegions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load cities when a region is selected
  const loadCities = useCallback(async (regionId: number) => {
    setLoading(true);
    try {
      const data = await fetchCitiesByRegion(regionId);
      setCities(data);
    } catch {
      setCities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Also load cities by country (for countries with few regions)
  const loadCitiesByCountry = useCallback(async (countryIso2: string, q?: string) => {
    setLoading(true);
    try {
      const data = await fetchCitiesByCountry(countryIso2, q);
      setCities(data);
    } catch {
      setCities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCountry = (c: Country) => {
    setSelCountry(c);
    setSelRegion(null);
    setSelCity(null);
    setRegions([]);
    setCities([]);
    onChange({
      country_ref: c.id,
      country: c.name,
      country_code: c.iso2,
      region_ref: null,
      region: '',
      city_ref: null,
      city: '',
      latitude: null,
      longitude: null,
    });
    loadRegions(c.iso2);
    setModalLevel(null);
    setSearchQuery('');
  };

  const selectRegion = (r: Region) => {
    setSelRegion(r);
    setSelCity(null);
    setCities([]);
    onChange({
      ...value,
      region_ref: r.id,
      region: r.name,
      city_ref: null,
      city: '',
      latitude: null,
      longitude: null,
    });
    loadCities(r.id);
    setModalLevel(null);
    setSearchQuery('');
  };

  const selectCity = (c: City) => {
    setSelCity(c);
    onChange({
      ...value,
      city_ref: c.id,
      city: c.name,
      latitude: c.latitude ? parseFloat(c.latitude) : null,
      longitude: c.longitude ? parseFloat(c.longitude) : null,
    });
    setModalLevel(null);
    setSearchQuery('');
  };

  // Filtered lists for search
  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRegions = regions.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderListItem = (item: any, label: string, sublabel: string, onPress: () => void) => (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listItemTitle}>{label}</Text>
        {sublabel ? <Text style={styles.listItemSub}>{sublabel}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
    </Pressable>
  );

  const renderModal = () => {
    if (!modalLevel) return null;
    const title = modalLevel === 'country' ? 'Select Country' : modalLevel === 'region' ? 'Select Region' : 'Select City';
    const data: any[] = modalLevel === 'country' ? filteredCountries : modalLevel === 'region' ? filteredRegions : filteredCities;

    return (
      <Modal visible={!!modalLevel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable onPress={() => { setModalLevel(null); setSearchQuery(''); }}>
                <MaterialCommunityIcons name="close" size={24} color={Brand.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.searchBar}>
              <MaterialCommunityIcons name="magnify" size={20} color={Brand.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={Brand.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Brand.primary} />
              </View>
            ) : (
              <FlatList
                data={data}
                keyExtractor={(item: any) => String(item.id)}
                renderItem={({ item }: { item: any }) => {
                  if (modalLevel === 'country') {
                    return renderListItem(item, item.name, `${item.iso2} • ${item.currency_code}`, () => selectCountry(item));
                  }
                  if (modalLevel === 'region') {
                    return renderListItem(item, item.name, item.code, () => selectRegion(item));
                  }
                  return renderListItem(item, item.name, `${item.region_name} • pop ${item.population?.toLocaleString() || 0}`, () => selectCity(item));
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No results found</Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Country */}
      <Pressable
        style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
        onPress={() => setModalLevel('country')}
      >
        <MaterialCommunityIcons name="earth" size={20} color={Brand.primary} />
        <Text style={[styles.pickerText, !selCountry && styles.pickerPlaceholder]}>
          {selCountry ? selCountry.name : value.country || 'Select country'}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
      </Pressable>

      {/* Region */}
      <Pressable
        style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed, !selCountry && styles.pickerRowDisabled]}
        onPress={() => selCountry && setModalLevel('region')}
        disabled={!selCountry}
      >
        <MaterialCommunityIcons name="map-marker-outline" size={20} color={selCountry ? Brand.primary : Brand.textTertiary} />
        <Text style={[styles.pickerText, !selRegion && styles.pickerPlaceholder]}>
          {selRegion ? selRegion.name : value.region || 'Select region/state'}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
      </Pressable>

      {/* City */}
      <Pressable
        style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed, !selRegion && styles.pickerRowDisabled]}
        onPress={() => {
          if (selRegion) {
            setModalLevel('city');
          } else if (selCountry) {
            // If no region selected, load cities by country
            loadCitiesByCountry(selCountry.iso2);
            setModalLevel('city');
          }
        }}
        disabled={!selCountry}
      >
        <MaterialCommunityIcons name="map-marker" size={20} color={selCountry ? Brand.primary : Brand.textTertiary} />
        <Text style={[styles.pickerText, !selCity && styles.pickerPlaceholder]}>
          {selCity ? selCity.name : value.city || 'Select city'}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={Brand.textTertiary} />
      </Pressable>

      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
    marginBottom: Spacing.one,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  pickerRowPressed: {
    opacity: 0.85,
  },
  pickerRowDisabled: {
    opacity: 0.5,
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    color: Brand.text,
  },
  pickerPlaceholder: {
    color: Brand.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Brand.surfaceAlt,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.text,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  listItemPressed: {
    backgroundColor: Brand.surfaceAlt,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Brand.text,
  },
  listItemSub: {
    fontSize: 12,
    color: Brand.textTertiary,
    marginTop: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Brand.textTertiary,
  },
});
