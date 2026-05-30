import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createTransaction } from '../api/client';

export default function AddTransactionScreen() {
  const [collection, setCollection] = useState('expensesummary');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const save = async () => {
    try {
      await createTransaction(collection, {
        Description: description,
        Amount: Number(amount),
        Date: new Date().toISOString(),
      });
      Alert.alert('Saved', 'Transaction created');
      setDescription('');
      setAmount('');
    } catch (err) {
      Alert.alert('Save failed', err?.response?.data?.detail || err?.message || 'Unknown error');
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Add Transaction</Text>
      <TextInput style={styles.input} value={collection} onChangeText={setCollection} placeholder="Collection" placeholderTextColor="#64748b" />
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor="#64748b" />
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="numeric" placeholderTextColor="#64748b" />
      <Pressable style={styles.button} onPress={save}><Text style={styles.buttonText}>Save</Text></Pressable>
      <Text style={styles.note}>Use this as the first test endpoint for the Expo app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617', padding: 16 },
  h1: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 16 },
  input: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  button: { backgroundColor: '#f59e0b', borderRadius: 16, padding: 14, alignItems: 'center' },
  buttonText: { color: '#0f172a', fontWeight: '800' },
  note: { color: '#94a3b8', marginTop: 14 },
});
