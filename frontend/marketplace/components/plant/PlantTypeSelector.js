import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Component for selecting plant listing type
 * @param {string} listingType Current listing type ('plant', 'accessory', 'tool')
 * @param {Function} onTypeChange Called when type changes
 */
const PlantTypeSelector = ({ listingType, onTypeChange }) => {
  return (
    <View style={styles.listingTypeContainer}>
      <Text style={styles.listingTypeTitle}>What are you listing?</Text>
      <View style={styles.listingTypeButtons}>
        <TouchableOpacity 
          style={[styles.listingTypeButton, listingType === 'plant' && styles.selectedListingType]}
          onPress={() => onTypeChange('plant')}
        >
          <MaterialIcons 
            name="eco" 
            size={24} 
            color={listingType === 'plant' ? '#fff' : '#4CAF50'} 
          />
          <Text style={[styles.listingTypeText, listingType === 'plant' && styles.selectedListingTypeText]}>
            Plant
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.listingTypeButton, listingType === 'accessory' && styles.selectedListingType]}
          onPress={() => onTypeChange('accessory')}
        >
          <MaterialIcons 
            name="shopping-bag" 
            size={24} 
            color={listingType === 'accessory' ? '#fff' : '#4CAF50'} 
          />
          <Text style={[styles.listingTypeText, listingType === 'accessory' && styles.selectedListingTypeText]}>
            Accessory
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.listingTypeButton, listingType === 'tool' && styles.selectedListingType]}
          onPress={() => onTypeChange('tool')}
        >
          <MaterialCommunityIcons 
            name="tools" 
            size={24} 
            color={listingType === 'tool' ? '#fff' : '#4CAF50'} 
          />
          <Text style={[styles.listingTypeText, listingType === 'tool' && styles.selectedListingTypeText]}>
            Tool
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  listingTypeContainer: { 
    marginBottom: 24, 
    backgroundColor: '#ffffff', 
    padding: 16, 
    borderRadius: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 3 
  },
  listingTypeTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#2E7D32', 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  listingTypeButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-around' 
  },
  listingTypeButton: { 
    borderWidth: 1, 
    borderColor: '#4CAF50', 
    borderRadius: 10, 
    padding: 12,
    alignItems: 'center', 
    minWidth: 100, 
    backgroundColor: '#F1F8E9' 
  },
  selectedListingType: { 
    backgroundColor: '#4CAF50' 
  },
  listingTypeText: { 
    marginTop: 4, 
    color: '#4CAF50', 
    fontWeight: '600' 
  },
  selectedListingTypeText: { 
    color: '#fff' 
  },
});

export default PlantTypeSelector;
