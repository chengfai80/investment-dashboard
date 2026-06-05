import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Theme
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

// Per-user collections
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

const DEFAULT_COLLECTIONS = [
  'banks', 'cardusage', 'category', 'commitment', 'epf',
  'expensesummary', 'fd', 'insurance', 'insuranceinvestment',
];

// Actual Firestore field names per collection (matching collections.js)
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
  insurance: ['Insurer', 'Company', 'Date', 'Premium End Date', 'Coverage End Date', 'Policy No', 'Annual Premium', 'Death', 'TPD', 'Critical Illness (45)', 'Early CI Payout', 'Early Cancer', 'Personal Accident', 'Medical', 'Nominee'],
  insuranceinvestment: ['Insurer', 'Name', 'Type', 'Policy Number', 'Fund', 'Number of Units', 'Unit Price'],
  investment: ['Type', 'Name', 'Investment', 'Original amount', 'Current amount', 'Start Date'],
  share: ['Type', 'Name', 'Currency', 'Stock Name', 'Buy Price', 'Current Price', 'Share', 'Status'],
  sspn: ['Name', 'Type', 'Date', 'Activity', 'Amount'],
};

// Numeric fields
const NUMERIC_FIELDS = ['Amount', 'Interest', 'Term', 'Annual Premium', 'Death', 'TPD',
  'Critical Illness (45)', 'Early CI Payout', 'Early Cancer', 'Personal Accident', 'Medical',
  'Number of Units', 'Unit Price', 'Original amount', 'Current amount', 'Buy Price',
  'Current Price', 'Share', 'Info'];

function isNumericField(field) {
  return NUMERIC_FIELDS.includes(field);
}

function isDateField(field) {
  return /date/i.test(field);
}

// Parse amount with expression support (10+2.5 = 12.5)
function parseAmountInput(input) {
  if (!input || !input.trim()) return 0;
  const trimmed = input.trim();
  // Check if it's an expression (contains operators like +, -, *, /)
  // Must check for expression FIRST, because parseFloat("1+5") returns 1
  if (/^[\d\s+\-*/().]+$/.test(trimmed) && /[+\-*/]/.test(trimmed.replace(/^-/, ''))) {
    try {
      const result = Function('"use strict"; return (' + trimmed + ')')();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100) / 100;
      }
    } catch (_) {}
  }
  // Plain number
  const val = parseFloat(trimmed);
  if (!isNaN(val)) return Math.round(val * 100) / 100;
  return null;
}

function fmt(num) {
  if (num == null || isNaN(num)) return 'RM 0.00';
  const abs = Math.abs(Number(num));
  const sign = Number(num) < 0 ? '-' : '';
  return `${sign}RM ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getFieldsForCollection(collection) {
  return COLLECTION_FIELDS[collection] || ['Name', 'Description', 'Amount'];
}

// Format date for display
function formatDate(val) {
  if (!val) return '';
  try {
    const d = val._seconds ? new Date(val._seconds * 1000) : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString().split('T')[0];
  } catch (_) { return String(val); }
}

const TAB_NAMES = ['Add', 'Edit', 'Delete'];

// Collection Chips
function CollectionChips({ collections, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
      {collections.map((c) => (
        <TouchableOpacity key={c} style={[styles.chip, selected === c && styles.chipActive]} onPress={() => onSelect(c)}>
          <Text style={[styles.chipText, selected === c && styles.chipTextActive]}>{c}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// Tab Bar
function TabBar({ active, onSelect }) {
  return (
    <View style={styles.tabBar}>
      {TAB_NAMES.map((tab) => (
        <TouchableOpacity key={tab} style={[styles.tabItem, active === tab && styles.tabItemActive]} onPress={() => onSelect(tab)}>
          <Text style={[styles.tabLabel, active === tab && styles.tabLabelActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Dropdown Picker
function DropdownPicker({ label, options, selected, onSelect, visible, onToggle }) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={onToggle}>
        <Text style={[styles.dropdownBtnText, !selected && { color: COLORS.textSecondary }]}>
          {selected || `Select ${label}`}
        </Text>
        <Ionicons name={visible ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {visible && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.pickerChip, selected === opt && styles.pickerChipActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.pickerChipText, selected === opt && styles.pickerChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Searchable category picker - type to filter, tap to select
function SearchableCategoryPicker({ label, options, value, onChange, onSelect }) {
  const query = (value || '').toLowerCase();
  const filtered = query.length >= 1
    ? options.filter((o) => o.toLowerCase().includes(query))
    : [];
  const showSuggestions = query.length >= 1 && filtered.length > 0 && !options.includes(value);

  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder={`Type to search ${label}...`}
          placeholderTextColor={COLORS.textSecondary}
          value={value || ''}
          onChangeText={onChange}
        />
        {value ? (
          <TouchableOpacity onPress={() => onChange('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        )}
      </View>
      {showSuggestions && (
        <View style={styles.suggestionsBox}>
          {filtered.slice(0, 8).map((opt) => (
            <TouchableOpacity key={opt} style={styles.suggestionItem} onPress={() => onSelect(opt)}>
              <Text style={styles.suggestionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Memoized table row to prevent re-renders on form typing
const TableRow = memo(function TableRow({ record, fields, index }) {
  return (
    <View style={[styles.tableRow, index % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
      {fields.map((f, ci) => {
        const val = record[f];
        const display = val == null ? '' : isDateField(f) ? formatDate(val) : String(val);
        return (
          <Text key={ci} style={[styles.tableCell, { width: f === 'Description' ? 120 : 90 }]} numberOfLines={1}>
            {display}
          </Text>
        );
      })}
    </View>
  );
});

// Description field with auto-suggest
function DescriptionField({ value, onChange, suggestions, onSelectSuggestion }) {
  return (
    <View>
      <Text style={styles.inputLabel}>Description</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Enter description"
          placeholderTextColor={COLORS.textSecondary}
          value={value}
          onChangeText={onChange}
        />
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => onSelectSuggestion(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Main Component
export default function TransactionScreen() {
  const { user } = useAuth();
  const userEmail = user?.email || '';
  const collections = USER_COLLECTIONS[userEmail] || DEFAULT_COLLECTIONS;

  const [activeTab, setActiveTab] = useState('Add');
  const [collection, setCollection] = useState(
    collections.includes('cardusage') ? 'cardusage' : collections[0]
  );
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [categories, setCategories] = useState([]);

  // Add form state
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [descSuggestions, setDescSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState({});

  // Edit modal state
  const [editRecord, setEditRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(null); // field name or null
  const [showEditDatePicker, setShowEditDatePicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  }, [collection]);

  // Filtered records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      return Object.values(r).some((v) => {
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [records, searchQuery]);

  // Load categories for dropdown
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/data/category');
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
      } catch (_) {}
    })();
  }, []);

  // Reset form when collection changes, set defaults
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const defaults = { Date: today };
    // Set defaults for cardusage
    if (collection === 'cardusage') {
      defaults.Type = 'eWallet';
      defaults.Name = 'TNG';
    }
    setFormData(defaults);
    setDescSuggestions([]);
    setShowDropdown({});
    setSearchQuery('');
  }, [collection]);

  // Fetch records for all tabs
  useEffect(() => {
    fetchRecords();
  }, [collection]);

  async function fetchRecords() {
    setLoadingRecords(true);
    try {
      const { data } = await api.get(`/api/data/${collection}`);
      const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
      // Sort by Date descending (#4)
      list.sort((a, b) => {
        const da = a.Date ? new Date(a.Date._seconds ? a.Date._seconds * 1000 : a.Date) : new Date(0);
        const db = b.Date ? new Date(b.Date._seconds ? b.Date._seconds * 1000 : b.Date) : new Date(0);
        return db - da;
      });
      setRecords(list);
    } catch (_) {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }

  // Get unique values for a field from records
  function getUniqueValues(field) {
    const vals = records.map((r) => r[field]).filter((v) => v != null && String(v).trim() !== '');
    return [...new Set(vals.map(String))].sort();
  }

  // Get category options
  const categoryOptions = useMemo(() => {
    const cats = categories.map((c) => c.Category).filter(Boolean);
    return [...new Set(cats)].sort();
  }, [categories]);

  // Cardusage name defaults based on type
  const CARD_NAME_DEFAULTS = { 'Credit Card': 'Alliance', 'Debit Card': 'GX', 'eWallet': 'TNG', 'Cash': 'Cash' };

  // --- Description auto-suggest ---
  function handleDescriptionChange(text) {
    setFormData((prev) => ({ ...prev, Description: text }));

    if (text.length >= 2) {
      const pastDescs = getUniqueValues('Description');
      const matches = findCloseMatches(text, pastDescs, 5, 0.4);
      setDescSuggestions(matches);
    } else {
      setDescSuggestions([]);
    }
  }

  function handleSelectSuggestion(desc) {
    setDescSuggestions([]);

    // Auto-map ALL fields from past transaction with same description
    const pastMatch = records.find((r) => r.Description === desc);
    if (pastMatch) {
      const fields = getFieldsForCollection(collection);
      const updates = {};
      fields.forEach((f) => {
        if (f === 'Date') return; // keep current date
        if (f === 'Description') {
          updates[f] = desc;
          return;
        }
        const val = pastMatch[f];
        if (val != null) {
          if (f === 'Amount') {
            updates[f] = String(Math.abs(Number(val)));
          } else if (isDateField(f)) {
            updates[f] = formatDate(val);
          } else {
            updates[f] = String(val);
          }
        }
      });
      setFormData((prev) => ({ ...prev, ...updates }));
    } else {
      setFormData((prev) => ({ ...prev, Description: desc }));
    }
  }

  // Simple fuzzy matching
  function findCloseMatches(input, candidates, n, cutoff) {
    const lower = input.toLowerCase();
    const scored = candidates
      .map((c) => ({ value: c, score: similarity(lower, c.toLowerCase()) }))
      .filter((c) => c.score >= cutoff)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, n).map((c) => c.value);
  }

  function similarity(a, b) {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    // Check if shorter is a substring
    if (longer.includes(shorter)) return shorter.length / longer.length + 0.3;
    // Simple character overlap ratio
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  }

  // --- Form field update ---
  function updateFormField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // --- ADD ---
  async function handleAdd() {
    const fields = getFieldsForCollection(collection);
    const hasData = fields.some((f) => formData[f] && String(formData[f]).trim());
    if (!hasData) {
      Alert.alert('Validation', 'Please fill in at least one field.');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        const val = formData[f];
        if (val != null && String(val).trim()) {
          if (isNumericField(f)) {
            const parsed = parseAmountInput(String(val));
            if (parsed !== null) payload[f] = parsed;
          } else {
            payload[f] = String(val).trim();
          }
        }
      });

      const res = await api.post(`/api/data/${collection}`, payload);
      const depTx = res.data?.dependentTransactions ?? [];
      let msg = 'Record added successfully.';
      if (depTx.length > 0) {
        const depNames = depTx.map((d) => `${d.collection}: ${d.name}`).join(', ');
        msg += `\n\nDependent transactions created: ${depNames}`;
      }
      Alert.alert('Success', msg);
      // Reset form but keep the same date
      const currentDate = formData.Date || new Date().toISOString().split('T')[0];
      const defaults = { Date: currentDate };
      if (collection === 'cardusage') {
        defaults.Type = 'eWallet';
        defaults.Name = 'TNG';
      }
      setFormData(defaults);
      setDescSuggestions([]);
      await fetchRecords();
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to add record.';
      Alert.alert('Error', errMsg);
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
      const val = record[f];
      if (val != null) {
        if (isDateField(f)) {
          data[f] = formatDate(val);
        } else {
          data[f] = String(val);
        }
      } else {
        data[f] = '';
      }
    });
    setEditFormData(data);
  }

  function updateEditField(field, value) {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleEdit() {
    if (!editRecord) return;
    setEditSaving(true);
    try {
      const id = editRecord.id ?? editRecord._id;
      const fields = getFieldsForCollection(collection);
      const payload = {};
      fields.forEach((f) => {
        const val = editFormData[f];
        if (val != null && String(val).trim()) {
          if (isNumericField(f)) {
            const parsed = parseAmountInput(String(val));
            if (parsed !== null) payload[f] = parsed;
          } else {
            payload[f] = String(val).trim();
          }
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
    const fields = getFieldsForCollection(collection);
    const details = fields
      .filter((f) => record[f] != null && String(record[f]).trim())
      .map((f) => `${f}: ${isDateField(f) ? formatDate(record[f]) : record[f]}`)
      .join('\n');

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete this record?\n\n${details}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDelete(id) },
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

  // --- Record display for list items ---
  function getRecordDisplay(item) {
    const fields = getFieldsForCollection(collection);
    const lines = [];
    fields.forEach((f) => {
      const val = item[f];
      if (val != null && String(val).trim()) {
        const display = isDateField(f) ? formatDate(val) : (isNumericField(f) && f === 'Amount' ? fmt(val) : String(val));
        lines.push({ label: f, value: display });
      }
    });
    if (lines.length === 0) {
      lines.push({ label: 'ID', value: String(item.id ?? item._id ?? '---') });
    }
    return lines;
  }

  // --- Determine if a field should be a dropdown ---
  function isDropdownField(field) {
    if (field === 'Description') return false; // has its own auto-suggest
    if (isDateField(field)) return false;
    if (isNumericField(field)) return false;
    if (field === 'Expense Category' && (collection === 'banks' || collection === 'cardusage')) return true;
    // Name and Type for banks/cardusage
    if ((field === 'Name' || field === 'Type') && (collection === 'banks' || collection === 'cardusage')) return true;
    // String fields with existing values in DB
    if (!isNumericField(field) && !isDateField(field)) {
      const unique = getUniqueValues(field);
      return unique.length > 0 && unique.length < 50;
    }
    return false;
  }

  function getDropdownOptions(field) {
    if (field === 'Expense Category' && (collection === 'banks' || collection === 'cardusage')) {
      return categoryOptions.length > 0 ? categoryOptions : getUniqueValues(field);
    }
    return getUniqueValues(field);
  }

  // --- Render field for Add form ---
  function renderAddField(field) {
    // Date field with calendar picker
    if (isDateField(field)) {
      const today = new Date().toISOString().split('T')[0];
      const currentVal = formData[field] || today;
      // Ensure Date is in formData
      if (!formData[field]) {
        setTimeout(() => updateFormField(field, today), 0);
      }

      const dateObj = (() => {
        try {
          const d = new Date(currentVal + 'T00:00:00');
          return isNaN(d.getTime()) ? new Date() : d;
        } catch (_) { return new Date(); }
      })();

      return (
        <View key={field}>
          <Text style={styles.inputLabel}>{field}</Text>
          <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(field)} activeOpacity={0.7}>
            <Text style={[styles.input, { paddingVertical: 14 }]}>{currentVal}</Text>
            <Ionicons name="calendar" size={20} color={COLORS.accent} />
          </TouchableOpacity>
          {showDatePicker === field && (
            <DateTimePicker
              value={dateObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(null);
                if (selectedDate) {
                  const yyyy = selectedDate.getFullYear();
                  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const dd = String(selectedDate.getDate()).padStart(2, '0');
                  updateFormField(field, `${yyyy}-${mm}-${dd}`);
                }
              }}
            />
          )}
        </View>
      );
    }

    // Description with auto-suggest (for any collection with Description field)
    if (field === 'Description') {
      return (
        <DescriptionField
          key={field}
          value={formData.Description || ''}
          onChange={handleDescriptionChange}
          suggestions={descSuggestions}
          onSelectSuggestion={handleSelectSuggestion}
        />
      );
    }

    // Amount with expression support
    if (field === 'Amount' || isNumericField(field)) {
      return (
        <View key={field}>
          <Text style={styles.inputLabel}>{field}{field === 'Amount' ? ' (supports expressions e.g. 10+2.5)' : ''}</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="default"
              value={formData[field] != null ? String(formData[field]) : ''}
              onChangeText={(v) => updateFormField(field, v)}
            />
          </View>
          {field === 'Amount' && formData[field] && parseAmountInput(String(formData[field])) !== null && (
            <Text style={styles.parsedAmount}>= {fmt(parseAmountInput(String(formData[field])))}</Text>
          )}
        </View>
      );
    }

    // Expense Category - searchable type-to-filter picker
    if (field === 'Expense Category' && (collection === 'banks' || collection === 'cardusage')) {
      const options = categoryOptions.length > 0 ? categoryOptions : getUniqueValues(field);
      return (
        <SearchableCategoryPicker
          key={field}
          label={field}
          options={options}
          value={formData[field] || ''}
          onChange={(v) => updateFormField(field, v)}
          onSelect={(v) => updateFormField(field, v)}
        />
      );
    }

    // Dropdown fields
    if (isDropdownField(field)) {
      const options = getDropdownOptions(field);
      return (
        <DropdownPicker
          key={field}
          label={field}
          options={options}
          selected={formData[field] || ''}
          onSelect={(val) => {
            updateFormField(field, val);
            setShowDropdown((prev) => ({ ...prev, [field]: false }));
            // Auto-set Name default for cardusage when Type changes
            if (field === 'Type' && collection === 'cardusage' && CARD_NAME_DEFAULTS[val]) {
              updateFormField('Name', CARD_NAME_DEFAULTS[val]);
            }
          }}
          visible={!!showDropdown[field]}
          onToggle={() => setShowDropdown((prev) => ({ ...prev, [field]: !prev[field] }))}
        />
      );
    }

    // Default text field
    return (
      <View key={field}>
        <Text style={styles.inputLabel}>{field}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={`Enter ${field}`}
            placeholderTextColor={COLORS.textSecondary}
            value={formData[field] || ''}
            onChangeText={(v) => updateFormField(field, v)}
          />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TabBar active={activeTab} onSelect={setActiveTab} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <CollectionChips collections={collections} selected={collection} onSelect={setCollection} />
      </View>

      {activeTab === 'Add' && renderAddTab()}
      {activeTab === 'Edit' && renderEditTab()}
      {activeTab === 'Delete' && renderDeleteTab()}

      {/* Edit Modal */}
      <Modal visible={!!editRecord} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Record</Text>
                <TouchableOpacity onPress={() => setEditRecord(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {getFieldsForCollection(collection).map((field) => {
                // Date fields get a calendar picker in edit modal too
                if (isDateField(field)) {
                  const currentVal = editFormData[field] || '';
                  const dateObj = (() => {
                    try {
                      const d = new Date(currentVal + 'T00:00:00');
                      return isNaN(d.getTime()) ? new Date() : d;
                    } catch (_) { return new Date(); }
                  })();

                  return (
                    <View key={field}>
                      <Text style={styles.inputLabel}>{field}</Text>
                      <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowEditDatePicker(field)} activeOpacity={0.7}>
                        <Text style={[styles.input, { paddingVertical: 14 }]}>{currentVal || 'Select date'}</Text>
                        <Ionicons name="calendar" size={20} color={COLORS.accent} />
                      </TouchableOpacity>
                      {showEditDatePicker === field && (
                        <DateTimePicker
                          value={dateObj}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            setShowEditDatePicker(null);
                            if (selectedDate) {
                              const yyyy = selectedDate.getFullYear();
                              const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                              const dd = String(selectedDate.getDate()).padStart(2, '0');
                              updateEditField(field, `${yyyy}-${mm}-${dd}`);
                            }
                          }}
                        />
                      )}
                    </View>
                  );
                }

                // Expense Category - searchable type-to-filter in edit modal
                if (field === 'Expense Category' && (collection === 'banks' || collection === 'cardusage')) {
                  const options = categoryOptions.length > 0 ? categoryOptions : getUniqueValues(field);
                  return (
                    <SearchableCategoryPicker
                      key={field}
                      label={field}
                      options={options}
                      value={editFormData[field] || ''}
                      onChange={(v) => updateEditField(field, v)}
                      onSelect={(v) => updateEditField(field, v)}
                    />
                  );
                }

                return (
                <View key={field}>
                  <Text style={styles.inputLabel}>{field}</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={`Enter ${field}`}
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={isNumericField(field) ? 'default' : 'default'}
                      value={editFormData[field] || ''}
                      onChangeText={(v) => updateEditField(field, v)}
                    />
                  </View>
                  {isNumericField(field) && editFormData[field] && parseAmountInput(String(editFormData[field])) !== null && (
                    <Text style={styles.parsedAmount}>= {fmt(parseAmountInput(String(editFormData[field])))}</Text>
                  )}
                </View>
                );
              })}

              <TouchableOpacity
                style={[styles.saveBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleEdit}
                disabled={editSaving}
              >
                {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Record</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // === TAB RENDERERS ===

  function renderAddTab() {
    const fields = getFieldsForCollection(collection);
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Add to {collection}</Text>
            </View>
            {fields.map((field) => renderAddField(field))}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Record</Text>}
            </TouchableOpacity>
          </View>

          {/* Current records table below Add form */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Records ({filteredRecords.length}{searchQuery ? ` / ${records.length}` : ''})</Text>
            </View>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search records..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {loadingRecords ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : filteredRecords.length === 0 ? (
              <Text style={styles.emptyText}>{searchQuery ? 'No matching records' : `No records in ${collection}`}</Text>
            ) : (
              <View style={{ height: 300 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ width: fields.reduce((sum, f) => sum + (f === 'Description' ? 120 : 90), 0) }}>
                    <View style={styles.tableHeaderRow}>
                      {fields.map((f, i) => (
                        <Text key={i} style={[styles.tableHeaderCell, { width: f === 'Description' ? 120 : 90 }]}>{f}</Text>
                      ))}
                    </View>
                    <FlatList
                      data={filteredRecords}
                      keyExtractor={(item, i) => (item.id || item._id || i).toString()}
                      style={{ maxHeight: 264 }}
                      nestedScrollEnabled
                      initialNumToRender={30}
                      maxToRenderPerBatch={50}
                      windowSize={21}
                      getItemLayout={(_, index) => ({ length: 36, offset: 36 * index, index })}
                      renderItem={({ item, index }) => (
                        <TableRow record={item} fields={fields} index={index} />
                      )}
                    />
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderEditTab() {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.searchBar, { marginHorizontal: 16, marginTop: 12 }]}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search records..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {loadingRecords ? (
          <View style={styles.centerInner}><ActivityIndicator size="large" color={COLORS.accent} /></View>
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item, idx) => (item.id ?? item._id ?? idx).toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => {
              const display = getRecordDisplay(item);
              return (
                <TouchableOpacity style={styles.recordCard} onPress={() => openEditModal(item)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    {display.map((d, i) => (
                      <Text key={i} style={i === 0 ? styles.recordTitle : styles.recordMeta} numberOfLines={1}>
                        {i === 0 ? d.value : `${d.label}: ${d.value}`}
                      </Text>
                    ))}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No records in {collection}</Text>}
          />
        )}
      </View>
    );
  }

  function renderDeleteTab() {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.searchBar, { marginHorizontal: 16, marginTop: 12 }]}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search records..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {loadingRecords ? (
          <View style={styles.centerInner}><ActivityIndicator size="large" color={COLORS.accent} /></View>
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item, idx) => (item.id ?? item._id ?? idx).toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => {
              const display = getRecordDisplay(item);
              return (
                <View style={styles.recordCard}>
                  <View style={{ flex: 1 }}>
                    {display.map((d, i) => (
                      <Text key={i} style={i === 0 ? styles.recordTitle : styles.recordMeta} numberOfLines={1}>
                        {i === 0 ? d.value : `${d.label}: ${d.value}`}
                      </Text>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteIconBtn}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.red} />
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No records in {collection}</Text>}
          />
        )}
      </View>
    );
  }
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: {
    color: COLORS.textSecondary, fontSize: 13, textAlign: 'center',
    paddingVertical: 20, fontStyle: 'italic',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg,
    borderRadius: 10, paddingHorizontal: 12, height: 40, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  searchInput: {
    flex: 1, color: COLORS.textPrimary, fontSize: 14,
    marginLeft: 8, paddingVertical: 0,
  },

  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, backgroundColor: COLORS.inputBg,
  },
  tabItemActive: { backgroundColor: COLORS.accent },
  tabLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  tabLabelActive: { color: '#ffffff' },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.inputBg, marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#ffffff' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginLeft: 8 },

  inputLabel: {
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '600',
    marginBottom: 6, marginTop: 10,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg,
    borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 4,
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },

  parsedAmount: {
    color: COLORS.green, fontSize: 12, fontWeight: '600',
    marginLeft: 14, marginTop: 2,
  },

  saveBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  recordCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  recordTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  recordMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  deleteIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: {
    backgroundColor: COLORS.background, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 20, minHeight: 400, marginTop: 60,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },

  // Dropdown
  dropdownBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 14,
    height: 48, marginBottom: 4,
  },
  dropdownBtnText: { color: COLORS.textPrimary, fontSize: 15 },
  pickerChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.inputBg, marginRight: 6,
  },
  pickerChipActive: { backgroundColor: COLORS.accent },
  pickerChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pickerChipTextActive: { color: '#fff' },

  // Suggestions
  suggestionsBox: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8,
    padding: 8, marginTop: 4, marginBottom: 4,
  },
  suggestionsTitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  suggestionItem: {
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6,
    marginBottom: 2,
  },
  suggestionText: { color: COLORS.accent, fontSize: 13 },

  // Table in Add tab
  tableHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 4,
  },
  tableHeaderCell: {
    color: COLORS.textSecondary, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', paddingRight: 4,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderRadius: 4 },
  tableCell: { color: COLORS.textPrimary, fontSize: 11, paddingRight: 4 },
});

