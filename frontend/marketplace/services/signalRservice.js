// Frontend SignalR Implementation for Real-time Messaging
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';
class SignalRService {
  constructor() {
    this.connection = null;
    this.connectionPromise = null;
    this.reconnectInterval = null;
    this.connectionState = { isConnected: false, isConnecting: false, lastError: null };
    this.callbacks = { onMessageReceived: null, onTypingStarted: null, onTypingStopped: null, onConnectionStateChanged: null, onReadReceiptReceived: null };
  }
  async initialize() {
    try {
      if (this.connection) return this.connection;
      if (this.connectionPromise) return this.connectionPromise;
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
      this._startReconnection();
      throw error;
    }
  }
  async _createConnection() {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) throw new Error('User not authenticated');
      console.log('Negotiating SignalR connection...');
      const negotiateEndpoint = `${config.api.baseUrl}/marketplace/signalr-negotiate?userId=${encodeURIComponent(userEmail)}`;
      const connection = new HubConnectionBuilder()
        .withUrl(negotiateEndpoint)
        .configureLogging(config.isDevelopment ? LogLevel.Information : LogLevel.Error)
        .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
        .build();
      connection.onclose((error) => {
        console.log('SignalR connection closed', error);
        this.connectionState.isConnected = false;
        this.connectionState.lastError = error ? error.message : 'Connection closed';
        this._notifyConnectionStateChanged();
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
        this._stopReconnection();
      });
      this._registerMessageHandlers(connection);
      await connection.start();
      console.log('SignalR connected');
      await connection.invoke('JoinUserGroup', userEmail);
      return connection;
    } catch (error) {
      console.error('Error creating SignalR connection:', error);
      throw error;
    }
  }
  _registerMessageHandlers(connection) {
    connection.on('ReceiveMessage', (message) => {
      console.log('SignalR message received:', message);
      if (this.callbacks.onMessageReceived) {
        this.callbacks.onMessageReceived(message);
      }
    });
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
    connection.on('MessageRead', (conversationId, userId, messageIds, timestamp) => {
      if (this.callbacks.onReadReceiptReceived) {
        this.callbacks.onReadReceiptReceived(conversationId, userId, messageIds, timestamp);
      }
    });
  }
  _startReconnection() {
    this._stopReconnection();
    this.reconnectInterval = setInterval(async () => {
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
        console.log('Attempting to reconnect SignalR...');
        try {
          this.connectionState.isConnecting = true;
          this._notifyConnectionStateChanged();
          this.connection = await this._createConnection();
          this.connectionState.isConnected = true;
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = null;
          this._notifyConnectionStateChanged();
          this._stopReconnection();
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = error.message;
          this._notifyConnectionStateChanged();
        }
      }
    }, 30000);
  }
  _stopReconnection() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }
  _notifyConnectionStateChanged() {
    if (this.callbacks.onConnectionStateChanged) {
      this.callbacks.onConnectionStateChanged({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError
      });
    }
  }
  async disconnect() {
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
  onMessageReceived(callback) {
    this.callbacks.onMessageReceived = callback;
  }
  onTypingStarted(callback) {
    this.callbacks.onTypingStarted = callback;
  }
  onTypingStopped(callback) {
    this.callbacks.onTypingStopped = callback;
  }
  onConnectionStateChanged(callback) {
    this.callbacks.onConnectionStateChanged = callback;
    if (callback) {
      callback({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError
      });
    }
  }
  onReadReceiptReceived(callback) {
    this.callbacks.onReadReceiptReceived = callback;
  }
  async sendMessage(conversationId, message) {
    try {
      if (!this.connection || !this.connectionState.isConnected) {
        await this.initialize();
      }
      await this.connection.invoke('SendMessage', conversationId, message);
      return true;
    } catch (error) {
      console.error('Error sending message through SignalR:', error);
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
        this._startReconnection();
      }
      throw error;
    }
  }
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
      return false;
    }
  }
  async sendReadReceipt(conversationId, messageIds = []) {
    try {
      if (!this.connection || !this.connectionState.isConnected) {
        await this.initialize();
      }
      await this.connection.invoke('MarkMessagesAsRead', conversationId, messageIds);
      return true;
    } catch (error) {
      console.error('Error sending read receipt:', error);
      return false;
    }
  }
  getConnectionState() {
    return { ...this.connectionState };
  }
}
const signalRService = new SignalRService();
export default signalRService;