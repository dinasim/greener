// screens/MessagesScreen.js - FIXED: Profile Fetching and Navigation
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import { fetchConversations, fetchMessages, sendMessage, startConversation } from '../services/marketplaceApi';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const sellerId = route.params?.sellerId;
  const plantId = route.params?.plantId;
  const plantName = route.params?.plantName;
  const sellerName = route.params?.sellerName;
  const autoMessage = route.params?.autoMessage;
  
  const [activeTab, setActiveTab] = useState(sellerId ? 'chat' : 'conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(autoMessage || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userType, setUserType] = useState('individual');
  const flatListRef = useRef(null);
  
  // Load current user info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const userEmail = await AsyncStorage.getItem('userEmail');
        const storedUserType = await AsyncStorage.getItem('userType');
        setCurrentUserEmail(userEmail || '');
        setUserType(storedUserType || 'individual');
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    };
    loadUserInfo();
  }, []);
  
  useEffect(() => {
    loadConversations();
  }, []);
  
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    // Initialize new conversation if coming from product
    if (sellerId && plantId && !selectedConversation) {
      findOrCreateConversation();
    }
  }, [sellerId, plantId, conversations]);
  
  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userEmail = await AsyncStorage.getItem('userEmail');
      console.log('🔄 Loading conversations for user:', userEmail);
      
      const data = await fetchConversations(userEmail);
      console.log('📨 Raw conversations data:', data);
      
      // Process conversations data
      let conversationsList = [];
      if (Array.isArray(data)) {
        conversationsList = data;
      } else if (data && Array.isArray(data.conversations)) {
        conversationsList = data.conversations;
      }
      
      console.log('📋 Processing', conversationsList.length, 'conversations');
      
      // Process conversations to get proper user info
      const processedConversations = await Promise.all(
        conversationsList.map(async (conv) => {
          console.log('🔍 Processing conversation:', conv);
          
          // FIXED: Better email extraction
          const otherUserEmail = conv.otherUserEmail || 
                                conv.sellerId || 
                                conv.buyerId || 
                                conv.participants?.find(p => p !== userEmail);
          
          console.log('👤 Looking up profile for:', otherUserEmail);
          const otherUserProfile = await getUserProfile(otherUserEmail);
          console.log('✅ Profile loaded:', otherUserProfile);
          
          return {
            ...conv,
            otherUserName: otherUserProfile?.name || 
                          otherUserProfile?.displayName || 
                          otherUserProfile?.businessName ||
                          conv.otherUserName || 
                          conv.sellerName ||
                          otherUserEmail?.split('@')[0] || 
                          'User',
            otherUserAvatar: otherUserProfile?.profileImage || 
                           otherUserProfile?.avatar || 
                           otherUserProfile?.picture ||
                           otherUserProfile?.logo ||
                           null,
            isBusiness: otherUserProfile?.userType === 'business' || 
                       otherUserProfile?.isBusiness || 
                       false,
            businessName: otherUserProfile?.businessName || null,
            otherUserEmail: otherUserEmail,
          };
        })
      );
      
      console.log('✅ Processed conversations:', processedConversations);
      setConversations(processedConversations);
      setIsLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('❌ Error fetching conversations:', err);
      setError('Failed to load conversations. Please try again later.');
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // FIXED: Simplified getUserProfile using correct backend endpoints and field names
  const getUserProfile = async (userEmail) => {
    if (!userEmail) {
      console.log('⚠️ No user email provided');
      return null;
    }
    
    try {
      const currentUserEmail = await AsyncStorage.getItem('userEmail');
      const token = await AsyncStorage.getItem('googleAuthToken');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (currentUserEmail) {
        headers['X-User-Email'] = currentUserEmail;
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('🔍 Fetching profile for:', userEmail);

      // FIXED: Try individual user profile first - using correct backend endpoint
      try {
        const userResponse = await fetch(`https://usersfunctions.azurewebsites.net/api/marketplace/users/${userEmail}`, {
          method: 'GET',
          headers,
        });
        
        console.log('👤 User profile response status:', userResponse.status);
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('👤 User profile data:', userData);
          
          // FIXED: Extract from correct backend structure: {user: {...}}
          const user = userData.user;
          
          if (user && user.name) {
            return {
              name: user.name,
              email: user.email,
              profileImage: user.avatar || user.profileImage || null,
              userType: 'individual',
              isBusiness: false,
              businessName: null,
            };
          }
        }
      } catch (userError) {
        console.log('⚠️ User profile request failed:', userError.message);
      }

      // FIXED: Try business profile - using correct backend endpoint and field names
      try {
        const businessResponse = await fetch(`https://usersfunctions.azurewebsites.net/api/marketplace/business-profile/${userEmail}`, {
          method: 'GET',
          headers,
        });
        
        console.log('🏢 Business profile response status:', businessResponse.status);
        
        if (businessResponse.ok) {
          const businessData = await businessResponse.json();
          console.log('🏢 Business profile data:', businessData);
          
          // FIXED: Extract from correct backend structure: {business: {...}}
          const business = businessData.business;
          
          if (business && (business.businessName || business.name)) {
            return {
              name: business.businessName || business.name,
              email: business.email || business.contactEmail,
              profileImage: business.logo || null,
              userType: 'business',
              isBusiness: true,
              businessName: business.businessName || business.name,
              businessType: business.businessType,
            };
          }
        }
      } catch (businessError) {
        console.log('⚠️ Business profile request failed:', businessError.message);
      }

    } catch (error) {
      console.error('❌ Error in getUserProfile:', error);
    }
    
    console.log('⚠️ No profile found, returning fallback for:', userEmail);
    // FIXED: Better fallback with email-based name
    const fallbackName = userEmail?.split('@')[0];
    return {
      name: fallbackName?.charAt(0).toUpperCase() + fallbackName?.slice(1) || 'User',
      email: userEmail,
      profileImage: null,
      userType: 'individual',
      isBusiness: false,
      businessName: null,
    };
  };

  const findOrCreateConversation = async () => {
    try {
      if (conversations.length === 0) {
        await loadConversations();
      }
      
      // Look for existing conversation with this seller about this plant
      const existingConversation = conversations.find(
        conv => conv.otherUserEmail === sellerId && conv.plantId === plantId
      );
      
      if (existingConversation) {
        console.log('Found existing conversation:', existingConversation);
        setSelectedConversation(existingConversation);
        setActiveTab('chat');
      } else {
        // Create temporary conversation object for new chats
        const sellerProfile = await getUserProfile(sellerId);
        const tempConversation = {
          id: null, // Will be set after first message
          otherUserName: sellerProfile?.name || sellerName || 'Seller',
          otherUserEmail: sellerId,
          otherUserAvatar: sellerProfile?.profileImage || null,
          plantName: plantName || 'Plant',
          plantId: plantId,
          sellerId: sellerId,
          isBusiness: sellerProfile?.isBusiness || false,
          businessName: sellerProfile?.businessName || null,
        };
        setSelectedConversation(tempConversation);
        setActiveTab('chat');
        console.log('Created temporary conversation for new chat');
      }
    } catch (error) {
      console.error('Error finding/creating conversation:', error);
    }
  };
  
  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      // New conversation, no messages to load
      setMessages([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
      const data = await fetchMessages(conversationId, userEmail);
      
      let messagesList = [];
      if (data && Array.isArray(data.messages)) {
        messagesList = data.messages;
      } else if (Array.isArray(data)) {
        messagesList = data;
      }
      
      setMessages(messagesList);
      setIsLoading(false);
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current && messagesList.length > 0) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages. Please try again later.');
      setIsLoading(false);
    }
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
  
    const messageText = newMessage;
    const tempId = 'temp-' + Date.now();
  
    try {
      setIsSending(true);
      const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
      const tempMessage = {
        id: tempId,
        senderId: userEmail,
        text: messageText,
        message: messageText,
        timestamp: new Date().toISOString(),
        pending: true,
        isFromCurrentUser: true
      };
  
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      setNewMessage('');
  
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
  
      if (selectedConversation?.id) {
        // Existing conversation
        await sendMessage(selectedConversation.id, messageText, userEmail);
      } else if (sellerId && plantId) {
        // Create new conversation
        console.log('Starting new conversation with:', sellerId, 'about plant:', plantId);
        const result = await startConversation(sellerId, plantId, messageText, userEmail);
        
        if (result?.messageId || result?.conversationId) {
          const newConversationId = result.conversationId || result.messageId;
          
          // Update the selected conversation with the real ID
          setSelectedConversation(prev => ({
            ...prev,
            id: newConversationId,
            otherUserName: sellerName || result.sellerName || 'Seller',
            plantName: plantName || 'Plant',
            plantId: plantId,
            sellerId: sellerId,
          }));
          
          setTimeout(() => loadConversations(), 500);
        } else {
          throw new Error('Failed to create conversation');
        }
      } else {
        throw new Error('Missing required information to send message');
      }
  
      // Remove pending status from message
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === tempId ? { ...msg, pending: false } : msg
        )
      );
      
      // Trigger update notification
      triggerUpdate(UPDATE_TYPES.MESSAGE, {
        type: 'NEW_MESSAGE',
        conversationId: selectedConversation?.id,
        senderId: userEmail,
        receiverId: sellerId,
        message: messageText,
        plantName: plantName,
        timestamp: Date.now()
      });
  
      setIsSending(false);
    } catch (err) {
      console.error('Error sending message:', err);
      setIsSending(false);
      setNewMessage(messageText);
      setMessages(prevMessages =>
        prevMessages.filter(m => m.id !== tempId)
      );
      Alert.alert('Error', 'Failed to send message. Please try again.', [{ text: 'OK' }]);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'conversations') {
      loadConversations();
    } else if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
    } else {
      setRefreshing(false);
    }
  };
  
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setActiveTab('chat');
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      if (isNaN(date.getTime())) {
        return '';
      }
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      return date.toLocaleDateString([], { 
        year: 'numeric', month: 'short', day: 'numeric' 
      });
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return '';
    }
  };

  // FIXED: Enhanced avatar rendering with better fallback
  const renderAvatar = (avatarUrl, name = 'User', isBusiness = false, size = 52) => {
    if (avatarUrl && avatarUrl.startsWith('http')) {
      return (
        <Image 
          source={{ uri: avatarUrl }} 
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          onError={(e) => {
            console.log('❌ Error loading avatar:', avatarUrl, e.nativeEvent.error);
          }}
        />
      );
    }
    
    // Fallback to initials with better name processing
    const displayName = name || 'User';
    const initials = displayName
      .split(' ')
      .map(word => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
    
    const backgroundColor = isBusiness ? '#FF9800' : '#4CAF50';
    
    return (
      <View style={[
        styles.avatarFallback, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor 
        }
      ]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>
          {initials}
        </Text>
      </View>
    );
  };
  
  const renderConversationsList = () => {
    if (isLoading && conversations.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (conversations.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="forum" size={48} color="#aaa" />
          <Text style={styles.noConversationsText}>You don't have any conversations yet</Text>
          <Text style={styles.startConversationText}>
            {userType === 'business' 
              ? 'Customers will message you about your plants'
              : 'Start a conversation by contacting a seller from a plant listing'
            }
          </Text>
          {userType !== 'business' && (
            <TouchableOpacity 
              style={styles.browseButton} 
              onPress={() => {
                // FIXED: Better navigation without canNavigate
                try {
                  navigation.navigate('MarketplaceHome');
                } catch (error) {
                  console.error('Navigation error:', error);
                  // Try alternative navigation
                  navigation.goBack();
                }
              }}
            >
              <Text style={styles.browseButtonText}>Browse Plants</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    
    return (
      <FlatList
        data={conversations}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.conversationItem} onPress={() => handleSelectConversation(item)}>
            {renderAvatar(item.otherUserAvatar, item.otherUserName, item.isBusiness)}
            <View style={styles.conversationInfo}>
              <View style={styles.conversationHeader}>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.otherUserName}
                  </Text>
                  {item.isBusiness && (
                    <View style={styles.businessBadge}>
                      <MaterialIcons name="store" size={12} color="#FF9800" />
                      <Text style={styles.businessBadgeText}>Business</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.timeStamp}>{formatTimestamp(item.lastMessageTimestamp)}</Text>
              </View>
              <View style={styles.messagePreviewContainer}>
                <Text style={styles.messagePreview} numberOfLines={1}>{item.lastMessage || 'No messages yet'}</Text>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.plantName} numberOfLines={1}>About: {item.plantName || 'Plant discussion'}</Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id || `conv-${item.otherUserName}-${item.plantId}`}
        contentContainerStyle={[styles.conversationsList, conversations.length === 0 && styles.emptyList]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    );
  };
  
  const renderChatScreen = () => {
    const isNewConversation = !selectedConversation?.id && sellerId && plantId;
    
    const renderMessageItem = ({ item }) => {
      const isOwnMessage = item.senderId === currentUserEmail || 
                          item.senderId === 'currentUser' || 
                          item.isFromCurrentUser ||
                          item.senderId === currentUserEmail;
      
      return (
        <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer]}>
          {!isOwnMessage && renderAvatar(
            selectedConversation?.otherUserAvatar, 
            selectedConversation?.otherUserName, 
            selectedConversation?.isBusiness,
            32
          )}
          <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
              item.pending && styles.pendingMessageBubble]}>
            <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
              {item.message || item.text}
            </Text>
            <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
              {item.pending ? 'Sending...' : formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
      );
    };
    
    return (
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <View style={styles.chatHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('conversations')}>
              <MaterialIcons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <View style={styles.chatHeaderNameContainer}>
                <Text style={styles.chatHeaderName} numberOfLines={1}>
                  {selectedConversation?.otherUserName || sellerName || 'New Message'}
                </Text>
                {selectedConversation?.isBusiness && (
                  <View style={styles.businessBadge}>
                    <MaterialIcons name="store" size={14} color="#FF9800" />
                  </View>
                )}
              </View>
              <Text style={styles.chatHeaderPlant} numberOfLines={1}>
                {selectedConversation?.plantName || plantName || 'Plant Discussion'}
              </Text>
            </View>
          </View>
          
          {isLoading && messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="error-outline" size={48} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadMessages(selectedConversation?.id)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={item => item.id || `msg-${item.timestamp}`}
              contentContainerStyle={styles.messagesList}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={() => (
                <View style={styles.emptyChatContainer}>
                  {isNewConversation ? (
                    <>
                      <MaterialIcons name="forum" size={48} color="#aaa" />
                      <Text style={styles.emptyChatText}>New Conversation</Text>
                      <Text style={styles.emptyChatSubtext}>
                        Send a message about {plantName || 'this plant'}
                      </Text>
                      {autoMessage && (
                        <Text style={styles.autoMessageHint}>
                          💡 We've prepared a message for you below
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="forum" size={48} color="#aaa" />
                      <Text style={styles.emptyChatText}>No messages yet</Text>
                      <Text style={styles.emptyChatSubtext}>Send a message to start the conversation</Text>
                    </>
                  )}
                </View>
              )}
            />
          )}
        </KeyboardAvoidingView>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={`Message ${selectedConversation?.isBusiness ? 'business' : 'seller'}...`}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.disabledSendButton]}
            onPress={handleSendMessage} 
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };
    
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader 
        title="Messages" 
        showBackButton={true} 
        onBackPress={() => navigation.goBack()} 
        showNotifications={false} 
      />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'conversations' && styles.activeTabButton]}
          onPress={() => setActiveTab('conversations')}
        >
          <Text style={[styles.tabText, activeTab === 'conversations' && styles.activeTabText]}>
            Conversations
          </Text>
        </TouchableOpacity>
        {(selectedConversation || (sellerId && plantId)) && (
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'chat' && styles.activeTabButton]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
              Chat
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {activeTab === 'conversations' ? renderConversationsList() : renderChatScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTabButton: { borderBottomWidth: 3, borderBottomColor: '#4CAF50' },
  tabText: { fontSize: 16, color: '#888' },
  activeTabText: { color: '#4CAF50', fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#888' },
  errorText: { marginTop: 10, fontSize: 16, color: '#D32F2F', textAlign: 'center' },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#4CAF50', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  noConversationsText: { marginTop: 10, fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center' },
  startConversationText: { marginTop: 8, fontSize: 14, color: '#777', textAlign: 'center', paddingHorizontal: 32 },
  browseButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#4CAF50', borderRadius: 8 },
  browseButtonText: { color: '#fff', fontWeight: '600' },
  conversationsList: { flexGrow: 1, paddingVertical: 4 },
  conversationItem: { flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  avatar: { marginRight: 14, backgroundColor: '#e0e0e0' },
  avatarFallback: { marginRight: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '600' },
  conversationInfo: { flex: 1 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  userNameContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: '#212121', flex: 1 },
  businessBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff3e0', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 8,
    marginLeft: 8
  },
  businessBadgeText: { fontSize: 10, color: '#FF9800', marginLeft: 2, fontWeight: '600' },
  timeStamp: { fontSize: 12, color: '#999' },
  messagePreviewContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messagePreview: { fontSize: 14, color: '#757575', flex: 1 },
  unreadBadge: { backgroundColor: '#4CAF50', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: '600' },
  plantName: { fontSize: 12, color: '#4CAF50' },
  chatHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    backgroundColor: '#ffffff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0' 
  },
  backButton: { padding: 4 },
  chatHeaderInfo: { flex: 1, marginLeft: 12 },
  chatHeaderNameContainer: { flexDirection: 'row', alignItems: 'center' },
  chatHeaderName: { fontSize: 17, fontWeight: '700', color: '#333', flex: 1 },
  chatHeaderPlant: { fontSize: 13, color: '#4CAF50' },
  messagesList: { flexGrow: 1, padding: 16 },
  messageContainer: { flexDirection: 'row', marginBottom: 14, maxWidth: '80%' },
  ownMessageContainer: { alignSelf: 'flex-end' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 16, maxWidth: '100%' },
  ownMessageBubble: { backgroundColor: '#4CAF50', borderBottomRightRadius: 4 },
  otherMessageBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  pendingMessageBubble: { opacity: 0.7 },
  messageText: { fontSize: 16 },
  ownMessageText: { color: '#fff' },
  otherMessageText: { color: '#333' },
  messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  ownMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  otherMessageTime: { color: '#999' },
  inputContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#e0e0e0' 
  },
  input: { 
    flex: 1, 
    backgroundColor: '#F1F3F4', 
    borderRadius: 24, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    fontSize: 15, 
    maxHeight: 100 
  },
  sendButton: { 
    backgroundColor: '#4CAF50', 
    borderRadius: 20, 
    width: 42, 
    height: 42, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 10 
  },
  disabledSendButton: { backgroundColor: '#bdbdbd' },
  emptyChatContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20, 
    height: 300 
  },
  emptyChatText: { 
    marginTop: 10, 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#333', 
    textAlign: 'center' 
  },
  emptyChatSubtext: { 
    marginTop: 8, 
    fontSize: 14, 
    color: '#777', 
    textAlign: 'center', 
    paddingHorizontal: 32 
  },
  autoMessageHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyList: { flex: 1, justifyContent: 'center' },
});

export default MessagesScreen;