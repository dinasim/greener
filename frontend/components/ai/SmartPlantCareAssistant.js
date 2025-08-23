// components/ai/SmartPlantCareAssistant.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image,
  Alert, ActivityIndicator, SafeAreaView, Animated, Easing, Dimensions,
  KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationBar from '../NavigationBar';
import GreenerLogo from '../../assets/icon.png';
import { getBusinessInventory, getBusinessProfile } from '../../Business/services/businessApi';

const PLANT_SEARCH_URL = 'https://usersfunctions.azurewebsites.net/api/plant_search';
const API_BASE_URL     = 'https://usersfunctions.azurewebsites.net/api';
const { width }        = Dimensions.get('window');

const DEFAULT_NAV_H   = 88;                          // fallback nav height
const SAFE_BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 8;

export default function GreenerPlantCareAssistant({ navigation, route }) {
  const routePlant   = route?.params?.plant || null;
  const onSelectPlant = route?.params?.onSelectPlant;

  // ui state
  const [kbVisible, setKbVisible] = useState(false);
  const [navH, setNavH]           = useState(DEFAULT_NAV_H); // measured nav height
  const [composerH, setComposerH] = useState(64);

  // chat state
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion]   = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [lastChatHistory, setLastChatHistory] = useState([]);
  const [persona, setPersona] = useState('business');
  const [ownerName, setOwnerName] = useState('');
  const [plantSelectVisible, setPlantSelectVisible] = useState(false);
  const [inventoryPlants, setInventoryPlants] = useState([]);
  const [plantSearchResults, setPlantSearchResults] = useState([]);
  const [plantSearchQuery, setPlantSearchQuery] = useState('');
  const [plantTab, setPlantTab] = useState('inventory');
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [isPlantSearchLoading, setIsPlantSearchLoading] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(routePlant);

  const scrollViewRef = useRef(null);
  const plantSearchDebounce = useRef(null);

  // simple entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, []);

  // keyboard listeners (hide nav + adjust paddings)
  useEffect(() => {
    const sEvt = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hEvt = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';
    const s = Keyboard.addListener(sEvt, () => setKbVisible(true));
    const h = Keyboard.addListener(hEvt, () => setKbVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);

  // keep scrolled to end when layout changes
  useEffect(() => {
    const t = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [kbVisible, composerH, chatHistory.length]);

  // detect persona + owner name
  useEffect(() => {
    (async () => {
      let p = 'business', name = '';
      try {
        const storedPersona = await AsyncStorage.getItem('persona');
        if (storedPersona === 'consumer') {
          p = 'consumer';
          const userName  = await AsyncStorage.getItem('userName');
          const userEmail = await AsyncStorage.getItem('userEmail');
          name = userName || userEmail || 'there';
        } else {
          const profile = await getBusinessProfile();
          name = profile?.contactName || profile?.name || profile?.businessName || 'there';
        }
      } catch { name = 'there'; }
      setPersona(p);
      setOwnerName(name);
    })();
  }, []);

  // ---- plant sources ----
  const fetchInventoryPlants = async () => {
    setIsInventoryLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) throw new Error('No user email');
      let plants = [];
      if (persona === 'consumer') {
        const res  = await fetch(`${API_BASE_URL}/getalluserplants?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(loc => {
            if (Array.isArray(loc.plants)) {
              loc.plants.forEach(p => plants.push({ ...p, name: p.nickname || p.common_name, mainImage: p.image_url }));
            }
          });
        }
      } else {
        const inv = await getBusinessInventory(userEmail);
        plants = (inv.inventory || inv || []).filter(it => it.productType === 'plant' || it.category === 'Plants');
      }
      setInventoryPlants(plants);
    } catch {
      setInventoryPlants([]);
    } finally { setIsInventoryLoading(false); }
  };

  const fetchGeneralPlants = async (q = '') => {
    try {
      let url = PLANT_SEARCH_URL;
      if (q && q.length >= 2) url += `?name=${encodeURIComponent(q)}`;
      const res  = await fetch(url);
      const data = await res.json();
      const norm = p => ({
        id: p.id,
        name: p.common_name || p.name || '',
        common_name: p.common_name || '',
        scientific_name: p.scientific_name || p.latin_name || '',
        mainImage: p.image_url || (Array.isArray(p.image_urls) ? p.image_urls[0] : null) || null,
      });
      setPlantSearchResults((data || []).map(norm));
    } catch { setPlantSearchResults([]); }
  };

  useEffect(() => {
    if (plantTab !== 'all') return;
    if (plantSearchDebounce.current) clearTimeout(plantSearchDebounce.current);
    if (plantSearchQuery.length >= 2) {
      setIsPlantSearchLoading(true);
      plantSearchDebounce.current = setTimeout(async () => {
        try { await fetchGeneralPlants(plantSearchQuery); }
        finally { setIsPlantSearchLoading(false); }
      }, 350);
    } else {
      setPlantSearchResults([]);
      setIsPlantSearchLoading(false);
    }
    return () => plantSearchDebounce.current && clearTimeout(plantSearchDebounce.current);
  }, [plantSearchQuery, plantTab]);

  // ---- chat helpers ----
  const analyzePlantHealth = async (imageUri = null, userQuestion = '') => {
    if (!userQuestion.trim() && !imageUri) return;
    setIsLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const body = {
        message: userQuestion || "Analyze this plant's health and provide care recommendations",
        plantInfo: selectedPlant ? {
          name: selectedPlant.name || selectedPlant.common_name,
          scientificName: selectedPlant.scientific_name,
          waterDays: selectedPlant.water_days,
          light: selectedPlant.light,
          humidity: selectedPlant.humidity
        } : null,
        imageUri, userEmail
      };
      const r = await fetch(`${API_BASE_URL}/ai-plant-care-chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`AI service unavailable (${r.status})`);
      const json = await r.json();
      const aiResponse = json.message || json.diagnosis || json.response || 'No response received';
      const recs = Array.isArray(json.recommendations) ? json.recommendations : [];
      const newMsg = {
        id: Date.now(), type: 'ai_response', question: userQuestion, diagnosis: aiResponse,
        recommendations: recs, timestamp: new Date().toISOString(), hasImage: !!imageUri
      };
      setChatHistory(prev => [...prev, newMsg]);
      setDiagnosis(aiResponse);
      setRecommendations(recs);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to analyze plant');
    } finally { setIsLoading(false); }
  };

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
      diagnosis: `Hello ${ownerName || 'there'}, how can I help you with your plants today?`,
      recommendations: [],
      timestamp: new Date().toISOString(),
      hasImage: false
    }]);
    setShowWelcome(false);
  };

  const handleSubmitQuestion = () => {
    if (!question.trim() && !selectedImage) {
      Alert.alert('Input required', 'Ask a question or add a photo');
      return;
    }
    startNewChatIfNeeded();
    const userMsg = {
      id: Date.now(), type: 'user_question', question: question.trim(),
      image: selectedImage, timestamp: new Date().toISOString()
    };
    setChatHistory(prev => [...prev, userMsg]);
    analyzePlantHealth(selectedImage, question.trim());
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

  // --- Plant modal helpers ---
  const handleOpenPlantPicker = () => { setPlantSelectVisible(true); fetchInventoryPlants(); };
  const handleSelectPlant     = (plant) => { setSelectedPlant(plant); setPlantSelectVisible(false); onSelectPlant && onSelectPlant(plant); };

  // bottom padding: reserve for nav when keyboard hidden; keep small safe pad when keyboard shown
  const bottomPad = kbVisible ? SAFE_BOTTOM_PAD : navH;

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
                  setLastChatHistory(chatHistory);
                  setChatHistory([{
                    id: Date.now(),
                    type: 'ai_response',
                    diagnosis: `Hello ${ownerName || 'there'}, how can I help you today?`,
                    recommendations: [],
                    timestamp: new Date().toISOString(),
                    hasImage: false
                  }]);
                  setDiagnosis(null);
                  setRecommendations([]);
                }}
                style={styles.clearBtn}
              >
                <MaterialIcons name="delete-sweep" size={18} color="#4CAF50" />
                <Text style={styles.clearTxt}>Clear</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Plant info bar */}
          <Animated.View style={[styles.plantInfoBar, { transform: [{ translateY: slideAnim }] }]}>
            <Image
              source={selectedPlant?.mainImage ? { uri: selectedPlant.mainImage } : GreenerLogo}
              style={styles.plantInfoImg}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.plantInfoName}>{selectedPlant?.name || selectedPlant?.common_name || 'No plant selected'}</Text>
              <Text style={styles.plantInfoSci}>{selectedPlant?.scientific_name || ''}</Text>
            </View>
            <TouchableOpacity onPress={handleOpenPlantPicker} style={styles.editPlantBtn}>
              <MaterialIcons name="edit" size={14} color="#4CAF50" />
            </TouchableOpacity>
          </Animated.View>

          {/* Chat list */}
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
                  Ask about plant health, watering, light, pests, or upload a photo for instant help.
                </Text>

                <View style={{ width: '100%', marginTop: 18 }}>
                  <Text style={styles.suggestTitle}>Quick Questions</Text>
                  {[
                    { text: "Why are my plant's leaves turning yellow?", icon: "help-outline" },
                    { text: "How often should I water this plant?", icon: "opacity" },
                    { text: "Is my plant getting enough light?", icon: "wb-sunny" },
                    { text: "How to treat plant pests naturally?", icon: "bug-report" },
                    { text: "When should I repot my plant?", icon: "home" },
                  ].map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionBtn}
                      onPress={() => {
                        setShowWelcome(false);
                        const userMsg = {
                          id: Date.now() + 1, type: 'user_question', question: s.text, image: null,
                          timestamp: new Date().toISOString()
                        };
                        setChatHistory([userMsg]);
                        analyzePlantHealth(null, s.text);
                      }}
                    >
                      <MaterialIcons name={s.icon} size={16} color="#4CAF50" />
                      <Text style={styles.suggestionTxt}>{s.text}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* RESTORED: type your own option */}
                  <TouchableOpacity
                    style={[styles.suggestionBtn, { backgroundColor: '#e8f5e8', borderColor: '#4CAF50', marginTop: 8 }]}
                    onPress={() => {
                      setShowWelcome(false);
                      // Just reveal composer; first AI greeting will appear on first send
                    }}
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
                        {!!m.diagnosis && <Text style={styles.aiText}>{m.diagnosis}</Text>}
                        {!!m.recommendations?.length && (
                          <View style={{ marginTop: 10 }}>
                            {m.recommendations.map((r, j) => (
                              <View key={j} style={styles.recItem}>
                                <View style={styles.recDot} />
                                <Text style={styles.recTxt}>{r}</Text>
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
                    placeholder="Ask about your plant's care, health, or problems..."
                    placeholderTextColor="#99a39b"
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={handleOpenPlantPicker} style={styles.iconBtn}>
                    <MaterialIcons name="local-florist" size={18} color="#4CAF50" />
                  </TouchableOpacity>
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

      {/* PLANT SELECT MODAL (unchanged content) */}
      {plantSelectVisible && (
        <View style={StyleSheet.absoluteFillObject}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Plant</Text>
              <TouchableOpacity onPress={() => setPlantSelectVisible(false)} style={styles.modalCloseButton}>
                <MaterialIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTabs}>
              <TouchableOpacity
                onPress={() => { setPlantTab('inventory'); setPlantSearchQuery(''); }}
                style={[styles.modalTab, plantTab === 'inventory' && styles.modalTabActive]}
              >
                <MaterialIcons name="inventory" size={18} color={plantTab === 'inventory' ? '#4CAF50' : '#888'} />
                <Text style={[styles.modalTabText, plantTab === 'inventory' && styles.modalTabTextActive]}>
                  {persona === 'consumer' ? 'My Plants' : 'Business Inventory'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setPlantTab('all'); setPlantSearchQuery(''); fetchGeneralPlants(); }}
                style={[styles.modalTab, plantTab === 'all' && styles.modalTabActive]}
              >
                <MaterialIcons name="search" size={18} color={plantTab === 'all' ? '#4CAF50' : '#888'} />
                <Text style={[styles.modalTabText, plantTab === 'all' && styles.modalTabTextActive]}>All Plants</Text>
              </TouchableOpacity>
            </View>

            {plantTab === 'all' && (
              <View style={styles.searchRow}>
                <MaterialIcons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search plants..."
                  value={plantSearchQuery}
                  onChangeText={setPlantSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
              {(isInventoryLoading && plantTab === 'inventory') || (isPlantSearchLoading && plantTab === 'all') ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                  <Text style={{ color: '#66bb6a', marginTop: 12 }}>Loading plants...</Text>
                </View>
              ) : (
                <>
                  {(plantTab === 'inventory' ? inventoryPlants : plantSearchResults).length === 0 && (
                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                      <MaterialIcons name="eco" size={48} color="#ccc" />
                      <Text style={{ color: '#999', marginTop: 16 }}>No plants found</Text>
                    </View>
                  )}
                  {(plantTab === 'inventory' ? inventoryPlants : plantSearchResults).map(item => (
                    <TouchableOpacity key={item.id} style={styles.plantItem} onPress={() => handleSelectPlant(item)}>
                      <Image source={item.mainImage ? { uri: item.mainImage } : GreenerLogo} style={styles.plantItemImage} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.plantItemName}>{item.name || item.common_name}</Text>
                        <Text style={styles.plantItemScientific}>{item.scientific_name}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color="#4CAF50" />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      {/* Bottom Navigation — hidden while keyboard is open to avoid overlap */}
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

  plantInfoBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e8', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#d4edda' },
  plantInfoImg: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', marginRight: 10 },
  plantInfoName: { fontSize: 13, fontWeight: '700', color: '#2e7d32' },
  plantInfoSci: { fontSize: 11, color: '#66bb6a', fontStyle: 'italic' },
  editPlantBtn: { padding: 6, borderRadius: 12, backgroundColor: '#fff' },

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
  iconBtn: { padding: 8, borderRadius: 18, backgroundColor: '#f8fffe', marginRight: 6, borderWidth: 1, borderColor: '#e8f5e8' }, // smaller icons/buttons
  sendBtn: { backgroundColor: '#4CAF50', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#bdbdbd' },

  // modal bits
  modalContainer: { flex: 1, backgroundColor: '#f8fffe' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8f5e8' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2e7d32' },
  modalCloseButton: { padding: 8, borderRadius: 18, backgroundColor: '#f5f5f5' },
  modalTabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12 },
  modalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginHorizontal: 4, backgroundColor: '#f8fffe' },
  modalTabActive: { backgroundColor: '#e8f5e8' },
  modalTabText: { fontSize: 14, color: '#888', marginLeft: 6 },
  modalTabTextActive: { color: '#4CAF50', fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e8f5e8', paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#2e7d32' },
  plantItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e8f5e8', elevation: 2 },
  plantItemImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e8f5e8', marginRight: 14 },
  plantItemName: { fontSize: 16, fontWeight: '600', color: '#2e7d32' },
  plantItemScientific: { fontSize: 13, color: '#66bb6a', fontStyle: 'italic' },
});
