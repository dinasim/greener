import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const ICON_SIZE = 20;

const TABS = [
  { key: 'home',        label: 'Home',     icon: 'home-outline',           activeColor: '#4CAF50' },
  { key: 'plants',      label: 'My Plants',icon: 'leaf',                    activeColor: '#4CAF50' },
  { key: 'ai',          label: 'AI',       icon: 'robot-outline',          activeColor: '#FF7043' },
  { key: 'disease',     label: 'Disease',  icon: 'medical-bag',            activeColor: '#E91E63' },
  { key: 'marketplace', label: 'Market',   icon: 'cart-outline',           activeColor: '#FF9800' },
  { key: 'forum',       label: 'Forum',    icon: 'forum-outline',          activeColor: '#2196F3' },
];

export default function NavigationBar({
  currentTab,
  navigation: propNavigation,
  onTabPress, // optional override
}) {
  const hookNavigation = useNavigation();
  const navigation = propNavigation || hookNavigation;

  const defaultNavigate = (tabKey) => {
    if (!navigation || typeof navigation.navigate !== 'function') return;
    switch (tabKey) {
      case 'home':        navigation.navigate('Home'); break;
      case 'plants':      navigation.navigate('Locations'); break;
      case 'ai':          navigation.navigate('SmartPlantCareAssistant'); break;
      case 'marketplace': navigation.navigate('MainTabs'); break;
      case 'disease':     navigation.navigate('DiseaseChecker', { fromBusiness: false }); break;
      case 'forum':       navigation.navigate('PlantCareForumScreen', { fromBusiness: false }); break;
      default: break;
    }
  };

  const handlePress = (tabKey) => {
    if (typeof onTabPress === 'function') onTabPress(tabKey);
    else defaultNavigate(tabKey);
  };

  return (
    <View style={styles.bar} accessible accessibilityRole="tablist">
      {TABS.map((tab) => {
        const focused = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.item, focused && styles.itemFocused]}
            onPress={() => handlePress(tab.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={ICON_SIZE}
                color={focused ? tab.activeColor : '#9E9E9E'}
              />
            </View>
            <Text style={[styles.label, focused && { color: tab.activeColor }]}>
              {tab.label}
            </Text>
            {focused ? <View style={[styles.dot, { backgroundColor: tab.activeColor }]} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E8F2EA',
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    ...(!isWeb
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 10,
        }
      : { boxShadow: '0 -4px 14px rgba(0,0,0,0.05)' }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  itemFocused: {
    // give a subtle pill effect behind the icon+label
  },
  iconWrap: {
    padding: 8,
    borderRadius: 16,
  },
  iconWrapFocused: {
    backgroundColor: '#EDF7EE',
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    color: '#4A4A4A',
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
});
