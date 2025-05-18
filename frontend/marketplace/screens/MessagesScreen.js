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

const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const sellerId = route.params?.sellerId;
  const plantId = route.params?.plantId;
  const plantName = route.params?.plantName;
  const [activeTab, setActiveTab] = useState(sellerId ? 'chat' : 'conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef(null);
  
  useEffect(() => {
    loadConversations();
  }, []);
  
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (sellerId && plantId && !selectedConversation) {
      findExistingConversation();
    }
  }, [sellerId, plantId]);
  
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
      const existingConversation = conversations.find(
        conv => conv.sellerId === sellerId && conv.plantId === plantId
      );
      if (existingConversation) {
        setSelectedConversation(existingConversation);
        setActiveTab('chat');
      } else {
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
  
    const messageText = newMessage; // Ensure it's available in both try and catch
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
        const result = await startConversation(sellerId, plantId, messageText, userEmail);
        if (result?.messageId) {
          setSelectedConversation({
            id: result.messageId,
            otherUserName: result.sellerName || 'Seller',
            plantName: plantName || 'Plant',
            plantId: plantId,
            sellerId: sellerId
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
  
      setIsSending(false);
    } catch (err) {
      console.error('Error sending message:', err);
      setIsSending(false);
      setNewMessage(messageText); // Restore message text
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
          <Text style={styles.startConversationText}>Start a conversation by contacting a seller from a plant listing</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('MarketplaceHome')}>
            <Text style={styles.browseButtonText}>Browse Plants</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList
        data={conversations}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.conversationItem} onPress={() => handleSelectConversation(item)}>
            <Image 
              source={{ uri: item.otherUserAvatar || 'https://via.placeholder.com/50?text=User' }} 
              style={styles.avatar}
              onError={(e) => {
                console.log('Error loading avatar:', e.nativeEvent.error);
              }}
            />
            <View style={styles.conversationInfo}>
              <View style={styles.conversationHeader}>
                <Text style={styles.userName} numberOfLines={1}>{item.otherUserName || 'User'}</Text>
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
      const isOwnMessage = item.senderId === 'currentUser';
      return (
        <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer]}>
          {!isOwnMessage && (
            <Image source={{ uri: selectedConversation?.otherUserAvatar || 'https://via.placeholder.com/40' }}
              style={styles.messageAvatar}
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
              <Text style={styles.chatHeaderName} numberOfLines={1}>
                {selectedConversation?.otherUserName || 'New Message'}
              </Text>
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
                      <Text style={styles.emptyChatSubtext}>Send a message about {plantName || 'this plant'}</Text>
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
            placeholder="Type a message..."
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
  userName: { fontSize: 16, fontWeight: '700', color: '#212121', flex: 1 },
  timeStamp: { fontSize: 12, color: '#999' },
  messagePreviewContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messagePreview: { fontSize: 14, color: '#757575', flex: 1 },
  unreadBadge: { backgroundColor: '#388E3C', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: '600' },
  plantName: { fontSize: 12, color: '#66BB6A' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { padding: 4 },
  chatHeaderInfo: { flex: 1, marginLeft: 12 },
  chatHeaderName: { fontSize: 17, fontWeight: '700', color: '#333' },
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
});

export default MessagesScreen;