import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

export type ImagePurpose =
  | 'productCard'    // 160x160 logical, used in horizontal shelves / product cards
  | 'productDetail'  // 800x600 logical, product detail gallery
  | 'category'       // 70x70 logical, category grid / circles
  | 'avatar'         // 80x80 logical, profile pictures
  | 'carousel'       // full screen width x 220 logical, hero carousel
  | 'slide'          // 1200x400 logical, homepage promo slides
  | 'storeLogo'      // 64x64 logical, small store logos
  | 'storeBanner';   // full width x 180 logical, store banners

interface LogicalSize {
  width: number;
  height: number;
}

const LOGICAL_SIZES: Record<ImagePurpose, LogicalSize> = {
  productCard: { width: 240, height: 240 },
  productDetail: { width: 800, height: 600 },
  category: { width: 120, height: 120 },
  avatar: { width: 160, height: 160 },
  carousel: { width: 400, height: 220 }, // width replaced below by screen width
  slide: { width: 1200, height: 600 },
  storeLogo: { width: 128, height: 128 },
  storeBanner: { width: 400, height: 180 }, // width replaced below by screen width
};

/**
 * Returns Cloudinary-ready pixel dimensions for a given image purpose.
 *
 * Logical sizes are multiplied by the device's PixelRatio so that the URL
 * request matches the physical pixels the Expo <Image> will actually render.
 * This avoids blurry images on high-density screens (e.g. @3x on iPhones).
 */
export function useImageDimensions(purpose: ImagePurpose, overrides?: Partial<LogicalSize>) {
  const { width: windowWidth } = useWindowDimensions();
  const scale = PixelRatio.get();

  return useMemo(() => {
    const logical = { ...LOGICAL_SIZES[purpose], ...overrides };

    // For full-width layouts, use the actual logical screen width
    if (purpose === 'carousel' || purpose === 'storeBanner') {
      logical.width = windowWidth;
    }

    // Round up to the nearest 10 px so the same URL is more likely to be
    // reused if the exact window size bounces slightly (rounded rectangles,
    // rotation, insets). This also keeps Cloudinary cache hit rate higher.
    const round = (n: number) => Math.ceil(n / 10) * 10;

    return {
      width: round(Math.max(1, logical.width * scale)),
      height: round(Math.max(1, logical.height * scale)),
    };
  }, [purpose, windowWidth, scale, overrides]);
}
