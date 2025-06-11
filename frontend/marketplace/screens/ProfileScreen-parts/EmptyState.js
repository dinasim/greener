// screens/ProfileScreen-parts/EmptyState.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const EmptyState = ({ 
  icon, 
  message, 
  buttonText, 
  onButtonPress 
}) => {
  return (
    <View style={styles.emptyStateContainer}>
      <MaterialIcons name={icon} size={48} color="#ccc" />
      <Text style={styles.emptyStateText}>{message}</Text>
      {buttonText && onButtonPress && (
        <TouchableOpacity style={styles.actionButton} onPress={onButtonPress}>
          <Text style={styles.actionButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyStateContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 40,
    minHeight: 200,
  },
  emptyStateText: { 
    fontSize: 16, 
    color: '#888', 
    textAlign: 'center', 
    marginTop: 12 
  },
  actionButton: {
    marginTop: 16, 
    backgroundColor: '#4CAF50', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 6,
  },
  actionButtonText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
});

export default EmptyState;