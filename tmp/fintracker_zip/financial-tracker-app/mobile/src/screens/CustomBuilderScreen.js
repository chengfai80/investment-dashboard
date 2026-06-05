import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart } from 'react-native-chart-kit';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = 'custom_pages';

const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  inputBg: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69',
  red: '#e74c3c',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

const USER_COLLECTIONS = {
  'chengfai@hotmail.com': [
    'banks', 'cardusage', 'carloan', 'category', 'commitment', 'epf',
    'expensesummary', 'fd', 'houseloan', 'houseloaninfo', 'insurance',
    'insuranceinvestment', 'investment', 'share', 'sspn',
  ],
  'engseeaw@gmail.com': [
    'banks', 'cardusage', 'category', 'commitment', 'epf',
    'expensesummary', 'fd', 'insurance', 'insuranceinvestment', 'investment',
  ],
};

const COLLECTION_FIELDS = {
  banks: ['Date', 'Name', 'Type', 'Description', 'Expense Category', 'Amount'],
  cardusage: ['Date', 'Name', 'Type', 'Description', 'Expense Category', 'Amount'],
  carloan: ['Date', 'Name', 'Type', 'Amount'],
  category: ['Category', 'Type'],
  commitment: ['Month', 'Name', 'Type', 'Description', 'Amount'],
  epf: ['Account Type', 'Amount', 'Name', 'Type'],
  expensesummary: ['Category', 'Amount'],
  fd: ['Date', 'Name', 'Type', 'Interest', 'Term', 'Amount', 'Maturity Date'],
  houseloan: ['Date', 'Description', 'Amount'],
  houseloaninfo: ['Description', 'Info'],
  insurance: [
    'Insurer', 'Company', 'Date', 'Premium End Date', 'Coverage End Date',
    'Policy No', 'Annual Premium', 'Death', 'TPD', 'Critical Illness (45)',
    'Early CI Payout', 'Early Cancer', 'Personal Accident', 'Medical', 'Nominee',
  ],
  insuranceinvestment: [
    'Insurer', 'Name', 'Type', 'Policy Number', 'Fund', 'Number of Units', 'Unit Price',
  ],
  investment: ['Type', 'Name', 'Investment', 'Original amount', 'Current amount', 'Start Date'],
  share: ['Type', 'Name', 'Currency', 'Stock Name', 'Buy Price', 'Current Price', 'Share', 'Status'],
  sspn: ['Name', 'Type', 'Date', 'Activity', 'Amount'],
};

const GRAPH_TYPES = ['Bar', 'Line', 'Pie'];
const AGGREGATIONS = ['Raw', 'Monthly'];

// --- Helpers ---

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatValue(val) {
  if (val === null || val === undefined) return '';
  // Firestore timestamp object
  if (val && typeof val === 'object' && val._seconds != null) {
    return new Date(val._seconds * 1000).toISOString().split('T')[0];
  }
  if (typeof val === 'number') return val.toFixed(2);
  // ISO date string
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  return String(val);
}

// Extract date string from a value (handles Firestore timestamps, ISO strings, etc.)
function extractDateStr(val) {
  if (!val) return null;
  if (typeof val === 'object' && val._seconds != null) {
    return new Date(val._seconds * 1000).toISOString().split('T')[0];
  }
  const s = String(val);
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try parsing as date
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function sortByFirstCol(data, fields) {
  if (!data || !data.length || !fields || !fields.length) return data;
  const key = fields[0];
  return [...data].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return vb - va;
    return String(vb).localeCompare(String(va));
  });
}

function applyFilter(data, field, value) {
  if (!field || !value) return data;
  const lowerVal = value.toLowerCase().trim();
  return data.filter(
    (row) => String(row[field] ?? '').toLowerCase().includes(lowerVal)
  );
}

function applyDateFilter(data, year, month) {
  let result = data;
  if (year) {
    result = result.filter((row) => {
      const d = extractDateStr(row.Date || row.date || row['Maturity Date'] || row.Month);
      if (!d) return false;
      return d.startsWith(year);
    });
  }
  if (month) {
    result = result.filter((row) => {
      const d = extractDateStr(row.Date || row.date || row['Maturity Date'] || row.Month);
      if (!d) return false;
      return d.slice(5, 7) === month;
    });
  }
  return result;
}

function aggregateMonthly(data, xField, yField) {
  const map = {};
  data.forEach((row) => {
    const d = extractDateStr(row[xField]);
    if (!d) return;
    const key = d.slice(0, 7); // YYYY-MM
    const val = parseFloat(row[yField]) || 0;
    map[key] = (map[key] || 0) + val;
  });
  const keys = Object.keys(map).sort();
  return { labels: keys, values: keys.map((k) => map[k]) };
}

// ============================================================
// Main Component
// ============================================================

export default function CustomBuilderScreen() {
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const collections = USER_COLLECTIONS[userEmail] || [];

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'create'

  // --- My Pages state ---
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);

  // --- View page state ---
  const [viewingPage, setViewingPage] = useState(null);
  const [pageData, setPageData] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // --- Create form state ---
  const [createType, setCreateType] = useState('table'); // 'table' | 'graph'
  const [selectedCollection, setSelectedCollection] = useState('');
  const [tableType, setTableType] = useState('filter'); // 'filter' | 'builder'
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [graphType, setGraphType] = useState('Bar');
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const [graphFilterField, setGraphFilterField] = useState('');
  const [graphFilterValue, setGraphFilterValue] = useState('');
  const [aggregation, setAggregation] = useState('Raw');
  const [creating, setCreating] = useState(false);

  // --- Available fields for selected collection ---
  const currentFields = selectedCollection ? (COLLECTION_FIELDS[selectedCollection] || []) : [];
  const hasDateField = currentFields.some((f) => f.toLowerCase().includes('date') || f === 'Month');
  const numericFields = currentFields.filter((f) =>
    ['Amount', 'Interest', 'Annual Premium', 'Death', 'TPD', 'Original amount',
     'Current amount', 'Buy Price', 'Current Price', 'Share', 'Number of Units',
     'Unit Price', 'Term'].includes(f)
  );

  // --- Load / save pages ---
  const loadPages = useCallback(async () => {
    setPagesLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setPages(raw ? JSON.parse(raw) : []);
    } catch {
      setPages([]);
    } finally {
      setPagesLoading(false);
    }
  }, []);

  const savePagesToStorage = useCallback(async (list) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setPages(list);
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Reset form when collection changes
  useEffect(() => {
    setFilterField('');
    setFilterValue('');
    setSelectedFields([]);
    setXField('');
    setYField(numericFields[0] || '');
    setGraphFilterField('');
    setGraphFilterValue('');
    setAggregation('Raw');
  }, [selectedCollection]);

  // --- Actions ---

  const deletePage = useCallback(
    (id) => {
      Alert.alert('Delete Page', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = pages.filter((p) => p.id !== id);
            await savePagesToStorage(updated);
          },
        },
      ]);
    },
    [pages, savePagesToStorage]
  );

  const createPage = useCallback(async () => {
    if (!selectedCollection) {
      Alert.alert('Error', 'Select a collection first.');
      return;
    }
    setCreating(true);
    try {
      let config = { collection: selectedCollection };
      let name = '';

      if (createType === 'table') {
        if (tableType === 'filter') {
          if (!filterField || !filterValue) {
            Alert.alert('Error', 'Provide filter field and value.');
            setCreating(false);
            return;
          }
          config = { ...config, tableType: 'filter', field: filterField, value: filterValue };
          name = `page_${selectedCollection}_filter_${filterField}_${filterValue}`;
        } else {
          if (!selectedFields.length) {
            Alert.alert('Error', 'Select at least one field.');
            setCreating(false);
            return;
          }
          config = { ...config, tableType: 'builder', fields: selectedFields };
          name = `page_${selectedCollection}_builder_${selectedFields.length}fields`;
        }
      } else {
        if (!xField || !yField) {
          Alert.alert('Error', 'Select X and Y axis fields.');
          setCreating(false);
          return;
        }
        config = {
          ...config,
          graphType,
          xField,
          yField,
          filterField: graphFilterField,
          filterValue: graphFilterValue,
          aggregation,
        };
        name = `graph_${selectedCollection}_${graphType}_${xField}_${yField}`;
      }

      const entry = { id: generateId(), name, type: createType, config };
      const updated = [...pages, entry];
      await savePagesToStorage(updated);
      Alert.alert('Success', 'Custom page created!');
      setActiveTab('my');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  }, [
    createType, selectedCollection, tableType, filterField, filterValue,
    selectedFields, graphType, xField, yField, graphFilterField,
    graphFilterValue, aggregation, pages, savePagesToStorage,
  ]);

  const fetchPageData = useCallback(async (page) => {
    setViewingPage(page);
    setPageLoading(true);
    setYearFilter('');
    setMonthFilter('');
    try {
      const res = await api.get(`/api/data/${page.config.collection}`);
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? [];
      setPageData(list);
    } catch (e) {
      Alert.alert('Error', 'Failed to load data.');
      setPageData([]);
    } finally {
      setPageLoading(false);
    }
  }, []);

  // --- Chip helper ---
  const renderChip = (label, selected, onPress, small) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.chip,
        selected && styles.chipActive,
        small && styles.chipSmall,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive, small && { fontSize: 12 }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // RENDER: My Pages Tab
  // ============================================================

  const renderMyPagesTab = () => {
    if (pagesLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      );
    }
    if (!pages.length) {
      return (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No custom pages yet. Create one!</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={pages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.pageCard}
            onPress={() => fetchPageData(item)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.pageCardTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.pageCardSub}>
                {item.type === 'table' ? 'Table' : 'Graph'} · {item.config.collection}
                {item.config.field ? ` · ${item.config.field}=${item.config.value}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deletePage(item.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="trash-outline" size={22} color={COLORS.red} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    );
  };

  // ============================================================
  // RENDER: Create Tab
  // ============================================================

  const renderCollectionChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      {collections.map((c) => renderChip(c, c === selectedCollection, () => setSelectedCollection(c), true))}
    </ScrollView>
  );

  const renderTableForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.label}>Table Type</Text>
      <View style={styles.chipRow}>
        {renderChip('Filtered Table', tableType === 'filter', () => setTableType('filter'))}
        {renderChip('Field Selector', tableType === 'builder', () => setTableType('builder'))}
      </View>

      {tableType === 'filter' ? (
        <>
          <Text style={styles.label}>Filter Field</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {currentFields.map((f) => renderChip(f, f === filterField, () => setFilterField(f), true))}
          </ScrollView>
          <Text style={styles.label}>Filter Value</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter filter value..."
            placeholderTextColor={COLORS.textSecondary}
            value={filterValue}
            onChangeText={setFilterValue}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Select Fields</Text>
          <View style={styles.checkboxGrid}>
            {currentFields.map((f) => {
              const checked = selectedFields.includes(f);
              return (
                <TouchableOpacity
                  key={f}
                  style={styles.checkboxRow}
                  onPress={() => {
                    setSelectedFields((prev) =>
                      checked ? prev.filter((x) => x !== f) : [...prev, f]
                    );
                  }}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={checked ? COLORS.accent : COLORS.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );

  const renderGraphForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.label}>Filter (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <TouchableOpacity
          style={[styles.chip, styles.chipSmall, !graphFilterField && styles.chipActive]}
          onPress={() => { setGraphFilterField(''); setGraphFilterValue(''); }}
        >
          <Text style={[styles.chipText, !graphFilterField && styles.chipTextActive, { fontSize: 12 }]}>None</Text>
        </TouchableOpacity>
        {currentFields.map((f) => renderChip(f, f === graphFilterField, () => setGraphFilterField(f), true))}
      </ScrollView>
      {graphFilterField ? (
        <TextInput
          style={styles.input}
          placeholder="Filter value..."
          placeholderTextColor={COLORS.textSecondary}
          value={graphFilterValue}
          onChangeText={setGraphFilterValue}
        />
      ) : null}

      <Text style={styles.label}>X-Axis Field</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {currentFields.map((f) => renderChip(f, f === xField, () => setXField(f), true))}
      </ScrollView>

      <Text style={styles.label}>Y-Axis Field</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {currentFields.map((f) => renderChip(f, f === yField, () => setYField(f), true))}
      </ScrollView>

      <Text style={styles.label}>Graph Type</Text>
      <View style={styles.chipRow}>
        {GRAPH_TYPES.map((g) => renderChip(g, g === graphType, () => setGraphType(g)))}
      </View>

      {hasDateField && (graphType === 'Bar' || graphType === 'Line') ? (
        <>
          <Text style={styles.label}>Aggregation</Text>
          <View style={styles.chipRow}>
            {AGGREGATIONS.map((a) => renderChip(a, a === aggregation, () => setAggregation(a)))}
          </View>
        </>
      ) : null}
    </View>
  );

  const renderCreateTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {renderChip('Custom Table', createType === 'table', () => setCreateType('table'))}
        {renderChip('Custom Graph', createType === 'graph', () => setCreateType('graph'))}
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Collection</Text>
      {renderCollectionChips()}

      {selectedCollection ? (
        createType === 'table' ? renderTableForm() : renderGraphForm()
      ) : null}

      {selectedCollection ? (
        <TouchableOpacity
          style={[styles.createBtn, creating && { opacity: 0.6 }]}
          onPress={createPage}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );

  // ============================================================
  // RENDER: View Custom Page (table or graph)
  // ============================================================

  const renderViewPage = () => {
    if (!viewingPage) return null;
    const cfg = viewingPage.config;
    const fields = cfg.tableType === 'builder'
      ? cfg.fields
      : COLLECTION_FIELDS[cfg.collection] || [];

    let data = [...pageData];

    // Apply config filter
    if (cfg.field && cfg.value) data = applyFilter(data, cfg.field, cfg.value);
    if (cfg.filterField && cfg.filterValue) data = applyFilter(data, cfg.filterField, cfg.filterValue);

    // Apply date filter
    data = applyDateFilter(data, yearFilter, monthFilter);

    // Determine available years
    const years = [...new Set(pageData.map((r) => {
      const d = extractDateStr(r.Date || r.date || r['Maturity Date'] || r.Month);
      return d ? d.slice(0, 4) : null;
    }).filter(Boolean))].sort().reverse();

    const months = [
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11', '12',
    ];

    // Sort
    data = sortByFirstCol(data, fields);

    // -- Render table --
    if (viewingPage.type === 'table') {
      return (
        <View style={{ flex: 1 }}>
          <View style={styles.viewHeader}>
            <TouchableOpacity onPress={() => setViewingPage(null)}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.viewTitle} numberOfLines={1}>{viewingPage.name}</Text>
          </View>

          {hasDateField || years.length ? (
            <View style={styles.dateFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {renderChip('All Years', !yearFilter, () => setYearFilter(''), true)}
                {years.map((y) => renderChip(y, y === yearFilter, () => setYearFilter(y), true))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {renderChip('All Months', !monthFilter, () => setMonthFilter(''), true)}
                {months.map((m) => renderChip(m, m === monthFilter, () => setMonthFilter(m), true))}
              </ScrollView>
            </View>
          ) : null}

          {pageLoading ? (
            <View style={styles.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>
          ) : (
            <View style={{ flex: 1, maxHeight: 400, marginHorizontal: 16, marginTop: 8 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 }}>{data.length} records</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeaderRow}>
                    {fields.map((f) => (
                      <View key={f} style={styles.tableHeaderCell}>
                        <Text style={styles.tableHeaderText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 340 }}>
                    {data.map((item, ri) => (
                      <View key={ri} style={[styles.tableRow, ri % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
                        {fields.map((f) => (
                          <View key={f} style={styles.tableCell}>
                            <Text style={styles.tableCellText} numberOfLines={2}>
                              {formatValue(item[f])}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    {data.length === 0 && (
                      <View style={styles.center}><Text style={styles.emptyText}>No data found.</Text></View>
                    )}
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      );
    }

    // -- Render graph --
    let labels = [];
    let values = [];

    if (cfg.aggregation === 'Monthly') {
      const agg = aggregateMonthly(data, cfg.xField, cfg.yField);
      labels = agg.labels;
      values = agg.values;
    } else {
      data.forEach((row) => {
        labels.push(formatValue(row[cfg.xField]).slice(0, 10));
        values.push(parseFloat(row[cfg.yField]) || 0);
      });
    }

    // Limit labels for readability
    const MAX_LABELS = 15;
    if (labels.length > MAX_LABELS) {
      labels = labels.slice(0, MAX_LABELS);
      values = values.slice(0, MAX_LABELS);
    }

    const chartData = {
      labels,
      datasets: [{ data: values.length ? values : [0] }],
    };

    const chartConfig = {
      backgroundColor: COLORS.surface,
      backgroundGradientFrom: COLORS.surface,
      backgroundGradientTo: COLORS.background,
      color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
      labelColor: () => COLORS.textSecondary,
      decimalPlaces: 0,
      propsForLabels: { fontSize: 9 },
    };

    // Pie chart fallback: simple colored bars proportional to value
    const renderPieAsBars = () => {
      const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
      const pieColors = ['#e94560', '#0ead69', '#3498db', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];
      return (
        <View style={{ padding: 16 }}>
          {labels.map((l, i) => {
            const pct = (Math.abs(values[i]) / total) * 100;
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 2 }}>
                  {l}: {values[i].toFixed(2)} ({pct.toFixed(1)}%)
                </Text>
                <View style={{ height: 14, borderRadius: 7, backgroundColor: COLORS.inputBg, overflow: 'hidden' }}>
                  <View style={{ height: 14, width: `${pct}%`, backgroundColor: pieColors[i % pieColors.length], borderRadius: 7 }} />
                </View>
              </View>
            );
          })}
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.viewHeader}>
          <TouchableOpacity onPress={() => setViewingPage(null)}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.viewTitle} numberOfLines={1}>{viewingPage.name}</Text>
        </View>

        {years.length ? (
          <View style={styles.dateFilterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {renderChip('All Years', !yearFilter, () => setYearFilter(''), true)}
              {years.map((y) => renderChip(y, y === yearFilter, () => setYearFilter(y), true))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {renderChip('All Months', !monthFilter, () => setMonthFilter(''), true)}
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m) =>
                renderChip(m, m === monthFilter, () => setMonthFilter(m), true)
              )}
            </ScrollView>
          </View>
        ) : null}

        {pageLoading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={styles.graphTitle}>
              {cfg.graphType} · {cfg.xField} vs {cfg.yField}
            </Text>
            {cfg.graphType === 'Pie' ? renderPieAsBars() : (
              <ScrollView horizontal>
                <BarChart
                  data={chartData}
                  width={Math.max(SCREEN_WIDTH - 32, labels.length * 60)}
                  height={260}
                  chartConfig={chartConfig}
                  style={{ borderRadius: 12, marginTop: 8 }}
                  fromZero
                  showValuesOnTopOfBars
                  verticalLabelRotation={45}
                />
              </ScrollView>
            )}
            <Text style={styles.recordCount}>{data.length} records</Text>

            {/* Data table below graph */}
            <View style={{ maxHeight: 300, marginTop: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeaderRow}>
                    {fields.map((f) => (
                      <View key={f} style={styles.tableHeaderCell}>
                        <Text style={styles.tableHeaderText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 264 }}>
                    {data.map((item, ri) => (
                      <View key={ri} style={[styles.tableRow, ri % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
                        {fields.map((f) => (
                          <View key={f} style={styles.tableCell}>
                            <Text style={styles.tableCellText} numberOfLines={2}>
                              {formatValue(item[f])}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    {data.length === 0 && (
                      <View style={styles.center}><Text style={styles.emptyText}>No data found.</Text></View>
                    )}
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (viewingPage) {
    return <View style={styles.container}>{renderViewPage()}</View>;
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Ionicons
            name="documents-outline"
            size={18}
            color={activeTab === 'my' ? COLORS.accent : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>My Pages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.tabActive]}
          onPress={() => setActiveTab('create')}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={activeTab === 'create' ? COLORS.accent : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>Create New</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'my' ? renderMyPagesTab() : renderCreateTab()}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  // -- Chips --
  chipScroll: {
    marginVertical: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    marginRight: 8,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: COLORS.accentDim,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  // -- Labels & inputs --
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    color: COLORS.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  // -- Form --
  formSection: {
    marginTop: 8,
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    paddingVertical: 6,
    gap: 8,
  },
  checkboxLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  createBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // -- Page cards --
  pageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pageCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  pageCardSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  // -- View page --
  viewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 12,
  },
  viewTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  dateFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // -- Table --
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBg,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableHeaderCell: {
    width: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  tableCell: {
    width: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableCellText: {
    color: COLORS.textPrimary,
    fontSize: 12,
  },
  // -- Graph --
  graphTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});
