// Create separate screen for Forum with proper back navigation
import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PlantCareForumScreen from './PlantCareForumScreen';

// Import the business layout to get the business navigation bar
import BusinessLayout from '../Business/components/BusinessLayout';

export default function ForumScreen({ navigation, route }) {
  const fromBusiness = !!route?.params?.fromBusiness;

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#4CAF50" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Plant Care Forum</Text>
      <View style={styles.backButton} /> {/* Placeholder for centering */}
    </View>
  );

  if (fromBusiness) {
    // Show business nav bar
    return (
      <BusinessLayout navigation={navigation} currentTab="forum">
        <SafeAreaView style={styles.container}>
          <Header />
          {/* Prevent double nav bars */}
          <PlantCareForumScreen navigation={navigation} hideBottomBar />
        </SafeAreaView>
      </BusinessLayout>
    );
  }

  // Default: user version
  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <PlantCareForumScreen navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
});
