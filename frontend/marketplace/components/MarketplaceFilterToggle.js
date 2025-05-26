// components/MarketplaceFilterToggle.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Toggle component for filtering between individual and business products
 * 
 * @param {Object} props
 * @param {string} props.sellerType - Current seller type filter ('all', 'individual', 'business')
 * @param {Function} props.onSellerTypeChange - Callback when seller type changes
 * @param {Object} props.counts - Counts of products by seller type
 */
const MarketplaceFilterToggle = ({ 
  sellerType = 'all', 
  onSellerTypeChange,
  counts = { all: 0, individual: 0, business: 0 }
}) => {
  // Animation value for the slider
  const [slideAnim] = React.useState(new Animated.Value(
    sellerType === 'all' ? 0 : sellerType === 'individual' ? 0 : 1
  ));
  
  // Update animation when seller type changes
  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: sellerType === 'business' ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [sellerType]);
  
  // Handle toggling between seller types
  const handleToggle = () => {
    const nextType = sellerType === 'business' ? 'individual' : 'business';
    onSellerTypeChange(nextType);
  };
  
  // Handle clicking on "All" filter
  const handleAllFilter = () => {
    onSellerTypeChange('all');
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[
            styles.allButton, 
            sellerType === 'all' && styles.allButtonActive
          ]} 
          onPress={handleAllFilter}
          accessibilityRole="button"
          accessibilityLabel="Show all sellers"
          accessibilityState={{ selected: sellerType === 'all' }}
        >
          <MaterialIcons 
            name="view-list" 
            size={16} 
            color={sellerType === 'all' ? '#ffffff' : '#4CAF50'} 
          />
          <Text style={[
            styles.allButtonText,
            sellerType === 'all' && styles.allButtonTextActive
          ]}>
            All ({counts.all})
          </Text>
        </TouchableOpacity>
        
        <View style={styles.toggleWrapper}>
          <TouchableOpacity
            style={styles.toggle}
            onPress={handleToggle}
            accessibilityRole="switch"
            accessibilityLabel={`Toggle between individual and business sellers. Currently showing ${sellerType} sellers.`}
            accessibilityState={{ checked: sellerType === 'business' }}
          >
            <Animated.View 
              style={[
                styles.toggleThumb,
                {
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2, Platform.OS === 'web' ? 76 : 76]
                    })
                  }]
                }
              ]}
            >
              <MaterialCommunityIcons 
                name={sellerType === 'business' ? 'store' : 'account'} 
                size={16} 
                color="#4CAF50" 
              />
            </Animated.View>
            
            <View style={styles.toggleLabels}>
              <Text style={[
                styles.toggleLabel,
                sellerType !== 'business' && styles.toggleLabelActive
              ]}>
                Individual ({counts.individual})
              </Text>
              <Text style={[
                styles.toggleLabel,
                sellerType === 'business' && styles.toggleLabelActive
              ]}>
                Business ({counts.business})
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.filterHint}>
        <MaterialIcons name="info-outline" size={14} color="#4CAF50" />
        <Text style={styles.hintText}>
          {sellerType === 'all' 
            ? 'Showing all sellers' 
            : sellerType === 'individual' 
              ? 'Showing individual sellers only' 
              : 'Showing business sellers only'
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: 'transparent',
  },
  allButtonActive: {
    backgroundColor: '#4CAF50',
  },
  allButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  allButtonTextActive: {
    color: '#ffffff',
  },
  toggleWrapper: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  toggle: {
    width: 150,
    height: 36,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    position: 'relative',
  },
  toggleThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    zIndex: 1,
  },
  toggleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  toggleLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 22,
    marginRight: 22,
  },
  toggleLabelActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  filterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});

export default MarketplaceFilterToggle;