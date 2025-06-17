// Business/BusinessScreens/BusinessSettingsScreen.js - ENHANCED ANDROID OPTIMIZED & REAL BACKEND
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  StatusBar,
  Dimensions,
  BackHandler,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// FIXED: Import proper business services instead of manual API calls
import { 
  getBusinessProfile,
  createBusinessProfile
} from '../services/businessApi';

const { width, height } = Dimensions.get('window');

export default function BusinessSettingsScreen({ navigation, route }) {
  // ===== STATE MANAGEMENT - ANDROID OPTIMIZED =====
  const [settings, setSettings] = useState({
    notifications: {
      newOrders: true,
      lowStock: true,
      customerMessages: true,
      dailyReports: false,
      weeklyReports: true,
      emailNotifications: true,
      pushNotifications: true,
    },
    business: {
      businessName: '',
      businessType: 'nursery',
      description: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      address: {
        street: '',
        city: '',
        postalCode: '',
        country: 'United States',
      },
      businessHours: {
        monday: { open: '09:00', close: '17:00', isClosed: false },
        tuesday: { open: '09:00', close: '17:00', isClosed: false },
        wednesday: { open: '09:00', close: '17:00', isClosed: false },
        thursday: { open: '09:00', close: '17:00', isClosed: false },
        friday: { open: '09:00', close: '17:00', isClosed: false },
        saturday: { open: '10:00', close: '16:00', isClosed: false },
        sunday: { open: '10:00', close: '16:00', isClosed: false }, // FIXED: Remove default closed for Sunday
      },
      socialMedia: {
        website: '',
        instagram: '',
        facebook: '',
      },
    },
    inventory: {
      lowStockThreshold: 5,
      autoReorder: false,
      trackExpiry: true,
      autoUpdatePrices: false,
    },
    orders: {
      autoConfirm: false,
      requireDeposit: false,
      maxOrderQuantity: 100,
      orderTimeout: 24, // hours
      allowCancellation: true,
      sendConfirmationEmail: true,
    },
    privacy: {
      shareAnalytics: true,
      allowReviews: true,
      visibleInDirectory: true,
      showBusinessHours: true,
      showContactInfo: true,
      allowDirectMessages: true,
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('notifications');
  const [businessId, setBusinessId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [error, setError] = useState(null);
  const [networkConnected, setNetworkConnected] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);
  
  // ===== ANIMATION REFS - ANDROID OPTIMIZED =====
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const saveAnim = useRef(new Animated.Value(0)).current;
  
  // ===== AUTO-REFRESH TIMER =====
  const refreshTimer = useRef(null);
  const autoRefreshInterval = 60000; // 60 seconds for settings

  // ===== ANDROID BACK HANDLER =====
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (hasUnsavedChanges) {
          Alert.alert(
            'Unsaved Changes',
            'You have unsaved changes. Save before leaving?',
            [
              { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
              { text: 'Cancel', style: 'cancel' },
              { text: 'Save', onPress: () => saveSettings().then(() => navigation.goBack()) }
            ]
          );
          return true;
        }
        navigation.goBack();
        return true;
      };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
    }, [hasUnsavedChanges, navigation])
  );

  // ===== FOCUS EFFECT FOR INITIALIZATION =====
  useFocusEffect(
    useCallback(() => {
      console.log('⚙️ BusinessSettingsScreen focused - loading settings...');
      initializeSettings();
      setupAutoRefresh();
      startEntranceAnimation();
      
      return () => {
        console.log('⚙️ BusinessSettingsScreen unfocused - cleanup...');
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    }, [])
  );

  // ===== ENTRANCE ANIMATION - ANDROID OPTIMIZED =====
  const startEntranceAnimation = useCallback(() => {
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

  // ===== INITIALIZE SETTINGS =====
  const initializeSettings = useCallback(async () => {
    try {
      console.log('📱 Initializing business settings...');
      setIsLoading(true);
      setError(null);
      
      // Get business info
      const [email, storedBusinessId] = await Promise.all([
        AsyncStorage.getItem('userEmail'),
        AsyncStorage.getItem('businessId')
      ]);
      
      console.log('📊 Business data loaded:', { email, storedBusinessId });
      
      if (!email) {
        console.warn('⚠️ No user email found');
        navigation.replace('Login');
        return;
      }
      
      setUserEmail(email);
      const currentBusinessId = route.params?.businessId || storedBusinessId || email;
      setBusinessId(currentBusinessId);
      
      // Load settings from backend
      await loadSettings(currentBusinessId);
      
    } catch (error) {
      console.error('❌ Error initializing settings:', error);
      setError('Failed to initialize settings');
    } finally {
      setIsLoading(false);
    }
  }, [route.params]);

  // ===== AUTO-REFRESH SETUP =====
  const setupAutoRefresh = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
    
    refreshTimer.current = setInterval(() => {
      if (!isSaving && networkConnected && businessId) {
        console.log('🔄 Auto-refreshing settings...');
        loadSettings(businessId, true); // Silent refresh
      }
    }, autoRefreshInterval);
    
    console.log(`⏰ Settings auto-refresh set up for every ${autoRefreshInterval/1000} seconds`);
  }, [isSaving, networkConnected, businessId]);

  // ===== LOAD SETTINGS - REAL BACKEND ONLY =====
  const loadSettings = useCallback(async (currentBusinessId, silentRefresh = false) => {
    if (!currentBusinessId) {
      console.log('⏳ Business ID not ready yet...');
      return;
    }
    
    try {
      console.log('📡 Loading REAL settings for business:', currentBusinessId);
      // Directly load from backend, no health check
      try {
        const profileData = await getBusinessProfile(currentBusinessId);
        console.log('✅ REAL Business profile loaded:', Object.keys(profileData));
        // Map backend data to settings structure
        const mappedSettings = {
          notifications: {
            newOrders: profileData.settings?.notifications ?? true,
            lowStock: profileData.settings?.lowStockThreshold !== undefined,
            customerMessages: profileData.settings?.Messages ?? true,
            dailyReports: false,
            weeklyReports: true,
            emailNotifications: true,
            pushNotifications: profileData.settings?.notifications ?? true,
          },
          business: {
            businessName: profileData.businessName || '',
            businessType: profileData.businessType || 'nursery',
            description: profileData.description || '',
            contactEmail: profileData.contactEmail || profileData.email || '',
            contactPhone: profileData.contactPhone || '',
            website: profileData.socialMedia?.website || '',
            address: {
              street: profileData.address?.street || '',
              city: profileData.address?.city || '',
              postalCode: profileData.address?.postalCode || '',
              country: profileData.address?.country || 'United States',
            },
            businessHours: profileData.businessHours || settings.business.businessHours,
            socialMedia: {
              website: profileData.socialMedia?.website || '',
              instagram: profileData.socialMedia?.instagram || '',
              facebook: profileData.socialMedia?.facebook || '',
            },
          },
          inventory: {
            lowStockThreshold: profileData.settings?.lowStockThreshold || 5,
            autoReorder: false,
            trackExpiry: true,
            autoUpdatePrices: false,
          },
          orders: {
            autoConfirm: false,
            requireDeposit: false,
            maxOrderQuantity: 100,
            orderTimeout: 24,
            allowCancellation: true,
            sendConfirmationEmail: true,
          },
          privacy: {
            shareAnalytics: true,
            allowReviews: profileData.isVerified ?? true,
            visibleInDirectory: true,
            showBusinessHours: true,
            showContactInfo: true,
            allowDirectMessages: profileData.settings?.Messages ?? true,
          }
        };
        setSettings(mappedSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(mappedSettings)));
        setHasUnsavedChanges(false);
        // Cache the settings
        await AsyncStorage.setItem('businessSettings', JSON.stringify(mappedSettings));
        if (!silentRefresh) {
          Animated.sequence([
            Animated.timing(saveAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(saveAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]).start();
        }
      } catch (err) {
        console.error('❌ Error loading REAL settings:', err);
        setNetworkConnected(false);
        // Error categorization and user messaging
        let errorMessage = 'Unable to load settings';
        let useCache = false;
        if (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('timeout')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
          useCache = true;
        } else if (err.message.includes('401') || err.message.includes('403')) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else {
          errorMessage = err.message || 'An unexpected error occurred';
          useCache = true;
        }
        // Try to load cached settings as fallback
        if (useCache) {
          try {
            const cachedSettings = await AsyncStorage.getItem('businessSettings');
            if (cachedSettings && !silentRefresh) {
              console.log('📱 Loading settings from cache as fallback...');
              const parsed = JSON.parse(cachedSettings);
              setSettings(parsed);
              setOriginalSettings(JSON.parse(JSON.stringify(parsed)));
              setHasUnsavedChanges(false);
              
              Alert.alert(
                'Offline Mode', 
                'Using cached settings. Some features may be limited until reconnected.',
                [{ text: 'OK', style: 'default' }]
              );
              return;
            }
          } catch (cacheError) {
            console.warn('Failed to load cached settings:', cacheError);
          }
        }
        if (!silentRefresh) {
          setError(errorMessage);
        }
      }
    } catch (error) {
      setError('Unable to load settings');
    }
  }, [settings.business.businessHours, saveAnim]);

  // ===== SAVE SETTINGS - REAL BACKEND ONLY =====
  const saveSettings = useCallback(async () => {
    if (!businessId) {
      Alert.alert('Error', 'Business ID not found');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      console.log('💾 Saving REAL settings to backend...');
      // No health check, just try to save
      const businessProfileData = {
        id: businessId,
        email: userEmail,
        businessName: settings.business.businessName,
        businessType: settings.business.businessType,
        description: settings.business.description,
        contactEmail: settings.business.contactEmail,
        contactPhone: settings.business.contactPhone,
        address: settings.business.address,
        businessHours: settings.business.businessHours,
        socialMedia: settings.business.socialMedia,
        settings: {
          notifications: settings.notifications.pushNotifications,
          Messages: settings.privacy.allowDirectMessages,
          lowStockThreshold: settings.inventory.lowStockThreshold,
        },
        isVerified: settings.privacy.allowReviews,
      };
      
      // Save to REAL backend
      const result = await createBusinessProfile(businessProfileData);
      console.log('✅ Settings saved to backend successfully:', result);
      
      // Save to local storage as cache
      await AsyncStorage.setItem('businessSettings', JSON.stringify(settings));
      await AsyncStorage.setItem('businessProfile', JSON.stringify(businessProfileData));
      
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      setHasUnsavedChanges(false);
      setLastSavedTime(new Date());
      
      // Success animation
      Animated.sequence([
        Animated.timing(saveAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(saveAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
      Alert.alert('✅ Success', 'Settings saved successfully!');
      
    } catch (error) {
      console.error('❌ Error saving REAL settings:', error);
      setNetworkConnected(false);
      
      const errorMessage = error.message.includes('network') || error.message.includes('fetch') 
        ? 'Network connection failed. Please check your internet connection.'
        : error.message.includes('401') || error.message.includes('403')
        ? 'Authentication failed. Please log in again.'
        : error.message || 'Failed to save settings';
      
      Alert.alert('❌ Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [businessId, userEmail, settings]);

  // ===== HANDLE SETTING CHANGE =====
  const handleSettingChange = useCallback((section, key, value, subKey = null) => {
    setSettings(prev => {
      let newSettings;
      if (subKey) {
        newSettings = {
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
        newSettings = {
          ...prev,
          [section]: {
            ...prev[section],
            [key]: value
          }
        };
      }
      
      // Check if settings have changed
      const hasChanges = JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
      setHasUnsavedChanges(hasChanges);
      
      return newSettings;
    });
  }, [originalSettings]);

  // ===== HANDLE BUSINESS HOURS CHANGE =====
  const handleBusinessHoursChange = useCallback((day, field, value) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        business: {
          ...prev.business,
          businessHours: {
            ...prev.business.businessHours,
            [day]: {
              ...prev.business.businessHours[day],
              [field]: value
            }
          }
        }
      };
      
      const hasChanges = JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
      setHasUnsavedChanges(hasChanges);
      
      return newSettings;
    });
  }, [originalSettings]);

  // ===== HANDLE RESET SETTINGS =====
  const handleResetSettings = useCallback(() => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to their last saved values? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (originalSettings) {
              setSettings(JSON.parse(JSON.stringify(originalSettings)));
              setHasUnsavedChanges(false);
              Alert.alert('Settings Reset', 'All settings have been reset to their saved values');
            }
          }
        }
      ]
    );
  }, [originalSettings]);

  // ===== REAL LOGOUT FUNCTIONALITY =====
  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your business account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              console.log('🚪 Signing out business user...');
              
              // Clear all stored business data
              await Promise.all([
                AsyncStorage.removeItem('userEmail'),
                AsyncStorage.removeItem('businessId'),
                AsyncStorage.removeItem('userType'),
                AsyncStorage.removeItem('isBusinessUser'),
                AsyncStorage.removeItem('businessProfile'),
                AsyncStorage.removeItem('businessSettings'),
                AsyncStorage.removeItem('googleAuthToken'),
                AsyncStorage.removeItem('userName')
              ]);
              
              console.log('✅ Business user signed out successfully');
              
              // Navigate to welcome screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'PersonaSelection' }]
              });
              
            } catch (error) {
              console.error('❌ Error during logout:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  }, [navigation]);

  // ===== REAL NAVIGATION HANDLERS =====
  const handleBusinessProfileEdit = useCallback(() => {
    navigation.navigate('BusinessProfileScreen', { businessId });
  }, [businessId, navigation]);

  const handleNotificationSettings = useCallback(() => {
    navigation.navigate('NotificationSettingsScreen', { businessId });
  }, [businessId, navigation]);

  const handleBusinessAnalytics = useCallback(() => {
    navigation.navigate('BusinessAnalyticsScreen', { businessId });
  }, [businessId, navigation]);

  const handleCustomerManagement = useCallback(() => {
    navigation.navigate('CustomerListScreen', { businessId });
  }, [businessId, navigation]);

  const handleInventoryManagement = useCallback(() => {
    navigation.navigate('AddInventoryScreen', { 
      businessId,
      showInventory: true 
    });
  }, [businessId, navigation]);

  const handleOrderManagement = useCallback(() => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  }, [businessId, navigation]);

  // ===== RENDER SECTION TABS =====
  const renderSectionTabs = () => {
    const sections = [
      { key: 'notifications', label: 'Notifications', icon: 'notifications' },
      { key: 'business', label: 'Business', icon: 'business' },
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
              activeOpacity={0.7}
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

  // ===== RENDER NOTIFICATIONS SETTINGS =====
  const renderNotificationsSettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="notifications" size={20} color="#4CAF50" />
        {' '}Push Notifications
      </Text>
      
      {Object.entries(settings.notifications).map(([key, value]) => (
        <View key={key} style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>
              {key === 'newOrders' && 'New Orders'}
              {key === 'lowStock' && 'Low Stock Alerts'}
              {key === 'customerMessages' && 'Customer Messages'}
              {key === 'dailyReports' && 'Daily Reports'}
              {key === 'weeklyReports' && 'Weekly Reports'}
              {key === 'emailNotifications' && 'Email Notifications'}
              {key === 'pushNotifications' && 'Push Notifications'}
            </Text>
            <Text style={styles.settingDescription}>
              {key === 'newOrders' && 'Get notified when new orders arrive'}
              {key === 'lowStock' && 'Alert when inventory runs low'}
              {key === 'customerMessages' && 'Notify when customers send messages'}
              {key === 'dailyReports' && 'Daily business summary reports'}
              {key === 'weeklyReports' && 'Weekly business performance reports'}
              {key === 'emailNotifications' && 'Receive notifications via email'}
              {key === 'pushNotifications' && 'Enable all push notifications'}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={(newValue) => handleSettingChange('notifications', key, newValue)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor={value ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#ddd"
          />
        </View>
      ))}
    </View>
  );

  // ===== RENDER BUSINESS SETTINGS =====
  const renderBusinessSettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="business" size={20} color="#4CAF50" />
        {' '}Business Information
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Name *</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.businessName}
          onChangeText={(value) => handleSettingChange('business', 'businessName', value)}
          placeholder="Your business name"
          placeholderTextColor="#999"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Type</Text>
        <View style={styles.businessTypeContainer}>
          {['nursery', 'garden center', 'tool supplier', 'landscape service', 'other'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.businessTypeOption,
                settings.business.businessType === type && styles.businessTypeSelected
              ]}
              onPress={() => handleSettingChange('business', 'businessType', type)}
            >
              <Text style={[
                styles.businessTypeText,
                settings.business.businessType === type && styles.businessTypeSelectedText
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={settings.business.description}
          onChangeText={(value) => handleSettingChange('business', 'description', value)}
          placeholder="Describe your business..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contact Email *</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.contactEmail}
          onChangeText={(value) => handleSettingChange('business', 'contactEmail', value)}
          placeholder="business@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contact Phone</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.contactPhone}
          onChangeText={(value) => handleSettingChange('business', 'contactPhone', value)}
          placeholder="+1 (555) 123-4567"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />
      </View>
      
      <Text style={styles.sectionSubtitle}>Address</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Street Address</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.address.street}
          onChangeText={(value) => handleSettingChange('business', 'address', value, 'street')}
          placeholder="123 Main Street"
          placeholderTextColor="#999"
        />
      </View>
      
      <View style={styles.addressRow}>
        <View style={styles.addressInput}>
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.textInput}
            value={settings.business.address.city}
            onChangeText={(value) => handleSettingChange('business', 'address', value, 'city')}
            placeholder="City"
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.addressInput}>
          <Text style={styles.inputLabel}>Postal Code</Text>
          <TextInput
            style={styles.textInput}
            value={settings.business.address.postalCode}
            onChangeText={(value) => handleSettingChange('business', 'address', value, 'postalCode')}
            placeholder="12345"
            placeholderTextColor="#999"
          />
        </View>
      </View>
      
      <Text style={styles.sectionSubtitle}>Social Media</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Website</Text>
        <TextInput
          style={styles.textInput}
          value={settings.business.socialMedia.website}
          onChangeText={(value) => handleSettingChange('business', 'socialMedia', value, 'website')}
          placeholder="https://your-website.com"
          placeholderTextColor="#999"
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.socialRow}>
        <View style={styles.socialInput}>
          <Text style={styles.inputLabel}>Instagram</Text>
          <TextInput
            style={styles.textInput}
            value={settings.business.socialMedia.instagram}
            onChangeText={(value) => handleSettingChange('business', 'socialMedia', value, 'instagram')}
            placeholder="@username"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.socialInput}>
          <Text style={styles.inputLabel}>Facebook</Text>
          <TextInput
            style={styles.textInput}
            value={settings.business.socialMedia.facebook}
            onChangeText={(value) => handleSettingChange('business', 'socialMedia', value, 'facebook')}
            placeholder="Page name"
            placeholderTextColor="#999"
          />
        </View>
      </View>
      
      <Text style={styles.sectionSubtitle}>Business Hours</Text>
      {Object.entries(settings.business.businessHours).map(([day, hours]) => (
        <View key={day} style={styles.businessHourItem}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
            <Switch
              value={!hours.isClosed}
              onValueChange={(value) => handleBusinessHoursChange(day, 'isClosed', !value)}
              trackColor={{ false: '#ddd', true: '#4CAF50' }}
              thumbColor={!hours.isClosed ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#ddd"
            />
          </View>
          {!hours.isClosed && (
            <View style={styles.hoursInputs}>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>Open</Text>
                <TextInput
                  style={styles.timeTextInput}
                  value={hours.open}
                  onChangeText={(value) => handleBusinessHoursChange(day, 'open', value)}
                  placeholder="09:00"
                  placeholderTextColor="#999"
                />
              </View>
              <Text style={styles.timeSeparator}>-</Text>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>Close</Text>
                <TextInput
                  style={styles.timeTextInput}
                  value={hours.close}
                  onChangeText={(value) => handleBusinessHoursChange(day, 'close', value)}
                  placeholder="17:00"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  // ===== RENDER INVENTORY SETTINGS =====
  const renderInventorySettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="inventory" size={20} color="#4CAF50" />
        {' '}Inventory Management
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Low Stock Threshold</Text>
        <TextInput
          style={styles.textInput}
          value={settings.inventory.lowStockThreshold.toString()}
          onChangeText={(value) => handleSettingChange('inventory', 'lowStockThreshold', parseInt(value) || 5)}
          placeholder="5"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
        <Text style={styles.inputHint}>Alert when stock falls below this number</Text>
      </View>
      
      {Object.entries(settings.inventory)
        .filter(([key]) => key !== 'lowStockThreshold' && key !== 'enableBarcode') // Remove barcode toggle
        .map(([key, value]) => (
        <View key={key} style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>
              {key === 'autoReorder' && 'Auto Reorder'}
              {key === 'trackExpiry' && 'Track Expiry Dates'}
              {key === 'autoUpdatePrices' && 'Auto Update Prices'}
            </Text>
            <Text style={styles.settingDescription}>
              {key === 'autoReorder' && 'Automatically create reorder suggestions'}
              {key === 'trackExpiry' && 'Monitor product expiration dates'}
              {key === 'autoUpdatePrices' && 'Update prices based on market data'}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={(newValue) => handleSettingChange('inventory', key, newValue)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor={value ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#ddd"
          />
        </View>
      ))}
    </View>
  );

  // ===== RENDER ORDERS SETTINGS =====
  const renderOrdersSettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="receipt" size={20} color="#4CAF50" />
        {' '}Order Management
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Max Order Quantity</Text>
        <TextInput
          style={styles.textInput}
          value={settings.orders.maxOrderQuantity.toString()}
          onChangeText={(value) => handleSettingChange('orders', 'maxOrderQuantity', parseInt(value) || 100)}
          placeholder="100"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
        <Text style={styles.inputHint}>Maximum items per order</Text>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Order Timeout (hours)</Text>
        <TextInput
          style={styles.textInput}
          value={settings.orders.orderTimeout.toString()}
          onChangeText={(value) => handleSettingChange('orders', 'orderTimeout', parseInt(value) || 24)}
          placeholder="24"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
        <Text style={styles.inputHint}>Cancel unpaid orders after this time</Text>
      </View>
      
      {Object.entries(settings.orders).filter(([key]) => !['maxOrderQuantity', 'orderTimeout'].includes(key)).map(([key, value]) => (
        <View key={key} style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>
              {key === 'autoConfirm' && 'Auto Confirm Orders'}
              {key === 'requireDeposit' && 'Require Deposit'}
              {key === 'allowCancellation' && 'Allow Order Cancellation'}
              {key === 'sendConfirmationEmail' && 'Send Confirmation Emails'}
            </Text>
            <Text style={styles.settingDescription}>
              {key === 'autoConfirm' && 'Automatically confirm new orders'}
              {key === 'requireDeposit' && 'Require deposit for large orders'}
              {key === 'allowCancellation' && 'Allow customers to cancel orders'}
              {key === 'sendConfirmationEmail' && 'Email order confirmations to customers'}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={(newValue) => handleSettingChange('orders', key, newValue)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor={value ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#ddd"
          />
        </View>
      ))}
    </View>
  );

  // ===== RENDER PRIVACY SETTINGS =====
  const renderPrivacySettings = () => (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="security" size={20} color="#4CAF50" />
        {' '}Privacy & Visibility
      </Text>
      
      {Object.entries(settings.privacy).map(([key, value]) => (
        <View key={key} style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>
              {key === 'shareAnalytics' && 'Share Analytics'}
              {key === 'allowReviews' && 'Allow Customer Reviews'}
              {key === 'visibleInDirectory' && 'Visible in Directory'}
              {key === 'showBusinessHours' && 'Show Business Hours'}
              {key === 'showContactInfo' && 'Show Contact Information'}
              {key === 'allowDirectMessages' && 'Allow Direct Messages'}
            </Text>
            <Text style={styles.settingDescription}>
              {key === 'shareAnalytics' && 'Share anonymous analytics to improve services'}
              {key === 'allowReviews' && 'Allow customers to leave reviews'}
              {key === 'visibleInDirectory' && 'Show business in public directory'}
              {key === 'showBusinessHours' && 'Display business hours publicly'}
              {key === 'showContactInfo' && 'Show contact information to customers'}
              {key === 'allowDirectMessages' && 'Allow customers to message you directly'}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={(newValue) => handleSettingChange('privacy', key, newValue)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor={value ? '#fff' : '#f4f3f4'}
            ios_backgroundColor="#ddd"
          />
        </View>
      ))}

      {/* ADDED: Quick Action Buttons Section */}
      <Text style={styles.sectionSubtitle}>Quick Actions</Text>
      
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleBusinessProfileEdit}
      >
        <MaterialIcons name="edit" size={20} color="#2196F3" />
        <Text style={styles.actionButtonText}>Edit Business Profile</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleNotificationSettings}
      >
        <MaterialIcons name="notifications" size={20} color="#FF9800" />
        <Text style={styles.actionButtonText}>Notification Settings</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleBusinessAnalytics}
      >
        <MaterialIcons name="analytics" size={20} color="#9C27B0" />
        <Text style={styles.actionButtonText}>Business Analytics</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleCustomerManagement}
      >
        <MaterialIcons name="people" size={20} color="#4CAF50" />
        <Text style={styles.actionButtonText}>Customer Management</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleInventoryManagement}
      >
        <MaterialIcons name="inventory" size={20} color="#607D8B" />
        <Text style={styles.actionButtonText}>Inventory Management</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleOrderManagement}
      >
        <MaterialIcons name="receipt" size={20} color="#795548" />
        <Text style={styles.actionButtonText}>Order Management</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
      </TouchableOpacity>

      {/* ADDED: Reset and Logout Buttons */}
      <Text style={styles.sectionSubtitle}>Account Actions</Text>
      
      <TouchableOpacity 
        style={[styles.actionButton, styles.dangerButton]}
        onPress={handleResetSettings}
      >
        <MaterialIcons name="refresh" size={20} color="#FF5722" />
        <Text style={[styles.actionButtonText, styles.dangerText]}>Reset All Settings</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#FF5722" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, styles.logoutButton]}
        onPress={handleLogout}
      >
        <MaterialIcons name="logout" size={20} color="#F44336" />
        <Text style={[styles.actionButtonText, styles.logoutText]}>Sign Out</Text>
        <MaterialIcons name="arrow-forward-ios" size={16} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  // ===== RENDER ACTIVE SECTION =====
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'notifications':
        return renderNotificationsSettings();
      case 'business':
        return renderBusinessSettings();
      case 'inventory':
        return renderInventorySettings();
      case 'orders':
        return renderOrdersSettings();
      case 'privacy':
        return renderPrivacySettings();
      default:
        return renderNotificationsSettings();
    }
  };

  // ===== LOADING STATE - ANDROID OPTIMIZED =====
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#f8f9fa" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ rotate: saveAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }) }] }}>
            <MaterialIcons name="settings" size={60} color="#4CAF50" />
          </Animated.View>
          <Text style={styles.loadingText}>Loading business settings...</Text>
          <Text style={styles.loadingSubtext}>Getting your preferences from backend</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== ERROR STATE - ANDROID OPTIMIZED =====
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#f8f9fa" barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="cloud-off" size={48} color="#f44336" />
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadSettings(businessId)}>
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      {/* ===== HEADER ===== */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Settings</Text>
          <View style={styles.headerRight} />
        </View>
      </Animated.View>

      {/* ===== NETWORK STATUS ===== */}
      {!networkConnected && (
        <View style={styles.networkBanner}>
          <MaterialIcons name="cloud-off" size={16} color="#fff" />
          <Text style={styles.networkBannerText}>Offline - Changes will be saved when reconnected</Text>
        </View>
      )}

      {/* ===== SECTION TABS ===== */}
      {renderSectionTabs()}

      {/* ===== CONTENT ===== */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.ScrollView
          style={[styles.content, { opacity: fadeAnim }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderActiveSection()}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* ===== SAVE BUTTON ===== */}
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
          style={[
            styles.saveButton, 
            isSaving && styles.saveButtonDisabled,
            hasUnsavedChanges && styles.saveButtonActive
          ]}
          onPress={saveSettings}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ scale: saveAnim }] }}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="save" size={20} color="#fff" />
            )}
          </Animated.View>
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Text>
        </TouchableOpacity>
        
        {lastSavedTime && (
          <Text style={styles.lastSavedText}>
            Last saved: {lastSavedTime.toLocaleTimeString()}
          </Text>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ===== ANDROID OPTIMIZED STYLES =====
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
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
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 48,
  },
  unsavedIndicator: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  networkBanner: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  networkBannerText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
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
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    lineHeight: 18,
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
  businessTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  businessTypeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  businessTypeSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  businessTypeText: {
    fontSize: 12,
    color: '#666',
  },
  businessTypeSelectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInput: {
    flex: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialInput: {
    flex: 1,
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButton: {
    backgroundColor: '#9E9E9E',
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
  saveButtonActive: {
    backgroundColor: '#4CAF50',
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
  lastSavedText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  dangerButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  dangerText: {
    color: '#D32F2F',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  logoutText: {
    color: '#D32F2F',
    fontWeight: '600',
  },
});