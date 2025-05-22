// components/ErrorBoundary.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    const { fallbackComponent, FallbackComponent, style } = this.props;
    
    if (this.state.hasError) {
      // If a custom fallback component is provided, use it
      if (FallbackComponent) {
        return <FallbackComponent 
          error={this.state.error} 
          resetError={this.resetError} 
        />;
      }

      if (fallbackComponent) {
        return fallbackComponent;
      }
      
      // Otherwise, use the default error UI
      return (
        <View style={[styles.container, style]}>
          <MaterialIcons name="error-outline" size={48} color="#e53935" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error ? this.state.error.toString() : 'Unknown error'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={this.resetError}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // If there is no error, render children normally
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;