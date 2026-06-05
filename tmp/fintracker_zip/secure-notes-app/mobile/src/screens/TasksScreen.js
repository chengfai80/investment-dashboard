import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

// DateTimePicker only on native; web uses <input type="date">
let DateTimePicker = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const PRIORITY_COLORS = { low: '#2ecc71', medium: '#f39c12', high: '#e74c3c' };

export default function TasksScreen() {
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(useCallback(() => { fetchTasks(); }, []));

  async function fetchTasks() {
    try {
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load tasks');
    }
  }

  function openNew() {
    setCurrentTask(null);
    setTitle(''); setDescription(''); setPriority('medium'); setDueDate('');
    setSubtasks([]); setNewSubtask('');
    setEditMode(true);
  }

  function openView(task) {
    setCurrentTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueDate(task.dueDate || '');
    setSubtasks(task.subtasks || []);
    setViewMode(true);
  }

  function switchToEdit() {
    setViewMode(false);
    setEditMode(true);
  }

  function addSubtask() {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { id: `sub_${Date.now()}`, title: newSubtask.trim(), completed: false }]);
    setNewSubtask('');
  }

  function removeSubtask(id) {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  }

  function onDateChange(event, selectedDate) {
    setShowDatePicker(Platform.OS === 'ios'); // iOS keeps picker open, Android closes
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setDueDate(`${y}-${m}-${d}`);
    }
  }

  function getDateObject() {
    if (dueDate) {
      const parsed = new Date(dueDate + 'T00:00:00');
      if (!isNaN(parsed)) return parsed;
    }
    return new Date();
  }

  async function saveTask() {
    if (!title.trim()) return Alert.alert('Error', 'Title is required');
    try {
      const body = { title, description, priority, dueDate: dueDate || null, subtasks };
      if (currentTask) {
        await api.put(`/tasks/${currentTask.id}`, body);
      } else {
        await api.post('/tasks', body);
      }
      setEditMode(false);
      fetchTasks();
    } catch (e) {
      Alert.alert('Error', 'Failed to save task');
    }
  }

  async function toggleTask(id) {
    try {
      await api.patch(`/tasks/${id}/toggle`);
      fetchTasks();
    } catch (e) {
      Alert.alert('Error', 'Failed to toggle task');
    }
  }

  async function toggleSubtask(taskId, subtaskId) {
    try {
      const { data } = await api.patch(`/tasks/${taskId}/subtask/${subtaskId}/toggle`);
      // Update local state for view mode
      setSubtasks(data.subtasks || []);
      setCurrentTask((prev) => prev ? { ...prev, subtasks: data.subtasks } : prev);
      fetchTasks();
    } catch (e) {
      Alert.alert('Error', 'Failed to toggle subtask');
    }
  }

  async function deleteTask(id) {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api.delete(`/tasks/${id}`);
        setViewMode(false);
        setEditMode(false);
        fetchTasks();
      }},
    ]);
  }

  // Full-screen View Mode
  if (viewMode && currentTask) {
    const completedCount = (subtasks || []).filter((s) => s.completed).length;
    const totalSubs = (subtasks || []).length;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fullHeader}>
          <TouchableOpacity onPress={() => setViewMode(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.fullHeaderTitle} numberOfLines={1}>Task</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={switchToEdit} style={styles.headerBtn}>
              <Ionicons name="create-outline" size={22} color="#e94560" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTask(currentTask.id)} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={22} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.fullBody} contentContainerStyle={{ padding: 20 }}>
          {/* Task header */}
          <View style={styles.viewHeaderRow}>
            <TouchableOpacity onPress={() => toggleTask(currentTask.id)}>
              <Ionicons
                name={currentTask.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={28} color={currentTask.completed ? '#2ecc71' : '#666'} />
            </TouchableOpacity>
            <Text style={[styles.viewTitle, currentTask.completed && styles.completedText]}>
              {currentTask.title}
            </Text>
          </View>

          {/* Meta info */}
          <View style={styles.metaRow}>
            <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[currentTask.priority] }]}>
              <Text style={styles.priorityBadgeText}>{currentTask.priority.toUpperCase()}</Text>
            </View>
            {currentTask.dueDate && (
              <Text style={styles.viewDue}>Due: {currentTask.dueDate}</Text>
            )}
          </View>

          {/* Description */}
          {description ? (
            <View style={styles.descSection}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.viewDescription}>{description}</Text>
            </View>
          ) : null}

          {/* Sub-tasks */}
          {totalSubs > 0 && (
            <View style={styles.subtaskSection}>
              <View style={styles.subtaskHeader}>
                <Text style={styles.sectionLabel}>Sub-tasks</Text>
                <Text style={styles.subtaskCount}>{completedCount}/{totalSubs}</Text>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${totalSubs > 0 ? (completedCount / totalSubs) * 100 : 0}%` }]} />
              </View>
              {subtasks.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.subtaskRow}
                  onPress={() => toggleSubtask(currentTask.id, sub.id)}
                >
                  <Ionicons
                    name={sub.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22} color={sub.completed ? '#2ecc71' : '#666'} />
                  <Text style={[styles.subtaskText, sub.completed && styles.completedText]}>
                    {sub.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
            <TouchableOpacity onPress={() => { setEditMode(false); if (currentTask) setViewMode(true); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>{currentTask ? 'Edit Task' : 'New Task'}</Text>
            <TouchableOpacity onPress={saveTask} style={styles.saveHeaderBtn}>
              <Text style={styles.saveHeaderText}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.fullBody} contentContainerStyle={{ padding: 20 }}>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#888"
              value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Description" placeholderTextColor="#888" multiline
              value={description} onChangeText={setDescription} />

            <Text style={styles.label}>Due Date</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.datePickerBtn}>
                <Ionicons name="calendar-outline" size={20} color="#e94560" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    flex: 1, backgroundColor: 'transparent', color: '#fff',
                    border: 'none', fontSize: 16, outline: 'none',
                  }}
                />
                {dueDate ? (
                  <TouchableOpacity onPress={() => setDueDate('')}>
                    <Ionicons name="close-circle" size={20} color="#888" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color="#e94560" />
                  <Text style={styles.datePickerText}>
                    {dueDate || 'Select a date'}
                  </Text>
                  {dueDate ? (
                    <TouchableOpacity onPress={() => setDueDate('')}>
                      <Ionicons name="close-circle" size={20} color="#888" />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
                {showDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={getDateObject()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                    themeVariant="dark"
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {['low', 'medium', 'high'].map((p) => (
                <TouchableOpacity key={p} onPress={() => setPriority(p)}
                  style={[styles.priorityBtn, priority === p && { backgroundColor: PRIORITY_COLORS[p] }]}>
                  <Text style={[styles.priorityText, priority === p && { color: '#fff' }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sub-tasks editor */}
            <Text style={styles.label}>Sub-tasks</Text>
            {subtasks.map((sub) => (
              <View key={sub.id} style={styles.subtaskEditRow}>
                <Ionicons name={sub.completed ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20} color={sub.completed ? '#2ecc71' : '#666'} />
                <Text style={[styles.subtaskEditText, sub.completed && styles.completedText]}>{sub.title}</Text>
                <TouchableOpacity onPress={() => removeSubtask(sub.id)}>
                  <Ionicons name="close-circle" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.addSubtaskRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Add sub-task" placeholderTextColor="#888"
                value={newSubtask} onChangeText={setNewSubtask}
                onSubmitEditing={addSubtask} returnKeyType="done" />
              <TouchableOpacity onPress={addSubtask} style={styles.addSubBtn}>
                <Ionicons name="add-circle" size={32} color="#e94560" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Tasks List
  const renderTask = ({ item }) => {
    const subCount = (item.subtasks || []).length;
    const subDone = (item.subtasks || []).filter((s) => s.completed).length;
    return (
      <View style={styles.taskCard}>
        <TouchableOpacity style={styles.checkbox} onPress={() => toggleTask(item.id)}>
          <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={24} color={item.completed ? '#2ecc71' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.taskBody} onPress={() => openView(item)} onLongPress={() => deleteTask(item.id)}>
          <Text style={[styles.taskTitle, item.completed && styles.completedText]}>{item.title}</Text>
          <View style={styles.taskMeta}>
            {item.dueDate && <Text style={styles.taskDue}>Due: {item.dueDate}</Text>}
            {subCount > 0 && <Text style={styles.taskSubInfo}>{subDone}/{subCount} sub-tasks</Text>}
          </View>
        </TouchableOpacity>
        <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList data={tasks} renderItem={renderTask} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No tasks. Tap + to add one.</Text>} />
      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // List styles
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 3 },
  checkbox: { marginRight: 12 },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  completedText: { textDecorationLine: 'line-through', color: '#666' },
  taskMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  taskDue: { fontSize: 12, color: '#888' },
  taskSubInfo: { fontSize: 12, color: '#53a8b6' },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
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
  fullBody: { flex: 1 },

  // View mode
  viewHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  viewTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  priorityBadge: { borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  priorityBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  viewDue: { color: '#888', fontSize: 13 },
  descSection: { marginBottom: 24 },
  sectionLabel: { color: '#e94560', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  viewDescription: { color: '#ddd', fontSize: 15, lineHeight: 22 },

  // Sub-tasks view
  subtaskSection: { marginTop: 4 },
  subtaskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subtaskCount: { color: '#888', fontSize: 13 },
  progressBar: { height: 4, backgroundColor: '#0f3460', borderRadius: 2, marginBottom: 14 },
  progressFill: { height: 4, backgroundColor: '#2ecc71', borderRadius: 2 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  subtaskText: { color: '#ddd', fontSize: 15, flex: 1 },

  // Edit mode
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 16 },
  label: { color: '#aaa', marginBottom: 8, marginTop: 4, fontSize: 14 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f3460', borderRadius: 10, padding: 14, marginBottom: 14 },
  datePickerText: { color: '#fff', fontSize: 16, flex: 1 },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  priorityBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  priorityText: { color: '#aaa', fontWeight: '500' },
  subtaskEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f3460', borderRadius: 8, padding: 12, marginBottom: 8 },
  subtaskEditText: { color: '#ddd', fontSize: 15, flex: 1 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  addSubBtn: { padding: 4 },
});
