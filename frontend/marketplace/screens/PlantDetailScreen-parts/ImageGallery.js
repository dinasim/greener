// components/PlantDetailScreen-parts/ImageGallery.js
import React, { useState } from 'react';
import { View, Image, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ImageGallery = ({ images, onFavoritePress, onSharePress, isFavorite }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Use placeholder if no images are provided
  const imageUrls = images && images.length > 0 
    ? images 
    : ['https://via.placeholder.com/400?text=Plant'];

  return (
    <View style={styles.imageContainer}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const slideIndex = Math.floor(event.nativeEvent.contentOffset.x / width);
          setActiveImageIndex(slideIndex);
        }}
      >
        {imageUrls.map((image, index) => (
          <Image key={index} source={{ uri: image }} style={styles.image} resizeMode="contain" />
        ))}
      </ScrollView>
      
      {imageUrls.length > 1 && (
        <View style={styles.pagination}>
          {imageUrls.map((_, index) => (
            <View
              key={index}
              style={[styles.paginationDot, activeImageIndex === index && styles.paginationDotActive]}
            />
          ))}
        </View>
      )}
      
      <TouchableOpacity style={styles.favoriteButton} onPress={onFavoritePress}>
        <MaterialIcons 
          name={isFavorite ? "favorite" : "favorite-border"} 
          size={28} 
          color={isFavorite ? "#f44336" : "#fff"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.shareButton} onPress={onSharePress}>
        <MaterialIcons name="share" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: { 
    position: 'relative', 
    height: 250 
  },
  image: { 
    width, 
    height: 250, 
    backgroundColor: '#f0f0f0' 
  },
  pagination: { 
    position: 'absolute', 
    bottom: 10, 
    flexDirection: 'row', 
    alignSelf: 'center' 
  },
  paginationDot: { 
    width: 8, 
    height: 8, 
    margin: 4, 
    backgroundColor: 'rgba(255,255,255,0.6)', 
    borderRadius: 4 
  },
  paginationDotActive: { 
    backgroundColor: '#4CAF50' 
  },
  favoriteButton: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    borderRadius: 50, 
    padding: 10 
  },
  shareButton: { 
    position: 'absolute', 
    top: 20, 
    right: 70, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    borderRadius: 50, 
    padding: 10 
  },
});

export default ImageGallery;