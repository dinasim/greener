import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PersonaSelectionScreen({ navigation }) {
  const choosePersona = async (type) => {
    await AsyncStorage.setItem('userType', type);
    if (type === 'business') {
      navigation.replace('BusinessWelcomeScreen');
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Greener</Text>
      <Text style={styles.subtitle}>Who are you joining as?</Text>

      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={[styles.card, styles.consumerCard]}
          onPress={() => choosePersona('consumer')}
        >
          <MaterialCommunityIcons name="account-heart" size={50} color="#4CAF50" />
          <Text style={styles.cardTitle}>Consumer</Text>
          <Text style={styles.cardText}>Discover plants in our marketplace and master plant care with ease</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.businessCard]}
          onPress={() => choosePersona('business')}
        >
          <MaterialCommunityIcons name="store" size={50} color="#2196F3" />
          <Text style={styles.cardTitle}>Business</Text>
          <Text style={styles.cardText}>Manage your online shop and connect with customers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5fcff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#216a94',
    marginBottom: 10
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 30
  },
  cardContainer: {
    flexDirection: 'column',
    gap: 20,
    width: '100%',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  consumerCard: {
    borderColor: '#4CAF50',
    borderWidth: 1
  },
  businessCard: {
    borderColor: '#2196F3',
    borderWidth: 1
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
    color: '#333'
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 6
  }
});
