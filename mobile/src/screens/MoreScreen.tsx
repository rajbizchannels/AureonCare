import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, LogOut, Server } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Divider, SectionLabel } from '@/components/ui';
import { fullName } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, radius, space, type } from '@/theme/tokens';

interface Row {
  label: string;
  value?: string;
  onPress?: () => void;
}

/**
 * Identity, settings and sign-out. Structurally the same for both audiences —
 * only the rows differ — so it is one screen rather than two that drift.
 */
export const MoreScreen: React.FC<{
  rows?: Row[];
  onOpenServer: () => void;
}> = ({ rows = [], onOpenServer }) => {
  const { account, serverUrl, signOut, isPatient } = useSession();
  const { gutter, maxContentWidth } = useLayout();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need your password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void signOut();
        },
      },
    ]);
  }, [signOut]);

  const name = fullName(account?.firstName, account?.lastName, account?.email ?? 'Signed in');
  const initials =
    [account?.firstName?.[0], account?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  const settingRows: Row[] = [
    ...rows,
    { label: 'Server', value: serverUrl.replace(/^https?:\/\//, ''), onPress: onOpenServer },
  ];

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]}
    >
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.grow}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.subtitle}>
            {isPatient
              ? account?.mrn ?? account?.email ?? ''
              : [account?.specialty, account?.role].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>Settings</SectionLabel>
        <Card style={styles.listCard}>
          {settingRows.map((row, index) => (
            <React.Fragment key={row.label}>
              {index > 0 && <Divider />}
              <Pressable
                onPress={row.onPress}
                disabled={!row.onPress}
                accessibilityRole={row.onPress ? 'button' : undefined}
                style={({ pressed }) => [styles.row, pressed && row.onPress && styles.rowPressed]}
              >
                {row.label === 'Server' ? <Server size={18} color={palette.textSecondary} /> : null}
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.value ? (
                  <Text numberOfLines={1} style={styles.rowValue}>
                    {row.value}
                  </Text>
                ) : null}
                {row.onPress ? <ChevronRight size={17} color={palette.textFaint} /> : null}
              </Pressable>
            </React.Fragment>
          ))}
        </Card>
      </View>

      {!isPatient && (
        <Card style={styles.note}>
          <Text style={styles.noteText}>
            Admin, reports, billing setup and form authoring stay on the web app — this build is
            for the ward round, not the back office.
          </Text>
        </Card>
      )}

      <Pressable
        onPress={confirmSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
      >
        <LogOut size={17} color={palette.danger} />
        <Text style={styles.signOutLabel}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingVertical: space.lg,
    gap: space.lg,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: palette.bg,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accentFrom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.xl, color: palette.text, fontWeight: '700' },
  grow: { flex: 1, minWidth: 0 },
  name: { ...type.lg, color: palette.text, fontWeight: '600' },
  subtitle: { ...type.sm, color: palette.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  section: { gap: space.sm },
  listCard: { padding: 0, overflow: 'hidden' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  rowPressed: { opacity: 0.7 },
  rowLabel: { ...type.md, color: palette.text, flex: 1 },
  rowValue: { ...type.sm, color: palette.textMuted, maxWidth: '50%' },
  note: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  noteText: { ...type.sm, color: palette.textMuted },
  signOut: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  signOutLabel: { ...type.md, color: palette.danger, fontWeight: '500' },
});
