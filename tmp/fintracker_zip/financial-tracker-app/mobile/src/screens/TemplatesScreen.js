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
  RefreshControl,
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
  green: '#2ecc71',
  blue: '#53a8b6',
  red: '#e74c3c',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

// ---------------------------------------------------------------------------
// Per-user collections for dropdown
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

// Actual Firestore field names per collection (matching backend collections.js)
const ENTRY_FIELDS = {
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
  insurance: ['Insurer', 'Company', 'Date', 'Policy No', 'Annual Premium'],
  insuranceinvestment: ['Insurer', 'Name', 'Type', 'Policy Number', 'Fund', 'Number of Units', 'Unit Price'],
  investment: ['Type', 'Name', 'Investment', 'Original amount', 'Current amount', 'Start Date'],
  share: ['Type', 'Name', 'Currency', 'Stock Name', 'Buy Price', 'Current Price', 'Share', 'Status'],
  sspn: ['Name', 'Type', 'Date', 'Activity', 'Amount'],
};

function getEntryFields(collection) {
  return ENTRY_FIELDS[collection] || ['name', 'description', 'amount'];
}

function fmt(num) {
  if (num == null || isNaN(num)) return 'RM 0.00';
  const abs = Math.abs(Number(num));
  const sign = Number(num) < 0 ? '-' : '';
  return `${sign}RM ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function TemplatesScreen() {
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const collections = USER_COLLECTIONS[userEmail] || DEFAULT_COLLECTIONS;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [applying, setApplying] = useState(null);

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateEntries, setTemplateEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  // Collection picker for entries
  const [pickerEntryIdx, setPickerEntryIdx] = useState(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data } = await api.get('/api/templates');
      const list = Array.isArray(data) ? data : data?.templates ?? data?.data ?? [];
      setTemplates(list);
    } catch (_) {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchTemplates();
      setLoading(false);
    })();
  }, [fetchTemplates]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTemplates();
    setRefreshing(false);
  }, [fetchTemplates]);

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // --- APPLY ---
  async function handleApply(template) {
    const id = template.id ?? template._id;
    Alert.alert(
      'Apply Template',
      `Apply "${template.name}"? This will add all entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setApplying(id);
            try {
              await api.post(`/api/templates/${id}/apply`);
              Alert.alert('Success', `Template "${template.name}" applied successfully.`);
            } catch (err) {
              Alert.alert('Error', 'Failed to apply template.');
            } finally {
              setApplying(null);
            }
          },
        },
      ],
    );
  }

  // --- DELETE ---
  async function handleDelete(template) {
    const id = template.id ?? template._id;
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/templates/${id}`);
              await fetchTemplates();
              Alert.alert('Success', 'Template deleted.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete template.');
            }
          },
        },
      ],
    );
  }

  // --- CREATE / EDIT MODAL ---
  function openCreateModal() {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateEntries([createEmptyEntry(collections[0])]);
    setShowModal(true);
  }

  function openEditModal(template) {
    setEditingTemplate(template);
    setTemplateName(template.name ?? '');
    const entries = (template.entries ?? template.items ?? []).map((e) => {
      const col = e.collection ?? e.type ?? collections[0];
      const data = e.data ?? {};
      // Also check for flat fields
      const entryData = {};
      getEntryFields(col).forEach((key) => {
        entryData[key] = data[key] != null ? String(data[key]) : (e[key] != null ? String(e[key]) : '');
      });
      return { collection: col, data: entryData };
    });
    setTemplateEntries(entries.length > 0 ? entries : [createEmptyEntry(collections[0])]);
    setShowModal(true);
  }

  function createEmptyEntry(col) {
    const data = {};
    getEntryFields(col).forEach((key) => { data[key] = ''; });
    return { collection: col, data };
  }

  function addEntry() {
    setTemplateEntries((prev) => [...prev, createEmptyEntry(collections[0])]);
  }

  function removeEntry(idx) {
    setTemplateEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateEntryCollection(idx, col) {
    setTemplateEntries((prev) => {
      const copy = [...prev];
      const newData = {};
      getEntryFields(col).forEach((key) => { newData[key] = copy[idx].data[key] || ''; });
      copy[idx] = { collection: col, data: newData };
      return copy;
    });
    setPickerEntryIdx(null);
  }

  function updateEntryField(idx, key, value) {
    setTemplateEntries((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], data: { ...copy[idx].data, [key]: value } };
      return copy;
    });
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      Alert.alert('Validation', 'Template name is required.');
      return;
    }
    const validEntries = templateEntries.filter((e) => {
      const hasCol = e.collection && e.collection.trim();
      const hasData = Object.values(e.data).some((v) => v && v.trim());
      return hasCol && hasData;
    });
    if (validEntries.length === 0) {
      Alert.alert('Validation', 'At least one entry with data is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: templateName.trim(),
        entries: validEntries.map((e) => {
          const data = {};
          Object.entries(e.data).forEach(([k, v]) => {
            if (v && v.trim()) {
              const numFields = ['Amount', 'Interest', 'Term', 'Annual Premium',
                'Number of Units', 'Unit Price', 'Original amount', 'Current amount',
                'Buy Price', 'Current Price', 'Share', 'Info'];
              data[k] = numFields.includes(k) ? Number(v) : v.trim();
            }
          });
          return { collection: e.collection.trim(), data };
        }),
      };

      if (editingTemplate) {
        const id = editingTemplate.id ?? editingTemplate._id;
        await api.put(`/api/templates/${id}`, payload);
      } else {
        await api.post('/api/templates', payload);
      }

      setShowModal(false);
      await fetchTemplates();
      Alert.alert('Success', editingTemplate ? 'Template updated.' : 'Template created.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  }

  // --- Get key display fields for an entry ---
  function getEntryDisplayText(entry) {
    const data = entry.data ?? {};
    const parts = [];
    // Check actual Firestore field names first
    const keys = ['Name', 'Description', 'Amount', 'Date', 'Type', 'Category',
      'Expense Category', 'name', 'description', 'amount', 'date', 'type'];
    keys.forEach((k) => {
      if (data[k] != null && String(data[k]).trim()) parts.push(`${k}: ${data[k]}`);
    });
    // Also check direct properties for backwards compat
    if (parts.length === 0) {
      keys.forEach((k) => {
        if (entry[k] != null && String(entry[k]).trim()) parts.push(`${k}: ${entry[k]}`);
      });
    }
    return parts.length > 0 ? parts.join(', ') : 'No data';
  }

  // --- LOADING STATE ---
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading templates...</Text>
      </SafeAreaView>
    );
  }

  // --- RENDER ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Template List */}
      <FlatList
        data={templates}
        keyExtractor={(item, idx) => (item.id ?? item._id ?? idx).toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        renderItem={({ item }) => {
          const id = item.id ?? item._id;
          const isExpanded = !!expanded[id];
          const entries = item.entries ?? item.items ?? [];

          return (
            <View style={styles.templateCard}>
              {/* Header row - tap to expand */}
              <TouchableOpacity
                style={styles.templateHeader}
                onPress={() => toggle(id)}
                activeOpacity={0.7}
              >
                <View style={styles.templateLeft}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={COLORS.accent}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateName}>{item.name ?? 'Untitled'}</Text>
                    <Text style={styles.templateMeta}>
                      {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>

              {/* Expanded: show entries + action buttons */}
              {isExpanded && (
                <View style={styles.entriesList}>
                  {entries.map((entry, idx) => (
                    <View key={idx} style={styles.entryRow}>
                      <Text style={styles.entryCollection}>
                        {entry.collection ?? entry.type ?? '---'}
                      </Text>
                      <Text style={styles.entryDesc} numberOfLines={2}>
                        {getEntryDisplayText(entry)}
                      </Text>
                    </View>
                  ))}

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.green }]}
                      onPress={() => handleApply(item)}
                      disabled={applying === id}
                    >
                      {applying === id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="play" size={14} color="#fff" />
                          <Text style={styles.actionBtnText}>Apply</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.blue }]}
                      onPress={() => openEditModal(item)}
                    >
                      <Ionicons name="create-outline" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.red }]}
                      onPress={() => handleDelete(item)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptySubtext}>
              Create a template to quickly add recurring transactions.
            </Text>
          </View>
        }
      />

      {/* FAB - Add Template */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
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
                <Text style={styles.modalTitle}>
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Template Name */}
              <Text style={styles.inputLabel}>Template Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Monthly Bills"
                  placeholderTextColor={COLORS.textSecondary}
                  value={templateName}
                  onChangeText={setTemplateName}
                />
              </View>

              {/* Entries */}
              <View style={styles.entriesHeader}>
                <Text style={styles.entriesTitleText}>Entries</Text>
                <TouchableOpacity onPress={addEntry} style={styles.addEntryBtn}>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.addEntryBtnText}>Add Entry</Text>
                </TouchableOpacity>
              </View>

              {templateEntries.map((entry, idx) => (
                <View key={idx} style={styles.entryForm}>
                  <View style={styles.entryFormHeader}>
                    <Text style={styles.entryFormLabel}>Entry {idx + 1}</Text>
                    {templateEntries.length > 1 && (
                      <TouchableOpacity onPress={() => removeEntry(idx)}>
                        <Ionicons name="close-circle" size={20} color={COLORS.red} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Collection dropdown */}
                  <Text style={styles.fieldLabel}>Collection</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => setPickerEntryIdx(pickerEntryIdx === idx ? null : idx)}
                  >
                    <Text style={styles.dropdownBtnText}>
                      {entry.collection || 'Select collection'}
                    </Text>
                    <Ionicons
                      name={pickerEntryIdx === idx ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>

                  {pickerEntryIdx === idx && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 8 }}
                    >
                      {collections.map((col) => (
                        <TouchableOpacity
                          key={col}
                          style={[
                            styles.pickerChip,
                            entry.collection === col && styles.pickerChipActive,
                          ]}
                          onPress={() => updateEntryCollection(idx, col)}
                        >
                          <Text
                            style={[
                              styles.pickerChipText,
                              entry.collection === col && styles.pickerChipTextActive,
                            ]}
                          >
                            {col}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {/* Data fields for selected collection */}
                  {entry.collection ? (
                    getEntryFields(entry.collection).map((fieldKey) => (
                      <View key={fieldKey}>
                        <Text style={styles.fieldLabel}>{fieldKey}</Text>
                        <TextInput
                          style={styles.entryInput}
                          placeholder={`Enter ${fieldKey}`}
                          placeholderTextColor={COLORS.textSecondary}
                          keyboardType={
                            ['Amount', 'Interest', 'Term', 'Annual Premium',
                              'Number of Units', 'Unit Price', 'Original amount',
                              'Current amount', 'Buy Price', 'Current Price',
                              'Share', 'Info'].includes(fieldKey)
                              ? 'decimal-pad'
                              : 'default'
                          }
                          value={entry.data[fieldKey] || ''}
                          onChangeText={(v) => updateEntryField(idx, fieldKey, v)}
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={styles.selectCollText}>
                      Select a collection to see fields
                    </Text>
                  )}
                </View>
              ))}

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveTemplate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },

  templateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  templateLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  templateName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  templateMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  entriesList: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  entryRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  entryCollection: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  entryDesc: { color: COLORS.textSecondary, fontSize: 13 },

  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 16 },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
    marginTop: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },

  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
    marginBottom: 16,
  },
  input: { color: COLORS.textPrimary, fontSize: 15 },

  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entriesTitleText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addEntryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 4 },

  entryForm: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  entryFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryFormLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 6,
    textTransform: 'capitalize',
  },
  entryInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: 4,
  },

  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 6,
  },
  dropdownBtnText: { color: COLORS.textPrimary, fontSize: 14 },

  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    marginRight: 6,
  },
  pickerChipActive: { backgroundColor: COLORS.accent },
  pickerChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pickerChipTextActive: { color: '#fff' },

  selectCollText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },

  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
