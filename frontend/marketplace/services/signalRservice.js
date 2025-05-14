// Frontend SignalR Implementation for Real-time Messaging
// File: services/SignalRService.js

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

/**
 * SignalR Service for real-time messaging in the Greener Marketplace
 * 
 * This service handles connecting to Azure SignalR, sending/receiving messages,
 * typing indicators, and read receipts.
 */
class SignalRService {
  constructor() {
    this.connection = null;
    this.connectionPromise = null;
    this.reconnectInterval = null;
    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      lastError: null
    };
    
    this.callbacks = {
      onMessageReceived: null,
      onTypingStarted: null,
      onTypingStopped: null,
      onConnectionStateChanged: null,
      onReadReceiptReceived: null
    };
  }

  /**
   * Initialize the SignalR connection
   * @returns {Promise<Object>} The SignalR connection
   */
  async initialize() {
    try {
      if (this.connection) {
        return this.connection;
      }

      if (this.connectionPromise) {
        return this.connectionPromise;
      }
      
      this.connectionState.isConnecting = true;
      this._notifyConnectionStateChanged();

      this.connectionPromise = this._createConnection();
      this.connection = await this.connectionPromise;
      this.connectionPromise = null;
      
      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = null;
      this._notifyConnectionStateChanged();
      
      return this.connection;
    } catch (error) {
      console.error('Error initializing SignalR connection:', error);
      this.connectionPromise = null;
      this.connectionState.isConnected = false;
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = error.message;
      this._notifyConnectionStateChanged();
      
      // Start reconnection attempts
      this._startReconnection();
      
      throw error;
    }
  }

  /**
   * Create a new SignalR connection
   * @private
   * @returns {Promise<Object>} The SignalR connection
   */
  async _createConnection() {
    try {
      // Get the user's email from AsyncStorage
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        throw new Error('User not authenticated');
      }

      // First, negotiate connection via Azure Functions
      console.log('Negotiating SignalR connection...');
      const negotiateEndpoint = `${config.api.baseUrl}/marketplace/signalr-negotiate?userId=${encodeURIComponent(userEmail)}`;
      
      // Create the connection
      const connection = new HubConnectionBuilder()
        .withUrl(negotiateEndpoint)
        .configureLogging(config.isDevelopment ? LogLevel.Information : LogLevel.Error)
        .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
        .build();

      // Set up connection event handlers
      connection.onclose((error) => {
        console.log('SignalR connection closed', error);
        this.connectionState.isConnected = false;
        this.connectionState.lastError = error ? error.message : 'Connection closed';
        this._notifyConnectionStateChanged();
        
        // Start reconnection attempts
        this._startReconnection();
      });

      connection.onreconnecting((error) => {
        console.log('SignalR reconnecting', error);
        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = true;
        this.connectionState.lastError = error ? error.message : 'Reconnecting';
        this._notifyConnectionStateChanged();
      });

      connection.onreconnected((connectionId) => {
        console.log('SignalR reconnected with ID', connectionId);
        this.connectionState.isConnected = true;
        this.connectionState.isConnecting = false;
        this.connectionState.lastError = null;
        this._notifyConnectionStateChanged();
        
        // Clear reconnection interval if it's running
        this._stopReconnection();
      });

      // Set up message handlers
      this._registerMessageHandlers(connection);

      // Start the connection
      await connection.start();
      console.log('SignalR connected');
      
      // Join user-specific group
      await connection.invoke('JoinUserGroup', userEmail);

      return connection;
    } catch (error) {
      console.error('Error creating SignalR connection:', error);
      throw error;
    }
  }

  /**
   * Register message handlers for the connection
   * @private
   * @param {Object} connection SignalR connection
   */
  _registerMessageHandlers(connection) {
    // Message received handler
    connection.on('ReceiveMessage', (message) => {
      console.log('SignalR message received:', message);
      if (this.callbacks.onMessageReceived) {
        this.callbacks.onMessageReceived(message);
      }
    });

    // Typing indicator handlers
    connection.on('UserTyping', (conversationId, userId) => {
      if (this.callbacks.onTypingStarted) {
        this.callbacks.onTypingStarted(conversationId, userId);
      }
    });

    connection.on('UserStoppedTyping', (conversationId, userId) => {
      if (this.callbacks.onTypingStopped) {
        this.callbacks.onTypingStopped(conversationId, userId);
      }
    });

    // Read receipt handler
    connection.on('MessageRead', (conversationId, userId, messageIds, timestamp) => {
      if (this.callbacks.onReadReceiptReceived) {
        this.callbacks.onReadReceiptReceived(conversationId, userId, messageIds, timestamp);
      }
    });
  }

  /**
   * Start reconnection attempts
   * @private
   */
  _startReconnection() {
    // Clear any existing interval
    this._stopReconnection();
    
    // Start a new interval
    this.reconnectInterval = setInterval(async () => {
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
        console.log('Attempting to reconnect SignalR...');
        try {
          this.connectionState.isConnecting = true;
          this._notifyConnectionStateChanged();
          
          // Create a new connection
          this.connection = await this._createConnection();
          
          this.connectionState.isConnected = true;
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = null;
          this._notifyConnectionStateChanged();
          
          // Clear interval after successful reconnection
          this._stopReconnection();
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = error.message;
          this._notifyConnectionStateChanged();
        }
      }
    }, 30000); // Try every 30 seconds
  }

  /**
   * Stop reconnection attempts
   * @private
   */
  _stopReconnection() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Notify subscribers of connection state changes
   * @private
   */
  _notifyConnectionStateChanged() {
    if (this.callbacks.onConnectionStateChanged) {
      this.callbacks.onConnectionStateChanged({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError
      });
    }
  }

  /**
   * Disconnect from SignalR
   * @returns {Promise<void>}
   */
  async disconnect() {
    // Stop reconnection attempts
    this._stopReconnection();
    
    if (this.connection) {
      try {
        await this.connection.stop();
        this.connection = null;
        console.log('SignalR disconnected');
        
        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = false;
        this._notifyConnectionStateChanged();
      } catch (error) {
        console.error('Error disconnecting SignalR:', error);
      }
    }
  }

  /**
   * Register callback for message received events
   * @param {Function} callback The callback function
   */
  onMessageReceived(callback) {
    this.callbacks.onMessageReceived = callback;
  }

  /**
   * Register callback for typing started events
   * @param {Function} callback The callback function
   */
  onTypingStarted(callback) {
    this.callbacks.onTypingStarted = callback;
  }

  /**
   * Register callback for typing stopped events
   * @param {Function} callback The callback function
   */
  onTypingStopped(callback) {
    this.callbacks.onTypingStopped = callback;
  }

  /**
   * Register callback for connection state changes
   * @param {Function} callback The callback function
   */
  onConnectionStateChanged(callback) {
    this.callbacks.onConnectionStateChanged = callback;
    
    // Call immediately with current state
    if (callback) {
      callback({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError
      });
    }
  }

  /**
   * Register callback for read receipt events
   * @param {Function} callback The callback function
   */
  onReadReceiptReceived(callback) {
    this.callbacks.onReadReceiptReceived = callback;
  }

  /**
   * Send a message via SignalR
   * @param {string} conversationId The conversation ID
   * @param {string} message The message text
   * @returns {Promise<void>}
   */
  async sendMessage(conversationId, message) {
    try {
      if (!this.connection || !this.connectionState.isConnected) {
        await this.initialize();
      }
      
      await this.connection.invoke('SendMessage', conversationId, message);
      return true;
    } catch (error) {
      console.error('Error sending message through SignalR:', error);
      
      // If the connection was lost, try to reconnect
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
        this._startReconnection();
      }
      
      throw error;
    }
  }

  /**
   * Send typing indicator
   * @param {string} conversationId The conversation ID
   * @param {boolean} isTyping Whether the user is typing
   * @returns {Promise<void>}
   */
  async sendTypingIndicator(conversationId, isTyping) {
    try {
      if (!this.connection || !this.connectionState.isConnected) {
        await this.initialize();
      }
      
      const method = isTyping ? 'StartTyping' : 'StopTyping';
      await this.connection.invoke(method, conversationId);
      return true;
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      // Don't throw - typing indicators are non-critical
      return false;
    }
  }

  /**
   * Send read receipt for messages
   * @param {string} conversationId The conversation ID
   * @param {Array<string>} messageIds Array of message IDs that were read
   * @returns {Promise<boolean>} Success status
   */
  async sendReadReceipt(conversationId, messageIds = []) {
    try {
      if (!this.connection || !this.connectionState.isConnected) {
        await this.initialize();
      }
      
      await this.connection.invoke('MarkMessagesAsRead', conversationId, messageIds);
      return true;
    } catch (error) {
      console.error('Error sending read receipt:', error);
      // Don't throw - read receipts are non-critical
      return false;
    }
  }
  
  /**
   * Get the current connection state
   * @returns {Object} Connection state
   */
  getConnectionState() {
    return { ...this.connectionState };
  }
}

// Create a singleton instance
const signalRService = new SignalRService();
export default signalRService;