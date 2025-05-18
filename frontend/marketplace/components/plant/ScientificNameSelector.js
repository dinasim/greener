import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Component for selecting scientific plant names
 * @param {boolean} visible Whether the modal is visible
 * @param {Function} onClose Called when modal is closed
 * @param {Function} onSelect Called when a name is selected
 * @param {Array} scientificNames Array of available scientific names
 */
const ScientificNameSelector = ({ 
  visible, 
  onClose, 
  onSelect,
  scientificNames = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNames, setFilteredNames] = useState(scientificNames);
  
  // Filter names when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredNames(scientificNames);
    } else {
      const lowercaseQuery = searchQuery.toLowerCase();
      const filtered = scientificNames.filter(
        plant => 
          plant.name.toLowerCase().includes(lowercaseQuery) ||
          plant.common.toLowerCase().includes(lowercaseQuery)
      );
      setFilteredNames(filtered);
    }
  }, [searchQuery, scientificNames]);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Plant Type</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by common or scientific name"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={Platform.OS !== 'web'}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <MaterialIcons name="clear" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <FlatList
            data={filteredNames}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.nameItem} 
                onPress={() => onSelect(item)}
              >
                <View>
                  <Text style={styles.commonName}>{item.common}</Text>
                  <Text style={styles.scientificName}>{item.name}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#999" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>
                  No plants found matching your search
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  nameItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  commonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scientificName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
  },
  emptyList: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default ScientificNameSelector;