/**
 * messagesData.js
 * Service for handling messaging functionality with Azure Functions
 */

import { addAuthHeader } from '../../utils/authUtils';

// Base URL for Azure Functions
const baseUrl = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Create a new chat room with a seller
 * @param {string} receiver - Seller ID (receiver of the message)
 * @param {string} message - Initial message text
 * @returns {Promise<Object>} - New chat room data
 */
export async function createChatRoom(receiver, message) {
  try {
    const options = await addAuthHeader({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, receiver }),
    });
    
    const res = await fetch(`${baseUrl}/messages/createChatRoom`, options);
    return await res.json();
  } catch (error) {
    console.error('Error creating chat room:', error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockChatRoom(receiver, message);
    }
    
    throw error;
  }
}

/**
 * Get all conversations for the current user
 * @returns {Promise<Array>} - List of conversations
 */
export async function getUserConversations() {
  try {
    const options = await addAuthHeader({
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const res = await fetch(`${baseUrl}/messages/getUserConversations`, options);
    return await res.json();
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockConversations();
    }
    
    throw error;
  }
}

/**
 * Send a message in an existing chat
 * @param {string} chatId - Chat room ID
 * @param {string} message - Message text
 * @returns {Promise<Object>} - Send result
 */
export async function sendMessage(chatId, message) {
  try {
    const options = await addAuthHeader({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    
    const res = await fetch(`${baseUrl}/messages/sendMessage`, options);
    return await res.json();
  } catch (error) {
    console.error('Error sending message:', error);
    
    // During development, return mock data
    if (__DEV__) {
      return getMockSendMessage(chatId, message);
    }
    
    throw error;
  }
}

// MOCK DATA IMPLEMENTATION FOR DEVELOPMENT/TESTING
// -------------------------------

// Sample mock data for users
const MOCK_USERS = [
  {
    _id: 'sender1',
    id: 'sender1',
    name: 'You',
    avatar: 'https://via.placeholder.com/50?text=You',
  },
  {
    _id: 'seller1',
    id: 'seller1',
    name: 'PlantLover123',
    avatar: 'https://via.placeholder.com/50?text=Seller1',
  },
  {
    _id: 'seller2',
    id: 'seller2',
    name: 'GreenThumb',
    avatar: 'https://via.placeholder.com/50?text=Seller2',
  },
];

// Sample mock data for chat rooms
let MOCK_CHAT_ROOMS = [
  {
    _id: 'chat1',
    id: 'chat1',
    buyer: MOCK_USERS[0], // You
    seller: MOCK_USERS[1], // PlantLover123
    conversation: [
      {
        _id: 'msg1',
        senderId: 'seller1',
        message: 'Hi, is the Monstera still available?',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      },
      {
        _id: 'msg2',
        senderId: 'sender1',
        message: 'Yes, it\'s still available!',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
      },
      {
        _id: 'msg3',
        senderId: 'seller1',
        message: 'Great! What\'s the best time to come see it?',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
      },
    ],
  },
  {
    _id: 'chat2',
    id: 'chat2',
    buyer: MOCK_USERS[0], // You
    seller: MOCK_USERS[2], // GreenThumb
    conversation: [
      {
        _id: 'msg4',
        senderId: 'sender1',
        message: 'Hello, I\'m interested in your Snake Plant.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      },
      {
        _id: 'msg5',
        senderId: 'seller2',
        message: 'Hi there! It\'s available. Would you like to see it?',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      },
      {
        _id: 'msg6',
        senderId: 'sender1',
        message: 'Yes, I would. When are you available?',
        timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23 hours ago
      },
    ],
  },
];

// Mock function to get all conversations
function getMockConversations() {
  return MOCK_CHAT_ROOMS.map(chat => ({
    chats: chat,
    isBuyer: chat.buyer._id === 'sender1',
    myId: 'sender1',
  }));
}

// Mock function to create a new chat room
function getMockChatRoom(receiver, messageText) {
  const newChatId = `chat${MOCK_CHAT_ROOMS.length + 1}`;
  const seller = MOCK_USERS.find(user => user._id === receiver) || MOCK_USERS[1];
  
  const newChat = {
    _id: newChatId,
    id: newChatId,
    buyer: MOCK_USERS[0], // You
    seller: seller,
    conversation: [
      {
        _id: `msg${Date.now()}`,
        senderId: 'sender1',
        message: messageText,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  
  MOCK_CHAT_ROOMS.push(newChat);
  
  return { messageId: newChatId };
}

// Mock function to send a message
function getMockSendMessage(chatId, messageText) {
  const chatIndex = MOCK_CHAT_ROOMS.findIndex(chat => chat._id === chatId || chat.id === chatId);
  
  if (chatIndex !== -1) {
    const newMessage = {
      _id: `msg${Date.now()}`,
      senderId: 'sender1',
      message: messageText,
      timestamp: new Date().toISOString(),
    };
    
    MOCK_CHAT_ROOMS[chatIndex].conversation.push(newMessage);
    
    return { sender: 'sender1' };
  }
  
  throw new Error('Chat not found');
}