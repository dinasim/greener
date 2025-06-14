// screens/BusinessSellerProfileScreen.js - COMPLETE FIXED VERSION (ALL FUNCTIONALITY PRESERVED)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  ScrollView,
  SafeAreaView,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';
import ReviewForm from '../components/ReviewForm';
import ToastMessage from '../components/ToastMessage';
import RatingStars from '../components/RatingStars';

// Import services
import marketplaceApi from '../services/marketplaceApi';
import { checkForUpdate, UPDATE_TYPES, triggerUpdate, addUpdateListener, removeUpdateListener } from '../services/MarketplaceUpdates';

/**
 * Enhanced Business Seller Profile Screen
 * Displays business information, inventory, reviews, and contact options
 */
const BusinessSellerProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const businessId = route.params?.sellerId || route.params?.businessId;
  
  // State
  const [business, setBusiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [businessRating, setBusinessRating] = useState({ average: 0, count: 0 });
  const [avatarError, setAvatarError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openHours, setOpenHours] = useState(null);
  
  // Toast message state
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  // Load business profile
  const loadBusinessProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!businessId) {
        console.error("No business ID provided");
        setError('Unable to load business profile. Missing business ID.');
        setIsLoading(false);
        return;
      }
      
      console.log("Loading business profile for ID:", businessId);
      
      // FIXED: Use the business profile API endpoint with better error handling
      try {
        const data = await marketplaceApi.fetchBusinessProfile(businessId);
        
        if (data && data.business) {
          console.log("Business profile loaded successfully");
          const businessData = data.business;
          
          // Process and normalize business data
          const processedBusiness = {
            id: businessData.id || businessData.email || businessId,
            businessName: businessData.businessName || businessData.name || 'Business',
            name: businessData.businessName || businessData.name || 'Business',
            email: businessData.email || businessId,
            logo: businessData.logo,
            description: businessData.description || 'No description available',
            businessType: businessData.businessType || 'Plant Business',
            
            // Contact information
            contactPhone: businessData.contactPhone || businessData.phone,
            contactEmail: businessData.contactEmail || businessData.email || businessId,
            
            // Address handling
            address: processAddress(businessData.address || businessData.location),
            
            // Business hours
            businessHours: businessData.businessHours || [],
            
            // Metadata
            joinDate: businessData.joinDate || businessData.createdAt || new Date().toISOString(),
            status: businessData.status || 'active',
            verificationStatus: businessData.verificationStatus || 'unverified',
            isVerified: businessData.verificationStatus === 'verified' || businessData.isVerified || false,
            
            // Stats
            rating: businessData.rating || 0,
            reviewCount: businessData.reviewCount || 0,
            
            // Process inventory
            inventory: processInventory(businessData.inventory || [], businessData),
            
            // Social media
            socialMedia: businessData.socialMedia || {},
            
            isBusiness: true
          };
          
          setBusiness(processedBusiness);
          
          // Determine current open status
          if (processedBusiness.businessHours && processedBusiness.businessHours.length > 0) {
            const todayOpen = getBusinessHoursForToday(processedBusiness.businessHours);
            setOpenHours(todayOpen);
          }
          
        } else {
          console.warn("API returned empty business data, using fallback");
          
          // Fallback to seller data if business profile isn't available
          if (route.params?.sellerData) {
            const sellerData = route.params.sellerData;
            setBusiness({
              id: businessId,
              businessName: sellerData.name || 'Business',
              name: sellerData.name || 'Business',
              email: sellerData.email || businessId,
              logo: sellerData.avatar || sellerData.logo,
              description: sellerData.description || 'No description available',
              businessType: sellerData.businessType || 'Plant Business',
              contactPhone: sellerData.contactPhone,
              contactEmail: sellerData.email,
              address: processAddress(sellerData.address),
              businessHours: sellerData.businessHours || [],
              joinDate: sellerData.joinDate || new Date().toISOString(),
              status: sellerData.status || 'active',
              rating: sellerData.rating || 0,
              reviewCount: sellerData.reviewCount || 0,
              inventory: [],
              socialMedia: {},
              isBusiness: true
            });
          } else {
            setError('Business profile could not be loaded.');
          }
        }
      } catch (apiError) {
        console.error('API call failed:', apiError);
        
        // Try fallback data
        if (route.params?.sellerData) {
          const sellerData = route.params.sellerData;
          setBusiness({
            id: businessId,
            businessName: sellerData.name || 'Business',
            name: sellerData.name || 'Business',
            email: sellerData.email || businessId,
            logo: sellerData.avatar || sellerData.logo,
            description: sellerData.description || 'No description available',
            businessType: sellerData.businessType || 'Plant Business',
            contactPhone: sellerData.contactPhone,
            contactEmail: sellerData.email,
            address: processAddress(sellerData.address),
            businessHours: sellerData.businessHours || [],
            joinDate: sellerData.joinDate || new Date().toISOString(),
            status: sellerData.status || 'active',
            rating: sellerData.rating || 0,
            reviewCount: sellerData.reviewCount || 0,
            inventory: [],
            socialMedia: {},
            isBusiness: true
          });
        } else {
          throw apiError;
        }
      }
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      console.error('Error fetching business profile:', err);
      setError('Failed to load business profile. Please try again later.');
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [businessId, route.params]);

  // Process address data
  const processAddress = (addressData) => {
    if (!addressData || typeof addressData !== 'object') return {};
    
    return {
      street: addressData.street || addressData.address || '',
      houseNumber: addressData.houseNumber || '',
      city: addressData.city || 'Unknown location',
      country: addressData.country || '',
      postalCode: addressData.postalCode || '',
      latitude: addressData.latitude,
      longitude: addressData.longitude,
      formattedAddress: getFormattedAddress(addressData)
    };
  };

  // Get formatted address
  const getFormattedAddress = (addressData) => {
    if (!addressData) return '';
    const parts = [];
    if (addressData.street) parts.push(addressData.street);
    if (addressData.houseNumber) parts.push(addressData.houseNumber);
    if (addressData.city) parts.push(addressData.city);
    if (addressData.country) parts.push(addressData.country);
    return parts.join(', ');
  };

  // Process inventory items to marketplace format
  const processInventory = (inventory, businessData) => {
    if (!Array.isArray(inventory)) return [];
    
    return inventory
      .filter(item => item.status === 'active' && (item.quantity || 0) > 0)
      .map(item => ({
        // Product identifiers
        id: item.id,
        _id: item.id,
        
        // Product info
        title: item.name || item.common_name || 'Business Product',
        name: item.name || item.common_name || 'Business Product',
        common_name: item.common_name,
        scientific_name: item.scientific_name || item.scientificName,
        description: item.description || `${item.name || item.common_name} from ${businessData.businessName || businessData.name}`,
        
        // Pricing
        price: item.finalPrice || item.price || 0,
        originalPrice: item.price || 0,
        discount: item.discount || 0,
        
        // Category and type
        category: item.category || 'Plants',
        productType: item.productType || 'plant',
        
        // Images
        images: item.images || [],
        mainImage: item.mainImage,
        
        // Business-specific fields
        businessId: businessData.id || businessData.email,
        sellerId: businessData.id || businessData.email,
        sellerType: 'business',
        isBusinessListing: true,
        inventoryId: item.id,
        
        // Seller information
        seller: {
          _id: businessData.id || businessData.email,
          name: businessData.businessName || businessData.name || 'Business',
          email: businessData.email || businessData.id,
          isBusiness: true,
          businessName: businessData.businessName || businessData.name,
          businessType: businessData.businessType || 'Business',
          logo: businessData.logo,
          rating: businessData.rating || 0,
          reviewCount: businessData.reviewCount || 0,
          description: businessData.description || ''
        },
        
        // Availability
        availability: {
          inStock: (item.quantity || 0) > 0,
          quantity: item.quantity || 0,
          showQuantity: true,
          pickupLocation: getPickupLocationText(businessData),
          businessType: businessData.businessType || 'Business'
        },
        
        // Location from business
        location: businessData.address ? {
          city: businessData.address.city || 'Unknown location',
          latitude: businessData.address.latitude,
          longitude: businessData.address.longitude,
          formattedAddress: getFormattedAddress(businessData.address),
          displayText: getPickupLocationText(businessData)
        } : { city: 'Unknown location' },
        
        // Timestamps
        addedAt: item.addedAt || item.dateAdded || new Date().toISOString(),
        listedDate: item.addedAt || item.dateAdded || new Date().toISOString(),
        lastUpdated: item.updatedAt || item.lastUpdated,
        
        // Stats
        stats: {
          views: item.viewCount || 0,
          wishlistCount: 0,
          messageCount: 0
        },
        
        // Source
        source: 'business_inventory',
        
        // Business info for display
        businessInfo: {
          type: businessData.businessType || 'Business',
          name: businessData.businessName || businessData.name || 'Business',
          verified: businessData.verificationStatus === 'verified' || businessData.isVerified || false,
          description: businessData.description || '',
          pickupInfo: getPickupInfo(businessData)
        }
      }));
  };

  // Get pickup location text
  const getPickupLocationText = (businessData) => {
    const address = businessData.address || {};
    if (address.city && address.street) {
      return `${address.street}, ${address.city}`;
    } else if (address.city) {
      return address.city;
    } else if (businessData.businessName || businessData.name) {
      return `${businessData.businessName || businessData.name} - Contact for pickup`;
    } else {
      return 'Contact for pickup location';
    }
  };

  // Get pickup information
  const getPickupInfo = (businessData) => {
    return {
      available: true,
      location: getPickupLocationText(businessData),
      businessName: businessData.businessName || businessData.name || 'Business',
      businessType: businessData.businessType || 'Business',
      phone: businessData.phone || businessData.contactPhone || '',
      email: businessData.email || businessData.contactEmail || '',
      hours: businessData.businessHours || [],
      instructions: businessData.pickupInstructions || 'Contact business for pickup details'
    };
  };

  // Check for updates on focus
  useEffect(() => {
    loadBusinessProfile();
    
    // Set up update listener
    const listenerId = `business_profile_${businessId}`;
    addUpdateListener(listenerId, [
      UPDATE_TYPES.BUSINESS_PROFILE,
      UPDATE_TYPES.REVIEW,
      UPDATE_TYPES.INVENTORY
    ], () => {
      setRefreshKey(Date.now());
      loadBusinessProfile();
    });
    
    // Cleanup
    return () => {
      removeUpdateListener(listenerId);
    };
  }, [businessId, loadBusinessProfile, refreshKey]);

  // Show a toast message
  const showToast = (message, type = 'info') => {
    setToast({
      visible: true,
      message,
      type
    });
  };

  // Hide the toast message
  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  };

  // Handle adding a review
  const handleAddReview = async () => {
    try {
      // Check if current user is a business (businesses can't review)
      const userType = await AsyncStorage.getItem('userType');
      if (userType === 'business') {
        showToast("Business accounts cannot leave reviews", "error");
        return;
      }
      
      // Check if user is reviewing their own business
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (userEmail === businessId) {
        showToast("You cannot leave a review for your own business", "error");
        return;
      }
      
      // Show review form
      setShowReviewForm(true);
    } catch (err) {
      console.error("Error checking user type:", err);
      showToast("User verification failed, proceeding anyway", "warning");
      setShowReviewForm(true);
    }
  };

  // Handle reviews loaded callback
  const handleReviewsLoaded = (data) => {
    if (data && typeof data === 'object') {
      setBusinessRating({
        average: data.averageRating || 0,
        count: data.count || 0
      });
    }
  };

  // Handle review submission
  const handleReviewSubmitted = () => {
    // Set active tab to reviews so the user can see their new review
    setActiveTab('reviews');
    
    // Trigger update to refresh other components
    triggerUpdate(UPDATE_TYPES.REVIEW, {
      targetId: businessId,
      targetType: 'seller',
      timestamp: Date.now()
    });
    
    // Refresh the reviews list
    setRefreshKey(Date.now());
    
    // Show toast notification for successful submission
    showToast("Your review has been submitted successfully!", "success");
    
    // Close the review form
    setShowReviewForm(false);
  };

  // Get business logo URL with fallback
  const getBusinessLogoUrl = (business) => {
    if (business?.logo && !avatarError) {
      return business.logo;
    }
    
    // Fallback to generated avatar
    const displayName = business?.businessName || business?.name || 'Business';
    const firstInitial = displayName.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstInitial)}&background=4CAF50&color=fff&size=256`;
  };

  // Get today's business hours
  const getBusinessHoursForToday = (businessHours) => {
    if (!businessHours || !Array.isArray(businessHours)) return null;
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const dayIndex = today.getDay();
    const dayName = days[dayIndex];
    
    const todayHours = businessHours.find(
      h => h.day.toLowerCase() === dayName.toLowerCase()
    );
    
    if (!todayHours) return null;
    
    // Check if closed today
    if (todayHours.isClosed) {
      return { isClosed: true, day: dayName };
    }
    
    // Check if currently open
    const now = today.getHours() * 60 + today.getMinutes(); // Current time in minutes
    
    // Parse hours to minutes
    const parseTimeToMinutes = (timeString) => {
      if (!timeString) return 0;
      const [hours, minutes] = timeString.split(':').map(Number);
      return hours * 60 + (minutes || 0);
    };
    
    const openMinutes = parseTimeToMinutes(todayHours.open);
    const closeMinutes = parseTimeToMinutes(todayHours.close);
    
    return {
      day: dayName,
      open: todayHours.open,
      close: todayHours.close,
      isClosed: todayHours.isClosed,
      isCurrentlyOpen: now >= openMinutes && now < closeMinutes
    };
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(Date.now());
    loadBusinessProfile();
  };

  // FIXED: Handle contact business with robust navigation
  const handleContactBusiness = () => {
    if (!business) return;
    
    try {
      // FIXED: Use the same robust navigation as PlantCard
      const params = {
        sellerId: business.id || business.email,
        sellerName: business.businessName || business.name,
        isBusiness: true
      };

      // Try different navigation approaches
      let navigationSuccess = false;

      // Method 1: Try nested tab navigation
      try {
        navigation.navigate('MarketplaceTabs', {
          screen: 'Messages',
          params
        });
        navigationSuccess = true;
      } catch (e) {
        console.log('Tab navigation failed, trying direct...');
      }

      // Method 2: Try direct navigation
      if (!navigationSuccess) {
        try {
          navigation.navigate('Messages', params);
          navigationSuccess = true;
        } catch (e) {
          console.log('Direct navigation failed, trying main tabs...');
        }
      }

      // Method 3: Try main tabs
      if (!navigationSuccess) {
        try {
          navigation.navigate('MainTabs', {
            screen: 'Messages',
            params
          });
          navigationSuccess = true;
        } catch (e) {
          console.log('All navigation methods failed');
        }
      }

      if (!navigationSuccess) {
        // Fallback: Show contact options dialog
        const options = [];
        
        if (business.contactPhone) {
          options.push({
            text: '📱 Call Business',
            onPress: () => Linking.openURL(`tel:${business.contactPhone}`)
              .catch(err => {
                console.error('Error opening phone app:', err);
                showToast('Could not open phone app', 'error');
              })
          });
        }
        
        if (business.contactEmail) {
          options.push({
            text: '📧 Send Email',
            onPress: () => Linking.openURL(`mailto:${business.contactEmail}`)
              .catch(err => {
                console.error('Error opening email app:', err);
                showToast('Could not open email app', 'error');
              })
          });
        }
        
        options.push({ text: 'Cancel', style: 'cancel' });
        
        // Show options dialog
        Alert.alert(
          `Contact ${business.businessName || business.name}`,
          'Choose how to contact the business',
          options,
          { cancelable: true }
        );
      }
    } catch (error) {
      console.error('Contact business error:', error);
      showToast('Could not contact business', 'error');
    }
  };

  // Render business hours
  const renderBusinessHours = () => {
    if (!business?.businessHours || !Array.isArray(business.businessHours) || business.businessHours.length === 0) {
      return (
        <View style={styles.sectionContent}>
          <Text style={styles.noDataText}>Business hours not available</Text>
        </View>
      );
    }
    
    // Sort days starting with Sunday
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sortedHours = [...business.businessHours].sort((a, b) => {
      const dayIndexA = days.indexOf(a.day);
      const dayIndexB = days.indexOf(b.day);
      return dayIndexA - dayIndexB;
    });
    
    return (
      <View style={styles.sectionContent}>
        {sortedHours.map((hours, index) => (
          <View 
            key={hours.day} 
            style={[
              styles.hoursRow,
              index % 2 === 0 && styles.evenRow,
              openHours?.day === hours.day && styles.todayRow
            ]}
          >
            <Text style={[
              styles.dayText,
              openHours?.day === hours.day && styles.todayText
            ]}>
              {hours.day}
            </Text>
            
            {hours.isClosed ? (
              <Text style={styles.closedText}>Closed</Text>
            ) : (
              <Text style={styles.hoursText}>{hours.open} - {hours.close}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Handle navigation to map view
  const handleViewOnMap = () => {
    if (!business?.address?.latitude || !business?.address?.longitude) {
      showToast('Location coordinates not available', 'error');
      return;
    }
    
    // Navigate to map view with business location
    navigation.navigate('MapView', {
      initialLocation: {
        latitude: business.address.latitude,
        longitude: business.address.longitude
      },
      markerTitle: business.businessName || business.name,
      markerDescription: business.address.formattedAddress || 
        `${business.address.street || ''}, ${business.address.city || ''}`,
    });
  };

  // Handle direction to business
  const handleGetDirections = () => {
    if (!business?.address?.latitude || !business?.address?.longitude) {
      showToast('Location coordinates not available', 'error');
      return;
    }
    
    const lat = business.address.latitude;
    const lng = business.address.longitude;
    const label = encodeURIComponent(business.businessName || business.name);
    
    let url;
    if (Platform.OS === 'ios') {
      url = `maps://app?daddr=${lat},${lng}&ll=${lat},${lng}&q=${label}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
    }
    
    Linking.openURL(url).catch(err => {
      console.error('Error opening maps app:', err);
      showToast('Could not open maps application', 'error');
    });
  };

  // Render tab content
  const renderTabContent = () => {
    if (activeTab === 'reviews') {
      return (
        <ReviewsList
          targetType="seller"
          targetId={businessId}
          onAddReview={null}
          onReviewsLoaded={handleReviewsLoaded}
          autoLoad={true}
          hideAddButton={true}
          key={`reviews-${refreshKey}`}
        />
      );
    }
    
    if (activeTab === 'about') {
      return (
        <ScrollView style={styles.aboutContainer}>
          {/* Description Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Business</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.descriptionText}>
                {business?.description || 'No description available'}
              </Text>
            </View>
          </View>
          
          {/* Address Section */}
          {business?.address && Object.keys(business.address).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.sectionContent}>
                <View style={styles.addressContainer}>
                  <MaterialIcons name="place" size={20} color="#4CAF50" style={styles.addressIcon} />
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressText}>
                      {business.address.formattedAddress || 
                        `${business.address.street || ''} ${business.address.houseNumber || ''}, ${business.address.city || ''}, ${business.address.country || ''}`
                      }
                    </Text>
                  </View>
                </View>
                
                <View style={styles.mapButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.mapButton}
                    onPress={handleViewOnMap}
                  >
                    <MaterialIcons name="map" size={16} color="#fff" />
                    <Text style={styles.mapButtonText}>View on Map</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.mapButton}
                    onPress={handleGetDirections}
                  >
                    <MaterialIcons name="directions" size={16} color="#fff" />
                    <Text style={styles.mapButtonText}>Get Directions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          
          {/* Business Hours Section */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Business Hours</Text>
              {openHours && (
                <View style={[
                  styles.openStatusBadge,
                  openHours.isClosed || !openHours.isCurrentlyOpen 
                    ? styles.closedBadge 
                    : styles.openBadge
                ]}>
                  <Text style={styles.openStatusText}>
                    {openHours.isClosed ? 'Closed Today' : 
                      openHours.isCurrentlyOpen ? 'Open Now' : 'Closed Now'}
                  </Text>
                </View>
              )}
            </View>
            {renderBusinessHours()}
          </View>
          
          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.sectionContent}>
              {business?.contactPhone ? (
                <TouchableOpacity 
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`tel:${business.contactPhone}`)}
                >
                  <MaterialIcons name="phone" size={20} color="#4CAF50" style={styles.contactIcon} />
                  <Text style={styles.contactText}>{business.contactPhone}</Text>
                </TouchableOpacity>
              ) : null}
              
              {business?.contactEmail ? (
                <TouchableOpacity 
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`mailto:${business.contactEmail}`)}
                >
                  <MaterialIcons name="email" size={20} color="#4CAF50" style={styles.contactIcon} />
                  <Text style={styles.contactText}>{business.contactEmail}</Text>
                </TouchableOpacity>
              ) : null}
              
              <TouchableOpacity 
                style={[styles.contactButton, styles.messageButton]}
                onPress={handleContactBusiness}
              >
                <MaterialIcons name="chat" size={18} color="#fff" />
                <Text style={styles.contactButtonText}>Message Business</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Social Media Section */}
          {business?.socialMedia && Object.values(business.socialMedia).some(v => v) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connect with Us</Text>
              <View style={styles.socialMediaContainer}>
                {business.socialMedia.website && (
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Linking.openURL(ensureHttps(business.socialMedia.website))}
                  >
                    <MaterialIcons name="language" size={24} color="#4CAF50" />
                    <Text style={styles.socialButtonText}>Website</Text>
                  </TouchableOpacity>
                )}
                
                {business.socialMedia.instagram && (
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Linking.openURL(`https://instagram.com/${business.socialMedia.instagram.replace('@', '')}`)}
                  >
                    <MaterialCommunityIcons name="instagram" size={24} color="#4CAF50" />
                    <Text style={styles.socialButtonText}>Instagram</Text>
                  </TouchableOpacity>
                )}
                
                {business.socialMedia.facebook && (
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Linking.openURL(`https://facebook.com/${business.socialMedia.facebook}`)}
                  >
                    <MaterialCommunityIcons name="facebook" size={24} color="#4CAF50" />
                    <Text style={styles.socialButtonText}>Facebook</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      );
    }
    
    // Default tab is inventory
    const inventory = business?.inventory || [];
    
    if (inventory.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialIcons name="eco" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>
            No plants in inventory
          </Text>
        </View>
      );
    }
    
    return (
      <FlatList
        data={inventory}
        renderItem={({ item }) => (
          <PlantCard 
            plant={item}
            showActions={true}
          />
        )}
        keyExtractor={item => item.id || item._id || `plant-${Math.random()}`}
        numColumns={2}
        contentContainerStyle={styles.plantGrid}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
      />
    );
  };

  // Helper to ensure URLs have https://
  const ensureHttps = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Business Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading business profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Business Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBusinessProfile}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get business logo URL with fallback
  const logoUrl = getBusinessLogoUrl(business);
  
  // Display rating
  const displayRating = businessRating.average > 0 
    ? businessRating.average 
    : (business.rating || 0);
  const formattedRating = typeof displayRating === 'number' 
    ? displayRating.toFixed(1) 
    : '0.0';

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Business Profile"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      {/* Toast Message Component */}
      <ToastMessage 
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        duration={3000}
      />
      
      <View style={styles.profileContent}>
        {/* Business Header */}
        <View style={styles.profileCard}>
          <Image 
            source={{ uri: logoUrl }} 
            style={styles.logo}
            resizeMode="cover"
            onError={() => {
              console.log('Logo image failed to load');
              setAvatarError(true);
            }}
          />
          
          <View style={styles.businessInfo}>
            <View style={styles.businessNameRow}>
              <Text style={styles.businessName}>
                {business.businessName || business.name}
              </Text>
              {openHours && (
                <View style={[
                  styles.openStatusBadge,
                  openHours.isClosed || !openHours.isCurrentlyOpen 
                    ? styles.closedBadge 
                    : styles.openBadge
                ]}>
                  <Text style={styles.openStatusText}>
                    {openHours.isClosed ? 'Closed Today' : 
                      openHours.isCurrentlyOpen ? 'Open Now' : 'Closed Now'}
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={styles.businessType}>
              {business.businessType || 'Plant Business'}
            </Text>
            
            {business.address?.city && (
              <View style={styles.locationRow}>
                <MaterialIcons name="place" size={14} color="#666" />
                <Text style={styles.locationText}>
                  {business.address.city}{business.address.country ? `, ${business.address.country}` : ''}
                </Text>
              </View>
            )}
            
            <View style={styles.contactActions}>
              <TouchableOpacity 
                style={styles.contactAction}
                onPress={handleContactBusiness}
              >
                <MaterialIcons name="chat" size={20} color="#4CAF50" />
                <Text style={styles.contactActionText}>Contact</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.contactAction}
                onPress={handleAddReview}
              >
                <MaterialIcons name="rate-review" size={20} color="#4CAF50" />
                <Text style={styles.contactActionText}>Review</Text>
              </TouchableOpacity>
              
              {business.address?.latitude && business.address?.longitude && (
                <TouchableOpacity 
                  style={styles.contactAction}
                  onPress={handleViewOnMap}
                >
                  <MaterialIcons name="map" size={20} color="#4CAF50" />
                  <Text style={styles.contactActionText}>Map</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {business.inventory?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          
          <View style={styles.statBox}>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingValue}>{formattedRating}</Text>
              <RatingStars rating={displayRating} size={16} />
            </View>
            <Text style={styles.statLabel}>
              Rating ({businessRating.count || business.reviewCount || 0})
            </Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {new Date(business.joinDate || Date.now()).getFullYear()}
            </Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        </View>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'inventory' && styles.activeTabButton]} 
            onPress={() => setActiveTab('inventory')}
          >
            <MaterialIcons 
              name="eco" 
              size={20} 
              color={activeTab === 'inventory' ? '#4CAF50' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>
              Inventory
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'about' && styles.activeTabButton]} 
            onPress={() => setActiveTab('about')}
          >
            <MaterialIcons 
              name="info" 
              size={20} 
              color={activeTab === 'about' ? '#4CAF50' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>
              About
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'reviews' && styles.activeTabButton]} 
            onPress={() => setActiveTab('reviews')}
          >
            <MaterialIcons 
              name="star" 
              size={20} 
              color={activeTab === 'reviews' ? '#4CAF50' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
              Reviews
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Tab Content */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
      
      {/* Review Form Modal */}
      <ReviewForm
        targetId={businessId}
        targetType="seller"
        isVisible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileContent: {
    backgroundColor: '#fff',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 10,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#e0e0e0',
  },
  businessInfo: {
    flex: 1,
  },
  businessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  openStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openBadge: {
    backgroundColor: '#e8f5e8',
  },
  closedBadge: {
    backgroundColor: '#ffebee',
  },
  openStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  businessType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  contactActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  contactAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
  },
  contactActionText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 4,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  // About tab styles
  aboutContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionContent: {
    
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  mapButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  mapButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  evenRow: {
    backgroundColor: '#f9f9f9',
  },
  todayRow: {
    backgroundColor: '#f0f9f3',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  todayText: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  hoursText: {
    fontSize: 14,
    color: '#333',
  },
  closedText: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '500',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactIcon: {
    marginRight: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#333',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginTop: 8,
  },
  messageButton: {
    backgroundColor: '#4CAF50',
  },
  contactButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  socialMediaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  socialButton: {
    alignItems: 'center',
    padding: 12,
  },
  socialButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  // Inventory tab styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  plantGrid: {
    paddingBottom: 80,
  },
});

export default BusinessSellerProfileScreen;