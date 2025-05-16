// screens/SellerProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import MarketplaceHeader from '../components/MarketplaceHeader';
import { fetchUserProfile } from '../services/marketplaceApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewForm from '../components/ReviewForm';


const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const sellerId = route.params?.sellerId || 'user123';

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sellerRating, setSellerRating] = useState({ average: 0, count: 0 });
  const [avatarError, setAvatarError] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  useEffect(() => { 
    loadSellerProfile();
    
    // Check if favorites were updated
    const checkFavoritesUpdates = async () => {
      try {
        // Check both old and new keys for backward compatibility
        const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED') 
                            || await AsyncStorage.getItem('WISHLIST_UPDATED');
                            
        if (favoritesUpdated) {
          // Clear both flags
          await AsyncStorage.removeItem('FAVORITES_UPDATED');
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          // Refresh data
          loadSellerProfile();
        }
      } catch (error) {
        console.warn('Error checking favorites updates:', error);
      }
    };
    
    checkFavoritesUpdates();
  }, [sellerId]);

  const loadSellerProfile = async () => {
    try {
      setIsLoading(true);
      
      // Make sure we have a valid seller ID
      if (!sellerId) {
        console.error("No seller ID provided");
        setError('Unable to load seller profile. Missing seller ID.');
        setIsLoading(false);
        return;
      }
      
      console.log("Loading seller profile for ID:", sellerId);
      
      // Attempt to fetch the user profile
      const data = await fetchUserProfile(sellerId);
      
      if (data && data.user) {
        console.log("Seller profile loaded successfully");
        setUser(data.user);
      } else {
        // If the API returns empty data, use a fallback approach
        console.warn("API returned empty user data, using fallback");
        
        // Try to construct a minimal seller object from product data if available
        if (route.params?.sellerData) {
          const sellerData = route.params.sellerData;
          setUser({
            id: sellerId,
            name: sellerData.name || 'Unknown Seller',
            email: sellerData.email || sellerId,
            avatar: sellerData.avatar || `https://via.placeholder.com/150?text=${sellerData.name?.[0] || 'S'}`,
            joinDate: sellerData.joinDate || new Date().toISOString(),
            stats: {
              plantsCount: sellerData.plantsCount || 0,
              salesCount: sellerData.salesCount || 0,
              rating: sellerData.rating || 0
            },
            listings: []
          });
        } else {
          setError('Seller profile could not be loaded.');
        }
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching seller profile:', err);
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  const handleAddReview = () => {
    setShowReviewForm(true);
  };

  const handleReviewsLoaded = (ratingsData) => {
    setSellerRating(ratingsData);
  };

  const handleReviewSubmitted = () => {
    // Refresh the reviews list after a new review is submitted
    if (activeTab !== 'reviews') {
      setActiveTab('reviews');
    }
  };

  // Get a safe image URI with fallback
  const getImageSafely = (uri, defaultText) => {
    if (uri && typeof uri === 'string' && uri.startsWith('http')) {
      return uri;
    }
    
    // Return a reliable placeholder service
    return `https://placehold.co/300x150/4CAF50/FFFFFF?text=${encodeURIComponent(defaultText)}`;
  };

  const renderTabContent = () => {
    if (activeTab === 'reviews') {
      return (
        <ReviewsList
          targetType="seller"
          targetId={sellerId}
          onAddReview={handleAddReview}
          onReviewsLoaded={handleReviewsLoaded}
          autoLoad={true}
        />
      );
    }

    const listings = user?.listings || [];
    const filtered = listings.filter(p => (activeTab === 'myPlants' ? p.status === 'active' : p.status === 'sold'));
    if (filtered.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialIcons name={activeTab === 'myPlants' ? 'eco' : 'local-offer'} size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>
            {activeTab === 'myPlants' ? 'This seller has no active listings' : 'No sold plants yet'}
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={filtered}
        renderItem={({ item }) => <PlantCard plant={item} showActions={false} />}
        keyExtractor={item => item.id || `plant-${item._id || Math.random()}`}
        numColumns={2}
        contentContainerStyle={styles.plantGrid}
      />
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Seller Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Seller Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSellerProfile}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare safe image URLs
  const bannerUrl = bannerError 
    ? 'https://placehold.co/600x150/4CAF50/FFFFFF?text=SellerBanner'
    : getImageSafely('https://placehold.co/600x150/4CAF50/FFFFFF?text=SellerBanner', 'SellerBanner');
  
  const avatarUrl = avatarError
    ? 'https://placehold.co/150x150/4CAF50/FFFFFF?text=User'
    : getImageSafely(user.avatar, 'User');

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Seller Profile"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      <ScrollView>
        <View style={styles.headerWrapper}>
          <Image 
            source={{ uri: bannerUrl }} 
            style={styles.banner}
            resizeMode="cover"
            onError={() => {
              console.log('Banner image failed to load');
              setBannerError(true);
            }}
          />
          <View style={styles.avatarSection}>
            <Image 
              source={{ uri: avatarUrl }} 
              style={styles.avatar}
              resizeMode="cover"
              onError={() => {
                console.log('Avatar image failed to load');
                setAvatarError(true);
              }}
            />
            <View style={styles.nameBlock}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <Text style={styles.join}>
                Joined {new Date(user.joinDate || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </Text>
            </View>
          </View>
        </View>

        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{user.stats?.plantsCount || 0}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{user.stats?.salesCount || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {(activeTab === 'reviews' ? sellerRating.average : user.stats?.rating) || 0}
            </Text>
            <Text style={styles.statLabel}>
              Rating ({activeTab === 'reviews' ? sellerRating.count : 0})
            </Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'myPlants' && styles.activeTab]} 
            onPress={() => setActiveTab('myPlants')}
          >
            <MaterialIcons name="eco" size={22} color={activeTab === 'myPlants' ? '#4CAF50' : '#999'} />
            <Text style={[styles.tabText, activeTab === 'myPlants' && styles.activeTabText]}>Active</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'sold' && styles.activeTab]} 
            onPress={() => setActiveTab('sold')}
          >
            <MaterialIcons name="local-offer" size={22} color={activeTab === 'sold' ? '#4CAF50' : '#999'} />
            <Text style={[styles.tabText, activeTab === 'sold' && styles.activeTabText]}>Sold</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'reviews' && styles.activeTab]} 
            onPress={() => setActiveTab('reviews')}
          >
            <MaterialIcons name="star" size={22} color={activeTab === 'reviews' ? '#4CAF50' : '#999'} />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>Reviews</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentWrapper}>{renderTabContent()}</View>
      </ScrollView>
      
      {/* Review Form Modal */}
      <ReviewForm
        targetId={sellerId}
        targetType="seller"
        isVisible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#666' 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  errorText: { 
    fontSize: 16, 
    color: '#f44336', 
    textAlign: 'center', 
    marginVertical: 10 
  },
  retryButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    backgroundColor: '#4CAF50', 
    borderRadius: 6 
  },
  retryText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
  headerWrapper: { 
    backgroundColor: '#f0f0f0' 
  },
  banner: { 
    width: '100%', 
    height: 120,
    backgroundColor: '#e0e0e0'
  },
  avatarSection: { 
    flexDirection: 'row', 
    marginTop: -40, 
    padding: 16 
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 3, 
    borderColor: '#fff', 
    backgroundColor: '#ddd' 
  },
  nameBlock: { 
    marginLeft: 16, 
    justifyContent: 'center' 
  },
  name: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#222' 
  },
  email: { 
    color: '#555' 
  },
  join: { 
    color: '#888', 
    fontSize: 12 
  },
  bio: { 
    paddingHorizontal: 16, 
    marginVertical: 8, 
    fontSize: 14, 
    color: '#444', 
    fontStyle: 'italic' 
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderBottomWidth: 1, 
    borderColor: '#eee' 
  },
  statBox: { 
    alignItems: 'center' 
  },
  statNum: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#4CAF50' 
  },
  statLabel: { 
    fontSize: 12, 
    color: '#666', 
    textAlign: 'center',
  },
  tabRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderColor: '#eee' 
  },
  tabBtn: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 12 
  },
  activeTab: { 
    borderBottomWidth: 2, 
    borderColor: '#4CAF50' 
  },
  tabText: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 4,
  },
  activeTabText: { 
    color: '#4CAF50', 
    fontWeight: '600' 
  },
  contentWrapper: { 
    flex: 1,
    minHeight: 300,
  },
  emptyStateContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 32 
  },
  emptyStateText: { 
    fontSize: 16, 
    color: '#888', 
    textAlign: 'center', 
    marginTop: 8 
  },
  plantGrid: { 
    paddingBottom: 80 
  },
});

export default SellerProfileScreen;