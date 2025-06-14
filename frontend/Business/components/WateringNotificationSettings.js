// Business/components/WateringNotificationSettings.js - NO BARCODE VERSION
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import REAL API services
import {
  updateNotificationSettings,
  sendTestNotification,
  getNotificationToken
} from '../services/businessWateringApi';

const WateringNotificationSettings = ({ businessId, onSettingsChange }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    loadSettings();
    checkNotificationToken();
  }, []);

  const loadSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
      const timeStr = await AsyncStorage.getItem('wateringNotificationTime');
      
      if (enabled !== null) {
        setIsEnabled(enabled === 'true');
      }
      
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const time = new Date();
        time.setHours(hours, minutes, 0, 0);
        setNotificationTime(time);
      }
    } catch (error) {
      console.warn('Error loading notification settings:', error);
    }
  };

  const checkNotificationToken = async () => {
    try {
      const token = await getNotificationToken();
      setHasToken(!!token);
      
      if (token) {
        const tokenKey = Platform.OS === 'web' ? 'webPushToken' : 'fcmToken';
        await AsyncStorage.setItem(tokenKey, token);
      }
    } catch (error) {
      console.warn('Error checking notification token:', error);
      setHasToken(false);
    }
  };

  const handleToggleNotifications = async (enabled) => {
    try {
      setIsLoading(true);
      setIsEnabled(enabled);

      if (enabled && !hasToken) {
        // Try to get notification token if we don't have one
        const token = await getNotificationToken();
        if (token) {
          setHasToken(true);
          const tokenKey = Platform.OS === 'web' ? 'webPushToken' : 'fcmToken';
          await AsyncStorage.setItem(tokenKey, token);
        } else {
          Alert.alert(
            'Permission Required',
            'Please allow notifications in your device settings to receive watering reminders.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => {
                // You could add logic to open device settings here
                console.log('Open device settings for notifications');
              }}
            ]
          );
          setIsEnabled(false);
          return;
        }
      }

      // Save settings locally
      await AsyncStorage.setItem('wateringNotificationsEnabled', enabled.toString());

      // Update settings on backend
      const timeStr = `${notificationTime.getHours().toString().padStart(2, '0')}:${notificationTime.getMinutes().toString().padStart(2, '0')}`;
      
      await updateNotificationSettings(businessId, {
        enabled: enabled,
        notificationTime: timeStr
      });

      if (onSettingsChange) {
        onSettingsChange({ enabled, notificationTime });
      }

      // Show success message
      Alert.alert(
        'Settings Updated',
        enabled 
          ? `Watering reminders enabled for ${formatTime(notificationTime)}`
          : 'Watering reminders disabled',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert(
        'Error',
        'Failed to update notification settings. Please try again.',
        [{ text: 'OK' }]
      );
      // Revert the toggle
      setIsEnabled(!enabled);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeChange = async (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    
    if (selectedTime) {
      setNotificationTime(selectedTime);
      
      if (isEnabled) {
        try {
          const timeStr = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
          
          // Save locally
          await AsyncStorage.setItem('wateringNotificationTime', timeStr);
          
          // Update backend
          await updateNotificationSettings(businessId, {
            notificationTime: timeStr
          });

          if (onSettingsChange) {
            onSettingsChange({ enabled: isEnabled, notificationTime: selectedTime });
          }

        } catch (error) {
          console.error('Error updating notification time:', error);
        }
      }
    }
  };

  const handleTestNotification = async () => {
    try {
      setIsLoading(true);

      if (!hasToken) {
        Alert.alert(
          'No Notification Token',
          'Unable to send test notification. Please enable notifications first.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await sendTestNotification(businessId);
      
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

  const formatTime = (time) => {
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = () => {
    if (!hasToken) return '#F44336';
    if (isEnabled) return '#4CAF50';
    return '#FF9800';
  };

  const getStatusText = () => {
    if (!hasToken) return 'Permission needed';
    if (isEnabled) return 'Active';
    return 'Disabled';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="bell-outline" size={24} color="#4CAF50" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Watering Reminders</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Enable Notifications</Text>
          <Text style={styles.settingDescription}>
            Get daily reminders for plants that need watering
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggleNotifications}
          disabled={isLoading}
          trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
          thumbColor={isEnabled ? '#FFFFFF' : '#FFFFFF'}
        />
      </View>

      {isEnabled && hasToken && (
        <>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notification Time</Text>
              <Text style={styles.settingDescription}>
                When to send daily watering reminders
              </Text>
            </View>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.timeButtonText}>{formatTime(notificationTime)}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.testButton, isLoading && styles.testButtonDisabled]}
            onPress={handleTestNotification}
            disabled={isLoading}
          >
            <MaterialCommunityIcons 
              name="bell-ring" 
              size={20} 
              color={isLoading ? '#999' : '#4CAF50'} 
            />
            <Text style={[styles.testButtonText, isLoading && styles.testButtonTextDisabled]}>
              {isLoading ? 'Sending...' : 'Send Test Notification'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {!hasToken && (
        <View style={styles.permissionWarning}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#F44336" />
          <Text style={styles.permissionWarningText}>
            Notification permission required. Please enable notifications in your device settings.
          </Text>
        </View>
      )}

      {showTimePicker && (
        <DateTimePicker
          value={notificationTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 16,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 6,
  },
  testButtonDisabled: {
    borderColor: '#E0E0E0',
  },
  testButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: '500',
  },
  testButtonTextDisabled: {
    color: '#999',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  permissionWarningText: {
    fontSize: 12,
    color: '#D32F2F',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});

export default WateringNotificationSettings;