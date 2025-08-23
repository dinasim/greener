// screens/AIPlantCareAssistant.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CosmosDbService from '../services/CosmosDbService';
import MainLayout from '../components/MainLayout';

const AI_CHAT_API = 'https://usersfunctions.azurewebsites.net/api/ai-plant-care-chat';

// Adjust this if your NavigationBar is taller/shorter
const NAV_H = 96;

export default function AIPlantCareAssistant({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusiness, setIsBusiness] = useState(false);

  const [composerH, setComposerH] = useState(60);

  const scrollViewRef = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const typing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      if (route?.params?.business === true) { setIsBusiness(true); }
      else {
        const ut = await AsyncStorage.getItem('userType');
        const bid = await AsyncStorage.getItem('businessId');
        setIsBusiness(ut === 'business' || !!bid);
      }
    })();
  }, [route?.params]);

  useEffect(() => {
    init();
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!isTyping) { typing.stopAnimation(); typing.setValue(0); return; }
    Animated.loop(
      Animated.sequence([
        Animated.timing(typing, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(typing, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, [isTyping]);

  const init = async () => {
    try {
      setIsInitializing(true);
      const uid = await AsyncStorage.getItem('currentUserId');
      setUserId(uid || null);

      let sessionId = await AsyncStorage.getItem('aiChatSession');
      if (!sessionId) {
        sessionId = `${uid ? uid.slice(0, 8) + '_' : ''}chat_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`;
        await AsyncStorage.setItem('aiChatSession', sessionId);
      }
      setChatSession(sessionId);

      const history = await CosmosDbService.getChatHistory(sessionId);
      if (history?.length) {
        setMessages(history);
      } else {
        const welcome = {
          id: Date.now().toString(),
          text:
            "🌿 Hello! I'm your AI Plant Care Assistant. Ask me about watering, pests, light, soil, and more.",
          isUser: false,
          timestamp: new Date(),
          type: 'welcome',
        };
        setMessages([welcome]);
        await CosmosDbService.saveChatMessages(sessionId, [welcome]);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Connection Error', 'Unable to start the chat.');
      navigation.goBack?.();
    } finally {
      setIsInitializing(false);
    }
  };

  const saveMessages = async (arr) => {
    if (!chatSession) return;
    try { await CosmosDbService.saveChatMessages(chatSession, arr); }
    catch (e) { /* non-fatal */ }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    const userMsg = { id: Date.now().toString(), text: inputText.trim(), isUser: true, timestamp: new Date() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInputText('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      await saveMessages([userMsg]);
      const context = next.slice(-10).map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text }));

      const res = await fetch(AI_CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text, context, sessionId: chatSession, specialization: 'plant_care' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Sorry, something went wrong. Try again.',
        isUser: false,
        timestamp: new Date(),
        confidence: data.confidence,
      };
      const final = [...next, aiMsg];
      setMessages(final);
      await saveMessages([aiMsg]);
    } catch (e) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting. Please try again.",
        isUser: false,
        timestamp: new Date(),
        type: 'error',
      };
      setMessages(prev => [...prev, errMsg]);
      await saveMessages([errMsg]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const clearChat = () => {
    Alert.alert('Clear chat?', 'This will remove the entire conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLoading(true);
            await CosmosDbService.deleteChatHistory(chatSession);
            const newId = `${userId ? userId.slice(0, 8) + '_' : ''}chat_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 9)}`;
            await AsyncStorage.setItem('aiChatSession', newId);
            setChatSession(newId);
            const welcome = {
              id: Date.now().toString(),
              text:
                "🌿 Hello! I'm your AI Plant Care Assistant. Ask me about watering, pests, light, soil, and more.",
              isUser: false,
              timestamp: new Date(),
              type: 'welcome',
            };
            setMessages([welcome]);
            await CosmosDbService.saveChatMessages(newId, [welcome]);
          } finally { setIsLoading(false); }
        },
      },
    ]);
  };

  const suggestions = [
    'How often should I water a fiddle leaf fig?',
    'Yellow leaves—overwatered or underwatered?',
    'Best low-light plants for bedrooms?',
    'How do I propagate pothos in water?',
  ];

  const renderMessage = (m) => {
    const isUser = m.isUser;
    return (
      <View key={m.id} style={[styles.msgRow, isUser ? styles.rowUser : styles.rowAI]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="leaf" size={14} color="#4CAF50" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>{m.text}</Text>
          {m.confidence != null && (
            <Text style={[styles.ts, isUser ? styles.tsUser : styles.tsAI]}>
              Confidence: {Math.round(m.confidence * 100)}%
            </Text>
          )}
          <Text style={[styles.ts, isUser ? styles.tsUser : styles.tsAI]}>
            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isUser && (
          <View style={styles.userAvatar}>
            <MaterialIcons name="person" size={12} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const typingIndicator = !isTyping ? null : (
    <View style={[styles.msgRow, styles.rowAI]}>
      <View style={styles.aiAvatar}>
        <MaterialCommunityIcons name="leaf" size={14} color="#4CAF50" />
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.dot, { opacity: typing }]} />
          <Animated.View style={[styles.dot, { opacity: typing }]} />
          <Animated.View style={[styles.dot, { opacity: typing }]} />
        </View>
        <Text style={styles.typingText}>AI is thinking…</Text>
      </View>
    </View>
  );

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingNote}>Loading your plant care assistant…</Text>
      </SafeAreaView>
    );
  }

  const screen = (
    <SafeAreaView
      style={[
        styles.screen,
        // Reserve space for bottom NavigationBar so it never overlaps
        !isBusiness && { paddingBottom: NAV_H + insets.bottom },
      ]}
    >
      {/* Slimmer header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn}>
          <MaterialIcons name="arrow-back" size={20} color="#2e7d32" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>AI Plant Care</Text>
        <TouchableOpacity onPress={clearChat} style={styles.hBtn}>
          <MaterialIcons name="delete-outline" size={20} color="#2e7d32" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={{ padding: 16, paddingBottom: composerH + 12 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(renderMessage)}
          {typingIndicator}
          {messages.length <= 1 && (
            <View style={styles.suggestions}>
              {suggestions.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggBtn} onPress={() => setInputText(s)}>
                  <Text style={styles.suggTxt}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          keyboardVerticalOffset={insets.top + (!isBusiness ? NAV_H : 0)}
          onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}
          style={styles.composerWrap}
        >
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about watering, pests, light, soil…"
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.send, (!inputText.trim() || isLoading) && styles.sendDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );

  if (!isBusiness) {
    return (
      <MainLayout
        currentTab="ai"
        onTabPress={(tab) => navigation.navigate(tab === 'plants' ? 'Locations' : tab.charAt(0).toUpperCase() + tab.slice(1))}
      >
        {screen}
      </MainLayout>
    );
  }
  return screen;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F7' },

  // Header
  header: {
    height: 54,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E7F0E7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  hBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0F7F0',
  },
  hTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
  },

  body: { flex: 1 },
  messages: { flex: 1 },

  // Messages
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowAI: { justifyContent: 'flex-start' },

  aiAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#EAF7EA',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  userAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },

  bubble: {
    maxWidth: '94%', // wider bubbles
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  bubbleUser: { backgroundColor: '#4CAF50', borderBottomRightRadius: 6 },
  bubbleAI: { backgroundColor: '#fff', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#E6EDE6' },

  bubbleText: { fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },
  aiText: { color: '#222' },

  ts: { marginTop: 6, fontSize: 11 },
  tsUser: { color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  tsAI: { color: '#8A8A8A' },

  // Typing
  typingBubble: { paddingVertical: 12 },
  typingDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50', marginHorizontal: 3 },
  typingText: { fontSize: 12, color: '#666', textAlign: 'center' },

  // Suggestions
  suggestions: { marginTop: 6 },
  suggBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E6EDE6',
  },
  suggTxt: { fontSize: 14, color: '#333', textAlign: 'center' },

  // Composer
  composerWrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E6EDE6',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  input: {
    flex: 1,
    backgroundColor: '#F4F6F4',
    borderWidth: 1,
    borderColor: '#E0E6E0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    marginRight: 10,
  },
  send: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2,
  },
  sendDisabled: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0 },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9F7' },
  loadingNote: { marginTop: 12, color: '#4CAF50', fontSize: 16 },
});
