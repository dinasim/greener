import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Component for picking and displaying plant images
 * @param {Array} images Array of image URIs
 * @param {Function} onTakePhoto Called when user wants to take a photo
 * @param {Function} onPickImage Called when user wants to pick an image from gallery
 * @param {Function} onRemoveImage Called when user wants to remove an image
 * @param {boolean} isLoading Whether images are being processed
 * @param {string} error Error message if any
 */
const PlantImagePicker = ({ 
  images, 
  onTakePhoto, 
  onPickImage, 
  onRemoveImage,
  isLoading = false,
  error = null 
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Images <Text style={styles.requiredField}>*</Text></Text>
      <ScrollView horizontal style={styles.imageScroller}>
        {images.map((uri, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri }} style={styles.plantImage} />
            <TouchableOpacity 
              style={styles.removeImageButton} 
              onPress={() => onRemoveImage(index)}
            >
              <MaterialIcons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
        ))}
        
        {images.length < 5 && (
          <View style={styles.imageActionButtons}>
            <TouchableOpacity 
              style={styles.addImageButton} 
              onPress={onPickImage}
              disabled={isLoading}
            >
              <MaterialIcons name="add-photo-alternate" size={30} color="#4CAF50" />
              <Text style={styles.addImageText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addImageButton} 
              onPress={onTakePhoto}
              disabled={isLoading}
            >
              <MaterialIcons name="camera-alt" size={30} color="#4CAF50" />
              <Text style={styles.addImageText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.loadingText}>Processing image...</Text>
          </View>
        )}
      </ScrollView>
      
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <Text style={styles.helperText}>
          Add up to 5 images. First image will be the main image.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { 
    marginBottom: 28, 
    padding: 16, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 6, 
    elevation: 2 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 14, 
    color: '#2E7D32' 
  },
  requiredField: { 
    color: '#D32F2F', 
    fontWeight: 'bold' 
  },
  imageScroller: { 
    flexDirection: 'row', 
    marginBottom: 10, 
    minHeight: 110 
  },
  imageContainer: { 
    position: 'relative', 
    marginRight: 12 
  },
  plantImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 12, 
    backgroundColor: '#e0e0e0' 
  },
  removeImageButton: { 
    position: 'absolute', 
    top: 5, 
    right: 5, 
    backgroundColor: '#D32F2F',
    borderRadius: 12, 
    width: 24, 
    height: 24, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  imageActionButtons: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  addImageButton: { 
    width: 100, 
    height: 100, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#BDBDBD',
    borderStyle: 'dashed', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F5F5F5', 
    marginRight: 10 
  },
  addImageText: { 
    marginTop: 4, 
    color: '#388E3C', 
    fontSize: 13, 
    fontWeight: '500' 
  },
  loadingContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginRight: 10
  },
  loadingText: {
    fontSize: 12,
    color: '#388E3C',
    marginTop: 8
  },
  errorText: { 
    color: '#D32F2F', 
    fontSize: 13, 
    marginTop: 4 
  },
  helperText: { 
    color: '#757575', 
    fontSize: 12, 
    marginTop: 4 
  },
});

export default PlantImagePicker;