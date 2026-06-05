import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/api';

const COLORS = {
  background: '#1a1a2e', surface: '#16213e',
  accent: '#e94560', accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69', red: '#e94560',
  textPrimary: '#ffffff', textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;
const USD_RATE_KEY = 'usd_myr_rate';

const CHART_CONFIG = {
  backgroundColor: COLORS.surface, backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: '#1a1a2e', decimalPlaces: 2,
  color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(160, 160, 184, ${opacity})`,
  style: { borderRadius: 12 },
  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255,255,255,0.05)' },
  barPercentage: 0.5,
};

// Helpers
function fmt(num) {
  if (num == null || isNaN(num)) return 'RM 0.00';
  const abs = Math.abs(Number(num));
  const sign = Number(num) < 0 ? '-' : '';
  return `${sign}RM ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(num) {
  if (num == null || isNaN(num)) return '0.00%';
  return `${Number(num).toFixed(2)}%`;
}

function normalizeArray(d) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) return [d];
  return [];
}

// Safely convert any value to a display string (handles Firestore timestamps, objects, etc.)
function safeStr(val, fallback = '-') {
  if (val == null) return fallback;
  if (typeof val === 'object') {
    if (val._seconds != null) {
      try { return new Date(val._seconds * 1000).toISOString().split('T')[0]; } catch (_) { return fallback; }
    }
    return fallback;
  }
  const s = String(val).trim();
  return s || fallback;
}

// Biometric helper
async function promptBiometric(label) {
  if (Platform.OS === 'web') return true;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Authenticate to view ${label}`,
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch (_) { return true; }
}

// Section with optional lock
function Section({ title, icon, expanded, onToggle, locked, onUnlock, onLock, children }) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={20} color={COLORS.accent} style={{ marginRight: 10 }} />
          <Text style={styles.sectionTitle}>{title}</Text>
          {locked && <Ionicons name="lock-closed" size={14} color={COLORS.textSecondary} style={{ marginLeft: 6 }} />}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sectionBody}>
          {locked ? (
            <TouchableOpacity style={styles.lockOverlay} onPress={onUnlock} activeOpacity={0.7}>
              <Ionicons name="lock-closed" size={28} color={COLORS.textSecondary} />
              <Text style={styles.lockText}>Tap to unlock with fingerprint</Text>
            </TouchableOpacity>
          ) : (
            <>
              {children}
              {onLock && (
                <TouchableOpacity style={styles.relockBtn} onPress={onLock} activeOpacity={0.7}>
                  <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.relockText}>Lock</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function MetricCard({ label, value, color, icon }) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: color || COLORS.accent }]}>
      <View style={styles.metricRow}>
        {icon && <Ionicons name={icon} size={18} color={color || COLORS.accent} style={{ marginRight: 6 }} />}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: color || COLORS.textPrimary }]}>{value}</Text>
    </View>
  );
}

// Memoized table row for performance
const DashTableRow = memo(function DashTableRow({ row, widths, index }) {
  return (
    <View style={[styles.tableRow, index % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
      {row.map((cell, ci) => (
        <Text key={ci} style={[styles.tableCell, { width: widths[ci] }]} numberOfLines={2}>{cell}</Text>
      ))}
    </View>
  );
});

function DataTable({ headers, rows, columnWidths, maxHeight }) {
  const widths = columnWidths || headers.map((_, i) => (i === 0 ? 110 : 100));
  const tableMaxH = maxHeight || 300;
  return (
    <View style={{ maxHeight: tableMaxH, marginTop: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.tableHeaderRow}>
            {headers.map((h, i) => (
              <Text key={i} style={[styles.tableHeaderCell, { width: widths[i] }]}>{h}</Text>
            ))}
          </View>
          <FlatList
            data={rows}
            keyExtractor={(_, i) => String(i)}
            nestedScrollEnabled
            style={{ maxHeight: tableMaxH - 36 }}
            initialNumToRender={30}
            maxToRenderPerBatch={50}
            windowSize={21}
            removeClippedSubviews={Platform.OS !== 'web'}
            getItemLayout={(_, index) => ({ length: 32, offset: 32 * index, index })}
            renderItem={({ item, index }) => (
              <DashTableRow row={item} widths={widths} index={index} />
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No data available</Text>}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function FilterChips({ categories, selected, onSelect, label }) {
  return (
    <View>
      {label && <Text style={styles.filterLabel}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, marginTop: 2 }}>
        <TouchableOpacity style={[styles.filterChip, !selected && styles.filterChipActive]} onPress={() => onSelect(null)}>
          <Text style={[styles.filterChipText, !selected && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity key={cat} style={[styles.filterChip, selected === cat && styles.filterChipActive]} onPress={() => onSelect(cat)}>
            <Text style={[styles.filterChipText, selected === cat && styles.filterChipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function TabBar({ tabs, active, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {tabs.map((t) => (
        <TouchableOpacity key={t} style={[styles.tab, active === t && styles.tabActive]} onPress={() => onSelect(t)}>
          <Text style={[styles.tabText, active === t && styles.tabTextActive]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ChartBar({ labels, dataPoints }) {
  if (!dataPoints || dataPoints.length === 0) {
    return <Text style={styles.emptyText}>No chart data</Text>;
  }
  // Round to 2 decimal places (#7)
  const safeData = dataPoints.map((d) => Math.round((isNaN(d) ? 0 : Number(d)) * 100) / 100);
  const displayLabels = labels.length > 8
    ? labels.map((l, i) => (i % Math.ceil(labels.length / 8) === 0 ? l : ''))
    : labels;
  // Use full width when labels fit, only scroll when many labels
  const needsScroll = labels.length * 52 > CHART_WIDTH;
  const chartWidth = needsScroll ? labels.length * 52 : CHART_WIDTH;
  const chart = (
      <BarChart
        data={{ labels: displayLabels, datasets: [{ data: safeData }] }}
        width={chartWidth}
        height={220}
        yAxisLabel="" yAxisSuffix=""
        chartConfig={CHART_CONFIG}
        style={{ borderRadius: 12 }}
        fromZero
        showValuesOnTopOfBars={labels.length <= 12}
      />
  );
  if (needsScroll) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false}>{chart}</ScrollView>;
  }
  return chart;
}

// Main Component
export default function DashboardScreen() {
  const [wealth, setWealth] = useState(null);
  const [income, setIncome] = useState(null);
  const [expense, setExpense] = useState(null);
  const [cardSummary, setCardSummary] = useState(null);
  const [epf, setEpf] = useState(null);
  const [fd, setFd] = useState(null);
  const [insuranceInv, setInsuranceInv] = useState(null);
  const [investment, setInvestment] = useState(null);
  const [share, setShare] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [investTab, setInvestTab] = useState('EPF');
  const [usdRate, setUsdRate] = useState(4.5);

  // Table visibility
  const [showIncomeTable, setShowIncomeTable] = useState(false);
  const [showExpenseTable, setShowExpenseTable] = useState(false);
  const [showCardTable, setShowCardTable] = useState(false);

  // Category filters for charts + tables
  const [incomeCategoryFilter, setIncomeCategoryFilter] = useState(null);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState(null);
  const [cardCategoryFilter, setCardCategoryFilter] = useState(null);
  const [cardTypeFilter, setCardTypeFilter] = useState(null);

  // Fingerprint locks (#2)
  const [wealthUnlocked, setWealthUnlocked] = useState(false);
  const [banksUnlocked, setBanksUnlocked] = useState(false);
  const [investUnlocked, setInvestUnlocked] = useState(false);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleUnlock(section, setter) {
    const ok = await promptBiometric(section);
    if (ok) setter(true);
    else Alert.alert('Authentication Failed', 'Could not verify your identity.');
  }

  const fetchAll = useCallback(async () => {
    try {
      let rate = 4.5;
      try {
        const stored = await AsyncStorage.getItem(USD_RATE_KEY);
        if (stored) rate = parseFloat(stored) || 4.5;
      } catch (_) {}
      setUsdRate(rate);

      const [wRes, iRes, eRes, cRes, epfRes, fdRes, insInvRes, invRes, shrRes] = await Promise.all([
        api.get(`/api/dashboard/wealth?usdRate=${rate}`).catch(() => ({ data: null })),
        api.get('/api/dashboard/income-summary').catch(() => ({ data: null })),
        api.get('/api/dashboard/expense-summary').catch(() => ({ data: null })),
        api.get('/api/dashboard/card-summary').catch(() => ({ data: null })),
        api.get('/api/data/epf').catch(() => ({ data: null })),
        api.get('/api/data/fd').catch(() => ({ data: null })),
        api.get('/api/data/insuranceinvestment').catch(() => ({ data: null })),
        api.get('/api/data/investment').catch(() => ({ data: null })),
        api.get('/api/data/share').catch(() => ({ data: null })),
      ]);
      setWealth(wRes.data); setIncome(iRes.data); setExpense(eRes.data);
      setCardSummary(cRes.data); setEpf(epfRes.data); setFd(fdRes.data);
      setInsuranceInv(insInvRes.data); setInvestment(invRes.data); setShare(shrRes.data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchAll(); setLoading(false); })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchAll(); setRefreshing(false);
  }, [fetchAll]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}>
      {renderWealthSection()}
      {renderBankSection()}
      {renderIncomeSection()}
      {renderExpenseSection()}
      {renderCardSection()}
      {renderInvestmentSection()}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // === SECTIONS ===

  function renderWealthSection() {
    const totalWealth = wealth?.totalWealth ?? 0;
    const totalKidWealth = wealth?.totalKidWealth ?? 0;
    const totalDebt = wealth?.totalDebt ?? 0;
    const breakdown = wealth?.breakdown ?? [];
    const kidBreakdown = wealth?.kidBreakdown ?? [];
    const debtBreakdown = wealth?.debtBreakdown ?? [];

    return (
      <Section title="Wealth & Debt Summary" icon="wallet-outline"
        expanded={!!expanded.wealth} onToggle={() => toggle('wealth')}
        locked={!wealthUnlocked}
        onUnlock={() => handleUnlock('Wealth & Debt Summary', setWealthUnlocked)}
        onLock={() => setWealthUnlocked(false)}>
        <View style={styles.metricsRow}>
          <MetricCard label="Total Wealth" value={fmt(totalWealth)} color={COLORS.green} icon="trending-up" />
          {totalKidWealth > 0 && <MetricCard label="Kids Wealth" value={fmt(totalKidWealth)} color="#60A5FA" icon="people" />}
          {totalDebt > 0 && <MetricCard label="Total Debt" value={fmt(totalDebt)} color={COLORS.red} icon="trending-down" />}
        </View>
        <Text style={styles.subHeading}>Wealth Breakdown</Text>
        {breakdown.map((item) => (
          <View key={item.category} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{item.category}</Text>
            <Text style={styles.breakdownValue}>{fmt(item.amount)}</Text>
          </View>
        ))}
        {kidBreakdown.length > 0 && (
          <>
            <Text style={[styles.subHeading, { marginTop: 14 }]}>Kids Wealth Breakdown</Text>
            {kidBreakdown.map((item) => (
              <View key={item.category} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.category}</Text>
                <Text style={styles.breakdownValue}>{fmt(item.amount)}</Text>
              </View>
            ))}
          </>
        )}
        {totalDebt > 0 && debtBreakdown.length > 0 && (
          <>
            <Text style={[styles.subHeading, { marginTop: 14 }]}>Debt Breakdown</Text>
            {debtBreakdown.map((item, i) => (
              <View key={i} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.category}</Text>
                <Text style={[styles.breakdownValue, { color: COLORS.red }]}>{fmt(item.amount)}</Text>
              </View>
            ))}
          </>
        )}
      </Section>
    );
  }

  function renderBankSection() {
    const bankBalances = wealth?.bankBalances ?? {};
    const kidBankBalances = wealth?.kidBankBalances ?? {};
    const hasBanks = Object.keys(bankBalances).length > 0;
    const hasKidBanks = Object.keys(kidBankBalances).length > 0;

    return (
      <Section title="Bank Balances" icon="business-outline"
        expanded={!!expanded.banks} onToggle={() => toggle('banks')}
        locked={!banksUnlocked}
        onUnlock={() => handleUnlock('Bank Balances', setBanksUnlocked)}
        onLock={() => setBanksUnlocked(false)}>
        {!hasBanks ? (
          <Text style={styles.emptyText}>No bank data available</Text>
        ) : (
          <>
            <Text style={styles.subHeading}>My Accounts</Text>
            <View style={styles.gridRow}>
              {Object.entries(bankBalances).map(([name, amount]) => (
                <View key={name} style={styles.bankCard}>
                  <Text style={styles.bankName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.bankBalance}>{fmt(amount)}</Text>
                </View>
              ))}
            </View>
            {hasKidBanks && (
              <>
                <Text style={[styles.subHeading, { marginTop: 12 }]}>Kids Accounts</Text>
                <View style={styles.gridRow}>
                  {Object.entries(kidBankBalances).map(([name, amount]) => (
                    <View key={name} style={styles.bankCard}>
                      <Text style={styles.bankName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.bankBalance}>{fmt(amount)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </Section>
    );
  }

  function renderIncomeSection() {
    const grouped = income?.grouped ?? [];
    const transactions = income?.transactions ?? [];

    // Get unique categories for chart filter (#6)
    const allCategories = [...new Set(grouped.map((g) => g.category).filter(Boolean))].sort();

    // Filter grouped data by selected category
    const filteredGrouped = incomeCategoryFilter
      ? grouped.filter((g) => g.category === incomeCategoryFilter)
      : grouped;

    const monthTotals = {};
    for (const g of filteredGrouped) {
      if (!monthTotals[g.month]) monthTotals[g.month] = { month: g.month, monthNum: g.monthNum, total: 0 };
      monthTotals[g.month].total += g.amount;
    }
    const monthly = Object.values(monthTotals).sort((a, b) => a.monthNum - b.monthNum);
    const labels = monthly.map((m) => m.month);
    const dataPoints = monthly.map((m) => Math.round(m.total * 100) / 100);

    // Filter + sort transactions
    const filteredTx = incomeCategoryFilter
      ? transactions.filter((t) => t.category === incomeCategoryFilter)
      : transactions;
    const sortedTx = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <Section title="Income Summary" icon="arrow-down-circle-outline" expanded={!!expanded.income} onToggle={() => toggle('income')}>
        <FilterChips categories={allCategories} selected={incomeCategoryFilter} onSelect={setIncomeCategoryFilter} label="Category" />
        <ChartBar labels={labels} dataPoints={dataPoints} />
        {sortedTx.length > 0 && (
          <>
            <TouchableOpacity style={styles.toggleTableBtn} onPress={() => setShowIncomeTable(!showIncomeTable)}>
              <Ionicons name={showIncomeTable ? 'eye-off-outline' : 'eye-outline'} size={16} color={COLORS.accent} />
              <Text style={styles.toggleTableText}>{showIncomeTable ? 'Hide' : 'View'} Transactions</Text>
            </TouchableOpacity>
            {showIncomeTable && (
              <DataTable
                headers={['Date', 'Bank', 'Description', 'Category', 'Amount']}
                columnWidths={[90, 80, 120, 100, 100]}
                rows={sortedTx.map((t) => [
                  t.date ?? '', t.bank ?? '', t.description ?? '', t.category ?? '', fmt(t.amount ?? 0),
                ])}
              />
            )}
          </>
        )}
      </Section>
    );
  }

  function renderExpenseSection() {
    const grouped = expense?.grouped ?? [];
    const transactions = expense?.transactions ?? [];

    const allCategories = [...new Set(grouped.map((g) => g.category).filter(Boolean))].sort();

    // Filter grouped for chart
    const filteredGrouped = expenseCategoryFilter
      ? grouped.filter((g) => g.category === expenseCategoryFilter)
      : grouped;

    const monthTotals = {};
    for (const g of filteredGrouped) {
      if (!monthTotals[g.month]) monthTotals[g.month] = { month: g.month, monthNum: g.monthNum, total: 0 };
      monthTotals[g.month].total += g.amount;
    }
    const monthly = Object.values(monthTotals).sort((a, b) => a.monthNum - b.monthNum);
    const labels = monthly.map((m) => m.month);
    const dataPoints = monthly.map((m) => Math.round(m.total * 100) / 100);

    const filteredTx = expenseCategoryFilter
      ? transactions.filter((t) => t.category === expenseCategoryFilter)
      : transactions;
    const sortedTx = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <Section title="Expense Summary" icon="arrow-up-circle-outline" expanded={!!expanded.expense} onToggle={() => toggle('expense')}>
        <FilterChips categories={allCategories} selected={expenseCategoryFilter} onSelect={setExpenseCategoryFilter} label="Category" />
        <ChartBar labels={labels} dataPoints={dataPoints} />
        {transactions.length > 0 && (
          <>
            <TouchableOpacity style={styles.toggleTableBtn} onPress={() => setShowExpenseTable(!showExpenseTable)}>
              <Ionicons name={showExpenseTable ? 'eye-off-outline' : 'eye-outline'} size={16} color={COLORS.accent} />
              <Text style={styles.toggleTableText}>{showExpenseTable ? 'Hide' : 'View'} Transactions</Text>
            </TouchableOpacity>
            {showExpenseTable && (
              <DataTable
                headers={['Date', 'Name', 'Description', 'Category', 'Amount']}
                columnWidths={[90, 80, 120, 100, 100]}
                rows={sortedTx.map((t) => [
                  t.date ?? '', t.name ?? '', t.description ?? '', t.category ?? '', fmt(t.amount ?? 0),
                ])}
              />
            )}
          </>
        )}
      </Section>
    );
  }

  function renderCardSection() {
    const data = Array.isArray(cardSummary) ? cardSummary : [];

    // Unique categories and types for filters
    const allCategories = [...new Set(data.map((t) => t.category).filter(Boolean))].sort();
    const allTypes = [...new Set(data.map((t) => t.card).filter(Boolean))].sort();

    // Apply both filters
    let filteredData = data;
    if (cardCategoryFilter) filteredData = filteredData.filter((t) => t.category === cardCategoryFilter);
    if (cardTypeFilter) filteredData = filteredData.filter((t) => t.card === cardTypeFilter);

    // Build chart from filtered data
    const monthTotals = {};
    for (const entry of filteredData) {
      const m = entry.month;
      if (!monthTotals[m]) monthTotals[m] = { month: m, monthNum: entry.monthNum, total: 0 };
      monthTotals[m].total += entry.amount;
    }
    const monthly = Object.values(monthTotals).sort((a, b) => a.monthNum - b.monthNum);
    const labels = monthly.map((m) => m.month);
    const dataPoints = monthly.map((m) => Math.round(m.total * 100) / 100);

    const sortedData = [...filteredData].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <Section title="Card / eWallet Usage" icon="card-outline" expanded={!!expanded.card} onToggle={() => toggle('card')}>
        <FilterChips categories={allCategories} selected={cardCategoryFilter} onSelect={setCardCategoryFilter} label="Category" />
        <FilterChips categories={allTypes} selected={cardTypeFilter} onSelect={setCardTypeFilter} label="Type" />
        <ChartBar labels={labels} dataPoints={dataPoints} />
        {data.length > 0 && (
          <>
            <TouchableOpacity style={styles.toggleTableBtn} onPress={() => setShowCardTable(!showCardTable)}>
              <Ionicons name={showCardTable ? 'eye-off-outline' : 'eye-outline'} size={16} color={COLORS.accent} />
              <Text style={styles.toggleTableText}>{showCardTable ? 'Hide' : 'View'} Transactions</Text>
            </TouchableOpacity>
            {showCardTable && (
              <DataTable
                headers={['Date', 'Card', 'Description', 'Category', 'Amount']}
                columnWidths={[90, 80, 130, 100, 100]}
                rows={sortedData.map((t) => [
                  t.date ?? '', t.card ?? '', t.description ?? '', t.category ?? '', fmt(t.amount ?? 0),
                ])}
              />
            )}
          </>
        )}
      </Section>
    );
  }

  function renderInvestmentSection() {
    const tabs = ['EPF', 'FD', 'Insurance Inv', 'Investment', 'Share'];
    return (
      <Section title="Investment Portfolio" icon="pie-chart-outline"
        expanded={!!expanded.invest} onToggle={() => toggle('invest')}
        locked={!investUnlocked}
        onUnlock={() => handleUnlock('Investment Portfolio', setInvestUnlocked)}
        onLock={() => setInvestUnlocked(false)}>
        <TabBar tabs={tabs} active={investTab} onSelect={setInvestTab} />
        {investTab === 'EPF' && renderEpfTab()}
        {investTab === 'FD' && renderFdTab()}
        {investTab === 'Insurance Inv' && renderInsuranceInvTab()}
        {investTab === 'Investment' && renderInvestmentTab()}
        {investTab === 'Share' && renderShareTab()}
      </Section>
    );
  }

  // === INVESTMENT SUB-TABS ===

  function renderEpfTab() {
    const data = normalizeArray(epf);
    const totalEpf = data.filter((e) => e["Account Type"] !== "Interest").reduce((s, e) => s + Number(e.Amount ?? 0), 0);
    const interest = data.filter((e) => e["Account Type"] === "Interest").reduce((s, e) => s + Number(e.Amount ?? 0), 0);
    const displayData = data.filter((e) => e["Account Type"] !== "Interest");
    return (
      <View>
        <View style={styles.metricsRow}>
          <MetricCard label="EPF Total" value={fmt(totalEpf)} color={COLORS.green} icon="shield-checkmark" />
          {interest !== 0 && <MetricCard label="Interest" value={pct(interest)} color="#60A5FA" icon="trending-up" />}
        </View>
        {displayData.length > 0 && (
          <DataTable headers={['Account Type', 'Amount']} columnWidths={[140, 120]}
            rows={displayData.map((e) => [e["Account Type"] ?? '', fmt(e.Amount ?? 0)])} />
        )}
      </View>
    );
  }

  function renderFdTab() {
    const raw = fd;
    // Robust normalization - handle null, single object, array, or nested data
    let data = [];
    try {
      if (raw == null) {
        data = [];
      } else if (Array.isArray(raw)) {
        data = raw;
      } else if (raw.data && Array.isArray(raw.data)) {
        data = raw.data;
      } else if (typeof raw === 'object') {
        if (raw.Name || raw.Amount != null) {
          data = [raw];
        } else {
          data = [];
        }
      }
      // Filter out invalid/empty entries
      data = data.filter((f) => f && typeof f === 'object');
    } catch (_) {
      data = [];
    }

    const totalFd = data.reduce((s, f) => {
      const amt = Number(f.Amount);
      return s + (isNaN(amt) ? 0 : amt);
    }, 0);

    return (
      <View>
        <MetricCard label="FD Total" value={fmt(totalFd)} color={COLORS.green} icon="cash" />
        {data.length === 0 ? (
          <Text style={styles.emptyText}>No FD data</Text>
        ) : (
          <DataTable headers={['Name', 'Amount', 'Interest', 'Maturity']} columnWidths={[100, 100, 80, 100]}
            rows={data.map((f) => {
              try {
                const amt = Number(f.Amount);
                const interest = f.Interest != null ? Number(f.Interest) : null;
                return [
                  safeStr(f.Name, ''),
                  fmt(isNaN(amt) ? 0 : amt),
                  interest != null && !isNaN(interest) ? `${interest.toFixed(2)}%` : '-',
                  safeStr(f["Maturity Date"]),
                ];
              } catch (_) {
                return [safeStr(f.Name, ''), 'RM 0.00', '-', '-'];
              }
            })}
          />
        )}
      </View>
    );
  }

  function renderInsuranceInvTab() {
    const data = normalizeArray(insuranceInv);
    const grouped = {};
    data.forEach((item) => {
      const key = item.Insurer ?? 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return (
      <View>
        {Object.keys(grouped).length === 0 ? (
          <Text style={styles.emptyText}>No insurance investment data</Text>
        ) : (
          Object.entries(grouped).map(([insurer, items]) => {
            const total = items.reduce((s, it) => s + Number(it["Number of Units"] ?? 0) * Number(it["Unit Price"] ?? 0), 0);
            return (
              <View key={insurer} style={{ marginBottom: 12 }}>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.subHeading, { marginBottom: 4 }]}>{insurer}</Text>
                  <Text style={[styles.breakdownValue, { color: COLORS.green }]}>{fmt(total)}</Text>
                </View>
                <DataTable headers={['Fund', 'Units', 'Price', 'Total']} columnWidths={[120, 80, 80, 100]}
                  rows={items.map((it) => {
                    const units = Number(it["Number of Units"] ?? 0);
                    const price = Number(it["Unit Price"] ?? 0);
                    return [it.Fund ?? it.Name ?? '', units.toFixed(4), fmt(price), fmt(units * price)];
                  })} />
              </View>
            );
          })
        )}
      </View>
    );
  }

  function renderInvestmentTab() {
    const data = normalizeArray(investment);
    const totalValue = data.reduce((s, i) => s + Number(i["Current amount"] ?? 0), 0);
    const totalPL = data.reduce((s, i) => s + (Number(i["Current amount"] ?? 0) - Number(i["Original amount"] ?? 0)), 0);
    return (
      <View>
        <View style={styles.metricsRow}>
          <MetricCard label="Total Amount" value={fmt(totalValue)} color={COLORS.green} icon="cash" />
          <MetricCard label="Profit/Loss" value={fmt(totalPL)} color={totalPL >= 0 ? COLORS.green : COLORS.red} icon="analytics" />
        </View>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>No investment data</Text>
        ) : (
          <DataTable headers={['Investment', 'Cost', 'Current', 'P/L', 'Annual %']} columnWidths={[110, 90, 90, 90, 80]}
            rows={data.map((inv) => {
              const cost = Number(inv["Original amount"] ?? 0);
              const current = Number(inv["Current amount"] ?? 0);
              const pl = current - cost;
              const startDate = inv["Start Date"] ? new Date(inv["Start Date"]) : null;
              const yearsHeld = startDate ? (Date.now() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 1;
              const annualReturn = cost > 0 && yearsHeld > 0 ? ((Math.pow(current / cost, 1 / yearsHeld) - 1) * 100) : 0;
              return [inv.Investment ?? inv.Name ?? '', fmt(cost), fmt(current), fmt(pl), pct(annualReturn)];
            })} />
        )}
      </View>
    );
  }

  function renderShareTab() {
    const data = normalizeArray(share);
    const rate = usdRate;

    // Sort: On-hand first, then Sold; within each: USD first, then MYR (#5)
    const sorted = [...data].sort((a, b) => {
      const statusOrder = { 'On-hand': 0, 'Sold': 1 };
      const sa = statusOrder[a.Status] ?? 2;
      const sb = statusOrder[b.Status] ?? 2;
      if (sa !== sb) return sa - sb;
      const ca = (a.Currency || 'RM').toUpperCase() === 'USD' ? 0 : 1;
      const cb = (b.Currency || 'RM').toUpperCase() === 'USD' ? 0 : 1;
      return ca - cb;
    });

    const onHand = sorted.filter((s) => s.Status === 'On-hand');
    const totalAmount = onHand.reduce((sum, s) => {
      const curr = (s.Currency || 'RM').toUpperCase();
      const amt = Number(s["Current Price"] ?? 0) * Number(s.Share ?? 0);
      return sum + (curr === 'USD' ? amt * rate : amt);
    }, 0);
    const totalPL = sorted.reduce((sum, s) => {
      const curr = (s.Currency || 'RM').toUpperCase();
      const r = curr === 'USD' ? rate : 1;
      const amt = Number(s["Current Price"] ?? 0) * Number(s.Share ?? 0) * r;
      const cost = Number(s["Buy Price"] ?? 0) * Number(s.Share ?? 0) * r;
      return sum + (amt - cost);
    }, 0);

    return (
      <View>
        <View style={styles.metricsRow}>
          <MetricCard label="Total (On-hand)" value={fmt(totalAmount)} color={COLORS.green} icon="cash" />
          <MetricCard label="Profit/Loss" value={fmt(totalPL)} color={totalPL >= 0 ? COLORS.green : COLORS.red} icon="analytics" />
        </View>
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No share data</Text>
        ) : (
          <DataTable
            headers={['Stock', 'Status', 'Shares', 'Buy', 'Current', 'Amount', 'P/L']}
            columnWidths={[100, 65, 55, 75, 75, 85, 80]}
            rows={sorted.map((s) => {
              const curr = (s.Currency || 'RM').toUpperCase();
              const r = curr === 'USD' ? rate : 1;
              const shares = Number(s.Share ?? 0);
              const buyPrice = Number(s["Buy Price"] ?? 0);
              const currentPrice = Number(s["Current Price"] ?? 0);
              const amount = shares * currentPrice * r;
              const cost = shares * buyPrice * r;
              const pl = amount - cost;
              return [
                `${s["Stock Name"] ?? s.Name ?? ''}${curr === 'USD' ? ' (USD)' : ''}`,
                s.Status ?? '',
                shares.toString(),
                fmt(buyPrice * r),
                fmt(currentPrice * r),
                fmt(amount),
                fmt(pl),
              ];
            })}
          />
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 8 },
  center: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },

  section: {
    backgroundColor: COLORS.surface, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },

  lockOverlay: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  lockText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  relockBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
    marginTop: 8, paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
  },
  relockText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginLeft: 4 },

  metricsRow: { gap: 8, marginBottom: 12 },
  metricCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, marginBottom: 6,
  },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metricLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },

  subHeading: {
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  breakdownLabel: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  breakdownValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },

  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bankCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 14,
    width: (SCREEN_WIDTH - 72) / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bankName: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  bankBalance: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },

  tableHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 4,
  },
  tableHeaderCell: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', paddingRight: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderRadius: 4 },
  tableCell: { color: COLORS.textPrimary, fontSize: 12, paddingRight: 8 },

  toggleTableBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 10, paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: COLORS.accentDim, borderRadius: 16,
  },
  toggleTableText: { color: COLORS.accent, fontSize: 12, fontWeight: '600', marginLeft: 6 },

  filterLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 2 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 6,
  },
  filterChipActive: { backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accent },
  filterChipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.accent },

  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8,
  },
  tabActive: { backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: COLORS.accent },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLORS.accent },

  emptyText: {
    color: COLORS.textSecondary, fontSize: 13, textAlign: 'center',
    paddingVertical: 20, fontStyle: 'italic',
  },
});

