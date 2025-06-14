// Business/components/WateringNotificationSettings.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use the proper Firebase notifications hook
import { useBusinessFirebaseNotifications } from '../hooks/useBusinessFirebaseNotifications';

const WateringNotificationSettings = ({ businessId, onSettingsChange }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState(new Date(new Date().setHours(7, 0, 0, 0)));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    loadSettings();
    if (businessId && !isInitialized) {
      initialize(businessId);
    }
  }, [businessId, isInitialized, initialize]);

  const loadSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
      const time = await AsyncStorage.getItem('wateringNotificationTime');
      
      setIsEnabled(enabled === 'true');
      
      if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setNotificationTime(date);
      }
    } catch (error) {
      console.error('Error loading watering notification settings:', error);
    }
  };

  const handleToggleNotifications = async (enabled) => {
    try {
      setIsLoading(true);
      setIsEnabled(enabled);

      if (enabled) {
        // Initialize Firebase if not already done
        if (!isInitialized) {
          const initialized = await initialize(businessId);
          if (!initialized) {
            Alert.alert('Setup Failed', 'Failed to initialize notifications');
            setIsEnabled(false);
            return;
          }
        }

        // Check permission
        if (!hasPermission) {
          Alert.alert(
            'Permission Required',
            'Please allow notifications in your device settings to receive watering reminders.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setIsEnabled(false) },
              { text: 'Settings', onPress: () => {
                console.log('Open device settings for notifications');
                setIsEnabled(false);
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
            setIsEnabled(false);
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

      if (onSettingsChange) {
        onSettingsChange({ enabled, notificationTime });
      }

    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings');
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
          
          // Re-register with new time if notifications are enabled
          if (token) {
            await registerForWateringNotifications(timeStr);
          }

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
        <View style={styles.statusRow}>
          <MaterialCommunityIcons name="bell-off" size={16} color="#999" />
          <Text style={styles.statusText}>Initializing...</Text>
        </View>
      );
    }

    if (!info.hasPermission) {
      return (
        <View style={styles.statusRow}>
          <MaterialCommunityIcons name="bell-off" size={16} color="#f44336" />
          <Text style={styles.statusText}>Permission required</Text>
        </View>
      );
    }

    return (
      <View style={styles.statusRow}>
        <MaterialCommunityIcons name="bell-check" size={16} color="#4caf50" />
        <Text style={styles.statusText}>Ready • {info.tokenType}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="water" size={24} color="#4CAF50" />
          <Text style={styles.sectionTitle}>Watering Notifications</Text>
        </View>
        
        {renderNotificationStatus()}
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Daily Reminders</Text>
            <Text style={styles.settingDescription}>
              Get notified when plants need watering
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleNotifications}
            thumbColor={isEnabled ? '#4CAF50' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            disabled={isLoading}
          />
        </View>

        {isEnabled && (
          <>
            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Notification Time</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <MaterialCommunityIcons name="clock-outline" size={20} color="#4CAF50" />
                <Text style={styles.timeText}>{formatTime(notificationTime)}</Text>
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

        {!hasPermission && (
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
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
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8f0',
    padding: 12,
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
    backgroundColor: '#f0f8f0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginBottom: 16,
  },
  testButtonDisabled: {
    borderColor: '#999',
    backgroundColor: '#f5f5f5',
  },
  testButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  testButtonTextDisabled: {
    color: '#999',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  permissionWarningText: {
    marginLeft: 8,
    flex: 1,
    color: '#856404',
    fontSize: 12,
  },
});

export default WateringNotificationSettings;