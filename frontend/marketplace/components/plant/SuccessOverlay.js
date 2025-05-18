import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Success overlay shown after successful plant listing creation
 */
const SuccessOverlay = ({ visible }) => {
  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.successOverlay}>
        <View style={styles.successContent}>
          <MaterialIcons name="check-circle" size={60} color="#4CAF50" />
          <Text style={styles.successTitle}>Successfully Listed!</Text>
          <Text style={styles.successText}>
            Your item has been added to the marketplace
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 14,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SuccessOverlay;