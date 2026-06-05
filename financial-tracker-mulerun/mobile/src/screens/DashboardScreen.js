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

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  glassBg: 'rgba(22, 33, 62, 0.55)',
  glassBorder: 'rgba(233, 69, 96, 0.18)',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69',
  greenDim: 'rgba(14, 173, 105, 0.15)',
  red: '#e94560',
  redDim: 'rgba(233, 69, 96, 0.15)',
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
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(160, 160, 184, ${opacity})`,
  style: { borderRadius: 12 },
  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255,255,255,0.05)' },
  barPercentage: 0.5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(num) {
  if (num == null || isNaN(num)) return 'RM 0.00';
  const abs = Math.abs(Number(num));
  const sign = Number(num) < 0 ? '-' : '';
  return `${sign}RM ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(num) {
  if (num == null || isNaN(num)) return '0';
  const n = Number(num);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

function pct(num) {
  if (num == null || isNaN(num)) return '0.00%';
  return `${Number(num).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------
function Section({ title, icon, expanded, onToggle, children }) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={20} color={COLORS.accent} style={{ marginRight: 10 }} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Simple Table
// ---------------------------------------------------------------------------
function DataTable({ headers, rows }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
      <View>
        <View style={styles.tableHeaderRow}>
          {headers.map((h, i) => (
            <Text key={i} style={[styles.tableHeaderCell, i === 0 && { minWidth: 100 }]}>{h}</Text>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.tableRow, ri % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
            {row.map((cell, ci) => (
              <Text key={ci} style={[styles.tableCell, ci === 0 && { minWidth: 100 }]}>{cell}</Text>
            ))}
          </View>
        ))}
        {rows.length === 0 && (
          <Text style={styles.emptyText}>No data available</Text>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Investment Tab Selector
// ---------------------------------------------------------------------------
function TabBar({ tabs, active, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.tab, active === t && styles.tabActive]}
          onPress={() => onSelect(t)}
        >
          <Text style={[styles.tabText, active === t && styles.tabTextActive]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Bar Chart Wrapper
// ---------------------------------------------------------------------------
function ChartBar({ labels, dataPoints, yLabel }) {
  if (!dataPoints || dataPoints.length === 0) {
    return <Text style={styles.emptyText}>No chart data</Text>;
  }
  const safeData = dataPoints.map((d) => (isNaN(d) ? 0 : Number(d)));
  const displayLabels = labels.length > 8
    ? labels.map((l, i) => (i % Math.ceil(labels.length / 8) === 0 ? l : ''))
    : labels;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <BarChart
        data={{ labels: displayLabels, datasets: [{ data: safeData }] }}
        width={Math.max(CHART_WIDTH, labels.length * 52)}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={CHART_CONFIG}
        style={{ borderRadius: 12 }}
        fromZero
        showValuesOnTopOfBars={labels.length <= 12}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function DashboardScreen() {
  // Data state
  const [wealth, setWealth] = useState(null);
  const [income, setIncome] = useState(null);
  const [expense, setExpense] = useState(null);
  const [cardSummary, setCardSummary] = useState(null);
  const [commitment, setCommitment] = useState(null);
  const [epf, setEpf] = useState(null);
  const [fd, setFd] = useState(null);
  const [insurance, setInsurance] = useState(null);
  const [insuranceInv, setInsuranceInv] = useState(null);
  const [investment, setInvestment] = useState(null);
  const [share, setShare] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [investTab, setInvestTab] = useState('EPF');

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ------- Data fetching -------
  const fetchAll = useCallback(async () => {
    try {
      const [
        wRes, iRes, eRes, cRes, comRes,
        epfRes, fdRes, insRes, insInvRes, invRes, shrRes,
      ] = await Promise.all([
        api.get('/api/dashboard/wealth').catch(() => ({ data: null })),
        api.get('/api/dashboard/income-summary').catch(() => ({ data: null })),
        api.get('/api/dashboard/expense-summary').catch(() => ({ data: null })),
        api.get('/api/dashboard/card-summary').catch(() => ({ data: null })),
        api.get('/api/dashboard/commitment').catch(() => ({ data: null })),
        api.get('/api/data/epf').catch(() => ({ data: null })),
        api.get('/api/data/fd').catch(() => ({ data: null })),
        api.get('/api/data/insurance').catch(() => ({ data: null })),
        api.get('/api/data/insuranceinvestment').catch(() => ({ data: null })),
        api.get('/api/data/investment').catch(() => ({ data: null })),
        api.get('/api/data/share').catch(() => ({ data: null })),
      ]);
      setWealth(wRes.data);
      setIncome(iRes.data);
      setExpense(eRes.data);
      setCardSummary(cRes.data);
      setCommitment(comRes.data);
      setEpf(epfRes.data);
      setFd(fdRes.data);
      setInsurance(insRes.data);
      setInsuranceInv(insInvRes.data);
      setInvestment(invRes.data);
      setShare(shrRes.data);
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

  // ------- Loading state -------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // ------- Derived data -------
  // PLACEHOLDER: sections rendered below
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
    >
      {/* Section 1: Wealth & Debt */}
      {renderWealthSection()}
      {/* Section 2: Bank Balances */}
      {renderBankSection()}
      {/* Section 3: Income */}
      {renderIncomeSection()}
      {/* Section 4: Expense */}
      {renderExpenseSection()}
      {/* Section 5: Card / eWallet */}
      {renderCardSection()}
      {/* Section 6: Investment Portfolio */}
      {renderInvestmentSection()}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // =========================================================================
  // SECTION RENDERERS
  // =========================================================================

  function renderWealthSection() {
    const totalWealth = wealth?.total_wealth ?? wealth?.totalWealth ?? 0;
    const totalDebt = wealth?.total_debt ?? wealth?.totalDebt ?? 0;
    const netWealth = totalWealth - totalDebt;
    const breakdown = wealth?.breakdown ?? [];
    const debtBreakdown = wealth?.debt_breakdown ?? wealth?.debtBreakdown ?? [];

    const bankTotal = sumCategory(breakdown, 'bank');
    const fdTotal = sumCategory(breakdown, 'fd');
    const epfTotal = sumCategory(breakdown, 'epf');
    const sharesTotal = sumCategory(breakdown, 'share');
    const insInvTotal = sumCategory(breakdown, 'insurance_investment');
    const otherInvTotal = sumCategory(breakdown, 'investment');

    return (
      <Section
        title="Wealth & Debt Summary"
        icon="wallet-outline"
        expanded={!!expanded.wealth}
        onToggle={() => toggle('wealth')}
      >
        <View style={styles.metricsRow}>
          <MetricCard label="Total Wealth" value={fmt(totalWealth)} color={COLORS.green} icon="trending-up" />
          <MetricCard label="Total Debt" value={fmt(totalDebt)} color={COLORS.red} icon="trending-down" />
          <MetricCard label="Net Wealth" value={fmt(netWealth)} color={netWealth >= 0 ? COLORS.green : COLORS.red} icon="analytics" />
        </View>

        <Text style={styles.subHeading}>Wealth Breakdown</Text>
        {[
          ['Bank', bankTotal],
          ['Fixed Deposit', fdTotal],
          ['EPF', epfTotal],
          ['Shares', sharesTotal],
          ['Insurance Investment', insInvTotal],
          ['Other Investment', otherInvTotal],
        ].map(([label, val]) => (
          <View key={label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{label}</Text>
            <Text style={styles.breakdownValue}>{fmt(val)}</Text>
          </View>
        ))}

        {totalDebt > 0 && debtBreakdown.length > 0 && (
          <>
            <Text style={[styles.subHeading, { marginTop: 14 }]}>Debt Breakdown</Text>
            {debtBreakdown.map((item, i) => (
              <View key={i} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.name ?? item.category ?? `Loan ${i + 1}`}</Text>
                <Text style={[styles.breakdownValue, { color: COLORS.red }]}>{fmt(item.amount ?? item.balance ?? 0)}</Text>
              </View>
            ))}
          </>
        )}
      </Section>
    );
  }

  function renderBankSection() {
    const breakdown = wealth?.breakdown ?? [];
    const banks = breakdown.filter(
      (b) => (b.category || '').toLowerCase() === 'bank' || (b.type || '').toLowerCase() === 'bank',
    );

    return (
      <Section
        title="Bank Balances"
        icon="business-outline"
        expanded={!!expanded.banks}
        onToggle={() => toggle('banks')}
      >
        {banks.length === 0 ? (
          <Text style={styles.emptyText}>No bank data available</Text>
        ) : (
          <View style={styles.gridRow}>
            {banks.map((b, i) => (
              <View key={i} style={styles.bankCard}>
                <Text style={styles.bankName} numberOfLines={1}>{b.name ?? b.bank ?? 'Bank'}</Text>
                <Text style={styles.bankBalance}>{fmt(b.amount ?? b.balance ?? 0)}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    );
  }

  function renderIncomeSection() {
    const monthly = income?.monthly ?? income?.monthly_totals ?? [];
    const transactions = income?.transactions ?? income?.details ?? [];
    const labels = monthly.map((m) => m.month ?? m.label ?? '');
    const dataPoints = monthly.map((m) => m.total ?? m.amount ?? 0);

    return (
      <Section
        title="Income Summary"
        icon="arrow-down-circle-outline"
        expanded={!!expanded.income}
        onToggle={() => toggle('income')}
      >
        <ChartBar labels={labels} dataPoints={dataPoints} />
        {transactions.length > 0 && (
          <DataTable
            headers={['Date', 'Description', 'Amount']}
            rows={transactions.map((t) => [
              t.date ?? '',
              t.description ?? t.name ?? '',
              fmt(t.amount ?? 0),
            ])}
          />
        )}
      </Section>
    );
  }

  function renderExpenseSection() {
    const monthly = expense?.monthly ?? expense?.monthly_totals ?? [];
    const transactions = expense?.transactions ?? expense?.details ?? [];
    const labels = monthly.map((m) => m.month ?? m.label ?? '');
    const dataPoints = monthly.map((m) => m.total ?? m.amount ?? 0);

    return (
      <Section
        title="Expense Summary"
        icon="arrow-up-circle-outline"
        expanded={!!expanded.expense}
        onToggle={() => toggle('expense')}
      >
        <ChartBar labels={labels} dataPoints={dataPoints} />
        {transactions.length > 0 && (
          <DataTable
            headers={['Date', 'Description', 'Amount']}
            rows={transactions.map((t) => [
              t.date ?? '',
              t.description ?? t.name ?? '',
              fmt(t.amount ?? 0),
            ])}
          />
        )}
      </Section>
    );
  }

  function renderCardSection() {
    const monthly = cardSummary?.monthly ?? cardSummary?.monthly_totals ?? [];
    const transactions = cardSummary?.transactions ?? cardSummary?.details ?? [];
    const labels = monthly.map((m) => m.month ?? m.label ?? '');
    const dataPoints = monthly.map((m) => m.total ?? m.amount ?? 0);

    return (
      <Section
        title="Card / eWallet Usage"
        icon="card-outline"
        expanded={!!expanded.card}
        onToggle={() => toggle('card')}
      >
        <ChartBar labels={labels} dataPoints={dataPoints} />
        {transactions.length > 0 && (
          <DataTable
            headers={['Date', 'Card', 'Description', 'Amount']}
            rows={transactions.map((t) => [
              t.date ?? '',
              t.card ?? t.card_name ?? '',
              t.description ?? t.name ?? '',
              fmt(t.amount ?? 0),
            ])}
          />
        )}
      </Section>
    );
  }

  function renderInvestmentSection() {
    const tabs = ['EPF', 'FD', 'Insurance Inv', 'Investment', 'Share'];
    return (
      <Section
        title="Investment Portfolio"
        icon="pie-chart-outline"
        expanded={!!expanded.invest}
        onToggle={() => toggle('invest')}
      >
        <TabBar tabs={tabs} active={investTab} onSelect={setInvestTab} />
        {investTab === 'EPF' && renderEpfTab()}
        {investTab === 'FD' && renderFdTab()}
        {investTab === 'Insurance Inv' && renderInsuranceInvTab()}
        {investTab === 'Investment' && renderInvestmentTab()}
        {investTab === 'Share' && renderShareTab()}
      </Section>
    );
  }

  // =========================================================================
  // INVESTMENT SUB-TABS
  // =========================================================================

  function renderEpfTab() {
    const data = Array.isArray(epf) ? epf : epf?.data ? (Array.isArray(epf.data) ? epf.data : [epf.data]) : [epf];
    const total = data.reduce((s, e) => s + Number(e?.amount ?? e?.balance ?? 0), 0);
    return (
      <View>
        <MetricCard label="EPF Total" value={fmt(total)} color={COLORS.green} icon="shield-checkmark" />
        {data.length > 0 && data[0] && (
          <DataTable
            headers={['Account', 'Amount']}
            rows={data.filter(Boolean).map((e) => [
              e.account ?? e.name ?? 'EPF',
              fmt(e.amount ?? e.balance ?? 0),
            ])}
          />
        )}
      </View>
    );
  }

  function renderFdTab() {
    const data = normalizeArray(fd);
    return (
      <View>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>No FD data</Text>
        ) : (
          <DataTable
            headers={['Name', 'Amount', 'Interest', 'Maturity']}
            rows={data.map((f) => [
              f.name ?? f.bank ?? '',
              fmt(f.amount ?? f.principal ?? 0),
              f.interest != null ? pct(f.interest) : (f.rate != null ? pct(f.rate) : '-'),
              f.maturity_date ?? f.maturityDate ?? f.maturity ?? '-',
            ])}
          />
        )}
      </View>
    );
  }

  function renderInsuranceInvTab() {
    const data = normalizeArray(insuranceInv);
    // Group by insurer
    const grouped = {};
    data.forEach((item) => {
      const key = item.insurer ?? item.company ?? item.name ?? 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    return (
      <View>
        {Object.keys(grouped).length === 0 ? (
          <Text style={styles.emptyText}>No insurance investment data</Text>
        ) : (
          Object.entries(grouped).map(([insurer, items]) => {
            const total = items.reduce((s, it) => {
              const units = Number(it.units ?? it.unit ?? 0);
              const price = Number(it.price ?? it.nav ?? it.unit_price ?? 0);
              return s + units * price;
            }, 0);
            return (
              <View key={insurer} style={{ marginBottom: 12 }}>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.subHeading, { marginBottom: 4 }]}>{insurer}</Text>
                  <Text style={[styles.breakdownValue, { color: COLORS.green }]}>{fmt(total)}</Text>
                </View>
                <DataTable
                  headers={['Fund', 'Units', 'Price', 'Total']}
                  rows={items.map((it) => {
                    const units = Number(it.units ?? it.unit ?? 0);
                    const price = Number(it.price ?? it.nav ?? it.unit_price ?? 0);
                    return [
                      it.fund ?? it.fund_name ?? it.name ?? '',
                      units.toFixed(4),
                      fmt(price),
                      fmt(units * price),
                    ];
                  })}
                />
              </View>
            );
          })
        )}
      </View>
    );
  }

  function renderInvestmentTab() {
    const data = normalizeArray(investment);
    return (
      <View>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>No investment data</Text>
        ) : (
          <DataTable
            headers={['Name', 'Cost', 'Value', 'P/L', 'Annual %']}
            rows={data.map((inv) => {
              const cost = Number(inv.cost ?? inv.invested ?? 0);
              const value = Number(inv.value ?? inv.current_value ?? inv.currentValue ?? 0);
              const pl = value - cost;
              const years = Number(inv.years ?? inv.duration ?? 1) || 1;
              const annualReturn = cost > 0 ? ((Math.pow(value / cost, 1 / years) - 1) * 100) : 0;
              return [
                inv.name ?? '',
                fmt(cost),
                fmt(value),
                fmt(pl),
                pct(annualReturn),
              ];
            })}
          />
        )}
      </View>
    );
  }

  function renderShareTab() {
    const data = normalizeArray(share);
    return (
      <View>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>No share data</Text>
        ) : (
          <DataTable
            headers={['Stock', 'Units', 'Avg Cost', 'Price', 'Amount', 'P/L']}
            rows={data.map((s) => {
              const units = Number(s.units ?? s.quantity ?? s.lot ?? 0);
              const avgCost = Number(s.avg_cost ?? s.averageCost ?? s.average_cost ?? s.cost ?? 0);
              const price = Number(s.price ?? s.current_price ?? s.currentPrice ?? 0);
              const isUsd = (s.currency ?? '').toUpperCase() === 'USD';
              const fxRate = isUsd ? Number(s.fx_rate ?? s.fxRate ?? s.exchange_rate ?? 4.5) : 1;
              const amount = units * price * fxRate;
              const costTotal = units * avgCost * fxRate;
              const pl = amount - costTotal;
              const currLabel = isUsd ? ' (USD)' : '';
              return [
                (s.stock ?? s.name ?? s.ticker ?? '') + currLabel,
                units.toString(),
                fmt(avgCost * fxRate),
                fmt(price * fxRate),
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

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function normalizeArray(d) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) return [d];
  return [];
}

function sumCategory(breakdown, cat) {
  return breakdown
    .filter((b) => {
      const c = (b.category || b.type || '').toLowerCase();
      return c.includes(cat.toLowerCase());
    })
    .reduce((s, b) => s + Number(b.amount ?? b.balance ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },

  // Section
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Metrics
  metricsRow: {
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },

  // Breakdown
  subHeading: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  breakdownLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  breakdownValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Bank grid
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 14,
    width: (SCREEN_WIDTH - 72) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bankName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  bankBalance: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // Table
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
    minWidth: 80,
    paddingRight: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderRadius: 4,
  },
  tableCell: {
    color: COLORS.textPrimary,
    fontSize: 12,
    minWidth: 80,
    paddingRight: 12,
  },

  // Tabs
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: COLORS.accentDim,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.accent,
  },

  // Misc
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});
