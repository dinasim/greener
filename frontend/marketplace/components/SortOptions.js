import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Compact sort options component to match web design
 */
const SortOptions = ({ selectedOption = 'recent', onSelectOption }) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Sort options
  const options = [
    { id: 'recent', label: 'New To Old', icon: 'schedule' },
    { id: 'popular', label: 'Old to New', icon: 'history' },
    { id: 'priceAsc', label: 'Price: Low to High', icon: 'trending-up' },
    { id: 'priceDesc', label: 'Price: High to Low', icon: 'trending-down' },
    { id: 'rating', label: 'Highest Rated Seller', icon: 'star' },
  ];

  // Find the current selected option object
  const currentOption = options.find(option => option.id === selectedOption) || options[0];

  const handleSelectOption = (option) => {
    setModalVisible(false);
    if (onSelectOption) {
      onSelectOption(option.id);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => setModalVisible(true)}
      >
        <MaterialIcons name="sort" size={18} color="#4CAF50" />
        <Text style={styles.sortButtonText}>{currentOption.label}</Text>
        <MaterialIcons name="arrow-drop-down" size={18} color="#4CAF50" />
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionItem, selectedOption === item.id && styles.selectedOption]}
                  onPress={() => handleSelectOption(item)}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={18}
                    color={selectedOption === item.id ? '#4CAF50' : '#666'}
                  />
                  <Text
                    style={[styles.optionText, selectedOption === item.id && styles.selectedOptionText]}
                  >
                    {item.label}
                  </Text>
                  {selectedOption === item.id && <MaterialIcons name="check" size={16} color="#4CAF50" />}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%', // Full width to match the layout above product list
    marginBottom: 16, // Add some margin to the bottom to space it from products
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginLeft: 0, // Align to the left
  },
  sortButtonText: {
    fontSize: 14,
    color: '#333',
    marginHorizontal: 4,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '80%',
    maxWidth: 320,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    textAlign: 'center',
  },
  optionsList: {
    paddingBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f0f9f0',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  selectedOptionText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default SortOptions;
