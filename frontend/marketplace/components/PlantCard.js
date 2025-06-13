// components/PlantCard.js - FIXED: Clean Grid Layout
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, Platform, Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wishProduct } from '../services/marketplaceApi';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

// Get screen dimensions for responsive design
const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const PlantCard = ({ plant, showActions = true, layout = 'grid', style }) => {
  const navigation = useNavigation();
  const [isWished, setIsWished] = useState(plant.isFavorite || plant.isWished || false);
  const [isWishing, setIsWishing] = useState(false);

  // FIXED: Better navigation with error handling
  const navigateToDetails = useCallback(() => {
    try {
      console.log('🔍 Navigating to plant details:', plant.id);
      
      // Try different navigation approaches
      if (navigation.navigate) {
        // Try PlantDetails first
        try {
          navigation.navigate('PlantDetails', { 
            plant: plant,
            plantId: plant.id || plant._id 
          });
        } catch (detailsError) {
          console.log('PlantDetails not found, trying ProductDetails');
          // Try ProductDetails as fallback
          navigation.navigate('ProductDetails', { 
            product: plant,
            productId: plant.id || plant._id 
          });
        }
      } else {
        console.error('Navigation not available');
        Alert.alert('Error', 'Cannot navigate to product details');
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      Alert.alert('Navigation Error', 'Could not open product details. Please try again.');
    }
  }, [navigation, plant]);

  // FIXED: Enhanced contact navigation with better error handling
  const handleContact = useCallback(async () => {
    try {
      console.log('💬 Starting contact with seller:', plant.sellerId || plant.seller?._id);
      
      const sellerId = plant.sellerId || plant.seller?._id || plant.seller?.email;
      const sellerName = plant.seller?.name || plant.sellerName || 'Seller';
      const plantId = plant.id || plant._id;
      const plantName = plant.title || plant.name || plant.common_name || 'Plant';
      
      if (!sellerId) {
        Alert.alert('Error', 'Seller information not available');
        return;
      }

      // Create auto message
      const autoMessage = `Hi! I'm interested in your ${plantName}. Is it still available?`;
      
      const messageParams = {
        sellerId: sellerId,
        plantId: plantId,
        plantName: plantName,
        sellerName: sellerName,
        autoMessage: autoMessage,
        isBusiness: plant.seller?.isBusiness || plant.sellerType === 'business'
      };

      console.log('📱 Navigating to messages with params:', messageParams);

      // FIXED: Better navigation strategy without canNavigate
      const navigateToMessages = () => {
        try {
          // Try MainTabs first (most common)
          navigation.navigate('MainTabs', {
            screen: 'Messages',
            params: messageParams
          });
        } catch (mainTabsError) {
          try {
            // Try MarketplaceTabs
            navigation.navigate('MarketplaceTabs', {
              screen: 'Messages',
              params: messageParams
            });
          } catch (marketplaceTabsError) {
            try {
              // Try direct Messages navigation
              navigation.navigate('Messages', messageParams);
            } catch (directError) {
              console.error('All navigation attempts failed:', {
                mainTabsError,
                marketplaceTabsError,
                directError
              });
              Alert.alert(
                'Navigation Error', 
                'Could not open messages. Please go to the Messages tab manually.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      };

      navigateToMessages();

    } catch (error) {
      console.error('❌ Contact error:', error);
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    }
  }, [navigation, plant]);

  // FIXED: Order confirmation popup before starting conversation
  const handleOrder = useCallback(async () => {
    try {
      const sellerId = plant.sellerId || plant.seller?._id || plant.seller?.email;
      const sellerName = plant.seller?.name || plant.sellerName || 'Seller';
      const plantId = plant.id || plant._id;
      const plantName = plant.title || plant.name || plant.common_name || 'Plant';
      const price = plant.price || plant.finalPrice || 0;
      const isBusiness = plant.seller?.isBusiness || plant.sellerType === 'business';
      
      if (!sellerId) {
        Alert.alert('Error', 'Seller information not available');
        return;
      }

      // FIXED: Show confirmation popup before starting conversation
      Alert.alert(
        'Confirm Order Interest',
        `Would you like to inquire about ordering "${plantName}" for $${price}?${isBusiness ? '\n\nThis is a business listing - you can arrange pickup directly with the seller.' : ''}`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Yes, Inquire',
            onPress: () => {
              // Create order inquiry message
              const orderMessage = isBusiness 
                ? `Hi! I would like to order "${plantName}" ($${price}). Could you please provide details about pickup arrangements and availability?`
                : `Hi! I'm interested in purchasing your "${plantName}" for $${price}. Is it still available?`;
              
              const messageParams = {
                sellerId: sellerId,
                plantId: plantId,
                plantName: plantName,
                sellerName: sellerName,
                autoMessage: orderMessage,
                isBusiness: isBusiness,
                isOrderInquiry: true
              };

              console.log('🛒 Starting order inquiry with params:', messageParams);

              // Navigate to messages with order inquiry
              try {
                navigation.navigate('MainTabs', {
                  screen: 'Messages',
                  params: messageParams
                });
              } catch (mainTabsError) {
                try {
                  navigation.navigate('MarketplaceTabs', {
                    screen: 'Messages',
                    params: messageParams
                  });
                } catch (marketplaceTabsError) {
                  try {
                    navigation.navigate('Messages', messageParams);
                  } catch (directError) {
                    console.error('Order navigation failed:', {
                      mainTabsError,
                      marketplaceTabsError,
                      directError
                    });
                    Alert.alert(
                      'Navigation Error', 
                      'Could not open messages for order inquiry. Please go to Messages manually.',
                      [{ text: 'OK' }]
                    );
                  }
                }
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Order error:', error);
      Alert.alert('Error', 'Could not process order inquiry. Please try again.');
    }
  }, [navigation, plant]);

  const handleWishToggle = useCallback(async () => {
    if (isWishing) return;
    
    try {
      setIsWishing(true);
      const plantId = plant.id || plant._id;
      
      const result = await wishProduct(plantId);
      
      if (result) {
        const newWishState = !isWished;
        setIsWished(newWishState);
        
        // Trigger update
        triggerUpdate(UPDATE_TYPES.WISHLIST, {
          plantId: plantId,
          isFavorite: newWishState,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      Alert.alert('Error', 'Failed to update wishlist. Please try again.');
    } finally {
      setIsWishing(false);
    }
  }, [plant, isWished, isWishing]);

  const formatPrice = (price) => {
    const numPrice = parseFloat(price);
    return isNaN(numPrice) ? '0' : numPrice.toFixed(0);
  };

  const getPlantImage = () => {
    // Try different image sources
    const imageUrl = plant.image || 
                    plant.mainImage || 
                    (plant.images && plant.images[0]) || 
                    plant.imageUrl;
    
    if (imageUrl && imageUrl.startsWith('http')) {
      return { uri: imageUrl };
    }
    
    // Fallback placeholder - use a better placeholder service
    return { 
      uri: `https://picsum.photos/300/200?random=${plant.id || Math.random()}` 
    };
  };

  const renderSellerInfo = () => {
    const seller = plant.seller || {};
    const sellerName = seller.name || plant.sellerName || 'Plant Seller';
    const isBusiness = seller.isBusiness || plant.sellerType === 'business';
    const location = plant.location?.city || plant.city || 'Location not specified';

    return (
      <View style={styles.sellerContainer}>
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {sellerName}
          </Text>
          {isBusiness && (
            <View style={styles.businessBadge}>
              <MaterialIcons name="store" size={10} color="#FF9800" />
              <Text style={styles.businessText}>Business</Text>
            </View>
          )}
        </View>
        <Text style={styles.location} numberOfLines={1}>
          📍 {location}
        </Text>
      </View>
    );
  };

  // FIXED: Clean card style that works with wrapper
  const cardStyle = [
    styles.card,
    layout === 'list' && styles.listCard,
    isWeb && styles.webCard,
    style // Apply any external styles
  ];

  return (
    <TouchableOpacity style={cardStyle} onPress={navigateToDetails} activeOpacity={0.8}>
      {/* Plant Image */}
      <View style={styles.imageContainer}>
        <Image
          source={getPlantImage()}
          style={[
            styles.image,
            layout === 'list' && styles.listImage
          ]}
          resizeMode="cover"
          onError={(e) => {
            console.log('Image load error:', e.nativeEvent.error);
          }}
        />
        
        {/* Wishlist Button */}
        {showActions && (
          <TouchableOpacity
            style={styles.wishButton}
            onPress={handleWishToggle}
            disabled={isWishing}
          >
            <MaterialIcons
              name={isWished ? 'favorite' : 'favorite-border'}
              size={20}
              color={isWished ? '#ff4444' : '#666'}
            />
          </TouchableOpacity>
        )}

        {/* Business Badge on Image */}
        {(plant.seller?.isBusiness || plant.sellerType === 'business') && (
          <View style={styles.businessImageBadge}>
            <MaterialIcons name="store" size={12} color="#fff" />
            <Text style={styles.businessImageText}>Business</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={2}>
            {plant.title || plant.name || plant.common_name || 'Unnamed Plant'}
          </Text>
          <Text style={styles.price}>
            ${formatPrice(plant.price || plant.finalPrice || 0)}
          </Text>
        </View>

        {plant.description && (
          <Text style={styles.description} numberOfLines={2}>
            {plant.description}
          </Text>
        )}

        {renderSellerInfo()}

        {/* Action Buttons */}
        {showActions && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
              <MaterialIcons name="chat" size={16} color="#4CAF50" />
              <Text style={styles.contactText}>Contact</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.orderButton} onPress={handleOrder}>
              <MaterialIcons name="shopping-cart" size={16} color="#fff" />
              <Text style={styles.orderText}>
                {plant.seller?.isBusiness || plant.sellerType === 'business' ? 'Order' : 'Buy'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
    // FIXED: Remove fixed width - let wrapper control it
  },
  listCard: {
    flexDirection: 'row',
  },
  webCard: {
    // Enhanced shadow for web
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s ease-in-out',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    // FIXED: Use flex instead of fixed dimensions
    width: '100%',
    height: 180,
    backgroundColor: '#f5f5f5',
  },
  listImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    margin: 12,
  },
  wishButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
    zIndex: 1,
  },
  businessImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  businessImageText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  content: {
    padding: 12,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  description: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  sellerContainer: {
    marginVertical: 6,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sellerName: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 6,
  },
  businessText: {
    fontSize: 9,
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 2,
  },
  location: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#f9fff9',
  },
  contactText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  orderText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default PlantCard;