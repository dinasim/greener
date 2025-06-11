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
  const isBusiness = route.params?.isBusiness || false;
  const [activeTab, setActiveTab] = useState(sellerId ? 'chat' : 'conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userType, setUserType] = useState('individual');
  const flatListRef = useRef(null);
  
  // Check user type on mount
  useEffect(() => {
    const checkUserType = async () => {
      try {
        const storedUserType = await AsyncStorage.getItem('userType');
        setUserType(storedUserType || 'individual');
      } catch (error) {
        console.error('Error checking user type:', error);
      }
    };
    checkUserType();
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
    // If we have sellerId and plantId from route params, initialize a new conversation
    if (sellerId && plantId && !selectedConversation) {
      findExistingConversation();
    }
  }, [sellerId, plantId, conversations]);
  
  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
      const data = await fetchConversations(userEmail);
      if (Array.isArray(data)) {
        setConversations(data);
      } else if (data && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        console.warn('Unexpected conversation data format:', data);
        setConversations([]);
      }
      setIsLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to load conversations. Please try again later.');
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const findExistingConversation = async () => {
    try {
      if (conversations.length === 0) {
        await loadConversations();
      }
      
      // Look for an existing conversation with this seller for this plant
      const existingConversation = conversations.find(
        conv => (conv.sellerId === sellerId || conv.otherUserEmail === sellerId) && 
               (conv.plantId === plantId || conv.productId === plantId)
      );
      
      if (existingConversation) {
        console.log('Found existing conversation:', existingConversation);
        setSelectedConversation(existingConversation);
        setActiveTab('chat');
      } else {
        // If no existing conversation found, we'll create one when the user sends a message
        console.log('No existing conversation found. Ready for new message.');
        setActiveTab('chat');
      }
    } catch (error) {
      console.error('Error finding existing conversation:', error);
    }
  };
  
  const loadMessages = async (conversationId) => {
    try {
      setIsLoading(true);
      setError(null);
      const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
      const data = await fetchMessages(conversationId, userEmail);
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else if (Array.isArray(data)) {
        setMessages(data);
      } else {
        console.warn('Unexpected messages data format:', data);
        setMessages([]);
      }
      setIsLoading(false);
      setTimeout(() => {
        if (flatListRef.current) {
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
        timestamp: new Date().toISOString(),
        pending: true
      };
  
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      setNewMessage('');
  
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
  
      if (selectedConversation) {
        await sendMessage(selectedConversation.id, messageText, userEmail);
      } else if (sellerId && plantId) {
        // Create new conversation
        console.log('Starting new conversation with:', sellerId, 'about plant:', plantId);
        const result = await startConversation(sellerId, plantId, messageText, userEmail);
        if (result?.messageId || result?.conversationId) {
          setSelectedConversation({
            id: result.conversationId || result.messageId,
            otherUserName: sellerName || result.sellerName || 'Seller',
            plantName: plantName || 'Plant',
            plantId: plantId,
            sellerId: sellerId,
            isBusiness: isBusiness
          });
          setTimeout(() => loadConversations(), 500);
        } else {
          throw new Error('Failed to create conversation');
        }
      } else {
        throw new Error('Missing required information to send message');
      }
  
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === tempId ? { ...msg, pending: false } : msg
        )
      );
      
      // Trigger FCM notification for the other user
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
    } else if (selectedConversation) {
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

  // Get avatar URL with fallback to ui-avatars service
  const getAvatarUrl = (user) => {
    // If the user has a valid avatar URL, use it
    if (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http')) {
      return user.avatar;
    }
    
    // Create avatar URL from user's name with better fallback
    const name = user.otherUserName || user.name || 'User';
    const initial = name.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=4CAF50&color=fff&size=100`;
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
            <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('MarketplaceHome')}>
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
            <Image 
              source={{ uri: getAvatarUrl(item) }} 
              style={styles.avatar}
              onError={(e) => {
                console.log('Error loading avatar:', e.nativeEvent.error);
              }}
            />
            <View style={styles.conversationInfo}>
              <View style={styles.conversationHeader}>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.otherUserName || 'User'}
                  </Text>
                  {item.isBusiness && (
                    <View style={styles.businessBadge}>
                      <MaterialIcons name="store" size={12} color="#4CAF50" />
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
    const isNewConversation = !selectedConversation && sellerId && plantId;
    const renderMessageItem = ({ item }) => {
      // Determine if message is from current user
      const userEmail = AsyncStorage.getItem('userEmail');
      const isOwnMessage = item.senderId === userEmail || 
                          item.senderId === 'currentUser' || 
                          item.isFromCurrentUser;
      
      return (
        <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer]}>
          {!isOwnMessage && (
            <Image 
              source={{ 
                uri: selectedConversation?.otherUserAvatar || 
                      getAvatarUrl({otherUserName: selectedConversation?.otherUserName || sellerName}) 
              }}
              style={styles.messageAvatar}
              onError={(e) => {
                console.log('Error loading message avatar:', e.nativeEvent.error);
              }}
            />
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
                {(selectedConversation?.isBusiness || isBusiness) && (
                  <View style={styles.businessBadge}>
                    <MaterialIcons name="store" size={14} color="#4CAF50" />
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
                        {isBusiness && ' to this business'}
                      </Text>
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
            placeholder={`Message ${isBusiness ? 'business' : 'seller'}...`}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.disabledSendButton]}
            onPress={handleSendMessage} disabled={!newMessage.trim() || isSending}>
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
    
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader title="Messages" showBackButton={true} onBackPress={() => navigation.goBack()} showNotifications={false} />
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'conversations' && styles.activeTabButton]}
          onPress={() => setActiveTab('conversations')}>
          <Text style={[styles.tabText, activeTab === 'conversations' && styles.activeTabText]}>Conversations</Text>
        </TouchableOpacity>
        {(selectedConversation || (sellerId && plantId)) && (
          <TouchableOpacity style={[styles.tabButton, activeTab === 'chat' && styles.activeTabButton]}
            onPress={() => setActiveTab('chat')}>
            <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Chat</Text>
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
  activeTabButton: { borderBottomWidth: 3, borderBottomColor: '#388E3C' },
  tabText: { fontSize: 16, color: '#888' },
  activeTabText: { color: '#388E3C', fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#888' },
  errorText: { marginTop: 10, fontSize: 16, color: '#D32F2F', textAlign: 'center' },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#388E3C', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  noConversationsText: { marginTop: 10, fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center' },
  startConversationText: { marginTop: 8, fontSize: 14, color: '#777', textAlign: 'center', paddingHorizontal: 32 },
  browseButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#388E3C', borderRadius: 8 },
  browseButtonText: { color: '#fff', fontWeight: '600' },
  conversationsList: { flexGrow: 1, paddingVertical: 4 },
  conversationItem: { flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14, backgroundColor: '#e0e0e0' },
  conversationInfo: { flex: 1 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  userNameContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: '#212121', flex: 1 },
  businessBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#e8f5e8', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 8,
    marginLeft: 8
  },
  businessBadgeText: { fontSize: 10, color: '#4CAF50', marginLeft: 2, fontWeight: '600' },
  timeStamp: { fontSize: 12, color: '#999' },
  messagePreviewContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messagePreview: { fontSize: 14, color: '#757575', flex: 1 },
  unreadBadge: { backgroundColor: '#388E3C', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: '600' },
  plantName: { fontSize: 12, color: '#66BB6A' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { padding: 4 },
  chatHeaderInfo: { flex: 1, marginLeft: 12 },
  chatHeaderNameContainer: { flexDirection: 'row', alignItems: 'center' },
  chatHeaderName: { fontSize: 17, fontWeight: '700', color: '#333', flex: 1 },
  chatHeaderPlant: { fontSize: 13, color: '#4CAF50' },
  messagesList: { flexGrow: 1, padding: 16 },
  messageContainer: { flexDirection: 'row', marginBottom: 14, maxWidth: '80%' },
  ownMessageContainer: { alignSelf: 'flex-end' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  messageAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, alignSelf: 'flex-end' },
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
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  input: { flex: 1, backgroundColor: '#F1F3F4', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendButton: { backgroundColor: '#4CAF50', borderRadius: 20, width: 42, height: 42, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  disabledSendButton: { backgroundColor: '#bdbdbd' },
  emptyChatContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, height: 300 },
  emptyChatText: { marginTop: 10, fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center' },
  emptyChatSubtext: { marginTop: 8, fontSize: 14, color: '#777', textAlign: 'center', paddingHorizontal: 32 },
  emptyList: { flex: 1, justifyContent: 'center' },
});

export default MessagesScreen;