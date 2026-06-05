import axios from 'axios';

const DEFAULT_API_BASE = 'https://financial-tracker-backend-1034658393263.asia-southeast1.run.app';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE;

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  console.warn(`EXPO_PUBLIC_API_BASE_URL is not set; falling back to ${DEFAULT_API_BASE}.`);
}

console.log('API base URL:', API_BASE);

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function loginRequest(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function fetchDashboard() {
  const { data } = await api.get('/dashboard/summary');
  return data;
}

export async function fetchTransactions(collection) {
  const { data } = await api.get('/transactions', { params: { collection } });
  return data.items || [];
}

export async function createTransaction(collection, data) {
  const { data: res } = await api.post('/transactions', { collection, data });
  return res;
}

export async function fetchAccounts() {
  const { data } = await api.get('/accounts');
  return data.items || [];
}

export async function fetchCommitments() {
  const { data } = await api.get('/commitments');
  return data.items || [];
}

export async function fetchInvestments() {
  const { data } = await api.get('/investments');
  return data.items || [];
}

export async function fetchTemplates() {
  const { data } = await api.get('/templates');
  return data.items || [];
}

export async function fetchSettings() {
  const { data } = await api.get('/settings');
  return data;
}

export async function sendAssistantMessage(message, chat_id = 'default') {
  const { data } = await api.post('/assistant/message', { message, chat_id });
  return data;
}
