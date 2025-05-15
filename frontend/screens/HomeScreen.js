// screens/HomeScreen.js

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Modal, FlatList, Image, Animated, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [greeting, setGreeting] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const data = [
    {
      id: '1',
      plantName: 'Ficus Elastica',
      location: 'Living Room',
      status: 'On Time',
      image: 'https://via.placeholder.com/60',
    },
    {
      id: '2',
      plantName: 'Monstera Deliciosa',
      location: 'Kitchen',
      status: 'Late',
      image: 'https://via.placeholder.com/60',
    },
    // … more items …
  ];

  useEffect(() => {
    setGreeting(getGreeting());
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const handleAddPress = () => setShowPopup(true);
  const handleOptionPress = (type) => {
    setShowPopup(false);
    if (type === 'plant') navigation.navigate('AddPlant');
    else if (type === 'site') navigation.navigate('AddSite');
  };
  const handleLeafPress = () => navigation.navigate('Locations');
  const handleMarketplacePress = () => navigation.navigate('MainTabs');
  const keyExtractor = (item) => item.id?.toString() || 'defaultKey';

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.greeting}>{greeting}</Text>
      </Animated.View>

      <View style={styles.tabRow}>
        <LinearGradient colors={['#a8e063', '#56ab2f']} style={styles.activeTab}>
          <Text style={styles.tabText}>Today</Text>
        </LinearGradient>
        <TouchableOpacity>
          <Text style={styles.tab}>Upcoming</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            <Image source={{ uri: item.image }} style={styles.plantImage} />
            <View style={styles.taskInfo}>
              <Text style={styles.plantName}>{item.plantName}</Text>
              <Text style={styles.location}>{item.location}</Text>
              <Text style={[styles.late, item.status !== 'On Time' && { color: 'red' }]}>
                {item.status}
              </Text>
            </View>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.navBar}>
        <TouchableOpacity><Ionicons name="home" size={24} color="black" /></TouchableOpacity>
        <TouchableOpacity onPress={handleLeafPress}><Ionicons name="leaf" size={24} color="black" /></TouchableOpacity>
        <TouchableOpacity onPress={handleMarketplacePress}><Ionicons name="cart-outline" size={24} color="black" /></TouchableOpacity>
        <TouchableOpacity><Ionicons name="medkit" size={24} color="black" /></TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
        <Ionicons name="add" size={36} color="#fff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent
        visible={showPopup}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPopup(false)}
      >
        <TouchableOpacity style={styles.popupOverlay} onPress={() => setShowPopup(false)}>
          <View style={styles.popupMenu}>
            <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('plant')}>
              <Text style={styles.popupText}>🌿 Add Plant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('site')}>
              <Text style={styles.popupText}>📍 Add Site</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Plant list */}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />

      {/* Floating cluster: diagnostic above add */}
      <View style={styles.floatingContainer}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => navigation.navigate('DiseaseChecker')}
        >
          <Ionicons name="search" size={32} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setShowPopup(true)}
        >
          <Ionicons name="add-circle-outline" size={48} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfdfd', padding: 20 },
  header: { marginTop: 10, marginBottom: 15 },
  greeting: { fontSize: 30, color: '#2e7d32', fontWeight: 'bold' },
  tabRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tab: { fontSize: 16, color: '#777', marginLeft: 20 },
  activeTab: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 20,
    elevation: 2,
  },
  tabText: { color: '#fff', fontWeight: 'bold' },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plantImage: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  taskInfo: { justifyContent: 'center' },
  plantName: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  location: { color: '#555' },
  late: { marginTop: 4 },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
  },
  addButton: {
    position: 'absolute',
    right: 25,
    bottom: 70,
    backgroundColor: '#2e7d32',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: width * 0.6,
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  popupOption: {
    paddingVertical: 14,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
});
