// components/ai/SmartPlantCareAssistant.js
import React, { useState, useRef } from 'react';
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
  Modal,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

export default function SmartPlantCareAssistant({ visible, onClose, plant = null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const scrollViewRef = useRef(null);

  // AI Analysis Functions
  const analyzePlantHealth = async (imageUri = null, userQuestion = '') => {
    setIsLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      const requestBody = {
        question: userQuestion || 'Analyze this plant\'s health and provide care recommendations',
        plantInfo: plant ? {
          name: plant.name || plant.common_name,
          scientificName: plant.scientific_name,
          waterDays: plant.water_days,
          light: plant.light,
          humidity: plant.humidity
        } : null,
        imageUri: imageUri,
        userEmail: userEmail
      };

      const response = await fetch(`${API_BASE_URL}/plantCareAI`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to get AI analysis');
      }

      const result = await response.json();
      
      setDiagnosis(result.diagnosis);
      setRecommendations(result.recommendations || []);
      
      // Add to chat history
      const newMessage = {
        id: Date.now(),
        type: 'ai_response',
        question: userQuestion,
        diagnosis: result.diagnosis,
        recommendations: result.recommendations,
        timestamp: new Date().toISOString(),
        hasImage: !!imageUri
      };
      
      setChatHistory(prev => [...prev, newMessage]);
      
    } catch (error) {
      console.error('AI Analysis Error:', error);
      Alert.alert('Error', 'Failed to analyze plant. Please try again.');
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

    // Add user question to chat
    const userMessage = {
      id: Date.now(),
      type: 'user_question',
      question: question.trim(),
      image: selectedImage,
      timestamp: new Date().toISOString()
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    
    // Analyze with AI
    analyzePlantHealth(selectedImage, question.trim());
    
    // Clear inputs
    setQuestion('');
    setSelectedImage(null);
  };

  const getQuickSuggestions = () => [
    "Why are my plant's leaves turning yellow?",
    "How often should I water this plant?",
    "What's wrong with my plant's growth?",
    "Is my plant getting enough light?",
    "How to treat plant pests naturally?",
    "When should I repot my plant?"
  ];

  const renderChatMessage = (message) => {
    if (message.type === 'user_question') {
      return (
        <View key={message.id} style={styles.userMessage}>
          <Text style={styles.userQuestionText}>{message.question}</Text>
          {message.image && (
            <Image source={{ uri: message.image }} style={styles.messageImage} />
          )}
          <Text style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      );
    } else {
      return (
        <View key={message.id} style={styles.aiMessage}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="robot" size={20} color="#4CAF50" />
            <Text style={styles.aiTitle}>Plant Care Assistant</Text>
          </View>
          
          {message.diagnosis && (
            <View style={styles.diagnosisSection}>
              <Text style={styles.sectionTitle}>Analysis:</Text>
              <Text style={styles.diagnosisText}>{message.diagnosis}</Text>
            </View>
          )}
          
          {message.recommendations && message.recommendations.length > 0 && (
            <View style={styles.recommendationsSection}>
              <Text style={styles.sectionTitle}>Recommendations:</Text>
              {message.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <MaterialIcons name="lightbulb" size={16} color="#FF9800" />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}
          
          <Text style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🤖 Plant Care Assistant</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Plant Info */}
        {plant && (
          <View style={styles.plantInfo}>
            <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" />
            <Text style={styles.plantName}>
              {plant.name || plant.common_name || 'Your Plant'}
            </Text>
          </View>
        )}

        {/* Chat History */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd()}
        >
          {chatHistory.length === 0 ? (
            <View style={styles.welcomeContainer}>
              <MaterialCommunityIcons name="robot" size={64} color="#4CAF50" />
              <Text style={styles.welcomeTitle}>AI Plant Care Assistant</Text>
              <Text style={styles.welcomeText}>
                Ask me anything about plant care! I can analyze photos, diagnose problems, 
                and provide personalized care recommendations.
              </Text>
              
              <Text style={styles.suggestionsTitle}>Quick Questions:</Text>
              {getQuickSuggestions().map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => setQuestion(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            chatHistory.map(message => renderChatMessage(message))
          )}
          
          {isLoading && (
            <View style={styles.loadingMessage}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingText}>Analyzing your plant...</Text>
            </View>
          )}
        </ScrollView>

        {/* Input Section */}
        <View style={styles.inputSection}>
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
            <TextInput
              style={styles.textInput}
              placeholder="Ask about your plant's care, health, or problems..."
              value={question}
              onChangeText={setQuestion}
              multiline
              maxLength={500}
            />
            
            <View style={styles.inputActions}>
              <TouchableOpacity onPress={handleTakePhoto} style={styles.actionButton}>
                <MaterialIcons name="camera-alt" size={24} color="#4CAF50" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleImagePick} style={styles.actionButton}>
                <MaterialIcons name="photo-library" size={24} color="#4CAF50" />
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSubmitQuestion}
                style={[
                  styles.sendButton,
                  (!question.trim() && !selectedImage) && styles.sendButtonDisabled
                ]}
                disabled={!question.trim() && !selectedImage}
              >
                <MaterialIcons name="send" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  headerRight: {
    width: 40,
  },
  plantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0f9f3',
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  suggestionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignSelf: 'stretch',
  },
  suggestionText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
  },
  userMessage: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  userQuestionText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  messageImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  aiMessage: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignSelf: 'flex-start',
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  diagnosisSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  diagnosisText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  recommendationsSection: {
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  loadingMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  inputSection: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 12,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    padding: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
});