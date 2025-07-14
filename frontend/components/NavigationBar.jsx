import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Smaller size for compact nav
const ICON_SIZE = 19;

const TABS = [
  { key: "home", label: "Home", icon: (focused) => <MaterialIcons name="home" size={ICON_SIZE} color={focused ? "#4CAF50" : "#9E9E9E"} /> },
  { key: "plants", label: "My Plants", icon: (focused) => <Ionicons name="leaf" size={ICON_SIZE} color={focused ? "#4CAF50" : "#9E9E9E"} /> },
  { key: "ai", label: "AI Assistant", icon: (focused) => <MaterialCommunityIcons name="robot-excited" size={ICON_SIZE} color={focused ? "#FF5722" : "#9E9E9E"} /> },
  { key: "disease", label: "Disease Check", icon: (focused) => <Ionicons name="medkit" size={ICON_SIZE} color={focused ? "#E91E63" : "#9E9E9E"} /> },
  { key: "marketplace", label: "Market", icon: (focused) => <Ionicons name="cart-outline" size={ICON_SIZE} color={focused ? "#FF9800" : "#9E9E9E"} /> },
  { key: "forum", label: "Forum", icon: (focused) => <MaterialCommunityIcons name="forum" size={ICON_SIZE} color={focused ? "#2196F3" : "#9E9E9E"} /> },
];

export default function NavigationBar({ currentTab, navigation: propNavigation }) {
  const hookNavigation = useNavigation();
  
  // Use prop navigation if provided, otherwise use hook navigation
  const navigation = propNavigation || hookNavigation;

  const handleTabPress = (tabKey) => {
    // Add null check for navigation
    if (!navigation || typeof navigation.navigate !== 'function') {
      console.warn('Navigation is not available or navigate function is missing');
      return;
    }
    
    try {
      if (tabKey === 'home') navigation.navigate('Home');
      else if (tabKey === 'plants') navigation.navigate('Locations');
      else if (tabKey === 'ai') navigation.navigate('SmartPlantCareAssistant');
      else if (tabKey === 'disease') navigation.navigate('DiseaseChecker');
      else if (tabKey === 'marketplace') navigation.navigate('MainTabs');
      else if (tabKey === 'forum') navigation.navigate('PlantCareForumScreen');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <View style={styles.bottomBar}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={styles.bottomBarItem}
          onPress={() => handleTabPress(tab.key)}
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
    paddingVertical: isWeb ? 6 : 6,
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
    paddingVertical: 0,
    minWidth: 44,
  },
  bottomBarLabel: {
    fontSize: 10,
    color: "#222",
    marginTop: 1,
  },
});
