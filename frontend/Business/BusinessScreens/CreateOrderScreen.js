// Business/BusinessScreens/CreateOrderScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// API services you already have
import { getBusinessInventory } from '../services/businessApi';
import { createOrder, getHeaders } from '../services/businessOrderApi';
import { sendOrderMessage, API_BASE_URL } from '../../marketplace/services/marketplaceApi';

// ----------------- Base URLs -----------------
/**
 * Primary lookup lives in your Functions app:
 *   https://usersfunctions.azurewebsites.net/api/business/customers
 * You can override via env:
 *   EXPO_PUBLIC_USERS_FUNCS_URL="https://.../api"
 */
const USERS_FN_BASE =
  (typeof process !== 'undefined' &&
    (process.env?.EXPO_PUBLIC_USERS_FUNCS_URL ||
      process.env?.USERS_FUNCTIONS_BASE)) ||
  'https://usersfunctions.azurewebsites.net/api';

// Optional marketplace/user-profile base (guarded because it might be undefined)
const MARKET_BASE = (typeof API_BASE_URL === 'string' && API_BASE_URL) || null;

// How long to linger on the success overlay before navigating
const SUCCESS_NAV_DELAY = 1200; // ms

// ---------- Normalizers ----------
const normalizeEmail = (e = '') => e.trim().toLowerCase();
const sanitizePhone = (p = '') => (p || '').replace(/[^\d+]/g, '');

// ----- Safe JSON helpers (handle HTML/error responses gracefully) -----
const parseJsonSafely = async (response) => {
  const ct = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!ct.includes('application/json')) {
    return { isJson: false, raw: text };
  }
  try {
    return { isJson: true, json: JSON.parse(text) };
  } catch (e) {
    return { isJson: false, raw: text };
  }
};

const fetchJsonOrNull = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    const parsed = await parseJsonSafely(res);
    if (!parsed?.isJson) return null;
    return parsed.json;
  } catch (e) {
    console.warn('fetchJsonOrNull error for', url, e?.message || e);
    return null;
  }
};

// ----- Customer profile lookup helpers -----
// 1) Try your Functions aggregate endpoint: /business/customers?email=... | ?phone=...
// 2) If MARKET_BASE is available, try user-profile shapes there.
const lookupCustomerProfile = async (rawValue, searchType = 'email') => {
  try {
    const baseHeaders = await getHeaders();
    const headers = { ...baseHeaders, Accept: 'application/json' };

    const value =
      searchType === 'phone' ? sanitizePhone(rawValue) : normalizeEmail(rawValue);

    // --- Attempt A: Azure Functions aggregate customers endpoint ---
    const fnParam =
      searchType === 'phone'
        ? `phone=${encodeURIComponent(value)}`
        : `email=${encodeURIComponent(value)}`;
    const businessCustomersUrl = `${USERS_FN_BASE.replace(
      /\/$/,
      ''
    )}/business/customers?${fnParam}`;
    console.log('➡️ Functions customers lookup:', businessCustomersUrl);

    const fnData = await fetchJsonOrNull(businessCustomersUrl, {
      method: 'GET',
      headers,
    });
    // This endpoint returns an aggregate: { success, customers: [...] }
    if (fnData?.customers && Array.isArray(fnData.customers)) {
      const norm = (x = '') => x.trim().toLowerCase();
      const match = fnData.customers.find((c) => {
        if (searchType === 'email') return norm(c.email) === value;
        const phone = (c.phone || '').replace(/[^\d+]/g, '');
        return phone === value;
      });
      if (match) {
        console.log('✅ Found customer via Functions aggregate list');
        return {
          id: match.id || match.email,
          email: match.email,
          name: match.name || 'Customer',
          phone: match.phone || '',
          profileImage: match.profileImage || match.avatar,
          joinDate: match.joinDate || match.createdAt || match.firstOrderDate,
        };
      }
    }

    // --- Attempt B: Marketplace "user-profile" endpoint(s), only if defined ---
    if (MARKET_BASE) {
      const attempts = [];
      if (searchType === 'email') {
        attempts.push(
          `${MARKET_BASE}/user-profile?email=${encodeURIComponent(value)}`
        );
        attempts.push(
          `${MARKET_BASE}/user-profile?emailNorm=${encodeURIComponent(value)}`
        );
        attempts.push(
          `${MARKET_BASE}/user-profile/email/${encodeURIComponent(value)}`
        );
        attempts.push(`${MARKET_BASE}/user-profile/${encodeURIComponent(value)}`);
      } else {
        attempts.push(
          `${MARKET_BASE}/user-profile?phone=${encodeURIComponent(value)}`
        );
        attempts.push(
          `${MARKET_BASE}/user-profile/phone/${encodeURIComponent(value)}`
        );
        attempts.push(`${MARKET_BASE}/user-profile/${encodeURIComponent(value)}`);
      }

      for (const url of attempts) {
        console.log('➡️ Marketplace user-profile lookup attempt:', url);
        const data = await fetchJsonOrNull(url, { method: 'GET', headers });
        const user = data?.user || data?.profile || data?.data;
        if (user) {
          console.log('✅ Profile found via marketplace:', url);
          return {
            id: user.id || user.uid || user.email,
            email: user.email,
            name: user.name || user.displayName,
            phone: user.phone || user.contactPhone || user.phoneNumber || '',
            profileImage: user.profileImage || user.avatar,
            joinDate: user.joinDate || user.createdAt,
          };
        }
      }
    }

    console.warn('❌ Profile not found after all attempts', { searchType, value });
    return null;
  } catch (err) {
    console.error('lookupCustomerProfile failed:', err?.message || err);
    return null;
  }
};

export default function CreateOrderScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};

  // Core state
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    phone: '',
    communicationPreference: 'messages',
    notes: '',
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState({});
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);

  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Debounce refs
  const emailDebounceRef = useRef(null);

  // Customer lookup state
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [foundCustomerProfile, setFoundCustomerProfile] = useState(null);
  const [customerLookupMode, setCustomerLookupMode] = useState('manual'); // 'manual' | 'phone' | 'email'

  // Initialize
  useEffect(() => {
    const initScreen = async () => {
      try {
        let id = businessId;
        if (!id) {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email;
          setBusinessId(id);
        }

        if (id) {
          await loadInventory(id);
        }

        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      } catch (error) {
        console.error('Error initializing screen:', error);
        Alert.alert('Error', 'Failed to load screen. Please try again.');
      }
    };

    initScreen();
  }, [businessId]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (businessId) {
        loadInventory(businessId, true); // Silent refresh
      }
    }, [businessId])
  );

  // Load inventory
  const LOG = '[CreateOrder]';
  const loadInventory = async (id = businessId, silent = false) => {
    if (!id) return;

    try {
      if (!silent) {
        setIsLoading(true);
        setRefreshing(true);
      }

      console.log(LOG, 'Loading inventory for order creation…');
      const inventoryResponse = await getBusinessInventory(id);

      let inventoryArray = [];
      if (inventoryResponse && inventoryResponse.success) {
        inventoryArray = inventoryResponse.inventory || inventoryResponse.data || [];
      } else if (Array.isArray(inventoryResponse)) {
        inventoryArray = inventoryResponse;
      } else if (inventoryResponse && inventoryResponse.inventory) {
        inventoryArray = inventoryResponse.inventory;
      } else if (inventoryResponse && inventoryResponse.data) {
        inventoryArray = inventoryResponse.data;
      }

      if (!Array.isArray(inventoryArray)) {
        console.warn(LOG, 'Inventory data is not an array:', inventoryArray);
        inventoryArray = [];
      }

      const availableItems = inventoryArray.filter(
        (item) => item && item.status === 'active' && (item.quantity || 0) > 0
      );

      setInventory(availableItems);
      console.log(LOG, `Loaded ${availableItems.length} available items for orders`);
    } catch (error) {
      console.error(LOG, 'Error loading inventory:', error);
      setInventory([]);
      if (!silent) {
        Alert.alert('Error', 'Failed to load inventory. Please try again.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Handle refresh
  const onRefresh = () => {
    loadInventory();
  };

  // Filter inventory based on search
  const filteredInventory = inventory.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = (item.name || item.common_name || item.productName || '').toLowerCase();
    const scientificName = (item.scientific_name || '').toLowerCase();
    return name.includes(query) || scientificName.includes(query);
  });

  // Search for existing customer by phone or email
  const searchCustomerProfile = async (searchValue, searchType = 'email') => {
    try {
      setIsSearchingCustomer(true);
      console.log(
        `🔍 Searching for customer by ${searchType}:`,
        searchType === 'phone' ? sanitizePhone(searchValue) : normalizeEmail(searchValue)
      );

      const profile = await lookupCustomerProfile(searchValue, searchType);
      if (profile) {
        setFoundCustomerProfile({
          id: profile.id || profile.uid || profile.email,
          email: profile.email,
          name: profile.name || profile.displayName,
          phone: profile.phone || profile.contactPhone || profile.phoneNumber || '',
          hasGreenerProfile: true,
          profileImage: profile.profileImage || profile.avatar,
          joinDate: profile.joinDate || profile.createdAt,
        });

        // Auto-fill customer info
        setCustomerInfo((prev) => ({
          ...prev,
          email: profile.email || prev.email,
          name: profile.name || profile.displayName || prev.name,
          phone: profile.phone || profile.contactPhone || profile.phoneNumber || prev.phone,
          greenerProfileId: profile.id || profile.uid || profile.email,
        }));

        console.log('✅ Found existing customer profile');
        return true;
      }

      console.log('⚠️ No existing customer profile found');
      setFoundCustomerProfile(null);
      return false;
    } catch (error) {
      console.error('Error searching customer profile:', error);
      setFoundCustomerProfile(null);
      return false;
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Handle customer lookup by phone
  const handlePhoneLookup = async (phoneNumber) => {
    const phone = sanitizePhone(phoneNumber);
    if (!phone || phone.length < 7) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }
    const found = await searchCustomerProfile(phone, 'phone');
    if (!found) {
      Alert.alert(
        'Customer Not Found',
        "This customer doesn't have a Greener profile yet. You can still create the order, but chat functionality will be limited.",
        [
          { text: 'Continue Anyway', style: 'default' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Handle customer lookup by email
  const handleEmailLookup = async (email) => {
    const norm = normalizeEmail(email);
    if (!norm || !/\S+@\S+\.\S+/.test(norm)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    const found = await searchCustomerProfile(norm, 'email');
    if (!found) {
      Alert.alert(
        'Customer Not Found',
        "This customer doesn't have a Greener profile yet. You can still create the order, but chat functionality will be limited.",
        [
          { text: 'Continue Anyway', style: 'default' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Customer info change handler (with safe debounce for email)
  const handleCustomerInfoChange = (field, value) => {
    setCustomerInfo((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }

    if (field === 'email') {
      const norm = normalizeEmail(value);
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
      if (norm.includes('@') && norm.length > 5) {
        emailDebounceRef.current = setTimeout(() => {
          searchCustomerProfile(norm, 'email');
        }, 600);
      }
    }
  };

  // Add item to order
  const handleAddItem = (item) => {
    const existingIndex = selectedItems.findIndex((selected) => selected.id === item.id);

    if (existingIndex >= 0) {
      const newQuantity = selectedItems[existingIndex].quantity + 1;
      if (newQuantity <= item.quantity) {
        const updatedItems = [...selectedItems];
        updatedItems[existingIndex].quantity = newQuantity;
        updatedItems[existingIndex].totalPrice =
          newQuantity * (item.finalPrice || item.price);
        setSelectedItems(updatedItems);

        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.7,
            duration: 100,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      } else {
        Alert.alert('Stock Limit', `Only ${item.quantity} items available in stock`);
      }
    } else {
      const newItem = {
        id: item.id,
        name: item.name || item.common_name || item.productName,
        unitPrice: item.finalPrice || item.price,
        quantity: 1,
        totalPrice: item.finalPrice || item.price,
        availableStock: item.quantity,
        productType: item.productType,
      };

      setSelectedItems((prev) => [...prev, newItem]);

      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(500),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  };

  // Remove item from order
  const handleRemoveItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Update item quantity
  const handleUpdateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    const item = selectedItems.find((i) => i.id === itemId);
    if (!item) return;

    if (newQuantity > item.availableStock) {
      Alert.alert('Stock Limit', `Only ${item.availableStock} items available`);
      return;
    }

    setSelectedItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, quantity: newQuantity, totalPrice: newQuantity * i.unitPrice }
          : i
      )
    );
  };

  // Calculate order total
  const getOrderTotal = () => {
    return selectedItems.reduce((total, item) => total + item.totalPrice, 0);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!customerInfo.email.trim()) {
      newErrors.email = 'Customer email is required';
    } else if (!/\S+@\S+\.\S+/.test(customerInfo.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!customerInfo.name.trim()) {
      newErrors.name = 'Customer name is required';
    }

    if (selectedItems.length === 0) {
      newErrors.items = 'Please add at least one item to the order';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }

    return Object.keys(newErrors).length === 0;
  };

  // Submit order
  const handleSubmitOrder = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const orderData = {
        businessId,
        customerEmail: normalizeEmail(customerInfo.email),
        customerName: customerInfo.name.trim(),
        customerPhone: sanitizePhone(customerInfo.phone),
        communicationPreference: customerInfo.communicationPreference,
        notes: customerInfo.notes.trim(),
        customerProfileId: customerInfo.greenerProfileId || null,
        hasGreenerProfile: !!foundCustomerProfile,
        items: selectedItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      };

      console.log('Submitting order with profile integration:', orderData);
      const result = await createOrder(orderData);

      // Store last created order
      setLastCreatedOrder(result.order);

      // Send message to customer
      try {
        const senderId = businessId;
        const recipientId =
          customerInfo.greenerProfileId || normalizeEmail(customerInfo.email);

        let orderMsg;
        if (foundCustomerProfile) {
          orderMsg = `📦 New order confirmation for pickup!\n\nOrder: ${
            result.order.confirmationNumber
          }\nTotal: $${result.order.total.toFixed(
            2
          )}\nEstimated pickup: 2+ hours\n\nYou can track this order in your Greener app. Please bring your confirmation number for pickup.`;
        } else {
          orderMsg = `Order created: ${
            result.order.confirmationNumber
          } for ${customerInfo.name.trim()}.\nTotal: $${result.order.total.toFixed(
            2
          )}\nCustomer pickup required.`;
        }

        await sendOrderMessage(recipientId, orderMsg, senderId, {
          orderId: result.order.orderId || result.order.id,
          confirmationNumber: result.order.confirmationNumber,
          hasCustomerProfile: !!foundCustomerProfile,
        });

        console.log('✅ Order message sent successfully');
      } catch (msgErr) {
        console.warn('Failed to send order message:', msgErr);
      }

      // Success overlay -> brief pause -> navigate to Orders
      setShowSuccessAnimation(true);
      successAnim.setValue(0);
      Animated.sequence([
        Animated.spring(successAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(SUCCESS_NAV_DELAY),
      ]).start(() => {
        navigation.replace('BusinessOrdersScreen', {
          refreshKey: Date.now(),
          highlightOrderId: result.order.orderId || result.order.id,
          fromCreate: true,
        });
      });
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', `Failed to create order: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedItems([]);
    setCustomerInfo({
      email: '',
      name: '',
      phone: '',
      communicationPreference: 'messages',
      notes: '',
    });
    setErrors({});
    setSearchQuery('');
    setFoundCustomerProfile(null);
  };

  // Render inventory item
  const renderInventoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.inventoryItem}
      onPress={() => handleAddItem(item)}
      activeOpacity={0.7}
    >
      <View style={styles.inventoryItemHeader}>
        <View style={styles.itemIcon}>
          <MaterialCommunityIcons
            name={item.productType === 'plant' ? 'leaf' : 'cube-outline'}
            size={24}
            color="#4CAF50"
          />
        </View>
        <View style={styles.inventoryItemInfo}>
          <Text style={styles.inventoryItemName} numberOfLines={1}>
            {item.name || item.common_name || item.productName}
          </Text>
          {item.scientific_name && (
            <Text style={styles.inventoryItemScientific} numberOfLines={1}>
              {item.scientific_name}
            </Text>
          )}
          <View style={styles.inventoryItemDetails}>
            <Text style={styles.itemPrice}>
              ${(item.finalPrice || item.price).toFixed(2)}
            </Text>
            <Text style={styles.itemStock}>Stock: {item.quantity}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addItemButton}
          onPress={() => handleAddItem(item)}
        >
          <MaterialIcons name="add-circle" size={32} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render selected item
  const renderSelectedItem = ({ item }) => (
    <Animated.View style={[styles.selectedItem, { opacity: fadeAnim }]}>
      <View style={styles.selectedItemInfo}>
        <Text style={styles.selectedItemName}>{item.name}</Text>
        <Text style={styles.selectedItemPrice}>
          ${item.unitPrice.toFixed(2)} each
        </Text>
      </View>

      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
        >
          <MaterialIcons name="remove" size={20} color="#f44336" />
        </TouchableOpacity>

        <Text style={styles.quantityText}>{item.quantity}</Text>

        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
        >
          <MaterialIcons name="add" size={20} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <View style={styles.selectedItemActions}>
        <Text style={styles.itemTotal}>${item.totalPrice.toFixed(2)}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
        >
          <MaterialIcons name="delete" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // Customer lookup UI
  const renderCustomerLookup = () => (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <MaterialIcons name="person-search" size={20} color="#4CAF50" />
        <Text style={styles.sectionTitleText}>Find Customer Profile</Text>
      </View>

      <View style={styles.customerForm}>
        <View style={styles.lookupModeContainer}>
          <Text style={styles.label}>Lookup Method</Text>
          <View style={styles.lookupModeButtons}>
            <TouchableOpacity
              style={[
                styles.lookupModeButton,
                customerLookupMode === 'phone' && styles.lookupModeButtonActive,
              ]}
              onPress={() => setCustomerLookupMode('phone')}
            >
              <MaterialIcons
                name="phone"
                size={16}
                color={customerLookupMode === 'phone' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.lookupModeText,
                  customerLookupMode === 'phone' && styles.lookupModeTextActive,
                ]}
              >
                Phone
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.lookupModeButton,
                customerLookupMode === 'email' && styles.lookupModeButtonActive,
              ]}
              onPress={() => setCustomerLookupMode('email')}
            >
              <MaterialIcons
                name="email"
                size={16}
                color={customerLookupMode === 'email' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.lookupModeText,
                  customerLookupMode === 'email' && styles.lookupModeTextActive,
                ]}
              >
                Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.lookupModeButton,
                customerLookupMode === 'manual' && styles.lookupModeButtonActive,
              ]}
              onPress={() => setCustomerLookupMode('manual')}
            >
              <MaterialIcons
                name="edit"
                size={16}
                color={customerLookupMode === 'manual' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.lookupModeText,
                  customerLookupMode === 'manual' && styles.lookupModeTextActive,
                ]}
              >
                Manual
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {customerLookupMode === 'phone' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Phone Number</Text>
            <View style={styles.lookupInputContainer}>
              <TextInput
                style={styles.input}
                value={customerInfo.phone}
                onChangeText={(text) => handleCustomerInfoChange('phone', text)}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.lookupButton}
                onPress={() => handlePhoneLookup(customerInfo.phone)}
                disabled={isSearchingCustomer}
              >
                {isSearchingCustomer ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <MaterialIcons name="search" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {customerLookupMode === 'email' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Email</Text>
            <View style={styles.lookupInputContainer}>
              <TextInput
                style={styles.input}
                value={customerInfo.email}
                onChangeText={(text) => handleCustomerInfoChange('email', text)}
                placeholder="customer@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.lookupButton}
                onPress={() => handleEmailLookup(customerInfo.email)}
                disabled={isSearchingCustomer}
              >
                {isSearchingCustomer ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <MaterialIcons name="search" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {foundCustomerProfile && (
          <View style={styles.customerProfileFound}>
            <View style={styles.customerProfileHeader}>
              <MaterialIcons name="verified-user" size={20} color="#4CAF50" />
              <Text style={styles.customerProfileTitle}>Greener Customer Found!</Text>
            </View>
            <View style={styles.customerProfileInfo}>
              <Text style={styles.customerProfileName}>
                {foundCustomerProfile.name}
              </Text>
              <Text style={styles.customerProfileEmail}>
                {foundCustomerProfile.email}
              </Text>
              <Text style={styles.customerProfileNote}>
                Chat functionality will be available for this order
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              transform: [{ translateX: shakeAnim }],
            },
          ]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create New Order</Text>
            <Text style={styles.headerSubtitle}>
              {selectedItems.length} items • ${getOrderTotal().toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity onPress={resetForm} style={styles.headerButton}>
            <MaterialIcons name="refresh" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          style={[styles.content, { opacity: fadeAnim }]}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Customer Lookup */}
          {renderCustomerLookup()}

          {/* Customer Information */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="person" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitleText}>Customer Information</Text>
            </View>

            <View style={styles.customerForm}>
              {customerLookupMode === 'manual' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Customer Email <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      value={customerInfo.email}
                      onChangeText={(text) => handleCustomerInfoChange('email', text)}
                      placeholder="customer@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#999"
                    />
                    {errors.email && (
                      <View style={styles.errorRow}>
                        <MaterialIcons name="error" size={14} color="#f44336" />
                        <Text style={styles.errorText}>{errors.email}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Customer Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, errors.name && styles.inputError]}
                      value={customerInfo.name}
                      onChangeText={(text) => handleCustomerInfoChange('name', text)}
                      placeholder="John Doe"
                      placeholderTextColor="#999"
                    />
                    {errors.name && (
                      <View style={styles.errorRow}>
                        <MaterialIcons name="error" size={14} color="#f44336" />
                        <Text style={styles.errorText}>{errors.name}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={customerInfo.phone}
                      onChangeText={(text) => handleCustomerInfoChange('phone', text)}
                      placeholder="+1 (555) 123-4567"
                      keyboardType="phone-pad"
                      placeholderTextColor="#999"
                    />
                  </View>
                </>
              )}

              {/* Communication Preference - Always Show */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Communication Preference</Text>
                <View style={styles.preferenceContainer}>
                  {['messages', 'email', 'phone'].map((pref) => (
                    <TouchableOpacity
                      key={pref}
                      style={[
                        styles.preferenceOption,
                        customerInfo.communicationPreference === pref &&
                          styles.preferenceOptionActive,
                      ]}
                      onPress={() =>
                        handleCustomerInfoChange('communicationPreference', pref)
                      }
                    >
                      <MaterialIcons
                        name={
                          pref === 'messages'
                            ? 'chat'
                            : pref === 'email'
                            ? 'email'
                            : 'phone'
                        }
                        size={16}
                        color={
                          customerInfo.communicationPreference === pref
                            ? '#fff'
                            : '#666'
                        }
                      />
                      <Text
                        style={[
                          styles.preferenceText,
                          customerInfo.communicationPreference === pref &&
                            styles.preferenceTextActive,
                        ]}
                      >
                        {pref.charAt(0).toUpperCase() + pref.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={customerInfo.notes}
                  onChangeText={(text) => handleCustomerInfoChange('notes', text)}
                  placeholder="Special instructions or notes..."
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Selected Items */}
          {selectedItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="shopping-cart" size={20} color="#4CAF50" />
                <Text style={styles.sectionTitleText}>
                  Order Items ({selectedItems.length})
                </Text>
              </View>

              <FlatList
                data={selectedItems}
                renderItem={renderSelectedItem}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                style={styles.selectedItemsList}
              />

              <View style={styles.orderSummary}>
                <View className="summaryRow" style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Items:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedItems.reduce((total, item) => total + item.quantity, 0)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Order Total:</Text>
                  <Text style={styles.totalValue}>${getOrderTotal().toFixed(2)}</Text>
                </View>
              </View>

              {errors.items && (
                <View style={styles.errorRow}>
                  <MaterialIcons name="error" size={14} color="#f44336" />
                  <Text style={styles.errorText}>{errors.items}</Text>
                </View>
              )}
            </View>
          )}

          {/* Available Inventory */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="inventory" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitleText}>Available Inventory</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#4CAF50" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search plants and products..."
                placeholderTextColor="#999"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="clear" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredInventory}
              renderItem={renderInventoryItem}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              style={styles.inventoryList}
              ListEmptyComponent={
                <View style={styles.emptyInventory}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={48}
                    color="#e0e0e0"
                  />
                  <Text style={styles.emptyInventoryText}>
                    {searchQuery
                      ? 'No items match your search'
                      : 'No items available for orders'}
                  </Text>
                  {searchQuery && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Text style={styles.clearSearchText}>Clear search</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          </View>
        </Animated.ScrollView>

        {/* Submit Button */}
        {selectedItems.length > 0 && (
          <Animated.View
            style={[
              styles.footer,
              {
                transform: [{ translateX: shakeAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitOrder}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="add-shopping-cart" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>
                    Create Order • ${getOrderTotal().toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Success Animation Overlay */}
        {showSuccessAnimation && (
          <Animated.View
            style={[
              styles.successOverlay,
              {
                opacity: successAnim,
                transform: [{ scale: successAnim }],
              },
            ]}
          >
            <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
            <Text style={styles.successText}>Order Created!</Text>
            {lastCreatedOrder && (
              <Text style={styles.successDetails}>
                Confirmation: {lastCreatedOrder.confirmationNumber}
              </Text>
            )}
            <Text style={styles.redirectText}>Taking you to Orders…</Text>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  keyboardAvoid: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
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
  headerButton: { padding: 8, borderRadius: 8, backgroundColor: '#e6f1f6' },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#216a94' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  section: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitleText: { fontSize: 18, fontWeight: '700', color: '#333', marginLeft: 6 },
  customerForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  required: { color: '#f44336' },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  inputError: { borderColor: '#f44336', backgroundColor: '#ffebee' },
  textArea: { height: 80, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  errorText: { color: '#f44336', fontSize: 12, marginLeft: 6 },
  preferenceContainer: { flexDirection: 'row', gap: 8 },
  preferenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  preferenceOptionActive: { backgroundColor: '#216a94', borderColor: '#216a94' },
  preferenceText: { fontSize: 14, color: '#666', marginLeft: 4 },
  preferenceTextActive: { color: '#fff', fontWeight: '600' },
  selectedItemsList: { backgroundColor: '#fff', borderRadius: 12, maxHeight: 300 },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItemInfo: { flex: 1 },
  selectedItemName: { fontSize: 16, fontWeight: '600', color: '#333' },
  selectedItemPrice: { fontSize: 14, color: '#666', marginTop: 2 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  selectedItemActions: { alignItems: 'flex-end' },
  itemTotal: { fontSize: 16, fontWeight: '700', color: '#216a94' },
  removeButton: { marginTop: 4, padding: 4 },
  orderSummary: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#216a94' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#333', marginLeft: 8 },
  inventoryList: { backgroundColor: '#fff', borderRadius: 12, maxHeight: 400 },
  inventoryItem: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  inventoryItemHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6f1f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inventoryItemInfo: { flex: 1 },
  inventoryItemName: { fontSize: 16, fontWeight: '600', color: '#333' },
  inventoryItemScientific: { fontSize: 14, fontStyle: 'italic', color: '#666', marginTop: 2 },
  inventoryItemDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#216a94' },
  itemStock: { fontSize: 14, color: '#666' },
  addItemButton: { padding: 8 },
  emptyInventory: { alignItems: 'center', paddingVertical: 40 },
  emptyInventoryText: { fontSize: 16, color: '#666', marginTop: 12, textAlign: 'center' },
  clearSearchText: { fontSize: 14, color: '#216a94', marginTop: 8 },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#216a94',
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
  submitButtonDisabled: { backgroundColor: '#bdbdbd' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successText: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 16, textAlign: 'center' },
  successDetails: { fontSize: 14, color: '#fff', marginTop: 8, textAlign: 'center', opacity: 0.8 },
  redirectText: { fontSize: 13, color: '#fff', marginTop: 12, opacity: 0.8, textAlign: 'center' },
});
