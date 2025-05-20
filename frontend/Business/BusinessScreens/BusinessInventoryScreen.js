import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BusinessInventorySetupScreen({ navigation }) {
  const [businessId, setBusinessId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadBusinessId();
    
    // Start entrance animation
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
    ]).start();
  }, []);

  const loadBusinessId = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      const storedBusinessId = await AsyncStorage.getItem('businessId');
      setBusinessId(storedBusinessId || email);
    } catch (error) {
      console.error('Error loading business ID:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlants = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };

  const handleFinishLater = () => {
    setIsFinishing(true);
    
    // Start loading animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    rotateAnimation.start();
    
    // Simulate setup completion process
    setTimeout(() => {
      // Fade out animation
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
        rotateAnimation.stop();
        navigation.replace('BusinessHomeScreen');
      });
    }, 3000); // 3 seconds of "setup completion"
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Setting up your business...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <MaterialCommunityIcons name="store-settings" size={80} color="#216a94" />
          </Animated.View>
          <Text style={styles.finishingTitle}>Setting up your business...</Text>
          <Text style={styles.finishingSubtitle}>
            We're preparing your dashboard and getting everything ready for you.
          </Text>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, { backgroundColor: '#216a94' }]} />
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView 
        contentContainerStyle={styles.content}
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons name="store-outline" size={64} color="#216a94" />
          <Text style={styles.title}>Setup Your Inventory</Text>
          <Text style={styles.subtitle}>
            Add plants to your inventory to start selling on the marketplace
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.primaryOption} onPress={handleAddPlants}>
            <View style={styles.optionIcon}>
              <MaterialCommunityIcons name="leaf" size={32} color="#fff" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Add Plants</Text>
              <Text style={styles.optionDescription}>
                Search and add plants from our database to your inventory
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color="#216a94" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryOption} onPress={handleFinishLater}>
            <View style={styles.optionIcon}>
              <MaterialIcons name="schedule" size={28} color="#666" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.secondaryOptionTitle}>Finish This Later</Text>
              <Text style={styles.optionDescription}>
                Skip for now and go to your business dashboard
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
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
        </View>

        <View style={styles.encouragementSection}>
          <MaterialCommunityIcons name="lightbulb-on" size={24} color="#FFC107" />
          <Text style={styles.encouragementText}>
            Don't worry! You can always add more products later from your dashboard.
          </Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    color: '#216a94',
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
  content: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#216a94',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  primaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#216a94',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ddd',
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
    backgroundColor: '#216a94',
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
    color: '#216a94',
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
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  encouragementSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  encouragementText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
});