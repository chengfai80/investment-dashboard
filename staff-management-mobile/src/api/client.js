import axios from 'axios';

const DEFAULT_API_BASE = 'http://localhost:8000';
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

export async function loginRequest(username, password) {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function fetchLeaveRecords(params = {}) {
  const { data } = await api.get('/leave', { params });
  return data.items || [];
}

export async function createLeaveRecord(data) {
  const { data: res } = await api.post('/leave', data);
  return res;
}

export async function updateLeaveRecord(id, data) {
  const { data: res } = await api.put(`/leave/${id}`, data);
  return res;
}

export async function deleteLeaveRecord(id) {
  const { data: res } = await api.delete(`/leave/${id}`);
  return res;
}

export async function fetchFunnelRecords(params = {}) {
  const { data } = await api.get('/funnel', { params });
  return data.items || [];
}

export async function createFunnelRecord(data) {
  const { data: res } = await api.post('/funnel', data);
  return res;
}

export async function updateFunnelRecord(id, data) {
  const { data: res } = await api.put(`/funnel/${id}`, data);
  return res;
}

export async function deleteFunnelRecord(id) {
  const { data: res } = await api.delete(`/funnel/${id}`);
  return res;
}
