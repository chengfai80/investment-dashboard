import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccountsScreen from './src/screens/AccountsScreen';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.log('App crashed:', error?.message || error, info?.componentStack || '');
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>App failed to render</Text>
          <Text style={{ color: '#cbd5e1', textAlign: 'center' }}>{this.state.error?.message || 'Unknown error'}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const DIAGNOSTIC_MODE = false;
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#0f172a' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
  tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b', height: 60, paddingBottom: 8 },
  tabBarActiveTintColor: '#f59e0b',
  tabBarInactiveTintColor: '#94a3b8',
};

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...screenOptions,
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: 'analytics',
          Transactions: 'list',
          Add: 'add-circle',
          Accounts: 'card',
          Settings: 'settings',
        };
        return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Add" component={AddTransactionScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function BootScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 10, textAlign: 'center' }}>Financial Tracker</Text>
      <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Starting app…</Text>
      <Text style={{ color: '#cbd5e1', textAlign: 'center' }}>If you can read this, the JS bundle is loading.</Text>
    </View>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 16, fontWeight: '700' }}>Restoring your session…</Text>
        <Text style={{ color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>This should only take a moment.</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          {!booted ? (
            <BootScreen />
          ) : (
            <AuthProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </AuthProvider>
          )}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
