import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteFunnelRecord, fetchFunnelRecords } from '../api/client';

const STATUS_COLORS = {
  'Order In': '#38bdf8',
  'Almost In': '#f59e0b',
  WIP: '#a78bfa',
  Drop: '#ef4444',
};

export default function FunnelScreen() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    const items = await fetchFunnelRecords();
    setRecords(items);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((row) =>
      [row?.customer, row?.type, row?.network, row?.vertical, row?.status, row?.id].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [records, query]);

  const summary = useMemo(() => {
    const active = filtered.filter((row) => row.status !== 'Drop');
    return {
      count: active.length,
      bandwidth: active.reduce((sum, row) => sum + Number(row.bandwidth || 0), 0),
      cores: active.reduce((sum, row) => sum + Number(row.cores || 0), 0),
      tcv: active.reduce((sum, row) => sum + Number(row.tcv || 0), 0),
    };
  }, [filtered]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unknown error');
    } finally {
      setRefreshing(false);
    }
  };

  const onDelete = (id) => {
    Alert.alert('Delete record', 'This will remove the funnel record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFunnelRecord(id);
            await load();
          } catch (err) {
            Alert.alert('Delete failed', err?.response?.data?.detail || err?.message || 'Unknown error');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#38bdf8" /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={{ color: '#fff', textAlign: 'center' }}>Funnel load failed:\n{error}</Text></View>;
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>Funnel</Text>
      <Text style={styles.sub}>Pipeline view, metrics, and record cleanup</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Search</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Customer, type, network, or status" placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Active Count</Text>
        <Text style={styles.value}>{summary.count}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Total Bandwidth</Text>
        <Text style={styles.value}>{summary.bandwidth.toFixed(0)} Gbps</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Total Cores</Text>
        <Text style={styles.value}>{summary.cores.toFixed(0)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Total Revenue</Text>
        <Text style={styles.value}>RM {summary.tcv.toFixed(0)}</Text>
      </View>

      {filtered.slice(0, 20).map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.valueSmall}>{row.customer || 'Unknown'}</Text>
          <Text style={styles.meta}>{row.vertical || '-'} · {row.type || '-'} · {row.network || '-'}</Text>
          <Text style={styles.meta}>BW {Number(row.bandwidth || 0).toFixed(0)} | Cores {Number(row.cores || 0).toFixed(0)} | TCV RM {Number(row.tcv || 0).toFixed(0)}</Text>
          <Text style={[styles.status, { color: STATUS_COLORS[row.status] || '#cbd5e1' }]}>{row.status || 'Unknown'}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Pressable style={styles.deleteButton} onPress={() => onDelete(row.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
  h1: { color: '#fff', fontSize: 28, fontWeight: '800' },
  sub: { color: '#94a3b8', marginBottom: 16 },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  label: { color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
  value: { color: '#fff', fontSize: 22, fontWeight: '800' },
  valueSmall: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#94a3b8', marginTop: 4 },
  status: { marginTop: 8, fontWeight: '800' },
  deleteButton: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  deleteText: { color: '#fff', fontWeight: '800' },
});
