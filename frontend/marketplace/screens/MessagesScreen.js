// screens/MessagesScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';

// Messaging API (same module for marketplace + order messages)
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  sendOrderMessage,
} from '../services/marketplaceApi';

import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // -------- Normalize route params (works for plant or order chat) --------
  const params = route.params || {};
  const isOrderChat =
    !!params.isOrderChat || !!params.orderId || !!params.orderNumber;

  // who we are talking to
  const sellerId =
    params.sellerId ||
    params.recipientEmail ||
    params.otherUserEmail ||
    params.customerEmail ||
    null;

  // topic identifiers (for plants use plantId; for orders we keep a virtual topic id)
  const plantId =
    params.plantId ||
    (isOrderChat
      ? `order:${params.orderId || params.orderNumber || ''}`
      : undefined);

  const plantName =
    params.plantName ||
    (isOrderChat
      ? `Order ${params.orderNumber || params.orderId || ''}`
      : undefined);

  const sellerName =
    params.sellerName || params.recipientName || params.customerName || null;

  const autoMessage = params.autoMessage || '';

  // -------------------- State --------------------
  const [activeTab, setActiveTab] = useState(sellerId ? 'chat' : 'conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(autoMessage);

  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
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
      } catch (err) {
        console.error('Error loading user info:', err);
      }
    };
    loadUserInfo();
  }, []);

  // Initial loads
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when selection/params change
  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
    } else if (sellerId && plantId) {
      // from deep link / button -> create/find conversation shell
      findOrCreateConversation();
    } else {
      setIsMessagesLoading(false);
    }
    // Do NOT depend on `conversations` to avoid extra refetch loops
  }, [sellerId, plantId, selectedConversation?.id]);

  // -------------------- Data loaders --------------------
  const loadConversations = async () => {
    try {
      setIsConversationsLoading(true);
      setError(null);
      const userEmail = await AsyncStorage.getItem('userEmail');
      const data = await fetchConversations(userEmail);

      let conversationsList = [];
      if (Array.isArray(data)) conversationsList = data;
      else if (data && Array.isArray(data.conversations)) conversationsList = data.conversations;

      const processed = await Promise.all(
        conversationsList.map(async (conv) => {
          const otherUserEmail =
            conv.otherUserEmail ||
            conv.sellerId ||
            conv.buyerId ||
            conv.participants?.find((p) => p !== userEmail);

          const profile = await getUserProfile(otherUserEmail);

          // Label topic nicely (orders show "Order XYZ")
          const topicName =
            conv.plantName ||
            (conv.orderNumber ? `Order ${conv.orderNumber}` : '') ||
            (conv.orderId ? `Order ${conv.orderId}` : '') ||
            'Plant discussion';

          return {
            ...conv,
            otherUserEmail: otherUserEmail,
            otherUserName:
              profile?.name ||
              conv.otherUserName ||
              conv.sellerName ||
              (otherUserEmail ? otherUserEmail.split('@')[0] : 'User'),
            otherUserAvatar:
              profile?.profileImage ||
              conv.otherUserAvatar ||
              null,
            isBusiness: !!(profile?.userType === 'business' || profile?.isBusiness),
            businessName: profile?.businessName || null,
            plantName: topicName,
          };
        })
      );

      setConversations(processed);
    } catch (err) {
      console.error('Conversations error:', err);
      setError('Failed to load conversations. Please try again later.');
    } finally {
      setIsConversationsLoading(false);
      setRefreshing(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      setIsMessagesLoading(false);
      return;
    }
    try {
      setIsMessagesLoading(true);
      setError(null);
      const userEmail = (await AsyncStorage.getItem('userEmail')) || 'default@example.com';
      const data = await fetchMessages(conversationId, userEmail);

      const messagesList = Array.isArray(data) ? data : (data?.messages || []);
      setMessages(messagesList);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (err) {
      console.error('Messages error:', err);
      setError('Failed to load messages. Please try again later.');
    } finally {
      setIsMessagesLoading(false);
    }
  };

  // -------------------- Helpers --------------------
  const getUserProfile = async (userEmail) => {
    if (!userEmail) return null;
    try {
      const currentEmail = await AsyncStorage.getItem('userEmail');
      const token = await AsyncStorage.getItem('googleAuthToken');

      const headers = { 'Content-Type': 'application/json' };
      if (currentEmail) headers['X-User-Email'] = currentEmail;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Try individual
      try {
        const r = await fetch(
          `https://usersfunctions.azurewebsites.net/api/marketplace/users/${userEmail}`,
          { method: 'GET', headers }
        );
        if (r.ok) {
          const j = await r.json();
          const u = j?.user;
          if (u?.name) {
            return {
              name: u.name,
              email: u.email,
              profileImage: u.avatar || u.profileImage || null,
              userType: 'individual',
              isBusiness: false,
              businessName: null,
            };
          }
        }
      } catch {}

      // Try business
      try {
        const r2 = await fetch(
          `https://usersfunctions.azurewebsites.net/api/marketplace/business/${userEmail}/profile`,
          { method: 'GET', headers }
        );
        if (r2.ok) {
          const j2 = await r2.json();
          const b = j2?.business;
          if (b && (b.businessName || b.name)) {
            return {
              name: b.businessName || b.name,
              email: b.email || b.contactEmail,
              profileImage: b.logo || null,
              userType: 'business',
              isBusiness: true,
              businessName: b.businessName || b.name,
              businessType: b.businessType,
            };
          }
        }
      } catch {}

      // Fallback
      const fallback = userEmail.split('@')[0] || 'User';
      return {
        name: fallback.charAt(0).toUpperCase() + fallback.slice(1),
        email: userEmail,
        profileImage: null,
        userType: 'individual',
        isBusiness: false,
        businessName: null,
      };
    } catch (e) {
      console.error('getUserProfile error:', e);
      return null;
    }
  };

  const findOrCreateConversation = async () => {
    try {
      if (conversations.length === 0) {
        await loadConversations();
      }

      // Find existing conversation with same other user + topic
      const existing = conversations.find((conv) => {
        const otherEmail =
          conv.otherUserEmail ||
          conv.sellerId ||
          conv.buyerId ||
          conv.participants?.find((p) => p !== currentUserEmail);

        const topicId = conv.plantId || conv.orderId || conv.topicId || conv.subjectId;
        const wantOrderId = params.orderId ? String(params.orderId) : null;

        const topicMatches =
          (!plantId && !wantOrderId) ||
          topicId === plantId || // plant chat
          (isOrderChat && wantOrderId && String(conv.orderId) === wantOrderId); // order chat

        return otherEmail === sellerId && topicMatches;
      });

      if (existing) {
        setSelectedConversation(existing);
        setActiveTab('chat');
        return;
      }

      // New conversation shell (no messages yet -> no spinner)
      setIsMessagesLoading(false);

      const profile = await getUserProfile(sellerId);
      setSelectedConversation({
        id: null, // will be filled after first message
        otherUserName:
          profile?.name ||
          sellerName ||
          (sellerId ? sellerId.split('@')[0] : 'User'),
        otherUserEmail: sellerId,
        otherUserAvatar: profile?.profileImage || null,
        isBusiness: !!profile?.isBusiness,
        businessName: profile?.businessName || null,

        // topic metadata
        plantId: isOrderChat ? undefined : plantId,
        plantName: isOrderChat ? undefined : (plantName || 'Plant'),
        orderId: isOrderChat ? params.orderId || null : undefined,
        orderNumber: isOrderChat ? params.orderNumber || null : undefined,
      });
      setActiveTab('chat');
    } catch (e) {
      console.error('findOrCreateConversation error:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage;
    const tempId = `temp-${Date.now()}`;

    try {
      setIsSending(true);
      const userEmail =
        (await AsyncStorage.getItem('userEmail')) || 'default@example.com';

      // optimistic add
      const temp = {
        id: tempId,
        senderId: userEmail,
        text: messageText,
        message: messageText,
        timestamp: new Date().toISOString(),
        pending: true,
        isFromCurrentUser: true,
      };
      setMessages((prev) => [...prev, temp]);
      setNewMessage('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

      if (selectedConversation?.id) {
        // Existing conversation (plant or order thread that already has an id)
        await sendMessage(selectedConversation.id, messageText, userEmail);
      } else if (isOrderChat && sellerId) {
        // Order chat – send directly with order metadata
        await sendOrderMessage(sellerId, messageText, userEmail, {
          orderId: params.orderId,
          confirmationNumber: params.orderNumber,
          topic: 'order',
        });

        // Give a stable synthetic id locally so subsequent sends use sendMessage
        setSelectedConversation((prev) => ({
          ...prev,
          id: prev?.id || `order-${params.orderId || Date.now()}`,
        }));

        // Refresh conversations quietly
        setTimeout(loadConversations, 400);
      } else if (sellerId && plantId) {
        // Plant chat – create conversation in backend
        const result = await startConversation(
          sellerId,
          plantId,
          messageText,
          userEmail
        );
        const newId = result?.conversationId || result?.messageId;
        if (!newId) throw new Error('Failed to create conversation');

        setSelectedConversation((prev) => ({ ...prev, id: newId }));
        setTimeout(loadConversations, 400);
      } else {
        throw new Error('Missing information to send message');
      }

      // clear pending
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m))
      );

      triggerUpdate(UPDATE_TYPES.MESSAGE, {
        type: 'NEW_MESSAGE',
        conversationId: selectedConversation?.id || `order-${params.orderId}`,
        senderId: userEmail,
        receiverId: sellerId,
        message: messageText,
        plantName,
        orderNumber: params.orderNumber,
        timestamp: Date.now(),
      });

      setIsSending(false);
    } catch (err) {
      console.error('Send error:', err);
      setIsSending(false);
      setNewMessage(messageText);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.', [
        { text: 'OK' },
      ]);
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

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const now = new Date();
      if (isNaN(d.getTime())) return '';
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // -------------------- UI renderers --------------------
  const renderAvatar = (avatarUrl, name = 'User', isBusiness = false, size = 52) => {
    if (avatarUrl && avatarUrl.startsWith('http')) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }
    const initials =
      (name || 'U')
        .split(' ')
        .map((w) => w.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';
    const bg = isBusiness ? '#FF9800' : '#4CAF50';
    return (
      <View
        style={[
          styles.avatarFallback,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
      </View>
    );
  };

  const renderConversationsList = () => {
    if (isConversationsLoading && conversations.length === 0) {
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
          <Text style={styles.noConversationsText}>
            You don't have any conversations yet
          </Text>
          <Text style={styles.startConversationText}>
            {userType === 'business'
              ? 'Customers will message you about your plants'
              : 'Start a conversation by contacting a seller from a plant listing'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={conversations}
        keyExtractor={(item) =>
          item.id ||
          `conv-${item.otherUserEmail || item.otherUserName}-${item.plantId || item.orderId || 'na'}`
        }
        contentContainerStyle={[
          styles.conversationsList,
          conversations.length === 0 && styles.emptyList,
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.conversationItem}
            onPress={() => handleSelectConversation(item)}
          >
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
                <Text style={styles.timeStamp}>
                  {formatTimestamp(item.lastMessageTimestamp)}
                </Text>
              </View>
              <View style={styles.messagePreviewContainer}>
                <Text style={styles.messagePreview} numberOfLines={1}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
                {!!item.unreadCount && item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.plantName} numberOfLines={1}>
                About: {item.plantName || 'Plant discussion'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    );
  };

  const renderChatScreen = () => {
    const isNewConversation = !selectedConversation?.id && sellerId && plantId;

    const renderMessageItem = ({ item }) => {
      const isOwn =
        item.senderId === currentUserEmail ||
        item.senderId === 'currentUser' ||
        item.isFromCurrentUser;

      return (
        <View
          style={[
            styles.messageContainer,
            isOwn ? styles.ownMessageContainer : styles.otherMessageContainer,
          ]}
        >
          {!isOwn &&
            renderAvatar(
              selectedConversation?.otherUserAvatar,
              selectedConversation?.otherUserName,
              selectedConversation?.isBusiness,
              32
            )}
          <View
            style={[
              styles.messageBubble,
              isOwn ? styles.ownMessageBubble : styles.otherMessageBubble,
              item.pending && styles.pendingMessageBubble,
            ]}
          >
            <Text
              style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}
            >
              {item.message || item.text}
            </Text>
            <Text
              style={[styles.messageTime, isOwn ? styles.ownMessageTime : styles.otherMessageTime]}
            >
              {item.pending ? 'Sending...' : formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveTab('conversations')}
            >
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
                {isOrderChat
                  ? `Order ${selectedConversation?.orderNumber || params.orderNumber || params.orderId || ''}`
                  : selectedConversation?.plantName || plantName || 'Plant Discussion'}
              </Text>
            </View>
          </View>

          {isMessagesLoading && messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="error-outline" size={48} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadMessages(selectedConversation?.id)}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={(item) => item.id || `msg-${item.timestamp}`}
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
                        {isOrderChat
                          ? 'Send a message about this order'
                          : `Send a message about ${plantName || 'this plant'}`}
                      </Text>
                      {!!autoMessage && (
                        <Text style={styles.autoMessageHint}>
                          💡 We’ve prepared a message for you below
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="forum" size={48} color="#aaa" />
                      <Text style={styles.emptyChatText}>No messages yet</Text>
                      <Text style={styles.emptyChatSubtext}>
                        Send a message to start the conversation
                      </Text>
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
            placeholder={`Message ${selectedConversation?.isBusiness ? 'business' : 'user'}...`}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || isSending) && styles.disabledSendButton,
            ]}
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

  // -------------------- Root render --------------------
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
    marginLeft: 8,
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
    borderBottomColor: '#e0e0e0',
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
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  disabledSendButton: { backgroundColor: '#bdbdbd' },

  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 300,
  },
  emptyChatText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  emptyChatSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    paddingHorizontal: 32,
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
