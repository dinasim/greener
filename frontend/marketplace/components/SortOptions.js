import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SortOptions = ({
  selectedOption = 'recent',
  onSelectOption,
  compact = true,
  hideLeadingIcon = true,
  labelMode = 'auto',          // 'auto' | 'full' | 'short'
  buttonMaxWidth = 110         // tighten this to save space
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const options = [
    { id: 'recent',   label: 'New To Old',          icon: 'schedule' },
    { id: 'oldest',   label: 'Old to New',          icon: 'history' },
    { id: 'priceAsc', label: 'Price: Low to High',  icon: 'trending-up' },
    { id: 'priceDesc',label: 'Price: High to Low',  icon: 'trending-down' },
    { id: 'rating',   label: 'Highest Rated Seller',icon: 'star' },
  ];
  const current = options.find(o => o.id === selectedOption) || options[0];

  // short labels for tight layouts
  const shortLabel = {
    recent: 'Newest',
    oldest: 'Oldest',
    priceAsc: '$ ↑',
    priceDesc: '$ ↓',
    rating: 'Top Rated',
  };

  const { width } = Dimensions.get('window');
  const isNarrow = width < 360;

  const shouldUseShort =
    labelMode === 'short' ||
    (labelMode === 'auto' && (isNarrow || current.label.length > 14));

  const displayText = shouldUseShort ? (shortLabel[current.id] || 'Sort') : current.label;

  const H = compact ? 32 : 40;
  const FS = compact ? 13 : 14;
  const PADV = compact ? 6 : 8;
  const PADH = compact ? 10 : 12;

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <TouchableOpacity
        style={[styles.sortButton, { height: H, paddingVertical: PADV, paddingHorizontal: PADH }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        {!hideLeadingIcon && <MaterialIcons name="sort" size={16} color="#4CAF50" />}
        <Text
          style={[styles.sortButtonText, { fontSize: FS, maxWidth: buttonMaxWidth }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayText}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={16} color="#4CAF50" />
      </TouchableOpacity>

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionItem, selectedOption === item.id && styles.selectedOption]}
                  onPress={() => { setModalVisible(false); onSelectOption?.(item.id); }}
                >
                  <MaterialIcons name={item.icon} size={18} color={selectedOption === item.id ? '#4CAF50' : '#666'} />
                  <Text style={[styles.optionText, selectedOption === item.id && styles.selectedOptionText]}>
                    {item.label}
                  </Text>
                  {selectedOption === item.id && <MaterialIcons name="check" size={16} color="#4CAF50" />}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sortButtonText: {
    color: '#333',
    marginHorizontal: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 8, width: '80%', maxWidth: 320, overflow: 'hidden',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', textAlign: 'center' },
  optionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  selectedOption: { backgroundColor: '#f0f9f0' },
  optionText: { fontSize: 14, color: '#333', marginLeft: 12, flex: 1 },
  selectedOptionText: { color: '#4CAF50', fontWeight: '600' },
});

export default SortOptions;
