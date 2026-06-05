import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Modal,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function NotesScreen() {
  const [notes, setNotes] = useState([]);
  const [editMode, setEditMode] = useState(false);   // full-screen edit
  const [viewMode, setViewMode] = useState(false);    // full-screen view
  const [currentNote, setCurrentNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useFocusEffect(useCallback(() => { fetchNotes(); }, []));

  async function fetchNotes() {
    try {
      const { data } = await api.get('/notes');
      setNotes(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load notes');
    }
  }

  function openNew() {
    setCurrentNote(null);
    setTitle('');
    setContent('');
    setEditMode(true);
  }

  function openView(note) {
    setCurrentNote(note);
    setTitle(note.title);
    setContent(note.content || '');
    setViewMode(true);
  }

  function switchToEdit() {
    setViewMode(false);
    setEditMode(true);
  }

  async function saveNote() {
    if (!title.trim()) return Alert.alert('Error', 'Title is required');
    try {
      if (currentNote) {
        await api.put(`/notes/${currentNote.id}`, { title, content });
      } else {
        await api.post('/notes', { title, content });
      }
      setEditMode(false);
      fetchNotes();
    } catch (e) {
      Alert.alert('Error', 'Failed to save note');
    }
  }

  async function deleteNote(id) {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api.delete(`/notes/${id}`);
        setViewMode(false);
        setEditMode(false);
        fetchNotes();
      }},
    ]);
  }

  const renderNote = ({ item }) => (
    <TouchableOpacity style={styles.noteCard} onPress={() => openView(item)} onLongPress={() => deleteNote(item.id)}>
      <Text style={styles.noteTitle}>{item.title}</Text>
      <Text style={styles.noteContent} numberOfLines={3}>{item.content}</Text>
      <Text style={styles.noteDate}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  // Full-screen View Mode
  if (viewMode && currentNote) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fullHeader}>
          <TouchableOpacity onPress={() => setViewMode(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.fullHeaderTitle} numberOfLines={1}>Note</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={switchToEdit} style={styles.headerBtn}>
              <Ionicons name="create-outline" size={22} color="#e94560" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteNote(currentNote.id)} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={22} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.fullBody} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.viewTitle}>{currentNote.title}</Text>
          <Text style={styles.viewDate}>{new Date(currentNote.updatedAt).toLocaleDateString()}</Text>
          <Text style={styles.viewContent}>{currentNote.content || 'No content'}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Full-screen Edit Mode
  if (editMode) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.fullHeader}>
            <TouchableOpacity onPress={() => { setEditMode(false); if (currentNote) setViewMode(true); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>{currentNote ? 'Edit Note' : 'New Note'}</Text>
            <TouchableOpacity onPress={saveNote} style={styles.saveHeaderBtn}>
              <Text style={styles.saveHeaderText}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.fullBody} contentContainerStyle={{ padding: 20 }}>
            <TextInput
              style={styles.editTitle}
              placeholder="Title"
              placeholderTextColor="#888"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.editContent}
              placeholder="Start writing..."
              placeholderTextColor="#666"
              multiline
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Notes List
  return (
    <View style={styles.container}>
      <FlatList data={notes} renderItem={renderNote} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet. Tap + to create one.</Text>} />
      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  noteCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 3 },
  noteTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 6 },
  noteContent: { fontSize: 14, color: '#ccc', marginBottom: 8 },
  noteDate: { fontSize: 11, color: '#666', textAlign: 'right' },
  empty: { color: '#666', textAlign: 'center', marginTop: 60, fontSize: 16 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#e94560', justifyContent: 'center', alignItems: 'center', elevation: 6 },

  // Full-screen header
  fullHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  backBtn: { padding: 6 },
  fullHeaderTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 6 },
  saveHeaderBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  saveHeaderText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Full-screen body
  fullBody: { flex: 1 },

  // View mode
  viewTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  viewDate: { fontSize: 12, color: '#666', marginBottom: 20 },
  viewContent: { fontSize: 16, color: '#ddd', lineHeight: 24 },

  // Edit mode
  editTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', borderBottomWidth: 1, borderBottomColor: '#0f3460', paddingBottom: 12, marginBottom: 16 },
  editContent: { fontSize: 16, color: '#ddd', lineHeight: 24, minHeight: 300 },
});
