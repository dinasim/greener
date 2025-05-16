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

/**
 * MarketplaceHeader component - Consistent header for marketplace screens
 * @param {Object} props Component props
 * @param {string} props.title Header title text
 * @param {boolean} props.showBackButton Whether to show back button (default: false)
 * @param {Function} props.onBackPress Handler for back button press
 * @param {boolean} props.showNotifications Whether to show notifications button (default: true)
 * @param {Function} props.onNotificationsPress Handler for notifications button press
 */
const MarketplaceHeader = ({
  title,
  showBackButton = false,
  onBackPress,
  showNotifications = true,
  onNotificationsPress,
}) => {
  // Get safe area insets for proper spacing
  const insets = useSafeAreaInsets();
  
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
        
        {/* Right side - Notifications */}
        <View style={styles.rightSection}>
          {showNotifications && (
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={onNotificationsPress}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <MaterialIcons name="notifications" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
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