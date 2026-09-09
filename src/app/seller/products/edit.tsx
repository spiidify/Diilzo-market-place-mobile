import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {Image,
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { apiRequest } from '@/services/api';
import { fetchBrands, fetchCategories } from '@/services/catalog';
import { getProductDetail, updateProduct } from '@/services/seller';
import type { Brand as BrandType, Category, Product } from '@/types';

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

export default function EditProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ product_id?: string; slug?: string }>();
  const productId = params.product_id;
  const slug = params.slug;

  // ── Form state ──────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [minOrderQty, setMinOrderQty] = useState('1');
  const [weight, setWeight] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

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
        ? await apiRequest<Product>({ method: 'GET', url: `/products/${slug}/` })
        : await getProductDetail(Number(productId));
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price || '');
      setSalePrice(product.sale_price || '');
      setStock(String(product.stock_quantity || 0));
      setSku(product.sku || '');
      setCategoryId(product.category?.id ?? null);
      setBrandId(product.brand?.id ?? null);
      setMinOrderQty(String(product.min_order_quantity || 1));
      setWeight(product.weight || '');
      setVideoUrl(product.video_url || '');
      setIsActive(product.is_active);
      const imgs = ((product.images || []) as Array<{ image_url?: string }>)
        .map((img) => img.image_url)
        .filter((u): u is string => Boolean(u));
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
        selectionLimit: 6,
      });
      if (result.canceled) return;
      const picked: PickedImage[] = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        name: `image_${Date.now()}_${idx}.jpg`,
        type: 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 6));
    } catch {
      Alert.alert('Error', 'Could not pick images');
    }
  };

  const removeNewImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
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
      formData.append('price', price.trim());
      if (salePrice.trim()) formData.append('sale_price', salePrice.trim());
      formData.append('stock_quantity', stock.trim() || '0');
      if (sku.trim()) formData.append('sku', sku.trim());
      if (categoryId) formData.append('category', String(categoryId));
      if (brandId) formData.append('brand', String(brandId));
      formData.append('min_order_quantity', minOrderQty.trim() || '1');
      if (weight.trim()) formData.append('weight', weight.trim());
      if (videoUrl.trim()) formData.append('video_url', videoUrl.trim());
      formData.append('is_active', isActive ? 'true' : 'false');

      images.forEach((img) => {
        formData.append('images', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as any);
      });

      if (productId) {
        await updateProduct(Number(productId), formData);
      } else if (slug) {
        // Fallback: use public product endpoint (read-only, won't work for PATCH)
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

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedBrand = brands.find((b) => b.id === brandId);
  const isLoading = loadingMeta || loadingProduct;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Product</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

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
            >
              {/* ── Existing images ───────────────────────────────── */}
              {existingImages.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Current Images</Text>
                  <View style={styles.imageRow}>
                    {existingImages.map((uri, idx) => (
                      <View key={`ex-${idx}`} style={styles.thumbWrap}>
                        <Image source={{ uri }} style={styles.thumb} resizeMode="contain" />
                        <Pressable
                          style={styles.thumbRemove}
                          onPress={() => removeExistingImage(idx)}
                          hitSlop={8}
                        >
                          <MaterialCommunityIcons name="close-circle" size={20} color={Brand.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* ── New images ─────────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Add New Images</Text>
              <View style={styles.imageRow}>
                {images.map((img, idx) => (
                  <View key={`new-${idx}`} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="contain" />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => removeNewImage(idx)}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons name="close-circle" size={20} color={Brand.danger} />
                    </Pressable>
                  </View>
                ))}
                {images.length < 6 && (
                  <Pressable style={styles.addImageBtn} onPress={pickImages}>
                    <MaterialCommunityIcons name="camera-plus" size={26} color={Brand.primary} />
                    <Text style={styles.addImageText}>Add</Text>
                  </Pressable>
                )}
              </View>

              {/* ── Basic info ─────────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Organic Avocado"
                  placeholderTextColor={Brand.textTertiary}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your product..."
                  placeholderTextColor={Brand.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* ── Pricing & inventory ────────────────────────────── */}
              <Text style={styles.sectionTitle}>Pricing & Inventory</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Price (UGX) *</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0"
                      placeholderTextColor={Brand.textTertiary}
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
                      placeholderTextColor={Brand.textTertiary}
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
                      placeholderTextColor={Brand.textTertiary}
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
                      placeholderTextColor={Brand.textTertiary}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.label}>Min Order Qty</Text>
                    <TextInput
                      style={styles.input}
                      value={minOrderQty}
                      onChangeText={setMinOrderQty}
                      placeholder="1"
                      placeholderTextColor={Brand.textTertiary}
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
                      placeholderTextColor={Brand.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              {/* ── Category & brand ───────────────────────────────── */}
              <Text style={styles.sectionTitle}>Organization</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Category</Text>
                <Pressable style={styles.dropdown} onPress={() => setShowCategoryModal(true)}>
                  <Text
                    style={[
                      styles.dropdownText,
                      !selectedCategory && styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCategory ? selectedCategory.name : 'Select category'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={Brand.textSecondary} />
                </Pressable>

                <Text style={styles.label}>Brand</Text>
                <Pressable style={styles.dropdown} onPress={() => setShowBrandModal(true)}>
                  <Text
                    style={[
                      styles.dropdownText,
                      !selectedBrand && styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedBrand ? selectedBrand.name : 'Select brand (optional)'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={Brand.textSecondary} />
                </Pressable>
              </View>

              {/* ── Media & status ─────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Media & Status</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Video URL</Text>
                <TextInput
                  style={styles.input}
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  placeholder="https://youtube.com/..."
                  placeholderTextColor={Brand.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Active (visible to buyers)</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: Brand.border, true: Brand.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={Brand.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* ── Submit ─────────────────────────────────────────── */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.85 },
                  submitting && { opacity: 0.6 },
                ]}
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

        {/* ── Category modal ─────────────────────────────────────── */}
        <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <Pressable onPress={() => setShowCategoryModal(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={Brand.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalList}>
                {categories.map((cat) => (
                  <Pressable
                    key={`cat-${cat.id}`}
                    style={[
                      styles.modalItem,
                      cat.id === categoryId && { backgroundColor: Brand.surfaceAlt },
                    ]}
                    onPress={() => {
                      setCategoryId(cat.id);
                      setShowCategoryModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{cat.name}</Text>
                    {cat.id === categoryId && (
                      <MaterialCommunityIcons name="check" size={20} color={Brand.primary} />
                    )}
                  </Pressable>
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
                  <MaterialCommunityIcons name="close" size={24} color={Brand.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalList}>
                <Pressable
                  style={[
                    styles.modalItem,
                    brandId === null && { backgroundColor: Brand.surfaceAlt },
                  ]}
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
                    style={[
                      styles.modalItem,
                      br.id === brandId && { backgroundColor: Brand.surfaceAlt },
                    ]}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primaryDark },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.two, color: Brand.textSecondary, fontSize: 14 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },

  card: {
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two + Spacing.half,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  label: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.surfaceAlt,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  row: { flexDirection: 'row', gap: Spacing.two + Spacing.half },
  halfCol: { flex: 1, gap: Spacing.one },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    backgroundColor: Brand.surfaceAlt,
  },
  dropdownText: { fontSize: 15, color: Brand.text, flex: 1 },
  dropdownPlaceholder: { color: Brand.textTertiary },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbWrap: { width: 84, height: 84, borderRadius: 12, overflow: 'visible' },
  thumb: { width: 84, height: 84, borderRadius: 12 },
  thumbRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#FFFFFF', borderRadius: 10 },
  addImageBtn: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.surface,
  },
  addImageText: { fontSize: 11, color: Brand.primary, fontWeight: '600', marginTop: 2 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Brand.text },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: Spacing.three - Spacing.half,
    marginTop: Spacing.three,
  },
  errorText: { flex: 1, fontSize: 13, color: Brand.danger, fontWeight: '500' },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },
  modalList: { paddingVertical: Spacing.two },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three - Spacing.half,
  },
  modalItemText: { fontSize: 15, color: Brand.text },
});
