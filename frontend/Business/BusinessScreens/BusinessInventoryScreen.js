// Business/BusinessScreens/BusinessInventorySetupScreen.js - ENHANCED VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import business services - UPDATED to use proper service structure
import { 
  getBusinessInventory, 
  getBusinessDashboard,
  checkApiHealth,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem 
} from '../services/businessApi';
import { 
  getBusinessMarketplaceProfile 
} from '../services/businessMarketplaceApi';
import { 
  getDetailedAnalytics 
} from '../services/businessReportsApi';
import { 
  searchPlantsForBusiness,
  getBusinessWeatherAdvice 
} from '../services/businessPlantApi';

// Import reusable components
import KPIWidget from '../components/KPIWidget';
import LowStockBanner from '../components/LowStockBanner';

const { width, height } = Dimensions.get('window');

export default function BusinessInventorySetupScreen({ navigation, route }) {
  // State management
  const [businessId, setBusinessId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);

  // Initialize component
  useEffect(() => {
    initializeSetup();
    startEntranceAnimation();
    
    // Setup auto-refresh
    if (autoRefreshEnabled) {
      setupAutoRefresh();
    }
    
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, []);

  // Auto-refresh setup
  const setupAutoRefresh = () => {
    refreshTimer.current = setInterval(() => {
      if (!isLoading && !isFinishing) {
        checkInventoryStatus();
      }
    }, 30000); // Refresh every 30 seconds
  };

  // Entrance animations
  const startEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Initialize setup data
  const initializeSetup = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load user data
      const [email, storedBusinessId] = await Promise.all([
        AsyncStorage.getItem('userEmail'),
        AsyncStorage.getItem('businessId')
      ]);
      
      setUserEmail(email);
      setBusinessId(storedBusinessId || email);
      
      // FIXED: Check API health first - but don't fail on API issues
      console.log('🏥 Checking API health...');
      const healthCheck = await checkApiHealth();
      console.log('🏥 Health check result:', healthCheck);
      
      if (!healthCheck.healthy) {
        console.warn('⚠️ API health check failed, but continuing with setup:', healthCheck.error);
        // Don't throw error - just warn and continue
        // The individual API calls will handle their own errors
      } else {
        console.log('✅ API is healthy, proceeding with full setup');
      }
      
      // Load inventory and dashboard data - handle errors gracefully
      await Promise.all([
        checkInventoryStatus().catch(err => {
          console.warn('⚠️ Inventory check failed:', err.message);
          // Don't fail setup for this
        }),
        loadDashboardData().catch(err => {
          console.warn('⚠️ Dashboard load failed:', err.message);
          // Don't fail setup for this
        })
      ]);
      
      console.log('✅ Setup initialization completed');
      
    } catch (error) {
      console.error('❌ Setup initialization error:', error);
      
      // Only set error for critical failures, not API connectivity issues
      if (error.message.includes('userEmail') || error.message.includes('businessId')) {
        setError('Failed to load user information. Please try signing in again.');
      } else {
        console.warn('⚠️ Non-critical setup error, continuing anyway:', error.message);
        // Don't show error to user for API connectivity issues
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check inventory status
  const checkInventoryStatus = useCallback(async () => {
    if (!businessId) return;
    
    try {
      const inventoryData = await getBusinessInventory(businessId);
      setInventoryStatus(inventoryData);
      
      // If inventory exists, auto-navigate after animation
      if (inventoryData.inventory.length > 0 && route.params?.autoRedirect) {
        setTimeout(() => {
          handleFinishLater();
        }, 2000);
      }
      
    } catch (error) {
      console.warn('Failed to check inventory status:', error);
      // Don't set error for inventory check as it's expected to be empty initially
    }
  }, [businessId]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!businessId) return;
    
    try {
      const dashboard = await getBusinessDashboard();
      setDashboardData(dashboard);
    } catch (error) {
      console.warn('Failed to load dashboard data:', error);
    }
  }, [businessId]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      checkInventoryStatus(),
      loadDashboardData()
    ]);
    setRefreshing(false);
  }, [checkInventoryStatus, loadDashboardData]);

  // Navigation handlers
  const handleAddPlants = () => {
    console.log('🌱 Creating inventory - navigating to AddInventoryScreen...');
    
    try {
      // Start loading pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Navigate to AddInventoryScreen
      navigation.navigate('AddInventoryScreen', { 
        businessId,
        returnTo: 'BusinessInventorySetupScreen'
      });
      
      console.log('✅ Navigation initiated successfully');
    } catch (error) {
      console.error('❌ Navigation error:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to open inventory setup. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleViewInventory = () => {
    console.log('📦 Opening inventory management...');
    
    try {
      // Try multiple possible screen names for inventory management
      const inventoryScreens = ['BusinessInventory', 'InventoryScreen', 'BusinessInventoryScreen'];
      
      // Try the first available screen
      navigation.navigate(inventoryScreens[0], { businessId });
      
      console.log('✅ Inventory navigation initiated');
    } catch (error) {
      console.error('❌ Inventory navigation error:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to open inventory management. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleFinishLater = () => {
    console.log('⏭️ Finishing setup later - navigating to dashboard...');
    
    setIsFinishing(true);
    
    try {
      // Start completion animation
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      
      rotateAnimation.start();
      
      // Complete setup process
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          try {
            rotateAnimation.stop();
            
            // Try multiple possible navigation targets
            const dashboardScreens = ['BusinessTabs', 'BusinessDashboard', 'BusinessNavigation'];
            
            // Try replace first, then navigate as fallback
            try {
              navigation.replace(dashboardScreens[0]);
              console.log('✅ Successfully navigated to dashboard');
            } catch (replaceError) {
              console.warn('⚠️ Replace failed, trying navigate:', replaceError);
              navigation.navigate(dashboardScreens[0]);
            }
          } catch (navError) {
            console.error('❌ Dashboard navigation error:', navError);
            
            // Fallback: just go back to previous screen
            setIsFinishing(false);
            Alert.alert(
              'Navigation Error',
              'Setup completed but unable to open dashboard. You can access it from the main menu.',
              [
                {
                  text: 'Go Back',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        });
      }, 2500);
    } catch (error) {
      console.error('❌ Finish later error:', error);
      setIsFinishing(false);
      Alert.alert(
        'Error',
        'Unable to complete setup. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Skip setup
  const handleSkipSetup = () => {
    Alert.alert(
      'Skip Inventory Setup?',
      'You can always add products later from your dashboard. Continue?',
      [
        { text: 'Add Products Now', style: 'cancel' },
        { 
          text: 'Skip for Now', 
          style: 'default',
          onPress: handleFinishLater 
        }
      ]
    );
  };

  // Animation interpolations
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <MaterialCommunityIcons name="store-settings" size={60} color="#4CAF50" />
          </Animated.View>
          <Text style={styles.loadingText}>Setting up your business...</Text>
          <Text style={styles.loadingSubtext}>
            Checking your inventory and preparing your dashboard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render finishing state
  if (isFinishing) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[
          styles.finishingContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}>
          <Animated.View style={{
            transform: [{ rotate: rotateInterpolate }],
          }}>
            <MaterialCommunityIcons name="check-circle" size={80} color="#4CAF50" />
          </Animated.View>
          <Text style={styles.finishingTitle}>Setup Complete!</Text>
          <Text style={styles.finishingSubtitle}>
            Your business dashboard is ready. You can add products anytime.
          </Text>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.completeDot]} />
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorTitle}>Setup Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializeSetup}>
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasInventory = inventoryStatus?.inventory?.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView 
        contentContainerStyle={styles.content}
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View 
          style={[
            styles.header,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.headerIconContainer}>
            <MaterialCommunityIcons name="store" size={64} color="#4CAF50" />
            {autoRefreshEnabled && (
              <View style={styles.autoRefreshIndicator}>
                <MaterialCommunityIcons name="sync" size={12} color="#4CAF50" />
              </View>
            )}
          </View>
          <Text style={styles.title}>
            {hasInventory ? 'Inventory Ready!' : 'Setup Your Inventory'}
          </Text>
          <Text style={styles.subtitle}>
            {hasInventory 
              ? `You have ${inventoryStatus.inventory.length} products in your inventory`
              : 'Add plants and products to start selling on the marketplace'
            }
          </Text>
        </Animated.View>

        {/* Inventory Status Cards */}
        {hasInventory && inventoryStatus && (
          <Animated.View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <KPIWidget
                title="Total Products"
                value={inventoryStatus.summary.totalItems}
                icon="package-variant"
                color="#4CAF50"
                onPress={handleViewInventory}
              />
              <KPIWidget
                title="Active Items"
                value={inventoryStatus.summary.activeItems}
                icon="check-circle"
                color="#2196F3"
              />
            </View>
            <View style={styles.statusRow}>
              <KPIWidget
                title="Low Stock"
                value={inventoryStatus.summary.lowStockItems}
                icon="alert-circle"
                color="#FF9800"
                subtitle={inventoryStatus.summary.lowStockItems > 0 ? 'Needs attention' : 'All good'}
              />
              <KPIWidget
                title="Total Value"
                value={inventoryStatus.summary.totalValue}
                format="currency"
                icon="currency-usd"
                color="#9C27B0"
              />
            </View>
            
            {/* Low Stock Banner */}
            {inventoryStatus.summary.lowStockItems > 0 && (
              <LowStockBanner
                lowStockItems={inventoryStatus.inventory.filter(item => item.isLowStock)}
                onManageStock={handleViewInventory}
                onRestock={(item) => {
                  navigation.navigate('EditProductScreen', { product: item });
                }}
              />
            )}
          </Animated.View>
        )}

        {/* Action Options */}
        <Animated.View 
          style={[
            styles.optionsContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity 
            style={[styles.primaryOption, hasInventory && styles.secondaryOptionStyle]} 
            onPress={handleAddPlants}
          >
            <Animated.View 
              style={[styles.optionIcon, { transform: [{ scale: pulseAnim }] }]}
            >
              <MaterialCommunityIcons name="leaf" size={32} color="#fff" />
            </Animated.View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>
                {hasInventory ? 'Add More Products' : 'Create Inventory'}
              </Text>
              <Text style={styles.optionDescription}>
                {hasInventory 
                  ? 'Expand your inventory with more plants and products'
                  : 'Build your product catalog by adding plants and accessories'
                }
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color="#4CAF50" />
          </TouchableOpacity>

          {hasInventory && (
            <TouchableOpacity style={styles.inventoryOption} onPress={handleViewInventory}>
              <View style={[styles.optionIcon, { backgroundColor: '#2196F3' }]}>
                <MaterialCommunityIcons name="package-variant" size={28} color="#fff" />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Manage Inventory</Text>
                <Text style={styles.optionDescription}>
                  View, edit, and manage your existing products
                </Text>
              </View>
              <MaterialIcons name="arrow-forward" size={24} color="#2196F3" />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.finishOption} 
            onPress={hasInventory ? handleFinishLater : handleSkipSetup}
          >
            <View style={styles.optionIcon}>
              <MaterialIcons 
                name={hasInventory ? "dashboard" : "schedule"} 
                size={28} 
                color="#666" 
              />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.secondaryOptionTitle}>
                {hasInventory ? 'Go to Dashboard' : 'Finish This Later'}
              </Text>
              <Text style={styles.optionDescription}>
                {hasInventory 
                  ? 'Access your full business dashboard'
                  : 'Skip for now and set up inventory later'
                }
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Information Section */}
        {!hasInventory && (
          <Animated.View 
            style={[
              styles.infoSection,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Text style={styles.infoTitle}>What you can add:</Text>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" />
              <Text style={styles.infoText}>Live plants with care instructions</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="hammer-wrench" size={20} color="#FF9800" />
              <Text style={styles.infoText}>Gardening tools and accessories</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="seed" size={20} color="#8BC34A" />
              <Text style={styles.infoText}>Seeds and plant supplies</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="flower" size={20} color="#E91E63" />
              <Text style={styles.infoText}>Decorative pots and planters</Text>
            </View>
          </Animated.View>
        )}

        {/* Encouragement Section */}
        <Animated.View 
          style={[
            styles.encouragementSection,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <MaterialCommunityIcons name="lightbulb-on" size={24} color="#FFC107" />
          <Text style={styles.encouragementText}>
            {hasInventory 
              ? 'Your inventory is set up! You can always add more products or manage existing ones from your dashboard.'
              : "Don't worry! You can always add more products later from your dashboard."
            }
          </Text>
        </Animated.View>

        {/* Auto-refresh indicator */}
        {autoRefreshEnabled && !hasInventory && (
          <View style={styles.autoRefreshInfo}>
            <MaterialCommunityIcons name="sync" size={16} color="#4CAF50" />
            <Text style={styles.autoRefreshText}>
              Auto-checking for inventory updates...
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  finishingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  finishingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 20,
    textAlign: 'center',
  },
  finishingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  progressDots: {
    flexDirection: 'row',
    marginTop: 30,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 6,
  },
  activeDot: {
    backgroundColor: '#4CAF50',
  },
  completeDot: {
    backgroundColor: '#4CAF50',
    transform: [{ scale: 1.2 }],
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  headerIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  autoRefreshIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f0f9f3',
    borderRadius: 10,
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  statusContainer: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  primaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryOptionStyle: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
  },
  inventoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  finishOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  secondaryOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  encouragementSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff9e6',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    marginBottom: 20,
  },
  encouragementText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  autoRefreshInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  autoRefreshText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 6,
  },
});