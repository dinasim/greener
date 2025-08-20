// frontend/screens/Business/BusinessWelcomeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';

// ---- App blue palette (matches BusinessSignInScreen) ----
const COLORS = {
  primary: '#216a94',
  primaryDark: '#194e6a',
  primaryLight: '#eaf3fb',
  surfaceLight: '#f0f8ff',
  border: '#cfe1ec',
  text: '#1f4153',
  textMuted: '#556570',
  white: '#fff',
};

// Safe haptic feedback for web compatibility
const Haptics = {
  impactAsync: (style) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        const ExpoHaptics = require('expo-haptics');
        if (ExpoHaptics?.impactAsync) {
          return ExpoHaptics.impactAsync(style);
        }
      } catch (e) {
        // no-op on web / simulators without haptics
      }
    }
    return Promise.resolve();
  },
  ImpactFeedbackStyle: { Light: 'light' },
};

const BusinessWelcomeScreen = ({ navigation }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);

  const handleNavigation = async (screenName, actionType = null) => {
    if (isNavigating) return;
    setIsNavigating(true);
    setCurrentAction(actionType);
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTimeout(() => {
      navigation.navigate(screenName);
      setIsNavigating(false);
      setCurrentAction(null);
    }, 150);
  };

  const handleSignUp = () => handleNavigation('BusinessSignUpScreen', 'signup');
  const handleSignIn = () => handleNavigation('BusinessSignInScreen', 'signin');
  const handleSwitchToConsumer = () => handleNavigation('PersonaSelection', 'switch');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrap}>
        <Animated.View style={styles.contentContainer} entering={FadeIn.duration(800)}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />

          <Text style={styles.title}>Greener Business</Text>
          <Text style={styles.subtitle}>Grow your plant business with tools made for success</Text>

          <Animated.View style={styles.buttonContainer} entering={SlideInUp.delay(300).springify()}>
            {/* Create Business Account */}
            <TouchableOpacity
              style={[styles.button, isNavigating && currentAction === 'signup' && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={isNavigating}
              activeOpacity={0.85}
              accessibilityLabel="Create Business Account"
              accessibilityRole="button"
            >
              {isNavigating && currentAction === 'signup' ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={[styles.buttonText, styles.buttonTextWithLoader]}>Loading...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <MaterialIcons name="business" size={18} color={COLORS.white} />
                  <Text style={[styles.buttonText, styles.buttonTextWithIcon]}>Create Business Account</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Sign In */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.outlineButton,
                isNavigating && currentAction === 'signin' && styles.outlineButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={isNavigating}
              activeOpacity={0.85}
              accessibilityLabel="Sign In to Business Account"
              accessibilityRole="button"
            >
              {isNavigating && currentAction === 'signin' ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={[styles.outlineButtonText, styles.buttonTextWithLoader]}>Loading...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <MaterialIcons name="login" size={18} color={COLORS.primary} />
                  <Text style={[styles.outlineButtonText, styles.buttonTextWithIcon]}>Sign In</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Switch to Consumer */}
            <TouchableOpacity
              style={[styles.backButton, isNavigating && currentAction === 'switch' && styles.backButtonDisabled]}
              onPress={handleSwitchToConsumer}
              disabled={isNavigating}
              activeOpacity={0.8}
              accessibilityLabel="Switch to Consumer Mode"
              accessibilityRole="button"
            >
              {isNavigating && currentAction === 'switch' ? (
                <View style={styles.backButtonContent}>
                  <ActivityIndicator size="small" color={COLORS.textMuted} />
                  <Text style={[styles.backButtonText, styles.buttonTextWithLoader]}>Switching...</Text>
                </View>
              ) : (
                <View style={styles.backButtonContent}>
                  <MaterialIcons name="arrow-back" size={16} color={COLORS.textMuted} />
                  <Text style={styles.backButtonText}>Switch to consumer</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Feature bullets */}
          <Animated.View style={styles.infoSection} entering={FadeIn.delay(600).duration(600)}>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="inventory" size={16} color={COLORS.primary} />
                <Text style={styles.featureText}>Manage inventory</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="analytics" size={16} color={COLORS.primary} />
                <Text style={styles.featureText}>Track sales</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="storefront" size={16} color={COLORS.primary} />
                <Text style={styles.featureText}>Online marketplace</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryLight }, // brand-matched background
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginTop: 6,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 26,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    width: '92%',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  buttonDisabled: {
    backgroundColor: '#6aa7c5',
    elevation: 1,
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  buttonTextWithIcon: { marginLeft: 8 },
  buttonTextWithLoader: { marginLeft: 8 },

  outlineButton: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  outlineButtonDisabled: {
    borderColor: '#6aa7c5',
    backgroundColor: 'rgba(33,106,148,0.04)',
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(31,65,83,0.08)',
  },
  backButtonDisabled: { opacity: 0.6 },
  backButtonContent: { flexDirection: 'row', alignItems: 'center' },
  backButtonText: { fontSize: 14, color: COLORS.textMuted, marginLeft: 8, fontWeight: '600' },

  infoSection: { alignItems: 'center', marginTop: 12 },
  featureList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 12,
  },
  featureItem: { alignItems: 'center', flex: 1 },
  featureText: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, fontWeight: '600', textAlign: 'center' },
});

export default BusinessWelcomeScreen;
