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
  const { formData, updateFormData } = useForm();
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
      setGranted(true);

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const expoPushToken = tokenData.data;
      console.log("📱 Expo Push Token:", expoPushToken);

      updateFormData("expoPushToken", expoPushToken);

      await saveUserToBackend(expoPushToken);
      Alert.alert("Notifications Enabled ✅");
    } else {
      setGranted(false);
      Alert.alert("Permission Denied", "You can still continue, but we won't send reminders.");
    }
  };

  const saveUserToBackend = async (tokenOverride) => {
    try {
      const payload = {
        email: formData.email,
        expoPushToken: tokenOverride || formData.expoPushToken || null,
        location: formData.userLocation || null,
        name: formData.name || null,
        kids: formData.kids || null,
        animals: formData.animals || null,
        intersted: formData.intersted || null
      };

      console.log("📦 Final user payload:", payload);

      await fetch("https://<YOUR_BACKEND_URL>/api/saveUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("✅ Final user data saved to backend");
    } catch (error) {
      console.error("❌ Failed to save user at final step:", error);
    }
  };

  const handleContinue = async () => {
    if (!formData.expoPushToken) {
      console.warn("⚠️ No push token yet, not saving again.");
    } else {
      await saveUserToBackend();
    }

    navigation.navigate("SignInGoogleScreen");
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
            onPress={handleContinue}
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
