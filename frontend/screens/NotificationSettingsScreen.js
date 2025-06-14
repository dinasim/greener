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
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFirebaseNotifications } from '../hooks/useFirebaseNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationSettingsScreen({ navigation }) {
  const [userEmail, setUserEmail] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState({
    wateringReminders: true,
    diseaseAlerts: true,
    marketplaceUpdates: false,
    forumReplies: true,
    generalUpdates: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    isInitialized,
    hasPermission,
    token,
    error,
    requestPermission,
    retry
  } = useFirebaseNotifications(userEmail);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      setUserEmail(email);
      
      // Load notification settings from server or local storage
      const savedSettings = await AsyncStorage.getItem('notificationSettings');
      if (savedSettings) {
        setNotificationSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (setting, value) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Save to local storage
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
      
      // Send to server
      if (userEmail) {
        await fetch('https://usersfunctions.azurewebsites.net/api/notification_settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            settings: notificationSettings
          }),
        });
      }
      
      Alert.alert('Success', 'Notification settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save notification settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermissionRequest = async () => {
    const granted = await requestPermission();
    if (granted) {
      Alert.alert('Success', 'Notification permission granted! You\'ll now receive plant care reminders.');
    } else {
      Alert.alert(
        'Permission Denied', 
        'To receive plant care reminders, please enable notifications in your browser/device settings.'
      );
    }
  };

  const testNotification = () => {
    if (!hasPermission) {
      Alert.alert('No Permission', 'Please enable notifications first.');
      return;
    }

    // For web, show a test notification
    if (window.Notification && Notification.permission === 'granted') {
      new Notification('Greener App Test', {
        body: '🌱 This is a test notification from your plant care app!',
        icon: '/icon-192.png',
        tag: 'test'
      });
    } else {
      Alert.alert('Test Sent', 'Test notification sent! (Mobile notifications are handled by the server)');
    }
  };

  if (isLoading) {
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <TouchableOpacity 
          style={styles.testButton}
          onPress={testNotification}
        >
          <MaterialIcons name="notifications-active" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Permission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notification Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Firebase Initialized:</Text>
              <View style={[styles.statusIndicator, isInitialized ? styles.statusGreen : styles.statusRed]}>
                <Text style={styles.statusText}>{isInitialized ? 'Yes' : 'No'}</Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Permission Granted:</Text>
              <View style={[styles.statusIndicator, hasPermission ? styles.statusGreen : styles.statusRed]}>
                <Text style={styles.statusText}>{hasPermission ? 'Yes' : 'No'}</Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Token Available:</Text>
              <View style={[styles.statusIndicator, token ? styles.statusGreen : styles.statusRed]}>
                <Text style={styles.statusText}>{token ? 'Yes' : 'No'}</Text>
              </View>
            </View>
          </View>

          {error && (
            <View style={styles.errorCard}>
              <MaterialIcons name="error" size={20} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={retry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!hasPermission && (
            <TouchableOpacity style={styles.permissionButton} onPress={handlePermissionRequest}>
              <MaterialIcons name="notifications" size={20} color="#fff" />
              <Text style={styles.permissionButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Notification Preferences</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Watering Reminders</Text>
                <Text style={styles.settingDescription}>Get reminded when your plants need water</Text>
              </View>
              <Switch
                value={notificationSettings.wateringReminders}
                onValueChange={(value) => handleSettingChange('wateringReminders', value)}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
                thumbColor={notificationSettings.wateringReminders ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Disease Alerts</Text>
                <Text style={styles.settingDescription}>Important alerts about plant health issues</Text>
              </View>
              <Switch
                value={notificationSettings.diseaseAlerts}
                onValueChange={(value) => handleSettingChange('diseaseAlerts', value)}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
                thumbColor={notificationSettings.diseaseAlerts ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Marketplace Updates</Text>
                <Text style={styles.settingDescription}>New products and deals in the marketplace</Text>
              </View>
              <Switch
                value={notificationSettings.marketplaceUpdates}
                onValueChange={(value) => handleSettingChange('marketplaceUpdates', value)}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
                thumbColor={notificationSettings.marketplaceUpdates ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Forum Replies</Text>
                <Text style={styles.settingDescription}>When someone replies to your forum posts</Text>
              </View>
              <Switch
                value={notificationSettings.forumReplies}
                onValueChange={(value) => handleSettingChange('forumReplies', value)}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
                thumbColor={notificationSettings.forumReplies ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>General Updates</Text>
                <Text style={styles.settingDescription}>App updates and general announcements</Text>
              </View>
              <Switch
                value={notificationSettings.generalUpdates}
                onValueChange={(value) => handleSettingChange('generalUpdates', value)}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
                thumbColor={notificationSettings.generalUpdates ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
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
  testButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
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
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusGreen: {
    backgroundColor: '#e8f5e8',
  },
  statusRed: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#d32f2f',
  },
  retryButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    lineHeight: 18,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
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
});