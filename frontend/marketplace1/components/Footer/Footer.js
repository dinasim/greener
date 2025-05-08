import React from 'react';
import { View, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; // For Facebook
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'; // For Instagram
import AntDesign from 'react-native-vector-icons/AntDesign'; // For LinkedIn

const Footer = () => {
  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Couldn't open link:", err));
  };

  return (
    <View style={styles.footer}>
      <View style={styles.iconRow}>
        <TouchableOpacity onPress={() => openLink('https://www.instagram.com')}>
          <MaterialCommunityIcons name="instagram" style={styles.instaIcon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLink('https://www.facebook.com')}>
          <Icon name="facebook" style={styles.fbIcon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLink('https://www.linkedin.com')}>
          <AntDesign name="linkedin" style={styles.linkedInIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    backgroundColor: '#333',
    padding: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '80%',
  },
  instaIcon: {
    color: '#fff',
    fontSize: 30,
  },
  fbIcon: {
    color: '#fff',
    fontSize: 30,
  },
  linkedInIcon: {
    color: '#fff',
    fontSize: 30,
  },
});

export default Footer;
