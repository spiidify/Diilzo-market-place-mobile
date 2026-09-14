import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { apiRequest } from '@/services/api';
import { fetchBrands, fetchCategories } from '@/services/catalog';
import { getProductDetail, updateProduct } from '@/services/seller';
import type { Brand as BrandType, Category } from '@/types';

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

interface ExistingImage {
  id: number;
  url: string;
  is_primary: boolean;
}

export default function EditProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; product_id?: string; slug?: string }>();
  const productId = params.id || params.product_id;
  const slug = params.slug;
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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [minOrderQty, setMinOrderQty] = useState('1');
  const [weight, setWeight] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Uganda');
  const [isActive, setIsActive] = useState(true);

  // Images
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<PickedImage[]>([]);

  // Video
  const [videoFile, setVideoFile] = useState<PickedImage | null>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);

  // ── Dropdown data ───────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandType[]>([]);

  // ── UI state ────────────────────────────────────────────────────
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('images');

  // ── Load categories & brands ────────────────────────────────────
  const loadMeta = useCallback(async () => {
    try {
      const [cats, brs] = await Promise.all([fetchCategories(), fetchBrands()]);
      setCategories(cats);
      setBrands(brs);
    } catch (e: any) {
      setError(e?.message || 'Failed to load form data');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  // ── Load existing product ───────────────────────────────────────
  const loadProduct = useCallback(async () => {
    if (!slug && !productId) {
      setError('Missing product identifier');
      setLoadingProduct(false);
      return;
    }
    try {
      const product = slug
        ? await apiRequest<any>({ method: 'GET', url: `/products/${slug}/` })
        : await getProductDetail(Number(productId));
      setName(product.name || '');
      setShortDescription(product.short_description || '');
      setDescription(product.description || '');
      setPrice(product.price || '');
      setSalePrice(product.sale_price || '');
      setStock(String(product.stock_quantity || 0));
      setSku(product.sku || '');
      setCategoryId(product.category?.id ?? null);
      setBrandId(product.brand?.id ?? null);
      setMinOrderQty(String(product.min_order_quantity || 1));
      setWeight(product.weight || '');
      setCountryOfOrigin(product.country_of_origin || 'Uganda');
      setIsActive(product.is_active);
      setExistingVideoUrl(product.video_file_url || null);
      const imgs = ((product.images || []) as Array<{ id: number; image_url?: string; is_primary?: boolean }>)
        .filter((img) => img.image_url)
        .map((img) => ({ id: img.id, url: img.image_url!, is_primary: !!img.is_primary }));
      setExistingImages(imgs);
    } catch (e: any) {
      setError(e?.message || 'Failed to load product');
    } finally {
      setLoadingProduct(false);
    }
  }, [slug, productId]);

  useEffect(() => {
    loadMeta();
    loadProduct();
  }, [loadMeta, loadProduct]);

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
      setNewImages((prev) => [...prev, ...picked].slice(0, 8));
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
      setRemoveVideo(false);
    } catch {
      Alert.alert('Error', 'Could not pick video');
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const makeExistingPrimary = (index: number) => {
    setExistingImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === index })));
  };

  const makeNewPrimary = (index: number) => {
    setNewImages((prev) => {
      const arr = [...prev];
      const [img] = arr.splice(index, 1);
      arr.unshift(img);
      return arr;
    });
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
      if (categoryId) formData.append('category', String(categoryId));
      if (brandId) formData.append('brand', String(brandId));
      formData.append('min_order_quantity', minOrderQty.trim() || '1');
      if (weight.trim()) formData.append('weight', weight.trim());
      formData.append('country_of_origin', countryOfOrigin.trim() || 'Uganda');
      formData.append('is_active', isActive ? 'true' : 'false');

      // Existing images to keep
      const keepIds = existingImages.map((img) => img.id);
      formData.append('keep_image_ids', JSON.stringify(keepIds));

      // New images
      newImages.forEach((img) => {
        formData.append('images', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as any);
      });

      // Video
      if (videoFile) {
        formData.append('video_file', {
          uri: videoFile.uri,
          name: videoFile.name,
          type: videoFile.type,
        } as any);
      } else if (removeVideo) {
        formData.append('remove_video', 'true');
      }

      if (productId) {
        await updateProduct(Number(productId), formData);
      } else if (slug) {
        await apiRequest<any>({
          method: 'PATCH',
          url: `/products/${slug}/`,
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      Alert.alert('Success', 'Product updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data?.name?.[0] ||
        e?.message ||
        'Failed to update product';
      setError(typeof msg === 'string' ? msg : 'Failed to update product');
      Alert.alert('Error', typeof msg === 'string' ? msg : 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  // Build a flat list of all categories (parents + children) for lookups.
  const allCategories = useMemo(() => {
    const flat: Category[] = [];
    for (const parent of categories) {
      flat.push(parent);
      if (parent.children) {
        for (const child of parent.children) flat.push(child);
      }
    }
    return flat;
  }, [categories]);

  const selectedCategory = allCategories.find((c) => c.id === categoryId);
  const selectedBrand = brands.find((b) => b.id === brandId);
  const selectedParent = selectedCategory?.parent
    ? categories.find((c) => c.id === selectedCategory.parent)
    : null;
  const displayCategory = selectedCategory?.children && selectedCategory.children.length > 0
    ? selectedCategory
    : selectedParent;
  const isLoading = loadingMeta || loadingProduct;
  const totalImages = existingImages.length + newImages.length;

  return (
    <View style={styles.screen}>
      <ModernHeader title="Edit Product" />

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading product...</Text>
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
              {/* ── Photos ─────────────────────────────────────────── */}
              <SectionCard
                title="Product Photos"
                icon="camera-outline"
                expanded={expandedSection === 'images'}
                onToggle={() => toggleSection('images')}
                styles={styles}
                colors={colors}
              >
                <Text style={styles.label}>Current + New Images (up to 8 total)</Text>
                <View style={styles.imageGrid}>
                  {/* Existing images */}
                  {existingImages.map((img, idx) => (
                    <View key={`ex-${img.id}`} style={styles.gridThumbWrap}>
                      <Image source={{ uri: img.url }} style={styles.gridThumb} resizeMode="cover" />
                      {img.is_primary && (
                        <View style={styles.gridPrimaryBadge}>
                          <Text style={styles.gridPrimaryBadgeText}>Primary</Text>
                        </View>
                      )}
                      <View style={styles.gridThumbActions}>
                        {!img.is_primary && (
                          <Pressable style={styles.gridThumbActionBtn} onPress={() => makeExistingPrimary(idx)}>
                            <MaterialCommunityIcons name="star" size={14} color="#FFFFFF" />
                          </Pressable>
                        )}
                        <Pressable style={styles.gridThumbActionBtn} onPress={() => removeExistingImage(idx)}>
                          <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  {/* New images */}
                  {newImages.map((img, idx) => (
                    <View key={`new-${idx}`} style={styles.gridThumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.gridThumb} resizeMode="cover" />
                      {idx === 0 && existingImages.length === 0 && (
                        <View style={styles.gridPrimaryBadge}>
                          <Text style={styles.gridPrimaryBadgeText}>Primary</Text>
                        </View>
                      )}
                      <View style={styles.gridThumbActions}>
                        <Pressable style={styles.gridThumbActionBtn} onPress={() => removeNewImage(idx)}>
                          <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  {totalImages < 8 && (
                    <Pressable style={styles.gridAddBtn} onPress={pickImages}>
                      <MaterialCommunityIcons name="camera-plus" size={24} color={Brand.primary} />
                      <Text style={styles.gridAddText}>Add</Text>
                    </Pressable>
                  )}
                </View>
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
                <Text style={styles.label}>Category</Text>
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

                <Text style={styles.label}>Country of Origin</Text>
                <TextInput
                  style={styles.input}
                  value={countryOfOrigin}
                  onChangeText={setCountryOfOrigin}
                  placeholder="Uganda"
                  placeholderTextColor={colors.textTertiary}
                />
              </SectionCard>

              {/* ── Video ──────────────────────────────────────────── */}
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
                      <Text style={styles.videoPreviewHint}>New video ready to upload</Text>
                    </View>
                    <Pressable style={styles.videoRemoveIcon} onPress={() => setVideoFile(null)} hitSlop={8}>
                      <MaterialCommunityIcons name="close-circle" size={24} color={Brand.danger} />
                    </Pressable>
                  </View>
                ) : existingVideoUrl && !removeVideo ? (
                  <View style={styles.videoPreviewCard}>
                    <View style={styles.videoPreviewThumb}>
                      <MaterialCommunityIcons name="play-circle" size={36} color="#FFFFFF" />
                    </View>
                    <View style={styles.videoPreviewInfo}>
                      <Text style={styles.videoPreviewName} numberOfLines={1}>
                        {existingVideoUrl.split('/').pop() || 'Current video'}
                      </Text>
                      <Text style={styles.videoPreviewHint}>Current video</Text>
                    </View>
                    <Pressable
                      style={styles.videoRemoveIcon}
                      onPress={() => setRemoveVideo(true)}
                      hitSlop={8}
                    >
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

              {/* ── Status ─────────────────────────────────────────── */}
              <SectionCard
                title="Visibility"
                icon="eye-outline"
                expanded={expandedSection === 'status'}
                onToggle={() => toggleSection('status')}
                styles={styles}
                colors={colors}
              >
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
                    <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
                    <Text style={styles.submitText}>Save Changes</Text>
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
                    <Pressable
                      style={({ pressed }) => [styles.catUseParentBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => { setCategoryId(displayCategory.id); setShowCategoryModal(false); }}
                    >
                      <MaterialCommunityIcons name="folder-open-outline" size={16} color={colors.textTertiary} />
                      <Text style={styles.catUseParentText}>
                        Use {displayCategory.name} directly
                      </Text>
                    </Pressable>
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

  row: { flexDirection: 'row', gap: Spacing.two + Spacing.half },
  halfCol: { flex: 1, gap: Spacing.one },

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
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
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

  catUseParentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two - 2,
    paddingVertical: Spacing.two + Spacing.half,
    marginTop: Spacing.two,
  },
  catUseParentText: { fontSize: 13, color: c.textTertiary, fontWeight: '500' },

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
