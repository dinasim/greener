// Business/BusinessScreens/NotificationSettingsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import WateringNotificationSettings from '../components/WateringNotificationSettings';

// Import API services
import {
  getNotificationToken,
  registerForWateringNotifications
} from '../services/businessWateringApi';

const NotificationSettingsScreen = ({ navigation }) => {
  const [businessId, setBusinessId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationStats, setNotificationStats] = useState({
    hasPermission: false,
    tokenType: null,
    isEnabled: false,
    lastUpdate: null
  });

  useEffect(() => {
    loadBusinessId();
  }, []);

  const loadBusinessId = async () => {
    try {
      const id = await AsyncStorage.getItem('businessId') || await AsyncStorage.getItem('userEmail');
      setBusinessId(id);
      
      if (id) {
        await checkNotificationStatus();
      }
    } catch (error) {
      console.error('Error loading business ID:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const token = await getNotificationToken();
      const enabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
      const lastUpdate = await AsyncStorage.getItem('notificationLastUpdate');
      
      setNotificationStats({
        hasPermission: !!token,
        tokenType: token ? (token.includes('ExponentPushToken') ? 'expo' : 'fcm') : null,
        isEnabled: enabled === 'true',
        lastUpdate: lastUpdate
      });
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const handleSetupNotifications = async () => {
    try {
      setIsLoading(true);
      
      await registerForWateringNotifications('07:00');
      
      Alert.alert(
        '✅ Notifications Enabled',
        'You will now receive daily watering reminders at 7:00 AM',
        [{ text: 'OK' }]
      );
      
      await checkNotificationStatus();
    } catch (error) {
      console.error('Error setting up notifications:', error);
      Alert.alert(
        'Setup Failed',
        'Failed to set up notifications. Please try again or check your device settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsChange = async (settings) => {
    try {
      await AsyncStorage.setItem('notificationLastUpdate', new Date().toISOString());
      await checkNotificationStatus();
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const renderNotificationStatus = () => {
    const { hasPermission, tokenType, isEnabled } = notificationStats;
    
    let statusColor = '#F44336';
    let statusText = 'Not Set Up';
    let statusIcon = 'bell-off';
    
    if (hasPermission && isEnabled) {
      statusColor = '#4CAF50';
      statusText = 'Active';
      statusIcon = 'bell-ring';
    } else if (hasPermission && !isEnabled) {
      statusColor = '#FF9800';
      statusText = 'Permission Granted';
      statusIcon = 'bell-outline';
    }
    
    return (
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <MaterialCommunityIcons name={statusIcon} size={24} color={statusColor} />
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Notification Status</Text>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        
        {tokenType && (
          <View style={styles.statusDetail}>
            <MaterialIcons name="info-outline" size={16} color="#666" />
            <Text style={styles.statusDetailText}>
              Using {tokenType.toUpperCase()} notifications
            </Text>
          </View>
        )}
        
        {!hasPermission && (
          <TouchableOpacity 
            style={styles.setupButton}
            onPress={handleSetupNotifications}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <>
                <MaterialCommunityIcons name="bell-plus" size={20} color="#4CAF50" />
                <Text style={styles.setupButtonText}>Set Up Notifications</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isLoading && !businessId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {renderNotificationStatus()}
        
        <WateringNotificationSettings 
          businessId={businessId}
          onSettingsChange={handleSettingsChange}
        />
        
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How it works</Text>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>
              Daily notifications at your chosen time
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="water" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>
              Only when plants actually need watering
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="weather-rainy" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>
              Weather-aware (skips rainy days)
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="cellphone" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>
              Works on mobile and web
            </Text>
          </View>
        </View>
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  statusDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statusDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 6,
  },
  setupButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default NotificationSettingsScreen;