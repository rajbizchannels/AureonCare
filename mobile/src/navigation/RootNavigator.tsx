import React from 'react';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  CalendarDays, FileText, FlaskConical, Home, MessageSquare, MoreHorizontal, Receipt, Users,
} from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { SignInScreen } from '@/screens/SignInScreen';
import { ServerScreen } from '@/screens/ServerScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { MessagesScreen } from '@/screens/messaging/MessagesScreen';
import { PatientHomeScreen } from '@/screens/patient/HomeScreen';
import { PatientVisitsScreen } from '@/screens/patient/VisitsScreen';
import { PatientRecordsScreen } from '@/screens/patient/RecordsScreen';
import { StaffTodayScreen } from '@/screens/staff/TodayScreen';
import { StaffScheduleScreen } from '@/screens/staff/ScheduleScreen';
import { StaffPatientsScreen } from '@/screens/staff/PatientsScreen';
import { StaffOrdersScreen } from '@/screens/staff/OrdersScreen';
import { StaffBillingScreen } from '@/screens/staff/BillingScreen';
import { Loading } from '@/components/ui';
import { palette } from '@/theme/tokens';

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

/** Patient shell — Home · Visits · Records · Messages · More. */
const PatientTabs: React.FC<{ openServer: () => void }> = ({ openServer }) => (
  <Tabs.Navigator screenOptions={tabScreenOptions}>
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

    <Tabs.Screen
      name="Visits"
      component={PatientVisitsScreen}
      options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
    />
    <Tabs.Screen
      name="Records"
      component={PatientRecordsScreen}
      options={{ tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }}
    />
    <Tabs.Screen
      name="Messages"
      component={MessagesScreen}
      options={{ tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} /> }}
    />

    <Tabs.Screen
      name="More"
      options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
    >
      {() => <MoreScreen onOpenServer={openServer} />}
    </Tabs.Screen>
  </Tabs.Navigator>
);

/**
 * Clinician shell — Today · Schedule · Messages · Patients · More, plus two
 * tablet-only tabs.
 *
 * The scope doc's split is the rule: a phone is for the ward round, a tablet
 * is where list-and-table work becomes usable. Orders and Revenue cycle appear
 * only when there is width for them. Chart review is not a separate tablet tab
 * — Patients already opens a split view with the summary beside the roster, so
 * a third route to the same data would be clutter, not capability.
 */
const StaffTabs: React.FC<{ openServer: () => void }> = ({ openServer }) => {
  const { isTablet } = useLayout();

  return (
    <Tabs.Navigator screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="Today"
        component={StaffTodayScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="Schedule"
        component={StaffScheduleScreen}
        options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="Patients"
        component={StaffPatientsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />

      {isTablet && (
        <Tabs.Screen
          name="Orders"
          component={StaffOrdersScreen}
          options={{ tabBarIcon: ({ color, size }) => <FlaskConical color={color} size={size} /> }}
        />
      )}
      {isTablet && (
        <Tabs.Screen
          name="Billing"
          component={StaffBillingScreen}
          options={{
            title: 'Revenue cycle',
            tabBarLabel: 'Billing',
            tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
          }}
        />
      )}

      <Tabs.Screen
        name="More"
        options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      >
        {() => <MoreScreen onOpenServer={openServer} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { status, isPatient } = useSession();

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
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="App">
            {({ navigation }: { navigation: Nav }) =>
              isPatient ? (
                <PatientTabs openServer={() => navigation.navigate('Server')} />
              ) : (
                <StaffTabs openServer={() => navigation.navigate('Server')} />
              )
            }
          </Stack.Screen>
          <Stack.Screen
            name="Server"
            component={ServerScreen}
            options={{ headerShown: true, title: 'Server', presentation: 'modal' }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};
