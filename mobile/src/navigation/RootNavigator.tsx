import React from 'react';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  CalendarDays, ClipboardList, FileText, Home, MessageSquare, MoreHorizontal,
  Stethoscope, Users, FlaskConical, Receipt,
} from 'lucide-react-native';
import { useSession } from '@/context/SessionContext';
import { useLayout } from '@/lib/device';
import { SignInScreen } from '@/screens/SignInScreen';
import { ServerScreen } from '@/screens/ServerScreen';
import { MessagesScreen } from '@/screens/messaging/MessagesScreen';
import { StaffTodayScreen } from '@/screens/staff/TodayScreen';
import { Placeholder } from '@/screens/Placeholder';
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

/** Patient shell — Home · Visits · Records · Messages · More. */
const PatientTabs: React.FC = () => (
  <Tabs.Navigator screenOptions={tabScreenOptions}>
    <Tabs.Screen
      name="Home"
      options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
    >
      {() => (
        <Placeholder
          title="Home"
          summary="Next appointment with a join button, outstanding forms and balance due."
          endpoints={['GET /api/patient-portal/:id/appointments']}
        />
      )}
    </Tabs.Screen>

    <Tabs.Screen
      name="Visits"
      options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
    >
      {() => (
        <Placeholder
          title="Visits"
          summary="Upcoming and past appointments, with reschedule, cancel and add-to-calendar."
          endpoints={[
            'GET /api/patient-portal/:id/appointments',
            'PUT /api/patient-portal/:id/appointments/:apptId',
          ]}
        />
      )}
    </Tabs.Screen>

    <Tabs.Screen
      name="Records"
      options={{ tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }}
    >
      {() => (
        <Placeholder
          title="Records"
          summary="Documents with provenance — a patient upload reads Awaiting review until a clinician accepts it."
          endpoints={['GET /api/patient-portal/:id/medical-records']}
        />
      )}
    </Tabs.Screen>

    <Tabs.Screen
      name="Messages"
      component={MessagesScreen}
      options={{ tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} /> }}
    />

    <Tabs.Screen
      name="More"
      options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
    >
      {() => (
        <Placeholder
          title="More"
          summary="Prescriptions, diagnoses, forms requested, invoices, notifications, server and sign out."
        />
      )}
    </Tabs.Screen>
  </Tabs.Navigator>
);

/**
 * Clinician shell — Today · Schedule · Messages · Patients · More, plus the
 * tablet-only surfaces. The scope doc's split is the rule: a phone is for the
 * ward round, a tablet is where data entry with code pickers becomes usable,
 * so those tabs appear only when there is width for them.
 */
const StaffTabs: React.FC = () => {
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
        options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
      >
        {() => (
          <Placeholder
            title="Schedule"
            summary="Day agenda on a phone; the tablet gains the week grid the web app uses."
            endpoints={['GET /api/appointments']}
          />
        )}
      </Tabs.Screen>

      <Tabs.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} /> }}
      />

      <Tabs.Screen
        name="Patients"
        options={{ tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      >
        {() => (
          <Placeholder
            title="Patients"
            summary="Search, then a summary card: allergies, active medications, recent visits."
            endpoints={['GET /api/patients', 'GET /api/medical-records?patientId=']}
          />
        )}
      </Tabs.Screen>

      {/* ── Tablet-only, per the scope doc's tablet-first list ─────────────
          These need multi-select pickers and side-by-side context, which is
          exactly what does not fit on a phone. */}
      {isTablet && (
        <Tabs.Screen
          name="Chart"
          options={{ tabBarIcon: ({ color, size }) => <Stethoscope color={color} size={size} /> }}
        >
          {() => (
            <Placeholder
              title="Encounter"
              summary="Tablet only. Diagnosis capture with ICD and CPT pickers, and the full chart beside it."
              endpoints={['POST /api/diagnosis', 'GET /api/medical-codes']}
            />
          )}
        </Tabs.Screen>
      )}

      {isTablet && (
        <Tabs.Screen
          name="Orders"
          options={{ tabBarIcon: ({ color, size }) => <FlaskConical color={color} size={size} /> }}
        >
          {() => (
            <Placeholder
              title="Orders"
              summary="Tablet only. e-Prescribing and lab orders — both need multi-select and a result-recipient picker."
              endpoints={['POST /api/prescriptions', 'POST /api/lab-orders']}
            />
          )}
        </Tabs.Screen>
      )}

      {isTablet && (
        <Tabs.Screen
          name="Billing"
          options={{ tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
        >
          {() => (
            <Placeholder
              title="Revenue cycle"
              summary="Tablet only. Claims, pre-authorisations and denials — table work that a phone cannot hold."
              endpoints={['GET /api/claims', 'GET /api/denials', 'GET /api/preapprovals']}
            />
          )}
        </Tabs.Screen>
      )}

      <Tabs.Screen
        name="More"
        options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      >
        {() => (
          <Placeholder
            title="More"
            summary="Tasks, waitlist, notifications, server and sign out. Admin, reports and form authoring stay on the web app."
          />
        )}
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
            {({ navigation }) => (
              <SignInScreen onOpenServer={() => navigation.navigate('Server' as never)} />
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
          <Stack.Screen name="App" component={isPatient ? PatientTabs : StaffTabs} />
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
