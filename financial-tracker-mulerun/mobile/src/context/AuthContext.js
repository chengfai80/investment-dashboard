import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import api, { saveToken, getToken, removeToken, saveRefreshToken } from '../services/api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // { email, displayName }
  const [loading, setLoading] = useState(true);

  // -----------------------------------------------------------------------
  // Bootstrap: check for an existing token on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const { data } = await api.get('/api/auth/me');
          setUser({ email: data.email, displayName: data.displayName });
        }
      } catch {
        await removeToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // -----------------------------------------------------------------------
  // Biometric prompt (native only)
  // -----------------------------------------------------------------------
  async function promptBiometric() {
    if (Platform.OS === 'web') return true;

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return true;

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return true;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access FinTracker',
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch {
      return true; // allow login if biometric check fails unexpectedly
    }
  }

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------
  async function login(email, password) {
    const bioPassed = await promptBiometric();
    if (!bioPassed) {
      throw new Error('Biometric authentication failed');
    }

    const { data } = await api.post('/api/auth/login', { email, password });

    await saveToken(data.token);
    if (data.refreshToken) {
      await saveRefreshToken(data.refreshToken);
    }

    setUser({ email: data.email, displayName: data.displayName });
  }

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore network errors during logout
    }
    await removeToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
