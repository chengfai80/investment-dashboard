import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    try {
      setBusy(true);
      await login(email.trim(), password);
    } catch (err) {
      const backendMessage = err?.response?.data?.detail || err?.response?.data?.error;
      const statusMessage = err?.response ? `HTTP ${err.response.status}` : null;
      const urlMessage = err?.config?.url ? `URL ${err.config.baseURL || ''}${err.config.url}` : null;
      Alert.alert('Login failed', backendMessage || statusMessage || urlMessage || err?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Financial Tracker</Text>
        <Text style={styles.subtitle}>Sign in to your mobile dashboard</Text>
        <Text style={styles.note}>Remember to set EXPO_PUBLIC_API_BASE_URL to your Cloud Run URL.</Text>

        <TextInput placeholder="Email" placeholderTextColor="#64748b" autoCapitalize="none" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor="#64748b" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />

        <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Login</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#0f172a', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#94a3b8', marginBottom: 8 },
  note: { color: '#f59e0b', marginBottom: 20, fontSize: 12 },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  button: { backgroundColor: '#f59e0b', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0f172a', fontWeight: '800' },
});
