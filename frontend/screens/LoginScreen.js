import React from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';

export default function WelcomeScreen({ navigation }) {
  return (
    <ImageBackground
      source={require('../assets/homescreen1.png')} // Make sure this image exists!
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Greener</Text>
        <Text style={styles.subtitle}>Your chance to a more green world</Text>

        <View style={styles.buttonContainer}>
          {/* Green button for "Get Started" */}
          <Button 
            title="Get started with Greener" 
            onPress={() => navigation.navigate('SignUp')} 
            color="#2e7d32" // Green button
          />
        </View>

        {/* Bottom part with blue text for "Sign in" */}
        <View style={styles.bottomContainer}>
          <Text style={styles.signInText}>Already a member? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.signInLink}>Sign in here</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)', // Add opacity overlay to maintain readability
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2e7d32',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    color: '#4caf50',
  },
  buttonContainer: {
    marginBottom: 15,
  },
  bottomContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 16,
    color: '#000', // Black text for "Already a member?"
  },
  signInLink: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
