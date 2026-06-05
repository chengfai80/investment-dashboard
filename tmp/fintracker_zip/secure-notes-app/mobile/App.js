import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Alert, Platform } from 'react-native';
import * as Updates from 'expo-updates';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import NotesScreen from './src/screens/NotesScreen';
import TasksScreen from './src/screens/TasksScreen';
import CredentialsScreen from './src/screens/CredentialsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#16213e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' },
};

// Check for OTA updates on app launch
async function checkForUpdates() {
  try {
    if (!Updates.isEnabled || Platform.OS === 'web') return;
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart to apply?',
        [
          { text: 'Later' },
          { text: 'Restart', onPress: () => Updates.reloadAsync() },
        ]
      );
    }
  } catch (e) {
    // Silently fail — don't block the app
    console.log('Update check failed:', e.message);
  }
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...screenOptions,
      tabBarStyle: { backgroundColor: '#16213e', borderTopColor: '#0f3460', height: 60, paddingBottom: 8 },
      tabBarActiveTintColor: '#e94560',
      tabBarInactiveTintColor: '#666',
      tabBarIcon: ({ color, size }) => {
        const icons = { Notes: 'document-text', Tasks: 'checkbox', Vault: 'key', Settings: 'settings' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Notes" component={NotesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Vault" component={CredentialsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    checkForUpdates();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
