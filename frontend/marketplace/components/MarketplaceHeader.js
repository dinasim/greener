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
 * Marketplace header component with consistent back button behavior
 */

const MarketplaceHeader = ({
  title = 'PlantMarket',
  showBackButton = true, 
  showNotifications = true,
  onNotificationsPress,
}) => {
  const navigation = useNavigation();
  
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
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <Text style={[
          styles.title, 
          !showBackButton && styles.centeredTitle,
          showBackButton && !showNotifications && styles.rightPadding
        ]} numberOfLines={1}>
          {title}
        </Text>

        {showNotifications && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationsPress || (() => navigation.navigate('Messages'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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