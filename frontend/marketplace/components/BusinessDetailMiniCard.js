// components/BusinessDetailMiniCard.js - Production-Optimized Version
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';

/**
 * Mini business detail card that shows in the map view
 * when a business pin is clicked
 */
const BusinessDetailMiniCard = React.memo(({ business, onClose, onViewDetails, onGetDirections }) => {
  if (!business) return null;

  // Memoize expensive calculations
  const businessData = useMemo(() => {
    // Get business hours status
    const getBusinessStatus = () => {
      if (!business.businessHours) return 'Hours not available';
      
      const now = new Date();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
      const todayHours = business.businessHours.find(h => h.day === dayName);
      
      if (!todayHours || todayHours.isClosed) {
        return 'Closed Today';
      }
      
      return `Open ${todayHours.open} - ${todayHours.close}`;
    };

    // Get business type display
    const getBusinessTypeDisplay = () => {
      if (!business.businessType) return 'Business';
      return business.businessType.charAt(0).toUpperCase() + business.businessType.slice(1);
    };

    // Calculate distance text
    const getDistanceText = () => {
      if (business.distance) {
        return `${business.distance.toFixed(1)} km away`;
      }
      return null;
    };

    // Get logo or fallback
    const getLogoSource = () => {
      const logoUrl = business.logo || business.image || business.profileImage;
      return { uri: logoUrl || 'https://via.placeholder.com/80x80?text=Business' };
    };

    return {
      businessName: business.businessName || business.name || 'Business',
      businessType: getBusinessTypeDisplay(),
      location: business.address?.city || business.location?.city || 'Unknown location',
      distanceText: getDistanceText(),
      status: getBusinessStatus(),
      logoSource: getLogoSource(),
      rating: business.rating,
      reviewCount: business.reviewCount
    };
  }, [
    business.businessHours,
    business.businessType,
    business.distance,
    business.logo,
    business.image,
    business.profileImage,
    business.businessName,
    business.name,
    business.address,
    business.location,
    business.rating,
    business.reviewCount
  ]);

  // Render rating with memoization
  const renderRating = useCallback(() => {
    if (!businessData.rating || businessData.rating === 0) {
      return <Text style={styles.newBusinessText}>New Business</Text>;
    }
    
    return (
      <View style={styles.ratingContainer}>
        <MaterialIcons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>
          {typeof businessData.rating === 'number' ? businessData.rating.toFixed(1) : businessData.rating}
          {businessData.reviewCount ? ` (${businessData.reviewCount})` : ''}
        </Text>
      </View>
    );
  }, [businessData.rating, businessData.reviewCount]);

  const handleGetDirections = useCallback(() => {
    if (onGetDirections) {
      onGetDirections(business);
    }
  }, [onGetDirections, business]);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails(business);
    }
  }, [onViewDetails, business]);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
        accessibilityLabel="Close business details"
        accessibilityRole="button"
      >
        <MaterialIcons name="close" size={20} color="#666" />
      </TouchableOpacity>
      
      <View style={styles.contentContainer}>
        <Image 
          source={businessData.logoSource} 
          style={styles.logo}
          resizeMode="cover"
        />
        
        <View style={styles.detailsContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.businessName} numberOfLines={1}>
              {businessData.businessName}
            </Text>
            <View style={styles.businessTypeBadge}>
              <MaterialCommunityIcons name="store" size={12} color="#FF9800" />
              <Text style={styles.businessTypeText}>{businessData.businessType}</Text>
            </View>
          </View>
          
          {renderRating()}
          
          <View style={styles.locationContainer}>
            <MaterialIcons name="place" size={14} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>
              {businessData.location}
            </Text>
          </View>
          
          {businessData.distanceText && (
            <Text style={styles.distanceText}>{businessData.distanceText}</Text>
          )}
          
          <View style={styles.statusContainer}>
            <MaterialIcons name="schedule" size={14} color="#4CAF50" />
            <Text style={styles.statusText}>{businessData.status}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleGetDirections}
          accessibilityLabel="Get directions to business"
          accessibilityRole="button"
        >
          <MaterialIcons name="directions" size={16} color="#4CAF50" />
          <Text style={styles.actionButtonText}>Directions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleViewDetails}
          accessibilityLabel="View business profile"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>View Profile</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      },
    }),
    position: 'relative',
    margin: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
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
  contentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  businessName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d3436',
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  businessTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  businessTypeText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '700',
    marginLeft: 3,
  },
  ratingContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#fff9c4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ratingText: {
    marginLeft: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#f57f17',
  },
  newBusinessText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: 6,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6c757d',
    marginLeft: 4,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f3',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
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
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    marginLeft: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginRight: 6,
  },
});

BusinessDetailMiniCard.propTypes = {
  business: PropTypes.shape({
    businessName: PropTypes.string,
    name: PropTypes.string,
    businessType: PropTypes.string,
    businessHours: PropTypes.array,
    distance: PropTypes.number,
    logo: PropTypes.string,
    image: PropTypes.string,
    profileImage: PropTypes.string,
    address: PropTypes.shape({
      city: PropTypes.string,
    }),
    location: PropTypes.shape({
      city: PropTypes.string,
    }),
    rating: PropTypes.number,
    reviewCount: PropTypes.number,
  }),
  onClose: PropTypes.func.isRequired,
  onViewDetails: PropTypes.func.isRequired,
  onGetDirections: PropTypes.func.isRequired,
};

BusinessDetailMiniCard.defaultProps = {
  business: null,
};

export default BusinessDetailMiniCard;