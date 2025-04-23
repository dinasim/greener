import React, { useEffect } from "react";
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
    id: "kids",
    title: "Small kids at home",
    description: "Do you have small children living with you?",
    field: "kids",
    choices: [
      { id: "yes_kids", label: "Yes" },
      { id: "no_kids", label: "No" },
    ],
  },
  {
    id: "animals",
    title: "Pets at home",
    description: "Do you have any pets living with you?",
    field: "animals",
    choices: [
      { id: "yes_animals", label: "Yes" },
      { id: "no_animals", label: "No" },
    ],
  },
];

export default function KidsAnimalsScreen({ navigation }) {
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

  const handleSelection = (field, value) => {
    updateFormData(field, value);
  };

  const isSelected = (field, value) => formData[field] === value;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView}>
        <Animated.View
          style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Home Environment</Text>
            <Text style={styles.subtitle}>
              Let us know about your household to inform you about pet-unsafe and kid-unfriendly plants
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {options.map((option) => (
              <View key={option.id} style={styles.questionContainer}>
                <Text style={styles.questionTitle}>{option.title}</Text>
                <Text style={styles.questionDescription}>{option.description}</Text>
                
                <View style={styles.choiceContainer}>
                  {option.choices.map((choice) => (
                    <TouchableOpacity
                      key={choice.id}
                      style={[
                        styles.choiceButton,
                        isSelected(option.field, choice.label) && styles.choiceSelected,
                      ]}
                      onPress={() => handleSelection(option.field, choice.label)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          isSelected(option.field, choice.label) && styles.choiceTextSelected,
                        ]}
                      >
                        {choice.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => navigation.navigate("SignupLocationReq")}
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
  questionContainer: {
    marginBottom: 32,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2e7d32",
    marginBottom: 4,
  },
  questionDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  choiceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  choiceButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  choiceSelected: {
    borderColor: "#2e7d32",
    backgroundColor: "#f1f8e9",
  },
  choiceText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  choiceTextSelected: {
    color: "#2e7d32",
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