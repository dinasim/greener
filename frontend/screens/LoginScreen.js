import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
} from "react-native";

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
      <ImageBackground
        source={require("../assets/homescreen1.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <View style={styles.contentContainer}>
              <View style={styles.view1}>
                <Text style={styles.title}>Greener</Text>
                <Text style={styles.subtitle}>
                  Your chance to a more green world
                </Text>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.getStartedButton}
                    onPress={() => navigation.navigate("SignupPlantsLocation")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.getStartedText}>
                      Get started with Greener
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomContainer}>
                  <Text style={styles.signInText}>Already a member? </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("SignIn")}
                    style={styles.signInButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.signInLink}>Sign in here</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    minHeight: windowHeight,
  },
  contentContainer: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === "ios" ? 40 : 20,
    alignItems: "center",
  },
  view1: {
    position: "relative",
    minHeight: 580,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 20,
  },
  title: {
    fontSize: Platform.OS === "ios" ? 36 : 32,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 10,
    textAlign: "center",
    width: "100%",
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: Platform.OS === "ios" ? 18 : 16,
    color: "#4caf50",
    marginBottom: 40,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: "100%",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  getStartedButton: {
    backgroundColor: "#2e7d32",
    padding: Platform.OS === "ios" ? 16 : 15,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  getStartedText: {
    color: "white",
    fontSize: Platform.OS === "ios" ? 18 : 16,
    fontWeight: "600",
  },
  bottomContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    width: "100%",
    justifyContent: "center",
    paddingVertical: 10,
  },
  signInText: {
    fontSize: Platform.OS === "ios" ? 16 : 14,
    color: "#000",
  },
  signInButton: {
    padding: 8,
  },
  signInLink: {
    fontSize: Platform.OS === "ios" ? 16 : 14,
    color: "#2e7d32",
    textDecorationLine: "underline",
  },
});
