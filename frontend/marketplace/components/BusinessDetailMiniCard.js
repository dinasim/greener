// components/BusinessDetailMiniCard.js
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Mini business detail card that shows in the map view
 * when a business pin is clicked
 */
const BusinessDetailMiniCard = ({ business, onClose, onViewDetails, onGetDirections }) => {
  if (!business) return null;

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
    return { uri: business.logo || 'https://via.placeholder.com/80x80?text=Business' };
  };

  // Render rating
  const renderRating = () => {
    if (!business.rating || business.rating === 0) {
      return <Text style={styles.newBusinessText}>New Business</Text>;
    }
    
    return (
      <View style={styles.ratingContainer}>
        <MaterialIcons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>
          {typeof business.rating === 'number' ? business.rating.toFixed(1) : business.rating}
          {business.reviewCount ? ` (${business.reviewCount})` : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <MaterialIcons name="close" size={20} color="#666" />
      </TouchableOpacity>
      
      <View style={styles.contentContainer}>
        <Image 
          source={getLogoSource()} 
          style={styles.logo}
          defaultSource={require('../../assets/business-placeholder.png')}
        />
        
        <View style={styles.detailsContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.businessName} numberOfLines={1}>
              {business.businessName || business.name || 'Business'}
            </Text>
            <View style={styles.businessTypeBadge}>
              <MaterialCommunityIcons name="store" size={12} color="#FF9800" />
              <Text style={styles.businessTypeText}>{getBusinessTypeDisplay()}</Text>
            </View>
          </View>
          
          {renderRating()}
          
          <View style={styles.locationContainer}>
            <MaterialIcons name="place" size={14} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>
              {business.address?.city || business.location?.city || 'Unknown location'}
            </Text>
          </View>
          
          {getDistanceText() && (
            <Text style={styles.distanceText}>{getDistanceText()}</Text>
          )}
          
          <View style={styles.statusContainer}>
            <MaterialIcons name="schedule" size={14} color="#4CAF50" />
            <Text style={styles.statusText}>{getBusinessStatus()}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={onGetDirections}
        >
          <MaterialIcons name="directions" size={16} color="#4CAF50" />
          <Text style={styles.actionButtonText}>Directions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={onViewDetails}
        >
          <Text style={styles.primaryButtonText}>View Profile</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    margin: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 8,
  },
  contentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  businessTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  businessTypeText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 2,
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
  newBusinessText: {
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
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f0',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    marginRight: 8,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
    marginRight: 0,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginRight: 4,
  },
});

export default BusinessDetailMiniCard;