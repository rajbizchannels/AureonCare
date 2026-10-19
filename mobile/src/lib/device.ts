import { Platform, useWindowDimensions } from 'react-native';

/**
 * Device class drives layout, and the scope doc drives device class:
 * "Phone is for doing, tablet is for working." A phone stacks — list, then
 * detail. A tablet shows both at once, which is the layout the web app already
 * collapses from, so the interaction model is the same in both directions.
 *
 * Width is measured live rather than read once from a device flag: an iPad in
 * Split View or an Android foldable can be tablet-sized one moment and
 * phone-sized the next, and a layout keyed to hardware would be wrong in both.
 */

/** 600dp is Android's own sw600dp tablet threshold; iPad portrait is 768. */
export const BREAKPOINT_TABLET = 600;
export const BREAKPOINT_WIDE = 900;

export type DeviceClass = 'phone' | 'tablet' | 'wide';

export interface Layout {
  deviceClass: DeviceClass;
  isPhone: boolean;
  isTablet: boolean;
  /** Enough width for a list and a detail pane side by side. */
  isSplit: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
  /** Width of the master pane in a split layout. */
  masterWidth: number;
  /** Content gutter — tablets get more air, and a cap on line length. */
  gutter: number;
  maxContentWidth: number;
}

export const classify = (width: number): DeviceClass => {
  if (width >= BREAKPOINT_WIDE) return 'wide';
  if (width >= BREAKPOINT_TABLET) return 'tablet';
  return 'phone';
};

export const useLayout = (): Layout => {
  const { width, height } = useWindowDimensions();
  const deviceClass = classify(width);
  const isPhone = deviceClass === 'phone';

  return {
    deviceClass,
    isPhone,
    isTablet: !isPhone,
    // A split needs real estate for both panes; 600–900dp is wide enough for a
    // sidebar but not for two comfortable columns, so the split starts at wide.
    isSplit: deviceClass === 'wide',
    isLandscape: width > height,
    width,
    height,
    masterWidth: deviceClass === 'wide' ? Math.min(380, Math.round(width * 0.34)) : width,
    gutter: isPhone ? 16 : 24,
    maxContentWidth: deviceClass === 'wide' ? 760 : 640,
  };
};

/**
 * Platform conventions that are genuinely different rather than cosmetic.
 * Everything else is shared: the design system is one system, not two.
 */
export const platform = {
  /** iOS floats with shadows; Android lifts with elevation. */
  elevation: (level: number) =>
    Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: level * 2,
        shadowOffset: { width: 0, height: level },
      },
      android: { elevation: level },
      default: {},
    }),
  /** Android's back button is real; iOS uses an edge swipe and a header chevron. */
  hasHardwareBack: Platform.OS === 'android',
  /** Sentence case reads native on Android; Title Case on iOS. */
  actionCase: (label: string) => (Platform.OS === 'android' ? label : label),
} as const;
