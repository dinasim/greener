import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
  Platform,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from "@expo/vector-icons";
import { useForm } from "../context/FormContext";

const cityList = [
  // ... Add your list of cities here ...
  "Tel Aviv", "Jerusalem", "Haifa", "Beer Sheva", "Eilat", "Ashdod", "Ashkelon", "Netanya", "Rishon LeZion"
  // Add full list
];

// --- Manual fallback for web/dev when expo-location fails ---
async function manualReverseGeocode(coords) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Nominatim error');
    const data = await response.json();
    const address = data.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      address.state ||
      address.country ||
      null;
    return city;
  } catch (e) {
    console.error("Manual reverse geocode failed:", e);
    return null;
  }
}

export default function SignupLocationReq({ navigation }) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [selectedCity, setSelectedCity] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const { updateFormData } = useForm();
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 10,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleCitySelect = async () => {
    if (!selectedCity) return;
    updateFormData("userLocation", { city: selectedCity });
    if (Platform.OS === "web") {
      alert(`🏙️ City Saved: ${selectedCity}`);
    } else {
      await Notifications.scheduleNotificationAsync({
        content: { title: "🏙️ City Saved", body: `Selected city: ${selectedCity}` },
        trigger: null,
      });
    }
    setTimeout(() => navigation.navigate("SignInGoogleScreen"), 300);
  };

  const handleDetectCity = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionStatus("denied");
        showMsg("❌ Location Permission Denied\nYou can still continue.", "❌ Location Permission Denied");
        setIsLocating(false);
        return;
      }

      setLocationPermissionGranted(true);

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        maximumAge: 10000,
        timeout: 15000,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      console.log("📍 Got coords:", coords);

      if (!coords.latitude || !coords.longitude) {
        showMsg("❌ Unable to get your coordinates. Try again or choose a city manually.", "Location Error");
        setIsLocating(false);
        return;
      }

      let city = null;
      try {
        const places = await Location.reverseGeocodeAsync(coords);
        console.log("📍 Reverse geocode result:", places);

        if (places && places.length > 0) {
          const place = places[0];
          city = place.city || place.subregion || place.region || place.country || null;
        } else {
          // Fallback: manual reverse geocode
          city = await manualReverseGeocode(coords);
          if (city) {
            console.log("✅ Manual reverse geocode result:", city);
          } else {
            console.log("❌ Both Expo and manual reverse geocode failed");
          }
        }
      } catch (e) {
        console.error("Reverse geocode error:", e);
        // Fallback: manual reverse geocode
        city = await manualReverseGeocode(coords);
        if (city) {
          console.log("✅ Manual reverse geocode result:", city);
        } else {
          console.log("❌ Both Expo and manual reverse geocode failed");
        }
      }

      if (city) {
        setSelectedCity(city);
        updateFormData("userLocation", { city, latitude: coords.latitude, longitude: coords.longitude });

        if (cityList.includes(city)) {
          showMsg(`📍 Location Detected: ${city}`, "📍 Location Detected");
        } else {
          showMsg(`📍 Location Detected: ${city}\n(not on list)`, "📍 Location Detected");
        }
      } else {
        showMsg(
          `⚠️ Could not determine city from your location (${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}).\nPlease select your city manually.`,
          "⚠️ No City Found"
        );
      }
    } catch (err) {
      console.error("❌ Error getting location:", err);
      showMsg("❌ Failed to get location.", "❌ Error");
    }
    setIsLocating(false);
  };

  const showMsg = async (body, title) => {
    if (Platform.OS === "web") {
      alert(body);
    } else {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Location</Text>
            <Text style={styles.subtitle}>
              Select a city or tap the <MaterialIcons name="my-location" size={18} color="#388e3c" /> icon to use your GPS for auto-detection 🌿
            </Text>
          </View>

          <View style={styles.middle}>
            <View style={styles.pickerRow}>
              <Text style={{ marginBottom: 10 }}>Choose your city:</Text>
              <TouchableOpacity
                style={styles.mapIcon}
                onPress={handleDetectCity}
                disabled={isLocating}
              >
                <MaterialIcons
                  name={isLocating ? "location-searching" : "my-location"}
                  size={28}
                  color={isLocating ? "#888" : "#388e3c"}
                />
              </TouchableOpacity>
            </View>
            <View style={{ width: "100%", position: "relative" }}>
              <Picker
                selectedValue={selectedCity}
                onValueChange={(itemValue) => setSelectedCity(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="-- Select a city --" value="" />
                {cityList.map((city) => (
                  <Picker.Item key={city} label={city} value={city} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.permissionButton} onPress={handleCitySelect}>
              <Text style={styles.buttonText}>Save City</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => navigation.navigate("SignInGoogleScreen")}
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
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  picker: {
    width: "100%",
    height: 50,
    backgroundColor: "#f4f4f4",
    borderRadius: 10,
    marginBottom: 10,
    paddingLeft: 5,
    paddingRight: 48,
  },
  mapIcon: {
    position: "absolute",
    right: 10,
    top: 0,
    zIndex: 2,
    backgroundColor: "#e8f5e9",
    borderRadius: 16,
    padding: 3,
    elevation: 3,
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
    marginTop: 10,
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
