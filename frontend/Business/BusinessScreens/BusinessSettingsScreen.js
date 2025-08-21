// Business/BusinessScreens/BusinessSettingsScreen.js
// One combined screen: Details by default + Notifications/Inventory/Orders tabs.
// Fixes: correct default tab, robust session handling w/ cached fallback,
// proper save payload, and correct update call signature.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  StatusBar, Image, Alert, Platform, ActivityIndicator, TextInput,
  Switch, KeyboardAvoidingView, Dimensions, Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import {
  getBusinessProfile,
  updateBusinessProfile,
  createBusinessProfile
} from '../services/businessApi';

const DEFAULT_BUSINESS_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

const CONTENT_MAX_WIDTH = 820;
const TABS = [
  { key: 'details', label: 'Details', icon: 'badge' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications' },
  { key: 'inventory', label: 'Inventory', icon: 'inventory' },
  { key: 'orders', label: 'Orders', icon: 'receipt' },
];

export default function BusinessSettingsScreen({ navigation, route }) {
  const [tab, setTab] = useState(route?.params?.initialTab || 'details');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  const saveAnim = useRef(new Animated.Value(0)).current;

  // ---------- load ----------
  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const email =
        route?.params?.userEmail ||
        (await AsyncStorage.getItem('userEmail'));

      const storedBusinessId =
        route?.params?.businessId ||
        (await AsyncStorage.getItem('businessId')) ||
        email;

      if (!email) {
        // fall back to cached profile if any
        const cachedStr = await AsyncStorage.getItem('businessProfile');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          setUserEmail(cached.email || null);
          setBusinessId(cached.id || null);
          setProfile(cached);
          setForm(JSON.parse(JSON.stringify(cached)));
          setError('You are offline or signed out. Using cached profile.');
          setIsLoading(false);
          return;
        }
        setError('No active session. Please sign in.');
        setIsLoading(false);
        return;
      }

      setUserEmail(email);
      setBusinessId(storedBusinessId);

      const data = await getBusinessProfile(storedBusinessId);
      const p = data?.business || data?.profile || data || {};
      const normalized = normalizeProfile(p, email, storedBusinessId);

      setProfile(normalized);
      setForm(JSON.parse(JSON.stringify(normalized)));
      await AsyncStorage.setItem('businessProfile', JSON.stringify(normalized));
    } catch (e) {
      console.warn('Load failed, trying cache:', e?.message);
      const cached = await AsyncStorage.getItem('businessProfile');
      if (cached) {
        const parsed = JSON.parse(cached);
        setProfile(parsed);
        setForm(JSON.parse(JSON.stringify(parsed)));
        setError('Using cached profile (offline).');
      } else {
        setError('Failed to load profile.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigation, route?.params]);

  useEffect(() => { load(); }, [load]);

  // ---------- helpers ----------
  function normalizeProfile(p, email, id) {
    // accept coords from either p.location or p.address
    const addr = p.address || {};
    const loc  = p.location || {};
    const addressOut = {
      street: addr.street || '',
      city: addr.city || '',
      postalCode: addr.postalCode || '',
      country: addr.country || 'Israel',
      latitude: addr.latitude ?? loc.latitude,
      longitude: addr.longitude ?? loc.longitude,
      formattedAddress: addr.formattedAddress || '',
    };

    return {
      id: p.id || id,
      email: p.email || email,
      businessName: p.businessName || 'My Business',
      businessType: p.businessType || 'Plant Business',
      description: p.description || '',
      contactPhone: p.contactPhone || p.phone || '',
      contactEmail: p.contactEmail || email,
      logo: p.logo || '',
      socialMedia: {
        instagram: p.socialMedia?.instagram || '',
        facebook: p.socialMedia?.facebook || '',
        website: p.socialMedia?.website || p.website || '',
      },
      address: addressOut,
      businessHours: p.businessHours || {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { open: '10:00', close: '16:00' },
      },
      settings: {
        notifications: {
          newOrders: !!(p.settings?.notifications ?? true),
          lowStock: p.settings?.lowStockThreshold !== undefined,
          customerMessages: !!(p.settings?.Messages ?? true),
          pushNotifications: !!(p.settings?.notifications ?? true),
        },
        inventory: {
          lowStockThreshold: p.settings?.lowStockThreshold ?? 5,
        },
        orders: {
          autoConfirm: p.settings?.autoConfirm ?? false,
          requireDeposit: p.settings?.requireDeposit ?? false,
          maxOrderQuantity: p.settings?.maxOrderQuantity ?? 100,
          orderTimeout: p.settings?.orderTimeout ?? 24,
          allowCancellation: p.settings?.allowCancellation ?? true,
          sendConfirmationEmail: p.settings?.sendConfirmationEmail ?? true,
        },
      },
      joinDate: p.joinDate || new Date().toISOString(),
      isVerified: !!p.isVerified,
    };
  }

  const setField = (path, value) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  // ---------- save ----------
  const buildSavePayload = () => ({
    id: form.id,
    email: userEmail,
    businessName: form.businessName,
    businessType: form.businessType,
    description: form.description,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    address: form.address,
    businessHours: form.businessHours,
    socialMedia: form.socialMedia,
    logo: form.logo,
    settings: {
      notifications: form.settings.notifications.pushNotifications,
      Messages: form.settings.notifications.customerMessages,
      lowStockThreshold: Number(form.settings.inventory.lowStockThreshold) || 5,
      autoConfirm: !!form.settings.orders.autoConfirm,
      requireDeposit: !!form.settings.orders.requireDeposit,
      maxOrderQuantity: Number(form.settings.orders.maxOrderQuantity) || 100,
      orderTimeout: Number(form.settings.orders.orderTimeout) || 24,
      allowCancellation: !!form.settings.orders.allowCancellation,
      sendConfirmationEmail: !!form.settings.orders.sendConfirmationEmail,
    },
    isVerified: !!form.isVerified,
  });

  const onSave = async () => {
    try {
      setIsSaving(true);
      const payload = buildSavePayload();

      // IMPORTANT: updateBusinessProfile expects ONLY the payload
      let res;
      if (typeof updateBusinessProfile === 'function') {
        res = await updateBusinessProfile(payload);
      } else {
        res = await createBusinessProfile(payload);
      }

      if (res && (res.success || res.updated || res.id || res.ok)) {
        setProfile(JSON.parse(JSON.stringify(form)));
        await AsyncStorage.setItem('businessProfile', JSON.stringify(form));
        setEdit(false);
        setLastSaved(new Date());
        Animated.sequence([
          Animated.timing(saveAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(saveAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();
        Alert.alert('Saved', 'Settings updated successfully.');
      } else {
        throw new Error('Backend rejected update');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- UI bits ----------
  const pickLogo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setField('logo', res.assets[0].uri);
      }
    } catch {
      Alert.alert('Image Picker', 'Could not open gallery.');
    }
  };

  const SectionHeader = ({ icon, title }) => (
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon} size={20} color="#4CAF50" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const DetailsTab = () => (
    <View style={styles.card}>
      <View style={styles.logoWrap}>
        <TouchableOpacity onPress={edit ? pickLogo : undefined} activeOpacity={edit ? 0.8 : 1}>
          <Image source={{ uri: form.logo || DEFAULT_BUSINESS_IMAGE }} style={styles.logo} />
          {edit && (
            <View style={styles.logoBadge}>
              <MaterialIcons name="camera-alt" size={18} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Business Name *</Text>
        {edit ? (
          <TextInput
            style={styles.input}
            value={form.businessName}
            onChangeText={(v) => setField('businessName', v)}
            placeholder="Business name"
          />
        ) : (
          <Text style={styles.value}>{profile.businessName}</Text>
        )}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Business Type</Text>
        {edit ? (
          <TextInput
            style={styles.input}
            value={form.businessType}
            onChangeText={(v) => setField('businessType', v)}
            placeholder="Plant Business"
          />
        ) : (
          <Text style={styles.value}>{profile.businessType}</Text>
        )}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>About</Text>
        {edit ? (
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.description}
            onChangeText={(v) => setField('description', v)}
            placeholder="Tell customers about your business…"
            multiline
            numberOfLines={4}
          />
        ) : (
          <Text style={styles.value}>{profile.description || 'No description provided'}</Text>
        )}
      </View>

      <SectionHeader icon="contact-phone" title="Contact Information" />
      <View style={styles.fieldRow}>
        <MaterialIcons name="email" size={18} color="#666" />
        {edit ? (
          <TextInput
            style={styles.inputRow}
            value={form.contactEmail}
            onChangeText={(v) => setField('contactEmail', v)}
            keyboardType="email-address"
            placeholder="business@example.com"
          />
        ) : (
          <Text style={styles.valueRow}>{profile.contactEmail || profile.email}</Text>
        )}
      </View>
      <View style={styles.fieldRow}>
        <MaterialIcons name="phone" size={18} color="#666" />
        {edit ? (
          <TextInput
            style={styles.inputRow}
            value={form.contactPhone}
            onChangeText={(v) => setField('contactPhone', v)}
            placeholder="+972-XX-XXXXXXX"
            keyboardType="phone-pad"
          />
        ) : (
          <Text style={styles.valueRow}>{profile.contactPhone || 'No phone provided'}</Text>
        )}
      </View>
      <View style={styles.fieldRow}>
        <MaterialIcons name="language" size={18} color="#666" />
        {edit ? (
          <TextInput
            style={styles.inputRow}
            value={form.socialMedia.website}
            onChangeText={(v) => setField('socialMedia.website', v)}
            placeholder="https://yourwebsite.com"
            keyboardType="url"
            autoCapitalize="none"
          />
        ) : (
          <Text style={styles.valueRow}>{profile.socialMedia?.website || 'No website provided'}</Text>
        )}
      </View>

      <SectionHeader icon="location-on" title="Business Address" />
      {edit ? (
        <>
          <TextInput
            style={styles.input}
            value={form.address.street}
            onChangeText={(v) => setField('address.street', v)}
            placeholder="Street"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={form.address.city}
              onChangeText={(v) => setField('address.city', v)}
              placeholder="City"
            />
            <TextInput
              style={[styles.input, { width: 120 }]}
              value={form.address.postalCode}
              onChangeText={(v) => setField('address.postalCode', v)}
              placeholder="Postal"
              keyboardType="number-pad"
            />
          </View>
        </>
      ) : (
        <Text style={styles.value}>
          {profile.address?.street || ''}{profile.address?.street ? ', ' : ''}
          {profile.address?.city || ''} {profile.address?.postalCode || ''}
        </Text>
      )}

      <SectionHeader icon="share" title="Social Media" />
      {['instagram', 'facebook'].map((k) => (
        <View key={k} style={styles.fieldRow}>
          <MaterialIcons name={k === 'instagram' ? 'photo-camera' : 'thumb-up'} size={18} color="#666" />
          {edit ? (
            <TextInput
              style={styles.inputRow}
              value={form.socialMedia[k]}
              onChangeText={(v) => setField(`socialMedia.${k}`, v)}
              placeholder={k === 'instagram' ? '@yourbusiness' : 'YourBusinessPage'}
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.valueRow}>{profile.socialMedia?.[k] || 'Not connected'}</Text>
          )}
        </View>
      ))}
    </View>
  );

  const NotificationsTab = () => (
    <View style={styles.card}>
      <SectionHeader icon="notifications" title="Push Notifications" />
      {[
        ['newOrders', 'New Orders', 'Get notified when new orders arrive'],
        ['lowStock', 'Low Stock Alerts', 'Alert when inventory runs low'],
        ['customerMessages', 'Customer Messages', 'Notify when customers message you'],
        ['pushNotifications', 'Enable Push', 'Master switch for push'],
      ].map(([key, title, desc]) => (
        <View key={key} style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>{title}</Text>
            <Text style={styles.toggleDesc}>{desc}</Text>
          </View>
          <Switch
            value={form.settings.notifications[key]}
            onValueChange={(v) => setField(`settings.notifications.${key}`, v)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </View>
  );

  const InventoryTab = () => (
    <View style={styles.card}>
      <SectionHeader icon="inventory" title="Inventory Settings" />
      <Text style={styles.label}>Low Stock Threshold</Text>
      <TextInput
        style={styles.input}
        value={String(form.settings.inventory.lowStockThreshold)}
        onChangeText={(v) =>
          setField('settings.inventory.lowStockThreshold', parseInt(v || '0', 10) || 0)
        }
        keyboardType="numeric"
        placeholder="5"
      />
      <Text style={styles.hint}>Alert when stock falls below this number.</Text>
    </View>
  );

  const OrdersTab = () => (
    <View style={styles.card}>
      <SectionHeader icon="receipt" title="Order Settings" />
      <Text style={styles.label}>Max Order Quantity</Text>
      <TextInput
        style={styles.input}
        value={String(form.settings.orders.maxOrderQuantity)}
        onChangeText={(v) =>
          setField('settings.orders.maxOrderQuantity', parseInt(v || '0', 10) || 0)
        }
        keyboardType="numeric"
      />
      <Text style={styles.label}>Order Timeout (hours)</Text>
      <TextInput
        style={styles.input}
        value={String(form.settings.orders.orderTimeout)}
        onChangeText={(v) =>
          setField('settings.orders.orderTimeout', parseInt(v || '0', 10) || 0)
        }
        keyboardType="numeric"
      />
      {[
        ['autoConfirm', 'Auto Confirm Orders', 'Automatically confirm new orders'],
        ['requireDeposit', 'Require Deposit', 'Require deposit for large orders'],
        ['allowCancellation', 'Allow Cancellation', 'Customers may cancel orders'],
        ['sendConfirmationEmail', 'Email Confirmations', 'Send confirmation emails'],
      ].map(([key, title, desc]) => (
        <View key={key} style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>{title}</Text>
            <Text style={styles.toggleDesc}>{desc}</Text>
          </View>
          <Switch
            value={!!form.settings.orders[key]}
            onValueChange={(v) => setField(`settings.orders.${key}`, v)}
            trackColor={{ false: '#ddd', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </View>
  );

  // ---------- RENDER ----------
  if (isLoading || !form) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={{ marginTop: 10, color: '#666' }}>Loading…</Text>
          {error ? <Text style={{ marginTop: 6, color: '#999' }}>{error}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color="#216a94" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Settings</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => (edit ? onSave() : setEdit(true))}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#216a94" />
          ) : (
            <MaterialIcons name={edit ? 'save' : 'edit'} size={22} color="#216a94" />
          )}
        </TouchableOpacity>
      </View>

      {/* Signed-out banner */}
      {error === 'No active session. Please sign in.' && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You’re signed out.</Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={styles.bannerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsWrap}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <MaterialIcons
              name={t.icon}
              size={18}
              color={tab === t.key ? '#4CAF50' : '#666'}
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1, backgroundColor: '#f8f9fa' }}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.maxWidth}>
            {tab === 'details' && <DetailsTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'inventory' && <InventoryTab />}
            {tab === 'orders' && <OrdersTab />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save footer */}
      {edit && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { backgroundColor: '#9e9e9e' }]}
            onPress={onSave}
            disabled={isSaving}
          >
            <MaterialIcons name="save" size={18} color="#fff" />
            <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
          {lastSaved && (
            <Text style={styles.savedAt}>Last saved: {lastSaved.toLocaleTimeString()}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e9ecef',
    ...Platform.select({ android: { elevation: 2 } }),
  },
  iconBtn: { padding: 8, backgroundColor: '#f0f9f3', borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },

  banner: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 8, backgroundColor: '#FFF3CD',
  },
  bannerText: { color: '#8a6d3b', marginRight: 6, fontSize: 13 },
  bannerLink: { color: '#0b5ed7', fontWeight: '600' },

  tabsWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10,
    marginRight: 8, borderRadius: 16, backgroundColor: '#f5f5f5',
  },
  tabActive: { backgroundColor: '#f0f9f3', borderWidth: 1, borderColor: '#4CAF50' },
  tabText: { marginLeft: 6, color: '#666', fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: '#4CAF50', fontWeight: '700' },

  contentContainer: { padding: 16, paddingBottom: 120, alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: CONTENT_MAX_WIDTH },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    ...Platform.select({ android: { elevation: 1 } }),
  },

  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e0e0e0' },
  logoBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  sectionTitle: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#333' },

  fieldBlock: { marginTop: 8, marginBottom: 10 },
  label: { fontSize: 13, color: '#444', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fafafa', color: '#333', fontSize: 15,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  value: { fontSize: 15, color: '#333' },
  hint: { fontSize: 12, color: '#666', marginTop: 6, fontStyle: 'italic' },

  fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputRow: {
    flex: 1, marginLeft: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingVertical: 6,
    color: '#333', fontSize: 14,
  },
  valueRow: { flex: 1, marginLeft: 10, color: '#333', fontSize: 14 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f1f1',
  },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  toggleDesc: { fontSize: 12, color: '#666', marginTop: 2 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e0e0e0', padding: 14,
  },
  saveBtn: {
    backgroundColor: '#4CAF50', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12,
  },
  saveText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  savedAt: { textAlign: 'center', marginTop: 6, fontSize: 12, color: '#666' },
});
