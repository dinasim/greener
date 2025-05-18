// components/ProductListView.js
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
import { MaterialIcons } from '@expo/vector-icons';
// No need for PlantCard import since we're rendering custom list items

/**
 * Component for displaying products in a list view on the map screen
 * 
 * @param {Object} props Component props
 * @param {Array} props.products List of products to display
 * @param {boolean} props.isLoading Loading state
 * @param {string} props.error Error message if any
 * @param {Function} props.onRetry Callback when retry button is pressed
 * @param {Function} props.onProductSelect Callback when a product is selected
 * @param {string} props.sortOrder Current sort order ('nearest' or 'farthest')
 * @param {Function} props.onSortChange Callback when sort order changes
 */
const ProductListView = ({
  products = [],
  isLoading = false,
  error = null,
  onRetry,
  onProductSelect,
  sortOrder = 'nearest',
  onSortChange,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  // Handle refresh
  const handleRefresh = async () => {
    if (onRetry) {
      setRefreshing(true);
      await onRetry();
      setRefreshing(false);
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
        <Text style={styles.emptySubtext}>Try changing your location or increasing the search radius</Text>
      </View>
    );
  };

  // Render item separator
  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  // Render header with sort controls
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>
        {products.length} {products.length === 1 ? 'plant' : 'plants'} found
      </Text>
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

  // Render product list item
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => onProductSelect(item.id || item._id)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.image || item.imageUrl || 'https://via.placeholder.com/150?text=Plant' }}
        style={styles.itemImage}
        resizeMode="cover"
      />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title || item.name}</Text>
        <Text style={styles.itemPrice}>${parseFloat(item.price).toFixed(2)}</Text>
        
        <View style={styles.locationContainer}>
          <MaterialIcons name="place" size={14} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.location?.city || item.city || 'Unknown location'}
          </Text>
        </View>
        
        <View style={styles.distanceContainer}>
          <MaterialIcons name="directions" size={14} color="#4CAF50" />
          <Text style={styles.distanceText}>
            {item.distance ? `${item.distance.toFixed(1)} km away` : 'Distance unknown'}
          </Text>
        </View>
        
        <View style={styles.sellerContainer}>
          <MaterialIcons name="person" size={14} color="#666" />
          <Text style={styles.sellerText} numberOfLines={1}>
            {item.seller?.name || item.sellerName || 'Unknown seller'}
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#ddd" />
    </TouchableOpacity>
  );

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
    paddingBottom: 20,
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 6,
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
    marginBottom: 2,
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
  },
  sellerText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
});

export default ProductListView;