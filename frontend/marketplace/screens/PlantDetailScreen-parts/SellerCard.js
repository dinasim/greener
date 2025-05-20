// components/PlantDetailScreen-parts/SellerCard.js
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SellerCard = ({ seller, onPress }) => {
  // Fallback for avatar
  const getAvatarUrl = () => {
    // Try to get a valid avatar URL from the seller object
    if (seller.avatar && typeof seller.avatar === 'string' && seller.avatar.startsWith('http')) {
      return seller.avatar;
    }
    
    // Create avatar URL from seller's name with better fallback
    const name = seller.name || 'User';
    const initial = name.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=4CAF50&color=fff&size=100`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>About the Seller</Text>
      <TouchableOpacity style={styles.sellerContainer} onPress={onPress}>
        <Image source={{ uri: getAvatarUrl() }} style={styles.sellerAvatar} />
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName}>{seller.name || 'Plant Enthusiast'}</Text>
          {seller.rating && (
            <View style={styles.sellerRatingContainer}>
              <MaterialIcons name="star" size={16} color="#FFC107" />
              <Text style={styles.sellerRating}>
                {typeof seller.rating === 'number' ? seller.rating.toFixed(1) : seller.rating} 
                ({seller.totalReviews || seller.totalSells || 0})
              </Text>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 8
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginVertical: 12, 
    color: '#333' 
  },
  sellerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 12, 
    padding: 16, 
    backgroundColor: '#f9f9f9', 
    borderRadius: 10 
  },
  sellerAvatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#e0e0e0' 
  },
  sellerInfo: { 
    marginLeft: 10, 
    flex: 1 
  },
  sellerName: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  sellerRatingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 4 
  },
  sellerRating: { 
    fontSize: 14, 
    marginLeft: 5, 
    color: '#666' 
  },
});

export default SellerCard;