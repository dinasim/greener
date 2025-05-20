// components/PlantDetailScreen-parts/CareInfoSection.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';

const CareInfoSection = ({ careInfo }) => {
  if (!careInfo) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Care Information</Text>
      <View style={styles.careInfoContainer}>
        <View style={styles.careItem}>
          <FontAwesome name="tint" size={24} color="#4CAF50" />
          <Text style={styles.careLabel}>Water</Text>
          <Text style={styles.careValue}>{careInfo.water || 'Moderate'}</Text>
        </View>
        <View style={styles.careItem}>
          <Ionicons name="sunny" size={24} color="#4CAF50" />
          <Text style={styles.careLabel}>Light</Text>
          <Text style={styles.careValue}>{careInfo.light || 'Bright indirect'}</Text>
        </View>
        <View style={styles.careItem}>
          <MaterialIcons name="thermostat" size={24} color="#4CAF50" />
          <Text style={styles.careLabel}>Temperature</Text>
          <Text style={styles.careValue}>{careInfo.temperature || '65-80°F'}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 8
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginVertical: 12, 
    color: '#333' 
  },
  careInfoContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    flexWrap: 'wrap', 
    marginBottom: 16 
  },
  careItem: { 
    alignItems: 'center', 
    width: '30%', 
    backgroundColor: '#f9f9f9', 
    borderRadius: 8, 
    padding: 12 
  },
  careLabel: { 
    fontSize: 14, 
    marginTop: 8, 
    color: '#333', 
    fontWeight: '600' 
  },
  careValue: { 
    fontSize: 12, 
    color: '#777', 
    marginTop: 4, 
    textAlign: 'center' 
  },
});

export default CareInfoSection;