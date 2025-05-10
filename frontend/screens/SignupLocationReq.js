import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
  Alert,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { useForm } from "../context/FormContext";

export default function SignupLocationReq({ navigation }) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const { setLocationPermissionGranted, updateFormData } = useForm();
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 10,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const location = await Location.getCurrentPositionAsync({});
      setPermissionStatus("granted");
      setLocationPermissionGranted(true); // ✅ Track it globally
      updateFormData("userLocation", {     // ✅ Save coords for later use
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // You can now use location.coords.latitude & longitude
      console.log("📍 Location saved:", location.coords);

      // TODO: Send to backend or store in context for next steps
      // Example: saveLocation(location.coords.latitude, location.coords.longitude);

      Alert.alert("Location access granted ✅");
    } else {
      setPermissionStatus("denied");
      Alert.alert(
        "Permission Denied",
        "Location access is optional. You can still continue."
      );
    }
  };

  const continueToNext = () => {
    navigation.navigate("SignupReminders");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Allow Location Access</Text>
            <Text style={styles.subtitle}>
              We use your location to recommend the best plants for your area 🌱
            </Text>
          </View>

          <View style={styles.middle}>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestLocationPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Enable Location Access</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => navigation.navigate("SignupReminders")}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  middle: {
    alignItems: "center",
    marginTop: 30,
  },
  permissionButton: {
    backgroundColor: "#2e7d32",
    padding: Platform.OS === "ios" ? 16 : 15,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  nextButton: {
    backgroundColor: "#2e7d32",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
