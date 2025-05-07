import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
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
        <TouchableOpacity onPress={() => openLink('https://www.linkedin.com/in/iva-tosheva/')}>
          <AntDesign name="linkedin-square" style={styles.linkedIcon} />
        </TouchableOpacity>
      </View>
      <Text style={styles.text}>
        All Rights Reserved © 2021 •{' '}
        <Text
          style={styles.link}
          onPress={() => openLink('https://github.com/dinasim/greener')}
        >
          GitHub
        </Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    padding: 16,
    backgroundColor: '#f7f7f7',
    alignItems: 'center',
    marginTop: '5%'
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12
  },
  instaIcon: {
    fontSize: 35,
    color: '#727272',
    marginHorizontal: 7
  },
  fbIcon: {
    fontSize: 30,
    color: '#727272',
    marginHorizontal: 7
  },
  linkedIcon: {
    fontSize: 34,
    color: '#727272',
    marginHorizontal: 7
  },
  text: {
    color: 'gray',
    fontSize: 14,
    textAlign: 'center'
  },
  link: {
    color: '#000000c2',
    textDecorationLine: 'underline'
  }
});

export default Footer;
