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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useForm } from "../context/FormContext";
import LocationPicker from "../marketplace/components/LocationPicker";

export default function SignupLocationReq({ navigation }) {
  const [saving, setSaving] = useState(false);
  const { updateFormData } = useForm();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 10,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleLocationChange = (location) => {
    console.log('📍 Location selected:', location);
    setSelectedLocation(location);
    
    // Update form data with the complete location object
    updateFormData("userLocation", {
      city: location.city || '',
      street: location.street || '',
      houseNumber: location.houseNumber || '',
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      formattedAddress: location.formattedAddress || '',
      country: location.country || 'Israel'
    });
  };

  const handleContinue = async () => {
    if (!selectedLocation || !selectedLocation.city) {
      return; // LocationPicker handles validation
    }
    
    setSaving(true);
    
    try {
      console.log('💾 Saving location to form context:', selectedLocation);
      
      // Small delay for UX
      setTimeout(() => {
        setSaving(false);
        navigation.navigate("Registration");
      }, 300);
    } catch (error) {
      console.error('Error saving location:', error);
      setSaving(false);
    }
  };

  // Check if location is ready for continue
  const locationReady = selectedLocation && selectedLocation.city;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Location</Text>
            <Text style={styles.subtitle}>
              Help us provide personalized plant care advice for your area 🌿
            </Text>
          </View>
          
          <View style={styles.locationSection}>
            <LocationPicker
              value={selectedLocation}
              onChange={handleLocationChange}
              required={true}
              showConfirmButton={false} // We'll handle confirmation with our own button
              alwaysShowMap={true}
              placeholder="Enter your location in Israel"
              showToastFeedback={true}
            />
          </View>
        </Animated.View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !locationReady && { opacity: 0.5 }]}
          onPress={handleContinue}
          disabled={!locationReady || saving}
        >
          {saving ? (
            <View style={styles.loadingContainer}>
              <MaterialIcons name="check-circle" size={20} color="#fff" />
              <Text style={styles.nextButtonText}>Saving...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.nextButtonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: { 
    flex: 1 
  },
  container: { 
    flex: 1, 
    padding: 20 
  },
  header: { 
    marginTop: 40, 
    marginBottom: 30 
  },
  title: { 
    fontSize: 28, 
    fontWeight: "bold", 
    color: "#2e7d32", 
    marginBottom: 8, 
    textAlign: "center" 
  },
  subtitle: { 
    fontSize: 16, 
    color: "#666", 
    textAlign: "center",
    lineHeight: 22,
  },
  locationSection: {
    flex: 1,
    marginTop: 20,
  },
  footer: { 
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: "#e0e0e0",
    backgroundColor: '#fff',
  },
  nextButton: { 
    backgroundColor: "#2e7d32", 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
  },
  nextButtonText: { 
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "600",
    marginHorizontal: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
