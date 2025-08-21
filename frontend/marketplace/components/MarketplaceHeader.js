// components/MarketplaceHeader.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

/**
 * MarketplaceHeader component - Consistent header for marketplace screens
 * Fixed to ensure notification button works correctly
 * 
 * @param {Object} props Component props
 * @param {string} props.title Header title text
 * @param {boolean} props.showBackButton Whether to show back button (default: false)
 * @param {Function} props.onBackPress Handler for back button press
 * @param {boolean} props.showNotifications Whether to show notifications button (default: true)
 */
const MarketplaceHeader = ({
  title,
  showBackButton = false,
  onBackPress,
}) => {
  // Get safe area insets for proper spacing
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  
  return (
    <View style={[
      styles.container,
      { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }
    ]}>
      <StatusBar
        backgroundColor="#388E3C"
        barStyle="light-content"
      />
      
      <View style={styles.headerContent}>
        {/* Left side - Back button */}
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={onBackPress}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Center - Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
    
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  iconButton: {
    padding: 8,
    marginRight: -8,
  },
});

export default MarketplaceHeader;