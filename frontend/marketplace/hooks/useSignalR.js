// hooks/useSignalR.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import marketplaceApi from '../services/marketplaceApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Custom hook for SignalR integration
 * Manages connection, reconnection and message handling
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Whether to connect automatically
 * @param {Function} options.onMessageReceived - Callback for received messages
 * @param {Function} options.onUserTyping - Callback for typing indicator
 * @param {Function} options.onUserStoppedTyping - Callback for stopped typing
 * @param {Function} options.onMessageRead - Callback for read receipts
 * @param {Function} options.onConnectionChange - Callback for connection state changes
 * @returns {Object} SignalR methods and state
 */
const useSignalR = (options = {}) => {
  const {
    autoConnect = true,
    onMessageReceived,
    onUserTyping,
    onUserStoppedTyping,
    onMessageRead,
    onConnectionChange,
  } = options;

  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastRetryAttempt: null,
  });

  const connection = useRef(null);
  const reconnectTimer = useRef(null);
  const retryCount = useRef(0);
  const maxRetryCount = 5;
  const baseRetryDelay = 2000; // 2 seconds

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    try {
      // Don't initialize if already connected or connecting
      if (connectionState.isConnected || connectionState.isConnecting) {
        return;
      }

      setConnectionState(prev => ({
        ...prev,
        isConnecting: true,
        error: null,
      }));

      // Get the negotiate token from the backend
      const token = await marketplaceApi.getNegotiateToken();
      
      if (!token || !token.url) {
        throw new Error('Failed to get SignalR negotiate token');
      }

      // Build connection
      const newConnection = new HubConnectionBuilder()
        .withUrl(token.url, {
          accessTokenFactory: () => token.accessToken,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
        .configureLogging(LogLevel.Information)
        .build();

      // Set up connection handlers
      setupConnectionHandlers(newConnection);

      // Start the connection
      await newConnection.start();
      connection.current = newConnection;
      
      // Reset retry count on successful connection
      retryCount.current = 0;

      setConnectionState({
        isConnected: true,
        isConnecting: false,
        error: null,
        lastRetryAttempt: null,
      });

      // Get user email for group subscription
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail) {
        // Join user specific group for targeted messages
        await newConnection.invoke('JoinUserGroup', userEmail);
      }

      return true;
    } catch (error) {
      console.error('Error connecting to SignalR:', error);
      
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: error.message,
        lastRetryAttempt: new Date(),
      });

      // Schedule reconnect attempt if not out of retries
      scheduleReconnect();
      
      return false;
    }
  }, [connectionState.isConnected, connectionState.isConnecting]);

  // Setup connection event handlers
  const setupConnectionHandlers = (conn) => {
    if (!conn) return;

    // Handle close
    conn.onclose((error) => {
      console.log('SignalR connection closed', error);
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        error: error ? error.message : 'Connection closed',
      }));

      scheduleReconnect();
      
      if (onConnectionChange) {
        onConnectionChange({
          isConnected: false,
          error: error ? error.message : 'Connection closed',
        });
      }
    });

    // Handle reconnecting
    conn.onreconnecting((error) => {
      console.log('SignalR reconnecting', error);
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: true,
        error: error ? error.message : 'Reconnecting...',
      }));
      
      if (onConnectionChange) {
        onConnectionChange({
          isConnected: false,
          isConnecting: true,
          error: error ? error.message : 'Reconnecting...',
        });
      }
    });

    // Handle reconnected
    conn.onreconnected((connectionId) => {
      console.log('SignalR reconnected', connectionId);
      
      setConnectionState({
        isConnected: true,
        isConnecting: false,
        error: null,
        lastRetryAttempt: null,
      });
      
      // Reset retry count
      retryCount.current = 0;
      
      if (onConnectionChange) {
        onConnectionChange({
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      }
    });

    // Register message handlers
    if (onMessageReceived) {
      conn.on('ReceiveMessage', (message) => {
        onMessageReceived(message);
      });
    }

    if (onUserTyping) {
      conn.on('UserTyping', (conversationId, userId) => {
        onUserTyping(conversationId, userId);
      });
    }

    if (onUserStoppedTyping) {
      conn.on('UserStoppedTyping', (conversationId, userId) => {
        onUserStoppedTyping(conversationId, userId);
      });
    }

    if (onMessageRead) {
      conn.on('MessageRead', (conversationId, userId, messageIds, timestamp) => {
        onMessageRead(conversationId, userId, messageIds, timestamp);
      });
    }
  };

  // Schedule reconnect attempt
  const scheduleReconnect = () => {
    // Clear any existing timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }

    // If we've reached the max retry count, stop retrying
    if (retryCount.current >= maxRetryCount) {
      console.log(`Reached max retry attempts (${maxRetryCount}), stopping reconnect attempts`);
      return;
    }

    // Exponential backoff for retry delay
    const delay = baseRetryDelay * Math.pow(2, retryCount.current);
    console.log(`Scheduling reconnect attempt in ${delay}ms (attempt ${retryCount.current + 1}/${maxRetryCount})`);
    
    reconnectTimer.current = setTimeout(() => {
      retryCount.current++;
      initializeConnection();
    }, delay);
  };

  // Connect method for manual connection
  const connect = useCallback(() => {
    if (!connectionState.isConnected && !connectionState.isConnecting) {
      initializeConnection();
    }
    return connectionState;
  }, [connectionState, initializeConnection]);

  // Disconnect method
  const disconnect = useCallback(async () => {
    // Clear reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    // Stop the connection if it exists
    if (connection.current) {
      try {
        await connection.current.stop();
        connection.current = null;
        
        setConnectionState({
          isConnected: false,
          isConnecting: false,
          error: null,
          lastRetryAttempt: null,
        });
        
        return true;
      } catch (error) {
        console.error('Error disconnecting SignalR:', error);
        
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          error: error.message,
        }));
        
        return false;
      }
    }
    
    return true;
  }, []);

  // Send message method
  const sendMessage = useCallback(async (method, ...args) => {
    if (!connection.current || !connectionState.isConnected) {
      console.error('Cannot send message: Not connected');
      return false;
    }

    try {
      await connection.current.invoke(method, ...args);
      return true;
    } catch (error) {
      console.error(`Error sending message (${method}):`, error);
      return false;
    }
  }, [connectionState.isConnected]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((conversationId, isTyping) => {
    const method = isTyping ? 'StartTyping' : 'StopTyping';
    return sendMessage(method, conversationId);
  }, [sendMessage]);

  // Mark messages as read
  const markMessagesAsRead = useCallback((conversationId, messageIds = []) => {
    return sendMessage('MarkMessagesAsRead', conversationId, messageIds);
  }, [sendMessage]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      initializeConnection();
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (connection.current) {
        connection.current.stop();
      }
    };
  }, [autoConnect, initializeConnection]);

  return {
    connectionState,
    connect,
    disconnect,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
  };
};

export default useSignalR;