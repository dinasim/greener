// screens/ProfileScreen-parts/ProfileTabs.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ProfileTabs = ({ activeTab, onTabPress }) => {
  const tabs = [
    { id: 'myPlants', label: 'My Plants', icon: 'eco' },
    { id: 'favorites', label: 'Favorites', icon: 'favorite' },
    { id: 'sold', label: 'Sold', icon: 'local-offer' },
    { id: 'reviews', label: 'Reviews', icon: 'star' }
  ];

  return (
    <View style={styles.tabsContainer}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
          onPress={() => onTabPress(tab.id)}
        >
          <MaterialIcons
            name={tab.icon}
            size={24}
            color={activeTab === tab.id ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    elevation: 2,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2,
  },
  tabButton: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 12 
  },
  activeTabButton: { 
    borderBottomWidth: 2, 
    borderBottomColor: '#4CAF50' 
  },
  tabText: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 4 
  },
  activeTabText: { 
    color: '#4CAF50', 
    fontWeight: 'bold' 
  },
});

export default ProfileTabs;