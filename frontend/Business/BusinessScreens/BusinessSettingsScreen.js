// Business/BusinessScreens/BusinessSettingsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BusinessSettingsScreen({ navigation, route }) {
  // Core state
  const [settings, setSettings] = useState({
    notifications: {
      newOrders: true,
      lowStock: true,
      customerMessages: true,
      dailyReports: false,
      weeklyReports: true,
    },
    business: {
      businessName: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      businessHours: {
        monday: { open: '09:00', close: '17:00', isClosed: false },
        tuesday: { open: '09:00', close: '17:00', isClosed: false },
        wednesday: { open: '09:00', close: '17:00', isClosed: false },
        thursday: { open: '09:00', close: '17:00', isClosed: false },
        friday: { open: '09:00', close: '17:00', isClosed: false },
        saturday: { open: '10:00', close: '16:00', isClosed: false },
        sunday: { open: '10:00', close: '16:00', isClosed: true },
      },
    },
    inventory: {
      lowStockThreshold: 5,
      autoReorder: false,
      trackExpiry: true,
    },
    orders: {
      autoConfirm: false,
      requireDeposit: false,
      maxOrderQuantity: 100,
      orderTimeout: 24, // hours
    },
    privacy: {
      shareAnalytics: true,
      allowReviews: true,
      visibleInDirectory: true,
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('notifications');
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Initialize
  useEffect(() => {
    loadSettings();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  // Load settings from storage
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // Load from AsyncStorage
      const savedSettings = await AsyncStorage.getItem('businessSettings');
      const businessProfile = await AsyncStorage.getItem('businessProfile');
      
      if (savedSettings) {
        setSettings(prev => ({
          ...prev,
          ...JSON.parse(savedSettings)
        }));
      }
      
      if (businessProfile) {
        const profile = JSON.parse(businessProfile);
        setSettings(prev => ({
          ...prev,
          business: {
            ...prev.business,
            businessName: profile.businessName || '',
            contactEmail: profile.email || '',
            contactPhone: profile.contactPhone || '',
            address: profile.address || '',
          }
        }));
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('businessSettings', JSON.stringify(settings));
      
      // Here you would also call your API to save settings to the backend
      // await updateBusinessSettings(settings);
      
      Alert.alert('✅ Success', 'Settings saved successfully!');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle setting change
  const handleSettingChange = (section, key, value, subKey = null) => {
    setSettings(prev => {
      if (subKey) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [key]: {
              ...prev[section][key],
              [subKey]: value
            }
          }
        };
      } else {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [key]: value
          }
        };
      }
    });
  };

  // Handle reset settings
  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            // Reset to default settings
            loadSettings();
            Alert.alert('Settings Reset', 'All settings have been reset to default values');
          }
        }
      ]
    );
  };

  // Render section tabs
  const renderSectionTabs = () => {
    const sections = [
      { key: 'notifications', label: 'Notifications', icon: 'notifications' },
      { key: 'business', label: 'Business Info', icon: 'business' },
      { key: 'inventory', label: 'Inventory', icon: 'inventory' },
      { key: 'orders', label: 'Orders', icon: 'receipt' },
      { key: 'privacy', label: 'Privacy', icon: 'security' },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={styles.tabs}>
          {sections.map((section) => (
            <TouchableOpacity
              key={section.key}
              style={[
                styles.tab,
                activeSection === section.key && styles.activeTab
              ]}
              onPress={() => setActiveSection(section.key)}
            >
              <MaterialIcons 
                name={section.icon} 
                size={20} 
                color={activeSection === section.key ? '#4CAF50' : '#666'} 
              />
              <Text style={[
                styles.tabText,
                activeSection === section.key && styles.activeTabText
              ]}>
                {section.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  // Render notifications settings
  const renderNotificationsSettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>Push Notifications</Text>
      
      {Object.entries(settings.notifications).map(([key, value]) => (
        <View key={key} style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>
              {key === 'newOrders' && 'New Orders'}
              {key === 'lowStock' && 'Low Stock Alerts'}
              {key === 'customerMessages' && 'Customer Messages'}
              {key === 'dailyReports' && 'Daily Reports'}
              {key === 'weeklyReports' && 'Weekly Reports'}
            </Text>
            <Text style={styles.settingDescription}>
              {key === 'newOrders' && 'Get notified when new orders arrive'}
              {key === 'lowStock' && 'Alert when inventory runs low'}
              {key === 'customerMessages' && 'Notify when customers send messages'}
              {key === 'dailyReports' && 'Daily business summary reports'}
              {key === 'weeklyReports' && 'Weekly business performance reports'}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={(newValue) => handleSettingChange('notifications', key, newValue)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor={value ? '#fff' : '#f4f3f4'}
          />
        </View>
      ))}
    </View>
  );

  // Render business info settings
  const renderBusinessSettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>Business Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Name</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.businessName}
          onChangeText={(value) => handleSettingChange('business', 'businessName', value)}
          placeholder="Your business name"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contact Email</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.contactEmail}
          onChangeText={(value) => handleSettingChange('business', 'contactEmail', value)}
          placeholder="business@example.com"
          keyboardType="email-address"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contact Phone</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.contactPhone}
          onChangeText={(value) => handleSettingChange('business', 'contactPhone', value)}
          placeholder="+1 (555) 123-4567"
          keyboardType="phone-pad"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Address</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={settings.business.address}
          onChangeText={(value) => handleSettingChange('business', 'address', value)}
          placeholder="Enter your business address"
          multiline
          numberOfLines={3}
        />
      </View>
      
      <Text style={styles.sectionSubtitle}>Business Hours</Text>
      {Object.entries(settings.business.businessHours).map(([day, hours]) => (
        <View key={day} style={styles.businessHourItem}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
            <Switch
              value={!hours.isClosed}
              onValueChange={(value) => handleSettingChange('business', 'businessHours', !value, day, 'isClosed')}
              trackColor={{ false: '#ddd', true: '#4CAF50' }}
              thumbColor={!hours.isClosed ? '#fff' : '#f4f3f4'}
            />
          </View>
          {!hours.isClosed && (
            <View style={styles.hoursInputs}>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>Open</Text>
                <TextInput
                  style={styles.timeTextInput}
                  value={hours.open}
                  onChangeText={(value) => handleSettingChange('business', 'businessHours', value, day, 'open')}
                  placeholder="09:00"
                />
              </View>
              <Text style={styles.timeSeparator}>-</Text>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>Close</Text>
                <TextInput
                  style={styles.timeTextInput}
                  value={hours.close}
                  onChangeText={(value) => handleSettingChange('business', 'businessHours', value, day, 'close')}
                  placeholder="17:00"
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  // Render inventory settings
  const renderInventorySettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>Inventory Management</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Low Stock Threshold</Text>
        <TextInput
          style={styles.textInput}
          value={settings.inventory.lowStockThreshold.toString()}
          onChangeText={(value) => handleSettingChange('inventory', 'lowStockThreshold', parseInt(value) || 5)}
          placeholder="5"
          keyboardType="numeric"
        />
        <Text style={styles.inputHint}>Alert when stock falls below this number</Text>
      </View>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Auto Reorder</Text>
          <Text style={styles.settingDescription}>Automatically create reorder suggestions</Text>
        </View>
        <Switch
          value={settings.inventory.autoReorder}
          onValueChange={(value) => handleSettingChange('inventory', 'autoReorder', value)}
          trackColor={{ false: '#ddd', true: '#4CAF50' }}
          thumbColor={settings.inventory.autoReorder ? '#fff' : '#f4f3f4'}
        />
      </View>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Track Expiry Dates</Text>
          <Text style={styles.settingDescription}>Monitor product expiration dates</Text>
        </View>
        <Switch
          value={settings.inventory.trackExpiry}
          onValueChange={(value) => handleSettingChange('inventory', 'trackExpiry', value)}
          trackColor={{ false: '#ddd', true: '#4CAF50' }}
          thumbColor={settings.inventory.trackExpiry ? '#fff' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  // Render content based on active section
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'notifications':
        return renderNotificationsSettings();
      case 'business':
        return renderBusinessSettings();
      case 'inventory':
        return renderInventorySettings();
      // Add other sections as needed
      default:
        return renderNotificationsSettings();
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
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Business Settings</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleResetSettings}
        >
          <MaterialIcons name="restore" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </Animated.View>

      {/* Section Tabs */}
      {renderSectionTabs()}

      {/* Content */}
      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderActiveSection()}
      </Animated.ScrollView>

      {/* Save Button */}
      <Animated.View 
        style={[
          styles.footer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
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
      </Animated.View>
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
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
  },
  activeTab: {
    backgroundColor: '#f0f9f3',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  businessHourItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  hoursInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timeTextInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#fafafa',
  },
  timeSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});