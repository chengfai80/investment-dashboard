import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchAccounts } from '../api/client';

export default function AccountsScreen() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');

  const load = async () => {
    const data = await fetchAccounts();
    setItems(data);
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

  const addFake = () => {
    Alert.alert('API ready', 'Accounts create/edit can be added next; this tab already reads from Cloud Run.');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#f59e0b" /></View>;
  if (error) return <View style={styles.center}><Text style={{ color: '#fff', textAlign: 'center' }}>Accounts load failed:\n{error}</Text></View>;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>Accounts</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Quick add fields</Text>
        <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Bank" placeholderTextColor="#64748b" value={bank} onChangeText={setBank} />
        <Pressable style={styles.button} onPress={addFake}><Text style={styles.buttonText}>Coming next</Text></Pressable>
      </View>
      {items.map((item, idx) => (
        <View key={item.id || idx} style={styles.card}>
          <Text style={styles.title}>{item.Name || item.Bank || item.Account || 'Account'}</Text>
          <Text style={styles.sub}>{JSON.stringify(item, null, 2)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
  h1: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  label: { color: '#94a3b8', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#94a3b8', fontFamily: 'Courier' },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  button: { backgroundColor: '#f59e0b', borderRadius: 16, padding: 14, alignItems: 'center' },
  buttonText: { color: '#0f172a', fontWeight: '800' },
});
