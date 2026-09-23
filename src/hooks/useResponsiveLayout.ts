import * as Device from 'expo-device';
import { Platform, useWindowDimensions } from 'react-native';

export const TABLET_BREAKPOINT = 700;
export const TABLET_NAV_WIDTH = 184;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT && Device.deviceType !== Device.DeviceType.PHONE;
  const isLargeTablet = isTablet && width >= 900;
  const productColumns = isTablet ? (width >= 1200 ? 4 : 3) : 2;
  const contentMaxWidth = 1440;
  const navWidth = isTablet && Platform.OS !== 'web' ? TABLET_NAV_WIDTH : 0;
  const contentWidth = Math.min(width - navWidth, contentMaxWidth);

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    productColumns,
    contentMaxWidth,
    contentWidth,
  };
}
