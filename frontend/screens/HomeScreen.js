import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Modal, FlatList, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }) {
  const [greeting, setGreeting] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleAddPress = () => {
    setShowPopup(true);
  };

  const handleOptionPress = (type) => {
    setShowPopup(false);
    if (type === 'plant') {
      navigation.navigate('AddPlant');
    } else if (type === 'site') {
      navigation.navigate('AddSite'); // optional feature
    }
  };

  const handleLeafPress = () => {
    navigation.navigate('Locations');
  };

  const handleMarketplacePress = () => {
    navigation.navigate('Marketplace'); // Navigates to Categories.js
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
      </View>

      <View style={styles.tabRow}>
        <Text style={[styles.tab, styles.activeTab]}>Today</Text>
        <Text style={styles.tab}>Upcoming</Text>
      </View>

      <FlatList
        data={[]} // Placeholder
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            <Image source={{ uri: item.image }} style={styles.plantImage} />
            <View style={styles.taskInfo}>
              <Text style={styles.plantName}>{item.plantName}</Text>
              <Text style={styles.location}>{item.location}</Text>
              <Text style={styles.late}>{item.status}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.navBar}>
        <TouchableOpacity><Ionicons name="home" size={24} color="black" /></TouchableOpacity>
        <TouchableOpacity onPress={handleLeafPress}>
          <Ionicons name="leaf" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMarketplacePress}>
          <Image source={require('../assets/cart.png')} style={styles.cartIcon} />
        </TouchableOpacity>
        <TouchableOpacity><Ionicons name="medkit" size={24} color="black" /></TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
        <Text style={styles.plus}>+</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showPopup}
        onRequestClose={() => setShowPopup(false)}
      >
        <TouchableOpacity style={styles.popupOverlay} onPress={() => setShowPopup(false)}>
          <View style={styles.popupMenu}>
            <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('plant')}>
              <Text style={styles.popupText}>Add Plant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.popupOption} onPress={() => handleOptionPress('site')}>
              <Text style={styles.popupText}>Add Site</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { marginTop: 20 },
  greeting: { fontSize: 28, color: '#000', fontWeight: 'bold' },
  tabRow: { flexDirection: 'row', marginBottom: 10 },
  tab: { fontSize: 16, color: '#777', marginRight: 20 },
  activeTab: { color: '#2e7d32', fontWeight: 'bold', textDecorationLine: 'underline' },
  taskCard: { flexDirection: 'row', backgroundColor: '#f4f4f4', padding: 15, borderRadius: 12, marginBottom: 12 },
  plantImage: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  taskInfo: { justifyContent: 'center' },
  plantName: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  location: { color: '#555' },
  late: { color: 'red', marginTop: 4 },
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
  },
  cartIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 60,
    backgroundColor: '#2e7d32',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plus: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    paddingRight: 20,
    paddingBottom: 130,
    alignItems: 'flex-end',
  },
  popupMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    width: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  popupOption: {
    paddingVertical: 12,
  },
  popupText: {
    fontSize: 16,
    color: '#101010',
    textAlign: 'right'
  },
});
