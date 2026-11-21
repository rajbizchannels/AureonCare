import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Provider } from '@/lib/socialSignIn';

/**
 * "Continue with Google" / "Continue with Microsoft" in each provider's own button style,
 * the same rules as the web app (frontend/src/components/common/SocialSignInButton.js):
 *
 *   Google    dark  #131314 fill, 1px #8E918F stroke, #E3E3E3 text
 *             light #FFFFFF fill, 1px #747775 stroke, #1F1F1F text
 *             Roboto Medium 14 (the system face on iOS), 40pt tall, 20pt "G", 10pt gap, 4pt corners
 *   Microsoft dark  #2F2F2F fill, #FFFFFF text
 *             light #FFFFFF fill, 1px #8C8C8C border, #5E5E5E text
 *             semibold 15, 41pt tall, 21pt logo, 12pt gap, square corners
 *
 * The app is dark, so the dark variants are the default.
 */

const GoogleLogo = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);

const MicrosoftLogo = ({ size = 21 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 21 21">
    <Rect x={1} y={1} width={9} height={9} fill="#F25022" />
    <Rect x={11} y={1} width={9} height={9} fill="#7FBA00" />
    <Rect x={1} y={11} width={9} height={9} fill="#00A4EF" />
    <Rect x={11} y={11} width={9} height={9} fill="#FFB900" />
  </Svg>
);

const COLOURS = {
  google: {
    dark: { bg: '#131314', border: '#8E918F', text: '#E3E3E3', pressed: '#1E1F20' },
    light: { bg: '#FFFFFF', border: '#747775', text: '#1F1F1F', pressed: '#EDEDED' },
  },
  microsoft: {
    dark: { bg: '#2F2F2F', border: '#2F2F2F', text: '#FFFFFF', pressed: '#3B3B3B' },
    light: { bg: '#FFFFFF', border: '#8C8C8C', text: '#5E5E5E', pressed: '#F2F2F2' },
  },
} as const;

const LABEL: Record<Provider, string> = { google: 'Continue with Google', microsoft: 'Continue with Microsoft' };

export const SocialSignInButton: React.FC<{
  provider: Provider;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  scheme?: 'dark' | 'light';
  label?: string;
}> = ({ provider, onPress, busy = false, disabled = false, scheme = 'dark', label }) => {
  const c = COLOURS[provider][scheme];
  const g = provider === 'google';
  const text = busy ? `Opening ${g ? 'Google' : 'Microsoft'}…` : label || LABEL[provider];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label || LABEL[provider]}
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID={`social-${provider}`}
      style={({ pressed }) => [
        g ? styles.google : styles.microsoft,
        { backgroundColor: pressed ? c.pressed : c.bg, borderColor: c.border },
        (disabled || busy) && styles.disabled,
      ]}
    >
      <View style={g ? styles.logoG : styles.logoM}>
        {busy ? <ActivityIndicator size="small" color={c.text} /> : g ? <GoogleLogo /> : <MicrosoftLogo />}
      </View>
      <Text numberOfLines={1} style={[g ? styles.labelG : styles.labelM, { color: c.text }]}>{text}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  google: {
    height: 40, borderRadius: 4, borderWidth: 1, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  microsoft: {
    height: 41, borderRadius: 0, borderWidth: 1, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  logoG: { width: 20, height: 20, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  logoM: { width: 21, height: 21, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  labelG: {
    fontSize: 14, lineHeight: 20, letterSpacing: 0.25,
    ...Platform.select({ android: { fontFamily: 'sans-serif-medium' }, default: { fontWeight: '500' as const } }),
  },
  labelM: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
