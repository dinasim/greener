// components/ai/SmartPlantCareAssistant.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import NavigationBar from '../NavigationBar'; 
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GreenerLogo from '../../assets/icon.png';
import { getBusinessInventory, getBusinessProfile } from '../../Business/services/businessApi';

const PLANT_SEARCH_URL = 'https://usersfunctions.azurewebsites.net/api/plant_search';
const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

export default function GreenerPlantCareAssistant({ navigation, route }) {
  const routePlant = route?.params?.plant || null;
  const onSelectPlant = route?.params?.onSelectPlant;
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [plantSelectVisible, setPlantSelectVisible] = useState(false);
  const [inventoryPlants, setInventoryPlants] = useState([]);
  const [plantSearchResults, setPlantSearchResults] = useState([]);
  const [plantSearchQuery, setPlantSearchQuery] = useState('');
  const [plantTab, setPlantTab] = useState('inventory');
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(routePlant);
  const [messageAnimations, setMessageAnimations] = useState([]);
  const [isPlantSearchLoading, setIsPlantSearchLoading] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [chatStarted, setChatStarted] = useState(false);
  const [hasExistingChat, setHasExistingChat] = useState(false);
  const [lastChatHistory, setLastChatHistory] = useState([]);
  const [persona, setPersona] = useState('business');
  const scrollViewRef = useRef(null);
  const plantSearchDebounce = useRef(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate on mount
    fadeAnim.setValue(0);
    slideAnim.setValue(-50);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const detectPersonaAndSetName = async () => {
      let personaType = 'business';
      let name = '';
      try {
        const storedPersona = await AsyncStorage.getItem('persona');
        if (storedPersona === 'consumer') {
          personaType = 'consumer';
          const userName = await AsyncStorage.getItem('userName');
          const userEmail = await AsyncStorage.getItem('userEmail');
          name = userName || userEmail || 'there';
        } else {
          const profile = await getBusinessProfile();
          name = profile?.contactName || profile?.name || profile?.businessName || 'there';
        }
      } catch (e) {
        name = 'there';
      }
      setPersona(personaType);
      setOwnerName(name);
    };
    detectPersonaAndSetName();
  }, []);

  const fetchInventoryPlants = async () => {
    setIsInventoryLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) throw new Error('No user email found');
      let plants = [];
      if (persona === 'consumer') {
        const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getalluserplants?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(locationObj => {
            if (locationObj.plants && Array.isArray(locationObj.plants)) {
              locationObj.plants.forEach(p => {
                plants.push({ ...p, name: p.nickname || p.common_name, mainImage: p.image_url });
              });
            }
          });
        }
      } else {
        const inv = await getBusinessInventory(userEmail);
        plants = (inv.inventory || inv || []).filter(item => (item.productType === 'plant' || item.category === 'Plants'));
      }
      setInventoryPlants(plants);
    } catch (e) {
      setInventoryPlants([]);
    } finally {
      setIsInventoryLoading(false);
    }
  };

  const fetchGeneralPlants = async (query = '') => {
    try {
      let url = PLANT_SEARCH_URL;
      if (query && query.length >= 2) {
        url += `?name=${encodeURIComponent(query)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      const normalize = p => ({
        id: p.id,
        name: p.common_name || p.name || '',
        common_name: p.common_name || '',
        scientific_name: p.scientific_name || p.latin_name || '',
        mainImage: p.image_url || (Array.isArray(p.image_urls) ? p.image_urls[0] : null) || null,
      });
      setPlantSearchResults((data || []).map(normalize));
    } catch (e) {
      setPlantSearchResults([]);
    }
  };

  const handleOpenPlantPicker = () => {
    setPlantSelectVisible(true);
    fetchInventoryPlants();
  };

  const handleSelectPlant = (plant) => {
    setSelectedPlant(plant);
    setPlantSelectVisible(false);
    if (onSelectPlant) onSelectPlant(plant);
  };

  const handleResetChat = () => {
    setLastChatHistory(chatHistory);
    setChatHistory([
      {
        id: Date.now(),
        type: 'ai_response',
        diagnosis: `Hello ${ownerName || 'there'}, how can I help you today?`,
        recommendations: [],
        timestamp: new Date().toISOString(),
        hasImage: false
      }
    ]);
    setDiagnosis(null);
    setRecommendations([]);
    setMessageAnimations([]);
  };

  const animateMessage = (index) => {
    const anim = new Animated.Value(0);
    setMessageAnimations((prev) => {
      const arr = [...prev];
      arr[index] = anim;
      return arr;
    });

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.8,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.spring(anim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: false,
      }),
    ]).start();
  };

  useEffect(() => {
    if (chatHistory.length > 0) {
      animateMessage(chatHistory.length - 1);
    }
  }, [chatHistory.length]);

  useEffect(() => {
    if (plantTab !== 'all') return;
    if (plantSearchDebounce.current) clearTimeout(plantSearchDebounce.current);
    if (plantSearchQuery.length >= 2) {
      setIsPlantSearchLoading(true);
      plantSearchDebounce.current = setTimeout(async () => {
        try {
          await fetchGeneralPlants(plantSearchQuery);
        } finally {
          setIsPlantSearchLoading(false);
        }
      }, 350);
    } else {
      setPlantSearchResults([]);
      setIsPlantSearchLoading(false);
    }
    return () => {
      if (plantSearchDebounce.current) clearTimeout(plantSearchDebounce.current);
    };
  }, [plantSearchQuery, plantTab]);

  useEffect(() => {
    setHasExistingChat(chatHistory.length > 0);
  }, [chatHistory.length]);

  useEffect(() => {
    setShowWelcome(true);
    setChatStarted(false);
  }, []);

  const analyzePlantHealth = async (imageUri = null, userQuestion = '') => {
    if (!userQuestion.trim() && !imageUri) {
      return;
    }
    setIsLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const requestBody = {
        message: userQuestion || 'Analyze this plant\'s health and provide care recommendations',
        plantInfo: selectedPlant ? {
          name: selectedPlant.name || selectedPlant.common_name,
          scientificName: selectedPlant.scientific_name,
          waterDays: selectedPlant.water_days,
          light: selectedPlant.light,
          humidity: selectedPlant.humidity
        } : null,
        imageUri: imageUri,
        userEmail: userEmail
      };

      const response = await fetch(`${API_BASE_URL}/ai-plant-care-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI service unavailable (${response.status}). Please try again later.`);
      }

      const result = await response.json();
      const aiResponse = result.message || result.diagnosis || result.response || 'No response received';
      const recommendations = result.recommendations || [];

      setDiagnosis(aiResponse);
      setRecommendations(Array.isArray(recommendations) ? recommendations : []);
      const newMessage = {
        id: Date.now(),
        type: 'ai_response',
        question: userQuestion,
        diagnosis: aiResponse,
        recommendations: Array.isArray(recommendations) ? recommendations : [],
        timestamp: new Date().toISOString(),
        hasImage: !!imageUri
      };

      setChatHistory(prev => [...prev, newMessage]);
    } catch (error) {
      let errorMessage = 'Failed to analyze plant. ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Network connection issue. Please check your internet connection.';
      } else if (error.message.includes('404')) {
        errorMessage += 'AI service is temporarily unavailable. Please try again later.';
      } else if (error.message.includes('500')) {
        errorMessage += 'Server error occurred. Please try again in a few minutes.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to photos for plant analysis');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow camera access for plant analysis');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSubmitQuestion = () => {
    if (!question.trim() && !selectedImage) {
      Alert.alert('Input Required', 'Please ask a question or upload an image');
      return;
    }
    if (showWelcome) {
      handleStartNewChat();
    }
    const userMessage = {
      id: Date.now(),
      type: 'user_question',
      question: question.trim(),
      image: selectedImage,
      timestamp: new Date().toISOString()
    };
    setChatHistory(prev => [...prev, userMessage]);
    analyzePlantHealth(selectedImage, question.trim());
    setQuestion('');
    setSelectedImage(null);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleStartNewChat = () => {
    setChatHistory([
      {
        id: Date.now(),
        type: 'ai_response',
        diagnosis: `Hello ${ownerName || 'there'}, how can I help you with your plants today?`,
        recommendations: [],
        timestamp: new Date().toISOString(),
        hasImage: false
      }
    ]);
    setShowWelcome(false);
    setChatStarted(true);
    setHasExistingChat(true);
  };

  const getQuickSuggestions = () => [
    { text: "Why are my plant's leaves turning yellow?", icon: "help-outline" },
    { text: "How often should I water this plant?", icon: "opacity" },
    { text: "What's wrong with my plant's growth?", icon: "trending-up" },
    { text: "Is my plant getting enough light?", icon: "wb-sunny" },
    { text: "How to treat plant pests naturally?", icon: "bug-report" },
    { text: "When should I repot my plant?", icon: "home" }
  ];

  const renderChatMessage = (message, idx) => {
    const anim = messageAnimations[idx] || new Animated.Value(1);
    if (message.type === 'user_question') {
      return (
        <Animated.View
          key={`${message.id}-${idx}`}
          style={{ alignItems: 'flex-end', marginBottom: 24 }}
        >
          <View style={styles.userMessageWrapper}>
            <View style={styles.userMessageBubble}>
              {message.question && (
                <Text style={[styles.userMessageText, { color: '#000' }]}>{message.question}</Text>
              )}
              {message.image && (
                <Image source={{ uri: message.image }} style={styles.messageImage} />
              )}
              <Text style={styles.userMessageTime}>{formatTimestamp(message.timestamp)}</Text>
            </View>
          </View>
        </Animated.View>
      );
    } else {
      return (
        <Animated.View
          key={`${message.id}-${idx}`}
          style={[
            styles.aiMessageContainer,
            {
              transform: [
                { scale: anim },
                {
                  translateX: Animated.multiply(
                    anim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }),
                    1
                  ),
                },
              ],
              opacity: anim,
            },
          ]}
        >
          <View style={styles.aiMessage}>
            <View style={styles.aiHeader}>
              <View style={styles.aiAvatarContainer}>
                <Image source={GreenerLogo} style={styles.aiAvatar} />
                <View style={styles.aiStatusDot} />
              </View>
              <View style={styles.aiHeaderText}>
                <Text style={styles.aiTitle}>Greener AI</Text>
                <Text style={styles.aiSubtitle}>Plant Care Expert</Text>
              </View>
            </View>
            {message.diagnosis && (
              <View style={styles.diagnosisSection}>
                <Text style={styles.diagnosisText}>{message.diagnosis}</Text>
              </View>
            )}
            {message.recommendations && message.recommendations.length > 0 && (
              <View style={styles.recommendationsSection}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="lightbulb" size={18} color="#FF9800" />
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                </View>
                {message.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <View style={styles.bulletPoint} />
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.aiMessageTime}>
              {formatTimestamp(message.timestamp)}
            </Text>
          </View>
        </Animated.View>
      );
    }
  };

  const formatTimestamp = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    if (isToday) return `${hours}:${mins}`;
    return `${date.toLocaleDateString()}, ${hours}:${mins}`;
  };

  const renderChatHistory = () => {
    let lastDay = '';
    return chatHistory.map((message, idx) => {
      const date = new Date(message.timestamp);
      const dayStr = date.toDateString();
      const showDay = dayStr !== lastDay;
      lastDay = dayStr;
      return (
        <React.Fragment key={`${message.id}-fragment`}>
          {showDay && (
            <View style={styles.daySeparator}>
              <Text style={styles.daySeparatorText}>{dayStr}</Text>
            </View>
          )}
          {renderChatMessage(message, idx)}
        </React.Fragment>
      );
    });
  };

  // Show toast helper
  const showToast = (msg, type = 'info') => {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(msg, type);
    } else if (typeof global !== 'undefined' && global.showToast) {
      global.showToast(msg, type);
    }
  };

  // --- UI ---
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerCenterLabelWrapper}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Image source={GreenerLogo} style={styles.headerLogo} />
                <View>
                  <Text style={styles.headerCenterLabelMain}>AI Plant Care</Text>
                  <Text style={styles.headerCenterLabelSub}>Your Smart Garden Assistant</Text>
                </View>
              </View>
            </View>
            {!showWelcome && (
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleResetChat} style={[styles.headerActionButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="delete-sweep" size={20} color="#4CAF50" />
                  <Text style={{ marginLeft: 6, color: '#4CAF50', fontWeight: '600', fontSize: 14 }}>Clear Chat History</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Plant Info Bar */}
          <Animated.View style={[styles.plantInfoBar, { transform: [{ translateY: slideAnim }] }]}>
            <Image
              source={selectedPlant && selectedPlant.mainImage ? { uri: selectedPlant.mainImage } : GreenerLogo}
              style={styles.plantInfoImage}
            />
            <View style={styles.plantInfoText}>
              <Text style={styles.plantInfoName}>{selectedPlant?.name || selectedPlant?.common_name || 'No plant selected'}</Text>
              <Text style={styles.plantInfoScientific}>{selectedPlant?.scientific_name || ''}</Text>
            </View>
            <TouchableOpacity onPress={handleOpenPlantPicker} style={styles.changePlantButton}>
              <MaterialIcons name="edit" size={16} color="#4CAF50" />
            </TouchableOpacity>
          </Animated.View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {showWelcome ? (
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeHeader}>
                  <Image source={GreenerLogo} style={styles.welcomeAvatar} />
                  <Text style={styles.welcomeTitle}>Welcome to Greener AI! 🌱</Text>
                  <Text style={styles.welcomeText}>
                    I'm here to help you care for your plants. Ask me anything about plant health,
                    watering schedules, diseases, or upload a photo for instant analysis!
                  </Text>
                </View>
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>Quick Questions:</Text>
                  {getQuickSuggestions().map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionButton}
                      onPress={() => {
                        setShowWelcome(false);
                        setChatStarted(true);
                        const userMessage = {
                          id: Date.now() + 1,
                          type: 'user_question',
                          question: suggestion.text,
                          image: null,
                          timestamp: new Date().toISOString()
                        };
                        setChatHistory([userMessage]);
                        analyzePlantHealth(null, suggestion.text);
                        setQuestion('');
                        setSelectedImage(null);
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name={suggestion.icon} size={18} color="#4CAF50" />
                      <Text style={styles.suggestionText}>{suggestion.text}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.suggestionButton, { marginTop: 16, backgroundColor: '#e8f5e8', borderColor: '#4CAF50' }]}
                    onPress={() => {
                      setShowWelcome(false);
                      setChatStarted(true);
                      setChatHistory([
                        {
                          id: Date.now(),
                          type: 'ai_response',
                          diagnosis: `Hello ${ownerName || 'there'}, how can I help you today?`,
                          recommendations: [],
                          timestamp: new Date().toISOString(),
                          hasImage: false
                        }
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="edit" size={18} color="#4CAF50" />
                    <Text style={styles.suggestionText}>Type your own question</Text>
                  </TouchableOpacity>
                  {lastChatHistory && lastChatHistory.length > 1 ? (
                    <TouchableOpacity
                      style={[styles.suggestionButton, { marginTop: 16, backgroundColor: '#fffde7', borderColor: '#FF9800' }]}
                      onPress={() => {
                        setShowWelcome(false);
                        setChatStarted(true);
                        setChatHistory(lastChatHistory);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="history" size={18} color="#FF9800" />
                      <Text style={styles.suggestionText}>Continue with last chat</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.suggestionButton, { marginTop: 16, backgroundColor: '#fffde7', borderColor: '#FF9800' }]}
                      onPress={() => {
                        showToast('No previous chat history found.', 'info');
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="history" size={18} color="#FF9800" />
                      <Text style={styles.suggestionText}>Continue with last chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              renderChatHistory()
            )}
          </ScrollView>
          {!showWelcome && (
            <Animated.View style={[styles.inputSection, { transform: [{ translateY: slideAnim }] }]}>
              {selectedImage && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImage(null)}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.inputContainer}>
                <View style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ask about your plant's care, health, or problems..."
                    placeholderTextColor="#999"
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.inputActions}>
                  <TouchableOpacity onPress={handleOpenPlantPicker} style={styles.actionButton}>
                    <MaterialIcons name="local-florist" size={22} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleTakePhoto} style={styles.actionButton}>
                    <MaterialIcons name="camera-alt" size={22} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleImagePick} style={styles.actionButton}>
                    <MaterialIcons name="photo-library" size={22} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmitQuestion}
                    style={[
                      styles.sendButton,
                      (!question.trim() && !selectedImage) && styles.sendButtonDisabled
                    ]}
                    disabled={!question.trim() && !selectedImage || isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialIcons name="send" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* PLANT SELECT MODAL */}
      {plantSelectVisible && (
        <View style={StyleSheet.absoluteFillObject}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Plant</Text>
              <TouchableOpacity onPress={() => setPlantSelectVisible(false)} style={styles.modalCloseButton}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalTabs}>
              <TouchableOpacity
                onPress={() => { setPlantTab('inventory'); setPlantSearchQuery(''); }}
                style={[styles.modalTab, plantTab === 'inventory' && styles.modalTabActive]}
              >
                <MaterialIcons name="inventory" size={20} color={plantTab === 'inventory' ? '#4CAF50' : '#888'} />
                <Text style={[styles.modalTabText, plantTab === 'inventory' && styles.modalTabTextActive]}>
                  {persona === 'consumer' ? 'My Plants' : 'Business Inventory'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setPlantTab('all'); setPlantSearchQuery(''); fetchGeneralPlants(); }}
                style={[styles.modalTab, plantTab === 'all' && styles.modalTabActive]}
              >
                <MaterialIcons name="search" size={20} color={plantTab === 'all' ? '#4CAF50' : '#888'} />
                <Text style={[styles.modalTabText, plantTab === 'all' && styles.modalTabTextActive]}>
                  All Plants
                </Text>
              </TouchableOpacity>
            </View>
            {plantTab === 'all' && (
              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
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
            <ScrollView style={styles.plantsScrollView} showsVerticalScrollIndicator={false}>
              {(isInventoryLoading && plantTab === 'inventory') || (isPlantSearchLoading && plantTab === 'all') ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                  <Text style={styles.modalLoadingText}>Loading plants...</Text>
                </View>
              ) : (
                <>
                  {(plantTab === 'inventory' ? inventoryPlants : plantSearchResults).length === 0 && (
                    <View style={styles.emptyState}>
                      <MaterialIcons name="eco" size={48} color="#ccc" />
                      <Text style={styles.emptyStateText}>
                        {plantTab === 'inventory' ? 'No plants in your inventory' : 'No plants found'}
                      </Text>
                    </View>
                  )}
                  {(plantTab === 'inventory' ? inventoryPlants : plantSearchResults).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.plantItem}
                      onPress={() => handleSelectPlant(item)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={item.mainImage ? { uri: item.mainImage } : GreenerLogo}
                        style={styles.plantItemImage}
                      />
                      <View style={styles.plantItemInfo}>
                        <Text style={styles.plantItemName}>{item.name || item.common_name}</Text>
                        <Text style={styles.plantItemScientific}>{item.scientific_name}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color="#4CAF50" />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    <NavigationBar currentTab="ai" navigation={navigation} />
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f8f0',
  },
  headerCenterLabelWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterLabelMain: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
    textAlign: 'center',
    lineHeight: 20,
  },
  headerCenterLabelSub: {
    fontSize: 12,
    color: '#66bb6a',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 16,
  },
  headerLogo: {
    width: 38,
    height: 38,
    marginRight: 12,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f8f0',
    marginLeft: 8,
  },
  plantInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4edda',
  },
  plantInfoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  plantInfoText: {
    flex: 1,
  },
  plantInfoName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  plantInfoScientific: {
    fontSize: 12,
    color: '#66bb6a',
    fontStyle: 'italic',
  },
  changePlantButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f8fffe',
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 20,
    backgroundColor: '#e8f5e8',
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#66bb6a',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  chatOptionsContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FF9800',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  newChatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
    marginLeft: 8,
  },
  suggestionsContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 16,
    textAlign: 'center',
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  customQuestionButton: {
    marginTop: 16,
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  suggestionText: {
    fontSize: 15,
    color: '#2e7d32',
    marginLeft: 12,
    flex: 1,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  userMessageWrapper: {
    maxWidth: '85%',
    alignItems: 'flex-end',
  },
  userMessageBubble: {
    backgroundColor: '#E3F2FD', // FIXED: Much lighter blue background
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  userMessageText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  userMessageTime: {
    fontSize: 11,
    color: '#666', // FIXED: Darker color for better visibility
    marginTop: 4,
    marginRight: 8,
    fontWeight: '400',
  },
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginTop: 12,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  aiMessage: {
    backgroundColor: '#e8f5e8', // changed from '#fff' to a light green
    borderRadius: 24,
    borderTopLeftRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 20,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#e8f5e8',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e8',
  },
  aiStatusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  aiHeaderText: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
  },
  aiSubtitle: {
    fontSize: 12,
    color: '#66bb6a',
    marginTop: 2,
  },
  diagnosisSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2e7d32',
    marginLeft: 8,
  },
  diagnosisText: {
    fontSize: 15,
    color: '#424242',
    lineHeight: 22,
    backgroundColor: '#f8fffe',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  recommendationsSection: {
    marginBottom: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    backgroundColor: '#fff8e1',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
    marginTop: 8,
    marginRight: 12,
  },
  recommendationText: {
    fontSize: 14,
    color: '#424242',
    flex: 1,
    lineHeight: 20,
  },
  aiMessageTime: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderTopLeftRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingText: {
    fontSize: 14,
    color: '#66bb6a',
    marginLeft: 12,
    fontStyle: 'italic',
  },
  inputSection: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8f5e8',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  imagePreview: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#f44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#f8fffe',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 16,
    color: '#2e7d32',
    lineHeight: 22,
    maxHeight: 80,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#f8fffe',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#bdbdbd',
    shadowOpacity: 0,
    elevation: 0,
  },
  daySeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  daySeparatorText: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fffe',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2e7d32',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: '#f8fffe',
  },
  modalTabActive: {
    backgroundColor: '#e8f5e8',
  },
  modalTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    marginLeft: 8,
  },
  modalTabTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2e7d32',
    paddingVertical: 12,
  },
  plantsScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalLoadingText: {
    fontSize: 16,
    color: '#66bb6a',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  plantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  plantItemImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    backgroundColor: '#e8f5e8',
  },
  plantItemInfo: {
    flex: 1,
  },
  plantItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  plantItemScientific: {
    fontSize: 13,
    color: '#66bb6a',
    fontStyle: 'italic',
  },
});