// Improved MarketplaceHeader component with better handling of props
// Replace components/MarketplaceHeader.js with this version

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
import { useNavigation } from '@react-navigation/native';

/**
 * Consistent header component for all marketplace screens
 * @param {Object} props Component props
 * @param {string} props.title Header title text
 * @param {boolean} props.showBackButton Whether to show the back button
 * @param {boolean} props.showNotifications Whether to show the notifications button
 * @param {Function} props.onBackPress Custom back button handler (optional)
 * @param {Function} props.onNotificationsPress Custom notifications handler (optional)
 */
const MarketplaceHeader = ({
  title = 'PlantMarket',
  showBackButton = true, 
  showNotifications = true,
  onBackPress,
  onNotificationsPress,
}) => {
  const navigation = useNavigation();
  
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };
  
  const handleNotificationsPress = () => {
    if (onNotificationsPress) {
      onNotificationsPress();
    } else {
      navigation.navigate('Messages');
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#4CAF50"
        translucent={false}
      />
      <View style={styles.headerContent}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityLabel="Back"
            accessibilityHint="Go back to previous screen"
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <Text 
          style={[
            styles.title, 
            !showBackButton && styles.centeredTitle,
            showBackButton && !showNotifications && styles.rightPadding
          ]} 
          numberOfLines={1}
          accessible={true}
          accessibilityRole="header"
        >
          {title}
        </Text>

        {showNotifications && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleNotificationsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityLabel="Notifications"
            accessibilityHint="View your notifications and messages"
            accessibilityRole="button"
          >
            <MaterialIcons name="notifications" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: Platform.OS === 'ios' ? 90 : 60,
    width: '100%',
    backgroundColor: '#4CAF50',
    zIndex: 100,
    justifyContent: 'flex-end', // Align content to bottom for iOS
    paddingTop: Platform.OS === 'ios' ? 40 : 0,
  },
  headerContent: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    opacity: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1, 
  },
  centeredTitle: {
    textAlign: 'center',
  },
  rightPadding: {
    paddingRight: 40, // Balance the header when there's only back button
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
});

export default MarketplaceHeader;