import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

// Import components
import PlantCard from '../components/PlantCard';

// Import API service
import { fetchUserProfile } from '../services/marketplaceApi';

// Sample user data for development (same as ProfileScreen)
const SAMPLE_SELLER = {
  id: 'user123',
  name: 'Plant Enthusiast',
  email: 'plant.lover@example.com',
  phoneNumber: '+1 (555) 123-4567',
  avatar: 'https://via.placeholder.com/150?text=Seller',
  bio: 'Passionate plant enthusiast with a love for tropical houseplants. I enjoy propagating plants and helping others grow their own indoor jungles.',
  location: 'Seattle, WA',
  stats: {
    plantsCount: 8,
    salesCount: 5,
    rating: 4.9,
  },
  listings: [
    {
      id: '1',
      name: 'Monstera Deliciosa',
      description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves',
      price: 29.99,
      imageUrl: 'https://via.placeholder.com/150?text=Monstera',
      category: 'Indoor Plants',
      listedDate: new Date().toISOString(),
      status: 'active',
    },
    {
      id: '2',
      name: 'Snake Plant',
      description: 'Low maintenance indoor plant, perfect for beginners',
      price: 19.99,
      imageUrl: 'https://via.placeholder.com/150?text=Snake+Plant',
      category: 'Indoor Plants',
      listedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      status: 'active',
    },
    {
      id: '3',
      name: 'Fiddle Leaf Fig',
      description: 'Trendy houseplant with violin-shaped leaves',
      price: 34.99,
      imageUrl: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
      category: 'Indoor Plants',
      listedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      status: 'sold',
    },
  ],
};

const SellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const sellerId = route.params?.sellerId || SAMPLE_SELLER.id; // Get seller ID from params or use sample data for testing
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants'); // 'myPlants', 'favorites', 'sold'
  
  useEffect(() => {
    loadSellerProfile();
  }, [sellerId]);
  
  const loadSellerProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For real app, use API:
      // const data = await fetchUserProfile(sellerId);

      // For development, use sample data with a delay to simulate API call:
      await new Promise(resolve => setTimeout(resolve, 500));
      const data = SAMPLE_SELLER;

      setUser(data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
      console.error('Error loading profile:', err);
    }
  };
  
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: () => {
            // In a real app, this would call an API to sign out
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }], // Replace with your auth screen name
            });
          },
          style: 'destructive',
        },
      ]
    );
  };
  
  if (isLoading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadSellerProfile}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="person-off" size={48} color="#f44336" />
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'myPlants':
        const activePlants = user.listings.filter(plant => plant.status === 'active');
        
        if (activePlants.length === 0) {
          return (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="eco" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>This seller has no active listings</Text>
            </View>
          );
        }
        
        return (
          <FlatList
            data={activePlants}
            renderItem={({ item }) => (
              <PlantCard plant={item} showActions={false} />
            )}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.plantGrid}
          />
        );
        
      case 'sold':
        const soldPlants = user.listings.filter(plant => plant.status === 'sold');
        
        if (soldPlants.length === 0) {
          return (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="local-offer" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>This seller has not sold any plants</Text>
            </View>
          );
        }
        
        return (
          <FlatList
            data={soldPlants}
            renderItem={({ item }) => (
              <PlantCard plant={item} showActions={false} />
            )}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.plantGrid}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.coverContainer}>
          <Image
            source={require('../../assets/images/plant-banner.jpg')}
            style={styles.coverImage}
          />
        </View>

        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: user.avatar }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.joinDate}>
              Joined {new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {user.bio && (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.plantsCount}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.salesCount}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'myPlants' && styles.activeTabButton]}
          onPress={() => setActiveTab('myPlants')}
        >
          <MaterialIcons
            name="eco"
            size={24}
            color={activeTab === 'myPlants' ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'myPlants' && styles.activeTabText]}>My Plants</Text>
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
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Styles here (same as ProfileScreen)
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // Additional styles for seller profile
  // ...
});

export default SellerProfileScreen;
