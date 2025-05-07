import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Menu, Divider } from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Context } from '../../ContextStore';

const Header = () => {
  const { userData } = useContext(Context);
  const navigation = useNavigation();
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  return (
    <View style={styles.navbar}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <Text style={styles.brand}>Greener</Text>
      </TouchableOpacity>

      <View style={styles.navRight}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <MaterialIcons name="add-circle-outline" size={28} color="#000" />
        </TouchableOpacity>

        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={
            <TouchableOpacity onPress={openMenu}>
              <Image source={{ uri: userData.avatar }} style={styles.avatar} />
            </TouchableOpacity>
          }
        >
          <Menu.Item
            onPress={() => {
              closeMenu();
              navigation.navigate('Profile', { userId: userData._id });
            }}
            title="Profile"
            leadingIcon="account-circle"
          />
          <Menu.Item
            onPress={() => {
              closeMenu();
              navigation.navigate('Messages');
            }}
            title="Messages"
            leadingIcon="email"
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              closeMenu();
              navigation.navigate('YourProducts');
            }}
            title="My Products"
            leadingIcon="format-list-bulleted"
          />
        </Menu>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  brand: {
    fontSize: 22,
    fontFamily: 'serif',
    fontStyle: 'italic'
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBtn: {
    marginRight: 16
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    objectFit: 'cover'
  }
});

export default Header;
