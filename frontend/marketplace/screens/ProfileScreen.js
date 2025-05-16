// screens/ProfileScreen.js
// screens/ProfileScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList, 
  ActivityIndicator, SafeAreaView
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import { fetchUserProfile } from '../services/marketplaceApi';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants');
  const [ratingData, setRatingData] = useState({ average: 0, count: 0 });

  useFocusEffect(
    useCallback(() => {
      // Load user profile whenever the screen comes into focus
      loadUserProfile();
      
      // Also listen for events from other screens
      const unsubscribe = navigation.addListener('focus', () => {
        // This will trigger every time the profile screen receives focus
        loadUserProfile();
      });
      
      return unsubscribe;
    }, [])
  );

  useEffect(() => {
    if (route.params?.refresh) {
      loadUserProfile();
      navigation.setParams({ refresh: undefined });
    }
  }, [route.params?.refresh]);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const userEmail = await AsyncStorage.getItem('userEmail') || 'default@example.com';
      const data = await fetchUserProfile(userEmail);
      setUser(data.user);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  const handleReviewsLoaded = (data) => {
    if (data && typeof data === 'object') {
      setRatingData({
        average: data.averageRating || 0,
        count: data.count || 0
      });
    }
  };

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

  const renderPlantList = (plants) => (
    <FlatList
      data={plants}
      renderItem={({ item }) => <PlantCard plant={item} showActions={false} />}
      keyExtractor={item => item.id || `plant-${Math.random()}`}
      numColumns={2}
      contentContainerStyle={styles.plantGrid}
    />
  );

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

  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
      
      <View style={styles.profileCard}>
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <Text style={styles.joinDate}>Joined {user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}</Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        <TouchableOpacity style={styles.editProfileButton} onPress={() => navigation.navigate('EditProfile')}>
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

      <View style={styles.tabContent}>{renderTabContent()}</View>

      <TouchableOpacity style={styles.addPlantButton} onPress={() => navigation.navigate('AddPlant')}>
        <MaterialIcons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 16 },
  errorText: { color: '#f44336', fontSize: 16, textAlign: 'center', marginTop: 10 },
  profileCard: {
    backgroundColor: '#f0f9f3', // Light green background
    margin: 16, padding: 20, borderRadius: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 6, elevation: 4,
  },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 2 },
  joinDate: { fontSize: 12, color: '#999', marginTop: 2 },
  bio: { marginTop: 10, fontSize: 14, color: '#555', textAlign: 'center' },
  editProfileButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, 
    borderColor: '#4CAF50', borderWidth: 1,
  },
  editProfileText: { color: '#4CAF50', marginLeft: 6, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, 
    marginTop: 8, marginBottom: 12, backgroundColor: '#fff', paddingVertical: 12, 
    borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  tabsContainer: {
    flexDirection: 'row', backgroundColor: '#fff', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, shadowRadius: 2,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#4CAF50' },
  tabText: { fontSize: 14, color: '#666', marginTop: 4 },
  activeTabText: { color: '#4CAF50', fontWeight: 'bold' },
  tabContent: { flex: 1, padding: 8 },
  plantGrid: { paddingBottom: 80 },
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  emptyStateText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 12 },
  actionButton: {
    marginTop: 16, backgroundColor: '#4CAF50', paddingHorizontal: 16, 
    paddingVertical: 10, borderRadius: 6,
  },
  actionButtonText: { color: '#fff', fontWeight: '600' },
  addPlantButton: {
    position: 'absolute', bottom: 16, right: 16, backgroundColor: '#4CAF50',
    borderRadius: 30, padding: 16, elevation: 4, shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
});

export default ProfileScreen;