// frontend/screens/Business/BusinessWelcomeScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';

const BusinessWelcomeScreen = ({ navigation }) => {
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
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('BusinessSignUpScreen')}
              >
                <Text style={styles.buttonText}>Create Business Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.outlineButton]}
                onPress={() => navigation.navigate('BusinessSignInScreen')}
              >
                <Text style={styles.outlineButtonText}>Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.navigate('PersonaSelection')}
              >
                <MaterialIcons name="arrow-back" size={16} color="#777" />
                <Text style={styles.backButtonText}>Switch to consumer</Text>
              </TouchableOpacity>
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
  },
  subtitle: {
    fontSize: 16,
    color: "#4caf50",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '90%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderColor: '#2e7d32',
    borderWidth: 1,
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
  },
  backButtonText: {
    fontSize: 14,
    color: "#777",
    marginLeft: 8,
  },
});

export default BusinessWelcomeScreen;