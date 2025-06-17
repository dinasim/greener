// components/AIPlantCareAssistant.js - AI Plant Care Chat Assistant
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Gemini API Configuration
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const GEMINI_VISION_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent';

export default function AIPlantCareAssistant({ 
  visible, 
  onClose, 
  userPlants = [],
  currentLocation = null 
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Initialize with welcome message
  useEffect(() => {
    if (visible && messages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        text: `🌱 Hello! I'm your AI Plant Care Assistant. I'm here to help you with:

• Plant identification & care advice
• Disease diagnosis & treatment
• Watering schedules & fertilization
• Pest control solutions
• Growing tips & troubleshooting
• Climate-specific recommendations

How can I help your plants thrive today?`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        type: 'welcome'
      };
      setMessages([welcomeMessage]);
      
      // Load chat history
      loadChatHistory();
    }
  }, [visible]);

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Load chat history from storage
  const loadChatHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('plantCareHistory');
      if (history) {
        setChatHistory(JSON.parse(history));
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
  };

  // Save chat history
  const saveChatHistory = async (newHistory) => {
    try {
      await AsyncStorage.setItem('plantCareHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  };

  // Enhanced plant care system prompt
  const getSystemPrompt = () => {
    const userPlantsInfo = userPlants.length > 0 
      ? `\n\nUser's Plants: ${userPlants.map(p => `${p.plantName || p.name} (${p.plantType || 'Unknown type'})`).join(', ')}`
      : '';
    
    const locationInfo = currentLocation 
      ? `\n\nUser Location: ${currentLocation.city}, ${currentLocation.country} (Climate considerations)`
      : '';

    return `You are an expert AI Plant Care Assistant specialized in houseplants, gardening, and plant health. 

Your expertise includes:
- Plant identification and species-specific care
- Disease diagnosis and treatment recommendations
- Pest identification and organic control methods
- Watering schedules and soil requirements
- Fertilization and nutrient management
- Light requirements and positioning advice
- Propagation techniques
- Seasonal care adjustments
- Indoor air quality and plant benefits
- Troubleshooting common plant problems

Guidelines:
- Always provide practical, actionable advice
- Consider climate and environmental factors
- Suggest organic and safe solutions first
- Be encouraging and supportive
- Ask clarifying questions when needed
- Provide step-by-step instructions
- Include warnings about toxic plants if relevant
- Recommend tools or products when helpful

${userPlantsInfo}${locationInfo}

Respond in a friendly, knowledgeable tone with emoji use for visual appeal. Keep responses concise but comprehensive.`;
  };

  // Generate AI response using Gemini API
  const generateAIResponse = async (userMessage, imageData = null) => {
    try {
      const systemPrompt = getSystemPrompt();
      
      // Build context from recent messages
      const recentMessages = messages.slice(-6).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          ...recentMessages,
          {
            role: 'user',
            parts: imageData 
              ? [
                  { text: userMessage },
                  {
                    inline_data: {
                      mime_type: imageData.type,
                      data: imageData.base64
                    }
                  }
                ]
              : [{ text: userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const apiUrl = imageData ? GEMINI_VISION_API_URL : GEMINI_API_URL;
      const response = await fetch(`${apiUrl}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('No response generated');
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  };

  // Handle sending message
  const sendMessage = async () => {
    if (!inputMessage.trim() && !selectedImage) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage.trim() || 'Image for analysis',
      sender: 'user',
      timestamp: new Date().toISOString(),
      image: selectedImage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Prepare image data if present
      let imageData = null;
      if (selectedImage) {
        imageData = {
          type: 'image/jpeg',
          base64: selectedImage.base64
        };
      }

      const aiResponse = await generateAIResponse(userMessage.text, imageData);
      
      setIsTyping(false);
      
      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        type: 'response'
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Update chat history
      const newHistory = [...chatHistory, userMessage, aiMessage];
      setChatHistory(newHistory);
      saveChatHistory(newHistory);
      
    } catch (error) {
      setIsTyping(false);
      const errorMessage = {
        id: Date.now() + 1,
        text: "I apologize, but I'm having trouble responding right now. This might be due to API limits or connectivity issues. Please try again in a moment, or consider asking a simpler question.",
        sender: 'ai',
        timestamp: new Date().toISOString(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setSelectedImage(null);
    }

    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Handle image selection
  const selectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow camera roll access to upload plant photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        setSelectedImage({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Handle camera capture
  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow camera access to take plant photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        setSelectedImage({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Quick suggestion buttons
  const quickSuggestions = [
    { text: "🌱 Identify this plant", action: () => setInputMessage("Can you help me identify this plant?") },
    { text: "💧 Watering schedule help", action: () => setInputMessage("What's the best watering schedule for my plants?") },
    { text: "🦠 Disease diagnosis", action: () => setInputMessage("My plant looks sick, can you help diagnose the problem?") },
    { text: "🌞 Light requirements", action: () => setInputMessage("How much light do my plants need?") },
    { text: "🌿 Fertilization tips", action: () => setInputMessage("When and how should I fertilize my plants?") },
    { text: "🐛 Pest control", action: () => setInputMessage("I found bugs on my plants, what should I do?") }
  ];

  // Render message bubble
  const renderMessage = (message) => (
    <View key={message.id} style={[
      styles.messageBubble,
      message.sender === 'user' ? styles.userBubble : styles.aiBubble
    ]}>
      {message.image && (
        <Image source={{ uri: message.image.uri }} style={styles.messageImage} />
      )}
      <Text style={[
        styles.messageText,
        message.sender === 'user' ? styles.userText : styles.aiText
      ]}>
        {message.text}
      </Text>
      <Text style={styles.messageTime}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.overlay,
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }
    ]}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.aiAvatar}>
              <MaterialCommunityIcons name="robot" size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Plant Care Assistant</Text>
              <Text style={styles.headerSubtitle}>
                {isTyping ? '🌱 Thinking...' : '🟢 Online'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(renderMessage)}
          
          {isTyping && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={styles.typingIndicator}>
                <Text style={styles.typingText}>AI is typing</Text>
                <ActivityIndicator size="small" color="#4CAF50" style={styles.typingSpinner} />
              </View>
            </View>
          )}

          {/* Quick Suggestions (show when no conversation started) */}
          {messages.length <= 1 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>💡 Quick Help Topics</Text>
              <View style={styles.suggestionsGrid}>
                {quickSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={suggestion.action}
                  >
                    <Text style={styles.suggestionText}>{suggestion.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <MaterialIcons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity onPress={selectImage} style={styles.imageButton}>
              <MaterialIcons name="photo-library" size={24} color="#4CAF50" />
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.imageButton}>
              <MaterialIcons name="camera-alt" size={24} color="#4CAF50" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              value={inputMessage}
              onChangeText={setInputMessage}
              placeholder="Ask about plant care, diseases, watering..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity 
              onPress={sendMessage}
              style={[
                styles.sendButton,
                (!inputMessage.trim() && !selectedImage) && styles.sendButtonDisabled
              ]}
              disabled={isLoading || (!inputMessage.trim() && !selectedImage)}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="send" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  typingSpinner: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginTop: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  suggestionText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'relative',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  imageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});