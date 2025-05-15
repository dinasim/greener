// screens/HomeScreen.js

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }) {
  const [greeting, setGreeting] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  // Dummy data for FlatList
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
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.plantName}</Text>
        <Text style={styles.cardSubtitle}>{item.location}</Text>
        <Text
          style={[
            styles.cardSubtitle,
            item.status === 'Late' && styles.lateStatus,
          ]}
        >
          {item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header: just the greeting */}
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>{greeting}</Text>
      </View>

      {/* Modal for Add Plant */}
      <Modal
        visible={showPopup}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add a Plant</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowPopup(false);
                navigation.navigate('AddPlant', { via: 'name' });
              }}
            >
              <Text style={styles.modalButtonText}>By Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowPopup(false);
                navigation.navigate('AddPlant', { via: 'photo' });
              }}
            >
              <Text style={styles.modalButtonText}>By Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel]}
              onPress={() => setShowPopup(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
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
  container: { flex: 1, backgroundColor: '#f0fdf4' },

  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  listContainer: {
    paddingBottom: 100, // so list isn't hidden under floating buttons
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardImage: {
    width: 80,
    height: 80,
  },
  cardContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#555',
  },
  lateStatus: {
    color: 'red',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalButton: {
    paddingVertical: 12,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#4CAF50',
  },
  modalCancel: {
    marginTop: 8,
  },

  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingButton: {
    marginBottom: 12,
  },
});
