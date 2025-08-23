// screens/SellerProfileScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import MarketplaceHeader from '../components/MarketplaceHeader';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';
import RatingStars from '../components/RatingStars';

// Unified seller/business fetch
import { fetchSellerProfile } from '../services/marketplaceApi';

const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const sellerId = route.params?.sellerId || 'user123';
  const isBusinessHint = !!route.params?.isBusiness;

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants'); // 'myPlants' | 'sold' | 'reviews'
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sellerRating, setSellerRating] = useState({ average: 0, count: 0 });
  const [avatarError, setAvatarError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  // NEW: track logged-in user email (to decide if review button should show)
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem('userEmail').then(setCurrentUserEmail).catch(() => {});
  }, []);

  useEffect(() => {
    loadSellerProfile();
    (async () => {
      try {
        const fav =
          (await AsyncStorage.getItem('FAVORITES_UPDATED')) ||
          (await AsyncStorage.getItem('WISHLIST_UPDATED'));
        if (fav) {
          await AsyncStorage.removeItem('FAVORITES_UPDATED');
          await AsyncStorage.removeItem('WISHLIST_UPDATED');
          setRefreshKey(Date.now());
        }
      } catch (e) {
        console.warn('Error checking updates:', e);
      }
    })();
  }, [sellerId, refreshKey]);

  const loadSellerProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!sellerId) {
        setError('Unable to load seller profile. Missing seller ID.');
        setIsLoading(false);
        return;
      }
      console.log('Loading seller profile for ID:', sellerId, '(isBusiness hint =', isBusinessHint, ')');

      const profile = await fetchSellerProfile(sellerId, isBusinessHint ? 'business' : 'user');

      const unified = {
        id: profile.id || profile.email || sellerId,
        email: profile.email || profile.id || sellerId,
        name: profile.businessName || profile.name || 'Unknown Seller',
        avatar: profile.avatar || profile.logo,
        joinDate: profile.joinDate || profile.createdAt || new Date().toISOString(),
        bio: profile.bio || profile.description || '',
        stats: {
          plantsCount:
            profile.stats?.plantsCount ||
            (Array.isArray(profile.listings) ? profile.listings.length : 0) ||
            0,
        salesCount: profile.stats?.salesCount || 0,
          rating: profile.stats?.rating || profile.rating || 0,
        },
        listings: Array.isArray(profile.listings) ? profile.listings.slice() : [],
        isBusiness: profile.type === 'business' || profile.isBusiness === true,
      };

      unified.listings.forEach((listing) => {
        if (!listing.seller || !listing.seller.name || listing.seller.name === 'Unknown Seller') {
          listing.seller = {
            name: unified.name,
            _id: unified.id,
            email: unified.email,
            isBusiness: unified.isBusiness,
            businessName: unified.isBusiness ? unified.name : undefined,
          };
        }
      });

      setUser(unified);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching seller profile:', err);
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  const showToast = (message, type = 'info') => setToast({ visible: true, message, type });
  const hideToast = () => setToast((prev) => ({ ...prev, visible: false }));

  // FIXED: use currentUserEmail to decide and validate
  const handleAddReview = () => {
    if (!currentUserEmail) {
      showToast('User verification failed, proceeding anyway', 'warning');
      setShowReviewForm(true);
      return;
    }
    if (currentUserEmail === sellerId) {
      showToast('You cannot leave a review for your own profile', 'error');
      return;
    }
    setShowReviewForm(true);
  };

  const handleReviewsLoaded = (data) => {
    if (data && typeof data === 'object') {
      setSellerRating({
        average: data.averageRating || 0,
        count: data.count || 0,
      });
    }
  };

  const handleReviewSubmitted = () => {
    setActiveTab('reviews');
    setRefreshKey(Date.now());
    showToast('Your review has been submitted successfully!', 'success');
    setShowReviewForm(false);
  };

  const getAvatarUrl = (name, email) => {
    const displayName = name || 'Unknown';
    const firstInitial = displayName.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      firstInitial
    )}&background=4CAF50&color=fff&size=256`;
  };

  const avatarUrl =
    user?.avatar && !avatarError ? user.avatar : getAvatarUrl(user?.name || '', user?.email || '');

  const displayRating = useMemo(
    () => (sellerRating.average > 0 ? sellerRating.average : user?.stats?.rating || 0),
    [sellerRating.average, user?.stats?.rating]
  );
  const formattedRating = typeof displayRating === 'number' ? displayRating.toFixed(1) : '0.0';

  // Header (profile + stats + tabs)
  const HeaderSection = () => (
    <View>
      <View style={styles.profileCard}>
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
          resizeMode="cover"
          onError={() => setAvatarError(true)}
        />
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <Text style={styles.joinDate}>
          Joined{' '}
          {new Date(user?.joinDate || Date.now()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          })}
        </Text>
        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {/* FIXED: only show if logged-in user isn't the seller */}
        {currentUserEmail && currentUserEmail !== sellerId && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={handleAddReview}
            accessible
            accessibilityLabel="Write a review"
            accessibilityRole="button"
          >
            <MaterialIcons name="rate-review" size={16} color="#4CAF50" />
            <Text style={styles.reviewButtonText}>Write a review</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user?.stats?.plantsCount || 0}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user?.stats?.salesCount || 0}</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
        <View style={styles.statBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.statValue}>{formattedRating}</Text>
            <RatingStars rating={displayRating} size={16} />
          </View>
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
          <MaterialIcons
            name="local-offer"
            size={24}
            color={activeTab === 'sold' ? '#4CAF50' : '#666'}
          />
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
    </View>
  );

  // Listings for current tab
  const listings = useMemo(() => {
    if (!user?.listings) return [];
    if (activeTab === 'myPlants') return user.listings.filter((p) => p.status === 'active' || !p.status);
    if (activeTab === 'sold') return user.listings.filter((p) => p.status === 'sold');
    return [];
  }, [user?.listings, activeTab]);

  const renderListing = ({ item }) => (
    <View style={styles.gridItem}>
      <PlantCard plant={item} showActions={false} />
    </View>
  );

  // Loading/error states
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Seller Profile"
          showBackButton
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

  if (error || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Seller Profile"
          showBackButton
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error || 'Seller profile could not be loaded.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSellerProfile}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Seller Profile"
        showBackButton
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />

      {activeTab === 'reviews' ? (
        // Avoid nesting a VirtualizedList inside a ScrollView
        <View style={{ flex: 1 }}>
          <FlatList
            data={[{ key: 'header' }]}
            renderItem={() => <HeaderSection />}
            keyExtractor={() => 'header'}
            ListFooterComponent={<View style={{ height: 8 }} />}
          />
          <View style={styles.reviewsContainer}>
            <ReviewsList
              targetType="seller"
              targetId={sellerId}
              onAddReview={null}
              onReviewsLoaded={handleReviewsLoaded}
              autoLoad
              hideAddButton
              key={`reviews-${refreshKey}`}
            />
          </View>
        </View>
      ) : (
        // One FlatList for Active/Sold with header + grid items
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={(item, index) => (item.id || item._id || `plant-${index}`).toString()}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<HeaderSection />}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <MaterialIcons
                name={activeTab === 'myPlants' ? 'eco' : 'local-offer'}
                size={48}
                color="#ccc"
              />
              <Text style={styles.emptyStateText}>
                {activeTab === 'myPlants'
                  ? 'This seller has no active listings'
                  : 'No sold plants yet'}
              </Text>
            </View>
          }
        />
      )}

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
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 12, backgroundColor: '#4CAF50' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 2 },
  joinDate: { fontSize: 12, color: '#999', marginTop: 2 },
  bio: { marginTop: 10, fontSize: 14, color: '#555', textAlign: 'center' },

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
  reviewButtonText: { color: '#4CAF50', marginLeft: 6, fontWeight: '500' },

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
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#4CAF50' },
  tabText: { fontSize: 14, color: '#666', marginTop: 4 },
  activeTabText: { color: '#4CAF50', fontWeight: 'bold' },

  listContent: { paddingBottom: 80 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 8 },
  gridItem: { width: '48%', marginVertical: 6 },

  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },

  reviewsContainer: { flex: 1, paddingHorizontal: 8, paddingBottom: 16 },
});

export default SellerProfileScreen;
