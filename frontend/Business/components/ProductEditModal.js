// Business/components/ProductEditModal.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { updateInventoryItem } from '../services/businessApi';

export default function ProductEditModal({
  visible,
  product,
  onClose,
  onSave,
  businessId
}) {
  // Form state
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    minThreshold: '',
    discount: '',
    notes: '',
    status: 'active'
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalData, setOriginalData] = useState({});
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Initialize form data when product changes
  useEffect(() => {
    if (product && visible) {
      const initialData = {
        quantity: product.quantity?.toString() || '',
        price: product.price?.toString() || '',
        minThreshold: product.minThreshold?.toString() || '5',
        discount: product.discount?.toString() || '0',
        notes: product.notes || '',
        status: product.status || 'active'
      };
      
      setFormData(initialData);
      setOriginalData(initialData);
      setErrors({});
      setHasUnsavedChanges(false);
      
      // Entrance animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [product, visible]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = Object.keys(formData).some(
      key => formData[key] !== originalData[key]
    );
    setHasUnsavedChanges(hasChanges);
  }, [formData, originalData]);

  // Exit animation
  const handleClose = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard Changes', 
            style: 'destructive',
            onPress: performClose 
          }
        ]
      );
    } else {
      performClose();
    }
  };

  const performClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      onClose();
      setFormData({
        quantity: '',
        price: '',
        minThreshold: '',
        discount: '',
        notes: '',
        status: 'active'
      });
      setErrors({});
    });
  };

  // Handle input change with validation
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
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

    // Real-time validation
    if (field === 'quantity' && value) {
      const qty = parseInt(value);
      if (isNaN(qty) || qty < 0) {
        setErrors(prev => ({ ...prev, quantity: 'Quantity must be a positive number' }));
      }
    }

    if (field === 'price' && value) {
      const price = parseFloat(value);
      if (isNaN(price) || price <= 0) {
        setErrors(prev => ({ ...prev, price: 'Price must be greater than 0' }));
      }
    }

    if (field === 'discount' && value) {
      const discount = parseFloat(value);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        setErrors(prev => ({ ...prev, discount: 'Discount must be between 0-100%' }));
      }
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    const quantity = parseInt(formData.quantity);
    if (!formData.quantity || isNaN(quantity) || quantity < 0) {
      newErrors.quantity = 'Valid quantity is required';
    }

    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = 'Valid price is required';
    }

    const threshold = parseInt(formData.minThreshold);
    if (formData.minThreshold && (isNaN(threshold) || threshold < 0)) {
      newErrors.minThreshold = 'Minimum threshold must be 0 or greater';
    }

    const discount = parseFloat(formData.discount);
    if (formData.discount && (isNaN(discount) || discount < 0 || discount > 100)) {
      newErrors.discount = 'Discount must be between 0-100%';
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

  // Calculate final price
  const calculateFinalPrice = () => {
    const price = parseFloat(formData.price) || 0;
    const discount = parseFloat(formData.discount) || 0;
    return price - (price * discount / 100);
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const updateData = {
        quantity: parseInt(formData.quantity),
        price: parseFloat(formData.price),
        minThreshold: parseInt(formData.minThreshold) || 5,
        discount: parseFloat(formData.discount) || 0,
        notes: formData.notes,
        status: formData.status
      };

      console.log('Updating product:', product.id, updateData);
      await updateInventoryItem(product.id, updateData);

      Alert.alert(
        '✅ Success',
        'Product updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              onSave && onSave({
                ...product,
                ...updateData,
                finalPrice: calculateFinalPrice()
              });
              performClose();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', `Failed to update product: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [
                  { translateY: slideAnim },
                  { translateX: shakeAnim }
                ],
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons 
                  name={product.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                  size={24} 
                  color="#4CAF50" 
                />
                <View style={styles.headerInfo}>
                  <Text style={styles.headerTitle}>Edit Product</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {product.name || product.common_name || product.productName}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
              <View style={styles.unsavedIndicator}>
                <MaterialIcons name="edit" size={16} color="#FF9800" />
                <Text style={styles.unsavedText}>You have unsaved changes</Text>
              </View>
            )}

            {/* Form Content */}
            <ScrollView 
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quantity */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
                  <Text> Quantity in Stock </Text>
                  <Text style={styles.required}>*</Text>
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
                    <MaterialIcons name="error" size={14} color="#f44336" />
                    <Text> {errors.quantity}</Text>
                  </Text>
                )}
              </View>

              {/* Price */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <MaterialCommunityIcons name="currency-usd" size={16} color="#666" />
                  <Text> Price per Item </Text>
                  <Text style={styles.required}>*</Text>
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
                    <MaterialIcons name="error" size={14} color="#f44336" />
                    <Text> {errors.price}</Text>
                  </Text>
                )}
              </View>

              {/* Row: Min Threshold & Discount */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>
                    <MaterialCommunityIcons name="alert" size={16} color="#666" />
                    <Text> Min. Threshold</Text>
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
                      <MaterialIcons name="error" size={14} color="#f44336" />
                      <Text> {errors.minThreshold}</Text>
                    </Text>
                  )}
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.label}>
                    <MaterialCommunityIcons name="percent" size={16} color="#666" />
                    <Text> Discount (%)</Text>
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
                      <MaterialIcons name="error" size={14} color="#f44336" />
                      <Text> {errors.discount}</Text>
                    </Text>
                  )}
                </View>
              </View>

              {/* Final Price Preview */}
              {formData.price && !errors.price && (
                <View style={styles.pricePreview}>
                  <Text style={styles.pricePreviewLabel}>Final Price:</Text>
                  <Text style={styles.pricePreviewValue}>
                    ${calculateFinalPrice().toFixed(2)}
                  </Text>
                  {parseFloat(formData.discount) > 0 && (
                    <Text style={styles.originalPrice}>
                      (${parseFloat(formData.price).toFixed(2)})
                    </Text>
                  )}
                </View>
              )}

              {/* Status */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <MaterialCommunityIcons name="toggle-switch" size={16} color="#666" />
                  <Text> Product Status</Text>
                </Text>
                <View style={styles.statusContainer}>
                  {['active', 'inactive', 'discontinued'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        formData.status === status && styles.statusOptionActive
                      ]}
                      onPress={() => handleInputChange('status', status)}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        formData.status === status && styles.statusOptionTextActive
                      ]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <MaterialCommunityIcons name="note-text" size={16} color="#666" />
                  <Text> Notes (Optional)</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => handleInputChange('notes', text)}
                  placeholder="Additional notes about this product..."
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#999"
                />
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={16} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  unsavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3e0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unsavedText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 6,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  pricePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  pricePreviewLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  pricePreviewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
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
    fontWeight: '500',
  },
  statusOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
});