// Create separate screen for Add Options with proper back navigation
import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AddOptionsScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Standardized Header with Back Arrow */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Item</Text>
        <View style={styles.backButton} /> {/* Placeholder for centering */}
      </View>
      
      {/* Add Options Content */}
      <View style={styles.content}>
        <Text style={styles.addTabTitle}>What would you like to add?</Text>
        
        <TouchableOpacity 
          style={styles.addOption}
          onPress={() => navigation.navigate('AddPlant')}
        >
          <View style={styles.addOptionIcon}>
            <Ionicons name="leaf" size={30} color="#4CAF50" />
          </View>
          <Text style={styles.addOptionText}>🌿 Add Plant</Text>
          <Text style={styles.addOptionDesc}>Add a new plant to your collection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.addOption}
          onPress={() => navigation.navigate('AddSite')}
        >
          <View style={styles.addOptionIcon}>
            <Ionicons name="location" size={30} color="#FF9800" />
          </View>
          <Text style={styles.addOptionText}>📍 Add Site</Text>
          <Text style={styles.addOptionDesc}>Create a new location for your plants</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  addTabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 40,
  },
  addOption: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  addOptionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  addOptionDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});