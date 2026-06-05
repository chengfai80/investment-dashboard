import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  inputBg: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [exchangeRate, setExchangeRate] = useState('');

  // Load saved exchange rate
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const saved = localStorage.getItem('usd_myr_rate');
          if (saved) setExchangeRate(saved);
        } else {
          const saved = await AsyncStorage.getItem('usd_myr_rate');
          if (saved) setExchangeRate(saved);
        }
      } catch (_) {
        // ignore
      }
    })();
  }, []);

  async function saveRate(val) {
    setExchangeRate(val);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('usd_myr_rate', val);
      } else {
        await AsyncStorage.setItem('usd_myr_rate', val);
      }
    } catch (_) {
      // ignore
    }
  }

  function handleLogout() {
    const doLogout = () => logout();

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to log out?')) doLogout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  }

  const initial = (user?.displayName || user?.email || 'U')[0].toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.displayName || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
          </View>
        </View>
      </View>

      {/* Exchange Rate */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="swap-horizontal-outline" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Exchange Rate</Text>
        </View>
        <Text style={styles.label}>USD / MYR Rate</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="logo-usd" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 4.50"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
            value={exchangeRate}
            onChangeText={saveRate}
          />
          <Text style={styles.inputSuffix}>MYR</Text>
        </View>
        <Text style={styles.hint}>Used for converting USD investments to MYR.</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Version */}
      <View style={styles.versionBlock}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
        <Text style={styles.versionText}>Financial Tracker v{APP_VERSION}</Text>
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

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginLeft: 8 },

  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  avatarText: { color: COLORS.accent, fontSize: 24, fontWeight: '700' },
  profileInfo: { marginLeft: 14, flex: 1 },
  profileName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  profileEmail: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },

  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  inputSuffix: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  hint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 8, opacity: 0.7 },

  logoutButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },

  versionBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  versionText: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 6 },
});
