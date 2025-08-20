// screens/AIPlantCareAssistant.js - Real-time AI chat box for plant care
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
import CosmosDbService from '../services/CosmosDbService';
import MainLayout from '../components/MainLayout';

const AI_CHAT_API = 'https://usersfunctions.azurewebsites.net/api/ai-plant-care-chat';

export default function AIPlantCareAssistant({ navigation, route, embedded = false, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusiness, setIsBusiness] = useState(false);

  const isEmbedded = route?.params?.embedded ?? embedded;

  const scrollViewRef = useRef();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Business/user detection logic (matches your other screens)
  useEffect(() => {
    const checkUserType = async () => {
      if (route?.params?.business === true) {
        setIsBusiness(true);
        return;
      }
      const userType = await AsyncStorage.getItem('userType');
      const businessId = await AsyncStorage.getItem('businessId');
      if (userType === 'business' || businessId) {
        setIsBusiness(true);
        return;
      }
      const currentRouteName = navigation.getState()?.routeNames?.[0];
      if (
        currentRouteName?.includes('Business') ||
        navigation.getState()?.routes?.some(route => route.name.includes('Business'))
      ) {
        setIsBusiness(true);
        return;
      }
      setIsBusiness(false);
    };
    checkUserType();
  }, [route?.params, navigation]);

  useEffect(() => {
    initializeChat();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.stopAnimation();
      typingAnim.setValue(0);
    }
  }, [isTyping]);

  const initializeChat = async () => {
    try {
      setIsInitializing(true);
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      setUserId(currentUserId);

      let sessionId = await AsyncStorage.getItem('aiChatSession');
      if (!sessionId) {
        sessionId = generateSessionId(currentUserId);
        await AsyncStorage.setItem('aiChatSession', sessionId);
      }
      setChatSession(sessionId);

      const chatHistory = await CosmosDbService.getChatHistory(sessionId);
      if (chatHistory && chatHistory.length > 0) {
        setMessages(chatHistory);
      } else {
        const welcomeMessage = {
          id: Date.now().toString(),
          text: "🌿 Hello! I'm your AI Plant Care Assistant. I specialize in helping you care for your plants, diagnose issues, and provide expert gardening advice. How can I help you today?",
          isUser: false,
          timestamp: new Date(),
          type: 'welcome'
        };
        setMessages([welcomeMessage]);
        await CosmosDbService.saveChatMessages(sessionId, [welcomeMessage]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert(
        "Connection Error",
        "Unable to connect to the chat service. Please check your internet connection and try again.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const generateSessionId = (userId) => {
    const userPrefix = userId ? `${userId.substr(0, 8)}_` : '';
    return `${userPrefix}chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const saveMessages = async (newMessages) => {
    if (chatSession) {
      try {
        await CosmosDbService.saveChatMessages(chatSession, newMessages);
      } catch (error) {
        console.error('Error saving messages to Cosmos DB:', error);
        Alert.alert(
          "Save Error",
          "We couldn't save your conversation. Please check your connection and try again."
        );
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      await saveMessages([userMessage]);
      const context = newMessages.slice(-10).map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await fetch(AI_CHAT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.text,
          context: context,
          sessionId: chatSession,
          specialization: 'plant_care'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'I apologize, but I encountered an error. Please try asking your question again.',
        isUser: false,
        timestamp: new Date(),
        confidence: data.confidence,
        sources: data.sources,
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);

      await saveMessages([aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please check your internet connection and try again.",
        isUser: false,
        timestamp: new Date(),
        type: 'error'
      };

      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);

      await saveMessages([errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear all chat messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await CosmosDbService.deleteChatHistory(chatSession);

              const newSessionId = generateSessionId(userId);
              await AsyncStorage.setItem('aiChatSession', newSessionId);
              setChatSession(newSessionId);

              const welcomeMessage = {
                id: Date.now().toString(),
                text: "🌿 Hello! I'm your AI Plant Care Assistant. I specialize in helping you care for your plants, diagnose issues, and provide expert gardening advice. How can I help you today?",
                isUser: false,
                timestamp: new Date(),
                type: 'welcome'
              };

              setMessages([welcomeMessage]);
              await CosmosDbService.saveChatMessages(newSessionId, [welcomeMessage]);
            } catch (error) {
              console.error('Error clearing chat:', error);
              Alert.alert(
                "Error",
                "Failed to clear chat history. Please try again."
              );
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const getQuickSuggestions = () => [
    "🌿 How often should I water my houseplants?",
    "🐛 My plant has yellow leaves, what's wrong?",
    "☀️ What plants are good for low light conditions?",
    "🌱 How do I propagate my plants?",
    "🏠 Best indoor plants for beginners?",
    "💧 Signs of overwatering vs underwatering?",
  ];

  const handleSuggestionPress = (suggestion) => {
    setInputText(suggestion.replace(/^[🌿🐛☀️🌱🏠💧]\s*/, ''));
  };

  const renderMessage = (message) => {
    const isUser = message.isUser;
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" />
          </View>
        )}

        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <RichText
            style={[styles.messageText, isUser ? styles.userText : styles.aiText]}
            text={message.text}
          />

          {message.confidence && (
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceText}>
                Confidence: {Math.round(message.confidence * 100)}%
              </Text>
            </View>
          )}

          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {isUser && (
          <View style={styles.userAvatar}>
            <MaterialIcons name="person" size={20} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    return (
      <View style={[styles.messageContainer, styles.aiMessageContainer]}>
        <View style={styles.aiAvatar}>
          <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" />
        </View>
        <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
          <View style={styles.typingIndicator}>
            <Animated.View style={[styles.typingDot, { opacity: typingAnim }]} />
            <Animated.View style={[styles.typingDot, { opacity: typingAnim }]} />
            <Animated.View style={[styles.typingDot, { opacity: typingAnim }]} />
          </View>
          <Text style={styles.typingText}>AI is thinking...</Text>
        </View>
      </View>
    );
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your plant care assistant...</Text>
      </SafeAreaView>
    );
  }

  const screenContent = (
    <SafeAreaView style={[styles.container, isEmbedded && { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
      {/* Header */}
      {isEmbedded ? (
        <View style={[styles.header, { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <MaterialIcons name="close" size={22} color="#4CAF50" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitle}>
              <MaterialCommunityIcons name="robot" size={22} color="#4CAF50" />
              <Text style={styles.headerTitleText}>AI Assistant</Text>
            </View>
            <Text style={styles.headerSubtitle}>Plant care & shop help</Text>
          </View>
          <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
            <MaterialIcons name="delete-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitle}>
              <MaterialCommunityIcons name="robot" size={24} color="#4CAF50" />
              <Text style={styles.headerTitleText}>AI Plant Care Assistant</Text>
            </View>
            <Text style={styles.headerSubtitle}>Powered by Gemini AI</Text>
          </View>
          <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
            <MaterialIcons name="delete-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(renderMessage)}
          {renderTypingIndicator()}

          {messages.length <= 1 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Try asking about:</Text>
              {getQuickSuggestions().map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestionPress(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask me anything about plant care..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="send" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputFooter}>
            <Text style={styles.inputHint}>
              💡 Ask about watering, diseases, plant identification, care tips, and more!
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );

  if (isEmbedded) {
    // Render directly inside a modal/sheet
    return screenContent;
  } else if (!isBusiness) {
    return (
      <MainLayout
        currentTab="ai"
        onTabPress={tab => navigation.navigate(
          tab === 'plants'
            ? 'Locations'
            : tab.charAt(0).toUpperCase() + tab.slice(1)
        )}
      >
        {screenContent}
      </MainLayout>
    );
  } else {
    return screenContent;
  }
}

/** Lightweight **bold** renderer for RN text */
const RichText = ({ text = '', style }) => {
  const lines = String(text).split('\n');
  return (
    <Text style={style}>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*.+?\*\*)/g);
        return (
          <Text key={`ln-${li}`}>
            {parts.map((part, pi) => {
              const isBold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
              if (isBold) {
                return (
                  <Text key={`pt-${pi}`} style={{ fontWeight: '700' }}>
                    {part.slice(2, -2)}
                  </Text>
                );
              }
              return <Text key={`pt-${pi}`}>{part}</Text>;
            })}
            {li < lines.length - 1 ? '\n' : null}
          </Text>
        );
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    color: '#4CAF50',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typingBubble: {
    paddingVertical: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: '#999',
  },
  confidenceContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginHorizontal: 2,
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  suggestionsContainer: {
    marginTop: 20,
    paddingHorizontal: 8,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  inputFooter: {
    alignItems: 'center',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
});
