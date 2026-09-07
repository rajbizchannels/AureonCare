import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, ErrorNote, PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { checkServer, isServerUrlAllowed, normaliseServerUrl } from '@/lib/server';
import { useLayout } from '@/lib/device';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * Which deployment this device talks to. Practices run their own instances, so
 * the host is configuration — but a bad one is only discovered at login, which
 * is why this probes before saving.
 */
export const ServerScreen: React.FC<{ navigation?: { goBack: () => void } }> = ({ navigation }) => {
  const { serverUrl, changeServer } = useSession();
  const { maxContentWidth } = useLayout();
  const [value, setValue] = useState(serverUrl.replace(/^https?:\/\//, ''));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    setError(null);
    setStatus(null);

    const origin = normaliseServerUrl(value);
    if (!origin) {
      setError('That does not look like a server address.');
      return;
    }
    if (!isServerUrlAllowed(origin)) {
      setError('Only https addresses are allowed, except on a local network.');
      return;
    }

    setBusy(true);
    const result = await checkServer(origin);
    setBusy(false);

    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setStatus(result.version ? `Reachable · AureonCare ${result.version}` : 'Reachable');
    await changeServer(origin);
    navigation?.goBack();
  }, [value, changeServer, navigation]);

  return (
    <Screen scroll>
      <View style={[styles.body, { maxWidth: maxContentWidth }]}>
        <Text style={styles.intro}>
          The app talks to your practice&apos;s AureonCare deployment. Most practices leave this
          as it is.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Server URL</Text>
          <View style={[styles.inputRow, error ? styles.inputError : null]}>
            <Text style={styles.scheme}>https://</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="app.aureoncare.tech"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
            />
          </View>
          {status ? (
            <View style={styles.statusRow}>
              <CheckCircle2 size={16} color={palette.successText} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}
        </View>

        {error ? <ErrorNote message={error} /> : null}

        <Card style={styles.warning}>
          <View style={styles.warningRow}>
            <AlertTriangle size={18} color={palette.warning} />
            <Text style={styles.warningText}>
              Changing the server signs you out and clears cached data on this device.
            </Text>
          </View>
        </Card>

        <PrimaryButton label="Save and sign out" onPress={save} busy={busy} />
        <SecondaryButton label="Cancel" onPress={() => navigation?.goBack()} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { gap: space.lg, width: '100%', alignSelf: 'center' },
  intro: { ...type.base, color: palette.textSecondary },
  field: { gap: space.sm },
  label: { ...type.sm, color: palette.textStrong },
  inputRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
    paddingHorizontal: space.md,
  },
  inputError: { borderColor: palette.danger },
  scheme: { ...type.md, color: palette.textMuted },
  input: { flex: 1, color: palette.text, ...type.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusText: { ...type.sm, color: palette.successText },
  warning: { backgroundColor: tint.warningSoft, borderColor: tint.warningBorder },
  warningRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  warningText: { ...type.sm, color: palette.warningText, flex: 1 },
});
