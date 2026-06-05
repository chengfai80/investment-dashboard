import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

// Biometrics only available on native
let LocalAuthentication = null;
if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
}

// Web fallback for SecureStore (uses localStorage)
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key) {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkAuth();
    checkBiometric();
  }, []);

  async function checkBiometric() {
    if (!LocalAuthentication) return;
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
  }

  async function checkAuth() {
    try {
      const token = await storage.getItem('accessToken');
      if (token) {
        const { data } = await api.get('/auth/me');
        setUser(data);
      }
    } catch (e) {
      await storage.deleteItem('accessToken');
      await storage.deleteItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }

  async function biometricAuth() {
    if (!biometricAvailable || !LocalAuthentication) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access SecureNotes',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }

  async function login(email, password, mfaCode) {
    const bioOk = await biometricAuth();
    if (!bioOk) throw new Error('Biometric authentication failed');

    const { data } = await api.post('/auth/login', { email, password, mfaCode });
    if (data.mfaRequired) return { mfaRequired: true };

    await storage.setItem('accessToken', data.accessToken);
    await storage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data;
  }

  async function register(username, email, password) {
    const { data } = await api.post('/auth/register', { username, email, password });
    await storage.setItem('accessToken', data.accessToken);
    await storage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data;
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch (e) {}
    await storage.deleteItem('accessToken');
    await storage.deleteItem('refreshToken');
    setUser(null);
  }

  async function setupMfa() {
    const { data } = await api.post('/auth/mfa/setup');
    return data;
  }

  async function verifyMfa(code) {
    const { data } = await api.post('/auth/mfa/verify', { code });
    setUser((prev) => ({ ...prev, mfaEnabled: true }));
    return data;
  }

  async function disableMfa(code) {
    const { data } = await api.post('/auth/mfa/disable', { code });
    setUser((prev) => ({ ...prev, mfaEnabled: false }));
    return data;
  }

  return (
    <AuthContext.Provider value={{
      user, loading, biometricAvailable,
      login, register, logout, biometricAuth,
      setupMfa, verifyMfa, disableMfa,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
