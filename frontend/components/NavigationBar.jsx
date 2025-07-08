import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// List of navigation tabs, each with key, label, and icon.
const TABS = [
  { key: "home", label: "Home", icon: (focused) => <MaterialIcons name="home" size={26} color={focused ? "#4CAF50" : "#222"} /> },
  { key: "plants", label: "My Plants", icon: (focused) => <Ionicons name="leaf" size={26} color={focused ? "#4CAF50" : "#222"} /> },
  { key: "ai", label: "AI Assistant", icon: (focused) => <MaterialCommunityIcons name="robot-excited" size={26} color={focused ? "#FF5722" : "#222"} /> },
  { key: "disease", label: "Disease Check", icon: (focused) => <Ionicons name="medkit" size={26} color={focused ? "#E91E63" : "#222"} /> },
  { key: "marketplace", label: "Market", icon: (focused) => <Ionicons name="cart-outline" size={26} color={focused ? "#FF9800" : "#222"} /> },
  { key: "forum", label: "Forum", icon: (focused) => <MaterialCommunityIcons name="forum" size={26} color={focused ? "#2196F3" : "#222"} /> },
];

export default function NavigationBar({ currentTab, onTabPress }) {
  return (
    <View style={styles.bottomBar}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={styles.bottomBarItem}
          onPress={() => onTabPress(tab.key)}
          activeOpacity={0.7}
        >
          {tab.icon(currentTab === tab.key)}
          <Text style={[
            styles.bottomBarLabel,
            currentTab === tab.key && { color: "#4CAF50", fontWeight: "700" }
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e8f5e8",
    paddingVertical: isWeb ? 12 : 8,
    elevation: 20,
    ...(!isWeb ? {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.13,
      shadowRadius: 9,
    } : {
      boxShadow: "0 -2px 12px rgba(76,175,80,0.07)",
    }),
    zIndex: 100,
  },
  bottomBarItem: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 2,
    minWidth: 60,
  },
  bottomBarLabel: {
    fontSize: 12,
    color: "#222",
    marginTop: 2,
  },
});
