// Business/BusinessScreens/BusinessProductDetailScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Modal,
  Animated,
  Platform,
  RefreshControl,
  Share,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons, 
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import API services
import { 
  getBusinessInventory, 
  updateInventoryItem, 
  deleteInventoryItem 
} from '../services/businessApi';
import { getBusinessOrders } from '../services/businessOrderApi';

export default function BusinessProductDetailScreen({ navigation, route }) {
  const { productId, businessId: routeBusinessId } = route.params || {};
  
  // Core state
  const [product, setProduct] = useState(null);
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Modals state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [stockHistoryModalVisible, setStockHistoryModalVisible] = useState(false);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    quantity: '',
    price: '',
    minThreshold: '',
    discount: '',
    notes: '',
    status: 'active'
  });
  const [editErrors, setEditErrors] = useState({});
  
  // Analytics data
  const [salesData, setSalesData] = useState({
    totalSold: 0,
    revenue: 0,
    lastSold: null,
    averageOrderSize: 0,
    popularityRank: 0
  });
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  
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
        
        if (id && productId) {
          await loadProductData(id);
        } else {
          setError('Product ID is required');
          setIsLoading(false);
        }
        
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
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
        
      } catch (error) {
        console.error('Error initializing product detail screen:', error);
        setError('Failed to load product details');
        setIsLoading(false);
      }
    };
    
    initScreen();
  }, [businessId, productId]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (businessId && productId) {
        loadProductData(businessId, true); // Silent refresh
      }
    }, [businessId, productId])
  );

  // Load product data
  const loadProductData = async (id = businessId, silent = false) => {
    if (!id || !productId) return;
    
    try {
      if (!silent) {
        setIsLoading(true);
        setRefreshing(true);
      }
      
      console.log(`Loading product details for: ${productId}`);
      
      // Get all inventory to find the specific product
      const inventory = await getBusinessInventory(id);
      const productData = inventory.find(item => item.id === productId);
      
      if (!productData) {
        setError('Product not found');
        return;
      }
      
      setProduct(productData);
      
      // Pre-fill edit form
      setEditForm({
        quantity: productData.quantity?.toString() || '',
        price: productData.price?.toString() || '',
        minThreshold: productData.minThreshold?.toString() || '5',
        discount: productData.discount?.toString() || '0',
        notes: productData.notes || '',
        status: productData.status || 'active'
      });
      
      // Load sales analytics in parallel
      await loadSalesAnalytics(id, productId);
      
      setError(null);
      console.log('Product data loaded successfully');
      
    } catch (error) {
      console.error('Error loading product data:', error);
      if (!silent) {
        setError(`Failed to load product: ${error.message}`);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Load sales analytics
  const loadSalesAnalytics = async (businessId, productId) => {
    try {
      // Get orders that contain this product
      const ordersResponse = await getBusinessOrders(businessId, { status: 'completed' });
      const orders = ordersResponse.orders || [];
      
      // Calculate sales data for this product
      let totalSold = 0;
      let revenue = 0;
      let lastSoldDate = null;
      let orderCount = 0;
      
      orders.forEach(order => {
        const productOrder = order.items?.find(item => item.id === productId);
        if (productOrder) {
          totalSold += productOrder.quantity || 0;
          revenue += productOrder.totalPrice || 0;
          orderCount++;
          
          const orderDate = new Date(order.orderDate);
          if (!lastSoldDate || orderDate > lastSoldDate) {
            lastSoldDate = orderDate;
          }
        }
      });
      
      setSalesData({
        totalSold,
        revenue,
        lastSold: lastSoldDate,
        averageOrderSize: orderCount > 0 ? totalSold / orderCount : 0,
        popularityRank: 0 // This would need more complex calculation
      });
      
    } catch (error) {
      console.error('Error loading sales analytics:', error);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    loadProductData();
  };

  // Handle edit form change
  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is changed
    if (editErrors[field]) {
      setEditErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Validate edit form
  const validateEditForm = () => {
    const errors = {};
    
    const quantity = parseInt(editForm.quantity);
    if (!editForm.quantity || isNaN(quantity) || quantity < 0) {
      errors.quantity = 'Valid quantity is required';
    }
    
    const price = parseFloat(editForm.price);
    if (!editForm.price || isNaN(price) || price <= 0) {
      errors.price = 'Valid price is required';
    }
    
    const threshold = parseInt(editForm.minThreshold);
    if (editForm.minThreshold && (isNaN(threshold) || threshold < 0)) {
      errors.minThreshold = 'Valid threshold is required';
    }
    
    const discount = parseFloat(editForm.discount);
    if (editForm.discount && (isNaN(discount) || discount < 0 || discount > 100)) {
      errors.discount = 'Discount must be between 0-100';
    }
    
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle update product
  const handleUpdateProduct = async () => {
    if (!validateEditForm()) return;
    
    setIsUpdating(true);
    
    try {
      const updateData = {
        quantity: parseInt(editForm.quantity),
        price: parseFloat(editForm.price),
        minThreshold: parseInt(editForm.minThreshold),
        discount: parseFloat(editForm.discount),
        notes: editForm.notes,
        status: editForm.status
      };
      
      console.log('Updating product:', productId, updateData);
      await updateInventoryItem(productId, updateData);
      
      // Show success animation
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(1000),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
      setEditModalVisible(false);
      await loadProductData(); // Refresh data
      
      Alert.alert('✅ Success', 'Product updated successfully!');
      
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', `Failed to update product: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle delete product
  const handleDeleteProduct = async () => {
    setIsUpdating(true);
    
    try {
      console.log('Deleting product:', productId);
      await deleteInventoryItem(productId);
      
      setDeleteModalVisible(false);
      
      Alert.alert(
        '🗑️ Product Deleted',
        'Product has been removed from your inventory',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
      
    } catch (error) {
      console.error('Error deleting product:', error);
      Alert.alert('Error', `Failed to delete product: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle share product
  const handleShareProduct = async () => {
    try {
      const result = await Share.share({
        message: `Check out this ${product.name || product.common_name} for $${product.price} at our plant store!`,
        title: product.name || product.common_name,
      });
    } catch (error) {
      console.error('Error sharing product:', error);
    }
  };

  // Generate barcode data
  const generateBarcodeData = () => {
    return {
      productId: product.id,
      name: product.name || product.common_name,
      scientificName: product.scientific_name,
      price: product.price,
      businessId: businessId,
      qrData: JSON.stringify({
        type: 'plant',
        id: product.id,
        name: product.name || product.common_name,
        scientific_name: product.scientific_name,
        origin: product.plantInfo?.origin,
        water_days: product.plantInfo?.water_days,
        light: product.plantInfo?.light,
        temperature: product.plantInfo?.temperature,
        pets: product.plantInfo?.pets,
        difficulty: product.plantInfo?.difficulty,
        care_tips: product.plantInfo?.common_problems,
      })
    };
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#FF9800';
      case 'discontinued': return '#F44336';
      default: return '#757575';
    }
  };

  // Render loading state
  if (isLoading && !product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading product details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error && !product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProductData()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {product?.name || product?.common_name || 'Product Details'}
          </Text>
          <Text style={styles.headerSubtitle}>
            Stock: {product?.quantity || 0} • ${(product?.price || 0).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleShareProduct}
          >
            <MaterialIcons name="share" size={24} color="#4CAF50" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setEditModalVisible(true)}
          >
            <MaterialIcons name="edit" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
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
        {/* Product Header Card */}
        <Animated.View 
          style={[
            styles.productHeaderCard,
            {
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.productIcon}>
            <MaterialCommunityIcons 
              name={product?.productType === 'plant' ? 'leaf' : 'cube-outline'} 
              size={40} 
              color="#fff" 
            />
          </View>
          
          <View style={styles.productHeaderInfo}>
            <Text style={styles.productName}>
              {product?.name || product?.common_name || 'Unknown Product'}
            </Text>
            {product?.scientific_name && (
              <Text style={styles.productScientific}>
                {product.scientific_name}
              </Text>
            )}
            <View style={styles.productHeaderMeta}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product?.status) }]}>
                <Text style={styles.statusText}>
                  {(product?.status || 'active').charAt(0).toUpperCase() + (product?.status || 'active').slice(1)}
                </Text>
              </View>
              <Text style={styles.productId}>ID: {product?.id}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="inventory" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{product?.quantity || 0}</Text>
            <Text style={styles.statLabel}>In Stock</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={24} color="#2196F3" />
            <Text style={styles.statValue}>${(product?.price || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Price</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="shopping-cart" size={24} color="#FF9800" />
            <Text style={styles.statValue}>{salesData.totalSold}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="trending-up" size={24} color="#9C27B0" />
            <Text style={styles.statValue}>${salesData.revenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>

        {/* Inventory Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="inventory" size={20} color="#4CAF50" />
            {' '}Inventory Details
          </Text>
          
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Current Stock:</Text>
              <Text style={[
                styles.detailValue,
                (product?.quantity || 0) <= (product?.minThreshold || 5) && styles.lowStockText
              ]}>
                {product?.quantity || 0} units
                {(product?.quantity || 0) <= (product?.minThreshold || 5) && ' ⚠️'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Minimum Threshold:</Text>
              <Text style={styles.detailValue}>{product?.minThreshold || 5} units</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Final Price:</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.detailValue}>${(product?.finalPrice || product?.price || 0).toFixed(2)}</Text>
                {product?.discount > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{product.discount}% OFF</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Updated:</Text>
              <Text style={styles.detailValue}>
                {formatDate(product?.lastUpdated || product?.dateAdded)}
              </Text>
            </View>
            
            {product?.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.notesText}>{product.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sales Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="analytics" size={20} color="#4CAF50" />
            {' '}Sales Performance
          </Text>
          
          <View style={styles.analyticsCard}>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>{salesData.totalSold}</Text>
                <Text style={styles.analyticsLabel}>Total Sold</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>${salesData.revenue.toFixed(2)}</Text>
                <Text style={styles.analyticsLabel}>Total Revenue</Text>
              </View>
            </View>
            
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>
                  {salesData.averageOrderSize.toFixed(1)}
                </Text>
                <Text style={styles.analyticsLabel}>Avg Order Size</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>
                  {formatDate(salesData.lastSold)}
                </Text>
                <Text style={styles.analyticsLabel}>Last Sold</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Plant Information (if it's a plant) */}
        {product?.productType === 'plant' && product?.plantInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" />
              {' '}Plant Care Information
            </Text>
            
            <View style={styles.plantInfoCard}>
              <View style={styles.plantInfoGrid}>
                {product.plantInfo.origin && (
                  <View style={styles.plantInfoItem}>
                    <MaterialCommunityIcons name="earth" size={16} color="#8BC34A" />
                    <Text style={styles.plantInfoLabel}>Origin</Text>
                    <Text style={styles.plantInfoValue}>{product.plantInfo.origin}</Text>
                  </View>
                )}
                
                {product.plantInfo.water_days && (
                  <View style={styles.plantInfoItem}>
                    <MaterialCommunityIcons name="water" size={16} color="#2196F3" />
                    <Text style={styles.plantInfoLabel}>Watering</Text>
                    <Text style={styles.plantInfoValue}>Every {product.plantInfo.water_days} days</Text>
                  </View>
                )}
                
                {product.plantInfo.light && (
                  <View style={styles.plantInfoItem}>
                    <MaterialCommunityIcons name="white-balance-sunny" size={16} color="#FF9800" />
                    <Text style={styles.plantInfoLabel}>Light</Text>
                    <Text style={styles.plantInfoValue}>{product.plantInfo.light}</Text>
                  </View>
                )}
                
                {product.plantInfo.difficulty && (
                  <View style={styles.plantInfoItem}>
                    <MaterialIcons name="bar-chart" size={16} color="#9C27B0" />
                    <Text style={styles.plantInfoLabel}>Difficulty</Text>
                    <Text style={styles.plantInfoValue}>{product.plantInfo.difficulty}/10</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setBarcodeModalVisible(true)}
          >
            <MaterialCommunityIcons name="qrcode" size={20} color="#4CAF50" />
            <Text style={styles.actionButtonText}>Generate QR Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setStockHistoryModalVisible(true)}
          >
            <MaterialIcons name="history" size={20} color="#2196F3" />
            <Text style={styles.actionButtonText}>Stock History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => setDeleteModalVisible(true)}
          >
            <MaterialIcons name="delete" size={20} color="#f44336" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete Product</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      {/* Edit Product Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Product</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity *</Text>
                <TextInput
                  style={[styles.modalInput, editErrors.quantity && styles.inputError]}
                  value={editForm.quantity}
                  onChangeText={(text) => handleEditFormChange('quantity', text)}
                  placeholder="Enter quantity"
                  keyboardType="numeric"
                />
                {editErrors.quantity && (
                  <Text style={styles.errorText}>{editErrors.quantity}</Text>
                )}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price *</Text>
                <TextInput
                  style={[styles.modalInput, editErrors.price && styles.inputError]}
                  value={editForm.price}
                  onChangeText={(text) => handleEditFormChange('price', text)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                {editErrors.price && (
                  <Text style={styles.errorText}>{editErrors.price}</Text>
                )}
              </View>
              
              <View style={styles.inputRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Min Threshold</Text>
                  <TextInput
                    style={[styles.modalInput, editErrors.minThreshold && styles.inputError]}
                    value={editForm.minThreshold}
                    onChangeText={(text) => handleEditFormChange('minThreshold', text)}
                    placeholder="5"
                    keyboardType="numeric"
                  />
                  {editErrors.minThreshold && (
                    <Text style={styles.errorText}>{editErrors.minThreshold}</Text>
                  )}
                </View>
                
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Discount %</Text>
                  <TextInput
                    style={[styles.modalInput, editErrors.discount && styles.inputError]}
                    value={editForm.discount}
                    onChangeText={(text) => handleEditFormChange('discount', text)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                  {editErrors.discount && (
                    <Text style={styles.errorText}>{editErrors.discount}</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusContainer}>
                  {['active', 'inactive', 'discontinued'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        editForm.status === status && styles.statusOptionActive
                      ]}
                      onPress={() => handleEditFormChange('status', status)}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        editForm.status === status && styles.statusOptionTextActive
                      ]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  value={editForm.notes}
                  onChangeText={(text) => handleEditFormChange('notes', text)}
                  placeholder="Additional notes..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
                onPress={handleUpdateProduct}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Product</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <MaterialIcons name="warning" size={48} color="#f44336" />
            <Text style={styles.deleteModalTitle}>Delete Product?</Text>
            <Text style={styles.deleteModalText}>
              This action cannot be undone. The product will be permanently removed from your inventory.
            </Text>
            
            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteConfirmButton, isUpdating && styles.saveButtonDisabled]}
                onPress={handleDeleteProduct}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteConfirmButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={barcodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBarcodeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.barcodeModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product QR Code</Text>
              <TouchableOpacity onPress={() => setBarcodeModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.barcodeContent}>
              <View style={styles.qrCodePlaceholder}>
                <MaterialCommunityIcons name="qrcode" size={120} color="#4CAF50" />
                <Text style={styles.qrCodeText}>QR Code for</Text>
                <Text style={styles.qrCodeProductName}>
                  {product?.name || product?.common_name}
                </Text>
              </View>
              
              <View style={styles.barcodeInfo}>
                <Text style={styles.barcodeInfoText}>
                  Print this QR code and place it next to your plant in the store. 
                  Customers can scan it to see detailed plant information even without the app.
                </Text>
              </View>
              
              <TouchableOpacity style={styles.exportButton}>
                <MaterialIcons name="download" size={20} color="#fff" />
                <Text style={styles.exportButtonText}>Export as PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Animation Overlay */}
      {successAnim._value > 0 && (
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
          <Text style={styles.successText}>Product Updated!</Text>
        </Animated.View>
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  productHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  productScientific: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
  productHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productId: {
    fontSize: 12,
    color: '#999',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  lowStockText: {
    color: '#FF9800',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountBadge: {
    backgroundColor: '#f44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    flex: 2,
    textAlign: 'right',
  },
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  analyticsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  analyticsItem: {
    flex: 1,
    alignItems: 'center',
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  plantInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  plantInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  plantInfoItem: {
    flex: 0.48,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  plantInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  plantInfoValue: {
    fontSize: 12,
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  deleteButton: {
    borderColor: '#ffcdd2',
    backgroundColor: '#fff',
  },
  deleteButtonText: {
    color: '#f44336',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  statusOptionText: {
    fontSize: 14,
    color: '#666',
  },
  statusOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f44336',
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  barcodeModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
  },
  barcodeContent: {
    padding: 20,
    alignItems: 'center',
  },
  qrCodePlaceholder: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCodeText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  qrCodeProductName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  barcodeInfo: {
    backgroundColor: '#f0f9f3',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  barcodeInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  },
});
