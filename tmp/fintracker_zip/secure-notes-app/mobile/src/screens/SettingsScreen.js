import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { user, logout, setupMfa, verifyMfa, disableMfa } = useAuth();
  const [mfaSecret, setMfaSecret] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  async function handleSetupMfa() {
    try {
      const data = await setupMfa();
      setMfaSecret(data.secret);
      Alert.alert(
        'MFA Setup',
        `Add this secret to your authenticator app:\n\n${data.secret}\n\nThen enter the 6-digit code.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to setup MFA');
    }
  }

  async function handleVerifyMfa() {
    if (mfaCode.length !== 6) return Alert.alert('Error', 'Enter 6-digit code');
    try {
      await verifyMfa(mfaCode);
      Alert.alert('Success', 'MFA has been enabled');
      setMfaSecret(null);
      setMfaCode('');
    } catch (e) {
      Alert.alert('Error', 'Invalid code');
    }
  }

  async function handleDisableMfa() {
    if (disableCode.length !== 6) return Alert.alert('Error', 'Enter 6-digit code');
    try {
      await disableMfa(disableCode);
      Alert.alert('Success', 'MFA has been disabled');
      setShowDisable(false);
      setDisableCode('');
    } catch (e) {
      Alert.alert('Error', 'Invalid code. Enter the code from your authenticator app.');
    }
  }

  function confirmDisableMfa() {
    Alert.alert(
      'Disable MFA',
      'Are you sure? This will make your account less secure. You will need your current authenticator code to confirm.',
      [
        { text: 'Cancel' },
        { text: 'Continue', onPress: () => setShowDisable(true) },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>MFA (Two-Factor Auth)</Text>
          <Text style={[styles.settingValue, { color: user?.mfaEnabled ? '#2ecc71' : '#e74c3c' }]}>
            {user?.mfaEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>

        {/* Enable MFA */}
        {!user?.mfaEnabled && !mfaSecret && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleSetupMfa}>
            <Text style={styles.actionText}>Enable MFA</Text>
          </TouchableOpacity>
        )}

        {/* MFA setup - enter code to verify */}
        {mfaSecret && (
          <View style={styles.mfaSetup}>
            <Text style={styles.mfaLabel}>Enter code from authenticator:</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor="#888"
                  value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" maxLength={6} />
              </View>
              <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyMfa}>
                <Text style={styles.btnText}>Verify</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setMfaSecret(null); setMfaCode(''); }} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Disable MFA */}
        {user?.mfaEnabled && !showDisable && (
          <TouchableOpacity style={styles.disableBtn} onPress={confirmDisableMfa}>
            <Text style={styles.disableText}>Disable MFA</Text>
          </TouchableOpacity>
        )}

        {/* Disable MFA - enter code to confirm */}
        {showDisable && (
          <View style={styles.mfaSetup}>
            <Text style={styles.mfaLabel}>Enter your authenticator code to confirm:</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor="#888"
                  value={disableCode} onChangeText={setDisableCode} keyboardType="number-pad" maxLength={6} />
              </View>
              <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: '#e74c3c' }]} onPress={handleDisableMfa}>
                <Text style={styles.btnText}>Disable</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setShowDisable(false); setDisableCode(''); }} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  profileCard: { alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, padding: 24, marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e94560', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  username: { color: '#fff', fontSize: 20, fontWeight: '600' },
  email: { color: '#888', fontSize: 14, marginTop: 4 },
  section: { backgroundColor: '#16213e', borderRadius: 16, padding: 20, marginBottom: 20 },
  sectionTitle: { color: '#e94560', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  settingLabel: { color: '#fff', fontSize: 15 },
  settingValue: { fontSize: 14, fontWeight: '500' },
  actionBtn: { backgroundColor: '#0f3460', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  actionText: { color: '#53a8b6', fontSize: 15, fontWeight: '500' },
  disableBtn: { backgroundColor: '#0f3460', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  disableText: { color: '#e74c3c', fontSize: 15, fontWeight: '500' },
  mfaSetup: { marginTop: 12 },
  mfaLabel: { color: '#aaa', fontSize: 13, marginBottom: 8 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 14, fontSize: 16 },
  verifyBtn: { backgroundColor: '#e94560', borderRadius: 8, padding: 14, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  cancelLink: { marginTop: 10, alignItems: 'center' },
  cancelLinkText: { color: '#888', fontSize: 14 },
  logoutBtn: { backgroundColor: '#e74c3c', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
