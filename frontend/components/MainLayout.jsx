import React from "react";
import { View, StyleSheet } from "react-native";
import NavigationBar from "./NavigationBar";

export default function MainLayout({ children, currentTab, onTabPress }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
      <NavigationBar currentTab={currentTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1 },
});
