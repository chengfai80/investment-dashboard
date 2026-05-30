import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchSettings } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    const data = await fetchSettings();
    setSettings(data);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); setError(null); } catch (err) { setError(err?.response?.data?.detail || err?.message || 'Unknown error'); } finally { setRefreshing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#f59e0b" /></View>;
  if (error) return <View style={styles.center}><Text style={{ color: '#fff', textAlign: 'center' }}>Settings load failed:\n{error}</Text></View>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.display_name || user?.email}</Text>
        <Text style={styles.sub}>{user?.email}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Backend</Text>
        <Text style={styles.value}>{settings?.app_env || 'unknown'}</Text>
        <Text style={styles.sub}>{settings?.default_tz || 'n/a'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>API URL</Text>
        <Text style={styles.sub}>https://financial-tracker-backend-1034658393263.asia-southeast1.run.app</Text>
      </View>
      <Pressable style={styles.button} onPress={logout}><Text style={styles.buttonText}>Logout</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
  h1: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 16, padding: 16, paddingBottom: 0 },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12, marginHorizontal: 16 },
  label: { color: '#94a3b8', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  value: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 6 },
  sub: { color: '#94a3b8', marginTop: 4 },
  button: { backgroundColor: '#ef4444', borderRadius: 16, padding: 14, alignItems: 'center', marginHorizontal: 16 },
  buttonText: { color: '#fff', fontWeight: '800' },
});
