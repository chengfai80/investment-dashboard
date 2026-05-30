import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchDashboard } from '../api/client';

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    const res = await fetchDashboard();
    setData(res);
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#f59e0b" /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={{ color: '#fff', textAlign: 'center' }}>Dashboard load failed:\n{error}</Text></View>;
  }

  const summary = data?.summary || {};

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.sub}>Hi {data?.user?.display_name || 'there'} — {data?.period?.year}/{String(data?.period?.month).padStart(2, '0')}</Text>

      <View style={styles.card}><Text style={styles.label}>Monthly Expense</Text><Text style={styles.value}>RM {Number(summary.monthly_expense_total || 0).toFixed(2)}</Text></View>
      <View style={styles.card}><Text style={styles.label}>Commitments / month</Text><Text style={styles.value}>RM {Number(summary.commitment_month_total || 0).toFixed(2)}</Text></View>
      <View style={styles.card}><Text style={styles.label}>Assets</Text><Text style={styles.value}>RM {Number(summary.assets_total || 0).toFixed(2)}</Text></View>
      <View style={styles.card}><Text style={styles.label}>Net Position Estimate</Text><Text style={styles.value}>RM {Number(summary.net_position_estimate || 0).toFixed(2)}</Text></View>
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
  value: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
