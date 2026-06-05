import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/api';

const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  input: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

// ---------------------------------------------------------------------------
// Biometric helper
// ---------------------------------------------------------------------------
async function authenticateBiometric() {
  if (Platform.OS === 'web') return true;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return true;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to view credentials',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // View modal state
  const [viewVisible, setViewVisible] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Add modal state
  const [addVisible, setAddVisible] = useState(false);
  const [addForm, setAddForm] = useState({
    Type: '',
    Name: '',
    Username: '',
    Password: '',
    Others: '',
  });
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------
  // Fetch account list
  // -------------------------------------------------------------------
  const fetchAccounts = useCallback(async () => {
    try {
      const { data } = await api.get('/api/accounts');
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert('Error', 'Failed to load accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAccounts();
  }, [fetchAccounts]);

  // -------------------------------------------------------------------
  // View account details (biometric gated)
  // -------------------------------------------------------------------
  const handleViewAccount = useCallback(async (id) => {
    const authed = await authenticateBiometric();
    if (!authed) {
      Alert.alert(
        'Authentication Failed',
        'Biometric authentication is required to view credentials.',
      );
      return;
    }
    setShowPassword(false);
    setViewLoading(true);
    setViewVisible(true);
    try {
      const { data } = await api.get(`/api/accounts/${id}`);
      setViewData(data);
    } catch {
      Alert.alert('Error', 'Failed to load account details.');
      setViewVisible(false);
    } finally {
      setViewLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------
  // Delete account (long press)
  // -------------------------------------------------------------------
  const handleDelete = useCallback(
    (id, name) => {
      Alert.alert(
        'Delete Account',
        `Are you sure you want to delete "${name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(`/api/accounts/${id}`);
                setAccounts((prev) => prev.filter((a) => a.id !== id));
              } catch {
                Alert.alert('Error', 'Failed to delete account.');
              }
            },
          },
        ],
      );
    },
    [],
  );

  // -------------------------------------------------------------------
  // Add account
  // -------------------------------------------------------------------
  const resetAddForm = useCallback(() => {
    setAddForm({ Type: '', Name: '', Username: '', Password: '', Others: '' });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!addForm.Name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/accounts', addForm);
      setAddVisible(false);
      resetAddForm();
      fetchAccounts();
    } catch {
      Alert.alert('Error', 'Failed to create account.');
    } finally {
      setSaving(false);
    }
  }, [addForm, fetchAccounts, resetAddForm]);

  // -------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------
  const renderCard = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleViewAccount(item.id)}
        onLongPress={() => handleDelete(item.id, item.Name)}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="key" size={24} color={COLORS.accent} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.Name}</Text>
          <Text style={styles.cardType}>{item.Type || 'General'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    ),
    [handleViewAccount, handleDelete],
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="lock-closed-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Accounts Saved</Text>
        <Text style={styles.emptySubtitle}>
          Tap the + button to store your first credential.
        </Text>
      </View>
    );
  };

  // -------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // -------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------
  return (
    <View style={styles.container}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          accounts.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setAddVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ================================================================= */}
      {/* View Details Modal                                                */}
      {/* ================================================================= */}
      <Modal visible={viewVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setViewVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {viewLoading ? (
                  <ActivityIndicator
                    size="large"
                    color={COLORS.accent}
                    style={{ marginVertical: 40 }}
                  />
                ) : viewData ? (
                  <>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                      <View style={styles.modalIconCircle}>
                        <Ionicons name="key" size={28} color="#fff" />
                      </View>
                      <Text style={styles.modalTitle}>{viewData.Name}</Text>
                      <Text style={styles.modalType}>
                        {viewData.Type || 'General'}
                      </Text>
                    </View>

                    {/* Username */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Username</Text>
                      <Text style={styles.detailValue}>
                        {viewData.Username || '-'}
                      </Text>
                    </View>

                    {/* Password (masked toggle) */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Password</Text>
                      <View style={styles.passwordRow}>
                        <Text style={[styles.detailValue, { flex: 1 }]}>
                          {showPassword
                            ? viewData.Password || '-'
                            : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowPassword((p) => !p)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off' : 'eye'}
                            size={22}
                            color={COLORS.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Others */}
                    {viewData.Others ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Others</Text>
                        <Text style={styles.detailValue}>
                          {viewData.Others}
                        </Text>
                      </View>
                    ) : null}

                    {/* Close */}
                    <TouchableOpacity
                      style={styles.closeBtn}
                      onPress={() => setViewVisible(false)}
                    >
                      <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ================================================================= */}
      {/* Add Account Modal                                                 */}
      {/* ================================================================= */}
      <Modal visible={addVisible} transparent animationType="slide">
        <TouchableWithoutFeedback
          onPress={() => {
            setAddVisible(false);
            resetAddForm();
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>New Account</Text>

                {/* Type */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={COLORS.textSecondary}
                    placeholder="e.g. Banking, Social, Email"
                    value={addForm.Type}
                    onChangeText={(v) =>
                      setAddForm((p) => ({ ...p, Type: v }))
                    }
                  />
                </View>

                {/* Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={COLORS.textSecondary}
                    placeholder="Service name"
                    value={addForm.Name}
                    onChangeText={(v) =>
                      setAddForm((p) => ({ ...p, Name: v }))
                    }
                  />
                </View>

                {/* Username */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={COLORS.textSecondary}
                    placeholder="Username or email"
                    autoCapitalize="none"
                    value={addForm.Username}
                    onChangeText={(v) =>
                      setAddForm((p) => ({ ...p, Username: v }))
                    }
                  />
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={COLORS.textSecondary}
                    placeholder="Password"
                    secureTextEntry
                    value={addForm.Password}
                    onChangeText={(v) =>
                      setAddForm((p) => ({ ...p, Password: v }))
                    }
                  />
                </View>

                {/* Others */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Others</Text>
                  <TextInput
                    style={styles.input}
                    placeholderTextColor={COLORS.textSecondary}
                    placeholder="Additional notes"
                    value={addForm.Others}
                    onChangeText={(v) =>
                      setAddForm((p) => ({ ...p, Others: v }))
                    }
                  />
                </View>

                {/* Save */}
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { padding: 16 },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: { flex: 1 },
  cardName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  cardType: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },

  // Empty state
  emptyContainer: { alignItems: 'center' },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalType: { color: COLORS.textSecondary, fontSize: 14 },

  // Detail rows (view modal)
  detailRow: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: { color: COLORS.textPrimary, fontSize: 15 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },

  closeBtn: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  closeBtnText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },

  // Add form
  fieldGroup: { marginBottom: 12 },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
