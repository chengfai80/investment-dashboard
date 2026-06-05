import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Modal, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

let LocalAuthentication = null;
if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
}

export default function CredentialsScreen() {
  const [credentials, setCredentials] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedCred, setSelectedCred] = useState(null);
  const [editCred, setEditCred] = useState(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceUrl, setServiceUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useFocusEffect(useCallback(() => { fetchCredentials(); }, []));

  async function fetchCredentials() {
    try {
      const { data } = await api.get('/credentials');
      setCredentials(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load credentials');
    }
  }

  async function viewCredential(id) {
    // Require biometric to view credentials (skip on web)
    if (LocalAuthentication) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view credential',
        cancelLabel: 'Cancel',
      });
      if (!result.success) return Alert.alert('Auth Failed', 'Biometric authentication required');
    }

    try {
      const { data } = await api.get(`/credentials/${id}`);
      setSelectedCred(data);
      setShowPassword(false);
      setViewModal(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to load credential');
    }
  }

  function openNew() {
    setEditCred(null); setServiceName(''); setServiceUrl(''); setUsername(''); setPassword(''); setNotes('');
    setModalVisible(true);
  }

  async function saveCred() {
    if (!serviceName || !username || !password) return Alert.alert('Error', 'Service, username, and password are required');
    try {
      const body = { serviceName, serviceUrl, username, password, notes };
      if (editCred) {
        await api.put(`/credentials/${editCred.id}`, body);
      } else {
        await api.post('/credentials', body);
      }
      setModalVisible(false);
      fetchCredentials();
    } catch (e) {
      Alert.alert('Error', 'Failed to save credential');
    }
  }

  async function deleteCred(id) {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api.delete(`/credentials/${id}`);
        fetchCredentials();
      }},
    ]);
  }

  const renderCred = ({ item }) => (
    <TouchableOpacity style={styles.credCard} onPress={() => viewCredential(item.id)} onLongPress={() => deleteCred(item.id)}>
      <View style={styles.credIcon}>
        <Ionicons name="key" size={24} color="#e94560" />
      </View>
      <View style={styles.credBody}>
        <Text style={styles.credService}>{item.serviceName}</Text>
        <Text style={styles.credUrl}>{item.serviceUrl || 'No URL'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList data={credentials} renderItem={renderCred} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No saved credentials. Tap + to add.</Text>} />

      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* View Credential Modal */}
      <Modal visible={viewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selectedCred?.serviceName}</Text>
            {selectedCred?.serviceUrl ? <Text style={styles.credUrlDetail}>{selectedCred.serviceUrl}</Text> : null}

            <Text style={styles.label}>Username</Text>
            <View style={styles.credField}>
              <Text style={styles.credValue}>{selectedCred?.username}</Text>
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.credField}>
              <Text style={styles.credValue}>{showPassword ? selectedCred?.password : '••••••••'}</Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {selectedCred?.notes ? (
              <>
                <Text style={styles.label}>Notes</Text>
                <Text style={styles.notesText}>{selectedCred.notes}</Text>
              </>
            ) : null}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setViewModal(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Credential Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editCred ? 'Edit Credential' : 'New Credential'}</Text>
            <TextInput style={styles.input} placeholder="Service Name (e.g. Gmail)" placeholderTextColor="#888"
              value={serviceName} onChangeText={setServiceName} />
            <TextInput style={styles.input} placeholder="URL (optional)" placeholderTextColor="#888"
              value={serviceUrl} onChangeText={setServiceUrl} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Username / Email" placeholderTextColor="#888"
              value={username} onChangeText={setUsername} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888"
              value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Notes (optional)" placeholderTextColor="#888" multiline
              value={notes} onChangeText={setNotes} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveCred}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  credCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 3 },
  credIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  credBody: { flex: 1 },
  credService: { fontSize: 16, color: '#fff', fontWeight: '600' },
  credUrl: { fontSize: 12, color: '#888', marginTop: 2 },
  empty: { color: '#666', textAlign: 'center', marginTop: 60, fontSize: 16 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#e94560', justifyContent: 'center', alignItems: 'center', elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#16213e', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#e94560', marginBottom: 16 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 16 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 8 },
  credField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f3460', borderRadius: 10, padding: 14 },
  credValue: { color: '#fff', fontSize: 16, flex: 1 },
  credUrlDetail: { color: '#53a8b6', fontSize: 13, marginBottom: 12 },
  notesText: { color: '#ccc', fontSize: 14, backgroundColor: '#0f3460', borderRadius: 10, padding: 14 },
  closeBtn: { backgroundColor: '#333', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  closeText: { color: '#fff', fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: { padding: 12, borderRadius: 8 },
  cancelText: { color: '#aaa', fontSize: 16 },
  saveBtn: { backgroundColor: '#e94560', padding: 12, paddingHorizontal: 24, borderRadius: 8 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
