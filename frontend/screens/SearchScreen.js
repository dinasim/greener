import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MainLayout from '../components/MainLayout'; // update import path as needed
import SearchPlantScreen from './SearchPlantScreen';

export default function SearchScreen({ navigation }) {
  const handleTabPress = (tab) => {
    if (tab === 'home') navigation.navigate('Home');
    else if (tab === 'plants') navigation.navigate('Locations');
    else if (tab === 'marketplace') navigation.navigate('MainTabs');
    else if (tab === 'forum') navigation.navigate('PlantCareForumScreen');
    else if (tab === 'disease') navigation.navigate('DiseaseChecker');
  };

  return (
    <MainLayout currentTab="plants" onTabPress={handleTabPress}>
      {/* Header with Back Arrow */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          accessible={true}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Plants</Text>
        <View style={styles.backButton} /> {/* Placeholder for centering */}
      </View>
      {/* The actual search component */}
      <SearchPlantScreen navigation={navigation} />
    </MainLayout>
  );
}

const styles = StyleSheet.create({
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
});
