import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Profile({ navigation }) {
  const menuItems = [
    { id: '1', title: 'My Orders', icon: 'cart-outline' },
    { id: '2', title: 'My Listings', icon: 'list-outline' },
    { id: '3', title: 'Saved Items', icon: 'heart-outline' },
    { id: '4', title: 'Settings', icon: 'settings-outline' },
    { id: '5', title: 'Help Center', icon: 'help-circle-outline' },
    { id: '6', title: 'Logout', icon: 'log-out-outline' }
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity key={item.id} style={styles.menuItem}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={item.icon} size={24} color="#555" />
        <Text style={styles.menuItemText}>{item.title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#aaa" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.profileHeader}>
          <Image 
            source={require('../../assets/placeholder.png')} 
            style={styles.profileImage} 
          />
          <Text style={styles.profileName}>Plant Lover</Text>
          <Text style={styles.profileEmail}>plant.lover@example.com</Text>
          
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map(renderMenuItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 16,
    color: '#777',
    marginBottom: 15,
  },
  editButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#777',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  menuContainer: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 15,
  },
});
