import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  inputBg: '#0f3460',
  accent: '#e94560',
  accentDim: 'rgba(233, 69, 96, 0.15)',
  green: '#0ead69',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b8',
  cardBorder: 'rgba(255,255,255,0.06)',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function AIChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  // Set header button
  useEffect(() => {
    if (navigation) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={handleClear} style={{ marginRight: 16 }}>
            <Ionicons name="trash-outline" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation]);

  // Load history on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/ai/history');
        const history = Array.isArray(data) ? data : data?.messages ?? data?.history ?? [];
        setMessages(history);
      } catch (_) {
        // no history
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/api/ai/chat', { message: text });
      const aiContent = data?.response ?? data?.message ?? data?.reply ?? 'No response received.';
      const aiMsg = { role: 'assistant', content: aiContent, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    const doDelete = async () => {
      try {
        await api.delete('/api/ai/history');
        setMessages([]);
      } catch (_) {
        Alert.alert('Error', 'Failed to clear chat history.');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Clear all chat history?')) doDelete();
    } else {
      Alert.alert('Clear Chat', 'Are you sure you want to clear all chat history?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  function renderMessage({ item }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isUser && (
          <View style={styles.avatarCircle}>
            <Ionicons name="sparkles" size={16} color={COLORS.accent} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser && { color: '#ffffff' }]}>{item.content}</Text>
          {item.timestamp && (
            <Text style={styles.timestampText}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>Financial Mate AI</Text>
            <Text style={styles.emptySubtext}>
              Ask me anything about your finances, budgets, or spending patterns.
            </Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Thinking indicator */}
      {sending && (
        <View style={styles.thinkingBar}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={styles.thinkingText}>AI is thinking...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your finances..."
          placeholderTextColor={COLORS.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!sending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },

  messagesList: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  bubbleWrapper: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleLeft: { alignSelf: 'flex-start' },

  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },

  bubble: { borderRadius: 16, padding: 12, maxWidth: '100%' },
  userBubble: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.cardBorder },

  bubbleText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  timestampText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  thinkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  thinkingText: { color: COLORS.textSecondary, fontSize: 13, marginLeft: 8 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: COLORS.textPrimary,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtext: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
