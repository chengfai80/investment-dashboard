import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  inputBg: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69',
  red: '#e94560',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

// ---------------------------------------------------------------------------
// Per-user collections
// ---------------------------------------------------------------------------
const USER_COLLECTIONS = {
  'chengfai@hotmail.com': [
    'banks', 'cardusage', 'carloan', 'category', 'commitment', 'epf',
    'expensesummary', 'fd', 'houseloan', 'houseloaninfo', 'insurance',
    'insuranceinvestment', 'investment', 'share', 'sspn',
  ],
  'engseeaw@gmail.com': [
    'banks', 'cardusage', 'category', 'commitment', 'epf',
    'expensesummary', 'fd', 'insurance', 'insuranceinvestment',
  ],
};

const DEFAULT_COLLECTIONS = [
  'banks', 'cardusage', 'category', 'commitment', 'epf',
  'expensesummary', 'fd', 'insurance', 'insuranceinvestment',
];

// ---------------------------------------------------------------------------
// Collection field schemas
// ---------------------------------------------------------------------------
const COMMON_FIELDS = [
  { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
  { key: 'name', label: 'Name', placeholder: 'Enter name', keyboard: 'default' },
  { key: 'type', label: 'Type', placeholder: 'Enter type', keyboard: 'default' },
  { key: 'description', label: 'Description', placeholder: 'Enter description', keyboard: 'default' },
  { key: 'expenseCategory', label: 'Expense Category', placeholder: 'Enter category', keyboard: 'default' },
  { key: 'amount', label: 'Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
];

function getFieldsForCollection(collection) {
  if (collection === 'banks' || collection === 'cardusage') {
    return COMMON_FIELDS;
  }
  // Dynamic fields based on collection name
  const schemas = {
    carloan: [
      { key: 'name', label: 'Name', placeholder: 'Loan name', keyboard: 'default' },
      { key: 'bank', label: 'Bank', placeholder: 'Bank name', keyboard: 'default' },
      { key: 'amount', label: 'Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'monthlyPayment', label: 'Monthly Payment', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'interestRate', label: 'Interest Rate (%)', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'startDate', label: 'Start Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
      { key: 'endDate', label: 'End Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
    ],
    category: [
      { key: 'name', label: 'Category Name', placeholder: 'Enter category name', keyboard: 'default' },
      { key: 'type', label: 'Type', placeholder: 'income / expense', keyboard: 'default' },
    ],
    commitment: [
      { key: 'name', label: 'Name', placeholder: 'Commitment name', keyboard: 'default' },
      { key: 'amount', label: 'Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'frequency', label: 'Frequency', placeholder: 'monthly / yearly', keyboard: 'default' },
      { key: 'dueDate', label: 'Due Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
      { key: 'category', label: 'Category', placeholder: 'Enter category', keyboard: 'default' },
    ],
    epf: [
      { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
      { key: 'employee', label: 'Employee Contribution', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'employer', label: 'Employer Contribution', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'totalBalance', label: 'Total Balance', placeholder: '0.00', keyboard: 'decimal-pad' },
    ],
    expensesummary: [
      { key: 'month', label: 'Month', placeholder: 'YYYY-MM', keyboard: 'default' },
      { key: 'totalIncome', label: 'Total Income', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'totalExpense', label: 'Total Expense', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'savings', label: 'Savings', placeholder: '0.00', keyboard: 'decimal-pad' },
    ],
    fd: [
      { key: 'bank', label: 'Bank', placeholder: 'Bank name', keyboard: 'default' },
      { key: 'amount', label: 'Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'interestRate', label: 'Interest Rate (%)', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'startDate', label: 'Start Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
      { key: 'maturityDate', label: 'Maturity Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
      { key: 'tenure', label: 'Tenure (months)', placeholder: '12', keyboard: 'numeric' },
    ],
    houseloan: [
      { key: 'name', label: 'Property Name', placeholder: 'Property name', keyboard: 'default' },
      { key: 'bank', label: 'Bank', placeholder: 'Bank name', keyboard: 'default' },
      { key: 'amount', label: 'Loan Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'monthlyPayment', label: 'Monthly Payment', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'interestRate', label: 'Interest Rate (%)', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'balance', label: 'Outstanding Balance', placeholder: '0.00', keyboard: 'decimal-pad' },
    ],
    houseloaninfo: [
      { key: 'name', label: 'Property Name', placeholder: 'Property name', keyboard: 'default' },
      { key: 'purchasePrice', label: 'Purchase Price', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'currentValue', label: 'Current Value', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'loanAmount', label: 'Loan Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'tenure', label: 'Tenure (years)', placeholder: '30', keyboard: 'numeric' },
    ],
    insurance: [
      { key: 'name', label: 'Policy Name', placeholder: 'Policy name', keyboard: 'default' },
      { key: 'provider', label: 'Provider', placeholder: 'Provider name', keyboard: 'default' },
      { key: 'type', label: 'Type', placeholder: 'life / medical / motor', keyboard: 'default' },
      { key: 'premium', label: 'Premium', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'coverage', label: 'Coverage', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'dueDate', label: 'Due Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
    ],
    insuranceinvestment: [
      { key: 'name', label: 'Plan Name', placeholder: 'Plan name', keyboard: 'default' },
      { key: 'provider', label: 'Provider', placeholder: 'Provider name', keyboard: 'default' },
      { key: 'premium', label: 'Premium', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'currentValue', label: 'Current Value', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'startDate', label: 'Start Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
    ],
    investment: [
      { key: 'name', label: 'Investment Name', placeholder: 'Investment name', keyboard: 'default' },
      { key: 'type', label: 'Type', placeholder: 'unit trust / stocks / crypto', keyboard: 'default' },
      { key: 'amount', label: 'Amount Invested', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'currentValue', label: 'Current Value', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'platform', label: 'Platform', placeholder: 'Platform name', keyboard: 'default' },
    ],
    share: [
      { key: 'name', label: 'Stock Name', placeholder: 'Stock name', keyboard: 'default' },
      { key: 'code', label: 'Stock Code', placeholder: 'e.g. 1155', keyboard: 'default' },
      { key: 'units', label: 'Units', placeholder: '0', keyboard: 'numeric' },
      { key: 'buyPrice', label: 'Buy Price', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'currentPrice', label: 'Current Price', placeholder: '0.00', keyboard: 'decimal-pad' },
    ],
    sspn: [
      { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
      { key: 'amount', label: 'Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'totalBalance', label: 'Total Balance', placeholder: '0.00', keyboard: 'decimal-pad' },
      { key: 'type', label: 'Type', placeholder: 'deposit / withdrawal', keyboard: 'default' },
    ],
  };
  return schemas[collection] || [
    { key: 'name', label: 'Name', placeholder: 'Enter name', keyboard: 'default' },
    { key: 'description', label: 'Description', placeholder: 'Enter description', keyboard: 'default' },
    { key: 'amount', label: 'Amount', placeholder: '0.00', keyboard: 'decimal-pad' },
    { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD', keyboard: 'default' },
  ];
}

function fmt(num) {
  if (num == null || isNaN(num)) return 'RM 0.00';
  const abs = Math.abs(Number(num));
  const sign = Number(num) < 0 ? '-' : '';
  return `${sign}RM ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TAB_NAMES = ['Add', 'Edit', 'Delete'];

// ---------------------------------------------------------------------------
// Collection Chips
// ---------------------------------------------------------------------------
function CollectionChips({ collections, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
      {collections.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.chip, selected === c && styles.chipActive]}
          onPress={() => onSelect(c)}
        >
          <Text style={[styles.chipText, selected === c && styles.chipTextActive]}>
            {c}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Tab Bar
// ---------------------------------------------------------------------------
function TabBar({ active, onSelect }) {
  return (
    <View style={styles.tabBar}>
      {TAB_NAMES.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tabItem, active === tab && styles.tabItemActive]}
          onPress={() => onSelect(tab)}
        >
          <Text style={[styles.tabLabel, active === tab && styles.tabLabelActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function TransactionScreen() {
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const collections = USER_COLLECTIONS[userEmail] || DEFAULT_COLLECTIONS;

  const [activeTab, setActiveTab] = useState('Add');
  const [collection, setCollection] = useState(collections[0]);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Add form state
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editRecord, setEditRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Reset form when collection changes
  useEffect(() => {
    setFormData({});
  }, [collection]);

  // Fetch records when collection or tab changes
  useEffect(() => {
    if (activeTab !== 'Add') {
      fetchRecords();
    }
  }, [collection, activeTab]);

  async function fetchRecords() {
    setLoadingRecords(true);
    try {
      const { data } = await api.get(`/api/data/${collection}`);
      const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
      setRecords(list);
    } catch (_) {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }

  // --- ADD ---
  function updateFormField(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd() {
    const fields = getFieldsForCollection(collection);
    const hasData = fields.some((f) => formData[f.key] && formData[f.key].trim());
    if (!hasData) {
      Alert.alert('Validation', 'Please fill in at least one field.');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        const val = formData[f.key];
        if (val && val.trim()) {
          payload[f.key] = f.keyboard === 'decimal-pad' || f.keyboard === 'numeric'
            ? Number(val) : val.trim();
        }
      });
      await api.post(`/api/data/${collection}`, payload);
      Alert.alert('Success', 'Record added successfully.');
      setFormData({});
    } catch (err) {
      Alert.alert('Error', 'Failed to add record.');
    } finally {
      setSaving(false);
    }
  }

  // --- EDIT ---
  function openEditModal(record) {
    setEditRecord(record);
    const fields = getFieldsForCollection(collection);
    const data = {};
    fields.forEach((f) => {
      data[f.key] = record[f.key] != null ? String(record[f.key]) : '';
    });
    setEditFormData(data);
  }

  function updateEditField(key, value) {
    setEditFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleEdit() {
    if (!editRecord) return;
    setEditSaving(true);
    try {
      const id = editRecord.id ?? editRecord._id;
      const fields = getFieldsForCollection(collection);
      const payload = {};
      fields.forEach((f) => {
        const val = editFormData[f.key];
        if (val && val.trim()) {
          payload[f.key] = f.keyboard === 'decimal-pad' || f.keyboard === 'numeric'
            ? Number(val) : val.trim();
        }
      });
      await api.put(`/api/data/${collection}/${id}`, payload);
      setEditRecord(null);
      await fetchRecords();
      Alert.alert('Success', 'Record updated successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to update record.');
    } finally {
      setEditSaving(false);
    }
  }

  // --- DELETE ---
  function confirmDelete(record) {
    const id = record.id ?? record._id;
    const label = record.name || record.description || record.category || 'this record';
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => doDelete(id),
        },
      ],
    );
  }

  async function doDelete(id) {
    try {
      await api.delete(`/api/data/${collection}/${id}`);
      await fetchRecords();
      Alert.alert('Success', 'Record deleted successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to delete record.');
    }
  }

  // --- Preview fields for list items ---
  function getPreviewFields(item) {
    const fields = getFieldsForCollection(collection);
    const preview = [];
    const showKeys = fields.slice(0, 3);
    showKeys.forEach((f) => {
      if (item[f.key] != null && String(item[f.key]).trim()) {
        preview.push({ label: f.label, value: String(item[f.key]) });
      }
    });
    if (preview.length === 0) {
      preview.push({ label: 'ID', value: String(item.id ?? item._id ?? '---') });
    }
    return preview;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Bar */}
      <TabBar active={activeTab} onSelect={setActiveTab} />

      {/* Collection Selector */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <CollectionChips
          collections={collections}
          selected={collection}
          onSelect={setCollection}
        />
      </View>

      {/* Tab Content */}
      {activeTab === 'Add' && renderAddTab()}
      {activeTab === 'Edit' && renderEditTab()}
      {activeTab === 'Delete' && renderDeleteTab()}

      {/* Edit Modal */}
      <Modal visible={!!editRecord} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Record</Text>
                <TouchableOpacity onPress={() => setEditRecord(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {getFieldsForCollection(collection).map((field) => (
                <View key={field.key}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={field.keyboard === 'decimal-pad' ? 'decimal-pad' : field.keyboard === 'numeric' ? 'numeric' : 'default'}
                      value={editFormData[field.key] || ''}
                      onChangeText={(v) => updateEditField(field.key, v)}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Update Record</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // =========================================================================
  // TAB RENDERERS
  // =========================================================================

  function renderAddTab() {
    const fields = getFieldsForCollection(collection);
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Add to {collection}</Text>
            </View>

            {fields.map((field) => (
              <View key={field.key}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType={field.keyboard === 'decimal-pad' ? 'decimal-pad' : field.keyboard === 'numeric' ? 'numeric' : 'default'}
                    value={formData[field.key] || ''}
                    onChangeText={(v) => updateFormField(field.key, v)}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Record</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderEditTab() {
    return (
      <View style={{ flex: 1 }}>
        {loadingRecords ? (
          <View style={styles.centerInner}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item, idx) => (item.id ?? item._id ?? idx).toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const preview = getPreviewFields(item);
              return (
                <TouchableOpacity
                  style={styles.recordCard}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    {preview.map((p, i) => (
                      <Text
                        key={i}
                        style={i === 0 ? styles.recordTitle : styles.recordMeta}
                        numberOfLines={1}
                      >
                        {i === 0 ? p.value : `${p.label}: ${p.value}`}
                      </Text>
                    ))}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={COLORS.textSecondary}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No records in {collection}</Text>
            }
          />
        )}
      </View>
    );
  }

  function renderDeleteTab() {
    return (
      <View style={{ flex: 1 }}>
        {loadingRecords ? (
          <View style={styles.centerInner}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item, idx) => (item.id ?? item._id ?? idx).toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const preview = getPreviewFields(item);
              return (
                <View style={styles.recordCard}>
                  <View style={{ flex: 1 }}>
                    {preview.map((p, i) => (
                      <Text
                        key={i}
                        style={i === 0 ? styles.recordTitle : styles.recordMeta}
                        numberOfLines={1}
                      >
                        {i === 0 ? p.value : `${p.label}: ${p.value}`}
                      </Text>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    style={styles.deleteIconBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.red} />
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No records in {collection}</Text>
            }
          />
        )}
      </View>
    );
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 40,
    fontStyle: 'italic',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: COLORS.inputBg,
  },
  tabItemActive: {
    backgroundColor: COLORS.accent,
  },
  tabLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  tabLabelActive: { color: '#ffffff' },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
  },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#ffffff' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },

  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 4,
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },

  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  recordTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  recordMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  deleteIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
});
