// screens/PlantCareForumScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useCurrentUserType } from '../utils/authUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import ToastMessage from '../marketplace/components/ToastMessage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

export default function PlantCareForumScreen({ navigation }) {
  const { userType, userProfile } = useCurrentUserType();
  const [userPlants, setUserPlants] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);

  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [categoryStats, setCategoryStats] = useState({});
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [topicImages, setTopicImages] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const modalContentRef = useRef(null); // For accessibility fix

  // Create topic form
  const [newTopic, setNewTopic] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: ''
  });

  const categories = [
    { id: 'all', name: 'All Topics', icon: 'forum' },
    { id: 'general', name: 'General Care', icon: 'leaf' },
    { id: 'disease', name: 'Plant Diseases', icon: 'medical-bag' },
    { id: 'pests', name: 'Pest Control', icon: 'bug' },
    { id: 'watering', name: 'Watering', icon: 'water' },
    { id: 'lighting', name: 'Lighting', icon: 'white-balance-sunny' },
    { id: 'fertilizer', name: 'Fertilizing', icon: 'nutrition' },
    { id: 'repotting', name: 'Repotting', icon: 'pot-mix' },
    { id: 'indoor', name: 'Indoor Plants', icon: 'home' },
    { id: 'outdoor', name: 'Outdoor Plants', icon: 'tree' },
  ];

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => setToast({ visible: true, message, type });
  const hideToast = () => setToast(prev => ({ ...prev, visible: false }));

  // --- Search Suggestions State ---
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Add search mode state
  const [searchMode, setSearchMode] = useState('text'); // 'text' or 'tag'

  // --- Delete confirmation modal state ---
  const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, topicId: null, category: null });

  useEffect(() => {
    loadUserEmail();
    loadTopics();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userProfile || !userProfile.email) return;
      if (userType === 'consumer') {
        try {
          const res = await fetch(`https://usersfunctions.azurewebsites.net/api/getalluserplants?email=${encodeURIComponent(userProfile.email)}`);
          const data = await res.json();
          let allPlants = [];
          if (Array.isArray(data)) {
            data.forEach(locationObj => {
              if (locationObj.plants && Array.isArray(locationObj.plants)) {
                locationObj.plants.forEach(p => {
                  allPlants.push({ ...p, location: p.location || locationObj.location });
                });
              }
            });
          }
          setUserPlants(allPlants);
        } catch {
          setUserPlants([]);
        }
        setCurrentLocation(userProfile.location || null);
      } else if (userType === 'business') {
        // For business, fetch inventory and business location if needed
        setUserPlants([]); // or business inventory
        setCurrentLocation(userProfile.location || null);
      }
    };
    fetchUserData();
  }, [userProfile, userType]);

  const loadUserEmail = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      setUserEmail(email || 'Anonymous User');
    } catch (error) {
      console.error('Error loading user email:', error);
    }
  };

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        category: selectedCategory !== 'all' ? selectedCategory : '',
        search: searchQuery,
        limit: '20',
        offset: '0',
        sort: 'lastActivity'
      });
      
      console.log('🔍 Loading forum topics with params:', params.toString());
      
      // FIXED: Use correct API endpoint for plant care forum
      const response = await fetch(`${API_BASE_URL}/plant-care-forum?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('📡 Forum API Response Status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Forum topics loaded:', data);
        
        // FIXED: Handle different response structures from Azure Functions
        const topicsArray = data.topics || data.data || data || [];
        const statsData = data.categoryStats || data.stats || {};
        
        console.log(`📊 Found ${topicsArray.length} topics`);
        
        setTopics(Array.isArray(topicsArray) ? topicsArray : []);
        setCategoryStats(statsData);
        
        // Log first topic for debugging
        if (topicsArray.length > 0) {
          console.log('🔍 First topic sample:', topicsArray[0]);
        }
      } else {
        // Enhanced error handling for debugging
        const errorText = await response.text();
        console.error(`❌ Forum API error (${response.status}): ${response.statusText}`);
        console.error('Error response:', errorText);
        
        if (response.status === 404) {
          console.log('⚠️ The plant-care-forum endpoint might be missing or misconfigured');
        }
        
        // Show user-friendly error but don't break the app
        setTopics([]);
        setCategoryStats({});
        
        // Only show alert for non-404 errors to avoid spam
        if (response.status !== 404) {
          Alert.alert('Forum Error', 'Unable to load forum topics. Please try again later.');
        }
      }
    } catch (error) {
      console.error('🔥 Forum API connection failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Connection failed. ';
      if (error.message.includes('Network request failed')) {
        errorMessage += 'Please check your internet connection.';
      } else {
        errorMessage += 'Please try again later.';
      }
      
      setTopics([]);
      setCategoryStats({});
      
      // Only show alert for actual network errors
      if (!error.message.includes('404')) {
        Alert.alert('Connection Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Image upload functionality
  const uploadImageToServer = async (imageUri) => {
    try {
      setIsUploadingImage(true);
      
      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // Upload to server - FIXED path to match function.json route
      const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          type: 'forum',
          contentType: 'image/jpeg'
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await uploadResponse.json();
      return result.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      if (topicImages.length >= 3) {
        Alert.alert('Limit Reached', 'You can upload up to 3 images per topic');
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Camera roll access is required to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUrl = await uploadImageToServer(result.assets[0].uri);
        setTopicImages(prev => [...prev, { uri: result.assets[0].uri, url: imageUrl }]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      if (topicImages.length >= 3) {
        Alert.alert('Limit Reached', 'You can upload up to 3 images per topic');
        return;
      }

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Camera access is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUrl = await uploadImageToServer(result.assets[0].uri);
        setTopicImages(prev => [...prev, { uri: result.assets[0].uri, url: imageUrl }]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index) => {
    setTopicImages(prev => prev.filter((_, i) => i !== index));
  };

  const createNewTopic = async () => {
    if (!newTopic.title.trim() || !newTopic.content.trim()) {
      showToast('Please fill in both title and content', 'error');
      return;
    }
    if (!userEmail || userEmail === 'Anonymous User') {
      showToast('Please log in to create a topic', 'error');
      return;
    }

    try {
      setIsCreatingTopic(true);
      
      const topicData = {
        title: newTopic.title.trim(),
        content: newTopic.content.trim(),
        category: newTopic.category,
        author: userEmail,
        tags: newTopic.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        images: topicImages.map(img => img.url), // Include uploaded image URLs
        authorType: userType === 'business' ? 'business' : 'customer'
      };

      const response = await fetch(`${API_BASE_URL}/plant-care-forum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(topicData)
      });

      if (response.ok) {
        const result = await response.json();
        setShowCreateModal(false);
        setNewTopic({ title: '', content: '', category: 'general', tags: '' });
        setTopicImages([]); // Clear uploaded images
        loadTopics();
        showToast('Your topic has been posted successfully!', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create topic');
      }
    } catch (error) {
      console.error('Error creating topic:', error);
      showToast(`Failed to create topic: ${error.message}`, 'error');
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const handleTopicPress = (topic) => {
    // Navigate to topic detail screen (to be implemented)
    navigation.navigate('ForumTopicDetail', { 
      topicId: topic.id, 
      topic,
      category: topic.category
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTopics();
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now - time) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return `${Math.floor(diffInHours / 168)}w ago`;
  };

  const getCategoryDisplayName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'General';
  };

  const getCategoryIcon = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.icon : 'leaf';
  };

  // Delete topic handler
  const deleteTopic = (topicId, category) => {
    setDeleteConfirm({ visible: true, topicId, category });
  };

  const confirmDelete = async () => {
    const { topicId, category } = deleteConfirm;
    setDeleteConfirm({ visible: false, topicId: null, category: null });
    try {
      const response = await fetch(`${API_BASE_URL}/plant-care-forum?topicId=${encodeURIComponent(topicId)}&category=${encodeURIComponent(category)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete topic');
      }
      setTopics(prev => prev.filter(t => t.id !== topicId));
      showToast('Topic deleted successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete topic.', 'error');
    }
  };

  const cancelDelete = () => setDeleteConfirm({ visible: false, topicId: null, category: null });

  // --- Enhanced Search Suggestions Logic ---
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    // Filter topics by current category (tab)
    const filteredTopics = selectedCategory === 'all'
      ? topics
      : topics.filter(t => t.category === selectedCategory);
    if (!query) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (searchMode === 'tag') {
      const tagMatches = filteredTopics.filter(t =>
        Array.isArray(t.tags) && t.tags.length > 0 && t.tags.some(tag => tag.toLowerCase().includes(query))
      );
      setSuggestions(tagMatches);
      setShowSuggestions(true);
    } else {
      const titleMatches = filteredTopics.filter(t => t.title?.toLowerCase().includes(query));
      const contentMatches = filteredTopics.filter(t => !titleMatches.includes(t) && t.content?.toLowerCase().includes(query));
      const replyMatches = [];
      setSuggestions([...titleMatches, ...contentMatches, ...replyMatches]);
      setShowSuggestions(true);
    }
  }, [searchQuery, topics, searchMode, selectedCategory]);

  const renderTopic = (topic) => (
    <TouchableOpacity
      key={topic.id}
      style={styles.topicCard}
      onPress={() => handleTopicPress(topic)}
    >
      <View style={styles.topicHeader}>
        <View style={styles.topicStatus}>
          {topic.isAnswered ? (
            <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
          ) : (
            <MaterialIcons name="help" size={16} color="#FF9800" />
          )}
          <Text style={[
            styles.statusText,
            { color: topic.isAnswered ? '#4CAF50' : '#FF9800' }
          ]}>
            {topic.isAnswered ? 'Answered' : 'Open'}
          </Text>
        </View>
        <View style={styles.categoryBadgeSmall}>
          <MaterialCommunityIcons 
            name={getCategoryIcon(topic.category)} 
            size={12} 
            color="#4CAF50" 
          />
          <Text style={styles.categoryText}>
            {getCategoryDisplayName(topic.category)}
          </Text>
        </View>
        {/* Delete button for author */}
        {userEmail && topic.author === userEmail && (
          <TouchableOpacity onPress={() => deleteTopic(topic.id, topic.category)} style={{ marginLeft: 8 }}>
            <MaterialIcons name="delete" size={20} color="#f44336" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.topicTitle} numberOfLines={2}>{topic.title}</Text>
      <Text style={styles.topicContent} numberOfLines={2}>{topic.content}</Text>

      {/* Display topic images if available */}
      {topic.images && topic.images.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.topicImagesContainer}
          contentContainerStyle={styles.topicImagesContent}
        >
          {topic.images.slice(0, 3).map((imageUrl, index) => (
            <Image 
              key={index}
              source={{ uri: imageUrl }} 
              style={styles.topicImage}
              resizeMode="cover"
            />
          ))}
          {topic.images.length > 3 && (
            <View style={styles.moreImagesIndicator}>
              <Text style={styles.moreImagesText}>+{topic.images.length - 3}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {topic.tags && topic.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {topic.tags.slice(0, 3).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.topicFooter}>
        <Text style={styles.authorText}>by {topic.author}</Text>
        
        <View style={styles.topicStats}>
          {topic.hasImages && (
            <View style={styles.statItem}>
              <MaterialIcons name="image" size={14} color="#4CAF50" />
              <Text style={styles.statText}>{topic.images?.length || 0}</Text>
            </View>
          )}
          
          <View style={styles.statItem}>
            <MaterialIcons name="chat-bubble" size={14} color="#666" />
            <Text style={styles.statText}>{topic.replies || 0}</Text>
          </View>
          
          <View style={styles.statItem}>
            <MaterialIcons name="visibility" size={14} color="#666" />
            <Text style={styles.statText}>{topic.views || 0}</Text>
          </View>
          
          <Text style={styles.timeText}>{formatDateTime24(topic.lastActivity || topic.timestamp)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Accessibility fix: blur focus if inside modal before closing (web only)
  function closeCreateModal() {
    if (
      typeof document !== 'undefined' &&
      modalContentRef.current &&
      typeof modalContentRef.current.contains === 'function'
    ) {
      const active = document.activeElement;
      if (active && modalContentRef.current.contains(active)) {
        active.blur();
      }
    }
    setShowCreateModal(false);
  }

  // --- Render search suggestions dropdown ---
  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0) return null;
    return (
      <View style={{
        position: 'absolute',
        top: 48,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        zIndex: 100,
        maxHeight: 200,
      }}>
        {suggestions.slice(0, 5).map(s => (
          <TouchableOpacity
            key={s.id}
            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
            onPress={() => {
              setSearchQuery(s.title);
              setShowSuggestions(false);
              handleTopicPress(s);
            }}
          >
            <Text style={{ fontWeight: 'bold', color: '#333' }}>{s.title}</Text>
            <Text style={{ color: '#666', fontSize: 12 }} numberOfLines={1}>{s.content}</Text>
            <Text style={{ color: '#888', fontSize: 11 }}>{formatDateTime24(s.lastActivity || s.timestamp)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Toast Message always visible at root */}
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🌱 Plant Care Forum</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <MaterialIcons name="add" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search by ${searchMode === 'tag' ? 'tag' : 'text'} in ${getCategoryDisplayName(selectedCategory)}`}
          value={searchQuery}
          onChangeText={text => {
            setSearchQuery(text);
            setShowSuggestions(!!text);
          }}
          onFocus={() => setShowSuggestions(!!searchQuery)}
        />
        {/* Toggle search mode button */}
        <TouchableOpacity
          style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#e0e0e0' }}
          onPress={() => setSearchMode(searchMode === 'text' ? 'tag' : 'text')}
          accessibilityLabel={searchMode === 'text' ? 'Switch to tag search' : 'Switch to text search'}
        >
          <Text style={{ fontSize: 12, color: '#333', fontWeight: 'bold' }}>{searchMode === 'text' ? 'Text' : 'Tag'}</Text>
        </TouchableOpacity>
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
        {renderSuggestions()}
      </View>

      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              selectedCategory === category.id && styles.activeCategoryButton
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <MaterialCommunityIcons 
              name={category.icon} 
              size={16} 
              color={selectedCategory === category.id ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.categoryButtonText,
              selectedCategory === category.id && styles.activeCategoryButtonText
            ]}>
              {category.name}
              {categoryStats[category.id] ? ` (${categoryStats[category.id]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Topics List */}
      <ScrollView
        style={styles.topicsContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading topics...</Text>
          </View>
        ) : topics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="forum" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No topics found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try a different search term' : 'Be the first to start a discussion!'}
            </Text>
            <TouchableOpacity 
              style={styles.createTopicButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createTopicButtonText}>Create First Topic</Text>
            </TouchableOpacity>
          </View>
        ) : (
          topics.map(renderTopic)
        )}
      </ScrollView>

      {/* Create Topic Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={closeCreateModal}
        transparent={true}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* ToastMessage also inside modal for feedback */}
          <ToastMessage
            visible={toast.visible}
            message={toast.message}
            type={toast.type}
            onHide={hideToast}
            duration={3000}
          />
          <KeyboardAvoidingView 
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            ref={modalContentRef}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeCreateModal}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create New Topic</Text>
              <TouchableOpacity 
                style={[styles.postButton, isCreatingTopic && styles.postButtonDisabled]}
                onPress={createNewTopic}
                disabled={isCreatingTopic}
              >
                {isCreatingTopic ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              {/* Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="What's your question or topic?"
                  value={newTopic.title}
                  onChangeText={(text) => setNewTopic(prev => ({ ...prev, title: text }))}
                  maxLength={100}
                />
              </View>

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryOptions}>
                    {categories.filter(c => c.id !== 'all').map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryOption,
                          newTopic.category === category.id && styles.selectedCategoryOption
                        ]}
                        onPress={() => setNewTopic(prev => ({ ...prev, category: category.id }))}
                      >
                        <MaterialCommunityIcons 
                          name={category.icon} 
                          size={16} 
                          color={newTopic.category === category.id ? '#fff' : '#666'} 
                        />
                        <Text style={[
                          styles.categoryOptionText,
                          newTopic.category === category.id && styles.selectedCategoryOptionText
                        ]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Content */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={styles.contentInput}
                  placeholder="Describe your question or share your experience..."
                  value={newTopic.content}
                  onChangeText={(text) => setNewTopic(prev => ({ ...prev, content: text }))}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              {/* Tags */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tags (optional)</Text>
                <TextInput
                  style={styles.tagsInput}
                  placeholder="e.g. monstera, watering, indoor (comma separated)"
                  value={newTopic.tags}
                  onChangeText={(text) => setNewTopic(prev => ({ ...prev, tags: text }))}
                />
              </View>

              {/* Image Upload */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Upload Image (optional)</Text>
                <View style={styles.imageUploadContainer}>
                  <TouchableOpacity 
                    style={styles.imageUploadButton}
                    onPress={pickImageFromGallery}
                  >
                    <MaterialIcons name="image" size={24} color="#4CAF50" />
                    <Text style={styles.imageUploadButtonText}>Choose from Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.imageUploadButton}
                    onPress={takePhotoWithCamera}
                  >
                    <MaterialIcons name="camera-alt" size={24} color="#4CAF50" />
                    <Text style={styles.imageUploadButtonText}>Take a Photo</Text>
                  </TouchableOpacity>
                </View>

                {topicImages.length > 0 && (
                  <View style={styles.selectedImagesContainer}>
                    {topicImages.map((image, index) => (
                      <View key={index} style={styles.selectedImageWrapper}>
                        <Image source={{ uri: image.uri }} style={styles.selectedImage} />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <MaterialIcons name="remove-circle" size={20} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- Custom Delete Confirmation Modal --- */}
      {deleteConfirm.visible && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.25)',
          justifyContent: 'center', alignItems: 'center',
          zIndex: 9999
        }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 260, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Delete Topic</Text>
            <Text style={{ fontSize: 14, color: '#444', marginBottom: 20, textAlign: 'center' }}>
              Are you sure you want to delete this topic? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <TouchableOpacity onPress={cancelDelete} style={{ padding: 10, marginHorizontal: 8, borderRadius: 8, backgroundColor: '#eee' }}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={{ padding: 10, marginHorizontal: 8, borderRadius: 8, backgroundColor: '#f44336' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  createButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14, // slightly more padding for comfort
    paddingVertical: 6, // slightly larger than the new style, but less than the original
    borderRadius: 14,   // between old (16) and new (10)
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeCategoryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryButtonText: {
    fontSize: 13, // between old (12) and new (14)
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  topicCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 9, // between old (12) and new (10)
    paddingVertical: 3,   // keep as 3 for balance
    borderRadius: 11,     // between old (12) and new (10)
    minHeight: 17,        // between old (18) and new (16)
    height: 21,           // between old (22) and new (20)
  },
  categoryText: {
    fontSize: 14, // between old (15) and new (13)
    color: '#2e7d32',
    marginLeft: 6,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  topicContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#1976d2',
    fontWeight: '500',
  },
  topicFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorText: {
    fontSize: 12,
    color: '#666',
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  postButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  contentInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    height: 120,
  },
  tagsInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  categoryOptions: {
    flexDirection: 'row',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCategoryOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  selectedCategoryOptionText: {
    color: '#fff',
  },
  imageUploadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    flex: 1,
    marginRight: 8,
  },
  imageUploadButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  selectedImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  selectedImageWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f44336',
    padding: 4,
  },
  topicImagesContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  topicImagesContent: {
    paddingHorizontal: 0,
  },
  topicImage: {
    width: 100,
    height: 75,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 4,
  },
  moreImagesIndicator: {
    backgroundColor: '#f0f9f3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
});

// Helper for 24h date formatting
function formatDateTime24(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
}