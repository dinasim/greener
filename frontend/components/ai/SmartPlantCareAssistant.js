// components/ai/SmartPlantCareAssistant.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image,
  Alert, ActivityIndicator, SafeAreaView, Animated, Easing,
  KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationBar from '../NavigationBar';
import GreenerLogo from '../../assets/icon.png';

const API_BASE_URL     = 'https://usersfunctions.azurewebsites.net/api';
const DEFAULT_NAV_H    = 88;
const SAFE_BOTTOM_PAD  = Platform.OS === 'ios' ? 20 : 8;

export default function GreenerAssistant({ navigation }) {
  // UI
  const [kbVisible, setKbVisible]   = useState(false);
  const [navH, setNavH]             = useState(DEFAULT_NAV_H);
  const [composerH, setComposerH]   = useState(64);

  // Chat
  const [isLoading, setIsLoading]   = useState(false);
  const [question, setQuestion]     = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [ownerName, setOwnerName]   = useState('');

  const scrollViewRef = useRef(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-40)).current;

  // entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, []);

  // keyboard listeners
  useEffect(() => {
    const sEvt = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hEvt = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';
    const s = Keyboard.addListener(sEvt, () => setKbVisible(true));
    const h = Keyboard.addListener(hEvt, () => setKbVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);

  // keep scrolled to end
  useEffect(() => {
    const t = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [kbVisible, composerH, chatHistory.length]);

  // user display name
  useEffect(() => {
    (async () => {
      try {
        const userName  = await AsyncStorage.getItem('userName');
        const userEmail = await AsyncStorage.getItem('userEmail');
        setOwnerName(userName || userEmail || '');
      } catch {
        setOwnerName('');
      }
    })();
  }, []);

  // --- assistant call (no selected-plant info) ---
  const askAssistant = async (imageUri = null, userQuestion = '') => {
    if (!userQuestion.trim() && !imageUri) return;
    setIsLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const body = {
        // keep this plant-care focused even when no text
        message: userQuestion || "Analyze this plant's health and give care recommendations.",
        imageUri,
        userEmail
      };
      const r = await fetch(`${API_BASE_URL}/ai-plant-care-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`Service unavailable (${r.status})`);
      const json = await r.json();
      const aiResponse =
        json.message || json.response || json.diagnosis || 'No response received';
      const recommendations = Array.isArray(json.recommendations) ? json.recommendations : [];

      const newMsg = {
        id: Date.now(),
        type: 'ai_response',
        diagnosis: aiResponse,
        recommendations,
        timestamp: new Date().toISOString(),
        hasImage: !!imageUri
      };
      setChatHistory(prev => [...prev, newMsg]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to get a response');
    } finally {
      setIsLoading(false);
    }
  };

  // media pickers
  const handleImagePick = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) { Alert.alert('Permission required', 'Allow access to photos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.85,
    });
    if (!res.canceled && res.assets?.[0]) setSelectedImage(res.assets[0].uri);
  };
  const handleTakePhoto = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert('Permission required', 'Allow camera access.'); return; }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!res.canceled && res.assets?.[0]) setSelectedImage(res.assets[0].uri);
  };

  const startNewChatIfNeeded = () => {
    if (!showWelcome) return;
    setChatHistory([{
      id: Date.now(),
      type: 'ai_response',
      diagnosis: `Hi${ownerName ? ` ${ownerName}` : ''}! How can I help with your plants today?`,
      recommendations: [],
      timestamp: new Date().toISOString(),
      hasImage: false
    }]);
    setShowWelcome(false);
  };
// Bold parser: turns **...** into <Text style={styles.bold}>...</Text>
const renderWithBold = (text) => {
  if (!text) return null;
  const tokens = String(text).split(/(\*\*[^*]+?\*\*)/g); // keep **chunks** as separate tokens
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <Text key={`b-${i}`} style={styles.bold}>
          {tok.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={`t-${i}`}>{tok}</Text>;
  });
};

  const handleSubmitQuestion = () => {
    if (!question.trim() && !selectedImage) {
      Alert.alert('Input required', 'Type a question or add a photo');
      return;
    }
    startNewChatIfNeeded();
    const userMsg = {
      id: Date.now(),
      type: 'user_question',
      question: question.trim(),
      image: selectedImage,
      timestamp: new Date().toISOString()
    };
    setChatHistory(prev => [...prev, userMsg]);
    askAssistant(selectedImage, question.trim());
    setQuestion('');
    setSelectedImage(null);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const today = new Date().toDateString() === d.toDateString();
    return today ? `${h}:${m}` : `${d.toLocaleDateString()}, ${h}:${m}`;
  };

  // 🌿 Plant-care quick questions (generic, not tied to a specific plant)
  const QUICK_QUESTIONS = [
    { text: "What’s the right way to check soil moisture before watering?", icon: "grass" },
    { text: "Safe, natural ways to control common pests at home?", icon: "bug-report" },
    { text: "Beginner-friendly fertilizing schedule and dilution tips?", icon: "eco" },
    { text: "Room is dry—how can I improve humidity for plants?", icon: "cloud" },
  ];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea }>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.keyboardView}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerCenter}>
              <Image source={GreenerLogo} style={styles.headerLogo} />
              <View>
                <Text style={styles.headerTitle}>AI Plant Care</Text>
                <Text style={styles.headerSubtitle}>Your Smart Garden Assistant</Text>
              </View>
            </View>

            {!showWelcome && (
              <TouchableOpacity
                onPress={() => {
                  setChatHistory([{
                    id: Date.now(),
                    type: 'ai_response',
                    diagnosis: `Hi${ownerName ? ` ${ownerName}` : ''}! What plant issue can I help with next?`,
                    recommendations: [],
                    timestamp: new Date().toISOString(),
                    hasImage: false
                  }]);
                }}
                style={styles.clearBtn}
              >
                <MaterialIcons name="delete-sweep" size={18} color="#4CAF50" />
                <Text style={styles.clearTxt}>Clear</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Chat */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chat}
            contentContainerStyle={{ padding: 16, paddingBottom: (showWelcome ? 12 : (composerH + 16)) }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {showWelcome ? (
              <View style={{ alignItems: 'center', paddingTop: 32 }}>
                <Image source={GreenerLogo} style={styles.welcomeAvatar} />
                <Text style={styles.welcomeTitle}>Welcome to Greener AI! 🌱</Text>
                <Text style={styles.welcomeText}>
                  Ask about watering, light, soil, pests, humidity, repotting, and more. Add a photo for instant help.
                </Text>

                <View style={{ width: '100%', marginTop: 18 }}>
                  <Text style={styles.suggestTitle}>Quick Questions</Text>
                  {QUICK_QUESTIONS.map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionBtn}
                      onPress={() => {
                        setShowWelcome(false);
                        const userMsg = {
                          id: Date.now() + 1,
                          type: 'user_question',
                          question: s.text,
                          image: null,
                          timestamp: new Date().toISOString()
                        };
                        setChatHistory([userMsg]);
                        askAssistant(null, s.text);
                      }}
                    >
                      <MaterialIcons name={s.icon} size={16} color="#4CAF50" />
                      <Text style={styles.suggestionTxt}>{s.text}</Text>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.suggestionBtn, { backgroundColor: '#e8f5e8', borderColor: '#4CAF50', marginTop: 8 }]}
                    onPress={() => setShowWelcome(false)}
                  >
                    <MaterialIcons name="edit" size={16} color="#4CAF50" />
                    <Text style={styles.suggestionTxt}>Type your own question</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              chatHistory.map((m, i) => {
                const isUser = m.type === 'user_question';
                return (
                  <View key={`${m.id}-${i}`} style={[isUser ? styles.userRow : styles.aiRow]}>
                    {isUser ? (
                      <View style={styles.userBubble}>
                        {!!m.question && <Text style={styles.userText}>{m.question}</Text>}
                        {!!m.image && <Image source={{ uri: m.image }} style={styles.msgImage} />}
                        <Text style={styles.time}>{formatTime(m.timestamp)}</Text>
                      </View>
                    ) : (
                      <View style={styles.aiBubble}>
                        <View style={styles.aiHeader}>
                          <Image source={GreenerLogo} style={styles.aiAvatar} />
                          <View style={{ marginLeft: 8 }}>
                            <Text style={styles.aiTitle}>Greener AI</Text>
                            <Text style={styles.aiSub}>Plant Care Expert</Text>
                          </View>
                        </View>
                        {!!m.diagnosis && <Text style={styles.aiText}>{renderWithBold(m.diagnosis)}</Text>}

                        {!!m.recommendations?.length && (
                          <View style={{ marginTop: 10 }}>
                            {m.recommendations.map((r, j) => (
                              <View key={j} style={styles.recItem}>
                                <View style={styles.recDot} />
                                <Text style={styles.recTxt}>{renderWithBold(r)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Text style={[styles.time, { marginTop: 6 }]}>{formatTime(m.timestamp)}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Composer */}
          {!showWelcome && (
            <Animated.View
              style={styles.composer}
              onLayout={e => setComposerH(e.nativeEvent.layout.height)}
            >
              {selectedImage && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => setSelectedImage(null)}>
                    <MaterialIcons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputRow}>
                <View style={styles.textBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ask about plant care: watering, light, soil, pests, repotting…"
                    placeholderTextColor="#99a39b"
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={handleTakePhoto} style={styles.iconBtn}>
                    <MaterialIcons name="camera-alt" size={18} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleImagePick} style={styles.iconBtn}>
                    <MaterialIcons name="photo-library" size={18} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmitQuestion}
                    style={[styles.sendBtn, (!question.trim() && !selectedImage) && styles.sendBtnDisabled]}
                    disabled={(!question.trim() && !selectedImage) || isLoading}
                  >
                    {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={18} color="#fff" />}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Bottom Navigation */}
      <View
        style={{ opacity: kbVisible ? 0 : 1, height: kbVisible ? 0 : undefined }}
        onLayout={e => setNavH(e.nativeEvent.layout.height || DEFAULT_NAV_H)}
      >
        <NavigationBar currentTab="ai" navigation={navigation} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8f5e8',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerLogo: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#4CAF50', marginRight: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2e7d32', textAlign: 'center' },
  headerSubtitle: { fontSize: 11, color: '#66bb6a', textAlign: 'center' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  clearTxt: { marginLeft: 6, color: '#4CAF50', fontWeight: '600', fontSize: 13 },

  chat: { flex: 1, backgroundColor: '#f8fffe' },

  // welcome
  welcomeAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e8f5e8', borderWidth: 2, borderColor: '#4CAF50', marginBottom: 16 },
  welcomeTitle: { fontSize: 22, fontWeight: '700', color: '#2e7d32', marginBottom: 8, textAlign: 'center' },
  welcomeText: { fontSize: 15, color: '#66bb6a', textAlign: 'center', lineHeight: 22, paddingHorizontal: 18 },
  suggestTitle: { fontSize: 16, fontWeight: '700', color: '#2e7d32', textAlign: 'center', marginBottom: 10 },
  suggestionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8f5e8', marginBottom: 8 },
  suggestionTxt: { marginLeft: 10, color: '#2e7d32', fontSize: 14, flexShrink: 1 },

  // bubbles
  userRow: { alignItems: 'flex-end', marginBottom: 14 },
  aiRow: { alignItems: 'flex-start', marginBottom: 16 },

  userBubble: { maxWidth: '94%', backgroundColor: '#E3F2FD', borderRadius: 18, borderTopRightRadius: 4, paddingVertical: 12, paddingHorizontal: 14 },
  userText: { fontSize: 15, color: '#000' },
  time: { fontSize: 11, color: '#666', marginTop: 4 },
  msgImage: { width: 180, height: 180, borderRadius: 12, marginTop: 10 },

  aiBubble: { maxWidth: '94%', backgroundColor: '#e8f5e8', borderRadius: 22, borderTopLeftRadius: 8, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e8f5e8' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e8f5e8' },
  aiTitle: { fontSize: 14, fontWeight: '700', color: '#2e7d32' },
  aiSub: { fontSize: 11, color: '#66bb6a' },
  aiText: { fontSize: 14, color: '#424242', lineHeight: 21, backgroundColor: '#f8fffe', padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  recItem: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff8e1', padding: 10, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#FF9800', marginTop: 8 },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF9800', marginTop: 7, marginRight: 10 },
  recTxt: { fontSize: 13, color: '#424242', flex: 1, lineHeight: 19 },

  // composer
  composer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8f5e8', paddingHorizontal: 12, paddingVertical: 12, elevation: 5 },
  imagePreview: { position: 'relative', alignSelf: 'flex-start', marginBottom: 10 },
  previewImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f5f5f5' },
  removeImageButton: { position: 'absolute', top: -8, right: -8, backgroundColor: '#f44336', borderRadius: 12, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  textBox: { flex: 1, backgroundColor: '#f8fffe', borderRadius: 20, borderWidth: 1, borderColor: '#e8f5e8', marginRight: 6, paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, maxHeight: 120 },
  input: { fontSize: 15, color: '#2e7d32', lineHeight: 20, maxHeight: 90 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8, borderRadius: 18, backgroundColor: '#f8fffe', marginRight: 6, borderWidth: 1, borderColor: '#e8f5e8' },
  sendBtn: { backgroundColor: '#4CAF50', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#bdbdbd' },
  bold: { fontWeight: '700' },

});
