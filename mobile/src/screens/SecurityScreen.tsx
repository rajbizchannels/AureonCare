import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource } from '@/lib/useResource';
import {
  Card, Chip, ErrorNote, Field, Loading, PrimaryButton, SecondaryButton, SectionLabel,
} from '@/components/ui';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * Two-factor authentication, set up from the phone itself.
 *
 * The web app enrols by showing a QR code to scan, which is useless here: the
 * authenticator is on the same device, and a phone cannot photograph its own
 * screen. So this shows the base32 key to copy and paste instead — the same
 * secret, the manual-entry path every authenticator app supports.
 *
 * That makes the phone a sufficient device for a practice that requires a
 * second factor, rather than sending people to find a desktop.
 */

type Stage =
  | { name: 'idle' }
  | { name: 'enrolling'; key: string }
  | { name: 'done'; backupCodes: string[] };

export const SecurityScreen: React.FC = () => {
  const { api } = useSession();
  const { gutter } = useLayout();
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const status = useResource(() => api.mfaStatus(), [api]);

  const begin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const enrolment = await api.beginMfaEnrolment();
      setStage({ name: 'enrolling', key: enrolment.base32 });
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start enrolment.');
    } finally {
      setBusy(false);
    }
  }, [api]);

  const confirm = useCallback(async () => {
    if (!code.trim()) {
      setError('Enter the six-digit code your authenticator shows.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { backupCodes } = await api.confirmMfaEnrolment(code.trim());
      setStage({ name: 'done', backupCodes: backupCodes ?? [] });
      await status.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code was not accepted.');
    } finally {
      setBusy(false);
    }
  }, [api, code, status]);

  const turnOff = useCallback(async () => {
    if (!password) {
      setError('Enter your password to turn two-factor off.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.disableMfa(password);
      setPassword('');
      setStage({ name: 'idle' });
      await status.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn it off.');
    } finally {
      setBusy(false);
    }
  }, [api, password, status]);

  const copyKey = useCallback(async (key: string) => {
    await Clipboard.setStringAsync(key);
    setCopied(true);
  }, []);

  if (status.loading) return <Loading />;

  const mfa = status.data;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      {status.error ? <ErrorNote message={status.error} /> : null}

      <Card style={styles.statusCard}>
        {mfa?.enabled ? (
          <ShieldCheck size={22} color={palette.success} />
        ) : (
          <ShieldAlert size={22} color={mfa?.requiredByPractice ? palette.danger : palette.textMuted} />
        )}
        <View style={styles.statusBody}>
          <Text style={styles.statusTitle}>
            {mfa?.enabled ? 'Two-factor is on' : 'Two-factor is off'}
          </Text>
          <Text style={styles.statusHint}>
            {mfa?.enabled
              ? `${mfa.backupCodesRemaining} recovery code${mfa.backupCodesRemaining === 1 ? '' : 's'} left.`
              : mfa?.requiredByPractice
                ? 'Your practice requires it. Sign-in will be refused until it is set up.'
                : 'An authenticator app code, asked for after your password.'}
          </Text>
        </View>
        {mfa?.requiredByPractice ? <Chip label="Required" tone="warning" /> : null}
      </Card>

      {mfa?.sessionIdleMinutes ? (
        <Text style={styles.footnote}>
          This practice signs you out after {mfa.sessionIdleMinutes} minutes of inactivity.
        </Text>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {/* ── not enrolled: the three-step path ───────────────────────────── */}
      {!mfa?.enabled && stage.name === 'idle' ? (
        <PrimaryButton label="Set up two-factor" onPress={begin} busy={busy} />
      ) : null}

      {stage.name === 'enrolling' ? (
        <View style={styles.block}>
          <SectionLabel>1 · Add the key to your authenticator</SectionLabel>
          <Text style={styles.body}>
            Copy this key and paste it into your authenticator app — choose &quot;enter a
            setup key&quot; rather than scanning, since the code is on this screen.
          </Text>

          <View style={styles.keyBox}>
            <Text selectable style={styles.key}>
              {stage.key}
            </Text>
          </View>
          <SecondaryButton
            label={copied ? 'Copied' : 'Copy key'}
            onPress={() => copyKey(stage.key)}
            icon={<Copy size={15} color={palette.textStrong} />}
          />

          <SectionLabel>2 · Enter the code it shows</SectionLabel>
          <Field
            label="Six-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.codeInput}
          />
          <PrimaryButton label="Turn it on" onPress={confirm} busy={busy} />
        </View>
      ) : null}

      {stage.name === 'done' ? (
        <View style={styles.block}>
          <SectionLabel>Save your recovery codes</SectionLabel>
          <Text style={styles.body}>
            Each works once, in place of a code from the app. This is the only time they
            are shown.
          </Text>
          <View style={styles.codesBox}>
            {stage.backupCodes.length ? (
              stage.backupCodes.map((c) => (
                <Text key={c} selectable style={styles.backupCode}>
                  {c}
                </Text>
              ))
            ) : (
              <Text style={styles.body}>
                No recovery codes were issued. Generate a set in the web app under Settings
                → Security.
              </Text>
            )}
          </View>
          {stage.backupCodes.length ? (
            <SecondaryButton
              label={copied ? 'Copied' : 'Copy all'}
              onPress={() => copyKey(stage.backupCodes.join('\n'))}
              icon={<Copy size={15} color={palette.textStrong} />}
            />
          ) : null}
        </View>
      ) : null}

      {/* ── enrolled: the way back out ──────────────────────────────────── */}
      {mfa?.enabled && stage.name !== 'done' ? (
        <View style={styles.block}>
          <SectionLabel>Turn two-factor off</SectionLabel>
          <Text style={styles.body}>
            {mfa.requiredByPractice
              ? 'Your practice requires two-factor, so turning it off will lock you out at the next sign-in.'
              : 'Your password confirms it is you.'}
          </Text>
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
          <SecondaryButton label="Turn off" onPress={turnOff} />
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingVertical: space.lg, gap: space.md, paddingBottom: space.xl * 3 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusBody: { flex: 1, gap: 2 },
  statusTitle: { ...type.md, color: palette.text, fontWeight: '600' },
  statusHint: { ...type.xs, color: palette.textSecondary },
  footnote: { ...type.xs, color: palette.textMuted },
  block: { gap: space.sm },
  body: { ...type.sm, color: palette.textSecondary },
  keyBox: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: tint.accentSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  key: { ...type.md, color: palette.text, fontWeight: '600', letterSpacing: 1.5 },
  codeInput: { ...type.xl, letterSpacing: 6, textAlign: 'center' },
  codesBox: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.raised,
    borderWidth: 1,
    borderColor: palette.border,
    gap: space.xs,
  },
  backupCode: { ...type.md, color: palette.text, letterSpacing: 1.5 },
});
