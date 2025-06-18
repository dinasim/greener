// frontend/Business/BusinessScreens/BusinessInventoryChoiceScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BusinessInventoryChoiceScreen({ navigation, route }) {
  const { businessId, businessName, isNewUser = true } = route.params || {};
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // State
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Entrance animation - FIXED: Disable useNativeDriver for web platform
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  const handleAddInventoryNow = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    console.log('🌱 Navigating to inventory setup...');
    
    // Navigate to the correct inventory screen name
    navigation.replace('AddInventoryScreen', {
      businessId,
      showInventory: false,
      returnTo: 'BusinessTabs',
      isNewBusiness: true
    });
  };

  const handleSkipForNow = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    try {
      // Store that user skipped inventory setup initially
      await AsyncStorage.setItem('skippedInventorySetup', 'true');
      
      // Navigate to main dashboard
      navigation.replace('BusinessTabs', {
        screen: 'BusinessDashboard',
        params: {
          businessId,
          isNewUser: true,
          skipSignalR: false,
          showWelcomeMessage: true
        }
      });
    } catch (error) {
      console.error('Error storing setup preference:', error);
      // Still navigate even if storage fails
      navigation.replace('BusinessTabs', {
        screen: 'BusinessDashboard',
        params: {
          businessId,
          isNewUser: true,
          skipSignalR: false
        }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ],
          }
        ]}
      >
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIconContainer}>
            <MaterialCommunityIcons 
              name="check-circle" 
              size={80} 
              color="#4CAF50" 
            />
          </View>
          <Text style={styles.welcomeTitle}>🎉 Welcome to Greener!</Text>
          <Text style={styles.welcomeSubtitle}>
            Your business "{businessName}" has been created successfully!
          </Text>
        </View>

        {/* Main Question */}
        <View style={styles.questionSection}>
          <Text style={styles.questionTitle}>
            Ready to add your plant inventory?
          </Text>
          <Text style={styles.questionSubtitle}>
            You can start selling right away by adding your plants and products to our marketplace
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Add Inventory Option */}
          <TouchableOpacity 
            style={[styles.optionButton, styles.primaryOption]}
            onPress={handleAddInventoryNow}
            disabled={isNavigating}
            activeOpacity={0.8}
          >
            <View style={styles.optionIcon}>
              <MaterialCommunityIcons name="leaf" size={32} color="#fff" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Add Inventory Now</Text>
              <Text style={styles.optionDescription}>
                Set up your plant inventory and start selling immediately
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Skip Option */}
          <TouchableOpacity 
            style={[styles.optionButton, styles.secondaryOption]}
            onPress={handleSkipForNow}
            disabled={isNavigating}
            activeOpacity={0.8}
          >
            <View style={[styles.optionIcon, styles.secondaryOptionIcon]}>
              <MaterialIcons name="schedule" size={32} color="#4CAF50" />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, styles.secondaryOptionTitle]}>
                Do It Later
              </Text>
              <Text style={[styles.optionDescription, styles.secondaryOptionDescription]}>
                Go to your dashboard and add inventory anytime
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What you can add:</Text>
          <View style={styles.infoItems}>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="leaf" size={16} color="#4CAF50" />
              <Text style={styles.infoText}>Live plants with care instructions</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="hammer-wrench" size={16} color="#FF9800" />
              <Text style={styles.infoText}>Gardening tools and accessories</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="seed" size={16} color="#8BC34A" />
              <Text style={styles.infoText}>Seeds and plant supplies</Text>
            </View>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          Don't worry! You can always change this later from your dashboard
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  questionSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  questionSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryOption: {
    backgroundColor: '#4CAF50',
  },
  secondaryOption: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  secondaryOptionIcon: {
    backgroundColor: '#f0f9f3',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  secondaryOptionTitle: {
    color: '#333',
  },
  optionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  secondaryOptionDescription: {
    color: '#666',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItems: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  footerNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});