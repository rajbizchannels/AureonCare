import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Building2, CircleAlert, CircleCheck, MapPin } from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { useResource } from '@/lib/useResource';
import { rolePermissions, type Module } from '@/lib/permissions';
import { Card, Chip, EmptyState, ErrorNote, Loading, SectionLabel } from '@/components/ui';
import { palette, radius, space, tint, type } from '@/theme/tokens';

/**
 * The practice, seen from an admin's phone.
 *
 * Read-only on purpose. Everything an admin *changes* — inviting staff,
 * editing a role, moving a plan, restoring a backup — is either destructive or
 * needs more context than a phone shows, and all of it exists in the web app.
 * What a phone is genuinely good for is the question an admin asks away from
 * their desk: is the practice set up correctly, and where are we operating
 * from.
 *
 * The tenant check is the reason this screen earns a place. Since the SEC-05
 * cutover a staff account that does not resolve to a provisioned schema fails
 * on every clinical read with an identical 500, and the app looks broken
 * rather than misconfigured. `/auth/tenant-status` says which it is.
 */
export const AdminScreen: React.FC = () => {
  const { api, role, account } = useSession();
  const { gutter } = useLayout();

  const tenant = useResource(() => api.tenantStatus(), [api]);
  const sites = useResource(() => api.listLocations(), [api]);

  if (tenant.loading && sites.loading) return <Loading />;

  const status = tenant.data;
  const grants = role ? rolePermissions[role] : undefined;
  const allowed = grants
    ? (Object.keys(grants.modules) as Module[]).filter((m) => grants.modules[m].view)
    : [];

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      refreshControl={
        <RefreshControl
          refreshing={tenant.refreshing || sites.refreshing}
          onRefresh={() => {
            tenant.refresh();
            sites.refresh();
          }}
          tintColor={palette.accent}
        />
      }
    >
      <SectionLabel>Practice</SectionLabel>

      {tenant.error ? <ErrorNote message={tenant.error} /> : null}

      {status ? (
        <Card style={styles.statusCard}>
          {status.healthy ? (
            <CircleCheck size={22} color={palette.success} />
          ) : (
            <CircleAlert size={22} color={palette.danger} />
          )}
          <View style={styles.statusBody}>
            <Text style={styles.statusTitle}>{status.practiceName ?? 'This practice'}</Text>
            <Text style={styles.statusHint}>
              {status.healthy
                ? `Data is resolving to ${status.resolvedSchema}. ${status.tableCount} tables present.`
                : (status.problem ?? 'Something about this account’s tenant is not right.')}
            </Text>
          </View>
          {status.tenantStatus ? (
            <Chip
              label={status.tenantStatus}
              tone={status.tenantStatus === 'active' ? 'success' : 'warning'}
            />
          ) : null}
        </Card>
      ) : null}

      <SectionLabel>Sites</SectionLabel>

      {sites.error ? <ErrorNote message={sites.error} /> : null}

      {(sites.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} color={palette.textFaint} />}
          title="No sites"
          hint="Add the places this practice operates from in the web app, under Admin → Locations."
        />
      ) : (
        <View style={styles.siteList}>
          {(sites.data ?? []).map((site) => (
            <View key={site.id} style={styles.site}>
              <MapPin size={15} color={site.isPrimary ? palette.accent : palette.textMuted} />
              <View style={styles.siteBody}>
                <Text numberOfLines={1} style={styles.siteName}>
                  {site.name}
                </Text>
                <Text numberOfLines={1} style={styles.siteMeta}>
                  {[site.locationType?.replace(/_/g, ' '), site.city, site.phone]
                    .filter(Boolean)
                    .join(' · ') || 'No address on file'}
                </Text>
              </View>
              {site.isPrimary ? <Chip label="Primary" tone="accent" /> : null}
            </View>
          ))}
        </View>
      )}

      <SectionLabel>Your access</SectionLabel>

      {/* Not decoration: when someone asks "why can't I see billing", this is
          the answer, and it is the same matrix the navigation is built from. */}
      <Card style={styles.accessCard}>
        <Text style={styles.accessRole}>
          Signed in as {role?.replace(/_/g, ' ')}
          {account?.email ? ` · ${account.email}` : ''}
        </Text>
        <View style={styles.modules}>
          {allowed.map((module) => (
            <View key={module} style={styles.module}>
              <Text style={styles.moduleLabel}>{module.replace(/([A-Z])/g, ' $1').toLowerCase()}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.accessHint}>
          The server checks this again on every request, so what you see here is what it
          will allow.
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingVertical: space.lg, gap: space.md, paddingBottom: space.xl * 3 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusBody: { flex: 1, gap: 2 },
  statusTitle: { ...type.md, color: palette.text, fontWeight: '600' },
  statusHint: { ...type.xs, color: palette.textSecondary },
  siteList: { gap: space.sm },
  site: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  siteBody: { flex: 1, gap: 2 },
  siteName: { ...type.md, color: palette.text, fontWeight: '600' },
  siteMeta: { ...type.xs, color: palette.textSecondary },
  accessCard: { gap: space.sm },
  accessRole: { ...type.sm, color: palette.textStrong, fontWeight: '600' },
  modules: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  module: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: tint.accentSoft,
  },
  moduleLabel: { ...type.xs, color: palette.textStrong },
  accessHint: { ...type.xs, color: palette.textMuted },
});
