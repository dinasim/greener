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
  
  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For real app, use API:
      const data = await fetchUserProfile();
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
  
  if (error) {
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
          <Text style={styles.errorText}>User not found</Text>
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
      
      {/* Settings Button */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <MaterialIcons name="settings" size={24} color="#333" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
  },
  avatarContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: -30,
    borderWidth: 3,
    borderColor: '#fff',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  joinDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#eee',
    height: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  plantGrid: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  browseButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  addPlantButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  settingsButton: {
    position: 'absolute',
    right: 16,
    top: 96, // Positioned below the header
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 10,
  },
});

export default ProfileScreen;