// components/PlantDetailScreen-parts/SellerCard.js - FIXED VERSION with better name resolution
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import RatingStars from '../../components/RatingStars';

const SellerCard = ({ seller, onPress }) => {
  if (!seller) return null;

  // FIXED: Comprehensive name resolution with proper fallback priority
  const getSellerName = () => {
    // For debugging, log what seller data we have
    console.log('[SellerCard] seller object:', {
      name: seller.name,
      sellerName: seller.sellerName,
      displayName: seller.displayName,
      userName: seller.userName,
      fullName: seller.fullName,
      businessName: seller.businessName,
      email: seller.email
    });

    // Try all possible name fields in order of preference
    const possibleNames = [
      seller.name,
      seller.sellerName,
      seller.displayName,
      seller.userName,
      seller.fullName,
      seller.businessName,
    ].filter(name => name && typeof name === 'string' && name.trim());

    // Return the first non-empty name found
    if (possibleNames.length > 0) {
      const chosenName = possibleNames[0].trim();
      console.log('[SellerCard] using name:', chosenName);
      return chosenName;
    }

    // If we have an email, extract a name from it
    if (seller.email && typeof seller.email === 'string') {
      const emailName = seller.email.split('@')[0];
      if (emailName && emailName !== 'undefined') {
        console.log('[SellerCard] using email-derived name:', emailName);
        return emailName;
      }
    }

    console.log('[SellerCard] falling back to Plant Enthusiast');
    // Only fall back to "Plant Enthusiast" if absolutely no name is available
    return 'Plant Enthusiast';
  };

  const getAvatarUrl = () => {
    if (seller.avatar && typeof seller.avatar === 'string' && seller.avatar.startsWith('http')) {
      return seller.avatar;
    }
    
    const name = getSellerName();
    const firstInitial = name.charAt(0).toUpperCase();
    const bgColor = seller.isBusiness ? '4CAF50' : '9CCC65';
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstInitial)}&background=${bgColor}&color=fff&size=200`;
  };

  const sellerName = getSellerName();
  const displayTitle = seller.isBusiness ? 'About the Business' : 'About the Seller';
  const sellerType = seller.isBusiness ? 'Business' : 'Individual Seller';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{displayTitle}</Text>
      
      <TouchableOpacity style={styles.sellerCard} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.sellerHeader}>
          <Image source={{ uri: getAvatarUrl() }} style={styles.avatar} />
          
          <View style={styles.sellerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.sellerName}>{sellerName}</Text>
              <View style={[styles.badge, seller.isBusiness ? styles.businessBadge : styles.individualBadge]}>
                <MaterialIcons 
                  name={seller.isBusiness ? "store" : "person"} 
                  size={12} 
                  color={seller.isBusiness ? "#4CAF50" : "#2e7d32"} 
                />
                <Text style={[styles.badgeText, seller.isBusiness ? styles.businessBadgeText : styles.individualBadgeText]}>
                  {sellerType}
                </Text>
              </View>
            </View>
            
            {seller.email && (
              <Text style={styles.sellerEmail}>{seller.email}</Text>
            )}
            
            <View style={styles.ratingRow}>
              {seller.rating > 0 ? (
                <>
                  <RatingStars rating={seller.rating || 0} size={14} />
                  <Text style={styles.ratingText}>
                    {(seller.rating || 0).toFixed(1)} ({seller.totalReviews || 0} reviews)
                  </Text>
                </>
              ) : (
                <Text style={styles.noRatingText}>No reviews yet</Text>
              )}
            </View>
          </View>
          
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </View>
        
        {seller.isBusiness && seller.businessName && (
          <View style={styles.businessInfo}>
            <MaterialCommunityIcons name="store-outline" size={16} color="#4CAF50" />
            <Text style={styles.businessName}>{seller.businessName}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sellerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  businessBadge: {
    backgroundColor: '#e8f5e8',
    borderColor: '#C8E6C9',
  },
  individualBadge: {
    backgroundColor: '#F1F8E9',
    borderColor: '#E0E0E0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  businessBadgeText: {
    color: '#2E7D32',
  },
  individualBadgeText: {
    color: '#33691E',
  },
  sellerEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  noRatingText: {
    fontSize: 12,
    color: '#999',
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  businessName: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default SellerCard;