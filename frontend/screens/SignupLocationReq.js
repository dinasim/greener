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
  TextInput,
} from "react-native";
import * as Location from "expo-location";
import { useForm } from "../context/FormContext";

export default function SignupLocationReq({ navigation }) {
  const scaleAnim = new Animated.Value(0.95);
  const [typedLocation, setTypedLocation] = useState("");
  const [permissionStatus, setPermissionStatus] = useState(null);
  const { updateFormData, setLocationPermissionGranted } = useForm();

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
      updateFormData("userLocation", {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setLocationPermissionGranted(true);
      Alert.alert("Location access granted ✅", `Lat: ${location.coords.latitude}, Lon: ${location.coords.longitude}`);
    } else {
      setPermissionStatus("denied");
      Alert.alert("Permission Denied", "Location access is optional. You can still continue.");
    }
  };

  const saveTypedLocation = () => {
    if (!typedLocation.trim()) {
      Alert.alert("Please enter a valid location");
      return;
    }
    updateFormData("typedLocation", typedLocation.trim());
    Alert.alert("Location Saved", typedLocation.trim());
  };

  const continueToNext = () => {
    navigation.navigate("SignupReminders");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose How to Provide Location</Text>
            <Text style={styles.subtitle}>Use this to receive weather-based plant care tips 🌿</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Enter your city, country"
            value={typedLocation}
            onChangeText={setTypedLocation}
          />

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={saveTypedLocation}
          >
            <Text style={styles.buttonText}>Save Location</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestLocationPermission}
          >
            <Text style={styles.buttonText}>Use Current Location</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={continueToNext}>
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
  input: {
    borderColor: "#ccc",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
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
