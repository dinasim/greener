// screens/EnhancedNotificationSettingsScreen.js - COMPREHENSIVE NOTIFICATION SETTINGS
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  SectionList
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

// Import the universal notification manager
import universalNotificationManager, { NOTIFICATION_TYPES, PRIORITY } from '../services/UniversalNotificationManager';

// Import the unified hook instead of separate ones
import { useUniversalNotifications } from '../hooks/useUniversalNotifications';

export default function EnhancedNotificationSettingsScreen({ navigation }) {
  const [userEmail, setUserEmail] = useState(null);
  const [userType, setUserType] = useState('user');
  const [businessId, setBusinessId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showQuietHoursStart, setShowQuietHoursStart] = useState(false);
  const [showQuietHoursEnd, setShowQuietHoursEnd] = useState(false);

  // Use the unified notification hook
  const {
    isInitialized,
    hasPermission,
    token,
    error,
    settings,
    statistics,
    updateSettings,
    sendTestNotification,
    requestPermission,
    getNotificationInfo,
    retry
  } = useUniversalNotifications(userType, userType === 'user' ? userEmail : null, userType === 'business' ? businessId : null);

  useEffect(() => {
    initializeSettings();
  }, []);

  const initializeSettings = async () => {
    try {
      setIsLoading(true);
      
      // Load user data
      const [email, type, bId] = await Promise.all([
        AsyncStorage.getItem('userEmail'),
        AsyncStorage.getItem('userType'),
        AsyncStorage.getItem('businessId')
      ]);
      
      setUserEmail(email);
      setUserType(type || 'user');
      setBusinessId(bId);
      
    } catch (error) {
      console.error('Error initializing notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = async (key, value) => {
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleQuietHoursChange = async (field, value) => {
    try {
      const quietHours = {
        ...settings.quietHours,
        [field]: field === 'enabled' ? value : value.toTimeString().substring(0, 5)
      };
      
      await updateSettings({ quietHours });
      
    } catch (error) {
      console.error('Error updating quiet hours:', error);
      Alert.alert('Error', 'Failed to update quiet hours');
    }
  };

  const handleTestNotification = async () => {
    try {
      setIsSaving(true);
      
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications first before testing.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await sendTestNotification();
      
      if (result.success) {
        Alert.alert(
          '✅ Test Sent',
          'Test notification sent! You should receive it shortly.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to send test notification');
      }
      
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermissionRequest = async () => {
    try {
      const granted = await requestPermission();
      if (granted) {
        Alert.alert('Success', 'Notification permission granted!');
      } else {
        Alert.alert(
          'Permission Denied',
          'To receive notifications, please enable them in your device settings.'
        );
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request permission');
    }
  };

  const saveAllSettings = async () => {
    try {
      setIsSaving(true);
      
      // Settings are automatically saved when updated through updateSettings
      Alert.alert('Success', 'Notification settings saved successfully!');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const renderNotificationStatus = () => {
    const stats = statistics;
    
    return (
      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>🔔 Notification Status</Text>
        
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons 
              name={isInitialized ? "check-circle" : "alert-circle"} 
              size={24} 
              color={isInitialized ? "#4CAF50" : "#FF9800"} 
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Service Status</Text>
              <Text style={[styles.statusText, { color: isInitialized ? "#4CAF50" : "#FF9800" }]}>
                {isInitialized ? "Active" : "Initializing"}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <MaterialCommunityIcons 
              name={hasPermission ? "bell-check" : "bell-off"} 
              size={24} 
              color={hasPermission ? "#4CAF50" : "#F44336"} 
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Permission</Text>
              <Text style={[styles.statusText, { color: hasPermission ? "#4CAF50" : "#F44336" }]}>
                {hasPermission ? "Granted" : "Not Granted"}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <MaterialCommunityIcons 
              name={token ? "key" : "key-off"} 
              size={24} 
              color={token ? "#4CAF50" : "#FF9800"} 
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Device Token</Text>
              <Text style={[styles.statusText, { color: token ? "#4CAF50" : "#FF9800" }]}>
                {token ? "Available" : "Not Available"}
              </Text>
            </View>
          </View>
          
          {stats.queuedNotifications > 0 && (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="clock-outline" size={24} color="#FF9800" />
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>Queued Notifications</Text>
                <Text style={[styles.statusText, { color: "#FF9800" }]}>
                  {stats.queuedNotifications} pending
                </Text>
              </View>
            </View>
          )}
          
          {!hasPermission && (
            <TouchableOpacity 
              style={styles.permissionButton}
              onPress={handlePermissionRequest}
            >
              <MaterialCommunityIcons name="bell-plus" size={20} color="#fff" />
              <Text style={styles.permissionButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderNotificationSettings = () => {
    const sections = [];
    
    if (userType === 'business') {
      sections.push({
        title: '🏢 Business Notifications',
        data: [
          { key: 'newOrders', title: 'New Orders', description: 'Get notified when customers place orders', icon: 'shopping' },
          { key: 'lowStock', title: 'Low Stock Alerts', description: 'Alert when inventory is running low', icon: 'inventory' },
          { key: 'customerMessages', title: 'Customer Messages', description: 'New messages from customers', icon: 'chat' },
          { key: 'businessWatering', title: 'Watering Reminders', description: 'Daily plant care reminders', icon: 'water-drop' },
          { key: 'paymentReceived', title: 'Payment Notifications', description: 'When payments are received', icon: 'payment' }
        ]
      });
      
      sections.push({
        title: '📊 Reports & Updates',
        data: [
          { key: 'dailyReports', title: 'Daily Reports', description: 'End of day business summaries', icon: 'assessment' },
          { key: 'marketingUpdates', title: 'Marketing Updates', description: 'Promotional opportunities and tips', icon: 'campaign' }
        ]
      });
    } else {
      sections.push({
        title: '🌱 Plant Care',
        data: [
          { key: 'wateringReminders', title: 'Watering Reminders', description: 'Get reminded when plants need water', icon: 'water-drop' },
          { key: 'plantCare', title: 'Care Tips', description: 'Helpful plant care suggestions', icon: 'eco' },
          { key: 'diseaseAlerts', title: 'Disease Alerts', description: 'Important alerts about plant health', icon: 'warning' }
        ]
      });
      
      sections.push({
        title: '💬 Community & Marketplace',
        data: [
          { key: 'forumReplies', title: 'Forum Replies', description: 'When someone replies to your posts', icon: 'forum' },
          { key: 'marketplaceUpdates', title: 'Marketplace Updates', description: 'New products and deals', icon: 'store' },
          { key: 'newMessages', title: 'Direct Messages', description: 'Private messages from other users', icon: 'message' }
        ]
      });
      
      sections.push({
        title: '📱 App Updates',
        data: [
          { key: 'appUpdates', title: 'App Updates', description: 'New features and improvements', icon: 'system-update' }
        ]
      });
    }
    
    return (
      <View style={styles.settingsSection}>
        {sections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((setting) => (
              <View key={setting.key} style={styles.settingCard}>
                <View style={styles.settingRow}>
                  <MaterialIcons name={setting.icon} size={24} color="#4CAF50" />
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{setting.title}</Text>
                    <Text style={styles.settingDescription}>{setting.description}</Text>
                  </View>
                  <Switch
                    value={settings[setting.key] || false}
                    onValueChange={(value) => handleSettingChange(setting.key, value)}
                    trackColor={{ false: '#ccc', true: '#4CAF50' }}
                    thumbColor={settings[setting.key] ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderAdvancedSettings = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔧 Advanced Settings</Text>
      
      {/* Sound & Vibration */}
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <MaterialCommunityIcons name="volume-high" size={24} color="#4CAF50" />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Sound Notifications</Text>
            <Text style={styles.settingDescription}>Play sound for notifications</Text>
          </View>
          <Switch
            value={settings.soundEnabled || false}
            onValueChange={(value) => handleSettingChange('soundEnabled', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor={settings.soundEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
      
      {Platform.OS !== 'web' && (
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <MaterialCommunityIcons name="vibrate" size={24} color="#4CAF50" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Vibration</Text>
              <Text style={styles.settingDescription}>Vibrate for notifications</Text>
            </View>
            <Switch
              value={settings.vibrationEnabled || false}
              onValueChange={(value) => handleSettingChange('vibrationEnabled', value)}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={settings.vibrationEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      )}
      
      {/* Quiet Hours */}
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <MaterialCommunityIcons name="sleep" size={24} color="#4CAF50" />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Quiet Hours</Text>
            <Text style={styles.settingDescription}>Disable non-urgent notifications during these hours</Text>
          </View>
          <Switch
            value={settings.quietHours?.enabled || false}
            onValueChange={(value) => handleQuietHoursChange('enabled', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor={settings.quietHours?.enabled ? '#fff' : '#f4f3f4'}
          />
        </View>
        
        {settings.quietHours?.enabled && (
          <View style={styles.quietHoursConfig}>
            <View style={styles.timePickerRow}>
              <Text style={styles.timeLabel}>Start:</Text>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => setShowQuietHoursStart(true)}
              >
                <MaterialCommunityIcons name="clock-outline" size={20} color="#4CAF50" />
                <Text style={styles.timeText}>{settings.quietHours?.start || '22:00'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.timePickerRow}>
              <Text style={styles.timeLabel}>End:</Text>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => setShowQuietHoursEnd(true)}
              >
                <MaterialCommunityIcons name="clock-outline" size={20} color="#4CAF50" />
                <Text style={styles.timeText}>{settings.quietHours?.end || '07:00'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionSection}>
      {hasPermission && (
        <TouchableOpacity 
          style={styles.testButton}
          onPress={handleTestNotification}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <>
              <MaterialCommunityIcons name="bell-ring" size={20} color="#4CAF50" />
              <Text style={styles.testButtonText}>Send Test Notification</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      
      <TouchableOpacity 
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={saveAllSettings}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <MaterialIcons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save All Settings</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading notification settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.headerRight}>
          <MaterialCommunityIcons name="bell-cog" size={24} color="#4CAF50" />
        </View>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderNotificationStatus()}
        {renderNotificationSettings()}
        {renderAdvancedSettings()}
        {renderActionButtons()}
        
        {/* Information Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 About Notifications</Text>
          <Text style={styles.infoText}>
            • High priority notifications (like new orders) ignore quiet hours
          </Text>
          <Text style={styles.infoText}>
            • Notifications are queued during quiet hours and delivered afterwards
          </Text>
          <Text style={styles.infoText}>
            • You can test your setup using the test notification button
          </Text>
          <Text style={styles.infoText}>
            • Settings are synced across all your devices
          </Text>
        </View>
      </ScrollView>
      
      {/* Time Pickers */}
      {showQuietHoursStart && (
        <DateTimePicker
          value={new Date(`2000-01-01T${settings.quietHours?.start || '22:00'}:00`)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, selectedTime) => {
            setShowQuietHoursStart(false);
            if (selectedTime) {
              handleQuietHoursChange('start', selectedTime);
            }
          }}
        />
      )}
      
      {showQuietHoursEnd && (
        <DateTimePicker
          value={new Date(`2000-01-01T${settings.quietHours?.end || '07:00'}:00`)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, selectedTime) => {
            setShowQuietHoursEnd(false);
            if (selectedTime) {
              handleQuietHoursChange('end', selectedTime);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusText: {
    fontSize: 12,
    marginTop: 2,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsSection: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  quietHoursConfig: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  actionSection: {
    marginBottom: 24,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  testButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
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