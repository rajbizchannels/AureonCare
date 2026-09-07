import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Download, FileText } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { Card, Chip, EmptyState, ErrorNote, Loading } from '@/components/ui';
import { formatDate, fullName, useResource } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, space, type } from '@/theme/tokens';
import type { MedicalRecord } from '@/lib/api';

/**
 * The patient's documents, carrying their provenance.
 *
 * A record the patient sent themselves reads "Awaiting review" until a
 * clinician accepts it — the same rule the web chart follows, so nothing
 * unverified is ever presented as though the clinic authored it.
 */
export const PatientRecordsScreen: React.FC = () => {
  const { api, account } = useSession();
  const { gutter } = useLayout();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const records = useResource<MedicalRecord[]>(
    () => (account ? (api.listRecords(account.id) as Promise<MedicalRecord[]>) : Promise.resolve([])),
    [api, account?.id]
  );

  const open = useCallback(
    async (record: MedicalRecord) => {
      const attachment = (record.attachments ?? []).find((a) => a?.messageAttachmentId);
      if (!attachment?.messageAttachmentId || !account) return;

      setBusyId(record.id);
      setDownloadError(null);
      try {
        // Fetching proves the document is reachable and authorised. Handing the
        // bytes to a viewer needs expo-file-system + Sharing, which is the next
        // step rather than something to fake here.
        await api.downloadRecordAttachment(record.id, attachment.messageAttachmentId, account.id);
      } catch (e) {
        setDownloadError(e instanceof Error ? e.message : 'Could not open that document.');
      } finally {
        setBusyId(null);
      }
    },
    [api, account]
  );

  if (records.loading) return <Loading />;

  return (
    <View style={styles.fill}>
      {(records.error || downloadError) && (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
          <ErrorNote message={records.error ?? downloadError ?? ''} />
        </View>
      )}

      <FlatList
        data={records.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        refreshControl={
          <RefreshControl refreshing={records.refreshing} onRefresh={records.refresh} tintColor={palette.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<FileText size={34} color={palette.textFaint} />}
            title="No records yet"
            hint="Documents your care team shares will appear here."
          />
        }
        renderItem={({ item }) => {
          const attachment = (item.attachments ?? []).find((a) => a?.messageAttachmentId);
          const fromMessage = item.source === 'secure_message';
          return (
            <Card style={styles.row}>
              <View style={styles.grow}>
                <Text style={styles.title}>{item.title ?? item.record_type}</Text>
                <Text style={styles.meta}>
                  {formatDate(item.record_date)}
                  {item.provider
                    ? ` · ${fullName(item.provider.first_name, item.provider.last_name, 'Care team')}`
                    : ''}
                </Text>

                <View style={styles.chips}>
                  {fromMessage && <Chip label="From a secure message" tone="neutral" />}
                  {item.review_status === 'pending_review' && <Chip label="Awaiting review" tone="warning" />}
                  {item.review_status === 'accepted' && <Chip label="Reviewed" tone="success" />}
                  {item.review_status === 'rejected' && <Chip label="Rejected" tone="danger" />}
                </View>

                {attachment ? (
                  <Pressable
                    onPress={() => void open(item)}
                    disabled={busyId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${attachment.originalName ?? 'document'}`}
                    style={styles.attachment}
                  >
                    <Download size={15} color={palette.accent} />
                    <Text numberOfLines={1} style={styles.attachmentName}>
                      {busyId === item.id ? 'Opening…' : attachment.originalName ?? 'Document'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  list: { paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  row: { flexDirection: 'row', gap: space.md },
  grow: { flex: 1, minWidth: 0 },
  title: { ...type.md, color: palette.text, fontWeight: '600' },
  meta: { ...type.sm, color: palette.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: space.sm },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: space.md, minHeight: 32 },
  attachmentName: { ...type.sm, color: palette.accent, flex: 1 },
});
