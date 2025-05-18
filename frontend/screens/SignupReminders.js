import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, ScrollView, Animated, Platform
} from "react-native";
import { useForm } from "../context/FormContext";

// You need to have the Service Worker (sw.js) set up in your public/ directory!

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

  // Request browser push permission and register Service Worker
  const requestWebPush = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Web Push Only", "Push notifications via Azure only work on web browsers.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      Alert.alert("Not supported", "Web Push API not supported in this browser.");
      return;
    }
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setGranted(false);
        Alert.alert("Permission Denied", "You can still continue, but we won't send reminders.");
        return;
      }
      setGranted(true);

      // Register the service worker
      const swReg = await navigator.serviceWorker.register("/sw.js");
      // (You must generate and use your VAPID public key from Azure Notification Hubs setup!)
      const vapidPublicKey = "<YOUR_VAPID_PUBLIC_KEY>"; // Base64 string from Azure setup
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Save to backend
      await saveSubscriptionToBackend(subscription);

      Alert.alert("Notifications Enabled ✅");

    } catch (err) {
      console.error("Push subscription error:", err);
      Alert.alert("Error", "Failed to subscribe for notifications.");
    }
  };

  // Utility to convert base64 key
  function urlBase64ToUint8Array(base64String) {
    // code for converting (as in Azure docs)
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Send subscription to backend
  const saveSubscriptionToBackend = async (subscription) => {
    try {
      const payload = {
        email: formData.email,
        subscription, // send the whole subscription object
        // ...other form fields as needed
      };

      await fetch("https://<YOUR_BACKEND_URL>/api/registerWebPush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Web Push subscription sent to backend.");
    } catch (error) {
      console.error("❌ Failed to save subscription:", error);
    }
  };

  const handleContinue = () => {
    navigation.navigate("SignInGoogleScreen");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Enable Browser Notifications</Text>
            <Text style={styles.subtitle}>
              Get reminders to water and care for your plants 🌱
            </Text>
          </View>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestWebPush}
          >
            <Text style={styles.buttonText}>Enable Browser Notifications</Text>
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
