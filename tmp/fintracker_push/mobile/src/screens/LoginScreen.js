import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Theme constants (SecureNotes dark palette + glassmorphism)
// ---------------------------------------------------------------------------
const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  glassBg: 'rgba(22, 33, 62, 0.55)',
  glassBorder: 'rgba(233, 69, 96, 0.18)',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  inputBg: 'rgba(255, 255, 255, 0.06)',
  inputBorder: 'rgba(255, 255, 255, 0.10)',
  inputFocusBorder: 'rgba(233, 69, 96, 0.50)',
};

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setError('');
    setBusy(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Login failed. Please try again.';
      setError(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Login failed', msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* ---- Header ---- */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="wallet-outline" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.title}>Financial Tracker</Text>
          <Text style={styles.subtitle}>Sign in to manage your finances</Text>
        </View>

        {/* ---- Glass Card ---- */}
        <View style={styles.card}>
          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Hint */}
          <Text style={styles.hint}>
            Access is restricted to authorised users only.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  /* Glassmorphism card */
  card: {
    backgroundColor: COLORS.glassBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 24,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },

  /* Form elements */
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    paddingLeft: 8,
  },

  /* Error */
  error: {
    color: COLORS.accent,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },

  /* Button */
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Hint */
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
});
