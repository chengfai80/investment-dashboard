import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/api';

// THEME
const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  input: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#2ecc71',
  red: '#e74c3c',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;

const CHART_CONFIG = {
  backgroundColor: COLORS.surface,
  backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: '#1a1a2e',
  decimalPlaces: 2,
  color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(160, 160, 184, ${opacity})`,
  style: { borderRadius: 12 },
  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255,255,255,0.05)' },
  barPercentage: 0.35,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (n) =>
  `RM ${(Number(n) || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// Main Component
export default function MonthlyExpenseScreen() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incomeUnlocked, setIncomeUnlocked] = useState(false);
  const [balanceUnlocked, setBalanceUnlocked] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const years = useMemo(() => {
    const arr = [];
    for (let y = now.getFullYear(); y >= 2020; y--) arr.push(y);
    return arr;
  }, []);

  const fetchAll = useCallback(async (year, month) => {
    try {
      const res = await api.get(`/api/dashboard/monthly-expense?year=${year}&month=${month}`).catch(() => ({ data: null }));
      setExpenseSummary(res.data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(selectedYear, selectedMonth); setLoading(false); })();
  }, [selectedYear, selectedMonth, fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(selectedYear, selectedMonth); setRefreshing(false);
  }, [fetchAll, selectedYear, selectedMonth]);

  function goToPrevMonth() {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  }

  function goToNextMonth() {
    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  }

  function goToToday() {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  }

  // Biometric unlock
  async function unlockSection(section) {
    if (Platform.OS === 'web') {
      if (section === 'income') setIncomeUnlocked(true);
      if (section === 'balance') setBalanceUnlocked(true);
      return;
    }

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        if (section === 'income') setIncomeUnlocked(true);
        if (section === 'balance') setBalanceUnlocked(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to view ${section === 'income' ? 'Income Summary' : 'Balance'}`,
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        if (section === 'income') setIncomeUnlocked(true);
        if (section === 'balance') setBalanceUnlocked(true);
      } else {
        Alert.alert('Authentication Failed', 'Could not verify your identity.');
      }
    } catch (_) {
      if (section === 'income') setIncomeUnlocked(true);
      if (section === 'balance') setBalanceUnlocked(true);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading expenses...</Text>
      </View>
    );
  }

  const comparison = expenseSummary?.comparison ?? [];
  const grossSalary = expenseSummary?.salary ?? 0;
  const grossIncome = expenseSummary?.grossIncome ?? 0;
  const expenseGroups = expenseSummary?.expenseGroups ?? [];
  const totalExpenses = expenseSummary?.totalExpenses ?? 0;
  const balance = expenseSummary?.balance ?? 0;

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  // Chart data for variance comparison
  const chartLabels = comparison.map((c) => c.category);
  const budgetData = comparison.map((c) => Math.round(Math.abs(c.budgeted) * 100) / 100);
  const actualData = comparison.map((c) => Math.round(c.actual * 100) / 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
      }
    >
      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navArrow}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.monthCenter}>
          <TouchableOpacity onPress={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }} style={styles.monthBtn}>
            <Text style={styles.monthTitle}>{MONTH_NAMES[selectedMonth - 1]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }} style={styles.yearBtn}>
            <Text style={styles.yearTitle}>{selectedYear}</Text>
            <Ionicons name="caret-down" size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goToNextMonth} style={styles.navArrow}>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Today button */}
      {!isCurrentMonth && (
        <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
          <Ionicons name="today-outline" size={14} color={COLORS.accent} />
          <Text style={styles.todayBtnText}>Current Month</Text>
        </TouchableOpacity>
      )}

      {/* Year Picker */}
      {showYearPicker && (
        <View style={styles.pickerContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.pickerChip, selectedYear === y && styles.pickerChipActive]}
                onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}
              >
                <Text style={[styles.pickerChipText, selectedYear === y && styles.pickerChipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Month Picker */}
      {showMonthPicker && (
        <View style={styles.pickerContainer}>
          <View style={styles.monthGrid}>
            {MONTH_SHORT.map((m, idx) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthGridItem, selectedMonth === idx + 1 && styles.monthGridItemActive]}
                onPress={() => { setSelectedMonth(idx + 1); setShowMonthPicker(false); }}
              >
                <Text style={[styles.monthGridText, selectedMonth === idx + 1 && styles.monthGridTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Budget vs Actual Table */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Budget vs Actual</Text>
        </View>
        {comparison.length === 0 ? (
          <Text style={styles.emptyText}>No budget data for this month</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: 110 }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { width: 100 }]}>Budget</Text>
                <Text style={[styles.tableHeaderCell, { width: 100 }]}>Actual</Text>
                <Text style={[styles.tableHeaderCell, { width: 100 }]}>Variance</Text>
              </View>
              {comparison.map((item, idx) => {
                const budgetAmt = Math.abs(item.budgeted);
                const variance = item.variance;
                return (
                  <View
                    key={item.category}
                    style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}
                  >
                    <Text style={[styles.tableCell, { width: 110 }]}>{item.category}</Text>
                    <Text style={[styles.tableCell, { width: 100 }]}>{fmt(budgetAmt)}</Text>
                    <Text style={[styles.tableCell, { width: 100 }]}>{fmt(item.actual)}</Text>
                    <Text style={[styles.tableCell, { width: 100, color: variance < 0 ? COLORS.red : COLORS.green }]}>
                      {fmt(variance)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Variance Chart */}
      {comparison.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="analytics-outline" size={18} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Budget vs Actual Chart</Text>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(233, 69, 96, 0.9)' }]} />
              <Text style={styles.legendText}>Budget</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(46, 204, 113, 0.9)' }]} />
              <Text style={styles.legendText}>Actual</Text>
            </View>
          </View>

          {(() => {
            // Grouped bar chart: interleave budget & actual per category
            const groupedLabels = [];
            const groupedData = [];
            const groupedColors = [];
            comparison.forEach((c) => {
              groupedLabels.push(c.category);
              groupedLabels.push('');
              groupedData.push(Math.abs(c.budgeted) || 0);
              groupedData.push(c.actual || 0);
              groupedColors.push((opacity) => `rgba(233, 69, 96, ${opacity})`);
              groupedColors.push((opacity) => `rgba(46, 204, 113, ${opacity})`);
            });

            const needsScroll = groupedLabels.length * 36 > CHART_WIDTH;
            const chartWidth = needsScroll ? groupedLabels.length * 36 : CHART_WIDTH;

            const chart = (
              <BarChart
                data={{
                  labels: groupedLabels,
                  datasets: [{ data: groupedData.length > 0 ? groupedData : [0] }],
                }}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  ...CHART_CONFIG,
                  barPercentage: 0.6,
                  color: (opacity, index) => {
                    if (index != null && groupedColors[index]) return groupedColors[index](opacity);
                    return `rgba(233, 69, 96, ${opacity})`;
                  },
                }}
                style={{ borderRadius: 12 }}
                fromZero
                showValuesOnTopOfBars={comparison.length <= 6}
              />
            );

            if (needsScroll) {
              return <ScrollView horizontal showsHorizontalScrollIndicator={false}>{chart}</ScrollView>;
            }
            return chart;
          })()}

          {/* Variance bars */}
          <Text style={[styles.subHeading, { marginTop: 14 }]}>Variance by Category</Text>
          {comparison.map((item) => {
            const maxAbs = Math.max(...comparison.map((c) => Math.abs(c.variance)), 1);
            const pct = Math.min(Math.abs(item.variance) / maxAbs, 1);
            const isOver = item.variance < 0;
            return (
              <View key={item.category} style={styles.varianceRow}>
                <Text style={styles.varianceLabel} numberOfLines={1}>{item.category}</Text>
                <View style={styles.varianceBarBg}>
                  <View style={[
                    styles.varianceBarFill,
                    { width: `${pct * 100}%`, backgroundColor: isOver ? COLORS.red : COLORS.green },
                  ]} />
                </View>
                <Text style={[styles.varianceAmount, { color: isOver ? COLORS.red : COLORS.green }]}>
                  {isOver ? '-' : '+'}{fmt(Math.abs(item.variance)).replace('RM ', '')}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Income Summary - locked behind fingerprint */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cash-outline" size={18} color={COLORS.green} />
          <Text style={styles.cardTitle}>Income Summary</Text>
        </View>
        {incomeUnlocked ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Gross Salary</Text>
              <Text style={styles.rowValue}>{fmt(grossSalary)}</Text>
            </View>
            <View style={[styles.row, styles.rowHighlight]}>
              <Text style={[styles.rowLabel, { color: COLORS.textPrimary, fontWeight: '700' }]}>
                Gross Income (After Tax)
              </Text>
              <Text style={[styles.rowValue, { color: COLORS.green, fontWeight: '700' }]}>
                {fmt(grossIncome)}
              </Text>
            </View>
            <TouchableOpacity style={styles.relockBtn} onPress={() => setIncomeUnlocked(false)} activeOpacity={0.7}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.relockText}>Lock</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.lockOverlay} onPress={() => unlockSection('income')} activeOpacity={0.7}>
            <Ionicons name="lock-closed" size={28} color={COLORS.textSecondary} />
            <Text style={styles.lockText}>Tap to unlock with fingerprint</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expense Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="receipt-outline" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Expense Breakdown</Text>
        </View>
        {expenseGroups.length === 0 ? (
          <Text style={styles.emptyText}>No expense data for this month</Text>
        ) : (
          expenseGroups.map((group) => {
            if (!group.items || group.items.length === 0) return null;
            return (
              <View key={group.group} style={styles.groupBlock}>
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupHeaderText}>{group.group}</Text>
                  <Text style={styles.groupHeaderTotal}>{fmt(group.total)}</Text>
                </View>
                {group.items.map((item, idx) => (
                  <View key={idx} style={styles.groupItemRow}>
                    <Text style={styles.groupItemName} numberOfLines={1}>{item.category}</Text>
                    <Text style={styles.groupItemAmount}>{fmt(item.amount)}</Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Expenses</Text>
          <Text style={styles.totalValue}>{fmt(totalExpenses)}</Text>
        </View>
      </View>

      {/* Balance - locked behind fingerprint */}
      <View
        style={[
          styles.card,
          { borderLeftWidth: 3, borderLeftColor: balance >= 0 ? COLORS.green : COLORS.red },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name={balance >= 0 ? 'trending-up' : 'trending-down'}
            size={18}
            color={balance >= 0 ? COLORS.green : COLORS.red}
          />
          <Text style={styles.cardTitle}>Balance</Text>
        </View>
        {balanceUnlocked ? (
          <>
            <Text style={[styles.balanceValue, { color: balance >= 0 ? COLORS.green : COLORS.red }]}>
              {fmt(balance)}
            </Text>
            <Text style={styles.balanceSubtext}>
              Income ({fmt(grossIncome)}) - Expenses ({fmt(totalExpenses)})
            </Text>
            <TouchableOpacity style={styles.relockBtn} onPress={() => setBalanceUnlocked(false)} activeOpacity={0.7}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.relockText}>Lock</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.lockOverlay} onPress={() => unlockSection('balance')} activeOpacity={0.7}>
            <Ionicons name="lock-closed" size={28} color={COLORS.textSecondary} />
            <Text style={styles.lockText}>Tap to unlock with fingerprint</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 8 },
  center: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },

  // Month Navigator
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, paddingHorizontal: 4,
  },
  navArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  monthCenter: { alignItems: 'center' },
  monthBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  monthTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  yearBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2 },
  yearTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', marginRight: 4 },

  todayBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.accentDim, marginBottom: 12,
  },
  todayBtnText: { color: COLORS.accent, fontSize: 12, fontWeight: '600', marginLeft: 4 },

  pickerContainer: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  pickerChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.input, marginRight: 8,
  },
  pickerChipActive: { backgroundColor: COLORS.accent },
  pickerChipText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  pickerChipTextActive: { color: '#ffffff' },

  monthGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  monthGridItem: {
    width: '23%', paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.input, alignItems: 'center', marginBottom: 8,
  },
  monthGridItemActive: { backgroundColor: COLORS.accent },
  monthGridText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  monthGridTextActive: { color: '#ffffff' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginLeft: 8 },

  tableHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 4,
  },
  tableHeaderCell: {
    color: COLORS.textSecondary, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', paddingRight: 8,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderRadius: 4 },
  tableCell: { color: COLORS.textPrimary, fontSize: 13, paddingRight: 8 },

  // Legend
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

  // Variance bars
  subHeading: {
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  varianceRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  varianceLabel: {
    color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', width: 90,
  },
  varianceBarBg: {
    flex: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 7, overflow: 'hidden', marginHorizontal: 8,
  },
  varianceBarFill: {
    height: 14, borderRadius: 7,
  },
  varianceAmount: {
    fontSize: 11, fontWeight: '700', width: 75, textAlign: 'right',
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowHighlight: {
    backgroundColor: 'rgba(46, 204, 113, 0.08)', borderRadius: 8,
    paddingHorizontal: 8, marginTop: 8,
  },
  rowLabel: { color: COLORS.textSecondary, fontSize: 14 },
  rowValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },

  groupBlock: { marginBottom: 12 },
  groupHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 4,
  },
  groupHeaderText: {
    color: COLORS.accent, fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  groupHeaderTotal: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  groupItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  groupItemName: { color: COLORS.textSecondary, fontSize: 13, flex: 1, marginRight: 12 },
  groupItemAmount: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 12,
  },
  totalLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  totalValue: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },

  balanceValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  balanceSubtext: { color: COLORS.textSecondary, fontSize: 13 },

  lockOverlay: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
  },
  lockText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },

  relockBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
    marginTop: 8, paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
  },
  relockText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginLeft: 4 },

  emptyText: {
    color: COLORS.textSecondary, fontSize: 13, textAlign: 'center',
    paddingVertical: 20, fontStyle: 'italic',
  },
});
