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
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

// Import MarketplaceHeader
import MarketplaceHeader from '../components/MarketplaceHeader';

// Import services
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation
} from '../services/marketplaceApi';  // Correct relative path with capital M

// Sample data for development
const SAMPLE_CONVERSATIONS = [
  {
    id: 'conv1',
    otherUserName: 'PlantLover123',
    otherUserAvatar: 'https://via.placeholder.com/50?text=User1',
    lastMessage: "Hi, is the Monstera still available?",
    lastMessageTimestamp: new Date().toISOString(),
    plantName: "Monstera Deliciosa",
    plantId: "1",
    sellerId: "seller1",
    unreadCount: 2
  },
  {
    id: 'conv2',
    otherUserName: 'GreenThumb',
    otherUserAvatar: 'https://via.placeholder.com/50?text=User2',
    lastMessage: "Thanks for the quick response!",
    lastMessageTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    plantName: "Snake Plant",
    plantId: "2",
    sellerId: "seller2",
    unreadCount: 0
  }
];

const SAMPLE_MESSAGES = {
  'conv1': {
    messages: [
      {
        id: 'msg1',
        text: "Hi, is the Monstera still available?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
      },
      {
        id: 'msg2',
        text: "Yes, it's still available!",
        senderId: 'currentUser',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString() // 25 minutes ago
      },
      {
        id: 'msg3',
        text: "Great! What's the best time to come see it?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 minutes ago
      },
      {
        id: 'msg4',
        text: "I'm available this weekend, would that work for you?",
        senderId: 'otherUser',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
      }
    ],
    otherUser: {
      id: 'seller1',
      name: 'PlantLover123',
      avatar: 'https://via.placeholder.com/50?text=User1'
    }
  }
};

// MessagesScreen component
const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get parameters if passed for starting a new conversation
  const sellerId = route.params?.sellerId;
  const plantId = route.params?.plantId;
  const plantName = route.params?.plantName;
  
  // State for conversations and messaging
  const [activeTab, setActiveTab] = useState(sellerId ? 'chat' : 'conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  
  // Ref for scrolling to bottom of messages
  const flatListRef = useRef(null);
  
  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);
  
  // Load messages if conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);
  
  // Helper functions to load data
  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For real app, use API:
      // const data = await fetchConversations();
      
      // For development, use sample data:
      const data = SAMPLE_CONVERSATIONS;
      setConversations(data);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load conversations. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching conversations:', err);
    }
  };
  
  const loadMessages = async (conversationId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For real app, use API:
      let data;
      try {
        // data = await fetchMessages(conversationId);
        throw new Error('API not implemented yet'); // Remove this when API is ready
      } catch (apiError) {
        console.log('Using sample data for messages due to:', apiError.message);
        // For development, use sample data:
        data = SAMPLE_MESSAGES[conversationId] || { messages: [] };
      }
      
      // Sort messages by timestamp
      if (data.messages && Array.isArray(data.messages)) {
        data.messages.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeA - timeB;
        });
      }
      
      setMessages(data.messages || []);
      setIsLoading(false);
      
      // Scroll to bottom of messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
    } catch (err) {
      setError('Failed to load messages. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching messages:', err);
    }
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Create a unique ID for this message attempt
    const tempId = 'temp-' + Date.now();
    
    try {
      setIsSending(true);
      
      // Add message to state optimistically
      const tempMessage = {
        id: tempId,
        text: newMessage,
        senderId: 'currentUser',
        timestamp: new Date().toISOString(),
        pending: true // Mark as pending for UI indication
      };
      
      // Save the message text before clearing input
      const messageText = newMessage;
      
      // Update UI immediately
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      setNewMessage('');
      
      // Scroll to bottom of messages
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      // For real app, use API:
      try {
        if (selectedConversation) {
          // Existing conversation
          // await sendMessage(selectedConversation.id, messageText);
          throw new Error('API not implemented yet');
        } else if (sellerId && plantId) {
          // New conversation
          // const result = await startConversation(sellerId, plantId, messageText);
          // setSelectedConversation({
          //   id: result.conversationId,
          //   otherUserName: result.sellerName,
          //   plantName: plantName
          // });
          // await loadConversations(); // Refresh conversations list
          throw new Error('API not implemented yet');
        }
      } catch (apiError) {
        console.log('API error (Dev mode):', apiError.message);
        
        // For development, just simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // In dev mode, mark message as successful after delay
        if (__DEV__) {
          // Update the message to remove pending status
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === tempId 
                ? { ...msg, pending: false } 
                : msg
            )
          );
        } else {
          // In production, throw error to be caught by outer catch
          throw apiError;
        }
      }
      
      setIsSending(false);
    } catch (err) {
      console.error('Error sending message:', err);
      setIsSending(false);
      
      // Remove optimistic message on error
      setMessages(prevMessages => 
        prevMessages.filter(m => m.id !== tempId)
      );
      
      // Show error to user
      Alert.alert(
        'Error',
        'Failed to send message. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setActiveTab('chat');
  };
  
  // Format timestamps
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // If it's today, just show the time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If it's this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show the full date
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Render the conversations list
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
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadConversations}
          >
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
            Start a conversation by contacting a seller from a plant listing
          </Text>
        </View>
      );
    }
    
    return (
      <FlatList
        data={conversations}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.conversationItem}
            onPress={() => handleSelectConversation(item)}
          >
            <Image 
              source={{ uri: item.otherUserAvatar }} 
              style={styles.avatar}
            />
            
            <View style={styles.conversationInfo}>
              <View style={styles.conversationHeader}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.otherUserName}
                </Text>
                <Text style={styles.timeStamp}>
                  {formatTimestamp(item.lastMessageTimestamp)}
                </Text>
              </View>
              
              <View style={styles.messagePreviewContainer}>
                <Text style={styles.messagePreview} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.plantName} numberOfLines={1}>
                About: {item.plantName}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.conversationsList}
      />
    );
  };
  
  // Render the chat screen
  const renderChatScreen = () => {
    const isNewConversation = !selectedConversation && sellerId && plantId;
    
    const renderMessageItem = ({ item }) => {
      const isOwnMessage = item.senderId === 'currentUser';
      
      return (
        <View
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          ]}
        >
          {!isOwnMessage && (
            <Image 
              source={{ 
                uri: selectedConversation?.otherUserAvatar || 'https://via.placeholder.com/40'
              }}
              style={styles.messageAvatar}
            />
          )}
          
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
              ]}
            >
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
      );
    };
    
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={90}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setActiveTab('conversations')}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName} numberOfLines={1}>
              {selectedConversation?.otherUserName || 'New Message'}
            </Text>
            <Text style={styles.chatHeaderPlant} numberOfLines={1}>
              {selectedConversation?.plantName || plantName || ''}
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
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={() => (
              <View style={styles.emptyChatContainer}>
                {isNewConversation ? (
                  <>
                    <MaterialIcons name="forum" size={48} color="#aaa" />
                    <Text style={styles.emptyChatText}>New Conversation</Text>
                    <Text style={styles.emptyChatSubtext}>
                      Send a message about {plantName || 'this plant'}
                    </Text>
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
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
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
      </KeyboardAvoidingView>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Use MarketplaceHeader instead of custom header */}
      <MarketplaceHeader
        title="Messages"
        showBackButton={true}
        showNotifications={false}
      />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'conversations' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('conversations')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'conversations' && styles.activeTabText,
            ]}
          >
            Conversations
          </Text>
        </TouchableOpacity>
        
        {(selectedConversation || (sellerId && plantId)) && (
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'chat' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('chat')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'chat' && styles.activeTabText,
              ]}
            >
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  noConversationsText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  startConversationText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  conversationsList: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  timeStamp: {
    fontSize: 12,
    color: '#999',
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  plantName: {
    fontSize: 12,
    color: '#4CAF50',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chatHeaderPlant: {
    fontSize: 12,
    color: '#4CAF50',
  },
  messagesList: {
    flexGrow: 1,
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '100%',
  },
  ownMessageBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: '#999',
  },
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
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyChatSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledSendButton: {
    backgroundColor: '#ccc',
  },
});

export default MessagesScreen;