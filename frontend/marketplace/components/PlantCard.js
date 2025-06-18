// components/PlantCard.js - Production-Optimized Version
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, Platform, Dimensions, Share
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PropTypes from 'prop-types';
import { wishProduct } from '../services/marketplaceApi';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

// Get screen dimensions for responsive design
const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const PlantCard = React.memo(({ plant, showActions = true, layout = 'grid', style, onContactPress, onOrderPress }) => {
  const navigation = useNavigation();
  const [isWished, setIsWished] = useState(plant.isFavorite || plant.isWished || false);
  const [isWishing, setIsWishing] = useState(false);

  // Memoize expensive calculations
  const plantData = useMemo(() => {
    const formatPrice = (price) => {
      const numPrice = parseFloat(price);
      return isNaN(numPrice) ? '0' : numPrice.toFixed(0);
    };

    const getPlantImage = () => {
      const imageUrl = plant.image || 
                      plant.mainImage || 
                      (plant.images && plant.images[0]) || 
                      plant.imageUrl;
      
      if (imageUrl && imageUrl.startsWith('http')) {
        return { uri: imageUrl };
      }
      
      return { 
        uri: `https://picsum.photos/300/200?random=${plant.id || Math.random()}` 
      };
    };

    const getSellerInfo = () => {
      const seller = plant.seller || {};
      return {
        name: seller.name || plant.sellerName || 'Plant Seller',
        isBusiness: seller.isBusiness || plant.sellerType === 'business',
        location: plant.location?.city || plant.city || 'Location not specified',
        id: plant.sellerId || seller._id || seller.email
      };
    };

    return {
      formattedPrice: formatPrice(plant.price || plant.finalPrice || 0),
      imageSource: getPlantImage(),
      title: plant.title || plant.name || plant.common_name || 'Unnamed Plant',
      description: plant.description,
      sellerInfo: getSellerInfo(),
      plantId: plant.id || plant._id
    };
  }, [
    plant.price, 
    plant.finalPrice, 
    plant.image, 
    plant.mainImage, 
    plant.images, 
    plant.imageUrl,
    plant.title, 
    plant.name, 
    plant.common_name,
    plant.description,
    plant.seller,
    plant.sellerName,
    plant.sellerType,
    plant.location,
    plant.city,
    plant.sellerId,
    plant.id,
    plant._id
  ]);

  // Enhanced navigation with error handling
  const navigateToDetails = useCallback(() => {
    try {
      console.log('🔍 Navigating to plant details:', plantData.plantId);
      
      if (navigation.navigate) {
        try {
          navigation.navigate('PlantDetails', { 
            plant: plant,
            plantId: plantData.plantId 
          });
        } catch (detailsError) {
          console.log('PlantDetails not found, trying ProductDetails');
          navigation.navigate('ProductDetails', { 
            product: plant,
            productId: plantData.plantId 
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
  }, [navigation, plant, plantData.plantId]);

  // Unified navigation to Messages tab
  const openMessagesScreen = useCallback((params = {}) => {
    try {
      if (navigation.navigate) {
        navigation.navigate('MarketplaceTabs', { screen: 'Messages', params });
      } else {
        navigation.navigate('Messages', params);
      }
    } catch (err) {
      Alert.alert('Navigation Error', 'Could not open messages. Please try again.');
    }
  }, [navigation]);

  // Enhanced contact handler
  const handleContact = useCallback(async () => {
    if (onContactPress) {
      onContactPress(plant);
      return;
    }

    try {
      console.log('💬 Starting contact with seller:', plantData.sellerInfo.id);
      
      if (!plantData.sellerInfo.id) {
        Alert.alert('Error', 'Seller information not available');
        return;
      }

      const autoMessage = `Hi! I'm interested in your ${plantData.title}. Is it still available?`;
      
      const messageParams = {
        sellerId: plantData.sellerInfo.id,
        plantId: plantData.plantId,
        plantName: plantData.title,
        sellerName: plantData.sellerInfo.name,
        autoMessage: autoMessage,
        isBusiness: plantData.sellerInfo.isBusiness
      };

      console.log('📱 Navigating to messages with params:', messageParams);
      openMessagesScreen(messageParams);

    } catch (error) {
      console.error('❌ Contact error:', error);
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    }
  }, [plant, plantData, onContactPress, openMessagesScreen]);

  // Enhanced order handler
  const handleOrder = useCallback(async () => {
    if (onOrderPress) {
      onOrderPress(plant);
      return;
    }

    try {
      if (!plantData.sellerInfo.id) {
        Alert.alert('Error', 'Seller information not available');
        return;
      }

      Alert.alert(
        'Confirm Order Interest',
        `Would you like to inquire about ordering "${plantData.title}" for $${plantData.formattedPrice}?${plantData.sellerInfo.isBusiness ? '\n\nThis is a business listing - you can arrange pickup directly with the seller.' : ''}`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Yes, Inquire',
            onPress: () => {
              const orderMessage = plantData.sellerInfo.isBusiness 
                ? `Hi! I would like to order "${plantData.title}" ($${plantData.formattedPrice}). Could you please provide details about pickup arrangements and availability?`
                : `Hi! I'm interested in purchasing your "${plantData.title}" for $${plantData.formattedPrice}. Is it still available?`;
              
              const messageParams = {
                sellerId: plantData.sellerInfo.id,
                plantId: plantData.plantId,
                plantName: plantData.title,
                sellerName: plantData.sellerInfo.name,
                autoMessage: orderMessage,
                isBusiness: plantData.sellerInfo.isBusiness,
                isOrderInquiry: true
              };

              console.log('🛒 Starting order inquiry with params:', messageParams);
              openMessagesScreen(messageParams);
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Order error:', error);
      Alert.alert('Error', 'Could not process order inquiry. Please try again.');
    }
  }, [plant, plantData, onOrderPress, openMessagesScreen]);

  const handleWishToggle = useCallback(async () => {
    if (isWishing) return;
    
    try {
      setIsWishing(true);
      const result = await wishProduct(plantData.plantId);
      
      if (result) {
        const newWishState = !isWished;
        setIsWished(newWishState);
        
        triggerUpdate(UPDATE_TYPES.WISHLIST, {
          plantId: plantData.plantId,
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
  }, [plantData.plantId, isWished, isWishing]);

  const handleShare = useCallback(async () => {
    try {
      const shareMessage = `${plantData.title}\nPrice: $${plantData.formattedPrice}\n` +
        (plantData.description ? `\n${plantData.description}` : '') +
        (plant.link ? `\n${plant.link}` : '');
      await Share.share({
        message: shareMessage,
        title: plantData.title,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share this product.');
    }
  }, [plantData, plant.link]);

  const renderSellerInfo = useCallback(() => {
    return (
      <View style={styles.sellerContainer}>
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {plantData.sellerInfo.name}
          </Text>
          {plantData.sellerInfo.isBusiness && (
            <View style={styles.businessBadge}>
              <MaterialIcons name="store" size={10} color="#FF9800" />
              <Text style={styles.businessText}>Business</Text>
            </View>
          )}
        </View>
        <Text style={styles.location} numberOfLines={1}>
          📍 {plantData.sellerInfo.location}
        </Text>
      </View>
    );
  }, [plantData.sellerInfo]);

  // Clean card style that works with wrapper
  const cardStyle = [
    styles.card,
    layout === 'list' && styles.listCard,
    isWeb && styles.webCard,
    style
  ];

  return (
    <TouchableOpacity 
      style={cardStyle} 
      onPress={navigateToDetails} 
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${plantData.title}`}
    >
      {/* Plant Image */}
      <View style={styles.imageContainer}>
        <Image
          source={plantData.imageSource}
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
            accessibilityRole="button"
            accessibilityLabel={isWished ? "Remove from wishlist" : "Add to wishlist"}
          >
            <MaterialIcons
              name={isWished ? 'favorite' : 'favorite-border'}
              size={20}
              color={isWished ? '#ff4444' : '#666'}
            />
          </TouchableOpacity>
        )}

        {/* Business Badge on Image */}
        {plantData.sellerInfo.isBusiness && (
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
            {plantData.title}
          </Text>
          <Text style={styles.price}>
            ${plantData.formattedPrice}
          </Text>
        </View>

        {plantData.description && (
          <Text style={styles.description} numberOfLines={2}>
            {plantData.description}
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
                {plantData.sellerInfo.isBusiness ? 'Order' : 'Buy'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <MaterialIcons name="share" size={16} color="#2196F3" />
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// Enhanced styles with better visual hierarchy - Fixed deprecated properties
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }
    })
  },
  listCard: {
    flexDirection: 'row',
  },
  webCard: {
    // Fixed: Remove invalid hover styles for React Native
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    }),
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8f9fa',
  },
  listImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    margin: 12,
  },
  wishButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    padding: 8,
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  businessImageBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 152, 0, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  businessImageText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  content: {
    padding: 16,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d3436',
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4CAF50',
  },
  description: {
    fontSize: 14,
    color: '#636e72',
    lineHeight: 20,
    marginBottom: 12,
  },
  sellerContainer: {
    marginVertical: 8,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 14,
    color: '#2d3436',
    fontWeight: '600',
    flex: 1,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 8,
  },
  businessText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '700',
    marginLeft: 3,
  },
  location: {
    fontSize: 13,
    color: '#74b9ff',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    backgroundColor: '#f0f9f3',
  },
  contactText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  orderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    ...Platform.select({
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  orderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2196F3',
    backgroundColor: '#f0f8ff',
  },
  shareText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
});

PlantCard.propTypes = {
  plant: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    name: PropTypes.string,
    common_name: PropTypes.string,
    description: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    finalPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    image: PropTypes.string,
    mainImage: PropTypes.string,
    imageUrl: PropTypes.string,
    images: PropTypes.array,
    isFavorite: PropTypes.bool,
    isWished: PropTypes.bool,
    seller: PropTypes.shape({
      name: PropTypes.string,
      _id: PropTypes.string,
      email: PropTypes.string,
      isBusiness: PropTypes.bool,
    }),
    sellerName: PropTypes.string,
    sellerId: PropTypes.string,
    sellerType: PropTypes.string,
    location: PropTypes.shape({
      city: PropTypes.string,
    }),
    city: PropTypes.string,
    link: PropTypes.string,
  }).isRequired,
  showActions: PropTypes.bool,
  layout: PropTypes.oneOf(['grid', 'list']),
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onContactPress: PropTypes.func,
  onOrderPress: PropTypes.func,
};

PlantCard.defaultProps = {
  showActions: true,
  layout: 'grid',
  style: null,
  onContactPress: null,
  onOrderPress: null,
};

export default PlantCard;