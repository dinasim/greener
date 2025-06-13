// components/PlantDetailScreen-parts/ActionButtons.js - FIXED FOR BUSINESS/INDIVIDUAL
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ActionButtons = ({ 
  isFavorite, 
  onFavoritePress, 
  onContactPress, 
  onReviewPress,
  isSending = false,
  isBusiness = false,
  plantName = 'this plant'
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.favoriteActionButton} onPress={onFavoritePress}>
          <MaterialIcons 
            name={isFavorite ? "favorite" : "favorite-border"} 
            size={24} 
            color={isFavorite ? "#f44336" : "#4CAF50"} 
          />
          <Text style={styles.actionButtonText}>{isFavorite ? 'Favorited' : 'Favorite'}</Text>
        </TouchableOpacity>
        
        {/* Different buttons for business vs individual */}
        {isBusiness ? (
          // Business products: Only Order button (opens chat with auto message)
          <TouchableOpacity 
            style={styles.orderButton} 
            onPress={onContactPress}
            disabled={isSending}
            accessible={true}
            accessibilityLabel="Order Product"
            accessibilityRole="button"
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="shopping-cart" size={24} color="#fff" />
                <Text style={styles.orderButtonText}>Order Now</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          // Individual products: Only Contact button (no duplicate)
          <TouchableOpacity 
            style={styles.contactButton} 
            onPress={onContactPress}
            disabled={isSending}
            accessible={true}
            accessibilityLabel="Contact Seller"
            accessibilityRole="button"
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="chat" size={24} color="#fff" />
                <Text style={styles.contactButtonText}>Contact Seller</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.reviewButton} 
        onPress={onReviewPress}
        accessible={true}
        accessibilityLabel="Write a Review"
        accessibilityRole="button"
      >
        <MaterialIcons name="rate-review" size={24} color="#4CAF50" />
        <Text style={styles.reviewButtonText}>
          Write a Review {isBusiness ? 'for Business' : 'for Seller'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.safetyContainer}>
        <MaterialIcons name="shield" size={20} color="#4CAF50" />
        <Text style={styles.safetyText}>
          <Text style={styles.safetyBold}>Safety Tips: </Text>
          {isBusiness 
            ? 'Visit the business location and verify the product before purchase'
            : 'Meet in a public place and inspect the plant before purchasing'
          }
        </Text>
      </View>
      
      {/* Business-specific pickup info */}
      {isBusiness && (
        <View style={styles.pickupContainer}>
          <MaterialIcons name="store" size={20} color="#4CAF50" />
          <Text style={styles.pickupText}>
            <Text style={styles.pickupBold}>Pickup: </Text>
            Contact business for pickup arrangements and location details
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  actionsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20, 
    marginBottom: 16 
  },
  favoriteActionButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderColor: '#4CAF50', 
    borderRadius: 8 
  },
  actionButtonText: { 
    fontSize: 16, 
    color: '#4CAF50', 
    marginLeft: 8, 
    fontWeight: '600' 
  },
  contactButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#4CAF50', 
    borderRadius: 8, 
    paddingVertical: 12, 
    paddingHorizontal: 16 
  },
  contactButtonText: { 
    color: '#fff', 
    marginLeft: 8, 
    fontWeight: '600', 
    fontSize: 16 
  },
  orderButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FF9800', 
    borderRadius: 8, 
    paddingVertical: 12, 
    paddingHorizontal: 16 
  },
  orderButtonText: { 
    color: '#fff', 
    marginLeft: 8, 
    fontWeight: '600', 
    fontSize: 16 
  },
  reviewButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16 
  },
  reviewButtonText: { 
    color: '#4CAF50', 
    fontSize: 16,
    marginLeft: 8, 
    fontWeight: '600' 
  },
  safetyContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f0f9f0', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 16 
  },
  safetyText: { 
    fontSize: 14, 
    marginLeft: 8, 
    color: '#555', 
    flex: 1 
  },
  safetyBold: { 
    fontWeight: 'bold', 
    color: '#333' 
  },
  pickupContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff3e0', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 16 
  },
  pickupText: { 
    fontSize: 14, 
    marginLeft: 8, 
    color: '#555', 
    flex: 1 
  },
  pickupBold: { 
    fontWeight: 'bold', 
    color: '#333' 
  },
});

export default ActionButtons;