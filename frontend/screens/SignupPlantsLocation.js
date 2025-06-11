import React, { useContext, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useForm } from "../context/FormContext";

const options = [
  {
    id: "indoor",
    title: "Indoor, potted",
    description: "Plants kept inside your home in pots",
  },
  {
    id: "outdoor-pot",
    title: "Outdoor, potted",
    description: "Plants in containers outside",
  },
  {
    id: "outdoor-ground",
    title: "Outdoor in ground",
    description: "Plants growing directly in your garden",
  },
];

export default function PlantLocationScreen({ navigation }) {
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

  const toggleOption = (option) => {
    const current = formData.plantLocations || [];
    const updated = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];

    updateFormData("plantLocations", updated);
  };

  const isSelected = (option) => formData.plantLocations?.includes(option);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView}>
        <Animated.View
          style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Where are your plants located?</Text>
            <Text style={styles.subtitle}>Select all that apply</Text>
          </View>

          <View style={styles.optionsContainer}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.option,
                  isSelected(option.title) && styles.selected,
                ]}
                onPress={() => toggleOption(option.title)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionTitle,
                      isSelected(option.title) && styles.selectedText,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    isSelected(option.title) && styles.checkboxSelected,
                  ]}
                >
                  {isSelected(option.title) && (
                    <View style={styles.checkboxInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!formData.plantLocations || formData.plantLocations.length === 0) && { backgroundColor: "#bdbdbd" }
          ]}
          // Disable the button if nothing is selected
          onPress={() => {
            if (formData.plantLocations && formData.plantLocations.length > 0) {
              navigation.navigate("SignupIntersted");
            }
          }}
          activeOpacity={(!formData.plantLocations || formData.plantLocations.length === 0) ? 1 : 0.7}
          disabled={!formData.plantLocations || formData.plantLocations.length === 0}
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
  optionsContainer: {
    marginBottom: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  selected: {
    borderColor: "#2e7d32",
    backgroundColor: "#f1f8e9",
  },
  optionContent: {
    flex: 1,
    marginRight: 15,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: "#666",
  },
  selectedText: {
    color: "#2e7d32",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#2e7d32",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#2e7d32",
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
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
