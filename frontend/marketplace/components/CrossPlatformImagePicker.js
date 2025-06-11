// frontend/marketplace/components/CrossPlatformImagePicker.js
import React, { useRef } from 'react';
import { Platform, Alert } from 'react-native';

// Safe ImagePicker import
let ImagePicker = null;
let hasImagePicker = false;

// Initialize ImagePicker only on mobile
if (Platform.OS !== 'web') {
  try {
    ImagePicker = require('expo-image-picker');
    hasImagePicker = true;
  } catch (error) {
    console.warn('expo-image-picker not available:', error);
    hasImagePicker = false;
  }
}

const CrossPlatformImagePicker = ({ 
  onImageSelected, 
  onError,
  children,
  style,
  disabled = false,
  maxSizeKB = 2048 // 2MB default
}) => {
  const fileInputRef = useRef(null);
  
  // Convert file to base64 for web
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };
  
  // Validate image size
  const validateImageSize = (sizeBytes) => {
    const sizeKB = sizeBytes / 1024;
    if (sizeKB > maxSizeKB) {
      throw new Error(`Image size (${sizeKB.toFixed(0)}KB) exceeds maximum allowed size (${maxSizeKB}KB)`);
    }
  };
  
  // Web file picker
  const handleWebFilePick = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      
      // Validate file size
      validateImageSize(file.size);
      
      // Convert to base64 for display and upload
      const base64 = await fileToBase64(file);
      
      // Create blob URL for immediate preview
      const previewUri = URL.createObjectURL(file);
      
      const imageData = {
        uri: previewUri,
        base64: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
        type: file.type,
        name: file.name,
        size: file.size,
        width: null, // Will be determined by image load
        height: null
      };
      
      // Call success callback
      onImageSelected?.(imageData);
      
      // Reset input
      event.target.value = '';
      
    } catch (error) {
      console.error('Web image pick error:', error);
      Alert.alert('Error', error.message || 'Failed to select image');
      onError?.(error);
    }
  };
  
  // Mobile image picker
  const handleMobileImagePick = async () => {
    if (!hasImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this device');
      return;
    }
    
    try {
      // Check permissions
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert('Permission Required', 'Please allow access to photo library');
          return;
        }
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false, // Don't include base64 to save memory
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Validate size if available
        if (asset.fileSize) {
          validateImageSize(asset.fileSize);
        }
        
        const imageData = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}.jpg`,
          size: asset.fileSize || null,
          width: asset.width,
          height: asset.height
        };
        
        onImageSelected?.(imageData);
      }
      
    } catch (error) {
      console.error('Mobile image pick error:', error);
      Alert.alert('Error', error.message || 'Failed to select image');
      onError?.(error);
    }
  };
  
  // Main pick function
  const pickImage = async () => {
    if (disabled) return;
    
    if (Platform.OS === 'web') {
      // Trigger file input on web
      fileInputRef.current?.click();
    } else {
      // Use ImagePicker on mobile
      await handleMobileImagePick();
    }
  };
  
  // Handle children click
  const handlePress = () => {
    pickImage();
  };
  
  return (
    <>
      {/* Web file input - hidden */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFilePick}
        />
      )}
      
      {/* Clickable children */}
      {React.cloneElement(children, {
        onPress: handlePress,
        disabled: disabled,
        style: [children.props.style, style, disabled && { opacity: 0.5 }]
      })}
    </>
  );
};

export default CrossPlatformImagePicker;