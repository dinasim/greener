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
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Picker } from '@react-native-picker/picker';
import { useForm } from "../context/FormContext";

const cityList = ['Acre', 'Afula', 'Arad', 'Arraba', 'Ashdod', 'Ashkelon', 'Baqa al-Gharbiyye', 'Bat Yam', 'Beersheba',
                 "Beit She'an", 'Beit Shemesh', 'Bnei Brak', 'Dimona', 'Eilat', "El'ad", "Giv'at Shmuel", 'Givatayim', 
                 'Hadera', 'Haifa', 'Herzliya', 'Hod HaSharon', 'Holon', 'Jerusalem', 'Kafr Qasim', 'Karmiel', 'Kfar Saba',
                 'Kfar Yona', 'Kiryat Ata', 'Kiryat Bialik', 'Kiryat Gat', 'Kiryat Malakhi', 'Kiryat Motzkin', 'Kiryat Ono', 
                 'Kiryat Shmona', 'Kiryat Yam', 'Lod', "Ma'alot-Tarshiha", 'Migdal HaEmek', "Modi'in-Maccabim-Re'ut", 'Nahariya',
                 'Nazareth', 'Nesher', 'Ness Ziona', 'Netanya', 'Netivot', 'Nof HaGalil', 'Ofakim', 'Or Akiva', 'Or Yehuda', 
                 'Petah Tikva', 'Qalansawe', "Ra'anana", 'Rahat', 'Ramat Gan', 'Ramat HaSharon', 'Ramla', 'Rehovot', 'Rishon LeZion',
                 'Rosh HaAyin', 'Safed', 'Sakhnin', 'Sderot', "Shefa-'Amr", 'Tamra', 'Tayibe', 'Tel Aviv-Yafo', 'Tiberias', 'Tira',
                 'Tirat Carmel', 'Umm al-Fahm', 'Yavne', 'Yehud-Monosson', 'Yokneam Illit'];

export default function SignupLocationReq({ navigation }) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [selectedCity, setSelectedCity] = useState("");
  const { updateFormData, setLocationPermissionGranted } = useForm();
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
      try {
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setLocationPermissionGranted(true);
        updateFormData("userLocation", coords);

        // Reverse geocode to get city
        const [place] = await Location.reverseGeocodeAsync(coords);
        const city = place?.city || place?.region || null;

        if (city) {
          updateFormData("userLocation", { ...coords, city });

          const message = `📍 Location Detected: ${city}`;
          if (Platform.OS === "web") {
            alert(message);
          } else {
            await Notifications.scheduleNotificationAsync({
              content: { title: "📍 Location Detected", body: `You are in ${city}` },
              trigger: null,
            });
          }
        } else {
          if (Platform.OS === "web") {
            alert("⚠️ Could not determine city from location.");
          } else {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "⚠️ Location Accessed",
                body: "Could not determine city from your location.",
              },
              trigger: null,
            });
          }
        }

        console.log("📬 Location and (maybe) city saved");
      } catch (error) {
        console.error("❌ Error getting location:", error);
        if (Platform.OS === "web") {
          alert("❌ Failed to get location.");
        } else {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "❌ Error",
              body: "Something went wrong getting your location.",
            },
            trigger: null,
          });
        }
      }
    } else {
      setPermissionStatus("denied");
      if (Platform.OS === "web") {
        alert("❌ Location Permission Denied\nYou can still continue.");
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "❌ Location Permission Denied",
            body: "You can still continue.",
          },
          trigger: null,
        });
      }

      console.log("📬 Denial message sent");
    }
  };

  const handleCitySelect = async () => {
    if (!selectedCity) return;
    // This is where you would implement actual geocoding for city names
    updateFormData("userLocation", { city: selectedCity });

    if (Platform.OS === "web") {
      alert(`🏙️ City Saved: ${selectedCity}`);
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🏙️ City Saved",
          body: `Selected city: ${selectedCity}`,
        },
        trigger: null,
      });
    }
    console.log("📬 Notification should have been triggered");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Location</Text>
            <Text style={styles.subtitle}>
              Select a city or allow location access to receive tailored plant care 🌿
            </Text>
          </View>

          <View style={styles.middle}>
            <Text style={{ marginBottom: 10 }}>Choose your city:</Text>
            <Picker
              selectedValue={selectedCity}
              onValueChange={(itemValue) => setSelectedCity(itemValue)}
              style={{ width: "100%", height: 50 }}
            >
              <Picker.Item label="-- Select a city --" value="" />
              {cityList.map((city) => (
                <Picker.Item key={city} label={city} value={city} />
              ))}
            </Picker>
            <TouchableOpacity style={styles.permissionButton} onPress={handleCitySelect}>
              <Text style={styles.buttonText}>Save City</Text>
            </TouchableOpacity>

            <View style={{ marginVertical: 20 }} />

            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: "#4caf50" }]}
              onPress={requestLocationPermission}
            >
              <Text style={styles.buttonText}>Use My Location</Text>
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
