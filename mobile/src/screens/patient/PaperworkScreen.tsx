import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLayout } from '@/lib/device';
import { Segmented } from '@/components/ui';
import { palette, space } from '@/theme/tokens';
import { PatientRecordsScreen } from './RecordsScreen';
import { FormsScreen } from '@/screens/forms/FormsScreen';

/**
 * A patient's paperwork, both directions.
 *
 * Documents the practice has shared, and forms it is waiting on. These are one
 * concern from the patient's side — "what do I have, what do I owe" — and the
 * forms half is time-sensitive in a way that would get lost behind a More
 * menu, so they share a tab rather than competing for one.
 */

type Pane = 'records' | 'forms';

export const PatientPaperworkScreen: React.FC = () => {
  const { gutter } = useLayout();
  const [pane, setPane] = useState<Pane>('records');

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Segmented
          value={pane}
          onChange={setPane}
          options={[
            { value: 'records', label: 'Documents' },
            { value: 'forms', label: 'Forms' },
          ]}
        />
      </View>

      {pane === 'records' ? <PatientRecordsScreen /> : <FormsScreen />}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
    backgroundColor: palette.surface,
  },
});
