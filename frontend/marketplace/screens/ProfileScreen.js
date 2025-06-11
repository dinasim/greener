// screens/ProfileScreen.js - Complete fixed version

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList, 
  ActivityIndicator, SafeAreaView, Alert, ScrollView
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
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

  // Set up update listener
  useEffect(() => {
    const listenerId = 'profile-screen';
    const handleUpdate = (updateType, data) => {
      console.log(`[ProfileScreen] Received update: ${updateType}`, data);
      if ([UPDATE_TYPES.PROFILE, UPDATE_TYPES.WISHLIST, UPDATE_TYPES.PRODUCT, UPDATE_TYPES.REVIEW].includes(updateType)) {
        loadUserProfile();
      }
    };
    addUpdateListener(listenerId, handleUpdate);
    return () => {
      removeUpdateListener(listenerId);
    };
  }, []);

  // Enhanced focus effect to check for updates and refresh
  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
      console.log("[ProfileScreen] Screen focused, checking for updates");
      
      const checkUpdates = async () => {
        try {
          // Check various update flags directly
          const wishlistUpdated = await AsyncStorage.getItem('WISHLIST_UPDATED');
          const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED');
          const profileUpdated = await AsyncStorage.getItem('PROFILE_UPDATED');
          const reviewUpdated = await AsyncStorage.getItem('REVIEW_UPDATED');
          const productUpdated = await AsyncStorage.getItem('PRODUCT_UPDATED');
          
          const needsRefresh = wishlistUpdated || favoritesUpdated || 
                              profileUpdated || reviewUpdated || 
                              productUpdated || route.params?.refresh;
          
          if (needsRefresh) {
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
      
      // Return cleanup function
      return () => {
        // Any cleanup needed
      };
    }, [navigation, route.params?.refresh])
  );

  // Handle refresh param directly
  useEffect(() => {
    if (route.params?.refresh) {
      console.log("[ProfileScreen] Refresh param detected");
      loadUserProfile();
      navigation.setParams({ refresh: undefined });
    }
  }, [route.params?.refresh]);

  // Load user profile data
  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      console.log("[ProfileScreen] Loading user profile");
      
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        throw new Error('User email not found in storage');
      }
      
      const data = await fetchUserProfile(userEmail);
      
      if (data && data.user) {
        console.log("[ProfileScreen] User profile loaded successfully");
        setUser(data.user);
        
        // Normalize listings data to ensure consistent structure
        if (data.user.listings) {
          data.user.listings.forEach(listing => {
            if (!listing.seller) {
              listing.seller = {
                name: data.user.name,
                _id: data.user.id || data.user.email,
                email: data.user.email,
                avatar: data.user.avatar
              };
            }
          });
        }
      } else {
        throw new Error('User data not found in API response');
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('[ProfileScreen] Error loading profile:', err);
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  // Handle review data updates
  const handleReviewsLoaded = (data) => {
    if (data && typeof data === 'object') {
      setRatingData({
        average: data.averageRating || 0,
        count: data.count || 0
      });
    }
  };

  // Render empty state with action button
  const renderEmptyState = (icon, message, buttonText, onPress) => (
    <View style={styles.emptyStateContainer}>
      <MaterialIcons name={icon} size={48} color="#ccc" />
      <Text style={styles.emptyStateText}>{message}</Text>
      {buttonText && (
        <TouchableOpacity style={styles.actionButton} onPress={onPress}>
          <Text style={styles.actionButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render plant list
  const renderPlantList = (plants) => (
    <FlatList
      data={plants}
      renderItem={({ item }) => <PlantCard plant={item} showActions={false} />}
      keyExtractor={item => item.id || item._id || `plant-${Math.random()}`}
      numColumns={2}
      contentContainerStyle={styles.plantGrid}
    />
  );

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'myPlants': {
        const activePlants = user.listings?.filter(plant => plant.status === 'active') || [];
        return activePlants.length ? renderPlantList(activePlants) : 
          renderEmptyState('eco', 'You don\'t have any active listings', 'Add a Plant', () => navigation.navigate('AddPlant'));
      }
      case 'favorites': {
        return user.favorites?.length ? renderPlantList(user.favorites) :
          renderEmptyState('favorite-border', 'You don\'t have any saved plants', 'Browse Plants', () => navigation.navigate('MarketplaceHome'));
      }
      case 'sold': {
        const soldPlants = user.listings?.filter(plant => plant.status === 'sold') || [];
        return soldPlants.length ? renderPlantList(soldPlants) :
          renderEmptyState('local-offer', 'You haven\'t sold any plants yet');
      }
      case 'reviews': {
        return (
          <ReviewsList
            targetType="seller"
            targetId={user.email || user.id}
            onReviewsLoaded={handleReviewsLoaded}
            autoLoad={true}
          />
        );
      }
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Ensure we have a valid avatar URL
  const getAvatarUrl = () => {
    if (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http')) {
      return user.avatar;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name?.charAt(0) || 'U')}&background=4CAF50&color=fff&size=200`;
  };

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader 
        title="My Profile" 
        showBackButton 
        onBackPress={() => navigation.goBack()} 
        onNotificationsPress={() => navigation.navigate('Messages')} 
      />
      <ScrollView>
        <View style={styles.profileCard}>
          <Image source={{ uri: getAvatarUrl() }} style={styles.avatar} />
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <Text style={styles.joinDate}>
            Joined {user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
          </Text>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          <TouchableOpacity 
            style={styles.editProfileButton} 
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Feather name="edit" size={16} color="#4CAF50" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
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
            <Text style={styles.statValue}>
              {ratingData.average.toFixed(1) || user.stats?.rating?.toFixed?.(1) || '0.0'}
            </Text>
            <Text style={styles.statLabel}>Rating ({ratingData.count || 0})</Text>
          </View>
        </View>
        
        <View style={styles.tabsContainer}>
          {['myPlants', 'favorites', 'sold', 'reviews'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
              onPress={() => setActiveTab(tab)}
            >
              <MaterialIcons
                name={tab === 'myPlants' ? 'eco' : tab === 'favorites' ? 'favorite' : tab === 'sold' ? 'local-offer' : 'star'}
                size={24}
                color={activeTab === tab ? '#4CAF50' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'myPlants' ? 'My Plants' : tab === 'reviews' ? 'Reviews' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.addPlantButton} 
        onPress={() => navigation.navigate('AddPlant')}
        accessible={true}
        accessibilityLabel="Add a new plant"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>
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
  addPlantButton: {
    position: 'absolute', 
    bottom: 16, 
    right: 16, 
    backgroundColor: '#4CAF50',
    borderRadius: 30, 
    padding: 16, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 4,
  },
});

export default ProfileScreen;