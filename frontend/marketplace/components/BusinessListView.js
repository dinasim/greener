// components/BusinessListView.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * BusinessListView Component
 * Displays a list of businesses with sorting and filtering capabilities
 */
const BusinessListView = ({
  businesses = [],
  isLoading = false,
  error = null,
  onRetry = () => {},
  onBusinessSelect = () => {},
  sortOrder = 'nearest',
  onSortChange = () => {},
}) => {
  const [refreshing, setRefreshing] = useState(false);

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await onRetry();
    setRefreshing(false);
  };

  // Format distance for display
  const formatDistance = (distance) => {
    if (!distance || distance === 0) return 'Distance unknown';
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    }
    return `${distance.toFixed(1)}km away`;
  };

  // Format rating display
  const formatRating = (rating, reviewCount = 0) => {
    if (!rating || rating === 0) return 'No ratings yet';
    return `${rating.toFixed(1)} ★ (${reviewCount} reviews)`;
  };

  // Format business hours with better web display
  const formatBusinessHours = (hours) => {
    if (!hours) return 'Hours not specified';
    if (typeof hours === 'string') return hours;
    if (hours.isOpen24Hours) return 'Open 24 hours';
    
    // Handle array of business hours (today's hours)
    if (Array.isArray(hours)) {
      const today = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[today.getDay()];
      
      const todayHours = hours.find(h => h.day?.toLowerCase() === todayName.toLowerCase());
      if (todayHours) {
        if (todayHours.isClosed) return 'Closed today';
        return `${todayHours.open || '9:00'} - ${todayHours.close || '17:00'}`;
      }
    }
    
    // Handle single hours object
    if (hours.isClosed) return 'Closed';
    return `${hours.open || '9:00'} - ${hours.close || '17:00'}`;
  };

  // Get business status with better logic
  const getBusinessStatus = (business) => {
    // Check if business has current status
    if (business.currentStatus) return business.currentStatus;
    if (business.status && business.status !== 'active') return business.status;
    
    // Determine status from business hours
    const hours = business.hours || business.businessHours;
    if (!hours) return 'unknown';
    
    if (Array.isArray(hours)) {
      const today = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[today.getDay()];
      
      const todayHours = hours.find(h => h.day?.toLowerCase() === todayName.toLowerCase());
      if (todayHours) {
        if (todayHours.isClosed) return 'closed';
        
        // Check if currently open
        const now = today.getHours() * 60 + today.getMinutes();
        const openTime = parseTimeToMinutes(todayHours.open);
        const closeTime = parseTimeToMinutes(todayHours.close);
        
        if (now >= openTime && now <= closeTime) return 'open';
        return 'closed';
      }
    }
    
    return 'unknown';
  };

  // Helper to parse time to minutes
  const parseTimeToMinutes = (timeString) => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  // Render individual business item
  const renderBusinessItem = ({ item, index }) => {
    const business = item;
    const businessName = business.businessName || business.name || 'Unnamed Business';
    const businessDescription = business.description || business.businessDescription || 'No description available';
    const businessImage = business.image || business.businessImage || business.avatar;
    const businessCategory = business.category || business.businessCategory || 'General';
    const businessAddress = business.address || business.location?.formattedAddress || 'Address not available';
    const businessRating = business.rating || business.averageRating || 0;
    const reviewCount = business.reviewCount || business.totalReviews || 0;
    const businessStatus = business.status || business.businessStatus || 'unknown';
    const distance = business.distance || 0;

    return (
      <TouchableOpacity
        style={styles.businessCard}
        onPress={() => onBusinessSelect(business.id || business._id)}
        activeOpacity={0.7}
      >
        {/* Business Image */}
        <View style={styles.imageContainer}>
          {businessImage ? (
            <Image
              source={{ uri: businessImage }}
              style={styles.businessImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <MaterialIcons name="business" size={40} color="#9E9E9E" />
            </View>
          )}
          
          {/* Distance Badge */}
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
          </View>
        </View>

        {/* Business Information */}
        <View style={styles.businessInfo}>
          <View style={styles.businessHeader}>
            <Text style={styles.businessName} numberOfLines={1}>
              {businessName}
            </Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(businessStatus) }]}>
              <Text style={styles.statusText}>{businessStatus.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.businessCategory} numberOfLines={1}>
            {businessCategory}
          </Text>

          <Text style={styles.businessDescription} numberOfLines={2}>
            {businessDescription}
          </Text>

          <View style={styles.businessDetails}>
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{formatRating(businessRating, reviewCount)}</Text>
            </View>

            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={16} color="#757575" />
              <Text style={styles.addressText} numberOfLines={1}>
                {businessAddress}
              </Text>
            </View>
          </View>

          {/* Business Hours */}
          {business.hours && (
            <View style={styles.hoursContainer}>
              <MaterialIcons name="access-time" size={16} color="#757575" />
              <Text style={styles.hoursText}>{formatBusinessHours(business.hours)}</Text>
            </View>
          )}

          {/* Business Features */}
          {business.features && business.features.length > 0 && (
            <View style={styles.featuresContainer}>
              {business.features.slice(0, 3).map((feature, idx) => (
                <View key={idx} style={styles.featureTag}>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              {business.features.length > 3 && (
                <View style={styles.featureTag}>
                  <Text style={styles.featureText}>+{business.features.length - 3} more</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action Arrow */}
        <View style={styles.actionContainer}>
          <MaterialIcons name="chevron-right" size={24} color="#9E9E9E" />
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="business-center" size={80} color="#E0E0E0" />
      <Text style={styles.emptyTitle}>No Businesses Found</Text>
      <Text style={styles.emptyMessage}>
        Try adjusting your search radius or location to find businesses near you.
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Search Again</Text>
      </TouchableOpacity>
    </View>
  );

  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={80} color="#f44336" />
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  // Render loading state
  if (isLoading && businesses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Finding businesses near you...</Text>
      </View>
    );
  }

  // Render error state
  if (error && businesses.length === 0) {
    return renderErrorState();
  }

  return (
    <View style={styles.container}>
      {/* Header with Sort Controls */}
      <View style={styles.header}>
        <View style={styles.resultInfo}>
          <Text style={styles.resultCount}>
            {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'} found
          </Text>
          <Text style={styles.sortLabel}>
            Sorted by: {sortOrder === 'nearest' ? 'Nearest first' : 'Farthest first'}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.sortButton} onPress={onSortChange}>
          <MaterialIcons 
            name={sortOrder === 'nearest' ? 'near-me' : 'place'} 
            size={20} 
            color="#4CAF50" 
          />
          <Text style={styles.sortButtonText}>
            {sortOrder === 'nearest' ? 'Nearest' : 'Farthest'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Business List */}
      <FlatList
        data={businesses}
        renderItem={renderBusinessItem}
        keyExtractor={(item, index) => item.id || item._id || index.toString()}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={businesses.length === 0 ? styles.emptyListContainer : styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  resultInfo: {
    flex: 1,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sortLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sortButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  businessCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  imageContainer: {
    position: 'relative',
  },
  businessImage: {
    width: 100,
    height: 120,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  placeholderImage: {
    width: 100,
    height: 120,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  businessInfo: {
    flex: 1,
    padding: 12,
  },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  businessCategory: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 4,
  },
  businessDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  businessDetails: {
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hoursText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  featureTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '500',
  },
  actionContainer: {
    justifyContent: 'center',
    paddingRight: 12,
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BusinessListView;