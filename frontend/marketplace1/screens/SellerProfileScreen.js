import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

// Components
import PlantCard from '../components/PlantCard';

// API Services
import { fetchSellerProfile, fetchSellerPlants } from '../services/marketplaceApi';

const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { sellerId } = route.params;
  
  const [seller, setSeller] = useState(null);
  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadSellerData();
  }, [sellerId]);
  
  const loadSellerData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch seller profile
      const profileData = await fetchSellerProfile(sellerId);
      setSeller(profileData);
      
      // Fetch seller's plants
      const plantsData = await fetchSellerPlants(sellerId);
      setPlants(plantsData);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load seller data. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching seller data:', err);
    }
  };
  
  const handleContactSeller = () => {
    navigation.navigate('Messages', { sellerId });
  };
  
  const handleReportSeller = () => {
    // Implement report seller functionality
    alert('Report functionality will be added soon.');
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading seller profile...</Text>
      </View>
    );
  }
  
  if (error || !seller) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error || 'Seller not found'}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadSellerData}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        stickyHeaderIndices={[1]} // Make the plants header sticky
      >
        {/* Header with back button */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Seller Profile</Text>
          <TouchableOpacity 
            style={styles.reportButton}
            onPress={handleReportSeller}
          >
            <Feather name="flag" size={20} color="#333" />
          </TouchableOpacity>
        </View>
        
        {/* Seller Profile */}
        <View style={styles.profileContainer}>
          <View style={styles.profileHeader}>
            <Image 
              source={{ uri: seller.avatar || 'https://via.placeholder.com/100' }}
              style={styles.profileImage}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{seller.name}</Text>
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={16} color="#FFC107" />
                <Text style={styles.ratingText}>
                  {seller.rating} ({seller.reviewCount} reviews)
                </Text>
              </View>
              <Text style={styles.joinedDate}>
                Member since {new Date(seller.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </Text>
              
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{seller.listingCount}</Text>
                  <Text style={styles.statLabel}>Listings</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{seller.soldCount}</Text>
                  <Text style={styles.statLabel}>Sold</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{seller.responseRate}%</Text>
                  <Text style={styles.statLabel}>Response</Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Bio */}
          {seller.bio && (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{seller.bio}</Text>
            </View>
          )}
          
          {/* Contact Button */}
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={handleContactSeller}
          >
            <MaterialIcons name="chat" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Message</Text>
          </TouchableOpacity>
          
          {/* Location */}
          {seller.location && (
            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={16} color="#666" />
              <Text style={styles.locationText}>{seller.location}</Text>
            </View>
          )}
          
          {/* Plants Header - This will be sticky */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Plants for Sale</Text>
          </View>
        </View>
        
        {/* Plants Grid */}
        {plants.length === 0 ? (
          <View style={styles.emptyPlantsContainer}>
            <MaterialIcons name="eco" size={48} color="#ccc" />
            <Text style={styles.emptyPlantsText}>No plants available</Text>
          </View>
        ) : (
          <View style={styles.plantsGrid}>
            {plants.map((plant) => (
              <View key={plant.id} style={styles.plantCardContainer}>
                <PlantCard plant={plant} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reportButton: {
    padding: 4,
  },
  profileContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    marginLeft: 4,
    color: '#666',
  },
  joinedDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#eee',
    height: '100%',
  },
  bioContainer: {
    marginVertical: 16,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  contactButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    marginLeft: 4,
    color: '#666',
  },
  sectionHeader: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyPlantsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  emptyPlantsText: {
    marginTop: 8,
    fontSize: 16,
    color: '#999',
  },
  plantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  plantCardContainer: {
    width: '50%',
  },
});

export default SellerProfileScreen;