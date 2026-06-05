import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { fetchMe, loginRequest, setAuthToken } from '../api/client';

const AuthContext = createContext(null);
const TOKEN_KEY = 'staff_management_token';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!alive) return;

        if (saved) {
          setTokenState(saved);
          setAuthToken(saved);
          try {
            const me = await fetchMe();
            if (!alive) return;
            setUser(me);
          } catch (meErr) {
            console.log('Auth restore me() failed:', meErr?.message || meErr);
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            if (!alive) return;
            setTokenState(null);
            setAuthToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.log('Auth restore failed:', err?.message || err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const login = async (username, password) => {
    const res = await loginRequest(username, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.access_token);
    setTokenState(res.access_token);
    setAuthToken(res.access_token);
    const me = await fetchMe();
    setUser(me);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setTokenState(null);
    setUser(null);
    setAuthToken(null);
  };

  const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
