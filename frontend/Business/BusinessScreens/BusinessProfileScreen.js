// screens/Business/BusinessProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  MaterialIcons, 
  FontAwesome5, 
  Ionicons, 
  MaterialCommunityIcons 
} from '@expo/vector-icons';

// Import common components
import LoadingError from '../../marketplace/screens/ProfileScreen-parts/LoadingError';
import EmptyState from '../../marketplace/screens/ProfileScreen-parts/EmptyState';

const BusinessProfileScreen = ({ navigation }) => {
  // State variables
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  
  // Sample data - In a real app, this would come from the API
  const sampleBusinessData = {
    id: 'business_1',
    email: 'green_haven@example.com',
    businessName: 'Green Haven Nursery',
    name: 'Sarah Johnson',
    description: 'Specializing in rare indoor plants and premium gardening supplies since 2018. Our mission is to bring nature into your home with carefully curated plants and eco-friendly tools.',
    logo: null, // Will use placeholder
    joinDate: '2022-03-15T00:00:00Z',
    location: {
      address: '123 Green Street',
      city: 'Hadera',
      country: 'Israel',
      latitude: 32.4391,
      longitude: 34.9197
    },
    businessType: 'Nursery',
    contactPhone: '+972 54 123 4567',
    stats: {
      inventory: 45,
      sold: 128,
      revenue: 7590,
      rating: 4.8,
      reviewCount: 37
    },
    inventory: [
      { 
        id: 'p1', 
        title: 'Monstera Deliciosa', 
        price: 49.99, 
        image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?ixlib=rb-4.0.3',
        category: 'indoor',
        quantity: 8,
        status: 'active'
      },
      { 
        id: 'p2', 
        title: 'Fiddle Leaf Fig', 
        price: 79.99, 
        image: 'https://images.unsplash.com/photo-1613737693060-1ae28acc547f?ixlib=rb-4.0.3',
        category: 'indoor',
        quantity: 5,
        status: 'active'
      },
      { 
        id: 'p3', 
        title: 'Snake Plant', 
        price: 34.99, 
        image: 'https://images.unsplash.com/photo-1593482892290-f54c7f9b7947?ixlib=rb-4.0.3',
        category: 'indoor',
        quantity: 12,
        status: 'active'
      },
    ],
    soldItems: [
      { 
        id: 's1', 
        title: 'Boston Fern', 
        price: 29.99, 
        image: 'https://images.unsplash.com/photo-1614594576072-11654a4b9cf6?ixlib=rb-4.0.3',
        soldAt: '2023-05-10T14:22:00Z',
        buyer: 'Michael K.'
      },
      { 
        id: 's2', 
        title: 'Potting Soil Premium Mix', 
        price: 19.99, 
        image: 'https://images.unsplash.com/photo-1562688900-a67885d7c3b7?ixlib=rb-4.0.3',
        soldAt: '2023-05-08T09:45:00Z',
        buyer: 'Sarah L.'
      },
    ],
    reviews: [
      {
        id: 'r1',
        userName: 'David K.',
        rating: 5,
        text: 'Amazing plants, arrived in perfect condition. Will definitely buy again!',
        createdAt: '2023-05-01T10:30:00Z'
      },
      {
        id: 'r2',
        userName: 'Rachel M.',
        rating: 4,
        text: 'Great selection and quality. Delivery was a bit delayed but the plants were worth the wait.',
        createdAt: '2023-04-22T15:45:00Z'
      }
    ],
    lowStock: [
      { 
        id: 'p2', 
        title: 'Fiddle Leaf Fig', 
        quantity: 2,
        minThreshold: 3
      },
      { 
        id: 'p4', 
        title: 'Ceramic Planter - Large', 
        quantity: 1,
        minThreshold: 5
      }
    ]
  };

  // Load profile data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  // Function to load profile data
  const loadProfileData = async () => {
    if (refreshing) {
      // If already refreshing, don't start another load
      return;
    }
    
    setIsLoading(!profile); // Only show loading indicator on first load
    setError(null);
    setRefreshing(true);
    
    try {
      // In a real app, this would be an API call to fetch business profile
      // For demonstration, we'll use a timeout to simulate API request
      const email = await AsyncStorage.getItem('userEmail');
      
      // Simulate API request
      setTimeout(() => {
        // Add email to the sample data
        const profileData = {
          ...sampleBusinessData,
          email: email || sampleBusinessData.email
        };
        
        setProfile(profileData);
        setIsLoading(false);
        setRefreshing(false);
      }, 1000);
      
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Could not load business profile. Please try again.');
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refreshing the profile
  const onRefresh = () => {
    loadProfileData();
  };

  // Handle edit profile button press
  const handleEditProfile = () => {
    navigation.navigate('EditBusinessProfile');
  };

  // Handle adding a new product
  const handleAddProduct = () => {
    navigation.navigate('AddInventoryScreen');
  };

  // Handle viewing all inventory
  const handleViewInventory = () => {
    navigation.navigate('InventoryScreen');
  };

  // Handle viewing an individual product
  const handleProductPress = (productId) => {
    navigation.navigate('EditProductScreen', { productId });
  };

  // Handle viewing all orders
  const handleViewOrders = () => {
    navigation.navigate('OrdersScreen');
  };

  // Handle signing out
  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Sign Out", 
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userEmail');
              await AsyncStorage.removeItem('userType');
              await AsyncStorage.removeItem('businessId');
              
              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'PersonaSelection' }]
              });
            } catch (e) {
              console.error('Error signing out:', e);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  // Render loading and error states
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LoadingError isLoading={true} loadingText="Loading business profile..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LoadingError error={error} onRetry={loadProfileData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header with business name and settings button */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{profile?.businessName || 'Business Profile'}</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('BusinessSettings')}
          >
            <MaterialIcons name="settings" size={24} color="#216a94" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Business Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {/* Business Logo */}
            <Image 
              source={profile?.logo ? { uri: profile.logo } : require('../../assets/business-placeholder.png')}
              style={styles.businessLogo}
            />
            
            {/* Business Info */}
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{profile?.businessName}</Text>
              <Text style={styles.businessType}>{profile?.businessType}</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialIcons 
                    key={star}
                    name={star <= Math.round(profile?.stats?.rating || 0) ? "star" : "star-border"}
                    size={16}
                    color="#FFC107"
                  />
                ))}
                <Text style={styles.ratingText}>
                  {profile?.stats?.rating?.toFixed(1)} ({profile?.stats?.reviewCount})
                </Text>
              </View>
            </View>
            
            {/* Edit Profile Button */}
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEditProfile}
            >
              <MaterialIcons name="edit" size={18} color="#216a94" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          {/* Business Description */}
          {profile?.description && (
            <Text style={styles.description}>
              {profile.description}
            </Text>
          )}
          
          {/* Business Contact & Location */}
          <View style={styles.contactSection}>
            {profile?.contactPhone && (
              <View style={styles.contactItem}>
                <MaterialIcons name="phone" size={16} color="#555" />
                <Text style={styles.contactText}>{profile.contactPhone}</Text>
              </View>
            )}
            {profile?.email && (
              <View style={styles.contactItem}>
                <MaterialIcons name="email" size={16} color="#555" />
                <Text style={styles.contactText}>{profile.email}</Text>
              </View>
            )}
            {profile?.location?.city && (
              <View style={styles.contactItem}>
                <MaterialIcons name="location-on" size={16} color="#555" />
                <Text style={styles.contactText}>
                  {profile.location.city}{profile.location.country ? `, ${profile.location.country}` : ''}
                </Text>
              </View>
            )}
          </View>
          
          {/* Join Date */}
          <Text style={styles.joinedText}>
            Business since {new Date(profile?.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </Text>
        </View>
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' }]}>
              <MaterialIcons name="inventory" size={20} color="#fff" />
            </View>
            <Text style={styles.statValue}>{profile?.stats?.inventory || 0}</Text>
            <Text style={styles.statLabel}>Inventory</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#2196F3' }]}>
              <FontAwesome5 name="shopping-bag" size={18} color="#fff" />
            </View>
            <Text style={styles.statValue}>{profile?.stats?.sold || 0}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' }]}>
              <FontAwesome5 name="dollar-sign" size={18} color="#fff" />
            </View>
            <Text style={styles.statValue}>${profile?.stats?.revenue || 0}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>
        
        {/* Low Stock Alert */}
        {profile?.lowStock && profile.lowStock.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <MaterialIcons name="warning" size={20} color="#ff9800" />
              <Text style={styles.alertTitle}>Low Stock Alert</Text>
            </View>
            {profile.lowStock.map(item => (
              <View key={item.id} style={styles.alertItem}>
                <Text style={styles.alertItemText}>{item.title}</Text>
                <Text style={styles.alertItemCount}>
                  {item.quantity} left of {item.minThreshold} minimum
                </Text>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.alertButton}
              onPress={handleViewInventory}
            >
              <Text style={styles.alertButtonText}>Manage Inventory</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'inventory' && styles.activeTab]} 
            onPress={() => setActiveTab('inventory')}
          >
            <MaterialIcons 
              name="inventory" 
              size={22} 
              color={activeTab === 'inventory' ? '#216a94' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>
              Inventory
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'sold' && styles.activeTab]} 
            onPress={() => setActiveTab('sold')}
          >
            <MaterialIcons 
              name="local-offer" 
              size={22} 
              color={activeTab === 'sold' ? '#216a94' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'sold' && styles.activeTabText]}>
              Sold
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'reviews' && styles.activeTab]} 
            onPress={() => setActiveTab('reviews')}
          >
            <MaterialIcons 
              name="star" 
              size={22} 
              color={activeTab === 'reviews' ? '#216a94' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
              Reviews
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Current Inventory</Text>
                <TouchableOpacity onPress={handleViewInventory}>
                  <Text style={styles.sectionAction}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {profile?.inventory && profile.inventory.length > 0 ? (
                <>
                  {profile.inventory.slice(0, 3).map(item => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={styles.productCard}
                      onPress={() => handleProductPress(item.id)}
                    >
                      <Image 
                        source={{ uri: item.image }} 
                        style={styles.productImage} 
                      />
                      <View style={styles.productInfo}>
                        <Text style={styles.productTitle}>{item.title}</Text>
                        <Text style={styles.productCategory}>{item.category}</Text>
                        <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                      </View>
                      <View style={styles.productQuantity}>
                        <Text style={styles.quantityLabel}>Qty</Text>
                        <Text style={styles.quantityValue}>{item.quantity}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={handleAddProduct}
                  >
                    <MaterialIcons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add New Product</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <EmptyState 
                  icon="inventory" 
                  message="You don't have any products in your inventory yet." 
                  buttonText="Add Product" 
                  onButtonPress={handleAddProduct} 
                />
              )}
            </>
          )}
          
          {/* Sold Tab */}
          {activeTab === 'sold' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recently Sold</Text>
                <TouchableOpacity onPress={handleViewOrders}>
                  <Text style={styles.sectionAction}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {profile?.soldItems && profile.soldItems.length > 0 ? (
                <>
                  {profile.soldItems.map(item => (
                    <View key={item.id} style={styles.soldItemCard}>
                      <Image 
                        source={{ uri: item.image }} 
                        style={styles.productImage} 
                      />
                      <View style={styles.productInfo}>
                        <Text style={styles.productTitle}>{item.title}</Text>
                        <Text style={styles.soldDate}>
                          Sold {new Date(item.soldAt).toLocaleDateString()}
                        </Text>
                        <Text style={styles.soldBuyer}>To: {item.buyer}</Text>
                      </View>
                      <View style={styles.productPrice}>
                        <Text style={styles.soldPriceValue}>${item.price.toFixed(2)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <EmptyState 
                  icon="local-offer" 
                  message="You haven't sold any products yet." 
                  buttonText="View Marketplace" 
                  onButtonPress={() => navigation.navigate('MarketplaceHome')} 
                />
              )}
            </>
          )}
          
          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Customer Reviews</Text>
              </View>
              
              {profile?.reviews && profile.reviews.length > 0 ? (
                <>
                  {profile.reviews.map(review => (
                    <View key={review.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewUser}>
                          <MaterialIcons name="account-circle" size={24} color="#555" />
                          <Text style={styles.reviewUserName}>{review.userName}</Text>
                        </View>
                        <View style={styles.reviewRating}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <MaterialIcons 
                              key={star}
                              name={star <= review.rating ? "star" : "star-border"}
                              size={14}
                              color="#FFC107"
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.reviewText}>{review.text}</Text>
                      <Text style={styles.reviewDate}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <EmptyState 
                  icon="star" 
                  message="You don't have any reviews yet. Reviews will appear here when customers leave feedback." 
                />
              )}
            </>
          )}
        </View>
        
        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <MaterialIcons name="logout" size={18} color="#666" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('BusinessHomeScreen')}
        >
          <MaterialIcons name="dashboard" size={24} color="#757575" />
          <Text style={styles.navText}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('InventoryScreen')}
        >
          <MaterialIcons name="inventory" size={24} color="#757575" />
          <Text style={styles.navText}>Inventory</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('OrdersScreen')}
        >
          <MaterialIcons name="receipt" size={24} color="#757575" />
          <Text style={styles.navText}>Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <MaterialIcons name="person" size={24} color="#216a94" />
          <Text style={[styles.navText, styles.activeNavText]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#216a94',
  },
  settingsButton: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 70, // Space for bottom navigation
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessLogo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee',
  },
  businessInfo: {
    flex: 1,
    marginLeft: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  businessType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#216a94',
  },
  editButtonText: {
    fontSize: 12,
    color: '#216a94',
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactSection: {
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  joinedText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  alertCard: {
    backgroundColor: '#fff8e1',
    margin: 16,
    marginTop: 0,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f57c00',
    marginLeft: 8,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertItemText: {
    fontSize: 14,
    color: '#555',
  },
  alertItemCount: {
    fontSize: 14,
    color: '#f57c00',
    fontWeight: '500',
  },
  alertButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff9800',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  alertButtonText: {
    fontSize: 14,
    color: '#ff9800',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#216a94',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#216a94',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionAction: {
    fontSize: 14,
    color: '#216a94',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productCategory: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },
  productQuantity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#888',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#216a94',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  soldItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  soldDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  soldBuyer: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  soldPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  signOutText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  activeNavItem: {
    borderTopWidth: 2,
    borderTopColor: '#216a94',
    paddingTop: 8,
    marginTop: -10,
  },
  navText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  activeNavText: {
    color: '#216a94',
    fontWeight: 'bold',
  },
});

export default BusinessProfileScreen;