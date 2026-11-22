import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AlertTriangle, Check, Circle, CircleDot, Square, SquareCheck } from 'lucide-react-native';
import { SignaturePad } from '@/components/SignaturePad';
import {
  isSupported, isVisible, labelOf, optionLabel, optionValue, scaleRange, sections,
  type FormData, type FormField,
} from '@/lib/forms';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * Draws a form template on a phone or tablet — every field type the web renderer supports
 * (text, textarea, email, phone, number, date, select, radio, checkbox, checkboxes, scale,
 * signature, heading, paragraph), with sections, show-when conditions, role-visible fields
 * and translations. A type it does not know is SHOWN as unanswerable, never silently dropped.
 */
export const FormRenderer: React.FC<{
  fields: FormField[];
  data: FormData;
  onChange: (next: FormData) => void;
  role: string;
  errors?: Record<string, string>;
  language?: string;
  readOnly?: boolean;
  onDrawing?: (drawing: boolean) => void;
}> = ({ fields, data, onChange, role, errors = {}, language = 'en', readOnly = false, onDrawing }) => {
  const set = (id: string, v: unknown) => { if (!readOnly) onChange({ ...data, [id]: v }); };

  const field = (f: FormField) => {
    if (!isVisible(f, data, role)) return null;
    const label = labelOf(f, language);
    if (!isSupported(f)) {
      return (
        <View key={f.id} style={styles.unsupported}>
          <AlertTriangle size={16} color={palette.warningText} />
          <Text style={styles.unsupportedText}>
            “{label}” cannot be answered here: this form asks for a “{String(f.type)}” field, which this version does not support. Please ask your practice to update the form.
          </Text>
        </View>
      );
    }
    if (f.type === 'heading') {
      return (
        <View key={f.id} style={styles.heading}>
          <Text style={styles.headingText}>{label}</Text>
          {f.helpText ? <Text style={styles.help}>{f.helpText}</Text> : null}
        </View>
      );
    }
    if (f.type === 'paragraph') return <Text key={f.id} style={styles.paragraph}>{label}</Text>;

    const v = data[f.id];
    const err = errors[f.id];
    const text = v === undefined || v === null ? '' : String(v);
    const input = (extra: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
      <TextInput
        value={text}
        onChangeText={(t) => set(f.id, t)}
        editable={!readOnly}
        placeholder={f.placeholder ?? ''}
        placeholderTextColor={palette.textMuted}
        accessibilityLabel={label}
        style={[styles.input, err && styles.inputError]}
        {...extra}
      />
    );
    const opts = f.options ?? [];

    return (
      <View key={f.id} style={styles.field}>
        {f.type !== 'checkbox' ? (
          <Text style={styles.label}>{label}{f.required ? <Text style={styles.req}> *</Text> : null}</Text>
        ) : null}
        {f.helpText && f.type !== 'heading' ? <Text style={styles.help}>{f.helpText}</Text> : null}

        {f.type === 'text' ? input() : null}
        {f.type === 'email' ? input({ keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email', placeholder: f.placeholder ?? 'email@example.com' }) : null}
        {f.type === 'phone' ? input({ keyboardType: 'phone-pad', autoComplete: 'tel' }) : null}
        {f.type === 'number' ? input({ keyboardType: 'numeric' }) : null}
        {f.type === 'date' ? input({ placeholder: 'YYYY-MM-DD', autoCapitalize: 'none', keyboardType: 'numbers-and-punctuation' }) : null}
        {f.type === 'textarea' ? input({ multiline: true, style: [styles.input, styles.textarea, err && styles.inputError] }) : null}

        {f.type === 'select' || f.type === 'radio' ? (
          <View style={styles.options} accessibilityRole="radiogroup">
            {opts.map((o) => {
              const ov = optionValue(o); const on = text === ov;
              const Icon = on ? CircleDot : Circle;
              return (
                <Pressable key={ov} onPress={() => set(f.id, ov)} disabled={readOnly} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={[styles.option, on && styles.optionOn]}>
                  <Icon size={18} color={on ? palette.accent : palette.textSecondary} />
                  <Text style={styles.optionText}>{optionLabel(o)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {f.type === 'checkbox' ? (
          <View style={styles.checkRow}>
            <Switch value={v === true} onValueChange={(on) => set(f.id, on)} disabled={readOnly} accessibilityLabel={label} />
            <Text style={styles.checkLabel}>{label}{f.required ? <Text style={styles.req}> *</Text> : null}</Text>
          </View>
        ) : null}

        {f.type === 'checkboxes' ? (
          <View style={styles.options}>
            {opts.map((o) => {
              const ov = optionValue(o);
              const arr = Array.isArray(v) ? (v as string[]) : [];
              const on = arr.includes(ov);
              const Icon = on ? SquareCheck : Square;
              return (
                <Pressable key={ov} disabled={readOnly} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  onPress={() => set(f.id, on ? arr.filter((x) => x !== ov) : [...arr, ov])}
                  style={[styles.option, on && styles.optionOn]}>
                  <Icon size={18} color={on ? palette.accent : palette.textSecondary} />
                  <Text style={styles.optionText}>{optionLabel(o)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {f.type === 'scale' ? (
          <View style={styles.scale}>
            {scaleRange(f).map((n) => {
              const on = v !== undefined && v !== '' && Number(v) === n;
              return (
                <Pressable key={n} onPress={() => set(f.id, n)} disabled={readOnly} accessibilityRole="button" accessibilityLabel={`${label} ${n}`}
                  accessibilityState={{ selected: on }} style={[styles.scaleBtn, on && styles.scaleOn]}>
                  {on ? <Check size={12} color={palette.text} /> : null}
                  <Text style={[styles.scaleText, on && styles.scaleTextOn]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {f.type === 'signature' ? (
          <SignaturePad value={typeof v === 'string' ? v : null} onChange={(d) => set(f.id, d ?? '')} onDrawing={onDrawing} invalid={Boolean(err)} />
        ) : null}

        {err ? <Text style={styles.error}>{err}</Text> : null}
      </View>
    );
  };

  const groups = sections(fields);
  return (
    <View style={styles.wrap}>
      {groups.map((g) => (
        <View key={g.name ?? '_'} style={g.name ? styles.section : undefined}>
          {g.name ? <Text style={styles.sectionTitle}>{g.name}</Text> : null}
          <View style={styles.wrap}>{g.fields.map(field)}</View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  section: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border },
  sectionTitle: { ...type.md, color: palette.text, fontWeight: '700' },
  heading: { paddingTop: space.sm, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: space.xs },
  headingText: { ...type.md, color: palette.text, fontWeight: '600' },
  paragraph: { ...type.sm, color: palette.textSecondary, backgroundColor: palette.raised, padding: space.md, borderRadius: radius.md },
  field: { gap: space.xs },
  label: { ...type.sm, color: palette.textStrong },
  req: { color: palette.danger },
  help: { ...type.xs, color: palette.textMuted },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised, paddingHorizontal: space.md, color: palette.text, ...type.md },
  textarea: { minHeight: 96, paddingTop: space.sm, textAlignVertical: 'top' },
  inputError: { borderColor: palette.danger },
  options: { gap: space.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border },
  optionOn: { borderColor: palette.accent },
  optionText: { ...type.sm, color: palette.text, flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  checkLabel: { ...type.sm, color: palette.text, flex: 1 },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  scaleBtn: { minWidth: 44, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2 },
  scaleOn: { backgroundColor: palette.accentFrom, borderColor: palette.accentFrom },
  scaleText: { ...type.sm, color: palette.textSecondary, fontWeight: '600' },
  scaleTextOn: { color: palette.text },
  error: { ...type.xs, color: palette.danger },
  unsupported: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: palette.raised, alignItems: 'flex-start' },
  unsupportedText: { ...type.xs, color: palette.warningText, flex: 1 },
});
