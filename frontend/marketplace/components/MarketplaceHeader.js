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
import { useNavigation } from '@react-navigation/native';

/**
 * Marketplace header component that only shows back button on non-web platforms
 * and matches the web design better
 */
const MarketplaceHeader = ({
  title = 'PlantMarket',
  showBackButton = true, 
  showNotifications = true,
  onNotificationsPress,
}) => {
  const navigation = useNavigation();
  
  // Only show back button on native platforms, not on web
  const shouldShowBackButton = Platform.OS !== 'web' && showBackButton;

  return (
    <View style={styles.background}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#4CAF50"
        translucent={true}
      />
      <View style={styles.headerContent}>
        {shouldShowBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <Text style={[styles.title, !shouldShowBackButton && styles.centeredTitle]}>
          {title}
        </Text>

        {showNotifications && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationsPress || (() => navigation.navigate('Messages'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="notifications" size={24} color="#fff" />
            {/* Notification badge - can be conditionally shown */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    height: 60, // Reduced height to match web design
    width: '100%',
    backgroundColor: '#4CAF50',
    zIndex: 100,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: 3,
    top: 3,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default MarketplaceHeader;