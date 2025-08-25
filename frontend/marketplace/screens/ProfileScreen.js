// screens/ProfileScreen.js — SINGLE FLATLIST, FAVORITES AS LIST, FIXED HOOK ORDER
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList,
  ActivityIndicator, SafeAreaView, Linking, Alert
} from 'react-native';
import { MaterialIcons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import RatingStars from '../components/RatingStars';
import * as WishlistService from '../services/WishlistService';
import { markAsSold, updateProductPrice } from '../services/marketplaceApi';

// NEW: import listings helpers
import { getUserListings, processIndividualProducts } from '../services/marketplaceApi';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // ---- state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants');
  const [ratingData, setRatingData] = useState({ average: 0, count: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [wishlistProducts, setWishlistProducts] = useState([]);

  // NEW: hold real listings (not user.plants)
  const [myListings, setMyListings] = useState([]);
  const [isListingsLoading, setIsListingsLoading] = useState(false);

  // ---- memoized helpers
  const getAvatarUrl = useCallback(() => {
    if (!user) return `https://ui-avatars.com/api/?name=User&background=4CAF50&color=fff&size=80`;
    return (
      user?.avatar?.url ||
      user?.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=4CAF50&color=fff&size=80`
    );
  }, [user?.avatar, user?.name]);

  const tabData = useMemo(() => [
    { id: 'myPlants',  label: 'My Plants', icon: 'eco',         count: myListings.length || 0 },
    { id: 'favorites', label: 'Favorites', icon: 'favorite',    count: wishlistProducts.length || 0 },
    { id: 'sold',      label: 'Sold',      icon: 'local-offer', count: user?.soldPlants?.length || 0 },
    { id: 'reviews',   label: 'Reviews',   icon: 'star',        count: ratingData?.count || 0 },
  ], [myListings.length, wishlistProducts.length, user?.soldPlants?.length, ratingData?.count]);
const refreshWishlist = useCallback(async (force = false) => {
   try {
     const ids   = await WishlistService.load({ force });
     const prods = await WishlistService.fetchProducts(ids);
     setWishlistProducts(prods);
   } catch (e) {
     console.warn('[ProfileScreen] refreshWishlist failed:', e?.message);
     setWishlistProducts([]);
   }
 }, []);

  // NEW: fetch listings from API and normalize to Product cards
  const loadMyListings = useCallback(async (uid) => {
    if (!uid) return;
    setIsListingsLoading(true);
    try {
      const res = await getUserListings(uid, 'active');
      const raw = Array.isArray(res)
        ? res
        : (res.listings || res.products || res.items || res.data || []);
      const normalized = processIndividualProducts(raw);
      setMyListings(normalized);
    } catch (e) {
      console.warn('[ProfileScreen] getUserListings failed:', e?.message || e);
      setMyListings([]);
    } finally {
      setIsListingsLoading(false);
    }
  }, []);

  const loadUserProfile = useCallback(async () => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    try {
      const userEmail     = await AsyncStorage.getItem('userEmail');
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const userId = currentUserId || userEmail;
      if (!userId) throw new Error('No user ID found - please sign in again');
      console.log('[ProfileScreen] Fetching user profile for:', userId);

      // Try marketplace profile
      try {
        const ctl1 = new AbortController();
        const to1 = setTimeout(() => ctl1.abort(), 10000);
        const r = await fetch(
          `https://usersfunctions.azurewebsites.net/api/marketplace/users/${encodeURIComponent(userId)}`,
          { signal: ctl1.signal }
        );
        clearTimeout(to1);
        if (r.ok && isMounted) {
          const d = await r.json();
          if (d && d.id) {
            const profile = {
              id: d.id || userId,
              name: d.name || d.email?.split('@')[0] || 'User',
              email: d.email || userEmail,
              joinDate: d.joinDate || d.created_at || new Date().toISOString(),
              bio: d.bio || '',
              // NOTE: do NOT trust d.plants; we load via getUserListings
              plants: [],
              favorites: d.favorites || [],
              soldPlants: d.soldPlants || [],
              stats: d.stats || { salesCount: 0 },
              socialMedia: d.socialMedia || {},
              avatar: d.avatar || null,
            };
            setUser(profile);
            await Promise.all([
              refreshWishlist(false),
              loadMyListings(userId),      // NEW
            ]);
            return;
          }
        }
      } catch (e) {
        console.log('[ProfileScreen] Marketplace profile not found or error:', e.message);
      }

      // Fallback: app signup data
      try {
        const ctl2 = new AbortController();
        const to2 = setTimeout(() => ctl2.abort(), 10000);
        const r = await fetch(
          `https://usersfunctions.azurewebsites.net/api/registerUser?email=${encodeURIComponent(userId)}`,
          { signal: ctl2.signal }
        );
        clearTimeout(to2);
        if (r.ok) {
          const u = await r.json();
          if (u && u.name) {
            const newProfile = {
              id: userId, name: u.name, email: u.email || userId,
              joinDate: u.created_at || new Date().toISOString(),
              bio: '', plants: [], favorites: [], soldPlants: [],
              stats: { salesCount: 0 }, socialMedia: {}, avatar: null,
              plantLocations: u.plantLocations || [], interests: u.intersted || [],
              hasAnimals: u.animals || false, hasKids: u.kids || false,
            };
            try {
              await fetch('https://usersfunctions.azurewebsites.net/api/user-profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProfile),
              });
            } catch (e) { console.warn('[ProfileScreen] Error saving new profile:', e.message); }
            setUser(newProfile);
            await Promise.all([
              refreshWishlist(false),
              loadMyListings(userId),      // NEW
            ]);
            return;
          }
        }
      } catch (e) {
        console.log('[ProfileScreen] App signup data not found or error:', e.message);
      }

      // Local storage fallback
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const storedUser = JSON.parse(userData);
          const fallback = {
            id: userId,
            name: storedUser.name || userEmail?.split('@')[0] || 'User',
            email: storedUser.email || userEmail || '',
            joinDate: storedUser.joinDate || new Date().toISOString(),
            bio: '',
            plants: [],
            favorites: [],
            soldPlants: [],
            stats: { salesCount: 0 },
            socialMedia: {},
            avatar: null,
          };
          setUser(fallback);
          await Promise.all([
            refreshWishlist(false),
            loadMyListings(userId),        // NEW
          ]);
          return;
        }
      } catch (e) {
        console.warn('[ProfileScreen] Failed to parse local user data:', e.message);
      }

      // Minimal fallback
      const minimal = {
        id: userId,
        name: userEmail?.split('@')[0] || 'User',
        email: userEmail || '',
        joinDate: new Date().toISOString(),
        bio: '',
        plants: [],
        favorites: [],
        soldPlants: [],
        stats: { salesCount: 0 },
        socialMedia: {},
        avatar: null,
      };
      setUser(minimal);
      await Promise.all([
        refreshWishlist(false),
        loadMyListings(userId),          // NEW
      ]);
    } catch (err) {
      console.error('[ProfileScreen] Critical error loading profile:', err);
      setError(`Failed to load profile: ${err.message}`);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshWishlist, loadMyListings]);

  const handleRetry = useCallback(async () => {
    await loadUserProfile();
    if (user?.id) await loadMyListings(user.id); // NEW: ensure listings reload
    await refreshWishlist(true);
    setLastUpdateTime(Date.now());
  }, [loadUserProfile, refreshWishlist, loadMyListings, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      (async () => {
        await loadUserProfile();
        try {
          if (controller.signal.aborted) return;
          const flags = await Promise.all([
            AsyncStorage.getItem('WISHLIST_UPDATED'),
            AsyncStorage.getItem('FAVORITES_UPDATED'),
            AsyncStorage.getItem('PROFILE_UPDATED'),
            AsyncStorage.getItem('REVIEW_UPDATED'),
            AsyncStorage.getItem('PRODUCT_UPDATED'),
          ]);
          const needs = flags.some(Boolean) || route.params?.refresh;
          if (needs && !controller.signal.aborted) {
            await Promise.all([
              AsyncStorage.removeItem('WISHLIST_UPDATED'),
              AsyncStorage.removeItem('FAVORITES_UPDATED'),
              AsyncStorage.removeItem('PROFILE_UPDATED'),
              AsyncStorage.removeItem('REVIEW_UPDATED'),
              AsyncStorage.removeItem('PRODUCT_UPDATED'),
            ]);
            await loadUserProfile();
            setLastUpdateTime(Date.now());
            await refreshWishlist(true);
            if (user?.id) await loadMyListings(user.id); // NEW
            if (route.params?.refresh) navigation.setParams({ refresh: undefined });
          }
        } catch (e) {
          console.error('[ProfileScreen] Error checking for updates:', e);
        }
      })();
      return () => controller.abort();
    }, [loadUserProfile, refreshWishlist, loadMyListings, navigation, route.params?.refresh, user?.id])
  );

  // ----- list config (ALL HOOKS ABOVE ANY RETURNS) -----
  // Only "myPlants" and "sold" are grid; "favorites" is a single-column list
  const isGridTab = activeTab === 'myPlants' || activeTab === 'sold';
  const numColumns = isGridTab ? 2 : 1;

  const data = useMemo(() => {
    if (activeTab === 'myPlants')  return myListings || [];
    if (activeTab === 'favorites') return wishlistProducts || [];
    if (activeTab === 'sold')      return user?.soldPlants || [];
    return []; // reviews tab -> header renders content
  }, [activeTab, myListings, user?.soldPlants, wishlistProducts]);

  const emptyMeta = useMemo(() => {
    if (activeTab === 'myPlants') {
      return { icon: 'eco', title: 'No plants listed yet', subtitle: null, actionText: 'Add Your First Plant', onAction: () => navigation.navigate('AddPlant') };
    }
    if (activeTab === 'favorites') {
      return { icon: 'favorite-border', title: 'No favorites yet', subtitle: 'Heart some plants to add them to your favorites!' };
    }
    if (activeTab === 'sold') {
      return { icon: 'local-offer', title: 'No plants sold yet', subtitle: "Once you sell some plants, they'll appear here" };
    }
    return {};
  }, [activeTab, navigation]);

  const renderEmptyState = (icon, title, subtitle, actionText, onAction) => (
    <View style={styles.emptyStateContainer}>
      <MaterialIcons name={icon} size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>{title}</Text>
      {subtitle && <Text style={styles.emptyStateTextSecondary}>{subtitle}</Text>}
      {actionText && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const header = useCallback(() => (
    <View>
      <View style={styles.profileCard}>
        <Image source={{ uri: getAvatarUrl() }} style={styles.avatar} accessible accessibilityLabel={`${user?.name || 'User'} profile picture`} />
        <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
        <Text style={styles.joinDate}>
          Joined {user?.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
        </Text>
        {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}

        {user?.socialMedia && (user.socialMedia.instagram || user.socialMedia.facebook) && (
          <View style={styles.socialMediaSection}>
            <Text style={styles.socialMediaTitle}>Connect with me</Text>
            <View style={styles.socialMediaButtons}>
              {user.socialMedia.instagram && (
                <TouchableOpacity
                  style={styles.socialMediaButton}
                  onPress={() => Linking.openURL(`https://instagram.com/${user.socialMedia.instagram.replace('@','')}`)}
                  accessible accessibilityLabel="Open Instagram profile" accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="instagram" size={20} color="#E4405F" />
                  <Text style={styles.socialMediaText}>Instagram</Text>
                </TouchableOpacity>
              )}
              {user.socialMedia.facebook && (
                <TouchableOpacity
                  style={styles.socialMediaButton}
                  onPress={() => Linking.openURL(
                    user.socialMedia.facebook.startsWith('http') ? user.socialMedia.facebook : `https://facebook.com/${user.socialMedia.facebook}`
                  )}
                  accessible accessibilityLabel="Open Facebook profile" accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="facebook" size={20} color="#1877F2" />
                  <Text style={styles.socialMediaText}>Facebook</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
          accessible accessibilityLabel="Edit profile" accessibilityRole="button"
        >
          <Feather name="edit" size={16} color="#4CAF50" />
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{myListings.length || 0}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user?.stats?.salesCount || 0}</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
        <View style={styles.statBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.statValue}>{(ratingData?.average ?? 0).toFixed(1)}</Text>
            <RatingStars rating={ratingData?.average ?? 0} size={16} />
          </View>
          <Text style={styles.statLabel}>Rating ({ratingData?.count ?? 0})</Text>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        {tabData.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
            onPress={() => setActiveTab(tab.id)}
            accessible accessibilityLabel={`${tab.label} tab`} accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <MaterialIcons name={tab.icon} size={24} color={activeTab === tab.id ? '#4CAF50' : '#666'} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'reviews' && (
        <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
          <ReviewsList
            targetType="seller"
            targetId={user?.id}
            onAddReview={null}
            onReviewsLoaded={setRatingData}
            autoLoad
            hideAddButton
          />
        </View>
      )}
    </View>
  ), [activeTab, getAvatarUrl, navigation, ratingData?.average, ratingData?.count, tabData, user?.bio, user?.email, user?.id, user?.joinDate, myListings.length, user?.stats?.salesCount]);

  // UPDATED: stable composite keys (uses __key if present)
  const keyExtractor = useCallback((item, i) => {
    if (item?.__key) return String(item.__key);
    const part1 = item?.isBusinessListing ? 'biz' : 'ind';
    const part2 = item?.businessId || item?.sellerId || '';
    const part3 = item?.id || item?._id || i;
    return `${part1}:${part2}:${part3}`;
  }, []);

  const renderItem = useCallback(({ item }) => {
    const onMarkedSold = async (id) => {
      setMyListings(prev => prev.map(p => p.id === id ? { ...p, status: 'sold' } : p));
    };
    const onPriceChanged = async (id, price) => {
      setMyListings(prev => prev.map(p => p.id === id ? { ...p, price } : p));
    };
   return (
       <View style={isGridTab ? styles.gridItem : styles.listItem}>
         <PlantCard
           plant={item}
         forceOwner={activeTab === 'myPlants'}
         onMarkedSold={onMarkedSold}
         onPriceChanged={onPriceChanged}
           delayPressIn={120}
           pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
           hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
         />
       </View>
     );
   }, [isGridTab, activeTab]);

  // ---- early returns (no hooks below this line) ----
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Profile not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---- main render
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="My Profile"
        showBackButton
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={numColumns}
        key={numColumns}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 80 }}
        columnWrapperStyle={isGridTab ? { gap: 8 } : undefined}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={11}
        ListEmptyComponent={() =>
          (isLoading || isListingsLoading) ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (isGridTab
              ? renderEmptyState(
                  emptyMeta.icon,
                  emptyMeta.title,
                  emptyMeta.subtitle,
                  emptyMeta.actionText,
                  emptyMeta.onAction
                )
              : null)
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 16 },
  errorText: { color: '#f44336', fontSize: 16, textAlign: 'center', marginTop: 10 },
  retryButton: { marginTop: 16, backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },

  // header
  profileCard: {
    backgroundColor: '#f0f9f3', margin: 16, padding: 20, borderRadius: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4,
  },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 12, backgroundColor: '#e0e0e0' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 2 },
  joinDate: { fontSize: 12, color: '#999', marginTop: 2 },
  bio: { marginTop: 10, fontSize: 14, color: '#555', textAlign: 'center' },

  socialMediaSection: { marginTop: 16, alignItems: 'center' },
  socialMediaTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  socialMediaButtons: { flexDirection: 'row', gap: 12 },
  socialMediaButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
  },
  socialMediaText: { fontSize: 13, fontWeight: '500', color: '#333', marginLeft: 6 },

  editProfileButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderColor: '#4CAF50', borderWidth: 1,
  },
  editProfileText: { color: '#4CAF50', marginLeft: 6, fontWeight: '500' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginTop: 8, marginBottom: 12,
    backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  tabsContainer: {
    flexDirection: 'row', backgroundColor: '#fff', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#4CAF50' },
  tabText: { fontSize: 14, color: '#666', marginTop: 4 },
  activeTabText: { color: '#4CAF50', fontWeight: 'bold' },

  // list item wrappers
  gridItem: { flex: 1, marginVertical: 6, marginHorizontal: 4 },
  listItem: { width: '100%', marginVertical: 8 },

  emptyStateContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 40, minHeight: 200 },
  emptyStateText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 12 },
  emptyStateTextSecondary: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 4 },
  actionButton: { marginTop: 16, backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  actionButtonText: { color: '#fff', fontWeight: '600' },
});

export default ProfileScreen;
