import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useForm } from "../context/FormContext";

export default function SignupReminders({ navigation }) {
  const [granted, setGranted] = useState(null);
  const { setNotificationPermissionGranted, updateFormData, formData } = useForm(); // ✅ useForm() at top level
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 10,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  const requestNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
      setNotificationPermissionGranted(true);
      setGranted(true);
      Alert.alert("Notifications Enabled ✅");
    } else {
      setNotificationPermissionGranted(false);
      setGranted(false);
      Alert.alert("Permission Denied", "You can still continue, but we won't send reminders.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Enable Notifications</Text>
            <Text style={styles.subtitle}>
              Get friendly reminders to water and care for your plants 🌱
            </Text>
          </View>

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestNotifications}
          >
            <Text style={styles.buttonText}>Enable Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: "#4caf50", marginTop: 20 }]}
            onPress={async () => {
              console.log("Continue button pressed");

              try {
                const location = formData.userLocation;
                const placement = formData.plantLocations?.[0] || "outsidePotted";

                if (location && location.latitude && location.longitude) {
                  const url = `${process.env.EXPO_PUBLIC_WEATHER_FUNCTION_URL}?code=${process.env.EXPO_PUBLIC_WEATHER_FUNCTION_KEY}`;
                  const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      latitude: location.latitude,
                      longitude: location.longitude,
                      placement: placement,
                    }),
                  });

                  const data = await response.json();
                  console.log("🌱 Weather Advice:", data);
                  Alert.alert("Weather Advice", data.advice);
                } else {
                  console.log("No location data available.");
                }
              } catch (error) {
                console.error("❌ Error fetching weather advice:", error);
              }

              navigation.navigate("MainTabs");
            }}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
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
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: "#2e7d32",
    padding: Platform.OS === "ios" ? 16 : 15,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
