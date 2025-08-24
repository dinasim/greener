// Business/screens/AddInventoryScreen.js
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
  RefreshControl,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BusinessLayout from '../components/BusinessLayout';
import * as FileSystem from 'expo-file-system';

// Safe ImagePicker import with web fallback
let ImagePicker;
try {
  ImagePicker = require('expo-image-picker');
} catch (error) {
  console.warn('expo-image-picker not available:', error);
  ImagePicker = {
    launchImageLibraryAsync: () => Promise.resolve({ canceled: true }),
    launchCameraAsync: () => Promise.resolve({ canceled: true }),
    requestMediaLibraryPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    requestCameraPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    getMediaLibraryPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
    MediaTypeOptions: { Images: 'images' }
  };
}

import * as businessPlantApi from '../services/businessPlantApi';
import { uploadImage } from '../../marketplace/services/marketplaceApi';
import SpeechToTextComponent from '../../marketplace/components/SpeechToTextComponent';
import config from '../../marketplace/services/config';

// Business Components
import InventoryTable from '../components/InventoryTable';
import ProductEditModal from '../components/ProductEditModal';
import LowStockBanner from '../components/LowStockBanner';
import KPIWidget from '../components/KPIWidget';

const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

// pull the functions we use (helps with tree-shaking & mocking)
const {
  searchPlantsForBusiness: searchPlants,
  createInventoryItem,
  getBusinessInventory
} = businessPlantApi;

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

  // Product type
  const [productType, setProductType] = useState('plant'); // 'plant' | 'tool' | 'accessory'

  // Manual plant entry toggle
  const [manualPlantMode, setManualPlantMode] = useState(false);

  // UX state
  const [lastSavedItem, setLastSavedItem] = useState(null);
  const [autoRefreshEnabled] = useState(true);
  const [networkStatus, setNetworkStatus] = useState('online');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Images
  const [images, setImages] = useState([]);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const webFileInputRef = useRef(null);

  // Plant care accordion
  const [showCommonProblems, setShowCommonProblems] = useState(false);

  // KPIs
  const [kpiData, setKpiData] = useState({
    totalItems: 0,
    activeItems: 0,
    lowStockCount: 0,
    totalValue: 0
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: '',
    price: '',
    minThreshold: '5',
    discount: '0',
    notes: '',
    category: '',
    brand: '',
    scientificName: '',
    careInstructions: '',
    material: '',
    dimensions: '',
    weight: '',
    // Manual-plant fields
    waterDays: '',
    light: '',
    humidity: '',
    tempMin: '',
    tempMax: '',
    pets: '',
    difficulty: '',
    repot: '',
    feed: '',
    origin: '',
    site: 'indoor',
  });

  const [errors, setErrors] = useState({});
  const [inventoryError, setInventoryError] = useState(null);
  const [isInventoryEmpty, setIsInventoryEmpty] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const headerHeightAnim = useRef(new Animated.Value(100)).current;
  const searchBarFocusAnim = useRef(new Animated.Value(0)).current;

  // Refs
  const debounceTimeout = useRef(null);
  const isMounted = useRef(true);
  const searchInputRef = useRef(null);

  // Helpers
  const calculateKPIs = (inventory) => {
    const totalItems = inventory.length;
    const activeItems = inventory.filter(item => item.status === 'active').length;
    const lowStockCount = inventory.filter(item =>
      (item.quantity || 0) <= (item.minThreshold || 5) && item.status === 'active'
    ).length;
    const totalValue = inventory.reduce((sum, item) =>
      sum + ((item.price || 0) * (item.quantity || 0)), 0
    );
    return { totalItems, activeItems, lowStockCount, totalValue };
  };

  const markEmpty = () => {
    setCurrentInventory([]);
    setKpiData({ totalItems: 0, activeItems: 0, lowStockCount: 0, totalValue: 0 });
    setLowStockItems([]);
    setInventoryError(null);
    setIsInventoryEmpty(true);
    setNetworkStatus('online');
  };

  const loadCurrentInventory = useCallback(async (id = currentBusinessId, silent = false) => {
    if (!id) return;
    try {
      if (!silent) setRefreshing(true);
      setNetworkStatus('loading');
      setInventoryError(null);

      const inventoryResponse = await getBusinessInventory(id);
      const inventory = inventoryResponse?.inventory || inventoryResponse || [];

      if (isMounted.current) {
        if (Array.isArray(inventory) && inventory.length === 0) {
          markEmpty();
        } else {
          setCurrentInventory(inventory);
          const kpis = calculateKPIs(inventory);
          setKpiData(kpis);
          const lowStock = inventory.filter(item => item.isLowStock && item.status === 'active');
          setLowStockItems(lowStock);
          setNetworkStatus('online');
          setIsInventoryEmpty(false);
        }
      }
    } catch (error) {
      console.error('❌ Error loading inventory:', error);
      if (isMounted.current) {
        const msg = String(error?.message || '').toLowerCase();
        if (msg.includes('not found') || msg.includes('404')) {
          markEmpty();
        } else {
          setNetworkStatus('error');
          setCurrentInventory([]);
          setIsInventoryEmpty(false);
          setInventoryError('We couldn’t load your inventory. Please try again.');
          if (!silent) {
            Alert.alert('Connection Error', error.message || 'Failed to load inventory. Please check your connection and try again.');
          }
        }
      }
    } finally {
      if (isMounted.current && !silent) setRefreshing(false);
    }
  }, [currentBusinessId]);

  // Success overlay timing
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  useEffect(() => {
    if (showSuccessAnimation) {
      successAnim.setValue(0);
      Animated.timing(successAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' })
        .start(() => {
          setTimeout(() => {
            Animated.timing(successAnim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' })
              .start(() => setShowSuccessAnimation(false));
          }, 1200);
        });
    }
  }, [showSuccessAnimation, successAnim]);

  // Init
  useEffect(() => {
    const initializeScreen = async () => {
      try {
        let id = businessId;
        if (!id) {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          id = storedBusinessId || email || 'dina2@mail.tau.ac.il';
          await AsyncStorage.setItem('userEmail', id);
          await AsyncStorage.setItem('businessId', id);
          await AsyncStorage.setItem('userType', 'business');
        }

        setCurrentBusinessId(id);

        if (id) {
          await loadCurrentInventory(id);
          await loadSearchHistory();
        }
      } catch (error) {
        console.error('Error initializing screen:', error);
        setNetworkStatus('error');
      }
    };

    initializeScreen();

    return () => {
      isMounted.current = false;
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [businessId, loadCurrentInventory]);

  // Debounced search
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      if (productType === 'plant' && !manualPlantMode && searchQuery.length >= 2) {
        handleSearch(searchQuery);
        setShowSearchHistory(false);
      } else {
        setSearchResults([]);
        setShowSearchHistory(searchQuery.length === 0 && searchHistory.length > 0);
      }
    }, 300);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [searchQuery, productType, manualPlantMode]);

  // Auto-refresh inventory
  useEffect(() => {
    if (!autoRefreshEnabled || !currentBusinessId) return;
    const interval = setInterval(() => {
      if (!isLoading && !refreshing && showInventory) {
        loadCurrentInventory(currentBusinessId, true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, currentBusinessId, isLoading, refreshing, showInventory, loadCurrentInventory]);

  // History
  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('plantSearchHistory');
      if (history) setSearchHistory(JSON.parse(history));
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const saveSearchToHistory = async (query) => {
    try {
      const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem('plantSearchHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  // Search
  const handleSearch = async (query) => {
    if (!query || query.length < 2) return;
    setIsSearching(true);
    setNetworkStatus('loading');
    try {
      const results = await searchPlants(query);
      const plants = results.plants || results || [];
      if (isMounted.current) {
        setSearchResults(plants);
        setNetworkStatus('online');
        if (plants.length > 0) saveSearchToHistory(query);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      if (isMounted.current) {
        setNetworkStatus('error');
        setSearchResults([]);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
        Alert.alert('Search Error', 'Failed to search plants. Please check your connection.');
      }
    } finally {
      if (isMounted.current) setIsSearching(false);
    }
  };

  // Speech-to-text
  const handleSpeechResult = (transcribedText) => {
    if (transcribedText && transcribedText.trim()) {
      setSearchQuery(transcribedText.trim());
      searchInputRef.current?.focus();
      Animated.sequence([
        Animated.timing(searchBarFocusAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.delay(1000),
        Animated.timing(searchBarFocusAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  };

  // Select plant from DB
  const handleSelectPlant = (plant) => {
    setManualPlantMode(false);
    setSelectedPlant(plant);
    setSearchResults([]);
    setSearchQuery(plant.common_name || '');
    setShowInventory(false);
    setShowSearchHistory(false);
    setErrors({});
    setImages([]);
    setFormData(prev => ({
      ...prev,
      name: plant.common_name || '',
      description: plant.careInstructions || `${plant.common_name} - Beautiful indoor plant`,
      quantity: '1',
      price: '',
      minThreshold: '5',
      discount: '0',
      notes: '',
      category: 'Indoor Plants',
      brand: '',
      scientificName: plant.scientific_name || '',
      careInstructions: plant.careInstructions || '',
      // clear manual-only fields so UI displays cleanly if user toggles
      waterDays: plant.water_days ? String(plant.water_days) : '',
      light: plant.light || '',
      humidity: plant.humidity || '',
      tempMin: plant.temperature?.min != null ? String(plant.temperature.min) : '',
      tempMax: plant.temperature?.max != null ? String(plant.temperature.max) : '',
      pets: plant.pets || '',
      difficulty: plant.difficulty != null ? String(plant.difficulty) : '',
      repot: plant.repot || '',
      feed: plant.feed || '',
      origin: plant.origin || '',
      site: 'indoor',
    }));
    Animated.timing(headerHeightAnim, { toValue: 85, duration: 300, useNativeDriver: false }).start();
  };

  // Form change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  // Web file picker
  const handleWebFilePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) {
        Alert.alert('Error', 'Please select an image file');
        return;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        Alert.alert('Error', 'Image size must be less than 5MB');
        return;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'business-product');
        formData.append('contentType', file.type);

        const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          setImages(prev => [...prev, result.url]);
        } else {
          throw new Error('Upload failed');
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
      event.target.value = '';
    } catch (error) {
      console.error('Web image pick error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Mobile gallery
  const pickImageMobile = async () => {
    try {
      if (ImagePicker.getMediaLibraryPermissionsAsync) {
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (newStatus !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
            return;
          }
        }
      }
      if (images.length >= 5) {
        Alert.alert('Too Many Images', 'You can only upload up to 5 images per product');
        return;
      }
      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: false,
        });
      } catch {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }
      if (!result.canceled) {
        const selectedImage = result.assets?.[0]?.uri || result.uri;
        if (selectedImage) {
          setImages(prev => [...prev, selectedImage]);
          if (errors.images) setErrors(prev => ({ ...prev, images: null }));
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  // Camera
  const takePhoto = async () => {
    try {
      setIsImageLoading(true);

      if (Platform.OS === 'web') {
        if (!navigator?.mediaDevices?.getUserMedia) {
          Alert.alert('Not Supported', 'Your browser does not support camera access. Please use the gallery option instead.');
          setIsImageLoading(false);
          return;
        }
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled) {
            const selectedAsset = result.assets?.[0] || { uri: result.uri };
            if (selectedAsset?.uri) {
              setImages(prev => [...prev, selectedAsset.uri]);
              if (errors.images) setErrors(prev => ({ ...prev, images: null }));
            }
          }
        } catch (err) {
          console.error('Camera access error:', err);
          Alert.alert('Camera Access Error', 'Could not access your camera. Please check your browser permissions or use the gallery option instead.');
        }
        setIsImageLoading(false);
        return;
      }

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera permission to take photos');
        setIsImageLoading(false);
        return;
      }

      if (images.length >= 5) {
        Alert.alert('Too Many Images', 'You can only upload up to 5 images per product');
        setIsImageLoading(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const selectedAsset = result.assets?.[0] || { uri: result.uri };
        if (selectedAsset?.uri) {
          setImages(prev => [...prev, selectedAsset.uri]);
          if (errors.images) setErrors(prev => ({ ...prev, images: null }));
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again later.');
    } finally {
      setIsImageLoading(false);
    }
  };

  // Unified picker
  const pickImage = async () => {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
    } else {
      await pickImageMobile();
    }
  };

  // Remove image
  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  // Categories
  const productCategories = {
    plant: [
      'Indoor Plants', 'Outdoor Plants', 'Succulents', 'Herbs', 'Flowering Plants',
      'Trees & Shrubs', 'Aquatic Plants', 'Carnivorous Plants'
    ],
    tool: [
      'Hand Tools', 'Power Tools', 'Watering Equipment', 'Pruning Tools',
      'Soil Tools', 'Measuring Tools', 'Safety Equipment'
    ],
    accessory: [
      'Pots & Planters', 'Fertilizers', 'Soil & Growing Media', 'Plant Supports',
      'Decorative Items', 'Lighting', 'Irrigation Accessories', 'Plant Care Kits'
    ]
  };

  // Validate
  const validateForm = () => {
    const newErrors = {};

    if (productType === 'plant') {
      if (!manualPlantMode && !selectedPlant) {
        newErrors.plant = 'Please select a plant from the search results';
      }
      if (manualPlantMode && !formData.name.trim()) {
        newErrors.name = 'Please enter a plant name';
      }
    } else if (!formData.name.trim()) {
      newErrors.name = 'Please enter a product name';
    }

    const quantity = parseInt(formData.quantity, 10);
    if (!formData.quantity || isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    }

    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = 'Please enter a valid price';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    if (images.length === 0) {
      newErrors.images = 'Please add at least one product image';
    }

    if ((productType === 'tool' || productType === 'accessory') && !formData.description.trim()) {
      newErrors.description = 'Please provide a product description';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Upload images
  const uploadNativeImage = async (uri, mime = 'image/jpeg') => {
  const name = `business-product-${Date.now()}.jpg`;
  const result = await FileSystem.uploadAsync(
    `${API_BASE_URL}/marketplace/uploadImage`,
    uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file', // server expects 'file'
      parameters: { type: 'business-product', contentType: mime },
      headers: { Accept: 'application/json' }, // don't set Content-Type manually
    }
  );

  if (result.status < 200 || result.status >= 300) {
    // helpful debugging:
    console.log('Upload failed:', result.status, result.body);
    throw new Error(`Upload failed (${result.status})`);
  }
  const json = JSON.parse(result.body || '{}');
  if (!json.url) throw new Error('Upload returned no URL');
  return json.url;
};

const prepareImageData = async () => {
  try {
    const uploaded = [];
    for (const uri of images) {
      // already remote? just keep it
      if (/^https?:\/\//i.test(uri)) {
        uploaded.push(uri);
        continue;
      }
      if (Platform.OS === 'web') {
        // on web, images come from <input>; those are uploaded in handleWebFilePick
        // but if a data URL slipped in, bail out gracefully
        throw new Error('Please select an image file via the picker on web.');
      } else {
        const url = await uploadNativeImage(uri);
        uploaded.push(url);
      }
    }
    return uploaded;
  } catch (error) {
    console.error('Error uploading images:', error);
    throw new Error('Image upload failed. Please try again.');
  }
};


  // Save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setNetworkStatus('loading');

    const toNum = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));
    const toFloat = (v, def = 0) => {
      const n = parseFloat(v);
      return isNaN(n) ? def : n;
    };

    try {
      const imageData = await prepareImageData();
      let payload;

      if (productType === 'plant') {
        const isManual = manualPlantMode;

        const manualInfo = {
          id: formData.scientificName || formData.name,
          common_name: formData.name,
          scientific_name: formData.scientificName,
          origin: formData.origin || undefined,
          water_days: toNum(formData.waterDays),
          light: formData.light || undefined,
          humidity: formData.humidity || undefined,
          temperature: (formData.tempMin || formData.tempMax)
            ? { min: toNum(formData.tempMin), max: toNum(formData.tempMax) }
            : undefined,
          pets: formData.pets || undefined,
          difficulty: toNum(formData.difficulty),
          repot: formData.repot || undefined,
          feed: formData.feed || undefined,
          common_problems: [],
        };

        const searchedInfo = selectedPlant && {
          id: selectedPlant.id,
          common_name: selectedPlant.common_name,
          scientific_name: selectedPlant.scientific_name,
          origin: selectedPlant.origin,
          water_days: selectedPlant.water_days,
          light: selectedPlant.light,
          humidity: selectedPlant.humidity,
          temperature: selectedPlant.temperature, // {min, max}
          pets: selectedPlant.pets,
          difficulty: selectedPlant.difficulty,
          repot: selectedPlant.repot,
          feed: selectedPlant.feed,
          common_problems: selectedPlant.common_problems,
        };

        const plantInfo = isManual ? manualInfo : searchedInfo;

        const price = toFloat(formData.price);
        const discountPct = toFloat(formData.discount, 0);
        const finalPrice = price * (1 - (discountPct / 100));

        payload = {
          // Function-required/validated keys
          name: isManual ? formData.name : (selectedPlant?.common_name || ''),
          common_name: isManual ? formData.name : (selectedPlant?.common_name || ''),
          scientific_name: isManual ? formData.scientificName : (selectedPlant?.scientific_name || ''),
          productName: isManual ? formData.name : (selectedPlant?.common_name || ''),
          productType: 'plant',
          category: formData.category || 'Indoor Plants',
          description:
            formData.description ||
            (isManual
              ? `${formData.name} - Beautiful plant`
              : (selectedPlant?.careInstructions || `${selectedPlant?.common_name} - Beautiful plant`)),
          notes: formData.notes,

          quantity: parseInt(formData.quantity, 10),
          originalQuantity: parseInt(formData.quantity, 10),
          price,
          finalPrice,
          discount: discountPct || 0,
          minThreshold: parseInt(formData.minThreshold, 10) || 5,

          status: 'active',
          mainImage: imageData[0],
          images: imageData,
          imageUrls: imageData,

          // Stored verbatim by your create Function:
          plantInfo, // ✅ matches backend
          wateringSchedule: plantInfo?.water_days ? { everyDays: plantInfo.water_days } : {}, // ✅ optional
        };
      } else {
        const price = toFloat(formData.price);
        const discountPct = toFloat(formData.discount, 0);
        const finalPrice = price * (1 - (discountPct / 100));

        payload = {
          productType,
          name: formData.name,
          common_name: formData.name,
          productName: formData.name,
          category: formData.category,
          description: formData.description,
          brand: formData.brand,
          quantity: parseInt(formData.quantity, 10),
          originalQuantity: parseInt(formData.quantity, 10),
          price,
          finalPrice,
          discount: discountPct || 0,
          minThreshold: parseInt(formData.minThreshold, 10) || 5,
          notes: formData.notes,
          status: 'active',
          mainImage: imageData[0],
          images: imageData,
          imageUrls: imageData,
        };
      }

      await createInventoryItem(payload);
      const productName =
        productType === 'plant'
          ? (manualPlantMode ? formData.name : selectedPlant?.common_name)
          : formData.name;

      Alert.alert(
        '✅ Success!',
        `${productName || 'Item'} has been added to your inventory with ${images.length} image${images.length > 1 ? 's' : ''}!`,
        [
          { text: 'Add Another', onPress: () => { resetForm(); setShowInventory(false); if (productType === 'plant' && !manualPlantMode) searchInputRef.current?.focus(); } },
          { text: 'View Inventory', onPress: () => { resetForm(); setShowInventory(true); } },
        ]
      );

      setLastSavedItem({
        name: productName || 'Item',
        quantity: formData.quantity,
        price: formData.price,
        imageCount: images.length
      });

      setShowSuccessAnimation(true);
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

  // Reset form
  const resetForm = () => {
    setSelectedPlant(null);
    setSearchQuery('');
    setImages([]);
    setManualPlantMode(false);
    setFormData({
      name: '',
      description: '',
      quantity: '',
      price: '',
      minThreshold: '5',
      discount: '0',
      notes: '',
      category: '',
      brand: '',
      scientificName: '',
      careInstructions: '',
      material: '',
      dimensions: '',
      weight: '',
      waterDays: '',
      light: '',
      humidity: '',
      tempMin: '',
      tempMax: '',
      pets: '',
      difficulty: '',
      repot: '',
      feed: '',
      origin: '',
      site: 'indoor',
    });
    setErrors({});
    setShowSearchHistory(false);
    Animated.timing(headerHeightAnim, { toValue: 100, duration: 300, useNativeDriver: false }).start();
  };

  const renderProductTypeSelector = () => (
    <View style={styles.productTypeSection}>
      <Text style={styles.sectionTitle}>Product Type</Text>

      <View style={styles.productTypeContainer}>
        {[
          { key: 'plant', label: 'Plants', icon: 'leaf', color: '#4CAF50' },
          { key: 'tool', label: 'Tools', icon: 'hammer-wrench', color: '#FF9800' },
          { key: 'accessory', label: 'Accessories', icon: 'flower', color: '#9C27B0' },
        ].map((type) => {
          const isActive = productType === type.key;
          return (
            <TouchableOpacity
              key={type.key}
              style={[styles.productTypeButton, isActive && styles.productTypeButtonActive]}
              onPress={() => {
                if (!isActive) {
                  setProductType(type.key);
                  resetForm();
                  setFormData(prev => ({ ...prev, category: '' }));
                }
              }}
              activeOpacity={0.9}
            >
              <View
                style={[
                  styles.productTypeIcon,
                  { backgroundColor: isActive ? type.color : '#f5f5f5' }
                ]}
              >
                <MaterialCommunityIcons
                  name={type.icon}
                  size={24}
                  color={isActive ? '#fff' : type.color}
                />
              </View>
              <Text
                style={[
                  styles.productTypeLabel,
                  isActive && { color: type.color, fontWeight: 'bold' }
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Toggle between DB search and Manual entry */}
      {productType === 'plant' && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !manualPlantMode && styles.toggleBtnActive]}
            onPress={() => setManualPlantMode(false)}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name="magnify" size={18} color={!manualPlantMode ? '#fff' : '#4CAF50'} />
            <Text style={[styles.toggleBtnText, !manualPlantMode && styles.toggleBtnTextActive]}>
              Search database
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, manualPlantMode && styles.toggleBtnActive]}
            onPress={() => {
              setManualPlantMode(true);
              setSelectedPlant(null);
              setSearchResults([]);
              setSearchQuery('');
            }}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name="pencil" size={18} color={manualPlantMode ? '#fff' : '#4CAF50'} />
            <Text style={[styles.toggleBtnText, manualPlantMode && styles.toggleBtnTextActive]}>
              Manual entry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SEARCH BELOW THE BUTTONS (only when not manual) */}
      {!showInventory && productType === 'plant' && !manualPlantMode && (
        <Animated.View
          style={[
            styles.searchContainer,
            styles.searchBelow,
            {
              borderColor: searchBarFocusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['#e0e0e0', '#4CAF50'],
              }),
            },
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
            onFocus={() =>
              Animated.timing(searchBarFocusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start()
            }
            onBlur={() =>
              Animated.timing(searchBarFocusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start()
            }
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
          <SpeechToTextComponent onTranscriptionResult={handleSpeechResult} style={styles.speechButton} />
          {isSearching && <ActivityIndicator size="small" color="#4CAF50" />}
        </Animated.View>
      )}
    </View>
  );

  // Manual product form (tools/accessories)
  const renderManualProductForm = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        <MaterialCommunityIcons
          name={productType === 'tool' ? 'hammer-wrench' : 'flower'}
          size={20}
          color="#4CAF50"
        />{' '}
        Add {productType === 'tool' ? 'Tool' : 'Accessory'} Details
      </Text>

      {renderImagePicker()}

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={formData.name}
            onChangeText={(text) => handleInputChange('name', text)}
            placeholder={`Enter ${productType} name`}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.categoryContainer}>
            {productCategories[productType].map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  formData.category === category && styles.categoryChipActive
                ]}
                onPress={() => handleInputChange('category', category)}
              >
                <Text style={[
                  styles.categoryChipText,
                  formData.category === category && styles.categoryChipTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea, errors.description && styles.inputError]}
            value={formData.description}
            onChangeText={(text) => handleInputChange('description', text)}
            placeholder={`Describe the ${productType}...`}
            multiline
            numberOfLines={3}
          />
          {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              value={formData.brand}
              onChangeText={(text) => handleInputChange('brand', text)}
              placeholder="Brand name"
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>Material</Text>
            <TextInput
              style={styles.input}
              value={formData.material}
              onChangeText={(text) => handleInputChange('material', text)}
              placeholder="e.g., Plastic, Metal"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Dimensions</Text>
            <TextInput
              style={styles.input}
              value={formData.dimensions}
              onChangeText={(text) => handleInputChange('dimensions', text)}
              placeholder="L x W x H"
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>Weight</Text>
            <TextInput
              style={styles.input}
              value={formData.weight}
              onChangeText={(text) => handleInputChange('weight', text)}
              placeholder="e.g., 1.5 kg"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={[styles.input, errors.quantity && styles.inputError]}
              value={formData.quantity}
              onChangeText={(text) => handleInputChange('quantity', text)}
              placeholder="0"
              keyboardType="numeric"
            />
            {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>Price *</Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              value={formData.price}
              onChangeText={(text) => handleInputChange('price', text)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>
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
  );

  // Manual plant form
  const renderManualPlantForm = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" /> Add Plant Details (Manual)
      </Text>

      {renderImagePicker()}

      <View style={styles.formContainer}>
        {/* Names */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Common Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={formData.name}
            onChangeText={(t) => handleInputChange('name', t)}
            placeholder="e.g., Golden Pothos"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Scientific Name</Text>
          <TextInput
            style={styles.input}
            value={formData.scientificName}
            onChangeText={(t) => handleInputChange('scientificName', t)}
            placeholder="e.g., Epipremnum aureum"
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Plant Category *</Text>
          <View style={styles.categoryContainer}>
            {productCategories.plant.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, formData.category === cat && styles.categoryChipActive]}
                onPress={() => handleInputChange('category', cat)}
              >
                <Text style={[styles.categoryChipText, formData.category === cat && styles.categoryChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
        </View>

        {/* Business fields */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={[styles.input, errors.quantity && styles.inputError]}
              value={formData.quantity}
              onChangeText={(t) => handleInputChange('quantity', t)}
              placeholder="1"
              keyboardType="numeric"
            />
            {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Price *</Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              value={formData.price}
              onChangeText={(t) => handleInputChange('price', t)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>
        </View>

        {/* Care data */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Water every (days)</Text>
            <TextInput style={styles.input} value={formData.waterDays} onChangeText={(t)=>handleInputChange('waterDays',t)} keyboardType="numeric" placeholder="e.g., 7" />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Light</Text>
            <TextInput style={styles.input} value={formData.light} onChangeText={(t)=>handleInputChange('light',t)} placeholder="Bright indirect" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Temp Min (°C)</Text>
            <TextInput style={styles.input} value={formData.tempMin} onChangeText={(t)=>handleInputChange('tempMin',t)} keyboardType="decimal-pad" placeholder="e.g., 15" />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Temp Max (°C)</Text>
            <TextInput style={styles.input} value={formData.tempMax} onChangeText={(t)=>handleInputChange('tempMax',t)} keyboardType="decimal-pad" placeholder="e.g., 30" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Humidity</Text>
            <TextInput style={styles.input} value={formData.humidity} onChangeText={(t)=>handleInputChange('humidity',t)} placeholder="Medium-High" />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Difficulty (1-10)</Text>
            <TextInput style={styles.input} value={formData.difficulty} onChangeText={(t)=>handleInputChange('difficulty',t)} keyboardType="numeric" placeholder="e.g., 3" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Pet Safety</Text>
            <TextInput style={styles.input} value={formData.pets} onChangeText={(t)=>handleInputChange('pets',t)} placeholder="Pet-friendly / Toxic" />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Origin</Text>
            <TextInput style={styles.input} value={formData.origin} onChangeText={(t)=>handleInputChange('origin',t)} placeholder="e.g., SE Asia" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Repot</Text>
            <TextInput style={styles.input} value={formData.repot} onChangeText={(t)=>handleInputChange('repot',t)} placeholder="Every 1-2 years" />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Feed</Text>
            <TextInput style={styles.input} value={formData.feed} onChangeText={(t)=>handleInputChange('feed',t)} placeholder="Monthly in spring" />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes / Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(t) => handleInputChange('description', t)}
            multiline numberOfLines={3}
            placeholder="Anything you want customers to know…"
          />
        </View>
      </View>
    </View>
  );

  // Image picker UI
  const renderImagePicker = () => (
    <View style={styles.imageSection}>
      <Text style={styles.sectionTitle}>
        <MaterialCommunityIcons name="camera" size={20} color="#4CAF50" /> Product Images *
      </Text>

      {Platform.OS === 'web' && (
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFilePick}
        />
      )}

      <View style={styles.imageGrid}>
        {images.map((image, index) => (
          <View key={`${image}-${index}`} style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.selectedImage} />
            <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
              <MaterialIcons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {images.length < 5 && (
          <View style={styles.addImageButtons}>
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage} disabled={isImageLoading}>
              {isImageLoading ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <>
                  <MaterialCommunityIcons name="image-plus" size={32} color="#4CAF50" />
                  <Text style={styles.addImageButtonText}>Gallery</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.addImageButton} onPress={takePhoto} disabled={isImageLoading}>
              {isImageLoading ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera" size={32} color="#4CAF50" />
                  <Text style={styles.addImageButtonText}>Camera</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.imageHint}>
        Add up to 5 high-quality images of your product. First image will be the main display image.
      </Text>

      {errors.images && <Text style={styles.errorText}>{errors.images}</Text>}
    </View>
  );

  // Search result row
  const renderSearchResult = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.searchResultItem, index === searchResults.length - 1 && styles.lastSearchResultItem]}
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

          <View style={{ flexDirection: 'row' }}>
            {!!item.water_days && (
              <View style={[styles.attribute, { marginRight: 8 }]}>
                <MaterialCommunityIcons name="water" size={12} color="#2196F3" />
                <Text style={styles.attributeText}>Every {item.water_days} days</Text>
              </View>
            )}
            {!!item.difficulty && (
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

  const onRefresh = () => {
    loadCurrentInventory();
  };

  const handleEditInventoryItem = (item) => {
    setProductToEdit(item);
    setShowEditModal(true);
  };

  const handleProductSave = async () => {
    try {
      await loadCurrentInventory();
      setShowEditModal(false);
      setProductToEdit(null);
      Alert.alert('✅ Success', 'Product updated successfully!');
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product changes');
    }
  };

  const handleRestock = (item) => {
    setProductToEdit(item);
    setShowEditModal(true);
  };

  // Header title dynamic
  const headerTitle = showInventory
    ? 'Inventory'
    : productType === 'plant'
      ? 'Add Plant'
      : productType === 'tool'
        ? 'Add Tool'
        : 'Add Accessory';

  // Header to inject above the inventory list (FlatList header)
  const InventoryHeader = (
    <View>
      <View style={styles.kpiRow}>
        <KPIWidget title="Total Items" value={kpiData.totalItems} icon="package-variant" color="#2196F3" onPress={() => { }} />
        <KPIWidget title="Active Items" value={kpiData.activeItems} icon="check-circle" color="#4CAF50" onPress={() => { }} />
        <KPIWidget title="Low Stock" value={kpiData.lowStockCount} icon="alert" color={kpiData.lowStockCount > 0 ? "#FF9800" : "#9E9E9E"} onPress={() => { }} />
        <KPIWidget title="Total Value" value={kpiData.totalValue} format="currency" icon="currency-usd" color="#9C27B0" onPress={() => { }} />
      </View>

      <LowStockBanner
        lowStockItems={lowStockItems}
        onManageStock={() => setShowInventory(true)}
        onRestock={handleRestock}
      />
    </View>
  );

  const EmptyInventory = (
    <View style={[styles.emptyState, { marginHorizontal: 16, marginTop: 8 }]}>
      <MaterialCommunityIcons name="inbox" size={56} color="#B0BEC5" />
      <Text style={styles.emptyTitle}>Your inventory is empty</Text>
      <Text style={styles.emptySubtitle}>Add your first product to get started.</Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowInventory(false)}>
        <MaterialIcons name="add" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Add an item</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BusinessLayout
      navigation={navigation}
      businessId={currentBusinessId}
      currentTab="inventory"
      badges={{}}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
        {/* Top app header */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.navTitle} numberOfLines={1}>{headerTitle}</Text>
            <View style={styles.subRow}>
              {networkStatus === 'loading' && <ActivityIndicator size="small" color="#216a94" />}
              {networkStatus === 'online' && <MaterialIcons name="wifi" size={16} color="#4CAF50" />}
              {networkStatus === 'error' && <MaterialIcons name="wifi-off" size={16} color="#f44336" />}
              <Text style={styles.subText}>Business: {currentBusinessId?.split('@')[0]}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowInventory(prev => !prev)}
              accessibilityLabel={showInventory ? 'Add item' : 'View inventory'}
            >
              <MaterialIcons name={showInventory ? 'add' : 'inventory'} size={22} color="#216a94" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
          {/* Content */}
          {showInventory ? (
            // Let InventoryTable's FlatList be the only scroller.
            <InventoryTable
              inventory={currentInventory}
              isLoading={isLoading}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEditProduct={handleEditInventoryItem}
              onDeleteProduct={(item) => console.log('Delete:', item.id)}
              onProductPress={handleEditInventoryItem}
              businessId={currentBusinessId}
              error={inventoryError}
              ListHeaderComponent={InventoryHeader}
              ListEmptyComponent={isInventoryEmpty && !inventoryError ? EmptyInventory : null}
            />
          ) : (
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} tintColor="#4CAF50" />
              }
            >
              {renderProductTypeSelector()}

              {/* PLANTS: DB search path */}
              {productType === 'plant' && !manualPlantMode && (
                <>
                  {searchResults.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Search Results ({searchResults.length})</Text>
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

                  {selectedPlant && (
                    <View style={styles.selectedPlantSection}>
                      <Text style={styles.sectionTitle}>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" /> Selected: {selectedPlant.common_name}
                      </Text>

                      {/* Plant care info */}
                      <View style={styles.plantCareSection}>
                        <Text style={styles.sectionTitle}>
                          <MaterialCommunityIcons name="information" size={20} color="#4CAF50" /> Plant Care Information (Auto-filled)
                        </Text>

                        <View style={styles.careInfoGrid}>
                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="water" size={20} color="#2196F3" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Watering</Text>
                              <Text style={styles.careInfoValue}>
                                {selectedPlant.water_days ? `Every ${selectedPlant.water_days} days` : 'Not specified'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="weather-sunny" size={20} color="#FFC107" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Light</Text>
                              <Text style={styles.careInfoValue}>{selectedPlant.light || 'Not specified'}</Text>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="thermometer" size={20} color="#FF5722" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Temperature</Text>
                              <Text style={styles.careInfoValue}>
                                {selectedPlant.temperature
                                  ? `${selectedPlant.temperature.min}°C - ${selectedPlant.temperature.max}°C`
                                  : 'Not specified'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="water-percent" size={20} color="#00BCD4" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Humidity</Text>
                              <Text style={styles.careInfoValue}>{selectedPlant.humidity || 'Not specified'}</Text>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}>
                              <MaterialCommunityIcons
                                name={selectedPlant.pets === 'Pet-friendly' ? 'paw' : 'paw-off'}
                                size={20}
                                color={selectedPlant.pets === 'Pet-friendly' ? '#4CAF50' : '#FF5722'}
                              />
                            </View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Pet Safety</Text>
                              <Text style={[styles.careInfoValue, { color: selectedPlant.pets === 'Pet-friendly' ? '#4CAF50' : '#FF5722' }]}>
                                {selectedPlant.pets || 'Not specified'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="chart-line" size={20} color="#9C27B0" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Care Difficulty</Text>
                              <View style={styles.difficultyContainer}>
                                <Text style={styles.careInfoValue}>Level {selectedPlant.difficulty || 'N/A'}/10</Text>
                                {!!selectedPlant.difficulty && (
                                  <View style={styles.difficultyBar}>
                                    <View
                                      style={[
                                        styles.difficultyFill,
                                        {
                                          width: `${(selectedPlant.difficulty / 10) * 100}%`,
                                          backgroundColor:
                                            selectedPlant.difficulty <= 3 ? '#4CAF50' :
                                              selectedPlant.difficulty <= 6 ? '#FFC107' : '#FF5722'
                                        }
                                      ]}
                                    />
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="flower" size={20} color="#795548" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Repotting</Text>
                              <Text style={styles.careInfoValue}>{selectedPlant.repot || 'Not specified'}</Text>
                            </View>
                          </View>

                          <View style={styles.careInfoItem}>
                            <View style={styles.careInfoIcon}><MaterialCommunityIcons name="earth" size={20} color="#607D8B" /></View>
                            <View style={styles.careInfoContent}>
                              <Text style={styles.careInfoLabel}>Origin</Text>
                              <Text style={styles.careInfoValue}>{selectedPlant.origin || 'Not specified'}</Text>
                            </View>
                          </View>
                        </View>

                        {selectedPlant.common_problems?.length > 0 && (
                          <View style={styles.commonProblemsSection}>
                            <TouchableOpacity
                              style={styles.commonProblemsHeader}
                              onPress={() => setShowCommonProblems(!showCommonProblems)}
                            >
                              <MaterialCommunityIcons name="alert-circle" size={20} color="#FF9800" />
                              <Text style={styles.commonProblemsTitle}>Common Problems & Solutions</Text>
                              <MaterialCommunityIcons
                                name={showCommonProblems ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#666"
                              />
                            </TouchableOpacity>

                            {showCommonProblems && (
                              <View style={styles.commonProblemsList}>
                                {selectedPlant.common_problems.map((problem, index) => (
                                  <View key={index} style={styles.problemItem}>
                                    <Text style={styles.problemSymptom}>
                                      <MaterialCommunityIcons name="circle" size={6} color="#FF9800" /> {problem.symptom}
                                    </Text>
                                    <Text style={styles.problemCause}>{problem.cause}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        )}

                        <Text style={styles.careInfoNote}>
                          💡 This information is automatically filled from our plant database and will help customers make informed decisions.
                        </Text>
                      </View>

                      {/* Category */}
                      <View style={styles.categorySection}>
                        <Text style={styles.label}>Plant Category *</Text>
                        <Text style={styles.categoryHelper}>Choose the best category for marketplace filtering</Text>
                        <View style={styles.categoryContainer}>
                          {productCategories.plant.map((category) => (
                            <TouchableOpacity
                              key={category}
                              style={[
                                styles.categoryChip,
                                formData.category === category && styles.categoryChipActive
                              ]}
                              onPress={() => handleInputChange('category', category)}
                            >
                              <Text style={[
                                styles.categoryChipText,
                                formData.category === category && styles.categoryChipTextActive
                              ]}>
                                {category}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
                      </View>

                      {/* Images */}
                      {renderImagePicker()}

                      {/* Business fields */}
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
                          {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
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
                          {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
                        </View>

                        <View style={{ flexDirection: 'row' }}>
                          <View style={[styles.halfInput, { marginRight: 12 }]}>
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
                </>
              )}

              {/* PLANTS: Manual entry path */}
              {productType === 'plant' && manualPlantMode && renderManualPlantForm()}

              {/* Tools / Accessories */}
              {productType !== 'plant' && renderManualProductForm()}
            </ScrollView>
          )}

          {/* Save Button (when adding) */}
          {!showInventory && (
            ((productType === 'plant' &&
              ((manualPlantMode && formData.name.trim()) || (!manualPlantMode && selectedPlant))
            ) ||
            (productType !== 'plant' && formData.name.trim())
            ) && (
              <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
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
            )
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
            <Animated.View style={[styles.successOverlay, { opacity: successAnim }]}>
              <MaterialCommunityIcons name="check-circle" size={64} color="#4CAF50" />
              <Text style={styles.successText}>Item Added!</Text>
              {!!lastSavedItem?.imageCount && (
                <Text style={styles.successSubtext}>
                  With {lastSavedItem.imageCount} image{lastSavedItem.imageCount > 1 ? 's' : ''}
                </Text>
              )}
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BusinessLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardAvoid: { flex: 1 },
  navHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: { padding: 8 },
  titleWrap: { flex: 1, marginHorizontal: 8 },
  navTitle: { fontSize: 16, fontWeight: 'bold', color: '#216a94' },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  subText: { fontSize: 12, color: '#666', marginLeft: 4 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { padding: 8, borderRadius: 6, backgroundColor: '#f0f8ff' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
    marginHorizontal: 16
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#333', marginLeft: 8 },
  speechButton: { paddingHorizontal: 8 },

  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16 },

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
  searchResultItem: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  lastSearchResultItem: { borderBottomWidth: 0 },
  searchResultContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  plantIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f9f3', justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  searchResultScientific: { fontSize: 14, fontStyle: 'italic', color: '#666', marginBottom: 6 },
  attribute: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  attributeText: { fontSize: 10, color: '#666', marginLeft: 4 },
  addButtonContainer: { alignItems: 'center' },
  addButtonText: { fontSize: 10, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  selectedPlantSection: { marginTop: 20 },

  // Image picker
  imageSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 },
  imageContainer: { position: 'relative', marginRight: 12, marginBottom: 12 },
  selectedImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f5f5f5' },
  removeImageButton: {
    position: 'absolute', top: -8, right: -8, backgroundColor: '#f44336', borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
  },
  addImageButtons: { flexDirection: 'row' },
  addImageButton: {
    width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: '#4CAF50', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f9f3', marginRight: 12
  },
  addImageButtonText: { fontSize: 10, color: '#4CAF50', fontWeight: '600', marginTop: 4 },
  imageHint: { fontSize: 12, color: '#666', fontStyle: 'italic', textAlign: 'center' },

  formContainer: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fafafa' },
  inputError: { borderColor: '#f44336', backgroundColor: '#ffebee' },
  textArea: { height: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  errorText: { color: '#f44336', fontSize: 12, marginTop: 4 },

  inventoryContainer: { flex: 1, backgroundColor: '#f8f9fa' },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },

  successOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  },
  successText: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 16 },
  successSubtext: { fontSize: 14, color: '#fff', marginTop: 8, opacity: 0.8 },

  productTypeSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  productTypeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  productTypeButton: {
    flex: 1, paddingVertical: 12, borderRadius: 8, marginHorizontal: 4, backgroundColor: '#f5f5f5',
    borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center',
  },
  productTypeButtonActive: { backgroundColor: '#4CAF50', borderColor: '#388E3C' },
  productTypeIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  productTypeLabel: { fontSize: 14, color: '#333' },

  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  categoryChip: { backgroundColor: '#f0f9f3', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#4CAF50', marginRight: 8, marginBottom: 8 },
  categoryChipActive: { backgroundColor: '#4CAF50' },
  categoryChipText: { color: '#4CAF50', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },

  plantCareSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  searchBelow: {
    marginTop: 12,
    marginHorizontal: 0,
  },
  careInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 },
  careInfoItem: {
    flexDirection: 'row', width: '48%', alignItems: 'center', backgroundColor: '#f9f9f9',
    borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e8e8e8', marginRight: '4%'
  },
  careInfoIcon: {
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  careInfoContent: { flex: 1 },
  careInfoLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  careInfoValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  difficultyContainer: { alignItems: 'flex-start' },
  difficultyBar: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e0e0e0', overflow: 'hidden', marginTop: 4 },
  difficultyFill: { height: '100%', borderRadius: 3 },
  commonProblemsSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 16 },
  commonProblemsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8,
    backgroundColor: '#fff8e1', borderRadius: 8, paddingHorizontal: 12, marginBottom: 8,
  },
  commonProblemsTitle: { fontSize: 14, fontWeight: '600', color: '#E65100', flex: 1, marginLeft: 8 },
  commonProblemsList: { backgroundColor: '#fafafa', borderRadius: 8, padding: 12 },
  problemItem: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  problemSymptom: { fontSize: 14, color: '#E65100', fontWeight: '600', marginBottom: 4 },
  problemCause: { fontSize: 13, color: '#666', fontStyle: 'italic', paddingLeft: 12 },
  careInfoNote: {
    fontSize: 12, color: '#4CAF50', fontStyle: 'italic', textAlign: 'center', marginTop: 16, paddingHorizontal: 16,
    paddingVertical: 8, backgroundColor: '#f0f9f3', borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50',
  },
  categorySection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  categoryHelper: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f5',
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', color: '#37474F' },
  emptySubtitle: { marginTop: 6, fontSize: 14, color: '#78909C', textAlign: 'center', paddingHorizontal: 16 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#216a94', borderRadius: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },

  errorContainer: { padding: 16, backgroundColor: '#fff3f3', borderRadius: 8, borderWidth: 1, borderColor: '#f44336', marginTop: 16 },

  // Floating action button (exists if you ever re-enable)
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#216a94',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
  },
  inlineSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    width: '100%',
  },
  inlineSearchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: '#333',
  },

  // Manual toggle styles
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50', backgroundColor: '#fff'
  },
  toggleBtnActive: { backgroundColor: '#4CAF50' },
  toggleBtnText: { marginLeft: 8, color: '#4CAF50', fontWeight: '600' },
  toggleBtnTextActive: { color: '#fff' },

  // Footer Save Button
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9eef3',
  },
  saveButton: {
    backgroundColor: '#216a94',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
