import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const BUDGET_CATEGORIES = ['Petrol', 'Groceries', 'Shopping', 'Meal', 'Transportation'];

const EXPENSE_GROUP_ORDER = [
  'Parents',
  'School',
  'Family',
  'Bank',
  'Installment',
  'Essentials',
  'Donation',
  'Others',
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function MonthlyExpenseScreen() {
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [budgetData, setBudgetData] = useState([]);
  const [commitmentData, setCommitmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [expRes, budRes, comRes] = await Promise.all([
        api.get('/api/dashboard/expense-summary').catch(() => ({ data: null })),
        api.get('/api/data/expensesummary').catch(() => ({ data: [] })),
        api.get('/api/data/commitment').catch(() => ({ data: [] })),
      ]);
      setExpenseSummary(expRes.data);
      const bRaw = budRes.data;
      setBudgetData(Array.isArray(bRaw) ? bRaw : bRaw?.data ?? []);
      const cRaw = comRes.data;
      setCommitmentData(Array.isArray(cRaw) ? cRaw : cRaw?.data ?? []);
    } catch (_) {
      // individual catches above prevent total failure
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading expenses...</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  // Current month actuals from expense-summary
  const monthlyEntries = expenseSummary?.monthly ?? [];
  const currentMonthEntry = monthlyEntries.find(
    (m) => Number(m.month) === curMonth && Number(m.year) === curYear,
  ) ?? monthlyEntries[monthlyEntries.length - 1] ?? null;

  const actualCategories = currentMonthEntry?.categories ?? {};

  function getActualForCategory(cat) {
    // Try exact match first, then case-insensitive
    if (actualCategories[cat] !== undefined) return Number(actualCategories[cat]) || 0;
    const key = Object.keys(actualCategories).find(
      (k) => k.toLowerCase() === cat.toLowerCase(),
    );
    return key ? Number(actualCategories[key]) || 0 : 0;
  }

  function getBudgetForCategory(cat) {
    const match = budgetData.find(
      (b) => (b.Category || b.category || '').toLowerCase() === cat.toLowerCase(),
    );
    return Number(match?.Amount ?? match?.amount ?? 0);
  }

  // Income: salary from expensesummary where Category contains "Salary"
  const salaryEntry = budgetData.find(
    (b) => (b.Category || b.category || '').toLowerCase().includes('salary'),
  );
  const grossSalary = Number(salaryEntry?.Amount ?? salaryEntry?.amount ?? 0);
  const netSalary = grossSalary; // display the salary amount as instructed

  // Commitment items grouped by Type
  const commitmentGroups = {};
  EXPENSE_GROUP_ORDER.forEach((g) => {
    commitmentGroups[g] = [];
  });
  commitmentData.forEach((item) => {
    const type = item.Type || item.type || 'Others';
    const groupKey =
      EXPENSE_GROUP_ORDER.find((g) => g.toLowerCase() === type.toLowerCase()) || 'Others';
    if (!commitmentGroups[groupKey]) commitmentGroups[groupKey] = [];
    commitmentGroups[groupKey].push(item);
  });

  const totalExpenses = commitmentData.reduce(
    (sum, item) => sum + (Number(item.Amount ?? item.amount ?? 0)),
    0,
  );

  const balance = netSalary - totalExpenses;

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
      {/* Month Header */}
      <View style={styles.monthHeader}>
        <Ionicons name="calendar-outline" size={22} color={COLORS.accent} />
        <Text style={styles.monthTitle}>
          {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* a) Budget vs Actual Table                                          */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Budget vs Actual</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { minWidth: 110 }]}>Category</Text>
              <Text style={styles.tableHeaderCell}>Budget</Text>
              <Text style={styles.tableHeaderCell}>Actual</Text>
              <Text style={styles.tableHeaderCell}>Variance</Text>
            </View>
            {BUDGET_CATEGORIES.map((cat, idx) => {
              const budgetAmt = getBudgetForCategory(cat);
              const actualAmt = getActualForCategory(cat);
              const variance = budgetAmt - actualAmt;
              return (
                <View
                  key={cat}
                  style={[
                    styles.tableRow,
                    idx % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' },
                  ]}
                >
                  <Text style={[styles.tableCell, { minWidth: 110 }]}>{cat}</Text>
                  <Text style={styles.tableCell}>{fmt(budgetAmt)}</Text>
                  <Text style={styles.tableCell}>{fmt(actualAmt)}</Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { color: variance < 0 ? COLORS.red : COLORS.green },
                    ]}
                  >
                    {fmt(variance)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* b) Income Summary                                                  */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cash-outline" size={18} color={COLORS.green} />
          <Text style={styles.cardTitle}>Income Summary</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Gross Salary</Text>
          <Text style={styles.rowValue}>{fmt(grossSalary)}</Text>
        </View>
        <View style={[styles.row, styles.rowHighlight]}>
          <Text style={[styles.rowLabel, { color: COLORS.textPrimary, fontWeight: '700' }]}>
            Net Salary
          </Text>
          <Text style={[styles.rowValue, { color: COLORS.green, fontWeight: '700' }]}>
            {fmt(netSalary)}
          </Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* c) Expense Breakdown                                               */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="receipt-outline" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Expense Breakdown</Text>
        </View>
        {EXPENSE_GROUP_ORDER.map((group) => {
          const items = commitmentGroups[group] || [];
          if (items.length === 0) return null;
          const groupTotal = items.reduce(
            (s, i) => s + (Number(i.Amount ?? i.amount ?? 0)),
            0,
          );
          return (
            <View key={group} style={styles.groupBlock}>
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeaderText}>{group}</Text>
                <Text style={styles.groupHeaderTotal}>{fmt(groupTotal)}</Text>
              </View>
              {items.map((item, idx) => (
                <View key={item.id ?? idx} style={styles.groupItemRow}>
                  <Text style={styles.groupItemName} numberOfLines={1}>
                    {item.Name || item.name || 'Commitment'}
                  </Text>
                  <Text style={styles.groupItemAmount}>
                    {fmt(item.Amount ?? item.amount ?? 0)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Expenses</Text>
          <Text style={styles.totalValue}>{fmt(totalExpenses)}</Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* d) Balance                                                         */}
      {/* ------------------------------------------------------------------ */}
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
        <Text
          style={[
            styles.balanceValue,
            { color: balance >= 0 ? COLORS.green : COLORS.red },
          ]}
        >
          {fmt(balance)}
        </Text>
        <Text style={styles.balanceSubtext}>
          Income ({fmt(netSalary)}) - Expenses ({fmt(totalExpenses)})
        </Text>
      </View>

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

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Budget vs Actual table
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    minWidth: 90,
    paddingRight: 12,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderRadius: 4 },
  tableCell: {
    color: COLORS.textPrimary,
    fontSize: 13,
    minWidth: 90,
    paddingRight: 12,
  },

  // Generic row
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowHighlight: {
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  rowLabel: { color: COLORS.textSecondary, fontSize: 14 },
  rowValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },

  // Expense breakdown groups
  groupBlock: { marginBottom: 12 },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  groupHeaderText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHeaderTotal: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  groupItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  groupItemName: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  groupItemAmount: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Total row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },

  // Balance
  balanceValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  balanceSubtext: { color: COLORS.textSecondary, fontSize: 13 },
});
