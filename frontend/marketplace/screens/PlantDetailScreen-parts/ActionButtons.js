// components/PlantDetailScreen-parts/ActionButtons.js - FIXED BUTTON HANDLERS
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ActionButtons = ({ 
  isFavorite = false, 
  onFavoritePress, 
  onContactPress, 
  onOrderPress, // FIXED: Added missing prop
  onReviewPress,
  isSending = false,
  isBusiness = false,
  plant = null
}) => {
  
  console.log('ActionButtons render:', { 
    isBusiness, 
    hasOrderPress: typeof onOrderPress === 'function',
    isSending, 
    plantTitle: plant?.title || plant?.name
  });

  const handleOrderPress = () => {
    console.log('ActionButtons: Order button pressed');
    console.log('ActionButtons: onOrderPress type:', typeof onOrderPress);
    console.log('ActionButtons: isBusiness:', isBusiness);
    
    if (typeof onOrderPress === 'function') {
      try {
        onOrderPress();
        console.log('ActionButtons: onOrderPress called successfully');
      } catch (error) {
        console.error('ActionButtons: Error calling onOrderPress:', error);
      }
    } else {
      console.error('ActionButtons: onOrderPress is not a function:', onOrderPress);
    }
  };

  // FIXED: Use the correct prop name
  const handleFavoritePress = () => {
    console.log('ActionButtons: Favorite button pressed');
    if (typeof onFavoritePress === 'function') {
      onFavoritePress();
    } else {
      console.error('ActionButtons: onFavoritePress is not a function:', onFavoritePress);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Actions</Text>
      
      <View style={styles.buttonContainer}>
        {/* Favorite Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
          onPress={handleFavoritePress}
        >
          <MaterialIcons 
            name={isFavorite ? "favorite" : "favorite-border"} 
            size={20} 
            color={isFavorite ? "#fff" : "#4CAF50"} 
          />
          <Text style={[styles.actionButtonText, isFavorite && styles.favoriteButtonTextActive]}>
            {isFavorite ? 'Favorited' : 'Add to Favorites'}
          </Text>
        </TouchableOpacity>

        {/* Contact Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.contactButton]}
          onPress={onContactPress}
        >
          <MaterialIcons name="chat" size={20} color="#2196F3" />
          <Text style={[styles.actionButtonText, styles.contactButtonText]}>
            Message Seller
          </Text>
        </TouchableOpacity>

        {/* Order Button - only show for business products */}
        {isBusiness && (
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.orderButton,
              isSending && styles.orderButtonDisabled
            ]}
            onPress={handleOrderPress}
            disabled={isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="shopping-cart" size={20} color="#fff" />
            )}
            <Text style={[styles.actionButtonText, styles.orderButtonText]}>
              {isSending ? 'Processing...' : 'Order Product'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Review Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.reviewButton]}
          onPress={onReviewPress}
        >
          <MaterialIcons name="rate-review" size={20} color="#FF9800" />
          <Text style={[styles.actionButtonText, styles.reviewButtonText]}>
            Write Review
          </Text>
        </TouchableOpacity>
      </View>
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
  buttonContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  favoriteButton: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
  },
  favoriteButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  favoriteButtonTextActive: {
    color: '#fff',
  },
  contactButton: {
    backgroundColor: '#fff',
    borderColor: '#2196F3',
  },
  contactButtonText: {
    color: '#2196F3',
  },
  orderButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  orderButtonDisabled: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
  },
  orderButtonText: {
    color: '#fff',
  },
  reviewButton: {
    backgroundColor: '#fff',
    borderColor: '#FF9800',
  },
  reviewButtonText: {
    color: '#FF9800',
  },
});

export default ActionButtons;