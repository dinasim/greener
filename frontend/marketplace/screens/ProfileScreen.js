// screens/ProfileScreen.js - PERFORMANCE OPTIMIZED VERSION

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList, 
  ActivityIndicator, SafeAreaView, Alert, ScrollView, Linking
} from 'react-native';
import { MaterialIcons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import RatingStars from '../components/RatingStars';
import { fetchUserProfile } from '../services/marketplaceApi';
import { checkForUpdate, clearUpdate, UPDATE_TYPES, addUpdateListener, removeUpdateListener } from '../services/MarketplaceUpdates';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants');
  const [ratingData, setRatingData] = useState({ average: 0, count: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // FIXED: Memoize expensive computations to prevent re-renders
  const getAvatarUrl = useCallback(() => {
    if (!user) return `https://ui-avatars.com/api/?name=User&background=4CAF50&color=fff&size=80`;
    return user?.avatar?.url || user?.avatar || 
           `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=4CAF50&color=fff&size=80`;
  }, [user?.avatar, user?.name]);

  // FIXED: Memoize tab data to prevent unnecessary re-renders
  const tabData = useMemo(() => [
    { id: 'myPlants', label: 'My Plants', icon: 'eco', count: user?.plants?.length || 0 },
    { id: 'favorites', label: 'Favorites', icon: 'favorite', count: user?.favorites?.length || 0 },
    { id: 'sold', label: 'Sold', icon: 'local-offer', count: user?.soldPlants?.length || 0 },
    { id: 'reviews', label: 'Reviews', icon: 'star', count: ratingData?.count || 0 }
  ], [user?.plants?.length, user?.favorites?.length, user?.soldPlants?.length, ratingData?.count]);

  // FIXED: Optimized profile loading with proper cleanup
  const loadUserProfile = useCallback(async () => {
    let isMounted = true; // Prevent state updates if component unmounts
    
    setIsLoading(true);
    setError(null);
    
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      
      const userId = currentUserId || userEmail;
      
      if (!userId) {
        throw new Error('No user ID found - please sign in again');
      }
      
      console.log('[ProfileScreen] Fetching user profile for:', userId);
      
      // Step 1: Try to fetch existing marketplace profile
      try {
        // FIXED: Use correct deployed endpoint route
        const marketplaceResponse = await fetch(`https://usersfunctions.azurewebsites.net/api/marketplace/users/${encodeURIComponent(userId)}`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (marketplaceResponse.ok && isMounted) {
          const marketplaceData = await marketplaceResponse.json();
          
          if (marketplaceData && marketplaceData.id) {
            console.log('[ProfileScreen] Found existing marketplace profile:', marketplaceData);
            setUser({
              id: marketplaceData.id || userId,
              name: marketplaceData.name || marketplaceData.email?.split('@')[0] || 'User',
              email: marketplaceData.email || userEmail,
              joinDate: marketplaceData.joinDate || marketplaceData.created_at || new Date().toISOString(),
              bio: marketplaceData.bio || '',
              plants: marketplaceData.plants || [],
              favorites: marketplaceData.favorites || [],
              soldPlants: marketplaceData.soldPlants || [],
              stats: marketplaceData.stats || { salesCount: 0 },
              socialMedia: marketplaceData.socialMedia || {},
              avatar: marketplaceData.avatar || null
            });
            return; // Profile found, we're done
          }
        }
      } catch (marketplaceError) {
        console.log('[ProfileScreen] Marketplace profile not found or error:', marketplaceError.message);
      }
      
      // Step 2: Marketplace profile doesn't exist, try to get app signup data
      console.log('[ProfileScreen] No marketplace profile found, checking app signup data');
      
      try {
        // Try to fetch from the app's user registration data
        const appUserResponse = await fetch(`https://usersfunctions.azurewebsites.net/api/registeruser?email=${encodeURIComponent(userId)}`);
        
        if (appUserResponse.ok) {
          const appUserData = await appUserResponse.json();
          
          if (appUserData && appUserData.name) {
            console.log('[ProfileScreen] Found app signup data, creating marketplace profile:', appUserData);
            
            // Step 3: Create marketplace profile from app data
            const newMarketplaceProfile = {
              id: userId,
              name: appUserData.name,
              email: appUserData.email || userId,
              joinDate: appUserData.created_at || new Date().toISOString(),
              bio: '',
              plants: [],
              favorites: [],
              soldPlants: [],
              stats: { salesCount: 0 },
              socialMedia: {},
              avatar: null,
              // Additional fields from app signup
              plantLocations: appUserData.plantLocations || [],
              interests: appUserData.intersted || [],
              hasAnimals: appUserData.animals || false,
              hasKids: appUserData.kids || false
            };
            
            // Step 4: Save the new marketplace profile
            try {
              const createProfileResponse = await fetch('https://usersfunctions.azurewebsites.net/api/user-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMarketplaceProfile),
              });
              
              if (createProfileResponse.ok) {
                console.log('[ProfileScreen] Successfully created marketplace profile from app data');
              } else {
                console.warn('[ProfileScreen] Failed to save marketplace profile, but continuing with local data');
              }
            } catch (saveError) {
              console.warn('[ProfileScreen] Error saving marketplace profile:', saveError);
            }
            
            // Set the user data regardless of save success
            setUser(newMarketplaceProfile);
            return;
          }
        }
      } catch (appDataError) {
        console.log('[ProfileScreen] App signup data not found or error:', appDataError.message);
      }
      
      // Step 5: If both failed, check local storage as last resort
      console.log('[ProfileScreen] No database data found, checking local storage');
      const userData = await AsyncStorage.getItem('userData');
      
      if (userData) {
        try {
          const storedUser = JSON.parse(userData);
          console.log('[ProfileScreen] Using stored user data:', storedUser);
          
          const fallbackProfile = {
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
            avatar: null
          };
          
          setUser(fallbackProfile);
          return;
        } catch (parseError) {
          console.error('[ProfileScreen] Error parsing stored user data:', parseError);
        }
      }
      
      // Step 6: If everything fails, create a minimal profile
      console.log('[ProfileScreen] Creating minimal profile as fallback');
      setUser({
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
        avatar: null
      });
      
    } catch (error) {
      console.error('[ProfileScreen] Critical error loading user profile:', error);
      if (isMounted) {
        setError(`Failed to load profile: ${error.message}`);
        setUser(null);
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  // FIXED: Optimized focus effect with cleanup
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      
      loadUserProfile();
      console.log("[ProfileScreen] Screen focused, checking for updates");
      
      const checkUpdates = async () => {
        try {
          if (controller.signal.aborted) return;
          
          // Check various update flags directly
          const [wishlistUpdated, favoritesUpdated, profileUpdated, reviewUpdated, productUpdated] = await Promise.all([
            AsyncStorage.getItem('WISHLIST_UPDATED'),
            AsyncStorage.getItem('FAVORITES_UPDATED'),
            AsyncStorage.getItem('PROFILE_UPDATED'),
            AsyncStorage.getItem('REVIEW_UPDATED'),
            AsyncStorage.getItem('PRODUCT_UPDATED')
          ]);
          
          const needsRefresh = wishlistUpdated || favoritesUpdated || 
                              profileUpdated || reviewUpdated || 
                              productUpdated || route.params?.refresh;
          
          if (needsRefresh && !controller.signal.aborted) {
            console.log("[ProfileScreen] Updates detected, refreshing profile");
            // Clear all update flags
            await Promise.all([
              AsyncStorage.removeItem('WISHLIST_UPDATED'),
              AsyncStorage.removeItem('FAVORITES_UPDATED'),
              AsyncStorage.removeItem('PROFILE_UPDATED'),
              AsyncStorage.removeItem('REVIEW_UPDATED'),
              AsyncStorage.removeItem('PRODUCT_UPDATED')
            ]);
            
            // Reload user profile
            await loadUserProfile();
            setLastUpdateTime(Date.now());
            
            // Clear refresh param if present
            if (route.params?.refresh) {
              navigation.setParams({ refresh: undefined });
            }
          }
        } catch (error) {
          console.error('[ProfileScreen] Error checking for updates:', error);
        }
      };
      
      checkUpdates();
      
      // Cleanup function
      return () => {
        controller.abort();
      };
    }, [loadUserProfile, navigation, route.params?.refresh])
  );

  // FIXED: Memoized tab content renderer to prevent re-renders
  const renderTabContent = useCallback(() => {
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

    const renderPlantList = (data, emptyIcon, emptyTitle, emptySubtitle, actionText, onAction) => (
      <View style={styles.plantGrid}>
        {data?.length === 0 && !isLoading && 
          renderEmptyState(emptyIcon, emptyTitle, emptySubtitle, actionText, onAction)
        }
        
        <FlatList
          data={data}
          renderItem={({ item }) => <PlantCard plant={item} />}
          keyExtractor={(item) => item.id || `plant-${Math.random()}`}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          removeClippedSubviews={true} // Performance optimization
          maxToRenderPerBatch={6} // Render optimization
          windowSize={10} // Memory optimization
          ListEmptyComponent={() => isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : null}
        />
      </View>
    );

    switch (activeTab) {
      case 'myPlants':
        return renderPlantList(
          user?.plants, 
          'eco', 
          'No plants listed yet', 
          null,
          'Add Your First Plant', 
          () => navigation.navigate('AddPlant')
        );
      
      case 'favorites':
        return renderPlantList(
          user?.favorites, 
          'favorite-border', 
          'No favorites yet', 
          'Heart some plants to add them to your favorites!'
        );
      
      case 'sold':
        return renderPlantList(
          user?.soldPlants, 
          'local-offer', 
          'No plants sold yet', 
          'Once you sell some plants, they\'ll appear here'
        );
      
      case 'reviews':
        return (
          <ReviewsList 
            targetType="seller"
            targetId={user?.id}
            onAddReview={null}
            onReviewsLoaded={setRatingData}
            autoLoad={true}
            hideAddButton={true}
          />
        );
      
      default:
        return null;
    }
  }, [activeTab, user, isLoading, navigation]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="My Profile" 
          showBackButton 
          onBackPress={() => navigation.goBack()} 
          onNotificationsPress={() => navigation.navigate('Messages')} 
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="My Profile" 
          showBackButton 
          onBackPress={() => navigation.goBack()} 
          onNotificationsPress={() => navigation.navigate('Messages')} 
        />
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

  // Main render - only when user is loaded
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader 
          title="My Profile" 
          showBackButton 
          onBackPress={() => navigation.goBack()} 
          onNotificationsPress={() => navigation.navigate('Messages')} 
        />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Profile not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  // FIXED: Optimized main render with memoization
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader 
        title="My Profile" 
        showBackButton 
        onBackPress={() => navigation.goBack()} 
        onNotificationsPress={() => navigation.navigate('Messages')} 
      />
      <ScrollView removeClippedSubviews={true}>
        <View style={styles.profileCard}>
          <Image 
            source={{ uri: getAvatarUrl() }} 
            style={styles.avatar}
            accessible={true}
            accessibilityLabel={`${user?.name || 'User'} profile picture`}
          />
          <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <Text style={styles.joinDate}>
            Joined {user?.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
          </Text>
          {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
          
          {/* Social Media Section - with null safety */}
          {user?.socialMedia && (user.socialMedia.instagram || user.socialMedia.facebook) && (
            <View style={styles.socialMediaSection}>
              <Text style={styles.socialMediaTitle}>Connect with me</Text>
              <View style={styles.socialMediaButtons}>
                {user.socialMedia.instagram && (
                  <TouchableOpacity 
                    style={styles.socialMediaButton}
                    onPress={() => {
                      const username = user.socialMedia.instagram.replace('@', '');
                      Linking.openURL(`https://instagram.com/${username}`);
                    }}
                    accessible={true}
                    accessibilityLabel="Open Instagram profile"
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons name="instagram" size={20} color="#E4405F" />
                    <Text style={styles.socialMediaText}>Instagram</Text>
                  </TouchableOpacity>
                )}
                
                {user.socialMedia.facebook && (
                  <TouchableOpacity 
                    style={styles.socialMediaButton}
                    onPress={() => {
                      const profileUrl = user.socialMedia.facebook.startsWith('http') 
                        ? user.socialMedia.facebook 
                        : `https://facebook.com/${user.socialMedia.facebook}`;
                      Linking.openURL(profileUrl);
                    }}
                    accessible={true}
                    accessibilityLabel="Open Facebook profile"
                    accessibilityRole="button"
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
            accessible={true}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
          >
            <Feather name="edit" size={16} color="#4CAF50" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user?.plants?.length || 0}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user?.stats?.salesCount || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statBox}>
            <View style={{flexDirection:'row',alignItems:'center'}}>
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
              accessible={true}
              accessibilityLabel={`${tab.label} tab`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.id }}
            >
              <MaterialIcons
                name={tab.icon}
                size={24}
                color={activeTab === tab.id ? '#4CAF50' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    color: '#666', 
    fontSize: 16 
  },
  errorText: { 
    color: '#f44336', 
    fontSize: 16, 
    textAlign: 'center', 
    marginTop: 10 
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
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
    backgroundColor: '#e0e0e0',
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
  socialMediaSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  socialMediaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  socialMediaButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  socialMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  socialMediaText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginLeft: 6,
  },
  editProfileButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12,
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    borderColor: '#4CAF50', 
    borderWidth: 1,
  },
  editProfileText: { 
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
  plantGrid: { 
    paddingBottom: 80 
  },
  emptyStateContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 40,
    minHeight: 200,
  },
  emptyStateText: { 
    fontSize: 16, 
    color: '#888', 
    textAlign: 'center', 
    marginTop: 12 
  },
  actionButton: {
    marginTop: 16, 
    backgroundColor: '#4CAF50', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 6,
  },
  actionButtonText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
});

export default ProfileScreen;