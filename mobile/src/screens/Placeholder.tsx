import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card, SectionLabel } from '@/components/ui';
import { useLayout } from '@/lib/device';
import { palette, space, type } from '@/theme/tokens';

/**
 * A screen that is routed and reachable but not yet built.
 *
 * It says so plainly rather than showing invented data: a placeholder that
 * looks finished is how a demo ends up mistaken for a working feature.
 */
export const Placeholder: React.FC<{ title: string; summary: string; endpoints?: string[] }> = ({
  title,
  summary,
  endpoints = [],
}) => {
  const { gutter } = useLayout();
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
    >
      <Text style={styles.title}>{title}</Text>
      <Card>
        <Text style={styles.summary}>{summary}</Text>
      </Card>
      {endpoints.length > 0 && (
        <>
          <SectionLabel>Wires up to</SectionLabel>
          <Card>
            {endpoints.map((e) => (
              <Text key={e} style={styles.endpoint}>{e}</Text>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  content: { paddingVertical: space.lg, gap: space.md },
  title: { ...type.display, color: palette.text, fontWeight: '700' },
  summary: { ...type.base, color: palette.textSecondary },
  endpoint: { ...type.sm, color: palette.textMuted, fontFamily: 'monospace', paddingVertical: 2 },
});
