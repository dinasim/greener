// components/common/LoadingError.js
import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const LoadingError = ({ 
  isLoading, 
  loadingText = 'Loading...', 
  error, 
  onRetry,
  retryText = 'Retry'
}) => {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryText}>{retryText}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#4CAF50' 
  },
  errorText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#f44336', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  retryButton: { 
    marginTop: 10, 
    padding: 10, 
    backgroundColor: '#4CAF50', 
    borderRadius: 5 
  },
  retryText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
});

export default LoadingError;