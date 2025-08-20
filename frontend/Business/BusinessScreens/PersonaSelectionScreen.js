import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const appIcon = require('../../assets/favicon.png');

export default function PersonaSelectionScreen({ navigation }) {
  const choosePersona = async (type) => {
    await AsyncStorage.setItem('userType', type);
    navigation.replace(type === 'business' ? 'BusinessFlow' : 'Login');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to Greener</Text>
            <Text style={styles.subtitle}>Who are you joining as?</Text>
          </View>

          {/* Cards */}
          <View style={styles.cards}>
            <Pressable
              onPress={() => choosePersona('consumer')}
              style={({ pressed }) => [styles.card, styles.consumer, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="account-heart" size={48} color="#43A047" />
              <Text style={styles.cardTitle}>Consumer</Text>
              <Text style={styles.cardText}>
                Discover plants in our marketplace and master plant care with ease
              </Text>
            </Pressable>

            <Pressable
              onPress={() => choosePersona('business')}
              style={({ pressed }) => [styles.card, styles.business, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="store" size={48} color="#1E88E5" />
              <Text style={styles.cardTitle}>Business</Text>
              <Text style={styles.cardText}>
                Manage your online shop and connect with customers
              </Text>
            </Pressable>
          </View>

          {/* Bottom icon */}
          <View style={styles.bottomArea}>
            <Image source={appIcon} style={styles.bottomIcon} resizeMode="contain" />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF', // pure white background
  },
  safe: { flex: 1 },

  // Make the content fill the screen and push the icon to the bottom
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },

  header: {
    alignItems: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1f4153',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: '#4f6b77',
    textAlign: 'center',
  },

  cards: {
    width: '94%',
    maxWidth: 1200,
    alignSelf: 'center',
    marginTop: 30,
  },

  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 28,
  },
  pressed: { transform: [{ scale: 0.98 }], shadowOpacity: 0.03 },

  consumer: { borderColor: 'rgba(67,160,71,0.25)' },
  business: { borderColor: 'rgba(30,136,229,0.25)' },

  cardTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
  },
  cardText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#546e7a',
    textAlign: 'center',
    maxWidth: 700,
  },

  bottomArea: {
    alignItems: 'center',
    paddingBottom: 20, // safe spacing above device bottom
  },
  bottomIcon: {
    width: 120,
    height: 200,
    opacity: 0.9,
  },
});
