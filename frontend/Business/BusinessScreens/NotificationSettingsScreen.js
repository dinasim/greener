// Business/BusinessScreens/NotificationSettingsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import WateringNotificationSettings from '../components/WateringNotificationSettings';
import NotificationPermissionGuide from '../components/NotificationPermissionGuide';

// Import hooks
import { useBusinessFirebaseNotifications } from '../hooks/useBusinessFirebaseNotifications';
import businessFirebaseNotificationService from '../services/BusinessFirebaseNotificationService';

const NotificationSettingsScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [businessId, setBusinessId] = useState(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [notificationStats, setNotificationStats] = useState({
    hasPermission: false,
    tokenType: null,
    isEnabled: false,
    lastUpdate: null
  });

  // Use Firebase notifications hook
  const {
    isInitialized,
    hasPermission,
    token,
    initialize,
    registerForWateringNotifications,
    sendTestNotification,
    getNotificationInfo
  } = useBusinessFirebaseNotifications(businessId);

  useEffect(() => {
    loadBusinessId();
    setupPermissionEventListeners();
    
    return () => {
      removePermissionEventListeners();
    };
  }, []);

  useEffect(() => {
    if (businessId) {
      checkNotificationStatus();
      checkPermissionStatus();
    }
  }, [businessId, isInitialized, hasPermission, token]);

  const setupPermissionEventListeners = () => {
    if (Platform.OS !== 'web') return;

    const handlePermissionBlocked = (event) => {
      console.log('🚫 Permission blocked event received:', event.detail);
      setPermissionStatus(businessFirebaseNotificationService.getPermissionStatus());
      setShowPermissionGuide(true);
    };

    const handlePermissionDenied = (event) => {
      console.log('❌ Permission denied event received:', event.detail);
      setPermissionStatus(businessFirebaseNotificationService.getPermissionStatus());
      setShowPermissionGuide(true);
    };

    const handlePermissionError = (event) => {
      console.log('⚠️ Permission error event received:', event.detail);
      Alert.alert(
        'Permission Error',
        event.detail.message,
        [{ text: 'OK' }]
      );
    };

    const handleRetryPermission = async () => {
      console.log('🔄 Retrying permission request...');
      await handleSetupNotifications();
    };

    window.addEventListener('notificationPermissionBlocked', handlePermissionBlocked);
    window.addEventListener('notificationPermissionDenied', handlePermissionDenied);
    window.addEventListener('notificationPermissionError', handlePermissionError);
    window.addEventListener('retryNotificationPermission', handleRetryPermission);
  };

  const removePermissionEventListeners = () => {
    if (Platform.OS !== 'web') return;

    window.removeEventListener('notificationPermissionBlocked', () => {});
    window.removeEventListener('notificationPermissionDenied', () => {});
    window.removeEventListener('notificationPermissionError', () => {});
    window.removeEventListener('retryNotificationPermission', () => {});
  };

  const checkPermissionStatus = () => {
    if (Platform.OS === 'web') {
      const status = businessFirebaseNotificationService.getPermissionStatus();
      setPermissionStatus(status);
      console.log('🔔 Permission status:', status);
    }
  };

  const loadBusinessId = async () => {
    try {
      const id = await AsyncStorage.getItem('businessId') || await AsyncStorage.getItem('userEmail');
      setBusinessId(id);
      
      if (id && !isInitialized) {
        await initialize(id);
      }
    } catch (error) {
      console.error('Error loading business ID:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
      const lastUpdate = await AsyncStorage.getItem('notificationLastUpdate');
      
      const info = getNotificationInfo();
      
      setNotificationStats({
        hasPermission: info.hasPermission,
        tokenType: info.tokenType,
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
      
      // Check permission status first
      if (Platform.OS === 'web') {
        const status = businessFirebaseNotificationService.getPermissionStatus();
        
        if (status.isBlocked) {
          setPermissionStatus(status);
          setShowPermissionGuide(true);
          return;
        }
        
        if (!status.canRequest && status.status !== 'granted') {
          setPermissionStatus(status);
          setShowPermissionGuide(true);
          return;
        }
      }
      
      // Initialize Firebase if not already done
      if (!isInitialized) {
        const initialized = await initialize(businessId);
        if (!initialized) {
          Alert.alert('Setup Failed', 'Failed to initialize notifications');
          return;
        }
      }

      // Try to request permission
      const permissionGranted = await businessFirebaseNotificationService.requestPermission();
      
      if (!permissionGranted) {
        // Permission was denied or blocked - the service will trigger appropriate events
        return;
      }

      // Register for default watering notifications at 7:00 AM
      const success = await registerForWateringNotifications('07:00');
      
      if (success) {
        Alert.alert(
          '✅ Notifications Enabled',
          'You will now receive daily watering reminders at 7:00 AM',
          [{ text: 'OK' }]
        );
        
        await checkNotificationStatus();
        await checkPermissionStatus();
      } else {
        Alert.alert(
          'Setup Failed',
          'Failed to set up notifications. Please try again or check your device settings.',
          [{ text: 'OK' }]
        );
      }
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

  const handleTestNotification = async () => {
    try {
      setIsLoading(true);

      if (!hasPermission || !token) {
        Alert.alert(
          'Setup Required',
          'Please enable notifications first before testing.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await sendTestNotification();
      
      if (result.success) {
        Alert.alert(
          '✅ Test Sent',
          'Test notification sent successfully! You should receive it shortly.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Test Failed',
          result.message || 'Failed to send test notification',
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Error',
        'Failed to send test notification. Please check your internet connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderNotificationStatus = () => {
    const { hasPermission, tokenType, isEnabled } = notificationStats;
    
    let statusColor = '#F44336';
    let statusIcon = 'bell-off';
    let statusText = 'Disabled';

    if (hasPermission && isEnabled) {
      statusColor = '#4CAF50';
      statusIcon = 'bell-check';
      statusText = 'Active';
    } else if (hasPermission && !isEnabled) {
      statusColor = '#FF9800';
      statusIcon = 'bell-outline';
      statusText = 'Available';
    }

    return (
      <View style={styles.statusCard}>
        <MaterialCommunityIcons name={statusIcon} size={32} color={statusColor} />
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>Notification Status</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          {tokenType && (
            <Text style={styles.statusDetails}>
              Using {tokenType.toUpperCase()} notifications
            </Text>
          )}
        </View>
        
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {renderNotificationStatus()}
        
        <WateringNotificationSettings 
          businessId={businessId}
          onSettingsChange={handleSettingsChange}
        />

        {hasPermission && token && (
          <TouchableOpacity 
            style={styles.testNotificationButton}
            onPress={handleTestNotification}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <>
                <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#4CAF50" />
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Notifications</Text>
          <Text style={styles.infoText}>
            • Watering reminders help you maintain consistent plant care schedules
          </Text>
          <Text style={styles.infoText}>
            • Notifications are sent based on your business plants' watering needs
          </Text>
          <Text style={styles.infoText}>
            • You can customize notification times and preferences
          </Text>
          <Text style={styles.infoText}>
            • Test notifications help ensure your setup is working correctly
          </Text>
        </View>

        {/* Permission Guide Modal */}
        <NotificationPermissionGuide 
          visible={showPermissionGuide}
          permissionStatus={permissionStatus}
          onClose={() => setShowPermissionGuide(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusDetails: {
    fontSize: 12,
    color: '#666',
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  setupButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  testNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default NotificationSettingsScreen;