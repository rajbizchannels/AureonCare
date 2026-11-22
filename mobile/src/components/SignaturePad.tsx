import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { signatureDataUrl } from '@/lib/forms';
import { palette, radius, space, type } from '@/theme/tokens';

const encode = (s: string): string => (globalThis as unknown as { btoa: (x: string) => string }).btoa(s);

/**
 * Sign with a finger or stylus. The strokes are kept as SVG paths and saved as an SVG data
 * URL (data:image/svg+xml;base64,…) — the same field the web signature fills, shown the same
 * way in the chart. `onDrawing` lets a parent ScrollView stop scrolling while the pen is down.
 */
export const SignaturePad: React.FC<{
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  onDrawing?: (drawing: boolean) => void;
  invalid?: boolean;
}> = ({ value, onChange, onDrawing, invalid }) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const size = useRef({ w: 300, h: 140 });
  const live = useRef('');

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      onDrawing?.(true);
      const { locationX: x, locationY: y } = e.nativeEvent;
      live.current = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      setCurrent(live.current);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      live.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      setCurrent(live.current);
    },
    onPanResponderRelease: () => {
      onDrawing?.(false);
      const stroke = live.current;
      live.current = '';
      setCurrent('');
      if (!stroke.includes('L')) return;   // a tap, not a stroke
      setPaths((p) => {
        const next = [...p, stroke];
        onChange(signatureDataUrl(next, size.current.w, size.current.h, encode));
        return next;
      });
    },
    onPanResponderTerminate: () => { onDrawing?.(false); live.current = ''; setCurrent(''); },
  }), [onChange, onDrawing]);

  const clear = () => { setPaths([]); setCurrent(''); onChange(null); };
  const onLayout = (e: LayoutChangeEvent) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; };
  const signed = paths.length > 0 || Boolean(value);

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.pad, invalid && styles.invalid]}
        onLayout={onLayout}
        accessibilityLabel="Signature pad: draw your signature"
        {...responder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {paths.map((d, i) => <Path key={i} d={d} stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {current ? <Path d={current} stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {!signed && !current ? <Text style={styles.hint} pointerEvents="none">Sign here</Text> : null}
      </View>
      <View style={styles.row}>
        <Text style={styles.status}>{signed ? 'Signed' : 'Not signed yet'}</Text>
        <Pressable onPress={clear} accessibilityRole="button" style={styles.clear}><Text style={styles.clearText}>Clear</Text></Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  pad: { height: 140, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: '#ffffff', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  invalid: { borderColor: palette.danger },
  hint: { position: 'absolute', ...type.sm, color: '#94a3b8' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { ...type.xs, color: palette.textMuted },
  clear: { minHeight: 32, paddingHorizontal: space.sm, justifyContent: 'center' },
  clearText: { ...type.sm, color: palette.accent, fontWeight: '600' },
});
