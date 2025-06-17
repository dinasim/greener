// Business/BusinessScreens/CreateOrderScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

// Import API services
import { getBusinessInventory } from '../services/businessApi';
import { createOrder, getHeaders } from '../services/businessOrderApi';
import { sendOrderMessage, API_BASE_URL } from '../../marketplace/services/marketplaceApi';

// NEW: Customer lookup API function
const lookupCustomerProfile = async (searchValue, searchType = 'email') => {
  try {
    const headers = await getHeaders();
    
    // Use the existing user-profile endpoint that we found in the backend
    const response = await fetch(`${API_BASE_URL}/user-profile/${encodeURIComponent(searchValue)}`, {
      method: 'GET',
      headers,
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error looking up customer profile:', error);
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
    notes: ''
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
  
  // NEW: Add customer profile lookup state
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [foundCustomerProfile, setFoundCustomerProfile] = useState(null);
  const [customerLookupMode, setCustomerLookupMode] = useState('manual'); // 'manual' or 'lookup'
  
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
        
        // Entrance animation
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

  // Load inventory - FIXED DATA TYPE ERROR
  const loadInventory = async (id = businessId, silent = false) => {
    if (!id) return;
    
    try {
      if (!silent) {
        setIsLoading(true);
        setRefreshing(true);
      }
      
      console.log('Loading inventory for order creation...');
      const inventoryResponse = await getBusinessInventory(id);
      
      // FIXED: Ensure we access the inventory array correctly and handle different response structures
      let inventoryArray = [];
      
      if (inventoryResponse && inventoryResponse.success) {
        // Response has success flag - get inventory from response
        inventoryArray = inventoryResponse.inventory || inventoryResponse.data || [];
      } else if (Array.isArray(inventoryResponse)) {
        // Response is directly an array
        inventoryArray = inventoryResponse;
      } else if (inventoryResponse && inventoryResponse.inventory) {
        // Response has inventory property
        inventoryArray = inventoryResponse.inventory;
      } else if (inventoryResponse && inventoryResponse.data) {
        // Response has data property
        inventoryArray = inventoryResponse.data;
      }
      
      // FIXED: Ensure inventoryArray is actually an array before filtering
      if (!Array.isArray(inventoryArray)) {
        console.warn('Inventory data is not an array:', inventoryArray);
        inventoryArray = [];
      }
      
      // Filter only active items with stock
      const availableItems = inventoryArray.filter(item => 
        item && 
        item.status === 'active' && 
        (item.quantity || 0) > 0
      );
      
      setInventory(availableItems);
      console.log(`Loaded ${availableItems.length} available items for orders`);
      
    } catch (error) {
      console.error('Error loading inventory:', error);
      // FIXED: Set empty array on error to prevent further filter errors
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
  const filteredInventory = inventory.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = (item.name || item.common_name || item.productName || '').toLowerCase();
    const scientificName = (item.scientific_name || '').toLowerCase();
    return name.includes(query) || scientificName.includes(query);
  });

  // NEW: Search for existing customer by phone or email
  const searchCustomerProfile = async (searchValue, searchType = 'email') => {
    try {
      setIsSearchingCustomer(true);
      console.log(`🔍 Searching for customer by ${searchType}:`, searchValue);
      
      const headers = await getHeaders();
      
      // Use the existing user-profile endpoint that we found in the backend
      // The backend accepts both email and ID in the same endpoint
      const response = await fetch(`${API_BASE_URL}/user-profile/${encodeURIComponent(searchValue)}`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData && userData.user) {
          const profile = userData.user;
          setFoundCustomerProfile({
            id: profile.id || profile.email,
            email: profile.email,
            name: profile.name,
            phone: profile.phone || profile.contactPhone || '',
            hasGreenerProfile: true,
            profileImage: profile.profileImage || profile.avatar,
            joinDate: profile.joinDate || profile.createdAt
          });
          
          // Auto-fill customer info
          setCustomerInfo(prev => ({
            ...prev,
            email: profile.email,
            name: profile.name,
            phone: profile.phone || profile.contactPhone || prev.phone,
            greenerProfileId: profile.id || profile.email // NEW: Store profile ID
          }));
          
          console.log('✅ Found existing Greener customer profile');
          return true;
        }
      }
      
      console.log('⚠️ No existing Greener profile found');
      setFoundCustomerProfile(null);
      return false;
      
    } catch (error) {
      console.error('Error searching customer profile:', error);
      return false;
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // NEW: Handle customer lookup by phone (for walk-in customers)
  const handlePhoneLookup = async (phoneNumber) => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }
    
    const found = await searchCustomerProfile(phoneNumber, 'phone');
    if (!found) {
      Alert.alert(
        'Customer Not Found',
        'This customer doesn\'t have a Greener app profile yet. You can still create the order, but chat functionality will be limited.',
        [
          { text: 'Continue Anyway', style: 'default' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  // NEW: Handle customer lookup by email
  const handleEmailLookup = async (email) => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    
    const found = await searchCustomerProfile(email, 'email');
    if (!found) {
      Alert.alert(
        'Customer Not Found',
        'This customer doesn\'t have a Greener app profile yet. You can still create the order, but chat functionality will be limited.',
        [
          { text: 'Continue Anyway', style: 'default' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  // ENHANCED: Updated customer info change handler
  const handleCustomerInfoChange = (field, value) => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is changed
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
    
    // NEW: Auto-search when email is entered (debounced)
    if (field === 'email' && value.includes('@') && value.length > 5) {
      clearTimeout(window.emailSearchTimeout);
      window.emailSearchTimeout = setTimeout(() => {
        searchCustomerProfile(value, 'email');
      }, 1000);
    }
  };

  // Add item to order
  const handleAddItem = (item) => {
    const existingIndex = selectedItems.findIndex(selected => selected.id === item.id);
    
    if (existingIndex >= 0) {
      // Increase quantity if already selected
      const newQuantity = selectedItems[existingIndex].quantity + 1;
      if (newQuantity <= item.quantity) {
        const updatedItems = [...selectedItems];
        updatedItems[existingIndex].quantity = newQuantity;
        updatedItems[existingIndex].totalPrice = newQuantity * item.finalPrice;
        setSelectedItems(updatedItems);
        
        // Success animation
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
      // Add new item
      const newItem = {
        id: item.id,
        name: item.name || item.common_name || item.productName,
        unitPrice: item.finalPrice || item.price,
        quantity: 1,
        totalPrice: item.finalPrice || item.price,
        availableStock: item.quantity,
        productType: item.productType
      };
      
      setSelectedItems(prev => [...prev, newItem]);
      
      // Success animation
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
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Update item quantity
  const handleUpdateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    
    const item = selectedItems.find(item => item.id === itemId);
    if (newQuantity > item.availableStock) {
      Alert.alert('Stock Limit', `Only ${item.availableStock} items available`);
      return;
    }
    
    setSelectedItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice }
          : item
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
    
    // Shake animation on validation error
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

  // ENHANCED: Updated submit order with profile ID
  const handleSubmitOrder = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    
    try {
      const orderData = {
        businessId,
        customerEmail: customerInfo.email.trim(),
        customerName: customerInfo.name.trim(),
        customerPhone: customerInfo.phone.trim(),
        communicationPreference: customerInfo.communicationPreference,
        notes: customerInfo.notes.trim(),
        // NEW: Include customer profile ID for chat integration
        customerProfileId: customerInfo.greenerProfileId || null,
        hasGreenerProfile: !!foundCustomerProfile,
        items: selectedItems.map(item => ({
          id: item.id,
          quantity: item.quantity
        }))
      };
      
      console.log('Submitting order with profile integration:', orderData);
      const result = await createOrder(orderData);
      
      // Store last created order
      setLastCreatedOrder(result.order);
      
      // NEW: Enhanced messaging for profile-linked customers
      try {
        const senderId = businessId;
        const recipientId = customerInfo.greenerProfileId || customerInfo.email.trim();
        
        let orderMsg;
        if (foundCustomerProfile) {
          // Customer has Greener profile - send rich message
          orderMsg = `📦 New order confirmation for pickup!\n\nOrder: ${result.order.confirmationNumber}\nTotal: $${result.order.total.toFixed(2)}\nEstimated pickup: 2+ hours\n\nYou can track this order in your Greener app. Please bring your confirmation number for pickup.`;
        } else {
          // No profile - basic notification
          orderMsg = `Order created: ${result.order.confirmationNumber} for ${customerInfo.name.trim()}.\nTotal: $${result.order.total.toFixed(2)}\nCustomer pickup required.`;
        }
        
        await sendOrderMessage(recipientId, orderMsg, senderId, { 
          orderId: result.order.id, 
          confirmationNumber: result.order.confirmationNumber,
          hasCustomerProfile: !!foundCustomerProfile
        });
        
        console.log('✅ Order message sent successfully');
      } catch (msgErr) {
        console.warn('Failed to send order message:', msgErr);
      }

      // Show success animation
      setShowSuccessAnimation(true);
      
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(2000),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setShowSuccessAnimation(false);
      });
      
      // Show success alert with order details
      Alert.alert(
        '🎉 Order Created Successfully!',
        `Order confirmation: ${result.order.confirmationNumber}\n\nCustomer: ${result.order.customerName}\nTotal: $${result.order.total.toFixed(2)}\n\nThe customer can pick up this order using the confirmation number.`,
        [
          {
            text: 'Create Another Order',
            style: 'default',
            onPress: resetForm,
          },
          {
            text: 'View Orders',
            style: 'default',
            onPress: () => navigation.navigate('BusinessOrdersScreen'),
          },
        ]
      );
      
      // Auto-refresh inventory to reflect stock changes
      await loadInventory();
      
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
      notes: ''
    });
    setErrors({});
    setSearchQuery('');
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
            <Text style={styles.itemPrice}>${(item.finalPrice || item.price).toFixed(2)}</Text>
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
        <Text style={styles.selectedItemPrice}>${item.unitPrice.toFixed(2)} each</Text>
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

  // NEW: Customer lookup section render
  const renderCustomerLookup = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        <MaterialIcons name="person-search" size={20} color="#4CAF50" />
        {' '}Find Customer Profile
      </Text>
      
      <View style={styles.customerForm}>
        <View style={styles.lookupModeContainer}>
          <Text style={styles.label}>Lookup Method</Text>
          <View style={styles.lookupModeButtons}>
            <TouchableOpacity
              style={[
                styles.lookupModeButton,
                customerLookupMode === 'phone' && styles.lookupModeButtonActive
              ]}
              onPress={() => setCustomerLookupMode('phone')}
            >
              <MaterialIcons name="phone" size={16} color={customerLookupMode === 'phone' ? '#fff' : '#666'} />
              <Text style={[
                styles.lookupModeText,
                customerLookupMode === 'phone' && styles.lookupModeTextActive
              ]}>Phone</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.lookupModeButton,
                customerLookupMode === 'email' && styles.lookupModeButtonActive
              ]}
              onPress={() => setCustomerLookupMode('email')}
            >
              <MaterialIcons name="email" size={16} color={customerLookupMode === 'email' ? '#fff' : '#666'} />
              <Text style={[
                styles.lookupModeText,
                customerLookupMode === 'email' && styles.lookupModeTextActive
              ]}>Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.lookupModeButton,
                customerLookupMode === 'manual' && styles.lookupModeButtonActive
              ]}
              onPress={() => setCustomerLookupMode('manual')}
            >
              <MaterialIcons name="edit" size={16} color={customerLookupMode === 'manual' ? '#fff' : '#666'} />
              <Text style={[
                styles.lookupModeText,
                customerLookupMode === 'manual' && styles.lookupModeTextActive
              ]}>Manual</Text>
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
        
        {/* Customer Profile Found Indicator */}
        {foundCustomerProfile && (
          <View style={styles.customerProfileFound}>
            <View style={styles.customerProfileHeader}>
              <MaterialIcons name="verified-user" size={20} color="#4CAF50" />
              <Text style={styles.customerProfileTitle}>Greener Customer Found!</Text>
            </View>
            <View style={styles.customerProfileInfo}>
              <Text style={styles.customerProfileName}>{foundCustomerProfile.name}</Text>
              <Text style={styles.customerProfileEmail}>{foundCustomerProfile.email}</Text>
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
            <Text style={styles.headerTitle}>Create New Order</Text>
            <Text style={styles.headerSubtitle}>
              {selectedItems.length} items • ${getOrderTotal().toFixed(2)}
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={resetForm}
            style={styles.headerButton}
          >
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
          {/* NEW: Customer Lookup Section - FIRST */}
          {renderCustomerLookup()}

          {/* Customer Information Section - UPDATED */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="person" size={20} color="#4CAF50" />
              {' '}Customer Information
            </Text>
            
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
                      <Text style={styles.errorText}>
                        <MaterialIcons name="error" size={14} color="#f44336" /> {errors.email}
                      </Text>
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
                      <Text style={styles.errorText}>
                        <MaterialIcons name="error" size={14} color="#f44336" /> {errors.name}
                      </Text>
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
                        customerInfo.communicationPreference === pref && styles.preferenceOptionActive
                      ]}
                      onPress={() => handleCustomerInfoChange('communicationPreference', pref)}
                    >
                      <MaterialIcons 
                        name={
                          pref === 'messages' ? 'chat' : 
                          pref === 'email' ? 'email' : 'phone'
                        } 
                        size={16} 
                        color={customerInfo.communicationPreference === pref ? '#fff' : '#666'} 
                      />
                      <Text style={[
                        styles.preferenceText,
                        customerInfo.communicationPreference === pref && styles.preferenceTextActive
                      ]}>
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

          {/* Selected Items Section */}
          {selectedItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="shopping-cart" size={20} color="#4CAF50" />
                {' '}Order Items ({selectedItems.length})
              </Text>
              
              <FlatList
                data={selectedItems}
                renderItem={renderSelectedItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                style={styles.selectedItemsList}
              />
              
              <View style={styles.orderSummary}>
                <View style={styles.summaryRow}>
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
                <Text style={styles.errorText}>
                  <MaterialIcons name="error" size={14} color="#f44336" /> {errors.items}
                </Text>
              )}
            </View>
          )}

          {/* Available Inventory Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="inventory" size={20} color="#4CAF50" />
              {' '}Available Inventory
            </Text>
            
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
              keyExtractor={item => item.id}
              scrollEnabled={false}
              style={styles.inventoryList}
              ListEmptyComponent={
                <View style={styles.emptyInventory}>
                  <MaterialCommunityIcons name="package-variant-closed" size={48} color="#e0e0e0" />
                  <Text style={styles.emptyInventoryText}>
                    {searchQuery ? 'No items match your search' : 'No items available for orders'}
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
              }
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
              }
            ]}
          >
            <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
            <Text style={styles.successText}>Order Created Successfully!</Text>
            {lastCreatedOrder && (
              <Text style={styles.successDetails}>
                Confirmation: {lastCreatedOrder.confirmationNumber}
              </Text>
            )}
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoid: {
    flex: 1,
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
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#f44336',
  },
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
  inputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceContainer: {
    flexDirection: 'row',
    gap: 8,
  },
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
  preferenceOptionActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  preferenceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  preferenceTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  selectedItemsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 300,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedItemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
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
  selectedItemActions: {
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  removeButton: {
    marginTop: 4,
    padding: 4,
  },
  orderSummary: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  inventoryList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 400,
  },
  inventoryItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  inventoryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inventoryItemInfo: {
    flex: 1,
  },
  inventoryItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  inventoryItemScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
  },
  inventoryItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  itemStock: {
    fontSize: 14,
    color: '#666',
  },
  addItemButton: {
    padding: 8,
  },
  emptyInventory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyInventoryText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
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
  submitButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
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
  successText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  successDetails: {
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  lookupModeContainer: {
    marginBottom: 16,
  },
  lookupModeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  lookupModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lookupModeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  lookupModeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  lookupModeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  lookupInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lookupButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  customerProfileFound: {
    backgroundColor: '#f0f9f3',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginTop: 16,
  },
  customerProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerProfileTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  customerProfileInfo: {
    marginLeft: 28,
  },
  customerProfileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerProfileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  customerProfileNote: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 4,
  },
});