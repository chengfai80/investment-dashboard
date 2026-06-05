import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import api from '../services/api';

// THEME
const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  input: '#0f3460',
  accent: '#e94560',
  green: '#2ecc71',
  red: '#e74c3c',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

const fmt = (n) =>
  `RM ${(Number(n) || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;

const CHART_CONFIG = {
  backgroundColor: '#16213e',
  backgroundGradientFrom: '#16213e',
  backgroundGradientTo: '#1a1a2e',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
  labelColor: () => '#888',
  style: { borderRadius: 12 },
  barPercentage: 0.6,
};

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CommitmentScreen() {
  const [dashboardData, setDashboardData] = useState(null);
  const [rawCommitments, setRawCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, rawRes] = await Promise.all([
        api.get('/api/dashboard/commitment').catch(() => ({ data: null })),
        api.get('/api/data/commitment').catch(() => ({ data: [] })),
      ]);
      setDashboardData(dashRes.data);
      const raw = rawRes.data;
      setRawCommitments(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch (_) {
      // individual catches prevent total failure
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const toggle = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading commitments...</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Derive month-level data
  // ---------------------------------------------------------------------------
  // Prefer dashboard endpoint if available; fall back to raw commitment array
  let monthlyData = []; // array of { label, total, items }

  const dashMonths = dashboardData?.months ?? [];

  if (dashMonths.length > 0) {
    monthlyData = dashMonths.map((m) => {
      const items = (m.items ?? []).map((i) => ({
        Name: i.Name || i.name || '',
        Type: i.Type || i.type || '',
        Description: i.Description || i.description || '',
        Amount: Number(i.Amount ?? i.amount ?? 0),
      }));
      // Sort items by Type then Name then Amount (matching Streamlit)
      items.sort((a, b) => {
        const typeCompare = (a.Type || '').localeCompare(b.Type || '');
        if (typeCompare !== 0) return typeCompare;
        const nameCompare = (a.Name || '').localeCompare(b.Name || '');
        if (nameCompare !== 0) return nameCompare;
        return a.Amount - b.Amount;
      });
      return {
        label: m.month ?? '',
        total: Number(m.total ?? 0),
        items,
      };
    });
  } else if (rawCommitments.length > 0) {
    // Group raw items by Month field
    const grouped = {};
    rawCommitments.forEach((item) => {
      const month = item.Month || item.month || 'Unknown';
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push({
        Name: item.Name || item.name || '',
        Type: item.Type || item.type || '',
        Description: item.Description || item.description || '',
        Amount: Number(item.Amount ?? item.amount ?? 0),
      });
    });
    // Sort months
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const ai = MONTH_LABELS.findIndex((m) => a.toLowerCase().startsWith(m.toLowerCase()));
      const bi = MONTH_LABELS.findIndex((m) => b.toLowerCase().startsWith(m.toLowerCase()));
      return ai - bi;
    });
    monthlyData = sortedKeys.map((key) => {
      const items = grouped[key];
      // Sort items by Type then Name then Amount
      items.sort((a, b) => {
        const typeCompare = (a.Type || '').localeCompare(b.Type || '');
        if (typeCompare !== 0) return typeCompare;
        const nameCompare = (a.Name || '').localeCompare(b.Name || '');
        if (nameCompare !== 0) return nameCompare;
        return a.Amount - b.Amount;
      });
      return {
        label: key,
        total: items.reduce((s, i) => s + i.Amount, 0),
        items,
      };
    });
  }

  // Yearly total
  const yearlyTotal = monthlyData.reduce((s, m) => s + m.total, 0);

  // Chart data
  const chartLabels = monthlyData.map((m) => {
    // Shorten labels for chart
    const parts = (m.label || '').split(/[\s-]/);
    return parts[0]?.substring(0, 3) || m.label;
  });
  const chartValues = monthlyData.map((m) => m.total);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      {/* Yearly Total Metric */}
      <View
        style={[styles.card, { borderLeftWidth: 3, borderLeftColor: COLORS.accent }]}
      >
        <View style={styles.metricRow}>
          <Ionicons
            name="calendar"
            size={18}
            color={COLORS.accent}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.metricLabel}>Yearly Total</Text>
        </View>
        <Text style={styles.metricValue}>{fmt(yearlyTotal)}</Text>
      </View>

      {/* Bar Chart */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Monthly Commitments</Text>
        </View>
        {chartValues.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={{
                labels: chartLabels,
                datasets: [{ data: chartValues }],
              }}
              width={Math.max(CHART_WIDTH, chartLabels.length * 52)}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={CHART_CONFIG}
              style={{ borderRadius: 12 }}
              fromZero
              showValuesOnTopOfBars={chartLabels.length <= 12}
            />
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No chart data available</Text>
        )}
      </View>

      {/* Monthly Expandable Sections */}
      {monthlyData.map((monthEntry) => {
        const isExpanded = !!expanded[monthEntry.label];
        return (
          <View key={monthEntry.label} style={styles.card}>
            <TouchableOpacity
              style={styles.monthRow}
              onPress={() => toggle(monthEntry.label)}
              activeOpacity={0.7}
            >
              <View style={styles.monthLeft}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={COLORS.accent}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.monthLabel}>{monthEntry.label}</Text>
              </View>
              <View style={styles.monthRight}>
                <Text style={styles.monthTotal}>{fmt(monthEntry.total)}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.textSecondary}
                  style={{ marginLeft: 8 }}
                />
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.itemsList}>
                {monthEntry.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.Name}
                      </Text>
                      <Text style={styles.itemType} numberOfLines={1}>
                        {item.Type}
                      </Text>
                    </View>
                    <Text style={styles.itemAmount}>{fmt(item.Amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {monthlyData.length === 0 && !loading && (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No commitment data available</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 8 },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Yearly metric
  metricRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metricLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '700' },

  // Month expandable
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthLeft: { flexDirection: 'row', alignItems: 'center' },
  monthRight: { flexDirection: 'row', alignItems: 'center' },
  monthLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  monthTotal: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },

  // Expanded items
  itemsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '500' },
  itemType: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  itemAmount: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
});
