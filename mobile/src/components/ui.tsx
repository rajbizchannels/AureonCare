import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, radius, space, tint, type, HIT_SLOP_MIN } from '@/theme/tokens';

/** Screen frame. Edges are handled here so no screen paints under the notch. */
export const Screen: React.FC<{
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}> = ({ children, scroll = false, edges = ['top'] }) => (
  <SafeAreaView style={styles.screen} edges={edges}>
    {scroll ? (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    ) : (
      children
    )}
  </SafeAreaView>
);

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

/**
 * The app's one primary action style — the cyan→blue gradient of the web app,
 * flattened to its mid tone so no gradient dependency is needed for a control
 * this small. `expo-linear-gradient` is the upgrade if it ever needs the ramp.
 */
export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ label, onPress, disabled, busy, icon, style }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || busy}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.primary,
      (disabled || busy) && styles.primaryDisabled,
      pressed && styles.pressed,
      style,
    ]}
  >
    {busy ? (
      <ActivityIndicator color={palette.text} />
    ) : (
      <>
        {icon}
        <Text style={styles.primaryLabel}>{label}</Text>
      </>
    )}
  </Pressable>
);

export const SecondaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ label, onPress, icon, style }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [styles.secondary, pressed && styles.pressed, style]}
  >
    {icon}
    <Text style={styles.secondaryLabel}>{label}</Text>
  </Pressable>
);

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export const Chip: React.FC<{ label: string; tone?: ChipTone }> = ({ label, tone = 'neutral' }) => (
  <View style={[styles.chip, chipTone[tone].container]}>
    <Text style={[styles.chipLabel, chipTone[tone].label]}>{label}</Text>
  </View>
);

export const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>
);

export const Divider: React.FC = () => <View style={styles.divider} />;

export const Loading: React.FC<{ label?: string }> = ({ label }) => (
  <View style={styles.centre}>
    <ActivityIndicator color={palette.accent} />
    {label ? <Text style={styles.centreLabel}>{label}</Text> : null}
  </View>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({
  icon,
  title,
  hint,
}) => (
  <View style={styles.centre}>
    {icon}
    <Text style={styles.emptyTitle}>{title}</Text>
    {hint ? <Text style={styles.centreLabel}>{hint}</Text> : null}
  </View>
);

export const ErrorNote: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.errorNote}>
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

const chipTone: Record<ChipTone, { container: ViewStyle; label: { color: string } }> = {
  neutral: { container: { backgroundColor: tint.neutralSoft }, label: { color: palette.textSecondary } },
  accent: { container: { backgroundColor: palette.accentFrom }, label: { color: palette.text } },
  success: { container: { backgroundColor: tint.successSoft }, label: { color: palette.successText } },
  warning: { container: { backgroundColor: tint.warningSoft }, label: { color: palette.warningText } },
  danger: { container: { backgroundColor: tint.dangerSoft }, label: { color: palette.danger } },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: space.lg,
  },
  primary: {
    minHeight: HIT_SLOP_MIN,
    borderRadius: radius.md,
    backgroundColor: palette.accentFrom,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  primaryDisabled: { opacity: 0.45 },
  primaryLabel: { ...type.lg, color: palette.text, fontWeight: '600' },
  secondary: {
    minHeight: HIT_SLOP_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  secondaryLabel: { ...type.md, color: palette.textStrong, fontWeight: '500' },
  pressed: { opacity: 0.7 },
  chip: {
    height: 22,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  chipLabel: { ...type.xs, fontWeight: '600' },
  sectionLabel: {
    ...type.xs,
    color: palette.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  divider: { height: 1, backgroundColor: palette.hairline },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  centreLabel: { ...type.base, color: palette.textSecondary, textAlign: 'center' },
  emptyTitle: { ...type.lg, color: palette.text, fontWeight: '600', textAlign: 'center' },
  errorNote: {
    borderRadius: radius.md,
    backgroundColor: tint.dangerSoft,
    borderWidth: 1,
    borderColor: tint.dangerBorder,
    padding: space.md,
  },
  errorText: { ...type.base, color: palette.danger },
});
