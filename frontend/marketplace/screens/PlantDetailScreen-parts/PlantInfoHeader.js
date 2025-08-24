// components/PlantDetailScreen-parts/PlantInfoHeader.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PlantInfoHeader = ({ 
  name, 
  category, 
  price, 
  status = 'Available', 
  listedDate,
  location = { city: 'Local pickup' }
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Recently listed';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
    } catch (e) {
      return 'Recently listed';
    }
  };
  
  // Handle different location data structures
  const getLocationText = () => {
    if (typeof location === 'string') {
      return location;
    } else if (location && typeof location === 'object') {
      return location.city || 'Local pickup';
    }
    return 'Local pickup';
  };

  return (
    <View style={styles.infoContainer}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.category}>{category}</Text>
      <Text style={styles.price}>₪{parseFloat(price).toFixed(2)}</Text>
      <View style={styles.statusContainer}>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        <Text style={styles.listedDate}>Listed {formatDate(listedDate)}</Text>
      </View>
      <View style={styles.locationContainer}>
        <View style={styles.locationHeader}>
          <MaterialIcons name="location-on" size={20} color="#4CAF50" />
          <Text style={styles.locationTitle}>Location</Text>
        </View>
        <Text style={styles.locationText}>{getLocationText()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  infoContainer: { 
    padding: 16 
  },
  name: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  category: { 
    fontSize: 16, 
    color: '#777' 
  },
  price: { 
    fontSize: 20, 
    color: '#4CAF50', 
    marginVertical: 10, 
    fontWeight: 'bold' 
  },
  statusContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  statusPill: { 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    backgroundColor: '#a5d6a7', 
    borderRadius: 10 
  },
  statusText: { 
    fontSize: 14, 
    color: '#fff', 
    fontWeight: '500' 
  },
  listedDate: { 
    fontSize: 14, 
    color: '#999' 
  },
  locationContainer: { 
    marginBottom: 16, 
    padding: 12, 
    backgroundColor: '#f9f9f9', 
    borderRadius: 8 
  },
  locationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  locationTitle: { 
    fontSize: 16, 
    marginLeft: 8, 
    fontWeight: '600', 
    color: '#333' 
  },
  locationText: { 
    fontSize: 14, 
    color: '#555', 
    marginLeft: 32 
  },
});

export default PlantInfoHeader;