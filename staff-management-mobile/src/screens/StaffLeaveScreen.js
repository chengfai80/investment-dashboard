import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteLeaveRecord, fetchLeaveRecords } from '../api/client';

const LEAVE_TYPES = [
  'Annual Leave',
  'Emergency Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Compassionate Leave',
  'Medical Leave',
  'Hospitalization Leave',
];

function groupBy(records, key) {
  return records.reduce((acc, row) => {
    const k = row?.[key] || 'Unknown';
    acc[k] = acc[k] || [];
    acc[k].push(row);
    return acc;
  }, {});
}

export default function StaffLeaveScreen() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    const items = await fetchLeaveRecords();
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
      [row?.staff_name, row?.leave_type, row?.created_by, row?.id].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [records, query]);

  const summary = useMemo(() => {
    const byPerson = groupBy(filtered, 'staff_name');
    return Object.entries(byPerson)
      .map(([name, rows]) => ({ name, days: rows.reduce((sum, row) => sum + Number(row.leave_days || 1), 0), count: rows.length }))
      .sort((a, b) => b.days - a.days);
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
    Alert.alert('Delete record', 'This will remove the leave record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLeaveRecord(id);
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
    return <View style={styles.center}><Text style={{ color: '#fff', textAlign: 'center' }}>Staff leave load failed:\n{error}</Text></View>;
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>Staff Leave</Text>
      <Text style={styles.sub}>Live records, summary, and quick cleanup</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Search</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Staff, leave type, or doc id" placeholderTextColor="#64748b" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Total Records</Text>
        <Text style={styles.value}>{filtered.length}</Text>
      </View>

      {summary.slice(0, 8).map((row) => (
        <View key={row.name} style={styles.card}>
          <Text style={styles.label}>{row.name}</Text>
          <Text style={styles.valueSmall}>{row.days.toFixed(1)} days across {row.count} record(s)</Text>
        </View>
      ))}

      {filtered.slice(0, 20).map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.valueSmall}>{row.staff_name || 'Unknown'} · {row.leave_type || 'Unknown'}</Text>
          <Text style={styles.meta}>{row.date ? String(row.date).slice(0, 10) : 'No date'} · {Number(row.leave_days || 1)} day(s)</Text>
          <Text style={styles.meta}>Created by: {row.created_by || '-'}</Text>
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
  deleteButton: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  deleteText: { color: '#fff', fontWeight: '800' },
});
