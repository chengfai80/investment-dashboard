import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  const onLogout = async () => {
    Alert.alert('Logout', 'Sign out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.username || user?.email || 'Unknown'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.valueSmall}>{process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000'}</Text>
      </View>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617' },
  h1: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 16 },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  label: { color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  value: { color: '#fff', fontSize: 18, fontWeight: '700' },
  valueSmall: { color: '#cbd5e1', fontSize: 14 },
  logoutButton: { backgroundColor: '#ef4444', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#fff', fontWeight: '800' },
});
