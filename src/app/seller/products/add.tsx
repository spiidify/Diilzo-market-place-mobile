import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand, Spacing } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchBrands, fetchCategories } from '@/services/catalog';
import { createProduct, createProductVariant, getMyStore } from '@/services/seller';
import type { Brand as BrandType, Category } from '@/types';

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

interface VariantDraft {
  name: string;
  sku: string;
  price: string;
  stock: string;
}

export default function AddProductScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Form state ──────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [minOrderQty, setMinOrderQty] = useState('1');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Uganda');
  const [videoFile, setVideoFile] = useState<PickedImage | null>(null);
  const [isActive, setIsActive] = useState(true);

  // SEO
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // Variants
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantDraft, setVariantDraft] = useState<VariantDraft>({
    name: '', sku: '', price: '', stock: '',
  });

  // Images
  const [images, setImages] = useState<PickedImage[]>([]);

  // ── Dropdown data ───────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandType[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('images');

  // ── Load categories, brands, and store slug ─────────────────────
  const loadMeta = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [cats, brs, dashboard] = await Promise.all([
        fetchCategories(),
        fetchBrands(),
        getMyStore(),
      ]);
      setCategories(cats);
      setBrands(brs);
      setStoreSlug(dashboard?.store?.slug ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load form data');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // ── Auto-generate meta title from product name ──────────────────
  useEffect(() => {
    if (!metaTitle && name.trim()) {
      setMetaTitle(name.trim().slice(0, 60));
    }
  }, [name]);

  // ── Image picker ────────────────────────────────────────────────
  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 8,
      });
      if (result.canceled) return;
      const picked: PickedImage[] = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        name: `image_${Date.now()}_${idx}.jpg`,
        type: 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    } catch {
      Alert.alert('Error', 'Could not pick images');
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setVideoFile({
        uri: asset.uri,
        name: `video_${Date.now()}.mp4`,
        type: 'video/mp4',
      });
    } catch {
      Alert.alert('Error', 'Could not pick video');
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const makePrimaryImage = (index: number) => {
    setImages((prev) => {
      const arr = [...prev];
      const [img] = arr.splice(index, 1);
      arr.unshift(img);
      return arr;
    });
  };

  // ── Variant handlers ────────────────────────────────────────────
  const addVariant = () => {
    if (!variantDraft.name.trim() || !variantDraft.price.trim()) {
      Alert.alert('Missing fields', 'Variant name and price are required');
      return;
    }
    setVariants((prev) => [...prev, { ...variantDraft }]);
    setVariantDraft({ name: '', sku: '', price: '', stock: '' });
    setShowVariantForm(false);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Section toggle ──────────────────────────────────────────────
  const toggleSection = (key: string) => {
    setExpandedSection((prev) => (prev === key ? null : key));
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Please enter a product name');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Missing field', 'Please enter a price');
      return;
    }
    if (!categoryId) {
      Alert.alert('Missing field', 'Please select a category');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('short_description', shortDescription.trim());
      formData.append('price', price.trim());
      if (salePrice.trim()) formData.append('sale_price', salePrice.trim());
      formData.append('stock_quantity', stock.trim() || '0');
      if (sku.trim()) formData.append('sku', sku.trim());
      if (barcode.trim()) formData.append('barcode', barcode.trim());
      formData.append('category', String(categoryId));
      if (brandId) formData.append('brand', String(brandId));
      formData.append('min_order_quantity', minOrderQty.trim() || '1');
      if (weight.trim()) formData.append('weight', weight.trim());
      if (length.trim()) formData.append('length', length.trim());
      if (width.trim()) formData.append('width', width.trim());
      if (height.trim()) formData.append('height', height.trim());
      formData.append('country_of_origin', countryOfOrigin.trim() || 'Uganda');
      if (videoFile) {
        formData.append('video_file', {
          uri: videoFile.uri,
          name: videoFile.name,
          type: videoFile.type,
        } as any);
      }
      formData.append('is_active', isActive ? 'true' : 'false');

      images.forEach((img) => {
        formData.append('images', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as any);
      });

      const result: any = await createProduct(formData);
      const productId = result?.id || result?.product?.id;

      // Create variants after product is created
      if (productId && variants.length > 0) {
        for (const v of variants) {
          try {
            await createProductVariant(productId, {
              name: v.name.trim(),
              sku: v.sku.trim() || undefined,
              price: parseFloat(v.price) || 0,
              stock_quantity: parseInt(v.stock) || 0,
              is_active: true,
            });
          } catch {
            // Non-critical — product was created, variant failed
          }
        }
      }

      Alert.alert('Success', 'Product created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data?.name?.[0] ||
        e?.message ||
        'Failed to create product';
      setError(typeof msg === 'string' ? msg : 'Failed to create product');
      Alert.alert('Error', typeof msg === 'string' ? msg : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedBrand = brands.find((b) => b.id === brandId);

  // Find selected parent category and its children
  const selectedParent = selectedCategory?.parent
    ? categories.find((c) => c.id === selectedCategory.parent)
    : null;

  // The category whose children we're currently showing in the modal.
  // - If the selected category has children → show its children
  // - If a child is selected (has a parent) → show the parent's children
  const displayCategory = selectedCategory?.children && selectedCategory.children.length > 0
    ? selectedCategory
    : selectedParent;

  return (
    <View style={styles.screen}>
      <ModernHeader title="Add Product" />

      <View style={{ flex: 1 }}>
        {loadingMeta ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading form...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Image gallery ─────────────────────────────────── */}
              <SectionCard
                title="Product Photos"
                icon="camera-outline"
                expanded={expandedSection === 'images'}
                onToggle={() => toggleSection('images')}
                styles={styles}
                colors={colors}
              >
                <Text style={styles.label}>Product Images (up to 8)</Text>
                {images.length > 0 ? (
                  <View style={styles.imageGrid}>
                    {images.map((img, idx) => (
                      <View key={`img-${idx}`} style={styles.gridThumbWrap}>
                        <Image source={{ uri: img.uri }} style={styles.gridThumb} resizeMode="cover" />
                        {idx === 0 && (
                          <View style={styles.gridPrimaryBadge}>
                            <Text style={styles.gridPrimaryBadgeText}>Primary</Text>
                          </View>
                        )}
                        <View style={styles.gridThumbActions}>
                          {idx > 0 && (
                            <Pressable style={styles.gridThumbActionBtn} onPress={() => makePrimaryImage(idx)}>
                              <MaterialCommunityIcons name="star" size={14} color="#FFFFFF" />
                            </Pressable>
                          )}
                          <Pressable style={styles.gridThumbActionBtn} onPress={() => removeImage(idx)}>
                            <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    {images.length < 8 && (
                      <Pressable style={styles.gridAddBtn} onPress={pickImages}>
                        <MaterialCommunityIcons name="camera-plus" size={24} color={Brand.primary} />
                        <Text style={styles.gridAddText}>Add</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.videoBtn, pressed && { opacity: 0.7 }]}
                    onPress={pickImages}
                  >
                    <MaterialCommunityIcons name="camera-plus" size={26} color={Brand.primary} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.videoBtnText}>Upload Photos</Text>
                      <Text style={styles.videoBtnSub}>Up to 8 images · JPG or PNG</Text>
                    </View>
                  </Pressable>
                )}
              </SectionCard>

              {/* ── Basic Information ─────────────────────────────── */}
              <SectionCard
                title="Basic Information"
                icon="package-variant-closed"
                expanded={expandedSection === 'basic'}
                onToggle={() => toggleSection('basic')}
                styles={styles}
                colors={colors}
              >
                <Text style={styles.label}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Organic Avocado"
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={styles.label}>Short Description</Text>
                <TextInput
                  style={styles.input}
                  value={shortDescription}
                  onChangeText={setShortDescription}
                  placeholder="One-line summary (max 300 chars)"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={300}
                />

                <Text style={styles.label}>Full Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your product in detail..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </SectionCard>

              {/* ── Pricing & Inventory ────────────────────────────── */}
              <SectionCard
                title="Pricing & Inventory"
                icon="currency-usd"
                expanded={expandedSection === 'pricing'}
                onToggle={() => toggleSection('pricing')}
                styles={styles}
                colors={colors}
              >
                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Price *</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Sale Price</Text>
                    <TextInput
                      style={styles.input}
                      value={salePrice}
                      onChangeText={setSalePrice}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Stock</Text>
                    <TextInput
                      style={styles.input}
                      value={stock}
                      onChangeText={setStock}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>SKU</Text>
                    <TextInput
                      style={styles.input}
                      value={sku}
                      onChangeText={setSku}
                      placeholder="Optional"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Barcode</Text>
                <TextInput
                  style={styles.input}
                  value={barcode}
                  onChangeText={setBarcode}
                  placeholder="Optional (EAN/UPC)"
                  placeholderTextColor={colors.textTertiary}
                />
              </SectionCard>

              {/* ── Category & Brand ───────────────────────────────── */}
              <SectionCard
                title="Organization"
                icon="format-list-bulleted-type"
                expanded={expandedSection === 'org'}
                onToggle={() => toggleSection('org')}
                styles={styles}
                colors={colors}
              >
                <Text style={styles.label}>Category *</Text>
                <Pressable
                  style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.85 }]}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <View style={styles.catPickerLeft}>
                    <View style={styles.catPickerIcon}>
                      <MaterialCommunityIcons
                        name={selectedCategory ? "folder-open-outline" : "folder-outline"}
                        size={18}
                        color={selectedCategory ? Brand.primary : colors.textTertiary}
                      />
                    </View>
                    <View style={styles.catPickerTexts}>
                      <Text
                        style={[styles.dropdownText, !selectedCategory && styles.dropdownPlaceholder]}
                        numberOfLines={1}
                      >
                        {selectedCategory ? selectedCategory.name : 'Select category'}
                      </Text>
                      {selectedParent && (
                        <Text style={styles.catPickerSub} numberOfLines={1}>
                          in {selectedParent.name}
                        </Text>
                      )}
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                </Pressable>

                <Text style={styles.label}>Brand</Text>
                <Pressable style={styles.dropdown} onPress={() => setShowBrandModal(true)}>
                  <Text
                    style={[styles.dropdownText, !selectedBrand && styles.dropdownPlaceholder]}
                    numberOfLines={1}
                  >
                    {selectedBrand ? selectedBrand.name : 'Select brand (optional)'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>
              </SectionCard>

              {/* ── Variants ──────────────────────────────────────── */}
              <SectionCard
                title={`Variants${variants.length > 0 ? ` (${variants.length})` : ''}`}
                icon="format-list-bulleted"
                expanded={expandedSection === 'variants'}
                onToggle={() => toggleSection('variants')}
                styles={styles}
                colors={colors}
              >
                {variants.length > 0 && (
                  <View style={styles.variantList}>
                    {variants.map((v, idx) => (
                      <View key={`v-${idx}`} style={styles.variantRow}>
                        <View style={styles.variantInfo}>
                          <Text style={styles.variantName}>{v.name}</Text>
                          <Text style={styles.variantMeta}>
                            {v.price} UGX{v.stock ? ` · ${v.stock} in stock` : ''}
                          </Text>
                        </View>
                        <Pressable onPress={() => removeVariant(idx)} hitSlop={8}>
                          <MaterialCommunityIcons name="close-circle" size={22} color={Brand.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {showVariantForm ? (
                  <View style={styles.variantForm}>
                    <Text style={styles.label}>Variant Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={variantDraft.name}
                      onChangeText={(v) => setVariantDraft({ ...variantDraft, name: v })}
                      placeholder='e.g. "Size M / Red"'
                      placeholderTextColor={colors.textTertiary}
                    />
                    <View style={styles.row}>
                      <View style={styles.halfCol}>
                        <Text style={styles.label}>Price *</Text>
                        <TextInput
                          style={styles.input}
                          value={variantDraft.price}
                          onChangeText={(v) => setVariantDraft({ ...variantDraft, price: v })}
                          placeholder="0"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.halfCol}>
                        <Text style={styles.label}>Stock</Text>
                        <TextInput
                          style={styles.input}
                          value={variantDraft.stock}
                          onChangeText={(v) => setVariantDraft({ ...variantDraft, stock: v })}
                          placeholder="0"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <Text style={styles.label}>SKU (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={variantDraft.sku}
                      onChangeText={(v) => setVariantDraft({ ...variantDraft, sku: v })}
                      placeholder="Optional"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="characters"
                    />
                    <View style={styles.variantFormActions}>
                      <Pressable
                        style={[styles.btnSecondary, { flex: 1 }]}
                        onPress={() => {
                          setShowVariantForm(false);
                          setVariantDraft({ name: '', sku: '', price: '', stock: '' });
                        }}
                      >
                        <Text style={styles.btnSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={[styles.btnPrimary, { flex: 1 }]} onPress={addVariant}>
                        <Text style={styles.btnPrimaryText}>Add Variant</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={styles.addVariantBtn}
                    onPress={() => setShowVariantForm(true)}
                  >
                    <MaterialCommunityIcons name="plus-circle-outline" size={20} color={Brand.primary} />
                    <Text style={styles.addVariantText}>Add Variant</Text>
                  </Pressable>
                )}
              </SectionCard>

              {/* ── Shipping & Dimensions ─────────────────────────── */}
              <SectionCard
                title="Shipping & Dimensions"
                icon="truck-fast-outline"
                expanded={expandedSection === 'shipping'}
                onToggle={() => toggleSection('shipping')}
                styles={styles}
                colors={colors}
              >
                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Min Order Qty</Text>
                    <TextInput
                      style={styles.input}
                      value={minOrderQty}
                      onChangeText={setMinOrderQty}
                      placeholder="1"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Weight (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={weight}
                      onChangeText={setWeight}
                      placeholder="0.0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Dimensions (cm) — L × W × H</Text>
                <View style={styles.row}>
                  <View style={styles.thirdCol}>
                    <TextInput
                      style={styles.input}
                      value={length}
                      onChangeText={setLength}
                      placeholder="L"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.thirdCol}>
                    <TextInput
                      style={styles.input}
                      value={width}
                      onChangeText={setWidth}
                      placeholder="W"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.thirdCol}>
                    <TextInput
                      style={styles.input}
                      value={height}
                      onChangeText={setHeight}
                      placeholder="H"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Country of Origin</Text>
                <TextInput
                  style={styles.input}
                  value={countryOfOrigin}
                  onChangeText={setCountryOfOrigin}
                  placeholder="Uganda"
                  placeholderTextColor={colors.textTertiary}
                />
              </SectionCard>

              {/* ── SEO ───────────────────────────────────────────── */}
              <SectionCard
                title="SEO & Visibility"
                icon="magnify"
                expanded={expandedSection === 'seo'}
                onToggle={() => toggleSection('seo')}
                styles={styles}
                colors={colors}
              >
                <Text style={styles.label}>Meta Title</Text>
                <TextInput
                  style={styles.input}
                  value={metaTitle}
                  onChangeText={setMetaTitle}
                  placeholder="SEO title (max 60 chars)"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={60}
                />
                <Text style={styles.charCount}>{metaTitle.length}/60</Text>

                <Text style={styles.label}>Meta Description</Text>
                <TextInput
                  style={[styles.input, styles.textAreaSmall]}
                  value={metaDescription}
                  onChangeText={setMetaDescription}
                  placeholder="SEO description for search engines (max 160 chars)"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={160}
                />
                <Text style={styles.charCount}>{metaDescription.length}/160</Text>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Active (visible to buyers)</Text>
                    <Text style={styles.switchSub}>Inactive products are hidden from search</Text>
                  </View>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: colors.border, true: Brand.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </SectionCard>

              {/* ── Media ──────────────────────────────────────────── */}
              <SectionCard
                title="Product Video"
                icon="video-outline"
                expanded={expandedSection === 'media'}
                onToggle={() => toggleSection('media')}
                styles={styles}
                colors={colors}
              >
                <Text style={styles.label}>Product Showcase Video (optional)</Text>
                {videoFile ? (
                  <View style={styles.videoPreviewCard}>
                    <View style={styles.videoPreviewThumb}>
                      <MaterialCommunityIcons name="play-circle" size={36} color="#FFFFFF" />
                    </View>
                    <View style={styles.videoPreviewInfo}>
                      <Text style={styles.videoPreviewName} numberOfLines={1}>{videoFile.name}</Text>
                      <Text style={styles.videoPreviewHint}>Video ready to upload</Text>
                    </View>
                    <Pressable style={styles.videoRemoveIcon} onPress={() => setVideoFile(null)} hitSlop={8}>
                      <MaterialCommunityIcons name="close-circle" size={24} color={Brand.danger} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.videoBtn, pressed && { opacity: 0.7 }]}
                    onPress={pickVideo}
                  >
                    <MaterialCommunityIcons name="video-plus-outline" size={26} color={Brand.primary} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.videoBtnText}>Upload Video</Text>
                      <Text style={styles.videoBtnSub}>MP4 or MOV · max 50MB</Text>
                    </View>
                  </Pressable>
                )}
              </SectionCard>

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={Brand.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* ── Submit ─────────────────────────────────────────── */}
              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.submitText}>Create Product</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── Category modal (step-based picker) ──────────────── */}
        <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.catSheet}>
              {/* Header */}
              <View style={styles.catHeader}>
                <View style={styles.catHeaderLeft}>
                  <Pressable onPress={() => setShowCategoryModal(false)} hitSlop={12} style={styles.catBackBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                  </Pressable>
                  <Text style={styles.catTitle}>Select Category</Text>
                </View>
                {categoryId && (
                  <Pressable onPress={() => { setCategoryId(null); }} hitSlop={8} style={styles.catClearBtn}>
                    <MaterialCommunityIcons name="close" size={20} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Breadcrumb path */}
              <View style={styles.catBreadcrumb}>
                <Pressable onPress={() => { setCategoryId(null); }}>
                  <Text style={[styles.catCrumb, !categoryId && styles.catCrumbActive]}>All</Text>
                </Pressable>
                {selectedParent && (
                  <>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textTertiary} />
                    <Pressable onPress={() => setCategoryId(selectedParent.id)}>
                      <Text style={[styles.catCrumb, categoryId === selectedParent.id && styles.catCrumbActive]} numberOfLines={1}>
                        {selectedParent.name}
                      </Text>
                    </Pressable>
                  </>
                )}
                {selectedCategory && !selectedParent && (
                  <>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textTertiary} />
                    <Text style={[styles.catCrumb, styles.catCrumbActive]} numberOfLines={1}>
                      {selectedCategory.name}
                    </Text>
                  </>
                )}
                {selectedCategory && selectedParent && (
                  <>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textTertiary} />
                    <Text style={[styles.catCrumb, styles.catCrumbActive]} numberOfLines={1}>
                      {selectedCategory.name}
                    </Text>
                  </>
                )}
              </View>

              <ScrollView style={styles.catBody} showsVerticalScrollIndicator={false}>
                {/* If no category selected, show root categories */}
                {!categoryId && (
                  <View style={styles.catGrid}>
                    {categories.filter((c) => !c.parent).map((cat) => (
                      <Pressable
                        key={`root-${cat.id}`}
                        style={({ pressed }) => [styles.catCard, pressed && { opacity: 0.8 }]}
                        onPress={() => {
                          if (cat.children && cat.children.length > 0) {
                            setCategoryId(cat.id);
                          } else {
                            setCategoryId(cat.id);
                            setShowCategoryModal(false);
                          }
                        }}
                      >
                        <View style={[styles.catCardIcon, { backgroundColor: Brand.primary + '12' }]}>
                          <MaterialCommunityIcons name="folder-outline" size={24} color={Brand.primary} />
                        </View>
                        <Text style={styles.catCardName} numberOfLines={2}>{cat.name}</Text>
                        {cat.children && cat.children.length > 0 && (
                          <View style={styles.catCardCount}>
                            <Text style={styles.catCardCountText}>{cat.children.length} sub</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* If a category with children is selected, show its children */}
                {displayCategory && displayCategory.children && displayCategory.children.length > 0 && (
                  <View>
                    <Text style={styles.catSectionLabel}>
                      Sub-categories in {displayCategory.name}
                    </Text>
                    <View style={styles.catChildList}>
                      {/* Option to use the parent itself */}
                      <Pressable
                        style={({ pressed }) => [
                          styles.catChildItem,
                          categoryId === displayCategory.id && styles.catChildItemActive,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => { setCategoryId(displayCategory.id); setShowCategoryModal(false); }}
                      >
                        <View style={styles.catChildItemLeft}>
                          <View style={[styles.catChildDot, categoryId === displayCategory.id && styles.catChildDotActive]} />
                          <Text style={[styles.catChildText, categoryId === displayCategory.id && styles.catChildTextActive]}>
                            Use {displayCategory.name} (no sub-category)
                          </Text>
                        </View>
                        {categoryId === displayCategory.id && (
                          <MaterialCommunityIcons name="check-circle" size={22} color={Brand.primary} />
                        )}
                      </Pressable>

                      {displayCategory.children.map((child) => (
                        <Pressable
                          key={`child-${child.id}`}
                          style={({ pressed }) => [
                            styles.catChildItem,
                            categoryId === child.id && styles.catChildItemActive,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => { setCategoryId(child.id); setShowCategoryModal(false); }}
                        >
                          <View style={styles.catChildItemLeft}>
                            <View style={[styles.catChildDot, categoryId === child.id && styles.catChildDotActive]} />
                            <Text style={[styles.catChildText, categoryId === child.id && styles.catChildTextActive]}>
                              {child.name}
                            </Text>
                          </View>
                          {categoryId === child.id && (
                            <MaterialCommunityIcons name="check-circle" size={22} color={Brand.primary} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* If a leaf category (no children) is selected, show confirmation */}
                {categoryId && !displayCategory && (
                  <View style={styles.catSelectedConfirm}>
                    <MaterialCommunityIcons name="check-circle" size={48} color={Brand.primary} />
                    <Text style={styles.catSelectedName}>{selectedCategory?.name}</Text>
                    <Pressable
                      style={styles.catConfirmBtn}
                      onPress={() => setShowCategoryModal(false)}
                    >
                      <Text style={styles.catConfirmBtnText}>Use this category</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              {categoryId && (
                <View style={styles.catFooter}>
                  <View style={styles.catFooterInfo}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={Brand.primary} />
                    <Text style={styles.catFooterText} numberOfLines={1}>
                      {selectedCategory?.name}
                    </Text>
                  </View>
                  <Pressable style={styles.catDoneBtn} onPress={() => setShowCategoryModal(false)}>
                    <Text style={styles.catDoneBtnText}>Done</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Brand modal ────────────────────────────────────────── */}
        <Modal visible={showBrandModal} transparent animationType="slide" onRequestClose={() => setShowBrandModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Brand</Text>
                <Pressable onPress={() => setShowBrandModal(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalList}>
                <Pressable
                  style={[styles.modalItem, brandId === null && styles.modalItemSelected]}
                  onPress={() => {
                    setBrandId(null);
                    setShowBrandModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>No brand</Text>
                  {brandId === null && (
                    <MaterialCommunityIcons name="check" size={20} color={Brand.primary} />
                  )}
                </Pressable>
                {brands.map((br) => (
                  <Pressable
                    key={`brand-${br.id}`}
                    style={[styles.modalItem, br.id === brandId && styles.modalItemSelected]}
                    onPress={() => {
                      setBrandId(br.id);
                      setShowBrandModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{br.name}</Text>
                    {br.id === brandId && (
                      <MaterialCommunityIcons name="check" size={20} color={Brand.primary} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}


const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.two, color: c.textSecondary, fontSize: 14 },

  // ── Image grid ─────────────────────────────────────────────────
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gridThumbWrap: { width: 100, height: 100, borderRadius: 14, overflow: 'hidden' },
  gridThumb: { width: 100, height: 100, borderRadius: 14 },
  gridPrimaryBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: Brand.primary,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  gridPrimaryBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  gridThumbActions: {
    position: 'absolute', bottom: 4, right: 4,
    flexDirection: 'row', gap: 4,
  },
  gridThumbActionBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  gridAddBtn: {
    width: 100, height: 100, borderRadius: 14,
    borderWidth: 1.5, borderColor: c.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: c.surfaceAlt,
  },
  gridAddText: { fontSize: 12, color: Brand.primary, fontWeight: '700', marginTop: 4 },

  // ── Section card ───────────────────────────────────────────────
  sectionCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    marginBottom: Spacing.two + Spacing.half,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Brand.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  sectionBody: { padding: Spacing.three, paddingTop: 0, gap: Spacing.two + Spacing.half },

  // ── Form ───────────────────────────────────────────────────────
  label: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.surfaceAlt,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  textAreaSmall: { minHeight: 60, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: c.textTertiary, textAlign: 'right', marginTop: 2 },

  row: { flexDirection: 'row', gap: Spacing.two + Spacing.half },
  halfCol: { flex: 1, gap: Spacing.one },
  thirdCol: { flex: 1 },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    backgroundColor: c.surfaceAlt,
  },
  dropdownText: { fontSize: 15, color: c.text, flex: 1 },
  dropdownPlaceholder: { color: c.textTertiary },

  // ── Variants ───────────────────────────────────────────────────
  variantList: { gap: Spacing.two, marginBottom: Spacing.two },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    padding: Spacing.two + Spacing.half,
  },
  variantInfo: { flex: 1, gap: 2 },
  variantName: { fontSize: 14, fontWeight: '600', color: c.text },
  variantMeta: { fontSize: 12, color: c.textSecondary },

  variantForm: {
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.three - Spacing.half,
    gap: Spacing.two,
  },
  variantFormActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },

  addVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two - 2,
    paddingVertical: Spacing.two + Spacing.half,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  addVariantText: { fontSize: 14, color: Brand.primary, fontWeight: '600' },

  // ── Buttons ────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: c.surfaceAlt,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  btnSecondaryText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },

  // ── Video ──────────────────────────────────────────────────────
  videoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  videoBtnText: { fontSize: 14, color: Brand.primary, fontWeight: '700' },
  videoBtnSub: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  videoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.three - Spacing.half,
  },
  videoPreviewThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreviewInfo: { flex: 1, gap: 2 },
  videoPreviewName: { fontSize: 14, fontWeight: '600', color: c.text },
  videoPreviewHint: { fontSize: 12, color: Brand.primary },
  videoRemoveIcon: { padding: 4 },

  // ── Switch ─────────────────────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  switchInfo: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: c.text },
  switchSub: { fontSize: 12, color: c.textTertiary },

  // ── Error ──────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderRadius: 10,
    padding: Spacing.three - Spacing.half,
    marginTop: Spacing.three,
  },
  errorText: { flex: 1, fontSize: 13, color: Brand.danger, fontWeight: '500' },

  // ── Submit ─────────────────────────────────────────────────────
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.primary,
    borderRadius: 14,
    paddingVertical: Spacing.three + Spacing.half,
    marginTop: Spacing.four,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  // ── Modal ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  modalList: { paddingVertical: Spacing.two },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three - Spacing.half,
  },
  modalItemSelected: { backgroundColor: c.surfaceAlt },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two - 2 },
  modalItemText: { fontSize: 15, color: c.text, fontWeight: '500' },

  // ── Category picker (new design) ─────────────────────────────
  catPickerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half, flex: 1 },
  catPickerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  catPickerTexts: { flex: 1, gap: 1 },
  catPickerSub: { fontSize: 11, color: c.textTertiary },

  catSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  catHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  catBackBtn: { padding: 4 },
  catTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  catClearBtn: { padding: 4 },

  catBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    backgroundColor: c.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  catCrumb: { fontSize: 13, color: c.textTertiary, fontWeight: '500' },
  catCrumbActive: { color: Brand.primary, fontWeight: '700' },

  catBody: { padding: Spacing.three, maxHeight: 420 },

  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + Spacing.half,
  },
  catCard: {
    width: '47%',
    backgroundColor: c.surfaceAlt,
    borderRadius: 14,
    padding: Spacing.three - 2,
    alignItems: 'center',
    gap: Spacing.two - 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catCardIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  catCardName: { fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' },
  catCardCount: {
    backgroundColor: c.surface,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catCardCountText: { fontSize: 10, color: c.textTertiary, fontWeight: '600' },

  catSectionLabel: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: Spacing.two + Spacing.half },
  catChildList: { gap: Spacing.two - 2 },
  catChildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three - 4,
    paddingHorizontal: Spacing.three - Spacing.half,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
  },
  catChildItemActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary + '08',
  },
  catChildItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, flex: 1 },
  catChildDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: c.border,
    backgroundColor: 'transparent',
  },
  catChildDotActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary,
  },
  catChildText: { fontSize: 15, color: c.textSecondary, fontWeight: '500' },
  catChildTextActive: { color: c.text, fontWeight: '700' },

  catSelectedConfirm: {
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    paddingVertical: Spacing.four,
  },
  catSelectedName: { fontSize: 18, fontWeight: '700', color: c.text },
  catConfirmBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three - 2,
    borderRadius: 12,
  },
  catConfirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  catFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
    gap: Spacing.two,
  },
  catFooterInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two - 2, flex: 1 },
  catFooterText: { fontSize: 14, fontWeight: '600', color: c.text, flex: 1 },
  catDoneBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 12,
  },
  catDoneBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

// ── Collapsible Section Card ────────────────────────────────────────
function SectionCard({
  title,
  icon,
  expanded,
  onToggle,
  children,
  styles,
  colors,
}: {
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  styles: any;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.sectionCard}>
      <Pressable
        style={({ pressed }) => [styles.sectionHeader, pressed && { opacity: 0.7 }]}
        onPress={onToggle}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIcon}>
            <MaterialCommunityIcons name={icon as any} size={18} color={Brand.primary} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.textSecondary}
        />
      </Pressable>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}
