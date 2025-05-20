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
import { searchPlants, createInventoryItem, getBusinessInventory } from '../services/businessApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SpeechToTextComponent from '../../marketplace/components/SpeechToTextComponent';

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
  const [actualSearchCount, setActualSearchCount] = useState(0);
  
  // Enhanced state for better UX
  const [lastSavedItem, setLastSavedItem] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [networkStatus, setNetworkStatus] = useState('online');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  
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
  const completionAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const headerHeightAnim = useRef(new Animated.Value(100)).current; // Reduced initial height
  const searchBarFocusAnim = useRef(new Animated.Value(0)).current;
  
  // Refs for better performance
  const debounceTimeout = useRef(null);
  const isMounted = useRef(true);
  const searchInputRef = useRef(null);
  
  // Enhanced initialization
  useEffect(() => {
    const initializeScreen = async () => {
      try {
        let id = businessId;
        if (!id) {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email;
          setCurrentBusinessId(id);
        }
        
        if (id) {
          await loadCurrentInventory(id);
          await loadSearchHistory();
        }
        
        // Entrance animation - Web compatible
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

  // Enhanced search with debouncing and history
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
        setActualSearchCount(0);
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

  // Load search history from storage
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

  // Enhanced inventory loading
  const loadCurrentInventory = useCallback(async (id = currentBusinessId, silent = false) => {
    if (!id) return;
    
    try {
      if (!silent) setRefreshing(true);
      setNetworkStatus('loading');
      
      console.log('Loading inventory for business:', id);
      const inventory = await getBusinessInventory(id);
      
      if (isMounted.current) {
        console.log('Loaded inventory:', inventory.length, 'items');
        setCurrentInventory(inventory);
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
      console.error('Error loading inventory:', error);
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

  // Enhanced search function with proper count tracking
  const handleSearch = async (query) => {
    if (!query || query.length < 2) return;
    
    setIsSearching(true);
    setNetworkStatus('loading');
    
    try {
      console.log('Searching for plants by common name:', query);
      const results = await searchPlants(query);
      
      if (isMounted.current) {
        console.log('Search results:', results.length, 'plants found');
        setSearchResults(results);
        setActualSearchCount(results.length); // Track actual count
        setNetworkStatus('online');
        
        // Save successful search to history
        if (results.length > 0) {
          saveSearchToHistory(query);
        }
        
        // Staggered animation for search results
        if (results.length > 0) {
          Animated.stagger(50, 
            results.slice(0, 8).map((_, index) => 
              Animated.timing(new Animated.Value(0), {
                toValue: 1,
                duration: 200,
                useNativeDriver: Platform.OS !== 'web',
              })
            )
          ).start();
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      if (isMounted.current) {
        setNetworkStatus('error');
        setSearchResults([]);
        setActualSearchCount(0);
        
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
        
        Alert.alert('Search Error', 'Failed to search plants. Please check your connection and try again.');
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
    console.log('Selected plant:', plant.common_name);
    
    // Enhanced selection animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
    
    setSelectedPlant(plant);
    setSearchResults([]); // Clear search results immediately
    setSearchQuery(plant.common_name);
    setShowInventory(false);
    setShowSearchHistory(false);
    setErrors({});
    
    // Animate header height reduction
    Animated.timing(headerHeightAnim, {
      toValue: 85, // Even more compact when plant selected
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Enhanced form handling with real-time validation
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Real-time validation
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null,
      }));
    }
    
    // Enhanced validation feedback
    if (field === 'quantity' && value) {
      const qty = parseInt(value);
      if (qty <= 0) {
        setErrors(prev => ({ ...prev, quantity: 'Quantity must be greater than 0' }));
      } else if (qty > 1000) {
        setErrors(prev => ({ ...prev, quantity: 'Quantity seems high. Please verify.' }));
      }
    }
    
    if (field === 'price' && value) {
      const price = parseFloat(value);
      if (price <= 0) {
        setErrors(prev => ({ ...prev, price: 'Price must be greater than 0' }));
      } else if (price > 10000) {
        setErrors(prev => ({ ...prev, price: 'Price seems very high. Please verify.' }));
      }
    }
  };

  // Helper functions
  const formatTemperature = (tempObj) => {
    if (!tempObj || typeof tempObj !== 'object') return 'Room temperature';
    if (tempObj.min && tempObj.max) {
      return `${tempObj.min}°C - ${tempObj.max}°C`;
    }
    return 'Room temperature';
  };

  const formatWaterDays = (days) => {
    if (typeof days === 'number') {
      return `Every ${days} days`;
    }
    return days || 'Weekly';
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
    
    const threshold = parseInt(formData.minThreshold);
    if (formData.minThreshold && (isNaN(threshold) || threshold < 0)) {
      newErrors.minThreshold = 'Minimum threshold must be 0 or greater';
    }
    
    const discount = parseFloat(formData.discount);
    if (formData.discount && (isNaN(discount) || discount < 0 || discount > 100)) {
      newErrors.discount = 'Discount must be between 0 and 100';
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

  // Enhanced save with success animation and auto-refresh
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
      
      console.log('Creating inventory item:', inventoryItem);
      const result = await createInventoryItem(inventoryItem);
      console.log('Item created successfully:', result);
      
      // Enhanced success animation
      setShowSuccessAnimation(true);
      
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setTimeout(() => {
          setShowSuccessAnimation(false);
          Animated.timing(successAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }, 2000);
      });
      
      // Store last saved item for reference
      setLastSavedItem({
        name: selectedPlant.common_name,
        quantity: formData.quantity,
        price: formData.price,
      });
      
      // Reset form with smooth animation
      const resetFormData = {
        quantity: '',
        price: '',
        minThreshold: '5',
        discount: '0',
        notes: '',
      };
      
      // Animate form reset
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setSelectedPlant(null);
        setSearchQuery('');
        setFormData(resetFormData);
        setErrors({});
        
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
        
        // Reset header height
        Animated.timing(headerHeightAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
      
      // Auto-reload inventory
      await loadCurrentInventory();
      
      // Show enhanced success alert
      Alert.alert(
        '🌱 Success!',
        `${selectedPlant?.common_name || 'Plant'} has been added to your inventory!\n\nQuantity: ${formData.quantity}\nPrice: $${formData.price}`,
        [
          {
            text: 'Add Another Plant',
            style: 'default',
            onPress: () => {
              setShowInventory(false);
              searchInputRef.current?.focus();
            },
          },
          {
            text: 'View My Inventory',
            style: 'default',
            onPress: () => {
              setShowInventory(true);
              Animated.timing(slideAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: Platform.OS !== 'web',
              }).start();
            },
          },
        ]
      );
      
      setNetworkStatus('online');
    } catch (error) {
      console.error('Save error:', error);
      setNetworkStatus('error');
      Alert.alert('Error', `Failed to add plant to inventory: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search history selection
  const handleSearchHistorySelect = (historyItem) => {
    setSearchQuery(historyItem);
    setShowSearchHistory(false);
    searchInputRef.current?.focus();
  };

  // Clear search and reset state
  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedPlant(null);
    setSearchResults([]);
    setActualSearchCount(0);
    setShowInventory(false);
    setShowSearchHistory(false);
    setErrors({});
    
    // Reset form data as well
    setFormData({
      quantity: '',
      price: '',
      minThreshold: '5',
      discount: '0',
      notes: '',
    });
    
    // Reset animations
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(headerHeightAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // FIXED: Navigate to Business Home with proper navigation
  const handleGoToBusinessHome = async () => {
    try {
      setShowCompletionAnimation(true);
      
      // Start completion animation
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      
      rotateAnimation.start();
      
      // Mark signup as complete
      await AsyncStorage.setItem('businessSignupComplete', 'true');
      
      // Simulate completion process
      setTimeout(() => {
        rotateAnimation.stop();
        setShowCompletionAnimation(false);
        
        // FIXED: Navigate properly to business navigation
        navigation.reset({
          index: 0,
          routes: [{ name: 'BusinessTabs' }], // Navigate to BusinessTabs instead of BusinessHomeScreen
        });
        
      }, 2000); // Reduced time for better UX
      
    } catch (error) {
      console.error('Error completing signup:', error);
      setShowCompletionAnimation(false);
      Alert.alert('Error', 'Could not complete setup. Please try again.');
    }
  };

  // Show inventory and handle navigation
  const handleShowCurrentInventory = () => {
    setShowInventory(true);
    setSelectedPlant(null);
    setSearchQuery('');
    setShowSearchHistory(false);
    
    // Animate transition
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    
    // Refresh inventory
    loadCurrentInventory();
  };

  // FIXED: Handle inventory item edit
  const handleEditInventoryItem = (item) => {
    console.log('Editing inventory item:', item.id);
    Alert.alert(
      'Edit Item',
      `Edit ${item.name || item.common_name || 'this item'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => {
            // For now, just show a coming soon message
            Alert.alert('Coming Soon', 'Edit functionality will be available in the next update!');
          }
        }
      ]
    );
  };

  // Handle refresh
  const onRefresh = () => {
    loadCurrentInventory();
  };

  // Render search history
  const renderSearchHistory = () => {
    if (!showSearchHistory || searchHistory.length === 0) return null;
    
    return (
      <View style={styles.searchHistoryContainer}>
        <Text style={styles.searchHistoryTitle}>Recent Searches</Text>
        {searchHistory.slice(0, 5).map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.searchHistoryItem}
            onPress={() => handleSearchHistorySelect(item)}
          >
            <MaterialIcons name="history" size={16} color="#666" />
            <Text style={styles.searchHistoryText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // FIXED: Better search result layout with proper spacing
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
          <Text style={styles.searchResultName} numberOfLines={1} ellipsizeMode="tail">
            {item.common_name || 'Unknown Plant'}
          </Text>
          <Text style={styles.searchResultScientific} numberOfLines={1} ellipsizeMode="tail">
            {item.scientific_name || 'Scientific name not available'}
          </Text>
          
          {/* Better organized attributes */}
          <View style={styles.attributesRow}>
          {item.water_days && (
              <View style={styles.attribute}>
                <MaterialCommunityIcons name="water" size={12} color="#2196F3" />
                <Text style={styles.attributeText}>{formatWaterDays(item.water_days)}</Text>
              </View>
            )}
            {item.difficulty && (
              <View style={styles.attribute}>
                <MaterialIcons name="bar-chart" size={12} color="#9C27B0" />
                <Text style={styles.attributeText}>Level {item.difficulty}/10</Text>
              </View>
            )}
          </View>
          
          {item.light && (
            <Text style={styles.lightInfo} numberOfLines={1}>
              💡 {item.light}
            </Text>
          )}
        </View>
        
        <View style={styles.addButtonContainer}>
          <MaterialIcons name="add-circle" size={32} color="#4CAF50" />
          <Text style={styles.addButtonText}>Add</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // FIXED: Render inventory item with working edit button
  const renderInventoryItem = ({ item, index }) => (
    <Animated.View
      style={[
        styles.inventoryItem,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      <View style={styles.inventoryItemHeader}>
        <View style={styles.inventoryIcon}>
          <MaterialCommunityIcons 
            name={item.productType === 'plant' ? 'leaf' : 'tools'} 
            size={20} 
            color="#fff" 
          />
        </View>
        <View style={styles.inventoryItemInfo}>
          <Text style={styles.inventoryItemName} numberOfLines={2}>
            {item.name || item.common_name || item.productName}
          </Text>
          <Text style={styles.inventoryItemScientific} numberOfLines={1}>
            {item.scientific_name || `${item.productType?.charAt(0).toUpperCase()}${item.productType?.slice(1)}`}
          </Text>
        </View>
        <View style={styles.inventoryItemActions}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => handleEditInventoryItem(item)}
          >
            <MaterialIcons name="edit" size={18} color="#2196F3" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.inventoryItemDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Stock</Text>
          <Text style={[
            styles.detailValue,
            item.quantity <= (item.minThreshold || 5) && styles.lowStockText
          ]}>
            {item.quantity || 0}
            {item.quantity <= (item.minThreshold || 5) && ' ⚠️'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>
            ${(item.finalPrice || item.price || 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Status</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: item.status === 'active' ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.statusText}>{item.status || 'active'}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // Rotate interpolation for completion animation
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardAvoid}
      >
        {/* FIXED: Cleaner Header without "Add New" button */}
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
                {showInventory ? 'My Plant Inventory' : 'Add Plant to Inventory'}
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
                <Text style={[
                  styles.headerSubtitle,
                  { color: networkStatus === 'error' ? '#f44336' : '#666' }
                ]}>
                  {showInventory 
                    ? `${currentInventory.length} plants in stock` 
                    : networkStatus === 'error' ? 'Connection error' : 'Search plants by name'
                  }
                </Text>
              </View>
            </View>
            
            {/* FIXED: Only show inventory toggle button */}
            <TouchableOpacity 
              onPress={showInventory ? handleClearSearch : handleShowCurrentInventory}
              style={styles.headerButton}
            >
              <MaterialIcons 
                name={showInventory ? "add" : "inventory"}
                size={24} 
                color="#216a94" 
              />
            </TouchableOpacity>
          </View>

          {/* Enhanced Search Bar with Speech-to-Text */}
          {!showInventory && (
            <Animated.View 
              style={[
                styles.searchContainer,
                {
                  borderColor: searchBarFocusAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e0e0e0', '#4CAF50'],
                  }),
                  borderWidth: searchBarFocusAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2],
                  }),
                }
              ]}
            >
              <MaterialIcons name="search" size={20} color="#4CAF50" style={styles.searchIcon} />
              
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search plants by common name..."
                autoCapitalize="none"
                placeholderTextColor="#999"
                onFocus={() => {
                  Animated.timing(searchBarFocusAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  setShowSearchHistory(searchQuery.length === 0 && searchHistory.length > 0);
                }}
                onBlur={() => {
                  Animated.timing(searchBarFocusAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                  }).start();
                  setTimeout(() => setShowSearchHistory(false), 100);
                }}
              />
              
              {searchQuery ? (
                <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
              
              {/* Speech-to-Text Component */}
              <SpeechToTextComponent 
                onTranscriptionResult={handleSpeechResult}
                style={styles.speechButton}
              />
              
              {isSearching && (
                <ActivityIndicator size="small" color="#4CAF50" style={styles.searchLoader} />
              )}
            </Animated.View>
          )}

          {/* Auto-refresh toggle */}
          {showInventory && (
            <View style={styles.autoRefreshContainer}>
              <TouchableOpacity
                style={styles.autoRefreshToggle}
                onPress={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              >
                <MaterialIcons 
                  name={autoRefreshEnabled ? "sync" : "sync-disabled"} 
                  size={16} 
                  color={autoRefreshEnabled ? "#4CAF50" : "#999"} 
                />
                <Text style={[
                  styles.autoRefreshText,
                  { color: autoRefreshEnabled ? "#4CAF50" : "#999" }
                ]}>
                  Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Error display for search */}
        {errors.plant && (
          <Animated.View 
            style={[
              styles.errorContainer,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            <MaterialIcons name="error" size={16} color="#f44336" />
            <Text style={styles.errorText}>{errors.plant}</Text>
          </Animated.View>
        )}

        {/* Content Area */}
        {showInventory ? (
          // Enhanced Inventory View
          <View style={styles.inventoryContainer}>
            <View style={styles.inventoryHeader}>
              <View style={styles.inventoryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{currentInventory.length}</Text>
                  <Text style={styles.statLabel}>Total Items</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {currentInventory.filter(item => item.status === 'active').length}
                  </Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.warningText]}>
                    {currentInventory.filter(item => item.quantity <= (item.minThreshold || 5)).length}
                  </Text>
                  <Text style={styles.statLabel}>Low Stock</Text>
                </View>
              </View>
              
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity 
                  style={styles.addNewButton}
                  onPress={handleClearSearch}
                >
                  <MaterialIcons name="add" size={16} color="#fff" />
                  <Text style={styles.addNewButtonText}>Add New Plant</Text>
                </TouchableOpacity>
                
                {/* FIXED: Go to Dashboard button with proper navigation */}
                <TouchableOpacity 
                  style={styles.businessHomeButton}
                  onPress={handleGoToBusinessHome}
                  disabled={showCompletionAnimation}
                >
                  {showCompletionAnimation ? (
                    <>
                      <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                        <MaterialCommunityIcons name="storefront" size={16} color="#fff" />
                      </Animated.View>
                      <Text style={styles.businessHomeButtonText}>Setting up...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="storefront" size={16} color="#fff" />
                      <Text style={styles.businessHomeButtonText}>Go to Dashboard</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            
            <FlatList
              data={currentInventory}
              renderItem={renderInventoryItem}
              keyExtractor={(item) => item.id || item._id || Math.random().toString()}
              style={styles.inventoryList}
              contentContainerStyle={styles.inventoryListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#4CAF50']}
                  tintColor="#4CAF50"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyInventory}>
                  <MaterialCommunityIcons name="package-variant-closed" size={64} color="#e0e0e0" />
                  <Text style={styles.emptyInventoryTitle}>No plants yet</Text>
                  <Text style={styles.emptyInventoryText}>
                    Start building your inventory by adding your first plant
                  </Text>
                  <TouchableOpacity 
                    style={styles.addFirstItemButton}
                    onPress={handleClearSearch}
                  >
                    <MaterialCommunityIcons name="leaf" size={20} color="#fff" />
                    <Text style={styles.addFirstItemButtonText}>Add Your First Plant</Text>
                  </TouchableOpacity>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          // FIXED: Better organized Add Plant View with improved spacing
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Search History */}
            {renderSearchHistory()}

            {/* FIXED: Better spaced search results */}
            {searchResults.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Search Results ({actualSearchCount})
                  </Text>
                  <Text style={styles.searchHelpText}>
                    Tap any plant to add it to your inventory
                  </Text>
                </View>
                
                <View style={styles.searchResultsContainer}>
                  <FlatList
                    data={searchResults}
                    renderItem={renderSearchResult}
                    keyExtractor={(item, index) => item.id || item.common_name || `search-item-${index}`}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    style={styles.searchResultsList}
                    ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
                  />
                </View>
              </View>
            )}

            {/* FIXED: Selected plant details moved further down */}
            {selectedPlant && (
              <View style={styles.selectedPlantSection}>
                <Animated.View 
                  style={[
                    styles.selectedPlantContainer,
                    {
                      transform: [{ scale: scaleAnim }],
                    }
                  ]}
                >
                  <Text style={styles.sectionTitle}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                    {' '}Selected Plant
                  </Text>
                  <View style={styles.selectedPlantCard}>
                    <View style={styles.selectedPlantHeader}>
                      <MaterialCommunityIcons name="leaf" size={32} color="#4CAF50" />
                      <View style={styles.selectedPlantInfo}>
                        <Text style={styles.selectedPlantName}>{selectedPlant.common_name}</Text>
                        <Text style={styles.selectedPlantScientific}>
                          {selectedPlant.scientific_name || 'Scientific name not available'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => setSelectedPlant(null)}
                        style={styles.removeButton}
                      >
                        <MaterialIcons name="close" size={20} color="#f44336" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.plantDetailsGrid}>
                      {selectedPlant.origin && (
                        <View style={styles.plantDetailItem}>
                          <MaterialCommunityIcons name="earth" size={16} color="#8BC34A" />
                          <Text style={styles.plantDetailLabel}>Origin</Text>
                          <Text style={styles.plantDetailValue}>{selectedPlant.origin}</Text>
                        </View>
                      )}
                      {selectedPlant.water_days && (
                        <View style={styles.plantDetailItem}>
                          <Ionicons name="water" size={16} color="#2196F3" />
                          <Text style={styles.plantDetailLabel}>Watering</Text>
                          <Text style={styles.plantDetailValue}>{formatWaterDays(selectedPlant.water_days)}</Text>
                        </View>
                      )}
                     {selectedPlant.light && (
                      <View style={styles.plantDetailItem}>
                        <MaterialCommunityIcons name="white-balance-sunny" size={16} color="#FF9800" />
                        <Text style={styles.plantDetailLabel}>Light</Text>
                        <Text style={styles.plantDetailValue}>{selectedPlant.light}</Text>
                      </View>
                    )}
                      {selectedPlant.temperature && (
                        <View style={styles.plantDetailItem}>
                          <MaterialIcons name="thermostat" size={16} color="#F44336" />
                          <Text style={styles.plantDetailLabel}>Temperature</Text>
                          <Text style={styles.plantDetailValue}>{formatTemperature(selectedPlant.temperature)}</Text>
                        </View>
                      )}
                      {selectedPlant.difficulty && (
                        <View style={styles.plantDetailItem}>
                          <MaterialIcons name="bar-chart" size={16} color="#9C27B0" />
                          <Text style={styles.plantDetailLabel}>Difficulty</Text>
                          <Text style={styles.plantDetailValue}>{selectedPlant.difficulty}/10</Text>
                        </View>
                      )}
                       {selectedPlant.pets && (
                      <View style={styles.plantDetailItem}>
                        <MaterialCommunityIcons name="paw" size={16} color="#795548" />
                        <Text style={styles.plantDetailLabel}>Pet Safe</Text>
                        <Text style={styles.plantDetailValue}>{selectedPlant.pets}</Text>
                      </View>
                    )}
                    </View>
                  </View>
                </Animated.View>
                
                {/* Enhanced Form */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>
                    <MaterialCommunityIcons name="clipboard-list" size={20} color="#4CAF50" />
                    {' '}Inventory Details
                  </Text>
                  
                  <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>
                        <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
                        {' '}Quantity in Stock <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.input, errors.quantity && styles.inputError]}
                        value={formData.quantity}
                        onChangeText={(text) => handleInputChange('quantity', text)}
                        placeholder="Enter quantity"
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                      />
                      {errors.quantity && (
                        <Text style={styles.errorText}>
                          <MaterialIcons name="error" size={14} color="#f44336" /> {errors.quantity}
                        </Text>
                      )}
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>
                        <MaterialCommunityIcons name="currency-usd" size={16} color="#666" />
                        {' '}Price per Plant <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.input, errors.price && styles.inputError]}
                        value={formData.price}
                        onChangeText={(text) => handleInputChange('price', text)}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor="#999"
                      />
                      {errors.price && (
                        <Text style={styles.errorText}>
                          <MaterialIcons name="error" size={14} color="#f44336" /> {errors.price}
                        </Text>
                      )}
                    </View>

                    <View style={styles.row}>
                      <View style={styles.halfInput}>
                        <Text style={styles.label}>
                          <MaterialCommunityIcons name="alert" size={16} color="#666" />
                          {' '}Min. Threshold
                        </Text>
                        <TextInput
                          style={[styles.input, errors.minThreshold && styles.inputError]}
                          value={formData.minThreshold}
                          onChangeText={(text) => handleInputChange('minThreshold', text)}
                          placeholder="5"
                          keyboardType="numeric"
                          placeholderTextColor="#999"
                        />
                        {errors.minThreshold && (
                          <Text style={styles.errorText}>
                            <MaterialIcons name="error" size={14} color="#f44336" /> {errors.minThreshold}
                          </Text>
                        )}
                      </View>

                      <View style={styles.halfInput}>
                        <Text style={styles.label}>
                          <MaterialCommunityIcons name="percent" size={16} color="#666" />
                          {' '}Discount (%)
                        </Text>
                        <TextInput
                          style={[styles.input, errors.discount && styles.inputError]}
                          value={formData.discount}
                          onChangeText={(text) => handleInputChange('discount', text)}
                          placeholder="0"
                          keyboardType="decimal-pad"
                          placeholderTextColor="#999"
                        />
                        {errors.discount && (
                          <Text style={styles.errorText}>
                            <MaterialIcons name="error" size={14} color="#f44336" /> {errors.discount}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>
                        <MaterialCommunityIcons name="note-text" size={16} color="#666" />
                        {' '}Notes (Optional)
                      </Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={formData.notes}
                        onChangeText={(text) => handleInputChange('notes', text)}
                        placeholder="Additional notes about this inventory item..."
                        multiline
                        numberOfLines={3}
                        placeholderTextColor="#999"
                      />
                    </View>
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
              {
                transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <TouchableOpacity 
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.8}
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
            <MaterialCommunityIcons name="check-circle" size={64} color="#4CAF50" />
            <Text style={styles.successText}>Plant Added Successfully!</Text>
            {lastSavedItem && (
              <Text style={styles.successDetails}>
                {lastSavedItem.name} • Qty: {lastSavedItem.quantity} • ${lastSavedItem.price}
              </Text>
            )}
          </Animated.View>
        )}

        {/* FIXED: Completion Animation Overlay */}
        {showCompletionAnimation && (
          <Animated.View style={styles.completionOverlay}>
            <Animated.View style={{
              transform: [{ rotate: rotateInterpolate }],
            }}>
              <MaterialCommunityIcons name="store-settings" size={80} color="#216a94" />
            </Animated.View>
            <Text style={styles.completionTitle}>Setting up your business...</Text>
            <Text style={styles.completionSubtitle}>
              We're preparing your dashboard and getting everything ready for you.
            </Text>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, styles.activeDot]} />
              <View style={[styles.dot, { backgroundColor: '#216a94' }]} />
            </View>
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  speechButton: {
    paddingHorizontal: 8,
  },
  searchLoader: {
    marginLeft: 8,
  },
  autoRefreshContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  autoRefreshToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  autoRefreshText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 24, // INCREASE THIS - more space from header
    paddingBottom: 120,
  },
  section: {
    marginBottom: 32, // Increased spacing
    marginTop: 8, // ADD THIS - extra top margin

  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchHelpText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  searchHistoryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  searchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 6,
  },
  searchHistoryText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  // FIXED: Better search results container
  searchResultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginTop: 16, // ADD THIS - creates space from search bar
    zIndex: 1, // ADD THIS - ensures proper layering
  },
  searchResultsList: {
    flexGrow: 0,
  },
  searchResultItem: {
    backgroundColor: '#fff',
  },
  lastSearchResultItem: {
    borderBottomWidth: 0,
  },
  resultSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  // FIXED: Better search result content layout
  searchResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20, // Increased padding
    minHeight: 100, // Increased minimum height
  },
  plantIcon: {
    width: 56, // Larger icon
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  searchResultInfo: {
    flex: 1,
    marginRight: 16,
  },
  searchResultName: {
    fontSize: 17, // Slightly larger
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  searchResultScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
  attributesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  attribute: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  attributeText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  lightInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButtonContainer: {
    alignItems: 'center',
    flexShrink: 0,
  },
  addButtonText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },
  
  // FIXED: Better selected plant section spacing
  selectedPlantSection: {
    marginTop: 40, // More space from search results
  },
  selectedPlantContainer: {
    marginBottom: 24,
  },
  selectedPlantCard: {
    backgroundColor: '#f0f9f3',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    padding: 20, // Increased padding
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedPlantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20, // Increased spacing
  },
  selectedPlantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedPlantName: {
    fontSize: 19, // Larger font
    fontWeight: '700',
    color: '#333',
  },
  selectedPlantScientific: {
    fontSize: 15, // Larger font
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
  },
  removeButton: {
    padding: 10, // Larger touch target
    borderRadius: 20,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  plantDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  plantDetailItem: {
    flex: 0.48,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    padding: 14, // Increased padding
    alignItems: 'center',
  },
  plantDetailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: 6,
  },
  plantDetailValue: {
    fontSize: 12,
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // FIXED: Better form section spacing
  formSection: {
    marginTop: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20, // Increased padding
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  inputGroup: {
    marginBottom: 24, // Increased spacing
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10, // Increased spacing
    flexDirection: 'row',
    alignItems: 'center',
  },
  required: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 16, // Increased padding
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  textArea: {
    height: 90, // Slightly taller
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 16, // Increased gap
  },
  halfInput: {
    flex: 1,
  },
  footer: {
    padding: 20, // Increased padding
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18, // Increased padding
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
  // Enhanced Inventory Styles
  inventoryContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  inventoryHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  inventoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  warningText: {
    color: '#FF9800',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  addNewButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  businessHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  businessHomeButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  inventoryList: {
    flex: 1,
  },
  inventoryListContent: {
    padding: 16,
  },
  inventoryItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inventoryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inventoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
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
    color: '#666',
    marginTop: 2,
  },
  inventoryItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
  },
  inventoryItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  lowStockText: {
    color: '#FF9800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyInventory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyInventoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyInventoryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addFirstItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addFirstItemButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  // Success Animation Overlay
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
  // FIXED: Completion Animation Overlay
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#216a94',
    marginTop: 20,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  progressDots: {
    flexDirection: 'row',
    marginTop: 30,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 6,
  },
  activeDot: {
    backgroundColor: '#4CAF50',
  },
});