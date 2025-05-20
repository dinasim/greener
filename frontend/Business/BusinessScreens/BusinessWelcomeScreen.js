// frontend/screens/Business/BusinessWelcomeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';

// Safe haptic feedback for web compatibility
const Haptics = {
  impactAsync: (style) => {
    // Only try to use haptics on mobile platforms
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        // Dynamic import only on mobile
        const ExpoHaptics = require('expo-haptics');
        if (ExpoHaptics && ExpoHaptics.impactAsync) {
          return ExpoHaptics.impactAsync(style);
        }
      } catch (error) {
        console.warn('Haptics not available:', error);
      }
    }
    return Promise.resolve();
  },
  ImpactFeedbackStyle: {
    Light: 'light'
  }
};

const BusinessWelcomeScreen = ({ navigation }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);

  // Enhanced navigation handler with loading state and haptic feedback
  const handleNavigation = async (screenName, actionType = null) => {
    try {
      // Prevent multiple rapid taps
      if (isNavigating) return;

      setIsNavigating(true);
      setCurrentAction(actionType);

      // Haptic feedback for mobile only
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Small delay for better UX
      setTimeout(() => {
        navigation.navigate(screenName);
        setIsNavigating(false);
        setCurrentAction(null);
      }, 150);

    } catch (error) {
      console.error('Navigation error:', error);
      setIsNavigating(false);
      setCurrentAction(null);
    }
  };

  // Navigation handlers for each action
  const handleSignUp = () => handleNavigation('BusinessSignUpScreen', 'signup');
  const handleSignIn = () => handleNavigation('BusinessSignInScreen', 'signin');
  const handleSwitchToConsumer = () => handleNavigation('PersonaSelection', 'switch');

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={require("../../assets/homescreen1.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <Animated.View 
            style={styles.contentContainer}
            entering={FadeIn.duration(800)}
          >
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
            <Text style={styles.title}>Greener Business</Text>
            <Text style={styles.subtitle}>
              Grow your plant business with tools made for success
            </Text>

            <Animated.View 
              style={styles.buttonContainer}
              entering={SlideInUp.delay(300).springify()}
            >
              {/* Create Business Account Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  isNavigating && currentAction === 'signup' && styles.buttonDisabled
                ]}
                onPress={handleSignUp}
                disabled={isNavigating}
                activeOpacity={0.8}
                accessibilityLabel="Create Business Account"
                accessibilityRole="button"
                accessibilityHint="Navigate to business registration form"
              >
                {isNavigating && currentAction === 'signup' ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.buttonText, styles.buttonTextWithLoader]}>
                      Loading...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <MaterialIcons name="business" size={18} color="#fff" />
                    <Text style={[styles.buttonText, styles.buttonTextWithIcon]}>
                      Create Business Account
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.outlineButton,
                  isNavigating && currentAction === 'signin' && styles.outlineButtonDisabled
                ]}
                onPress={handleSignIn}
                disabled={isNavigating}
                activeOpacity={0.8}
                accessibilityLabel="Sign In to Business Account"
                accessibilityRole="button"
                accessibilityHint="Navigate to business sign in form"
              >
                {isNavigating && currentAction === 'signin' ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color="#2e7d32" />
                    <Text style={[styles.outlineButtonText, styles.buttonTextWithLoader]}>
                      Loading...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <MaterialIcons name="login" size={18} color="#2e7d32" />
                    <Text style={[styles.outlineButtonText, styles.buttonTextWithIcon]}>
                      Sign In
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Switch to Consumer Button - FIXED NAVIGATION */}
              <TouchableOpacity
                style={[
                  styles.backButton,
                  isNavigating && currentAction === 'switch' && styles.backButtonDisabled
                ]}
                onPress={handleSwitchToConsumer} // FIXED: Navigate to PersonaSelection
                disabled={isNavigating}
                activeOpacity={0.7}
                accessibilityLabel="Switch to Consumer Mode"
                accessibilityRole="button"
                accessibilityHint="Go back to persona selection"
              >
                {isNavigating && currentAction === 'switch' ? (
                  <View style={styles.backButtonContent}>
                    <ActivityIndicator size="small" color="#777" />
                    <Text style={[styles.backButtonText, styles.buttonTextWithLoader]}>
                      Switching...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.backButtonContent}>
                    <MaterialIcons name="arrow-back" size={16} color="#777" />
                    <Text style={styles.backButtonText}>Switch to consumer</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Additional Info Section */}
            <Animated.View 
              style={styles.infoSection}
              entering={FadeIn.delay(600).duration(600)}
            >
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="inventory" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Manage inventory</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="analytics" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Track sales</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="storefront" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Online marketplace</Text>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: "center",
    padding: 24,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#2e7d32",
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#4caf50",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#2e7d32",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '90%',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: "#81c784",
    elevation: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextWithIcon: {
    marginLeft: 8,
  },
  buttonTextWithLoader: {
    marginLeft: 8,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderColor: '#2e7d32',
    borderWidth: 2,
  },
  outlineButtonDisabled: {
    borderColor: '#81c784',
    backgroundColor: 'rgba(46, 125, 50, 0.05)',
  },
  outlineButtonText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(119, 119, 119, 0.1)',
  },
  backButtonDisabled: {
    opacity: 0.6,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: "#777",
    marginLeft: 8,
    fontWeight: '500',
  },
  infoSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  featureList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    fontSize: 12,
    color: '#4caf50',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default BusinessWelcomeScreen;