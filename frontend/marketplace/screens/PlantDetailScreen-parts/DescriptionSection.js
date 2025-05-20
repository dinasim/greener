// components/PlantDetailScreen-parts/DescriptionSection.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DescriptionSection = ({ description }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Description</Text>
      <Text style={styles.description}>{description}</Text>
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
  description: { 
    fontSize: 14, 
    color: '#333', 
    lineHeight: 20, 
    marginBottom: 16 
  },
});

export default DescriptionSection;