// screens/SellerProfileScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';
import RatingStars from '../components/RatingStars';

import { fetchUserProfile } from '../services/marketplaceApi';

const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Route params that help us build a fallback business profile
  const sellerId   = route.params?.sellerId || null;       // e.g. "ella@plant.com"
  const businessId = route.params?.businessId || sellerId; // prefer businessId if provided
  const sellerName = route.params?.sellerName || null;
  const isBusinessParam = !!route.params?.isBusiness;

  const [user, setUser]               = useState(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);
  const [activeTab, setActiveTab]     = useState('myPlants');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sellerRating, setSellerRating]     = useState({ average: 0, count: 0 });
  const [avatarError, setAvatarError] = useState(false);
  const [refreshKey, setRefreshKey]   = useState(Date.now());

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const showToast = useCallback((message, type = 'info') => setToast({ visible: true, message, type }), []);
  const hideToast = useCallback(() => setToast((t) => ({ ...t, visible: false })), []);

  // Build a fallback business profile if marketplace user not found
  const buildBusinessFallback = useCallback(() => {
    const name = sellerName || (sellerId ? sellerId.split('@')[0] : 'Business');
    return {
      id: businessId || sellerId || 'unknown',
      name,
      email: businessId || sellerId || '',
      bio: '',
      joinDate: new Date().toISOString(),
      isBusiness: true || isBusinessParam,
      stats: { plantsCount: 0, salesCount: 0, rating: 0 },
      socialMedia: {},
      listings: [],          // you can hydrate these later if you add a business listings endpoint
      avatar: null,
    };
  }, [businessId, sellerId, sellerName, isBusinessParam]);

  const getAvatarUrl = useCallback((name) => {
    const display = name || 'User';
    if (user?.avatar && !avatarError) return user.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(display)}&background=4CAF50&color=fff&size=256`;
  }, [user?.avatar, avatarError]);

  const loadSellerProfile = useCallback(async () => {
    if (!sellerId) {
      setError('Unable to load seller profile. Missing seller ID.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First try marketplace user profile
      const data = await fetchUserProfile(sellerId);

      // API may return either the object or { user: {...} }
      const u = data?.user || data;
      if (u && (u.id || u.email)) {
        // Normalize minimal fields we need
        const normalized = {
          id: u.id || sellerId,
          name: u.name || u.email?.split('@')[0] || sellerName || 'Seller',
          email: u.email || sellerId,
          bio: u.bio || '',
          joinDate: u.joinDate || u.created_at || new Date().toISOString(),
          stats: u.stats || { plantsCount: (u.listings?.length || 0), salesCount: 0, rating: u.rating || 0 },
          socialMedia: u.socialMedia || {},
          avatar: u.avatar || null,
          isBusiness: !!(u.isBusiness || isBusinessParam),
          listings: Array.isArray(u.listings) ? u.listings.map((p) => ({
            ...p,
            seller: p.seller || {
              name: u.name || u.email?.split('@')[0] || 'Seller',
              _id: u.id || u.email,
              email: u.email,
            },
          })) : [],
        };
        setUser(normalized);
        setIsLoading(false);
        return;
      }

      // If we got back something unexpected, synthesize a business fallback
      setUser(buildBusinessFallback());
      setIsLoading(false);
    } catch (e) {
      // If marketplace user is missing (e.g., pure business), synthesize a business profile
      setUser(buildBusinessFallback());
      setIsLoading(false);
    }
  }, [sellerId, isBusinessParam, sellerName, buildBusinessFallback]);

  // Initial load + refresh on flags
  useEffect(() => {
    (async () => {
      try {
        // If this was opened from a business listing, skip the marketplace user fetch.
        if (isBusinessParam) {
          setUser(buildBusinessFallback());
          setIsLoading(false);
          return;
        }

        await loadSellerProfile();

        // clear wishlist/favorites flags as you already had
        const favoritesUpdated =
          (await AsyncStorage.getItem('FAVORITES_UPDATED')) ||
          (await AsyncStorage.getItem('WISHLIST_UPDATED'));
        if (favoritesUpdated) {
          await AsyncStorage.multiRemove(['FAVORITES_UPDATED', 'WISHLIST_UPDATED']);
          setRefreshKey(Date.now());
        }
      } catch {}
    })();
  }, [isBusinessParam, loadSellerProfile]);


  const handleAddReview = useCallback(() => {
    AsyncStorage.getItem('userEmail')
      .then((email) => {
        if (email && sellerId && email === sellerId) {
          showToast('You cannot leave a review for your own profile', 'error');
          return;
        }
        setShowReviewForm(true);
      })
      .catch(() => {
        showToast('User verification failed, proceeding anyway', 'warning');
        setShowReviewForm(true);
      });
  }, [sellerId, showToast]);

  const handleReviewsLoaded = useCallback((data) => {
    if (data && typeof data === 'object') {
      setSellerRating({
        average: data.averageRating || data.average || 0,
        count: data.count || 0,
      });
    }
  }, []);

  const handleReviewSubmitted = useCallback(() => {
    setActiveTab('reviews');
    setRefreshKey(Date.now());
    showToast('Your review has been submitted successfully!', 'success');
    setShowReviewForm(false);
  }, [showToast]);

  // ---- Tabs content (avoid FlatList inside ScrollView) ----
  const listingsForTab = useMemo(() => {
    const listings = user?.listings || [];
    if (activeTab === 'sold') {
      return listings.filter((p) => p.status === 'sold');
    }
    if (activeTab === 'myPlants') {
      return listings.filter((p) => p.status === 'active' || !p.status);
    }
    return listings;
  }, [user?.listings, activeTab]);

  // ---- Loading / Error ----
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

  if (!user) {
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

  const avatarUrl = getAvatarUrl(user.name);
  const displayRating = sellerRating.average > 0 ? sellerRating.average : (user.stats?.rating || 0);
  const formattedRating = typeof displayRating === 'number' ? displayRating.toFixed(1) : '0.0';

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Seller Profile"
        showBackButton
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <ToastMessage visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} duration={3000} />

      <ScrollView>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            resizeMode="cover"
            onError={() => setAvatarError(true)}
          />
          <Text style={styles.userName}>{user.name || 'Seller'}</Text>
          {!!user.email && <Text style={styles.userEmail}>{user.email}</Text>}
          <Text style={styles.joinDate}>
            Joined {new Date(user.joinDate || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </Text>
          {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          {/* Optional: message seller/business button */}
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() => {
              const sid = businessId || sellerId || user.id || user.email;
              if (!sid) return Alert.alert('Error', 'Seller information is not available.');
              navigation.navigate('Messages', {
                sellerId: sid,
                sellerName: user.name || 'Seller',
                isBusiness: user.isBusiness || isBusinessParam,
              });
            }}
          >
            <MaterialIcons name="chat-bubble-outline" size={16} color="#fff" />
            <Text style={styles.messageText}>Message {user.isBusiness ? 'Business' : 'Seller'}</Text>
          </TouchableOpacity>

          {/* Write review */}
          {user.email && sellerId && user.email !== sellerId && (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={handleAddReview}
              accessible
              accessibilityLabel="Write a review"
              accessibilityRole="button"
            >
              <MaterialIcons name="rate-review" size={16} color="#4CAF50" />
              <Text style={styles.reviewButtonText}>Write a Review</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user.stats?.plantsCount || (user.listings?.length || 0)}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user.stats?.salesCount || 0}</Text>
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

        {/* Tabs */}
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

        {/* Tab Content (no FlatList to avoid VirtualizedList-in-ScrollView warning) */}
        <View style={styles.tabContent}>
          {activeTab === 'reviews' ? (
            <ReviewsList
              key={`reviews-${refreshKey}`}
              targetType="seller"
              targetId={sellerId || user.id || user.email}
              onAddReview={null}
              onReviewsLoaded={handleReviewsLoaded}
              autoLoad
              hideAddButton
            />
          ) : (
            <>
              {listingsForTab.length === 0 ? (
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
              ) : (
                <View style={styles.gridWrap}>
                  {listingsForTab.map((item) => (
                    <View style={styles.gridItem} key={item.id || item._id || String(Math.random())}>
                      <PlantCard plant={item} showActions={false} />
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Review Form Modal */}
      <ReviewForm
        targetId={sellerId || user.id || user.email}
        targetType="seller"
        isVisible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </SafeAreaView>
  );
};

const GUTTER = 8;

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

  messageBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  messageText: { color: '#fff', marginLeft: 6, fontWeight: '700' },

  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
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

  tabContent: { flex: 1, padding: 8, minHeight: 300 },

  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },

  // simple 2-col grid without FlatList (avoid VirtualizedList-in-ScrollView warning)
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: GUTTER,
  },
  gridItem: {
    width: `48%`,
    marginHorizontal: GUTTER,
    marginBottom: GUTTER * 2,
  },
});

export default SellerProfileScreen;
