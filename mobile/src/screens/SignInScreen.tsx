import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { ArrowLeft, Server, ShieldCheck } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { ErrorNote, PrimaryButton, Screen } from '@/components/ui';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * One email box for both audiences, and a second step when the practice asks
 * for one.
 *
 * The person signing in should not have to know whether they are a "staff
 * account" or a "portal account" — the session layer tries both and the
 * account's role decides which shell opens. Nothing here picks a role.
 */

type Step =
  | { name: 'credentials' }
  | { name: 'second-factor'; prompt: string }
  | { name: 'enrol-elsewhere'; prompt: string };

export const SignInScreen: React.FC<{ onOpenServer: () => void }> = ({ onOpenServer }) => {
  const { signInWithPassword, serverUrl, endedReason } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ name: 'credentials' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A failed attempt should not keep shouting while the person fixes it.
  useEffect(() => setError(null), [email, password, code]);

  const attempt = useCallback(
    async (mfaCode?: string) => {
      setBusy(true);
      try {
        const outcome = await signInWithPassword(email.trim(), password, mfaCode);
        if (outcome.kind === 'mfa-required') {
          setStep({ name: 'second-factor', prompt: outcome.message });
          setCode('');
        } else if (outcome.kind === 'mfa-enrolment-required') {
          setStep({ name: 'enrol-elsewhere', prompt: outcome.message });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not sign in.');
      } finally {
        setBusy(false);
      }
    },
    [email, password, signInWithPassword]
  );

  const submitCredentials = useCallback(() => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    void attempt();
  }, [email, password, attempt]);

  const submitCode = useCallback(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the code from your authenticator app.');
      return;
    }
    void attempt(trimmed);
  }, [code, attempt]);

  const restart = useCallback(() => {
    setStep({ name: 'credentials' });
    setCode('');
    setError(null);
  }, []);

  const host = serverUrl.replace(/^https?:\/\//, '');

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.wordmark}>AureonCare</Text>

          {step.name === 'credentials' ? (
            <>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>Practice account or patient portal</Text>

              {/* An idle sign-out looks exactly like being thrown out for no
                  reason unless it is named. */}
              {endedReason === 'timed-out' ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    You were signed out after a period of inactivity. Sign in to carry on.
                  </Text>
                </View>
              ) : null}

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
                  onSubmitEditing={submitCredentials}
                  returnKeyType="go"
                  style={styles.input}
                />
              </View>

              {error ? <ErrorNote message={error} /> : null}

              <PrimaryButton
                label="Sign in"
                onPress={submitCredentials}
                busy={busy}
                style={styles.submit}
              />
            </>
          ) : step.name === 'second-factor' ? (
            <>
              <View style={styles.badge}>
                <ShieldCheck size={18} color={palette.accent} />
              </View>
              <Text style={styles.title}>Two-factor</Text>
              <Text style={styles.subtitle}>{step.prompt}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Six-digit code</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoFocus
                  keyboardType="number-pad"
                  // iOS fills this straight from the SMS/authenticator banner.
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={10}
                  onSubmitEditing={submitCode}
                  returnKeyType="go"
                  style={[styles.input, styles.codeInput, error ? styles.inputError : null]}
                />
                <Text style={styles.hint}>
                  A recovery code works here too, if you cannot reach your authenticator.
                </Text>
              </View>

              {error ? <ErrorNote message={error} /> : null}

              <PrimaryButton label="Verify" onPress={submitCode} busy={busy} style={styles.submit} />

              <Pressable onPress={restart} accessibilityRole="button" style={styles.backRow}>
                <ArrowLeft size={14} color={palette.textSecondary} />
                <Text style={styles.backLabel}>Use a different account</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Set up two-factor</Text>
              <Text style={styles.subtitle}>{step.prompt}</Text>
              <Text style={styles.hint}>
                Enrolment needs a scannable QR code, so it is done in the web app under
                Settings → Security. Once it is on, sign in here as normal.
              </Text>
              <Pressable onPress={restart} accessibilityRole="button" style={styles.backRow}>
                <ArrowLeft size={14} color={palette.textSecondary} />
                <Text style={styles.backLabel}>Back to sign in</Text>
              </Pressable>
            </>
          )}

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
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: tint.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, color: palette.text, fontWeight: '700' },
  subtitle: { ...type.base, color: palette.textSecondary, marginBottom: space.sm },
  notice: {
    borderRadius: radius.md,
    backgroundColor: tint.warningSoft,
    borderWidth: 1,
    borderColor: tint.warningBorder,
    padding: space.md,
  },
  noticeText: { ...type.sm, color: palette.textOnRaised },
  field: { gap: space.xs },
  label: { ...type.sm, color: palette.textStrong },
  hint: { ...type.xs, color: palette.textMuted },
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
  codeInput: { ...type.display, letterSpacing: 6, textAlign: 'center' },
  inputError: { borderColor: palette.danger },
  submit: { marginTop: space.sm },
  backRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  backLabel: { ...type.sm, color: palette.textSecondary },
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
