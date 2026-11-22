import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Building2, ExternalLink, Search } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSession } from '@/context/SessionContext';
import { Card, EmptyState, ErrorNote } from '@/components/ui';
import { useLayout } from '@/lib/device';
import {
  profileUrl, providerLine, resultMeta, understoodLine, type DirectoryAnswer, type DirectoryResult,
} from '@/lib/directory';
import { palette, radius, space, type } from '@/theme/tokens';

/**
 * Find a practice — the same public directory as /find on the web: one box for a practice
 * name, a specialty, a place or a doctor. Works signed out (from the sign-in screen) and
 * signed in. A result opens the practice's public page, where its booking links are.
 * Only practices that chose to be searchable appear; nothing typed here is logged.
 */
export const FindPracticeScreen: React.FC = () => {
  const { api, serverUrl } = useSession();
  const { gutter, maxContentWidth } = useLayout();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<DirectoryAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await api.searchDirectory(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }, [api, q, busy]);

  const open = useCallback(
    (r: DirectoryResult) => { void WebBrowser.openBrowserAsync(profileUrl(serverUrl, r)); },
    [serverUrl]
  );

  const understood = answer ? understoodLine(answer.understood) : null;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]}>
        <Text style={styles.lead}>Search by practice name, specialty, place or doctor.</Text>
        <View style={styles.searchRow}>
          <Search size={18} color={palette.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="e.g. Riverside Family Practice, dermatologist in Springfield"
            placeholderTextColor={palette.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => void run()}
            autoCorrect={false}
            accessibilityLabel="Search practices"
            style={styles.input}
          />
          <Pressable onPress={() => void run()} accessibilityRole="button" accessibilityLabel="Search" style={styles.go} disabled={busy}>
            {busy ? <ActivityIndicator color={palette.text} size="small" /> : <Text style={styles.goText}>Search</Text>}
          </Pressable>
        </View>
        {error ? <ErrorNote message={error} /> : null}
        {understood ? <Text style={styles.understood}>{understood}</Text> : null}
      </View>

      <FlatList
        data={answer?.results ?? []}
        keyExtractor={(r) => r.url}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          answer ? (
            <EmptyState
              icon={<Building2 size={34} color={palette.textFaint} />}
              title="No practices found"
              hint="Try the practice's name, a specialty such as “dermatologist”, or a town or postcode."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const providers = providerLine(item);
          return (
            <Pressable onPress={() => open(item)} accessibilityRole="link" accessibilityLabel={`Open ${item.name}`}>
              <Card style={styles.card}>
                <View style={styles.grow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {resultMeta(item) ? <Text style={styles.meta}>{resultMeta(item)}</Text> : null}
                  {providers ? <Text style={styles.providers}>{providers}</Text> : null}
                </View>
                <ExternalLink size={18} color={palette.textSecondary} />
              </Card>
            </Pressable>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  top: { paddingTop: space.md, gap: space.sm, width: '100%', alignSelf: 'center' },
  lead: { ...type.sm, color: palette.textSecondary },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised,
  },
  input: { flex: 1, minHeight: 48, color: palette.text, ...type.md },
  go: { minHeight: 48, paddingHorizontal: space.md, justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: palette.accentFrom },
  goText: { ...type.sm, color: palette.text, fontWeight: '600' },
  understood: { ...type.xs, color: palette.textMuted },
  list: { paddingVertical: space.md, gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: 2 },
  name: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary },
  providers: { ...type.xs, color: palette.textMuted },
});
