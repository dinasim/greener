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
  TextInput,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from "@expo/vector-icons";
import { useForm } from "../context/FormContext";

const CITIES_API_URL = "https://usersfunctions.azurewebsites.net/api/getcities";
const ADD_CITY_API_URL = "https://usersfunctions.azurewebsites.net/api/addcity";

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
  const [selectedCity, setSelectedCity] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [saving, setSaving] = useState(false);
  const { updateFormData } = useForm();
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 10,
      friction: 3,
      useNativeDriver: true,
    }).start();
    fetchCities();
  }, []);

  const fetchCities = async () => {
    setLoadingCities(true);
    try {
      const response = await fetch(CITIES_API_URL);
      if (!response.ok) throw new Error("Failed to load cities");
      const data = await response.json();
      setCities(data || []);
    } catch (err) {
      setCities([
        "Tel Aviv", "Jerusalem", "Haifa", "Beer Sheva", "Eilat", "Ashdod", "Ashkelon", "Netanya", "Rishon LeZion"
      ]);
    }
    setLoadingCities(false);
  };

  const saveCityToDb = async (cityName) => {
    try {
      await fetch(ADD_CITY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityName }),
      });
    } catch (err) {
      // Silent error: not critical for UX
    }
  };

  // Handles "Continue" button: save and go forward
  const handleContinue = async () => {
    let city = (cityInput || selectedCity).trim();
    if (!city) return;
    setSaving(true);

    // Save to context (add geo if it was detected)
    updateFormData("userLocation", { city });

    // If new, add to list & DB
    if (!cities.includes(city)) {
      setCities(prev => [...prev, city]);
      await saveCityToDb(city);
    }
    setTimeout(() => {
      setSaving(false);
      navigation.navigate("Registration");
    }, 300);
  };

  // GPS city detection and add-if-new
  const handleDetectCity = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setIsLocating(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        maximumAge: 10000,
        timeout: 15000,
      });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      let city = null;
      try {
        const places = await Location.reverseGeocodeAsync(coords);
        if (places && places.length > 0) {
          const place = places[0];
          city = place.city || place.subregion || place.region || place.country || null;
        } else {
          city = await manualReverseGeocode(coords);
        }
      } catch (e) {
        city = await manualReverseGeocode(coords);
      }
      if (city) {
        setSelectedCity(city);
        setCityInput("");
        updateFormData("userLocation", { city, latitude: coords.latitude, longitude: coords.longitude });
        if (!cities.includes(city)) {
          setCities(prev => [...prev, city]);
          await saveCityToDb(city);
        }
      }
    } catch (err) { /* silent fail */ }
    setIsLocating(false);
  };

  // Only allow continue if city is picked or typed
  const cityReady = !!((selectedCity && !cityInput) || cityInput.trim());

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Location</Text>
            <Text style={styles.subtitle}>
              Select a city, enter your city, or tap the <MaterialIcons name="my-location" size={18} color="#388e3c" /> icon to use GPS 🌿
            </Text>
          </View>
          <View style={styles.middle}>
            <View style={styles.pickerRow}>
              <Text style={{ marginBottom: 10 }}>Choose your city:</Text>
              <TouchableOpacity style={styles.mapIcon} onPress={handleDetectCity} disabled={isLocating}>
                <MaterialIcons
                  name={isLocating ? "location-searching" : "my-location"}
                  size={28}
                  color={isLocating ? "#888" : "#388e3c"}
                />
              </TouchableOpacity>
            </View>
            {loadingCities ? (
              <ActivityIndicator style={{ marginTop: 10 }} color="#388e3c" />
            ) : (
              <View style={{ width: "100%", position: "relative" }}>
                <Picker
                  selectedValue={selectedCity}
                  onValueChange={(itemValue) => {
                    setSelectedCity(itemValue);
                    setCityInput("");
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="-- Select a city --" value="" />
                  {cities.map((city) => (
                    <Picker.Item key={city} label={city} value={city} />
                  ))}
                </Picker>
              </View>
            )}

            <Text style={{ marginTop: 16, marginBottom: 4, alignSelf: 'flex-start' }}>Or type your city:</Text>
            <TextInput
              value={cityInput}
              onChangeText={(text) => {
                setCityInput(text);
                setSelectedCity("");
              }}
              placeholder="Enter city name"
              style={styles.manualInput}
            />
          </View>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !cityReady && { opacity: 0.5 }]}
          onPress={handleContinue}
          disabled={!cityReady || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.nextButtonText}>Continue</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  container: { flex: 1, padding: 20 },
  header: { marginTop: 40, marginBottom: 30 },
  title: { fontSize: 28, fontWeight: "bold", color: "#2e7d32", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center" },
  middle: { alignItems: "center", marginTop: 30 },
  pickerRow: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 8 },
  picker: { width: "100%", height: 50, backgroundColor: "#f4f4f4", borderRadius: 10, marginBottom: 10, paddingLeft: 5, paddingRight: 48 },
  mapIcon: { position: "absolute", right: 10, top: 0, zIndex: 2, backgroundColor: "#e8f5e9", borderRadius: 16, padding: 3, elevation: 3 },
  manualInput: { width: "100%", height: 48, borderColor: "#ccc", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: "#f4f4f4", fontSize: 16, color: "#222" },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#e0e0e0" },
  nextButton: { backgroundColor: "#2e7d32", padding: 16, borderRadius: 12, alignItems: "center" },
  nextButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
