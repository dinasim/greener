import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  SafeAreaView, ScrollView, Animated, Platform
} from "react-native";
import { useForm } from "../context/FormContext";

export default function SignupReminders({ navigation }) {
  const [granted, setGranted] = useState(null);
  const { formData } = useForm();
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 10,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (formData.email) {
      console.log("✅ Email available:", formData.email);
      requestWebPush(); // trigger registration once email is ready
    } else {
      console.log("⏳ Waiting for formData.email...");
    }
  }, [formData.email]);

  const requestWebPush = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Web Push Only", "Browser push notifications only work on web browsers.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      Alert.alert("Not supported", "Web Push API is not supported in this browser.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setGranted(false);
        Alert.alert("Permission Denied", "You can still continue, but we won't send reminders.");
        return;
      }
      setGranted(true);

      const swReg = await navigator.serviceWorker.register("/sw.js");
      const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_KEY;
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      await saveSubscriptionToBackend(subscription);
      Alert.alert("Notifications Enabled ✅");
    } catch (err) {
      console.error("Push subscription error:", err);
      Alert.alert("Error", "Failed to subscribe for notifications.");
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const saveSubscriptionToBackend = async (subscription) => {
    try {
      const sub = subscription.toJSON();
      const payload = {
        installationId: formData.email,
        platform: "browser",
        pushChannel: {
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        tags: [`user:${formData.email}`, "plant-owner", "browser"],
      };

      console.log("📦 Payload being sent to backend:", payload);

      const response = await fetch("https://usersfunctions.azurewebsites.net/api/registerWebPush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("✅ Response status:", response.status);
      const responseText = await response.text();
      console.log("📨 Response text:", responseText);
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
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scrollView: { flex: 1 },
  container: { flex: 1, padding: 20 },
  header: { marginTop: 40, marginBottom: 30 },
  title: {
    fontSize: 28, fontWeight: "bold", color: "#2e7d32", marginBottom: 8, textAlign: "center"
  },
  subtitle: {
    fontSize: 16, color: "#666", textAlign: "center", marginBottom: 30
  },
  permissionButton: {
    backgroundColor: "#2e7d32",
    padding: Platform.OS === "ios" ? 16 : 15,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#fff", fontSize: 16, fontWeight: "600",
  },
});
