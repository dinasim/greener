// screens/SellerProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, FlatList,
  ScrollView, SafeAreaView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import MarketplaceHeader from '../components/MarketplaceHeader';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';
import { fetchUserProfile } from '../services/marketplaceApi';

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
  const [refreshKey, setRefreshKey] = useState(Date.now());
  
  // Toast message state
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  useEffect(() => { 
    loadSellerProfile();
    const checkUpdates = async () => {
      try {
        const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED') 
                              || await AsyncStorage.getItem('WISHLIST_UPDATED');
        if (favoritesUpdated) {
          await AsyncStorage.removeItem('FAVORITES_UPDATED');
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          setRefreshKey(Date.now());
        }
      } catch (error) {
        console.warn('Error checking updates:', error);
      }
    };
    checkUpdates();
  }, [sellerId, refreshKey]);

  const loadSellerProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!sellerId) {
        console.error("No seller ID provided");
        setError('Unable to load seller profile. Missing seller ID.');
        setIsLoading(false);
        return;
      }
      console.log("Loading seller profile for ID:", sellerId);
      const data = await fetchUserProfile(sellerId);
      if (data && data.user) {
        console.log("Seller profile loaded successfully");
        setUser(data.user);
        if (data.user.listings) {
          data.user.listings.forEach(listing => {
            if (!listing.seller) {
              listing.seller = {
                name: data.user.name,
                _id: data.user.id || data.user.email,
                email: data.user.email
              };
            }
          });
        }
      } else {
        console.warn("API returned empty user data, using fallback");
        if (route.params?.sellerData) {
          const sellerData = route.params.sellerData;
          setUser({
            id: sellerId,
            name: sellerData.name || 'Unknown Seller',
            email: sellerData.email || sellerId,
            avatar: sellerData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerData.name || 'S')}&background=4CAF50&color=fff`,
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

  // Show a toast message
  const showToast = (message, type = 'info') => {
    setToast({
      visible: true,
      message,
      type
    });
  };

  // Hide the toast message
  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  };

  // Fixed review button handler with toast messages
  const handleAddReview = () => {
    AsyncStorage.getItem('userEmail')
      .then(userEmail => {
        console.log('Current user email:', userEmail);
        console.log('Seller ID:', sellerId);
        
        if (userEmail === sellerId) {
          // Show toast message instead of Alert
          showToast("You cannot leave a review for your own profile", "error");
          return;
        }
        
        // Explicitly set the review form visibility to true
        console.log('Setting review form to visible');
        setShowReviewForm(true);
      })
      .catch(err => {
        console.error("Error checking user email:", err);
        // If we can't check, show a warning but still allow adding a review
        showToast("User verification failed, proceeding anyway", "warning");
        setShowReviewForm(true);
      });
  };

  const handleReviewsLoaded = (data) => {
    if (data && typeof data === 'object') {
      setSellerRating({
        average: data.averageRating || 0,
        count: data.count || 0
      });
    }
  };

  const handleReviewSubmitted = () => {
    // Set active tab to reviews so the user can see their new review
    setActiveTab('reviews');
    
    // Refresh the reviews list
    setRefreshKey(Date.now());
    
    // Show toast notification for successful submission
    showToast("Your review has been submitted successfully!", "success");
    
    // Close the review form
    setShowReviewForm(false);
  };

  const getAvatarUrl = (name, email) => {
    const displayName = name || 'Unknown';
    const firstInitial = displayName.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstInitial)}&background=4CAF50&color=fff&size=256`;
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
          key={`reviews-${refreshKey}`}
        />
      );
    }
    
    const listings = user?.listings || [];
    const filtered = listings.filter(p => {
      if (activeTab === 'myPlants') {
        return p.status === 'active' || !p.status;
      } else if (activeTab === 'sold') {
        return p.status === 'sold';
      }
      return false;
    });
    
    filtered.forEach(listing => {
      if (!listing.seller || !listing.seller.name || listing.seller.name === 'Unknown Seller') {
        listing.seller = {
          name: user.name,
          _id: user.id || user.email,
          email: user.email
        };
      }
    });

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
        keyExtractor={item => item.id || item._id || `plant-${Math.random()}`}
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

  const avatarUrl = user.avatar && !avatarError 
    ? user.avatar 
    : getAvatarUrl(user.name, user.email);
  const displayRating = sellerRating.average > 0 
    ? sellerRating.average 
    : (user.stats?.rating || 0);
  const formattedRating = typeof displayRating === 'number' 
    ? displayRating.toFixed(1) 
    : '0.0';

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Seller Profile"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      {/* Toast Message Component */}
      <ToastMessage 
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />
      
      <ScrollView>
        <View style={styles.profileCard}>
          <Image 
            source={{ uri: avatarUrl }} 
            style={styles.avatar}
            resizeMode="cover"
            onError={() => {
              console.log('Avatar image failed to load');
              setAvatarError(true);
            }}
          />
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <Text style={styles.joinDate}>
            Joined {new Date(user.joinDate || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </Text>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          <TouchableOpacity 
            style={styles.reviewButton} 
            onPress={handleAddReview}
            accessible={true}
            accessibilityLabel="Write a review"
            accessibilityRole="button"
          >
            <MaterialIcons name="rate-review" size={16} color="#4CAF50" />
            <Text style={styles.reviewButtonText}>Write a Review</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user.stats?.plantsCount || 0}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user.stats?.salesCount || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formattedRating}</Text>
            <Text style={styles.statLabel}>Rating ({sellerRating.count || 0})</Text>
          </View>
        </View>
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'myPlants' && styles.activeTabButton]} 
            onPress={() => setActiveTab('myPlants')}
          >
            <MaterialIcons name="eco" size={24} color={activeTab === 'myPlants' ? '#4CAF50' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'myPlants' && styles.activeTabText]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'sold' && styles.activeTabButton]} 
            onPress={() => setActiveTab('sold')}
          >
            <MaterialIcons name="local-offer" size={24} color={activeTab === 'sold' ? '#4CAF50' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'sold' && styles.activeTabText]}>Sold</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'reviews' && styles.activeTabButton]} 
            onPress={() => setActiveTab('reviews')}
          >
            <MaterialIcons name="star" size={24} color={activeTab === 'reviews' ? '#4CAF50' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>Reviews</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabContent}>{renderTabContent()}</View>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#f44336', textAlign: 'center', marginVertical: 10 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#4CAF50', borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: '600' },
  profileCard: {
    backgroundColor: '#f0f9f3', 
    margin: 16, 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 6, 
    elevation: 4,
  },
  avatar: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    marginBottom: 12,
    backgroundColor: '#4CAF50',
  },
  userName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  userEmail: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 2 
  },
  joinDate: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 2 
  },
  bio: { 
    marginTop: 10, 
    fontSize: 14, 
    color: '#555', 
    textAlign: 'center' 
  },
  reviewButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12,
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    borderColor: '#4CAF50', 
    borderWidth: 1,
  },
  reviewButtonText: { 
    color: '#4CAF50', 
    marginLeft: 6, 
    fontWeight: '500' 
  },
  statsRow: {
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginHorizontal: 16, 
    marginTop: 8, 
    marginBottom: 12, 
    backgroundColor: '#fff', 
    paddingVertical: 12, 
    borderRadius: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 1 }, 
    shadowRadius: 3, 
    elevation: 2,
  },
  statBox: { 
    alignItems: 'center', 
    flex: 1 
  },
  statValue: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  statLabel: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  tabsContainer: {
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    elevation: 2,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2,
  },
  tabButton: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 12 
  },
  activeTabButton: { 
    borderBottomWidth: 2, 
    borderBottomColor: '#4CAF50' 
  },
  tabText: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 4 
  },
  activeTabText: { 
    color: '#4CAF50', 
    fontWeight: 'bold' 
  },
  tabContent: { 
    flex: 1, 
    padding: 8,
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