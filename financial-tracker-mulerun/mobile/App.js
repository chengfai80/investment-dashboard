import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, TouchableOpacity, ScrollView } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MonthlyExpenseScreen from './src/screens/MonthlyExpenseScreen';
import TransactionScreen from './src/screens/TransactionScreen';
import CommitmentScreen from './src/screens/CommitmentScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import TemplatesScreen from './src/screens/TemplatesScreen';
import AIChatScreen from './src/screens/AIChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#16213e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' },
};

function MoreHomeScreen({ navigation }) {
  const items = [
    { name: 'Commitment', icon: 'calendar', screen: 'Commitment' },
    { name: 'Accounts', icon: 'key', screen: 'Accounts' },
    { name: 'Templates', icon: 'copy', screen: 'Templates' },
    { name: 'Financial Mate', icon: 'chatbubble-ellipses', screen: 'AIChat' },
    { name: 'Settings', icon: 'settings', screen: 'Settings' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a2e' }} contentContainerStyle={{ padding: 16 }}>
      {items.map((item) => (
        <TouchableOpacity key={item.name} style={{
          backgroundColor: '#16213e', borderRadius: 12, marginBottom: 10,
          flexDirection: 'row', alignItems: 'center', padding: 16, elevation: 3,
        }} onPress={() => navigation.navigate(item.screen)}>
          <Ionicons name={item.icon} size={22} color="#e94560" style={{ marginRight: 14 }} />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '500', flex: 1 }}>{item.name}</Text>
          <Ionicons name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function MoreScreens() {
  return (
    <MoreStack.Navigator screenOptions={screenOptions}>
      <MoreStack.Screen name="MoreHome" component={MoreHomeScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Commitment" component={CommitmentScreen} />
      <MoreStack.Screen name="Accounts" component={AccountsScreen} />
      <MoreStack.Screen name="Templates" component={TemplatesScreen} />
      <MoreStack.Screen name="AIChat" component={AIChatScreen} options={{ title: 'Financial Mate' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...screenOptions,
      tabBarStyle: { backgroundColor: '#16213e', borderTopColor: '#0f3460', height: 60, paddingBottom: 8 },
      tabBarActiveTintColor: '#e94560',
      tabBarInactiveTintColor: '#666',
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: 'stats-chart',
          Expenses: 'wallet',
          Transactions: 'swap-horizontal',
          More: 'ellipsis-horizontal',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Expenses" component={MonthlyExpenseScreen} options={{ title: 'Monthly' }} />
      <Tab.Screen name="Transactions" component={TransactionScreen} />
      <Tab.Screen name="More" component={MoreScreens} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

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
        <Stack.Screen name="Login" component={LoginScreen} />
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
