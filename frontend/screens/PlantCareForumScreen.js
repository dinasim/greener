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
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

export default function PlantCareForumScreen({ navigation }) {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [categoryStats, setCategoryStats] = useState({});
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

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

  useEffect(() => {
    loadUserEmail();
    loadTopics();
  }, [selectedCategory, searchQuery]);

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
        category: selectedCategory,
        search: searchQuery,
        limit: '20',
        offset: '0',
        sort: 'lastActivity'
      });
      
      const response = await fetch(`${API_BASE_URL}/plant-care-forum?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics || []);
        setCategoryStats(data.categoryStats || {});
      } else {
        // Silently handle API errors without flooding console
        console.log('🔇 Forum API temporarily unavailable - showing offline message');
        setTopics([]);
        setCategoryStats({});
      }
    } catch (error) {
      // Silently handle network errors without flooding console
      console.log('🔇 Forum API connection failed - showing offline message');
      setTopics([]);
      setCategoryStats({});
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const createNewTopic = async () => {
    if (!newTopic.title.trim() || !newTopic.content.trim()) {
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    if (!userEmail || userEmail === 'Anonymous User') {
      Alert.alert('Error', 'Please log in to create a topic');
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
        authorType: 'customer' // Determine this based on user type
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
        loadTopics(); // Reload topics to show the new one
        Alert.alert('Success', 'Your topic has been posted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create topic');
      }
    } catch (error) {
      console.error('Error creating topic:', error);
      Alert.alert('Error', `Failed to create topic: ${error.message}`);
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
        
        <View style={styles.categoryBadge}>
          <MaterialCommunityIcons 
            name={getCategoryIcon(topic.category)} 
            size={12} 
            color="#666" 
          />
          <Text style={styles.categoryText}>
            {getCategoryDisplayName(topic.category)}
          </Text>
        </View>
      </View>

      <Text style={styles.topicTitle} numberOfLines={2}>{topic.title}</Text>
      <Text style={styles.topicContent} numberOfLines={2}>{topic.content}</Text>

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
          <View style={styles.statItem}>
            <MaterialIcons name="thumb-up" size={14} color="#666" />
            <Text style={styles.statText}>{topic.votes || 0}</Text>
          </View>
          
          <View style={styles.statItem}>
            <MaterialIcons name="chat-bubble" size={14} color="#666" />
            <Text style={styles.statText}>{topic.replies || 0}</Text>
          </View>
          
          <View style={styles.statItem}>
            <MaterialIcons name="visibility" size={14} color="#666" />
            <Text style={styles.statText}>{topic.views || 0}</Text>
          </View>
          
          <Text style={styles.timeText}>{formatTimeAgo(topic.lastActivity || topic.timestamp)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
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
          placeholder="Search topics..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
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
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
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
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeCategoryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeCategoryButtonText: {
    color: '#fff',
  },
  topicsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
  categoryText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
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
});