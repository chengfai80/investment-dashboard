import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  input: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69',
  logout: '#e74c3c',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

const DISPLAY_NAMES = {
  'chengfai@hotmail.com': 'ChengFai',
  'engseeaw@gmail.com': 'EngSee',
};

const USD_RATE_KEY = 'usd_myr_rate';
const MFA_KEY = 'mfa_enabled';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [exchangeRate, setExchangeRate] = useState('4.47');
  const [savedRate, setSavedRate] = useState('4.47');
  const [updating, setUpdating] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const email = user?.email || '';
  const displayName = DISPLAY_NAMES[email] || user?.displayName || email;
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(USD_RATE_KEY);
        if (stored) {
          setExchangeRate(stored);
          setSavedRate(stored);
        }
        const mfaStored = await AsyncStorage.getItem(MFA_KEY);
        setMfaEnabled(mfaStored === 'true');
      } catch (_) {}
    })();
  }, []);

  const handleUpdateRate = async () => {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid exchange rate.');
      return;
    }
    setUpdating(true);
    try {
      await AsyncStorage.setItem(USD_RATE_KEY, String(rate));
      setSavedRate(String(rate));
      Alert.alert('Updated', `USD/MYR rate updated to ${rate.toFixed(2)}. Pull to refresh on Dashboard to apply.`);
    } catch (_) {
      Alert.alert('Error', 'Failed to save exchange rate.');
    } finally {
      setUpdating(false);
    }
  };

  const hasRateChanged = exchangeRate !== savedRate;

  const handleMfaToggle = async (newValue) => {
    if (newValue) {
      // Turning ON: just save
      await AsyncStorage.setItem(MFA_KEY, 'true');
      setMfaEnabled(true);
      Alert.alert('Biometric Lock Enabled', 'You will need to authenticate with your fingerprint to open the app.');
    } else {
      // Turning OFF: require fingerprint first
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(MFA_KEY, 'false');
        setMfaEnabled(false);
        Alert.alert('Biometric Lock Disabled', 'Biometric authentication is no longer required.');
        return;
      }
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to disable Biometric Lock',
          fallbackLabel: 'Use password',
          disableDeviceFallback: false,
        });
        if (result.success) {
          await AsyncStorage.setItem(MFA_KEY, 'false');
          setMfaEnabled(false);
          Alert.alert('Biometric Lock Disabled', 'Biometric authentication is no longer required.');
        } else {
          Alert.alert('Authentication Failed', 'Biometric Lock remains enabled.');
        }
      } catch (_) {
        Alert.alert('Error', 'Could not verify your identity. Biometric Lock remains enabled.');
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
        </View>
      </View>

      {/* Settings Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Settings</Text>

        {/* Exchange Rate */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIcon}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.settingLabel}>USD/MYR Rate</Text>
          </View>
          <TextInput
            style={styles.rateInput}
            value={exchangeRate}
            onChangeText={setExchangeRate}
            keyboardType="numeric"
            placeholderTextColor={COLORS.textSecondary}
            placeholder="4.47"
          />
        </View>

        {hasRateChanged && (
          <TouchableOpacity
            style={[styles.updateBtn, updating && { opacity: 0.6 }]}
            onPress={handleUpdateRate}
            disabled={updating}
            activeOpacity={0.8}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.updateBtnText}>Update Rate</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* Biometric Lock */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIcon}>
              <Ionicons name="finger-print" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.settingLabel}>Biometric Lock</Text>
          </View>
          <Switch
            value={mfaEnabled}
            onValueChange={handleMfaToggle}
            trackColor={{ false: COLORS.input, true: COLORS.green }}
            thumbColor={mfaEnabled ? '#fff' : COLORS.textSecondary}
          />
        </View>
        <Text style={styles.mfaHelper}>Require fingerprint to open app</Text>

        <View style={styles.divider} />

        {/* App Version */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIcon}>
              <Ionicons name="information-circle" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.settingLabel}>App Version</Text>
          </View>
          <Text style={styles.settingValue}>1.0.0</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  profileEmail: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.accentDim,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  settingLabel: { color: COLORS.textPrimary, fontSize: 15 },
  settingValue: { color: COLORS.textSecondary, fontSize: 15 },
  rateInput: {
    backgroundColor: COLORS.input, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    color: COLORS.textPrimary, fontSize: 15, width: 80, textAlign: 'center',
  },
  updateBtn: {
    flexDirection: 'row', backgroundColor: COLORS.green, borderRadius: 10,
    paddingVertical: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12,
  },
  updateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 14 },
  mfaHelper: {
    color: COLORS.textSecondary, fontSize: 12, marginTop: 4, marginLeft: 48,
  },
  logoutBtn: {
    flexDirection: 'row', backgroundColor: COLORS.logout, borderRadius: 12,
    paddingVertical: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
