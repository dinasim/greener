// LoginScreen.js - Enhanced UI
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';

const windowHeight = Dimensions.get("window").height;

export default function LoginScreen({ navigation }) {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locations, setLocations] = useState({
    insidePotted: false,
    outsidePotted: false,
    outsideGround: false,
  });

  const toggleLocation = (location) => {
    setLocations((prev) => ({
      ...prev,
      [location]: !prev[location],
    }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <View style={styles.overlay}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <View style={styles.contentContainer}>
              <Ionicons name="leaf" size={42} color="#2e7d32" style={{ marginBottom: 10 }} />
              <Text style={styles.title}>Greener</Text>
              <Text style={styles.subtitle}>
                Your chance to a more green world
              </Text>

              <TouchableOpacity
                style={styles.getStartedButton}
                onPress={() => navigation.navigate("SignupPlantsLocation")}
                activeOpacity={0.85}
              >
                <Text style={styles.getStartedText}>Get started with Greener</Text>
              </TouchableOpacity>

              <View style={styles.bottomContainer}>
                <Text style={styles.signInText}>Already a member? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("LoginUser")}
                  style={styles.signInButton}
                >
                  <Text style={styles.signInLink}>Sign in here</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    minHeight: windowHeight,
  },
  contentContainer: {
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: "#4caf50",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  getStartedButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 30,
    marginTop: 10,
    elevation: 4,
  },
  getStartedText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
  signInText: {
    fontSize: 14,
    color: "#333",
  },
  signInButton: {
    paddingHorizontal: 6,
  },
  signInLink: {
    fontSize: 14,
    color: "#2e7d32",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});