// screens/ProfileScreen.js
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
  SafeAreaView,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';


// Import consistent header
import MarketplaceHeader from '../components/MarketplaceHeader';

// Import components
import PlantCard from '../components/PlantCard';

// Import API service
import { fetchUserProfile } from '../services/marketplaceApi';

const ProfileScreen = () => {
  const navigation = useNavigation();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants'); // 'myPlants', 'favorites', 'sold'
  
  useEffect(() => {
    loadUserProfile();
  }, []);
  
  // SEARCH_KEY: LOAD_USER_PROFILE_API
const loadUserProfile = async () => {
  try {
    setIsLoading(true);
    setError(null);
    
    // Get the current user's email
    const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
    
    // For real app, use API
    const data = await fetchUserProfile(userEmail);
    
    setUser(data.user);
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
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="My Profile"
          showBackButton={true}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Stop loading state from continuing if another error happened
  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="My Profile"
          showBackButton={true}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadUserProfile}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // If no user, and not loading/error, show not found
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="My Profile"
          showBackButton={true}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="person-off" size={48} color="#f44336" />
          <Text style={styles.errorText}>User profile not found</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.retryText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'myPlants':
        const activePlants = user.listings ? user.listings.filter(plant => plant.status === 'active') : [];
        
        if (activePlants.length === 0) {
          return (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="eco" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>You don't have any active listings</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => navigation.navigate('AddPlant')}
              >
                <Text style={styles.addButtonText}>Add a Plant</Text>
              </TouchableOpacity>
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
        
      case 'favorites':
        if (!user.favorites || user.favorites.length === 0) {
          return (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="favorite-border" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>You don't have any saved plants</Text>
              <TouchableOpacity 
                style={styles.browseButton}
                onPress={() => navigation.navigate('Marketplace')}
              >
                <Text style={styles.browseButtonText}>Browse Plants</Text>
              </TouchableOpacity>
            </View>
          );
        }
        
        return (
          <FlatList
            data={user.favorites}
            renderItem={({ item }) => (
              <PlantCard plant={item} showActions={false} />
            )}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.plantGrid}
          />
        );
        
      case 'sold':
        const soldPlants = user.listings ? user.listings.filter(plant => plant.status === 'sold') : [];
        
        if (soldPlants.length === 0) {
          return (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="local-offer" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>You haven't sold any plants yet</Text>
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
    <SafeAreaView style={styles.container}>
      {/* Consistent header */}
      <MarketplaceHeader
        title="My Profile"
        showBackButton={true}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.coverContainer}>
          <Image
            source={require('../../assets/images/plant-banner.jpg')}
            style={styles.coverImage}
          />
          
<TouchableOpacity 
  style={styles.editButton}
  onPress={() => navigation.navigate('EditProfile')}
>
  <Feather name="edit-2" size={16} color="#fff" />
  <Text style={styles.editButtonText}>Edit Profile</Text>
</TouchableOpacity>
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
            <Text style={styles.statValue}>{user.stats?.plantsCount || 0}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats?.salesCount || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.stats?.rating || '0.0'}</Text>
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
          <Text
            style={[styles.tabText, activeTab === 'myPlants' && styles.activeTabText]}
          >
            My Plants
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'favorites' && styles.activeTabButton]}
          onPress={() => setActiveTab('favorites')}
        >
          <MaterialIcons
            name="favorite"
            size={24}
            color={activeTab === 'favorites' ? '#4CAF50' : '#666'}
          />
          <Text
            style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}
          >
            Favorites
          </Text>
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
          <Text
            style={[styles.tabText, activeTab === 'sold' && styles.activeTabText]}
          >
            Sold
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
      
      {/* Add Plant FAB */}
      <TouchableOpacity
        style={styles.addPlantButton}
        onPress={() => navigation.navigate('AddPlant')}
      >
        <MaterialIcons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  profileHeader: {
    backgroundColor: '#fff',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  coverContainer: {
    height: 150,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  joinDate: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: '#555',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ddd',
    height: '100%',
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
    paddingVertical: 12,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    padding: 8,
  },
  plantGrid: {
    paddingBottom: 80,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
  },
  addButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  browseButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
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