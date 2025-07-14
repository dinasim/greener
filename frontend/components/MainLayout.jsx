// MainLayout.js
import React from "react";
import { View, StyleSheet } from "react-native";
import NavigationBar from "./NavigationBar";

// Make sure you accept the navigation prop here
export default function MainLayout({ children, currentTab, navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
      <NavigationBar currentTab={currentTab} navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1 },
});
