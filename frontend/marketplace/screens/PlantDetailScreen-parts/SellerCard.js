// components/PlantDetailScreen-parts/SellerCard.js - FIXED VERSION
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SellerCard = ({ seller, onPress }) => {
  // Determine if this is a business seller
  const isBusiness = seller?.isBusiness || seller?.businessName;
  
  // Fallback for avatar
  const getAvatarUrl = () => {
    // Try to get a valid avatar URL from the seller object
    if (seller.avatar && typeof seller.avatar === 'string' && seller.avatar.startsWith('http')) {
      return seller.avatar;
    }
    
    if (seller.logo && typeof seller.logo === 'string' && seller.logo.startsWith('http')) {
      return seller.logo;
    }
    
    // Create avatar URL from seller's name with better fallback
    const name = seller.businessName || seller.name || 'User';
    const initial = name.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=4CAF50&color=fff&size=100`;
  };

  // Get display name
  const getDisplayName = () => {
    if (isBusiness) {
      return seller.businessName || seller.name || 'Business';
    }
    return seller.name || 'Plant Enthusiast';
  };

  // Get seller type label
  const getSellerTypeLabel = () => {
    if (isBusiness) {
      return seller.businessType || 'Business Seller';
    }
    return 'Individual Seller';
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isBusiness ? 'About the Business' : 'About the Seller'}
        </Text>
        {isBusiness && (
          <View style={styles.businessBadge}>
            <MaterialIcons name="store" size={14} color="#4CAF50" />
            <Text style={styles.businessBadgeText}>Business</Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity style={styles.sellerContainer} onPress={onPress}>
        <Image source={{ uri: getAvatarUrl() }} style={styles.sellerAvatar} />
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName}>{getDisplayName()}</Text>
          <Text style={styles.sellerType}>{getSellerTypeLabel()}</Text>
          
          {seller.rating && (
            <View style={styles.sellerRatingContainer}>
              <MaterialIcons name="star" size={16} color="#FFC107" />
              <Text style={styles.sellerRating}>
                {typeof seller.rating === 'number' ? seller.rating.toFixed(1) : seller.rating} 
                ({seller.totalReviews || seller.totalSells || seller.reviewCount || 0} reviews)
              </Text>
            </View>
          )}
          
          {/* Business-specific info */}
          {isBusiness && seller.location?.city && (
            <View style={styles.locationContainer}>
              <MaterialIcons name="place" size={14} color="#666" />
              <Text style={styles.locationText}>{seller.location.city}</Text>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </TouchableOpacity>
      
      {/* Additional business info */}
      {isBusiness && (
        <View style={styles.businessInfo}>
          <Text style={styles.businessInfoText}>
            🏪 Business listing • Pickup available • Professional service
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 8
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333',
    flex: 1
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  businessBadgeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
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
    fontWeight: 'bold',
    color: '#333'
  },
  sellerType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  businessInfo: {
    backgroundColor: '#f0f9f3',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  businessInfoText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default SellerCard;