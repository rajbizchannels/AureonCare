import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Building2, Check, ShieldAlert } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource } from '@/lib/useResource';
import { ApiError } from '@/lib/api';
import { Card, Chip, EmptyState, ErrorNote, Loading, SectionLabel, refreshChrome, scrollChrome } from '@/components/ui';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * The practices this account works at.
 *
 * Switching is not a filter over one session. A person can hold a different
 * role at each practice — a nurse at one, an admin at another — so the server
 * issues a new token for the membership and the app adopts the account that
 * comes with it. The tab bar can therefore look different after a switch,
 * which is correct and worth warning about rather than hiding.
 *
 * Phones are where this matters most: a locum walking between two sites in a
 * morning reaches for a phone, not a desktop.
 */
export const PracticeSwitcherScreen: React.FC<{ navigation?: { goBack: () => void } }> = ({
  navigation,
}) => {
  const { api, account, switchPractice } = useSession();
  const { gutter } = useLayout();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberships = useResource(() => api.listMemberships(), [api]);

  const choose = useCallback(
    async (practiceId: string, name: string) => {
      setWorking(practiceId);
      setError(null);
      try {
        await switchPractice(practiceId);
        // Back to the app, in the new practice. Staying here would leave the
        // person looking at a list while the shell behind them quietly became
        // a different one — the switch is finished, so show them the result.
        navigation?.goBack();
      } catch (e) {
        // A practice can require two-factor that this account has not set up;
        // the server says so plainly and the person can act on it.
        setError(
          e instanceof ApiError && e.mfaEnrolmentRequired
            ? `${e.message} (${name})`
            : e instanceof Error
              ? e.message
              : 'Could not switch practice.'
        );
      } finally {
        setWorking(null);
      }
    },
    [switchPractice, navigation]
  );

  if (memberships.loading) return <Loading />;

  const practices = memberships.data?.practices ?? [];

  return (
    <ScrollView
        {...scrollChrome}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      refreshControl={
        <RefreshControl
          refreshing={memberships.refreshing}
          onRefresh={memberships.refresh}
          {...refreshChrome}
        />
      }
    >
      {memberships.error ? <ErrorNote message={memberships.error} /> : null}
      {error ? <ErrorNote message={error} /> : null}

      {practices.length === 0 ? (
        <EmptyState
          icon={<Building2 size={34} color={palette.textFaint} />}
          title="One practice"
          hint="This account works at a single practice, so there is nothing to switch between."
        />
      ) : (
        <>
          <SectionLabel>Your practices</SectionLabel>

          {practices.map((practice) => {
            const current = practice.active || practice.practiceId === account?.practiceId;
            return (
              <Pressable
                key={practice.practiceId}
                onPress={() => (current ? undefined : choose(practice.practiceId, practice.name))}
                disabled={current || working !== null}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={`${practice.name}, as ${practice.role}${current ? ', current' : ''}`}
                style={({ pressed }) => [
                  styles.row,
                  current && styles.rowCurrent,
                  pressed && !current && styles.pressed,
                ]}
              >
                <View style={styles.body}>
                  <Text numberOfLines={1} style={styles.name}>
                    {practice.name}
                  </Text>
                  <View style={styles.chips}>
                    <Chip label={practice.role.replace(/_/g, ' ')} tone={current ? 'accent' : 'neutral'} />
                    {practice.isDefault ? <Chip label="Default" tone="neutral" /> : null}
                  </View>
                </View>

                {current ? (
                  <Check size={18} color={palette.accent} />
                ) : working === practice.practiceId ? (
                  <Text style={styles.working}>Switching…</Text>
                ) : null}
              </Pressable>
            );
          })}

          <Card style={styles.note}>
            <ShieldAlert size={15} color={palette.textMuted} />
            <Text style={styles.noteText}>
              Your role can differ between practices, so the tabs may change when you
              switch. A practice that requires two-factor will ask for it before letting
              you in.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingVertical: space.lg, gap: space.sm, paddingBottom: space.xl * 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  rowCurrent: { borderColor: palette.accentFrom },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  name: { ...type.md, color: palette.text, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  working: { ...type.xs, color: palette.textMuted },
  note: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  noteText: { ...type.xs, color: palette.textMuted, flex: 1 },
});
