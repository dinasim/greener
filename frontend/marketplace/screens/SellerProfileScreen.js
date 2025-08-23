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

// Components
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import MarketplaceHeader from '../components/MarketplaceHeader';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';
import RatingStars from '../components/RatingStars';

// API helpers
import {
  fetchSellerProfile,
  fetchBusinessInventory,
  getUserListings,
} from '../services/marketplaceApi';

const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const sellerId = route.params?.sellerId || 'user123';
  // force private profile look regardless of any isBusiness hint
  const initialTab = route.params?.initialTab || 'myPlants';

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab); // 'myPlants' | 'sold' | 'reviews'
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sellerRating, setSellerRating] = useState({ average: 0, count: 0 });
  const [avatarError, setAvatarError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
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
      } catch {}
    })();
  }, [sellerId, refreshKey]);

  // ---------- data helpers ----------
  const normalizeListing = (raw, sellerMeta) => {
    const id =
      raw.id ||
      raw._id ||
      raw.productId ||
      raw.itemId ||
      `${raw.name || raw.title || 'item'}-${Math.random()}`;

    const qty = Number(
      raw.quantity ?? raw.availableQuantity ?? raw.inventory?.quantity ?? 0
    );

    let status =
      raw.status ||
      (raw.sold === true ? 'sold' : undefined) ||
      (qty <= 0 ? 'sold' : 'active');
    status = String(status || 'active').toLowerCase();

    const images = Array.isArray(raw.images)
      ? raw.images
      : raw.image
      ? [raw.image]
      : raw.photoUrl
      ? [raw.photoUrl]
      : [];

    return {
      ...raw,
      id,
      _id: id,
      status,
      images,
      // hard-set private seller meta here (prevents business visual bleed)
      seller:
        raw.seller && (raw.seller.name || raw.seller.email)
          ? { ...raw.seller, isBusiness: false }
          : {
              name: sellerMeta.name,
              _id: sellerMeta.id,
              email: sellerMeta.email,
              isBusiness: false,
            },
      sellerType: 'individual',
      isBusinessListing: false,
    };
  };

  const fetchListingsFallback = async (emailOrId, sellerMeta) => {
    try {
      // strictly pull **user** listings here for private profiles
      const userResp = await getUserListings(emailOrId, 'all');
      const userArr =
        userResp?.listings ||
        [
          ...(userResp?.active || []),
          ...(userResp?.sold || []),
          ...(userResp?.deleted || []),
        ] ||
        (Array.isArray(userResp) ? userResp : []);
      return (userArr || []).map((x) => normalizeListing(x, sellerMeta));
    } catch {
      return [];
    }
  };

  const computeCounts = (listingsArr) => {
    const active = listingsArr.filter(
      (p) => (p.status ? String(p.status).toLowerCase() === 'active' : true)
    ).length;
    const sold = listingsArr.filter(
      (p) => String(p.status).toLowerCase() === 'sold'
    ).length;
    return { active, sold, total: listingsArr.length };
  };

  const loadSellerProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!sellerId) {
        setError('Unable to load seller profile. Missing seller ID.');
        setIsLoading(false);
        return;
      }

      // ALWAYS fetch as a **user**, not business
      const profile = await fetchSellerProfile(sellerId, 'user');

      const unified = {
        id: profile.id || profile.email || sellerId,
        email: profile.email || profile.id || sellerId,
        name: profile.name || profile.businessName || 'Unknown Seller',
        avatar: profile.avatar || profile.logo,
        joinDate: profile.joinDate || profile.createdAt || new Date().toISOString(),
        bio: profile.bio || '',
        stats: {
          plantsCount:
            profile.stats?.plantsCount ||
            (Array.isArray(profile.listings) ? profile.listings.length : 0) ||
            0,
          salesCount: profile.stats?.salesCount || 0,
          rating: profile.stats?.rating || profile.rating || 0,
        },
        listings: Array.isArray(profile.listings) ? profile.listings.slice() : [],
        // 🔒 force individual
        isBusiness: false,
      };

      if (!unified.listings || unified.listings.length === 0) {
        const hydrated = await fetchListingsFallback(unified.email, unified);
        unified.listings = hydrated;
      }

      unified.listings = (unified.listings || []).map((l) =>
        normalizeListing(l, unified)
      );

      const counts = computeCounts(unified.listings);
      unified.stats.plantsCount = counts.active;
      if (!profile.stats?.salesCount) unified.stats.salesCount = counts.sold;

      setUser(unified);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  // ---------- ui helpers ----------
  const showToast = (message, type = 'info') =>
    setToast({ visible: true, message, type });
  const hideToast = () => setToast((p) => ({ ...p, visible: false }));

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

  const handleMessageSeller = () => {
    if (!user) return;
    const params = {
      sellerId: user.id || user.email,
      sellerName: user.name,
      isBusiness: false,
      autoMessage: `Hi ${user.name}, I'm interested in your listings.`,
      forceChat: true,
    };
    try {
      navigation.navigate('MarketplaceTabs', { screen: 'Messages', params });
    } catch {
      try {
        navigation.navigate('Messages', params);
      } catch {
        navigation.navigate('MainTabs', { screen: 'Messages', params });
      }
    }
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

  const getAvatarUrl = (name) => {
    const firstInitial = (name || 'U').charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      firstInitial
    )}&background=9CCC65&color=fff&size=256`;
  };

  const avatarUrl =
    user?.avatar && !avatarError ? user.avatar : getAvatarUrl(user?.name || '');

  const displayRating = useMemo(
    () => (sellerRating.average > 0 ? sellerRating.average : user?.stats?.rating || 0),
    [sellerRating.average, user?.stats?.rating]
  );
  const formattedRating =
    typeof displayRating === 'number' && Number.isFinite(displayRating)
      ? displayRating.toFixed(1)
      : '0.0';

  // Distinct Header (cover + badge + message button)
  const HeaderSection = () => (
    <View>
      {/* Cover banner to make it feel unlike business */}
      <View style={styles.cover} />
      <View style={styles.headerCard}>
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
          resizeMode="cover"
          onError={() => setAvatarError(true)}
        />
        <View style={styles.nameRow}>
          <Text style={styles.userName}>{user?.name}</Text>
          <View style={styles.badge}>
            <MaterialIcons name="person" size={12} color="#2e7d32" />
            <Text style={styles.badgeText}>Individual Seller</Text>
          </View>
        </View>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <Text style={styles.joinDate}>
          Member since{' '}
          {new Date(user?.joinDate || Date.now()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          })}
        </Text>

        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        <View style={styles.primaryActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleMessageSeller}>
            <MaterialIcons name="chat" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Message Seller</Text>
          </TouchableOpacity>
          {currentUserEmail && currentUserEmail !== sellerId && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddReview}>
              <MaterialIcons name="rate-review" size={18} color="#2e7d32" />
              <Text style={styles.secondaryBtnText}>Write Review</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* compact chips instead of business-like stats row */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <MaterialIcons name="eco" size={14} color="#2e7d32" />
            <Text style={styles.chipText}>{user?.stats?.plantsCount || 0} active</Text>
          </View>
          <View style={styles.chip}>
            <MaterialIcons name="local-offer" size={14} color="#2e7d32" />
            <Text style={styles.chipText}>{user?.stats?.salesCount || 0} sold</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {formattedRating}{' '}
            </Text>
            <RatingStars rating={displayRating} size={14} />
          </View>
        </View>
      </View>

      {/* segmented tabs (different from business underline style) */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'myPlants' && styles.segmentActive]}
          onPress={() => setActiveTab('myPlants')}
        >
          <Text style={[styles.segmentText, activeTab === 'myPlants' && styles.segmentTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'sold' && styles.segmentActive]}
          onPress={() => setActiveTab('sold')}
        >
          <Text style={[styles.segmentText, activeTab === 'sold' && styles.segmentTextActive]}>
            Sold
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'reviews' && styles.segmentActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.segmentText, activeTab === 'reviews' && styles.segmentTextActive]}>
            Reviews
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Listings for current tab
  const listings = useMemo(() => {
    if (!user?.listings) return [];
    if (activeTab === 'myPlants') {
      return user.listings.filter((p) =>
        p.status ? String(p.status).toLowerCase() === 'active' : true
      );
    }
    if (activeTab === 'sold') {
      return user.listings.filter((p) => String(p.status).toLowerCase() === 'sold');
    }
    return [];
  }, [user?.listings, activeTab]);

  const renderListing = ({ item }) => (
    <View style={styles.gridItem}>
      <PlantCard plant={item} showActions={false} />
    </View>
  );

  // Loading / error
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Seller"
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
          title="Seller"
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
        title="Seller"
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
        <View style={{ flex: 1 }}>
          <ReviewsList
            targetType="seller"
            targetId={sellerId}
            onAddReview={null}
            onReviewsLoaded={handleReviewsLoaded}
            autoLoad
            hideAddButton
            ListHeaderComponent={HeaderSection}
            key={`reviews-${refreshKey}`}
          />
        </View>
      ) : (
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

      {/* Hidden preloader for rating */}
      <View style={{ height: 0, overflow: 'hidden' }}>
        <ReviewsList
          targetType="seller"
          targetId={sellerId}
          onAddReview={null}
          onReviewsLoaded={handleReviewsLoaded}
          autoLoad
          hideAddButton
          key={`preload-${sellerId}`}
        />
      </View>

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
  container: { flex: 1, backgroundColor: '#f5f7f5' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#f44336', textAlign: 'center', marginVertical: 10 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#4CAF50', borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: '600' },

  // distinct look
  cover: {
    height: 90,
    backgroundColor: '#E8F5E9',
  },
  headerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -36,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#9CCC65',
    position: 'absolute',
    top: -42,
    borderWidth: 3,
    borderColor: '#fff',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  userName: { fontSize: 20, fontWeight: '800', color: '#2e7d32', marginRight: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF6EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  badgeText: { marginLeft: 4, fontSize: 11, color: '#2e7d32', fontWeight: '600' },
  userEmail: { fontSize: 12, color: '#78909C', marginTop: 2 },
  joinDate: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  bio: { marginTop: 10, fontSize: 14, color: '#455A64', textAlign: 'center' },

  primaryActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#fff', marginLeft: 6, fontWeight: '600' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C5E1A5',
  },
  secondaryBtnText: { color: '#2e7d32', marginLeft: 6, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6FBF7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0F2F1',
    gap: 6,
  },
  chipText: { color: '#2e7d32', fontSize: 12, fontWeight: '600' },

  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 4,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { color: '#2e7d32', fontWeight: '600' },
  segmentTextActive: { color: '#2e7d32' },

  listContent: { paddingBottom: 80 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 8 },
  gridItem: { width: '48%', marginVertical: 6 },

  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },
});

export default SellerProfileScreen;
