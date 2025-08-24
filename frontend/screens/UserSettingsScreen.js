import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import MainLayout from '../components/MainLayout';

const API_BASE = 'https://usersfunctions.azurewebsites.net/api';

export default function UserSettingsScreen({ navigation }) {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [busy, setBusy] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    wateringReminders: true,
    diseaseAlerts: true,
    marketplaceUpdates: false,
  });

  useEffect(() => {
    loadUserData();
    loadSettings();
  }, []);

  const loadUserData = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      const name = await AsyncStorage.getItem('userName');
      setUserEmail(email || '');
      setUserName(name || 'User');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('userSettings');
      if (savedSettings) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(savedSettings) }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const persistLocalSettings = async (next) => {
    setSettings(next);
    await AsyncStorage.setItem('userSettings', JSON.stringify(next));
  };


  const registerTokenWithBackend = async (token) => {
    if (!userEmail || !token) return;
    try {
      await fetch(`${API_BASE}/saveDeviceToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          userId: userEmail,
          token,
          platform: Platform.OS,
          app: 'greener',
          type: 'consumer',
        }),
      });
    } catch (e) {
      console.warn('saveDeviceToken failed:', e);
    }
  };

  const deleteLocalFcmTokens = async () => {
    try {
      const current = await messaging().getToken();
      if (current) {
        // Ensure push delivery stops and allow fresh token later
        await messaging().deleteToken();
      }
      await AsyncStorage.multiRemove([
        'fcm_token_web',
        'fcm_token_android',
        'fcm_token_ios',
      ]);
    } catch (e) {
      console.warn('deleteToken failed:', e);
    }
  };

  const ensurePermissionAndRegister = async () => {
    // Ask OS permission
    const authStatus = await messaging().requestPermission();
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!granted) {
      Alert.alert(
        'Notifications blocked',
        'To receive reminders and updates, enable notifications in system settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    // Android: ensure channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // 🔁 Force a fresh token: delete then get a new one
    try {
      await messaging().deleteToken();
    } catch {}

    const token = await messaging().getToken();
    await AsyncStorage.setItem(`fcm_token_${Platform.OS}`, token || '');
    await registerTokenWithBackend(token);

    return true;
    // (Optional) you could also subscribe to a topic here if you use them
  };

  const handleToggleNotifications = useCallback(
    async (value) => {
      setBusy(true);
      try {
        const next = { ...settings, notifications: value };

        if (value) {
          const ok = await ensurePermissionAndRegister(); // generates NEW token
          if (!ok) {
            // Revert if user declined permission
            const reverted = { ...settings, notifications: false };
            await persistLocalSettings(reverted);
            await syncNotificationPrefsToServer(reverted);
            return;
          }
        } else {
          await deleteLocalFcmTokens();
        }

        await persistLocalSettings(next);
        await syncNotificationPrefsToServer(next);
      } finally {
        setBusy(false);
      }
    },
    [settings, userEmail]
  );

  const handleSettingChange = async (key, value) => {
    const next = { ...settings, [key]: value };
    await persistLocalSettings(next);
    await syncNotificationPrefsToServer(next);
  };

  const openHelp = () => {
    Alert.alert(
      'Help & Support',
      'Need a hand? Reach us at dina2@gmail.com',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email Us',
          onPress: () =>
            Linking.openURL(
              'mailto:dina2@gmail.com?subject=Greener%20Support&body=Hi%20Greener%20team,%0A%0A'
            ),
        },
      ]
    );
  };

  const openSystemNotificationSettings = () => {
    Linking.openSettings();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearNotifications();
            await deleteLocalFcmTokens();
            await AsyncStorage.multiRemove([
              'userEmail',
              'userName',
              'currentUserId',
              'userSettings',
              'notificationSettings',
              'fcm_token_web',
              'fcm_token_android',
              'fcm_token_ios',
            ]);
            navigation.reset({
              index: 0,
              routes: [{ name: 'PersonaSelection' }],
            });
          } catch (error) {
            console.error('❌ Error during logout:', error);
            Alert.alert('Error', 'Failed to logout properly. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <MainLayout currentTab="home" navigation={navigation}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Account</Text>
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userInitial}>
                {(userName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName || 'User'}</Text>
              <Text style={styles.userEmail}>{userEmail || 'No email'}</Text>
            </View>
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Turn all notifications on/off
              </Text>
            </View>
            <Switch
              value={!!settings.notifications}
              onValueChange={handleToggleNotifications}
              disabled={busy}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={settings.notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Quick link to OS settings (helpful if permission denied) */}
          <TouchableOpacity style={styles.menuItem} onPress={openSystemNotificationSettings}>
            <MaterialIcons name="app-settings-alt" size={24} color="#4CAF50" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>System Notification Settings</Text>
              <Text style={styles.menuItemSubtitle}>Open phone app settings</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ App Settings</Text>

        {/* Language row removed */}

          <TouchableOpacity style={styles.menuItem} onPress={openHelp}>
            <MaterialIcons name="help" size={24} color="#4CAF50" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Help & Support</Text>
              <Text style={styles.menuItemSubtitle}>Contact support</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setAboutOpen(true)}>
            <MaterialIcons name="info" size={24} color="#4CAF50" />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>About</Text>
              <Text style={styles.menuItemSubtitle}>What is Greener?</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#f44336" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* About Modal */}
      <Modal visible={aboutOpen} transparent animationType="slide" onRequestClose={() => setAboutOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.aboutTitle}>About Greener</Text>
            <Text style={styles.aboutBody}>
              Greener is designed to make plant care effortless - so your space stays healthy, happy, and, well… greener.
            </Text>

            <View style={styles.bulletRow}>
              <MaterialIcons name="local-florist" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Personalized care schedules (watering, feeding, repotting)</Text>
            </View>
            <View style={styles.bulletRow}>
              <MaterialIcons name="wb-sunny" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Weather-aware tips that adapt to your environment</Text>
            </View>
            <View style={styles.bulletRow}>
              <MaterialIcons name="chat" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Community Q&A with real growers and local shops</Text>
            </View>
            <View style={styles.bulletRow}>
              <MaterialIcons name="notifications-active" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Smart reminders so you never miss a care task</Text>
            </View>

            <Text style={[styles.aboutBody, { marginTop: 8 }]}>
              Whether you’re nurturing your first succulent or managing a jungle, Greener helps you connect with your plants and your surroundings—one small habit at a time.
            </Text>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setAboutOpen(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#4CAF50' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0',
  },
  userAvatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  userInitial: { color: '#fff', fontSize: 20, fontWeight: '600' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  userEmail: { fontSize: 14, color: '#666' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0',
  },
  menuItemContent: { flex: 1, marginLeft: 12 },
  menuItemTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  menuItemSubtitle: { fontSize: 14, color: '#666' },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  settingDescription: { fontSize: 14, color: '#666' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#ffcdd2',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#f44336', marginLeft: 8 },

  // About modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  aboutTitle: { fontSize: 18, fontWeight: '700', color: '#2e7d32', marginBottom: 8 },
  aboutBody: { fontSize: 14, color: '#444', lineHeight: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  bulletText: { marginLeft: 10, color: '#333', flex: 1 },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: { color: '#fff', fontWeight: '600' },
});
