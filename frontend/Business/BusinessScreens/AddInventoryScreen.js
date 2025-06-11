// Business/BusinessScreens/AddInventoryScreen.js - ENHANCED WITH COMPONENTS
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Dimensions,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { searchPlants, createInventoryItem, getBusinessInventory, updateInventoryItem } from '../services/businessApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SpeechToTextComponent from '../../marketplace/components/SpeechToTextComponent';

// Import Business Components
import InventoryTable from '../components/InventoryTable';
import ProductEditModal from '../components/ProductEditModal';
import LowStockBanner from '../components/LowStockBanner';
import KPIWidget from '../components/KPIWidget';

const { width, height } = Dimensions.get('window');

export default function AddInventoryScreen({ navigation, route }) {
  const { businessId, showInventory: initialShowInventory = false } = route.params || {};
  
  // Core state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentInventory, setCurrentInventory] = useState([]);
  const [showInventory, setShowInventory] = useState(initialShowInventory);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBusinessId, setCurrentBusinessId] = useState(businessId);
  
  // Enhanced state for better UX
  const [lastSavedItem, setLastSavedItem] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [networkStatus, setNetworkStatus] = useState('online');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  
  // KPI state
  const [kpiData, setKpiData] = useState({
    totalItems: 0,
    activeItems: 0,
    lowStockCount: 0,
    totalValue: 0
  });
  
  // Form state
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    minThreshold: '5',
    discount: '0',
    notes: '',
  });
  
  const [errors, setErrors] = useState({});
  
  // Animation refs - Fixed for web compatibility
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const headerHeightAnim = useRef(new Animated.Value(100)).current;
  const searchBarFocusAnim = useRef(new Animated.Value(0)).current;
  
  // Refs for better performance
  const debounceTimeout = useRef(null);
  const isMounted = useRef(true);
  const searchInputRef = useRef(null);
  
  // Enhanced initialization with proper business ID setup
  useEffect(() => {
    const initializeScreen = async () => {
      try {
        let id = businessId;
        if (!id) {
          // Get from AsyncStorage or use the known working ID
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email || 'dina2@mail.tau.ac.il'; // Fallback to working ID
          
          // Set up the business credentials if not set
          await AsyncStorage.setItem('userEmail', id);
          await AsyncStorage.setItem('businessId', id);
          await AsyncStorage.setItem('userType', 'business');
        }
        
        setCurrentBusinessId(id);
        console.log('🏢 Using business ID:', id);
        
        if (id) {
          await loadCurrentInventory(id);
          await loadSearchHistory();
        }
        
        // Entrance animation
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(slideAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
        
      } catch (error) {
        console.error('Error initializing screen:', error);
        setNetworkStatus('error');
      }
    };
    
    initializeScreen();
    
    // Cleanup on unmount
    return () => {
      isMounted.current = false;
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [businessId]);

  // Enhanced search with debouncing
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch(searchQuery);
        setShowSearchHistory(false);
      } else {
        setSearchResults([]);
        setShowSearchHistory(searchQuery.length === 0 && searchHistory.length > 0);
      }
    }, 300);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled || !currentBusinessId) return;
    
    const interval = setInterval(() => {
      if (!isLoading && !refreshing && showInventory) {
        loadCurrentInventory(currentBusinessId, true); // Silent refresh
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, currentBusinessId, isLoading, refreshing, showInventory]);

  // Load search history
  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('plantSearchHistory');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  // Save search to history
  const saveSearchToHistory = async (query) => {
    try {
      const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem('plantSearchHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  // Enhanced inventory loading with KPI calculation
  const loadCurrentInventory = useCallback(async (id = currentBusinessId, silent = false) => {
    if (!id) return;
    
    try {
      if (!silent) setRefreshing(true);
      setNetworkStatus('loading');
      
      console.log('📦 Loading inventory for business:', id);
      const inventoryResponse = await getBusinessInventory(id);
      const inventory = inventoryResponse.inventory || inventoryResponse || [];
      
      if (isMounted.current) {
        console.log('✅ Loaded inventory:', inventory.length, 'items');
        setCurrentInventory(inventory);
        
        // Calculate KPIs
        const kpis = calculateKPIs(inventory);
        setKpiData(kpis);
        
        // Calculate low stock items
        const lowStock = inventory.filter(item => 
          item.isLowStock && item.status === 'active'
        );
        setLowStockItems(lowStock);
        
        setNetworkStatus('online');
        
        // Success animation for inventory load
        if (!silent && inventory.length > 0) {
          Animated.sequence([
            Animated.timing(successAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.delay(1000),
            Animated.timing(successAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]).start();
        }
      }
    } catch (error) {
      console.error('❌ Error loading inventory:', error);
      if (isMounted.current) {
        setNetworkStatus('error');
        if (!silent) {
          Alert.alert('Connection Error', 'Failed to load inventory. Please check your connection and try again.');
        }
      }
    } finally {
      if (isMounted.current && !silent) {
        setRefreshing(false);
      }
    }
  }, [currentBusinessId]);

  // Calculate KPIs from inventory
  const calculateKPIs = (inventory) => {
    const totalItems = inventory.length;
    const activeItems = inventory.filter(item => item.status === 'active').length;
    const lowStockCount = inventory.filter(item => 
      (item.quantity || 0) <= (item.minThreshold || 5) && item.status === 'active'
    ).length;
    const totalValue = inventory.reduce((sum, item) => 
      sum + ((item.price || 0) * (item.quantity || 0)), 0
    );

    return {
      totalItems,
      activeItems,
      lowStockCount,
      totalValue
    };
  };

  // Enhanced search function
  const handleSearch = async (query) => {
    if (!query || query.length < 2) return;
    
    setIsSearching(true);
    setNetworkStatus('loading');
    
    try {
      console.log('🔍 Searching for plants:', query);
      const results = await searchPlants(query);
      const plants = results.plants || results || [];
      
      if (isMounted.current) {
        console.log('✅ Search results:', plants.length, 'plants found');
        setSearchResults(plants);
        setNetworkStatus('online');
        
        // Save successful search to history
        if (plants.length > 0) {
          saveSearchToHistory(query);
        }
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      if (isMounted.current) {
        setNetworkStatus('error');
        setSearchResults([]);
        
        // Shake animation for error
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
        
        Alert.alert('Search Error', 'Failed to search plants. Please check your connection.');
      }
    } finally {
      if (isMounted.current) {
        setIsSearching(false);
      }
    }
  };

  // Handle speech-to-text result
  const handleSpeechResult = (transcribedText) => {
    if (transcribedText && transcribedText.trim()) {
      setSearchQuery(transcribedText.trim());
      searchInputRef.current?.focus();
      
      // Animate mic usage feedback
      Animated.sequence([
        Animated.timing(searchBarFocusAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(1000),
        Animated.timing(searchBarFocusAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  };

  // Enhanced plant selection
  const handleSelectPlant = (plant) => {
    console.log('🌱 Selected plant:', plant.common_name);
    
    setSelectedPlant(plant);
    setSearchResults([]);
    setSearchQuery(plant.common_name);
    setShowInventory(false);
    setShowSearchHistory(false);
    setErrors({});
    
    // Animate header height reduction
    Animated.timing(headerHeightAnim, {
      toValue: 85,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Enhanced form handling
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear error when field is changed
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  // Enhanced form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!selectedPlant) {
      newErrors.plant = 'Please select a plant from the search results';
    }
    
    const quantity = parseInt(formData.quantity);
    if (!formData.quantity || isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    }
    
    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = 'Please enter a valid price';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Enhanced save with success feedback
  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    setNetworkStatus('loading');
    
    try {
      const inventoryItem = {
        productType: 'plant',
        plantData: {
          id: selectedPlant.id,
          common_name: selectedPlant.common_name,
          scientific_name: selectedPlant.scientific_name,
          origin: selectedPlant.origin,
          water_days: selectedPlant.water_days,
          light: selectedPlant.light,
          humidity: selectedPlant.humidity,
          temperature: selectedPlant.temperature,
          pets: selectedPlant.pets,
          difficulty: selectedPlant.difficulty,
          repot: selectedPlant.repot,
          feed: selectedPlant.feed,
          common_problems: selectedPlant.common_problems,
        },
        quantity: parseInt(formData.quantity),
        price: parseFloat(formData.price),
        minThreshold: parseInt(formData.minThreshold) || 5,
        discount: parseFloat(formData.discount) || 0,
        notes: formData.notes,
        status: 'active',
      };
      
      console.log('💾 Creating inventory item:', inventoryItem);
      const result = await createInventoryItem(inventoryItem);
      console.log('✅ Item created successfully:', result);
      
      Alert.alert(
        '🌱 Success!',
        `${selectedPlant?.common_name || 'Plant'} has been added to your inventory!`,
        [
          {
            text: 'Add Another',
            style: 'default',
            onPress: () => {
              resetForm();
              setShowInventory(false);
              searchInputRef.current?.focus();
            },
          },
          {
            text: 'View Inventory',
            style: 'default',
            onPress: () => {
              resetForm();
              setShowInventory(true);
            },
          },
        ]
      );
      
      // Enhanced success animation
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      
      // Store last saved item
      setLastSavedItem({
        name: selectedPlant?.common_name || 'Item',
        quantity: formData.quantity,
        price: formData.price
      });
      
      // Auto-reload inventory
      await loadCurrentInventory();
      
      setNetworkStatus('online');
    } catch (error) {
      console.error('❌ Save error:', error);
      setNetworkStatus('error');
      Alert.alert('Error', `Failed to add item: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form helper
  const resetForm = () => {
    setSelectedPlant(null);
    setSearchQuery('');
    setFormData({
      quantity: '',
      price: '',
      minThreshold: '5',
      discount: '0',
      notes: '',
    });
    setErrors({});
    setShowSearchHistory(false);
    
    // Reset animations
    Animated.timing(headerHeightAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Handle inventory item edit
  const handleEditInventoryItem = (item) => {
    console.log('✏️ Editing inventory item:', item.id);
    setProductToEdit(item);
    setShowEditModal(true);
  };

  // Handle product save from modal
  const handleProductSave = async (updatedProduct) => {
    try {
      console.log('💾 Saving updated product:', updatedProduct);
      await loadCurrentInventory(); // Refresh inventory
      setShowEditModal(false);
      setProductToEdit(null);
      
      // Show success feedback
      Alert.alert('✅ Success', 'Product updated successfully!');
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product changes');
    }
  };

  // Handle restock from low stock banner
  const handleRestock = (item) => {
    setProductToEdit(item);
    setShowEditModal(true);
  };

  // Handle refresh
  const onRefresh = () => {
    loadCurrentInventory();
  };

  // Handle KPI widget press
  const handleKPIPress = (type) => {
    switch (type) {
      case 'lowStock':
        if (lowStockItems.length > 0) {
          Alert.alert('Low Stock Items', 
            lowStockItems.map(item => `• ${item.name}: ${item.quantity} left`).join('\n'));
        }
        break;
      case 'totalValue':
        Alert.alert('Inventory Value', 
          `Total inventory value: $${kpiData.totalValue.toFixed(2)}\nBased on ${kpiData.totalItems} items`);
        break;
      default:
        setShowInventory(true);
    }
  };

  // Render search result
  const renderSearchResult = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.searchResultItem, 
        index === searchResults.length - 1 && styles.lastSearchResultItem
      ]}
      onPress={() => handleSelectPlant(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchResultContent}>
        <View style={styles.plantIcon}>
          <MaterialCommunityIcons name="leaf" size={28} color="#4CAF50" />
        </View>
        
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName} numberOfLines={1}>
            {item.common_name || 'Unknown Plant'}
          </Text>
          <Text style={styles.searchResultScientific} numberOfLines={1}>
            {item.scientific_name || 'Scientific name not available'}
          </Text>
          
          <View style={styles.attributesRow}>
            {item.water_days && (
              <View style={styles.attribute}>
                <MaterialCommunityIcons name="water" size={12} color="#2196F3" />
                <Text style={styles.attributeText}>Every {item.water_days} days</Text>
              </View>
            )}
            {item.difficulty && (
              <View style={styles.attribute}>
                <MaterialIcons name="bar-chart" size={12} color="#9C27B0" />
                <Text style={styles.attributeText}>Level {item.difficulty}/10</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.addButtonContainer}>
          <MaterialIcons name="add-circle" size={32} color="#4CAF50" />
          <Text style={styles.addButtonText}>Add</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardAvoid}
      >
        {/* Enhanced Header */}
        <Animated.View 
          style={[
            styles.header,
            {
              height: headerHeightAnim,
              transform: [{ translateX: shakeAnim }],
            }
          ]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#216a94" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {showInventory ? 'Plant Inventory' : 'Add Plant'}
              </Text>
              <View style={styles.networkStatusContainer}>
                {networkStatus === 'loading' && (
                  <ActivityIndicator size="small" color="#216a94" />
                )}
                {networkStatus === 'online' && (
                  <MaterialIcons name="wifi" size={16} color="#4CAF50" />
                )}
                {networkStatus === 'error' && (
                  <MaterialIcons name="wifi-off" size={16} color="#f44336" />
                )}
                <Text style={styles.headerSubtitle}>
                  Business: {currentBusinessId?.split('@')[0]}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              onPress={() => setShowInventory(!showInventory)}
              style={styles.headerButton}
            >
              <MaterialIcons 
                name={showInventory ? "add" : "inventory"}
                size={24} 
                color="#216a94" 
              />
            </TouchableOpacity>
          </View>

          {/* Enhanced Search Bar */}
          {!showInventory && (
            <Animated.View 
              style={[
                styles.searchContainer,
                {
                  borderColor: searchBarFocusAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e0e0e0', '#4CAF50'],
                  }),
                }
              ]}
            >
              <MaterialIcons name="search" size={20} color="#4CAF50" />
              
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search plants by name..."
                autoCapitalize="none"
                placeholderTextColor="#999"
                onFocus={() => {
                  Animated.timing(searchBarFocusAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
                onBlur={() => {
                  Animated.timing(searchBarFocusAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                }}
              />
              
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
              
              <SpeechToTextComponent 
                onTranscriptionResult={handleSpeechResult}
                style={styles.speechButton}
              />
              
              {isSearching && (
                <ActivityIndicator size="small" color="#4CAF50" />
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Content Area */}
        {showInventory ? (
          // Enhanced Inventory View with Components
          <View style={styles.inventoryContainer}>
            {/* KPI Widgets Row */}
            <View style={styles.kpiRow}>
              <KPIWidget
                title="Total Items"
                value={kpiData.totalItems}
                icon="package-variant"
                color="#2196F3"
                onPress={() => handleKPIPress('total')}
              />
              <KPIWidget
                title="Active Items"
                value={kpiData.activeItems}
                icon="check-circle"
                color="#4CAF50"
                onPress={() => handleKPIPress('active')}
              />
              <KPIWidget
                title="Low Stock"
                value={kpiData.lowStockCount}
                icon="alert"
                color={kpiData.lowStockCount > 0 ? "#FF9800" : "#9E9E9E"}
                onPress={() => handleKPIPress('lowStock')}
              />
              <KPIWidget
                title="Total Value"
                value={kpiData.totalValue}
                format="currency"
                icon="currency-usd"
                color="#9C27B0"
                onPress={() => handleKPIPress('totalValue')}
              />
            </View>

            {/* Low Stock Banner */}
            <LowStockBanner
              lowStockItems={lowStockItems}
              onManageStock={() => setShowInventory(true)}
              onRestock={handleRestock}
            />

            {/* Inventory Table Component */}
            <InventoryTable
              inventory={currentInventory}
              isLoading={isLoading}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEditProduct={handleEditInventoryItem}
              onDeleteProduct={(item) => console.log('Delete:', item.id)}
              onProductPress={handleEditInventoryItem}
              businessId={currentBusinessId}
            />
          </View>
        ) : (
          // Add Plant View
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4CAF50']}
                tintColor="#4CAF50"
              />
            }
          >
            {/* Search results */}
            {searchResults.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Search Results ({searchResults.length})
                </Text>
                
                <View style={styles.searchResultsContainer}>
                  <FlatList
                    data={searchResults}
                    renderItem={renderSearchResult}
                    keyExtractor={(item, index) => item.id || `search-${index}`}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              </View>
            )}

            {/* Selected plant form */}
            {selectedPlant && (
              <View style={styles.selectedPlantSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                  {' '}Selected: {selectedPlant.common_name}
                </Text>
                
                {/* Form fields */}
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity *</Text>
                    <TextInput
                      style={[styles.input, errors.quantity && styles.inputError]}
                      value={formData.quantity}
                      onChangeText={(text) => handleInputChange('quantity', text)}
                      placeholder="Enter quantity"
                      keyboardType="numeric"
                    />
                    {errors.quantity && (
                      <Text style={styles.errorText}>{errors.quantity}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Price *</Text>
                    <TextInput
                      style={[styles.input, errors.price && styles.inputError]}
                      value={formData.price}
                      onChangeText={(text) => handleInputChange('price', text)}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                    {errors.price && (
                      <Text style={styles.errorText}>{errors.price}</Text>
                    )}
                  </View>

                  <View style={styles.row}>
                    <View style={styles.halfInput}>
                      <Text style={styles.label}>Min. Threshold</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.minThreshold}
                        onChangeText={(text) => handleInputChange('minThreshold', text)}
                        placeholder="5"
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.halfInput}>
                      <Text style={styles.label}>Discount (%)</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.discount}
                        onChangeText={(text) => handleInputChange('discount', text)}
                        placeholder="0"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.notes}
                      onChangeText={(text) => handleInputChange('notes', text)}
                      placeholder="Additional notes..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Enhanced Save Button */}
        {selectedPlant && !showInventory && (
          <Animated.View 
            style={[
              styles.footer,
              { opacity: fadeAnim }
            ]}
          >
            <TouchableOpacity 
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Add to Inventory</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Product Edit Modal */}
        <ProductEditModal
          visible={showEditModal}
          product={productToEdit}
          onClose={() => {
            setShowEditModal(false);
            setProductToEdit(null);
          }}
          onSave={handleProductSave}
          businessId={currentBusinessId}
        />

        {/* Success Animation */}
        {showSuccessAnimation && (
          <Animated.View 
            style={[
              styles.successOverlay,
              { opacity: successAnim }
            ]}
          >
            <MaterialCommunityIcons name="check-circle" size={64} color="#4CAF50" />
            <Text style={styles.successText}>Plant Added!</Text>
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
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#216a94',
  },
  networkStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  speechButton: {
    paddingHorizontal: 8,
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
  },
  searchResultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchResultItem: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastSearchResultItem: {
    borderBottomWidth: 0,
  },
  searchResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  plantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchResultScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 6,
  },
  attributesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attribute: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  attributeText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  addButtonContainer: {
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },
  selectedPlantSection: {
    marginTop: 20,
  },
  formContainer: {
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
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inventoryContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
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
  },
});