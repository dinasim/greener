// screens/ProfileScreen.js - FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [userPlants, setUserPlants] = useState([]);
  const [wishlistPlants, setWishlistPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('plants');
  const [currentUserId, setCurrentUserId] = useState(null);

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  // Get current user ID from storage - IMPROVED
  const getCurrentUserId = async () => {
    try {
      console.log('🔍 Getting current user ID from storage...');
      
      // Try multiple storage keys
      const keys = ['userData', 'userEmail', 'currentUser'];
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          console.log(`✅ Found user data in ${key}:`, value);
          
          try {
            const parsed = JSON.parse(value);
            const userId = parsed.email || parsed.id || parsed.userEmail;
            if (userId) {
              console.log('✅ Extracted user ID:', userId);
              return userId;
            }
          } catch (e) {
            // If it's not JSON, try using the value directly
            if (value.includes('@')) {
              console.log('✅ Using direct email value:', value);
              return value;
            }
          }
        }
      }
      
      // Check if we can get from navigation params or context
      console.log('❌ No user ID found in storage');
      return null;
    } catch (error) {
      console.error('❌ Error getting current user ID:', error);
      return null;
    }
  };

  // Load user profile - FIXED
  const loadUserProfile = async (userId) => {
    try {
      console.log('👤 Loading user profile for:', userId);
      
      const response = await fetch(`${BASE_URL}/marketplace/users/${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userId,
        },
      });

      console.log('👤 Profile response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ User profile loaded:', data);
        
        if (data.user) {
          setUser(data.user);
          
          // Extract listings and wishlist from user data
          const listings = data.user.listings || [];
          const favorites = data.user.favorites || [];
          
          setUserPlants(listings);
          setWishlistPlants(favorites);
          
          return data.user;
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Profile error response:', errorText);
        
        // If user not found, create a basic profile
        if (response.status === 404) {
          console.log('🔄 User not found, creating basic profile...');
          await createBasicProfile(userId);
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      return null;
    }
  };

  // Create basic profile if user doesn't exist - NEW
  const createBasicProfile = async (userId) => {
    try {
      console.log('🆕 Creating basic profile for:', userId);
      
      const response = await fetch(`${BASE_URL}/marketplace/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userId,
        },
        body: JSON.stringify({
          name: userId.split('@')[0] || 'Plant Lover',
          email: userId,
          bio: 'New plant enthusiast',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Basic profile created:', data);
        
        if (data.user) {
          setUser(data.user);
          setUserPlants([]);
          setWishlistPlants([]);
          return data.user;
        }
      } else {
        console.log('❌ Failed to create basic profile');
      }
    } catch (error) {
      console.error('❌ Error creating basic profile:', error);
    }
    
    return null;
  };

  // Load user's listings separately
  const loadUserListings = async (userId) => {
    try {
      console.log('🌱 Loading user listings for:', userId);
      
      const response = await fetch(`${BASE_URL}/marketplace/users/${encodeURIComponent(userId)}/listings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded', data.active?.length || 0, 'user listings');
        
        const allListings = [...(data.active || []), ...(data.sold || [])];
        setUserPlants(allListings);
        return allListings;
      }
    } catch (error) {
      console.error('❌ Error loading user listings:', error);
    }
    
    setUserPlants([]);
    return [];
  };

  // Load user's wishlist separately
  const loadUserWishlist = async (userId) => {
    try {
      console.log('💚 Loading user wishlist for:', userId);
      
      const response = await fetch(`${BASE_URL}/marketplace/users/${encodeURIComponent(userId)}/wishlist`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded', data.wishlist?.length || 0, 'wishlist items');
        
        setWishlistPlants(data.wishlist || []);
        return data.wishlist || [];
      }
    } catch (error) {
      console.error('❌ Error loading user wishlist:', error);
    }
    
    setWishlistPlants([]);
    return [];
  };

  // Delete plant
  const handleDeletePlant = (plantId) => {
    Alert.alert(
      'Delete Plant',
      'Are you sure you want to delete this plant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/marketplace/products/${plantId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Email': currentUserId,
                },
              });

              if (response.ok) {
                setUserPlants(prev => prev.filter(plant => 
                  plant.id !== plantId && plant._id !== plantId
                ));
                showToast('Plant deleted successfully');
                
                // Refresh data
                if (currentUserId) {
                  await loadUserProfile(currentUserId);
                }
              } else {
                throw new Error('Failed to delete plant');
              }
            } catch (error) {
              console.error('❌ Error deleting plant:', error);
              showToast('Failed to delete plant');
            }
          },
        },
      ]
    );
  };

  // Remove from wishlist
  const handleRemoveFromWishlist = async (plantId) => {
    try {
      const response = await fetch(`${BASE_URL}/marketplace/products/wish/${plantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUserId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.isWished) {
          setWishlistPlants(prev => prev.filter(plant => 
            plant.id !== plantId && plant._id !== plantId
          ));
          showToast('Removed from wishlist');
        }
      }
    } catch (error) {
      console.error('❌ Error removing from wishlist:', error);
      showToast('Failed to remove from wishlist');
    }
  };

  // Navigation helpers
  const handleEditPlant = (plant) => {
    navigation.navigate('AddPlant', {
      plant: plant,
      editMode: true,
      plantId: plant.id || plant._id
    });
  };

  const handleViewPlant = (plant) => {
    try {
      navigation.navigate('PlantDetails', {
        plant: plant,
        plantId: plant.id || plant._id
      });
    } catch (error) {
      try {
        navigation.navigate('PlantDetail', {
          plant: plant,
          plantId: plant.id || plant._id
        });
      } catch (error2) {
        showToast('Could not open plant details');
      }
    }
  };

  // Load all data - IMPROVED
  const loadAllData = async () => {
    console.log('🔄 Loading all profile data...');
    setLoading(true);
    
    try {
      const userId = await getCurrentUserId();
      console.log('🆔 Current user ID:', userId);
      
      if (userId) {
        setCurrentUserId(userId);
        
        // Try to load profile first
        const profile = await loadUserProfile(userId);
        
        if (!profile) {
          // If profile loading failed, try loading listings and wishlist separately
          console.log('🔄 Profile failed, loading data separately...');
          await Promise.all([
            loadUserListings(userId),
            loadUserWishlist(userId)
          ]);
        }
      } else {
        console.log('❌ No user ID found');
        showToast('Please log in to view your profile');
      }
    } catch (error) {
      console.error('❌ Error loading profile data:', error);
      showToast('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  // Render plant item
  const renderPlantItem = (plant, index) => {
    const getPlantImage = () => {
      const imageUrl = plant.image || plant.mainImage || 
                       (plant.images && plant.images[0]) || plant.imageUrl;
      
      if (imageUrl && imageUrl.startsWith('http')) {
        return { uri: imageUrl };
      }
      
      return { 
        uri: `https://picsum.photos/80/80?random=${plant.id || index}` 
      };
    };

    return (
      <TouchableOpacity 
        key={plant.id || plant._id || index}
        style={styles.plantItem} 
        onPress={() => handleViewPlant(plant)}
      >
        <Image source={getPlantImage()} style={styles.plantImage} />
        
        <View style={styles.plantInfo}>
          <Text style={styles.plantName} numberOfLines={1}>
            {plant.title || plant.name || plant.common_name || 'Unnamed Plant'}
          </Text>
          <Text style={styles.plantDescription} numberOfLines={2}>
            {plant.description || 'No description available'}
          </Text>
          <View style={styles.plantMeta}>
            <Text style={styles.plantPrice}>
              ${parseFloat(plant.price || 0).toFixed(0)}
            </Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: plant.status === 'sold' ? '#9E9E9E' : '#4CAF50' 
            }]}>
              <Text style={styles.statusText}>
                {(plant.status || 'active').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.plantActions}>
          {activeTab === 'plants' ? (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEditPlant(plant)}
              >
                <MaterialIcons name="edit" size={20} color="#2196F3" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeletePlant(plant.id || plant._id)}
              >
                <MaterialIcons name="delete" size={20} color="#f44336" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.wishlistRemoveButton]}
              onPress={() => handleRemoveFromWishlist(plant.id || plant._id)}
            >
              <MaterialIcons name="favorite" size={20} color="#f44336" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: user?.avatar || user?.logo || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=4CAF50&color=fff&size=80`
              }}
              style={styles.profileAvatar}
            />
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.name || currentUserId?.split('@')[0] || 'Plant Lover'}
            </Text>
            <Text style={styles.profileEmail}>
              {user?.email || currentUserId || 'user@example.com'}
            </Text>
            <Text style={styles.profileLocation}>
              📍 {user?.location?.city || user?.location || 'Location not set'}
            </Text>
          </View>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userPlants.length}</Text>
            <Text style={styles.statLabel}>Plants</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user?.stats?.salesCount || 0}</Text>
            <Text style={styles.statLabel}>Sales</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{wishlistPlants.length}</Text>
            <Text style={styles.statLabel}>Wishlist</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {user?.stats?.rating ? user.stats.rating.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButtonLarge}
            onPress={() => navigation.navigate('AddPlant')}
          >
            <MaterialIcons name="add" size={20} color="#4CAF50" />
            <Text style={styles.actionButtonText}>Add Plant</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButtonLarge}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <MaterialIcons name="edit" size={20} color="#2196F3" />
            <Text style={styles.actionButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'plants' && styles.activeTab]}
            onPress={() => setActiveTab('plants')}
          >
            <MaterialIcons name="local-florist" size={20} color={activeTab === 'plants' ? '#4CAF50' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'plants' && styles.activeTabText]}>
              My Plants ({userPlants.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'wishlist' && styles.activeTab]}
            onPress={() => setActiveTab('wishlist')}
          >
            <MaterialIcons name="favorite" size={20} color={activeTab === 'wishlist' ? '#4CAF50' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'wishlist' && styles.activeTabText]}>
              Wishlist ({wishlistPlants.length})
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Content */}
        <View style={styles.contentContainer}>
          {(activeTab === 'plants' ? userPlants : wishlistPlants).length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons 
                name={activeTab === 'plants' ? 'local-florist' : 'favorite-border'} 
                size={64} 
                color="#ccc" 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'plants' ? 'No plants yet' : 'No wishlist items'}
              </Text>
              <Text style={styles.emptyMessage}>
                {activeTab === 'plants' 
                  ? 'Add your first plant to start selling!' 
                  : 'Heart some plants to see them here!'
                }
              </Text>
              {activeTab === 'plants' && (
                <TouchableOpacity 
                  style={styles.addPlantButton}
                  onPress={() => navigation.navigate('AddPlant')}
                >
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={styles.addPlantButtonText}>Add Plant</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.plantsList}>
              {(activeTab === 'plants' ? userPlants : wishlistPlants).map((plant, index) => 
                renderPlantItem(plant, index)
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  profileHeader: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
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
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 16,
    marginBottom: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 16,
    marginBottom: 2,
    gap: 12,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  tabSelector: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  contentContainer: {
    backgroundColor: '#fff',
    flex: 1,
  },
  plantsList: {
    padding: 16,
  },
  plantItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  plantImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  plantInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  plantDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  plantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plantPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  plantActions: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  wishlistRemoveButton: {
    backgroundColor: '#ffebee',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addPlantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addPlantButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ProfileScreen;