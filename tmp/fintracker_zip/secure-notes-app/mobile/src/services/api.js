import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// UPDATE THIS to your Cloud Run URL after deployment
const API_BASE = 'https://YOUR-CLOUD-RUN-URL.run.app';

// Web-compatible storage
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key) {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await storage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
        await storage.setItem('accessToken', data.accessToken);
        await storage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        await storage.deleteItem('accessToken');
        await storage.deleteItem('refreshToken');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
