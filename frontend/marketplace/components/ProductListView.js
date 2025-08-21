// components/ProductListView.js - Enhanced with Better Business Integration
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

/**
 * Enhanced ProductListView with improved business integration
 * Shows business indicators and handles business vs individual products properly
 */
const ProductListView = ({
  products = [],
  isLoading = false,
  error = null,
  onRetry,
  onProductSelect,
  sortOrder = 'nearest',
  onSortChange,
  showBusinessFilter = true,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Handle refresh
  const handleRefresh = async () => {
    if (onRetry) {
      setRefreshing(true);
      await onRetry();
      setRefreshing(false);
    }
  };

  // Handle product selection with proper navigation
  const handleProductSelect = (product) => {
    if (onProductSelect) {
      onProductSelect(product.id || product._id);
    } else {
      // Default navigation to plant detail
      navigation.navigate('PlantDetail', { 
        plantId: product.id || product._id,
        plant: product 
      });
    }
  };

  // Handle seller navigation
  const handleSellerPress = (product) => {
    const isBusiness = product.seller?.isBusiness || 
                       product.sellerType === 'business' || 
                       product.isBusinessListing;
    
    if (isBusiness) {
      navigation.navigate('BusinessSellerProfile', {
        businessId: product.seller?._id || product.seller?.id || product.sellerId || product.businessId,
        sellerData: product.seller || { 
          name: product.sellerName || 'Business Seller',
          isBusiness: true,
          businessName: product.seller?.businessName || product.sellerName
        }
      });
    } else {
      navigation.navigate('SellerProfile', {
        sellerId: product.seller?._id || product.seller?.id || product.sellerId || 'unknown',
        sellerData: product.seller || { 
          name: product.sellerName || 'Individual Seller',
          isBusiness: false
        }
      });
    }
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Finding plants nearby...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="eco" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No plants found in this area</Text>
        <Text style={styles.emptySubtext}>Try changing your location or search filters</Text>
      </View>
    );
  };

  // Render item separator
  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  // Render header with sort controls and business/individual counts
  const renderHeader = () => {
    const businessCount = products.filter(p => 
      p.seller?.isBusiness || p.sellerType === 'business' || p.isBusinessListing
    ).length;
    const individualCount = products.length - businessCount;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {products.length} {products.length === 1 ? 'plant' : 'plants'} found
          </Text>
          {showBusinessFilter && (
            <View style={styles.countContainer}>
              <View style={styles.countBadge}>
                <MaterialCommunityIcons name="store" size={12} color="#FF9800" />
                <Text style={styles.countText}>{businessCount} Business</Text>
              </View>
              <View style={styles.countBadge}>
                <MaterialCommunityIcons name="account" size={12} color="#2196F3" />
                <Text style={styles.countText}>{individualCount} Individual</Text>
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={onSortChange}
        >
          <MaterialIcons
            name={sortOrder === 'nearest' ? 'arrow-upward' : 'arrow-downward'}
            size={16}
            color="#4CAF50"
          />
          <Text style={styles.sortText}>
            {sortOrder === 'nearest' ? 'Nearest first' : 'Farthest first'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render business indicator badge
  const renderBusinessIndicator = (product) => {
    const isBusiness = product.seller?.isBusiness || 
                       product.sellerType === 'business' || 
                       product.isBusinessListing;
    
    if (!isBusiness) return null;

    return (
      <View style={styles.businessIndicatorBadge}>
        <MaterialCommunityIcons name="store" size={10} color="#fff" />
        <Text style={styles.businessIndicatorText}>Business</Text>
      </View>
    );
  };

  // Render rating with "New" fallback
  const renderRating = (item) => {
    if (!item.rating || item.rating === 0) {
      return <Text style={styles.newProductText}>New Product</Text>;
    }
    return (
      <View style={styles.ratingContainer}>
        <MaterialIcons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>
          {typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating}
          {item.reviewCount > 0 && ` (${item.reviewCount})`}
        </Text>
      </View>
    );
  };

  // Render seller rating (business & individual unified)
  const renderSellerRating = (item) => {
    const sellerRating = item.seller?.rating;
    const isBusiness = item.seller?.isBusiness || 
                       item.sellerType === 'business' || 
                       item.isBusinessListing;
    return (
      <View style={styles.sellerInfo}>
        <View style={styles.sellerTypeContainer}>
          <MaterialCommunityIcons 
            name={isBusiness ? 'store' : 'account'} 
            size={12} 
            color={isBusiness ? '#FF9800' : '#2196F3'} 
          />
          <Text style={[styles.sellerTypeText, { color: isBusiness ? '#FF9800' : '#2196F3' }]}> 
            {isBusiness ? 'Business' : 'Individual'}
          </Text>
        </View>
        {!sellerRating || sellerRating === 0 ? (
          <Text style={styles.newSellerText}>New Seller</Text>
        ) : (
          <View style={styles.sellerRatingContainer}>
            <MaterialIcons name="star" size={12} color="#FFD700" />
            <Text style={styles.sellerRatingText}>{sellerRating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    );
  };

  // Get image with placeholder fallback
  const getImageSource = (item) => {
    const imageUrl = item.image || item.imageUrl || item.mainImage || 
                     (item.images && item.images.length > 0 ? item.images[0] : null);
    return { uri: imageUrl || 'https://via.placeholder.com/150?text=Plant' };
  };

  // Render product list item with enhanced business integration
  const renderItem = ({ item }) => {
    const isBusiness = item.seller?.isBusiness || 
                       item.sellerType === 'business' || 
                       item.isBusinessListing;
    
    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          isBusiness && styles.businessItemContainer
        ]}
        onPress={() => handleProductSelect(item)}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          <Image
            source={getImageSource(item)}
            style={styles.itemImage}
            resizeMode="cover"
          />
          {renderBusinessIndicator(item)}
        </View>
        
        <View style={styles.itemDetails}>
          <View style={styles.titleRow}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title || item.name}
            </Text>
            <Text style={styles.itemPrice}>
              ₪{parseFloat(item.price || 0).toFixed(2)}
            </Text>
          </View>
          
          {/* Product Rating */}
          {renderRating(item)}
          
          <View style={styles.locationContainer}>
            <MaterialIcons name="place" size={14} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location?.city || item.city || 'Unknown location'}
            </Text>
          </View>
          
          {item.distance && (
            <View style={styles.distanceContainer}>
              <MaterialIcons name="directions" size={14} color="#4CAF50" />
              <Text style={styles.distanceText}>
                {item.distance.toFixed(1)} km away
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.sellerContainer}
            onPress={() => handleSellerPress(item)}
          >
            <Text style={styles.sellerText} numberOfLines={1}>
              {item.seller?.name || item.seller?.businessName || item.sellerName || 'Unknown seller'}
            </Text>
            {renderSellerRating(item)}
          </TouchableOpacity>
        </View>
        
        <MaterialIcons name="chevron-right" size={24} color="#ddd" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={products.length > 0 ? renderHeader : null}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4CAF50',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  countContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  countText: {
    fontSize: 11,
    marginLeft: 4,
    color: '#666',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f9f0',
    borderRadius: 16,
  },
  sortText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4CAF50',
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    alignItems: 'center',
  },
  businessItemContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  imageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  businessIndicatorBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  businessIndicatorText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 2,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  newProductText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  sellerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerText: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  sellerTypeText: {
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 2,
  },
  sellerRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerRatingText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 2,
  },
  newSellerText: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
});

export default ProductListView;