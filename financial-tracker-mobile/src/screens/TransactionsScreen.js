import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fetchTransactions } from '../api/client';

const DEFAULT_COLLECTION = 'expensesummary';

export default function TransactionsScreen() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await fetchTransactions(DEFAULT_COLLECTION);
    setItems(data);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        Alert.alert('Load failed', err?.response?.data?.detail || err?.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#f59e0b" /></View>;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(item.id || idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<Text style={styles.h1}>Transactions · {DEFAULT_COLLECTION}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.Category || item.Description || item.Name || 'Record'}</Text>
            <Text style={styles.sub}>{JSON.stringify(item, null, 2)}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
  h1: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#94a3b8', fontFamily: 'Courier' },
});
