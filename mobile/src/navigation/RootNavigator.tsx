import React from 'react';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  CalendarDays, FileText, FlaskConical, Home, MessageSquare,
  MoreHorizontal, Receipt, Settings, Stethoscope, Tent, Users,
} from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { canUseCamps, type Action, type Module, type Role, type Shell } from '@/lib/permissions';
import { SignInScreen } from '@/screens/SignInScreen';
import { ServerScreen } from '@/screens/ServerScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { SecurityScreen } from '@/screens/SecurityScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { MessagesScreen } from '@/screens/messaging/MessagesScreen';
import { FormsScreen } from '@/screens/forms/FormsScreen';
import { CampsScreen } from '@/screens/camps/CampsScreen';
import { AdminScreen } from '@/screens/admin/AdminScreen';
import { PatientHomeScreen } from '@/screens/patient/HomeScreen';
import { PatientVisitsScreen } from '@/screens/patient/VisitsScreen';
import { PatientPaperworkScreen } from '@/screens/patient/PaperworkScreen';
import { StaffTodayScreen } from '@/screens/staff/TodayScreen';
import { StaffScheduleScreen } from '@/screens/staff/ScheduleScreen';
import { StaffPatientsScreen } from '@/screens/staff/PatientsScreen';
import { StaffOrdersScreen } from '@/screens/staff/OrdersScreen';
import { StaffBillingScreen } from '@/screens/staff/BillingScreen';
import { StaffChartScreen } from '@/screens/staff/ChartScreen';
import { TasksScreen } from '@/screens/staff/TasksScreen';
import { ActivePatientProvider } from '@/context/ActivePatientContext';
import { Loading } from '@/components/ui';
import { palette } from '@/theme/tokens';

/**
 * One app, four shells, derived from the account.
 *
 * The role is never asked for. `POST /api/auth/login` answers with the
 * account, `shellFor(role)` picks the arrangement, and every tab inside that
 * arrangement is then filtered against the same permission matrix the web app
 * uses (`src/lib/permissions.ts`). A receptionist and a doctor run the same
 * binary and see different apps because their accounts differ, not because
 * they installed different things.
 *
 * Two rules keep the tab bar honest:
 *
 *   1. A tab appears only if its module is viewable. A receptionist has no
 *      `ehr.view`, so Chart and Orders are not merely disabled for them —
 *      they do not exist, because a tab that 403s on arrival is worse than
 *      no tab.
 *   2. A phone never shows more than five. Everything else lives in More,
 *      which is a real destination rather than an overflow bin. Tablets
 *      promote a declared handful back up; the scope doc's line holds —
 *      "phone is for doing, tablet is for working".
 */

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.bg,
    card: palette.surface,
    border: palette.hairline,
    primary: palette.accent,
    text: palette.text,
  },
};

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabScreenOptions = {
  headerStyle: { backgroundColor: palette.surface },
  headerTitleStyle: { color: palette.text },
  headerShadowVisible: false,
  tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.hairline },
  tabBarActiveTintColor: palette.accent,
  tabBarInactiveTintColor: palette.textMuted,
} as const;

type Nav = { navigate: (screen: string) => void };
type IconProps = { color: string; size: number };

/** Everything a tab's visibility rule is allowed to look at. */
interface Ctx {
  role: Role | undefined;
  can: (module: Module, action?: Action) => boolean;
  canAdmin: (key: 'users' | 'roles' | 'plans' | 'settings') => boolean;
}

interface TabSpec {
  key: string;
  name: string;
  /** Header title, when it should differ from the tab label. */
  title?: string;
  Icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  /** Omitted means "always, for the shells that list it". */
  requires?: (ctx: Ctx) => boolean;
  /** Draws the unread count on the tab, the way the web header's bell does. */
  badge?: 'unread';
}

/**
 * Unread messages, for the tab badge.
 *
 * Polled rather than pushed because push notifications are not registered
 * yet. A minute is frequent enough for a badge and cheap enough to leave
 * running; a failure is swallowed, since a missing badge is a smaller problem
 * than an error banner over a working app.
 */
const useUnreadCount = (enabled: boolean): number => {
  const { api } = useSession();
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let alive = true;
    const tick = () => {
      api
        .unreadCount()
        .then((n) => {
          if (alive) setCount(n);
        })
        .catch(() => {});
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api, enabled]);

  return count;
};

// ── the catalogue ───────────────────────────────────────────────────────────
//
// Declared once and referenced by key, so a screen cannot be wired into one
// shell with a capability check and into another without.

const TAB: Record<string, TabSpec> = {
  visits: { key: 'visits', name: 'Visits', Icon: CalendarDays, component: PatientVisitsScreen },
  paperwork: {
    key: 'paperwork',
    name: 'Records',
    Icon: FileText,
    component: PatientPaperworkScreen,
  },
  today: { key: 'today', name: 'Today', Icon: Home, component: StaffTodayScreen },
  schedule: {
    key: 'schedule',
    name: 'Schedule',
    Icon: CalendarDays,
    component: StaffScheduleScreen,
    requires: (c) => c.can('appointments'),
  },
  messages: {
    key: 'messages',
    name: 'Messages',
    Icon: MessageSquare,
    component: MessagesScreen,
    requires: (c) => c.can('messages'),
    badge: 'unread',
  },
  patients: {
    key: 'patients',
    name: 'Patients',
    Icon: Users,
    component: StaffPatientsScreen,
    requires: (c) => c.can('patients'),
  },
  chart: {
    key: 'chart',
    name: 'Chart',
    Icon: Stethoscope,
    component: StaffChartScreen,
    requires: (c) => c.can('ehr'),
  },
  orders: {
    key: 'orders',
    name: 'Orders',
    Icon: FlaskConical,
    component: StaffOrdersScreen,
    requires: (c) => c.can('ehr'),
  },
  billing: {
    key: 'billing',
    name: 'Billing',
    title: 'Revenue cycle',
    Icon: Receipt,
    component: StaffBillingScreen,
    requires: (c) => c.can('rcm'),
  },
  camps: {
    key: 'camps',
    name: 'Camps',
    Icon: Tent,
    component: CampsScreen,
    requires: (c) => canUseCamps(c.role),
  },
  admin: {
    key: 'admin',
    name: 'Practice',
    Icon: Settings,
    component: AdminScreen,
    requires: (c) => c.canAdmin('users'),
  },
};

/**
 * The four arrangements. Order is the tab order, and `More` is appended by the
 * builder so no shell can forget it.
 *
 * A phone shows `base`; a tablet shows `base` plus `tabletExtras`. The extras
 * are named per shell rather than computed, because "what deserves promoting
 * on a bigger screen" is a judgement about the job, not about permissions —
 * a front desk wants camps and takings, a clinician wants the chart.
 */
const SHELLS: Record<Shell, { base: string[]; tabletExtras: string[] }> = {
  patient: {
    // Home is declared directly in the navigator below — it is the only screen
    // that drives navigation, so it cannot come from the catalogue — and it
    // renders first either way.
    base: ['visits', 'paperwork', 'messages'],
    // A patient's tablet is a bigger phone, not a workstation. Nothing to add.
    tabletExtras: [],
  },
  clinician: {
    base: ['today', 'schedule', 'messages', 'patients'],
    tabletExtras: ['chart', 'orders'],
  },
  frontdesk: {
    base: ['today', 'schedule', 'messages', 'patients'],
    tabletExtras: ['camps', 'billing'],
  },
  admin: {
    base: ['today', 'schedule', 'messages', 'patients'],
    tabletExtras: ['chart', 'billing', 'admin'],
  },
};

/**
 * What More offers, beyond the rows every account gets.
 *
 * `tab` names the catalogue entry this row duplicates, when there is one. A
 * tablet that has already promoted Camps to a tab must not also list it here
 * — two doors to one room is how a "More" menu turns back into an overflow
 * bin.
 */
const MORE_ROWS: {
  key: string;
  label: string;
  screen: string;
  tab?: string;
  requires?: (ctx: Ctx) => boolean;
}[] = [
  { key: 'camps', label: 'Medical camps', screen: 'Camps', tab: 'camps', requires: (c) => canUseCamps(c.role) },
  {
    key: 'tasks',
    label: 'Tasks',
    screen: 'Tasks',
    requires: (c) => c.role !== 'patient' && c.can('practiceManagement'),
  },
  { key: 'notifications', label: 'Notifications', screen: 'Notifications' },
  {
    key: 'forms',
    label: 'Forms',
    screen: 'Forms',
    // Patients reach forms from their Records tab; staff need a way in.
    requires: (c) => c.role !== 'patient' && c.can('ehr'),
  },
  { key: 'admin', label: 'Practice', screen: 'Practice', tab: 'admin', requires: (c) => c.canAdmin('users') },
  { key: 'security', label: 'Two-factor', screen: 'Security', requires: (c) => c.role !== 'patient' },
];

const RoleTabs: React.FC<{ openServer: () => void; navigate: (screen: string) => void }> = ({
  openServer,
  navigate,
}) => {
  const { role, shell, can, canAdmin } = useSession();
  const { isTablet } = useLayout();

  const ctx: Ctx = { role, can, canAdmin };
  const plan = SHELLS[shell];

  const keys = [...plan.base, ...(isTablet ? plan.tabletExtras : [])];
  const visible = keys.reduce<TabSpec[]>((acc, key) => {
    const tab = TAB[key];
    if (tab && (!tab.requires || tab.requires(ctx))) acc.push(tab);
    return acc;
  }, []);

  const promoted = new Set(visible.map((tab) => tab.key));
  const moreRows = MORE_ROWS.filter(
    (row) => (!row.requires || row.requires(ctx)) && !(row.tab && promoted.has(row.tab))
  ).map((row) => ({
    label: row.label,
    onPress: () => navigate(row.screen),
  }));

  const unread = useUnreadCount(can('messages'));

  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      {/* The patient home is the one screen that needs to drive navigation, so
          it is declared here rather than in the catalogue. */}
      {shell === 'patient' ? (
        <Tabs.Screen
          name="Home"
          options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
        >
          {({ navigation }: { navigation: Nav }) => (
            <PatientHomeScreen
              onOpenMessages={() => navigation.navigate('Messages')}
              onOpenVisits={() => navigation.navigate('Visits')}
            />
          )}
        </Tabs.Screen>
      ) : null}

      {visible.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.name}
          component={tab.component}
          options={{
            ...(tab.title ? { title: tab.title, tabBarLabel: tab.name } : {}),
            ...(tab.badge === 'unread' && unread > 0 ? { tabBarBadge: unread } : {}),
            tabBarIcon: ({ color, size }: IconProps) => <tab.Icon color={color} size={size} />,
          }}
        />
      ))}

      <Tabs.Screen
        name="More"
        options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      >
        {() => <MoreScreen rows={moreRows} onOpenServer={openServer} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
};

/**
 * Screens reachable from More rather than from a tab. Pushed onto the root
 * stack so they get a back button and a title for free, and so a tablet
 * promoting one to a tab does not end up with two copies of it mounted.
 */
const DETAIL_SCREENS: { name: string; title: string; component: React.ComponentType }[] = [
  { name: 'Camps', title: 'Medical camps', component: CampsScreen },
  { name: 'Tasks', title: 'Tasks', component: TasksScreen },
  { name: 'Notifications', title: 'Notifications', component: NotificationsScreen },
  { name: 'Forms', title: 'Forms', component: FormsScreen },
  { name: 'Practice', title: 'Practice', component: AdminScreen },
  { name: 'Security', title: 'Two-factor', component: SecurityScreen },
];

export const RootNavigator: React.FC = () => {
  const { status } = useSession();

  return (
    <NavigationContainer theme={navTheme}>
      {status === 'loading' ? (
        <Loading />
      ) : status === 'signed-out' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignIn">
            {({ navigation }: { navigation: Nav }) => (
              <SignInScreen onOpenServer={() => navigation.navigate('Server')} />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Server"
            component={ServerScreen}
            options={{ headerShown: true, title: 'Server', presentation: 'modal' }}
          />
        </Stack.Navigator>
      ) : (
        // ActivePatientProvider wraps the whole signed-in stack, not just the
        // tabs, so a patient chosen in Patients is still selected when Chart
        // is opened from a pushed screen.
        <ActivePatientProvider>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              headerStyle: { backgroundColor: palette.surface },
              headerTitleStyle: { color: palette.text },
              headerTintColor: palette.accent,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: palette.bg },
            }}
          >
            <Stack.Screen name="App">
              {({ navigation }: { navigation: Nav }) => (
                <RoleTabs
                  openServer={() => navigation.navigate('Server')}
                  navigate={(screen) => navigation.navigate(screen)}
                />
              )}
            </Stack.Screen>

            {DETAIL_SCREENS.map((screen) => (
              <Stack.Screen
                key={screen.name}
                name={screen.name}
                component={screen.component}
                options={{ headerShown: true, title: screen.title }}
              />
            ))}

            <Stack.Screen
              name="Server"
              component={ServerScreen}
              options={{ headerShown: true, title: 'Server', presentation: 'modal' }}
            />
          </Stack.Navigator>
        </ActivePatientProvider>
      )}
    </NavigationContainer>
  );
};
