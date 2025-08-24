// Business/components/NotificationSettings.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function NotificationSettings({ visible, onClose }) {
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [notificationTime, setNotificationTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [businessId, setBusinessId] = useState(null);


  useEffect(() => {
    initializeSettings();
  }, []);

  useEffect(() => {
    if (businessId && !isInitialized) {
      initialize(businessId);
    }
  }, [businessId, isInitialized, initialize]);

  const initializeSettings = async () => {
    try {
      setIsLoading(true);
      
      // Get business ID
      const id = await AsyncStorage.getItem('businessId') || await AsyncStorage.getItem('userEmail');
      setBusinessId(id);
      
      // Load saved settings
      await loadSettings();
      
    } catch (error) {
      console.error('Error initializing notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      // Get saved notification settings
      const savedTime = await AsyncStorage.getItem('wateringNotificationTime');
      const savedEnabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
      
      // Set state from saved values
      if (savedTime) {
        const [hours, minutes] = savedTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setNotificationTime(date);
      } else {
        // Default to 7:00 AM
        const defaultTime = new Date();
        defaultTime.setHours(7, 0, 0, 0);
        setNotificationTime(defaultTime);
      }
      
      setEnableNotifications(savedEnabled === 'true');
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const handleToggleNotifications = async (enabled) => {
    try {
      setIsSaving(true);
      setEnableNotifications(enabled);

      if (enabled) {
        // Initialize Firebase if not already done
        if (!isInitialized) {
          const initialized = await initialize(businessId);
          if (!initialized) {
            Alert.alert('Setup Failed', 'Failed to initialize notifications');
            setEnableNotifications(false);
            return;
          }
        }

        // Check permission
        if (!hasPermission) {
          Alert.alert(
            'Permission Required',
            'Please allow notifications in your device settings to receive watering reminders.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setEnableNotifications(false) },
              { text: 'Settings', onPress: () => {
                console.log('Open device settings for notifications');
                setEnableNotifications(false);
              }}
            ]
          );
          return;
        }

        // Register for watering notifications
        if (token) {
          const timeStr = `${notificationTime.getHours().toString().padStart(2, '0')}:${notificationTime.getMinutes().toString().padStart(2, '0')}`;
          const success = await registerForWateringNotifications(timeStr);
          
          if (!success) {
            Alert.alert('Registration Failed', 'Could not register for notifications');
            setEnableNotifications(false);
            return;
          }
        }
      }

      // Save settings locally
      await AsyncStorage.setItem('wateringNotificationsEnabled', enabled.toString());
      
      if (enabled) {
        const timeStr = `${notificationTime.getHours().toString().padStart(2, '0')}:${notificationTime.getMinutes().toString().padStart(2, '0')}`;
        await AsyncStorage.setItem('wateringNotificationTime', timeStr);
      }

    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings');
      setEnableNotifications(!enabled);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    
    if (selectedTime) {
      setNotificationTime(selectedTime);
      
      // If notifications are enabled, update the time
      if (enableNotifications) {
        saveTimeUpdate(selectedTime);
      }
    }
  };

  const saveTimeUpdate = async (time) => {
    try {
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      await AsyncStorage.setItem('wateringNotificationTime', timeStr);
      
      // Re-register with new time if notifications are enabled
      if (enableNotifications && token) {
        await registerForWateringNotifications(timeStr);
      }
    } catch (error) {
      console.error('Error saving time update:', error);
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

  const formatTime = (time) => {
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderNotificationStatus = () => {
    const info = getNotificationInfo();
    
    if (!info.isInitialized) {
      return (
        <View style={styles.statusContainer}>
          <MaterialCommunityIcons name="bell-off" size={24} color="#999" />
          <Text style={styles.statusText}>Initializing notifications...</Text>
        </View>
      );
    }

    if (!info.hasPermission) {
      return (
        <View style={styles.statusContainer}>
          <MaterialCommunityIcons name="bell-off" size={24} color="#f44336" />
          <Text style={styles.statusText}>Permission required</Text>
        </View>
      );
    }

    return (
      <View style={styles.statusContainer}>
        <MaterialCommunityIcons name="bell-check" size={24} color="#4caf50" />
        <Text style={styles.statusText}>
          Ready • {info.tokenType} • {info.platform}
        </Text>
      </View>
    );
  };

  if (isLoading && !businessId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="bell-ring" size={24} color="#4CAF50" />
        <Text style={styles.title}>Notification Settings</Text>
      </View>

      {renderNotificationStatus()}

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Watering Reminders</Text>
            <Text style={styles.settingDescription}>
              Get daily notifications to water your plants
            </Text>
          </View>
          <Switch
            value={enableNotifications}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor={enableNotifications ? '#fff' : '#fff'}
            disabled={isSaving}
          />
        </View>

        {enableNotifications && (
          <View style={styles.timeSection}>
            <Text style={styles.timeLabel}>Notification Time</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color="#4CAF50" />
              <Text style={styles.timeText}>{formatTime(notificationTime)}</Text>
            </TouchableOpacity>

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
        )}
      </View>

      {enableNotifications && hasPermission && (
        <TouchableOpacity 
          style={styles.testButton}
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

      {!hasPermission && (
        <View style={styles.permissionWarning}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#ff9800" />
          <Text style={styles.permissionWarningText}>
            Notification permission is required to receive watering reminders. 
            Please enable notifications in your device settings.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  timeSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  timeText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginBottom: 20,
  },
  testButtonText: {
    marginLeft: 8,
    color: '#4CAF50',
    fontWeight: '600',
  },
  permissionWarning: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  permissionWarningText: {
    marginLeft: 8,
    color: '#856404',
    fontSize: 14,
    flex: 1,
  },
  loadingText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
  },
});