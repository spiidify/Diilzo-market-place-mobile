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
  const [videoUrl, setVideoUrl] = useState('');
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
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');

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
      if (videoUrl.trim()) formData.append('video_url', videoUrl.trim());
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
  const childCategories = selectedParent?.children || [];

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
              <View style={styles.imageSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroll}>
                  {images.map((img, idx) => (
                    <View key={`img-${idx}`} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
                      {idx === 0 && <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Primary</Text></View>}
                      <View style={styles.thumbActions}>
                        {idx > 0 && (
                          <Pressable style={styles.thumbActionBtn} onPress={() => makePrimaryImage(idx)}>
                            <MaterialCommunityIcons name="star-outline" size={14} color="#FFFFFF" />
                          </Pressable>
                        )}
                        <Pressable style={styles.thumbActionBtn} onPress={() => removeImage(idx)}>
                          <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  {images.length < 8 && (
                    <Pressable style={styles.addImageBtn} onPress={pickImages}>
                      <MaterialCommunityIcons name="camera-plus" size={28} color={Brand.primary} />
                      <Text style={styles.addImageText}>Add Photos</Text>
                      <Text style={styles.addImageSub}>{images.length}/8</Text>
                    </Pressable>
                  )}
                </ScrollView>
              </View>

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
                  style={styles.dropdown}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text
                    style={[styles.dropdownText, !selectedCategory && styles.dropdownPlaceholder]}
                    numberOfLines={1}
                  >
                    {selectedCategory ? selectedCategory.name : 'Select category'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>
                {selectedParent && (
                  <Text style={styles.breadcrumb}>
                    {selectedParent.name} → {selectedCategory?.name}
                  </Text>
                )}

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
                title="Video"
                icon="video-outline"
                expanded={expandedSection === 'media'}
                onToggle={() => toggleSection('media')}
                styles={styles}
                colors={colors}
              >
                <Pressable
                  style={({ pressed }) => [styles.videoBtn, pressed && { opacity: 0.7 }]}
                  onPress={pickVideo}
                >
                  <MaterialCommunityIcons name="video-plus-outline" size={22} color={Brand.primary} />
                  <Text style={styles.videoBtnText}>
                    {videoFile ? `Selected: ${videoFile.name}` : 'Upload Video (MP4, MOV)'}
                  </Text>
                </Pressable>
                {videoFile && (
                  <Pressable style={styles.removeVideoBtn} onPress={() => setVideoFile(null)}>
                    <Text style={styles.removeVideoText}>Remove video</Text>
                  </Pressable>
                )}

                <Text style={[styles.label, { marginTop: 8 }]}>Or YouTube URL</Text>
                <TextInput
                  style={styles.input}
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  placeholder="https://youtube.com/..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
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

        {/* ── Category modal (hierarchical) ─────────────────────── */}
        <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <Pressable onPress={() => setShowCategoryModal(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalList}>
                {/* Parent categories */}
                {categories.filter((c) => !c.parent).map((cat) => (
                  <View key={`cat-${cat.id}`}>
                    <Pressable
                      style={[
                        styles.modalItem,
                        cat.id === categoryId && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setCategoryId(cat.id);
                        // If no children, close modal
                        if (!cat.children || cat.children.length === 0) {
                          setShowCategoryModal(false);
                        }
                      }}
                    >
                      <View style={styles.modalItemLeft}>
                        {cat.children && cat.children.length > 0 && (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={18}
                            color={colors.textTertiary}
                          />
                        )}
                        <Text style={styles.modalItemText}>{cat.name}</Text>
                      </View>
                      {cat.id === categoryId && (
                        <MaterialCommunityIcons name="check" size={20} color={Brand.primary} />
                      )}
                    </Pressable>
                    {/* Children — show if parent is selected or if a child of this parent is selected */}
                    {cat.children && cat.children.length > 0 && (cat.id === categoryId || (selectedCategory?.parent === cat.id)) && (
                      <View style={styles.subCategoryList}>
                        {cat.children.map((child) => (
                          <Pressable
                            key={`child-${child.id}`}
                            style={[
                              styles.modalSubItem,
                              child.id === categoryId && styles.modalItemSelected,
                            ]}
                            onPress={() => {
                              setCategoryId(child.id);
                              setShowCategoryModal(false);
                            }}
                          >
                            <Text style={styles.modalSubItemText}>{child.name}</Text>
                            {child.id === categoryId && (
                              <MaterialCommunityIcons name="check" size={18} color={Brand.primary} />
                            )}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
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

  // ── Image gallery ──────────────────────────────────────────────
  imageSection: { marginBottom: Spacing.three },
  imageScroll: { gap: Spacing.two },
  thumbWrap: { width: 100, height: 100, borderRadius: 14, overflow: 'hidden' },
  thumb: { width: 100, height: 100, borderRadius: 14 },
  primaryBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: Brand.primary,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  thumbActions: {
    position: 'absolute', bottom: 4, right: 4,
    flexDirection: 'row', gap: 4,
  },
  thumbActionBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  addImageBtn: {
    width: 100, height: 100, borderRadius: 14,
    borderWidth: 1.5, borderColor: c.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: c.surface,
  },
  addImageText: { fontSize: 12, color: Brand.primary, fontWeight: '700', marginTop: 4 },
  addImageSub: { fontSize: 10, color: c.textTertiary, marginTop: 2 },

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
  breadcrumb: { fontSize: 12, color: c.textTertiary, marginTop: 4, fontStyle: 'italic' },

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
    paddingVertical: Spacing.three - Spacing.half,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  videoBtnText: { fontSize: 13, color: Brand.primary, fontWeight: '600' },
  removeVideoBtn: { alignSelf: 'flex-end', marginTop: Spacing.one },
  removeVideoText: { color: Brand.danger, fontSize: 13, fontWeight: '600' },

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
  subCategoryList: {
    marginLeft: Spacing.four,
    borderLeftWidth: 2,
    borderLeftColor: c.borderLight,
  },
  modalSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  modalSubItemText: { fontSize: 14, color: c.textSecondary },
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
