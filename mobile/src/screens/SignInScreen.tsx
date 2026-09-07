import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Server } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { ErrorNote, PrimaryButton, Screen } from '@/components/ui';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * One email box for both audiences.
 *
 * The person signing in should not have to know whether they are a "staff
 * account" or a "portal account" — the session layer tries both and the
 * account's role decides which shell opens. Nothing here picks a role.
 */
export const SignInScreen: React.FC<{ onOpenServer: () => void }> = ({ onOpenServer }) => {
  const { signInWithPassword, serverUrl } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A failed attempt should not keep shouting while the person fixes it.
  useEffect(() => setError(null), [email, password]);

  const submit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }, [email, password, signInWithPassword]);

  const host = serverUrl.replace(/^https?:\/\//, '');

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.wordmark}>AureonCare</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Practice account or patient portal</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              style={[styles.input, error ? styles.inputError : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
              returnKeyType="go"
              style={styles.input}
            />
          </View>

          {error ? <ErrorNote message={error} /> : null}

          <PrimaryButton label="Sign in" onPress={submit} busy={busy} style={styles.submit} />

          <View style={styles.fill} />

          <Pressable
            onPress={onOpenServer}
            accessibilityRole="button"
            accessibilityLabel={`Change server, currently ${host}`}
            style={styles.serverRow}
          >
            <Server size={14} color={palette.textMuted} />
            <Text style={styles.serverText}>{host}</Text>
            <Text style={styles.serverAction}>Change server</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md },
  wordmark: {
    ...type.display,
    color: palette.text,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: space.xl,
  },
  title: { ...type.display, color: palette.text, fontWeight: '700' },
  subtitle: { ...type.base, color: palette.textSecondary, marginBottom: space.sm },
  field: { gap: space.xs },
  label: { ...type.sm, color: palette.textStrong },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
    paddingHorizontal: space.md,
    color: palette.text,
    ...type.md,
  },
  inputError: { borderColor: palette.danger },
  submit: { marginTop: space.sm },
  serverRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  serverText: { ...type.xs, color: palette.textMuted },
  serverAction: { ...type.xs, color: palette.textSecondary, textDecorationLine: 'underline' },
});
