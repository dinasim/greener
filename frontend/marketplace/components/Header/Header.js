import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const Header = () => {
  const navigation = useNavigation();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    getUser().then(setUserData).catch(console.error);
  }, []);

  const featherImageUrl = 'https://images.unsplash.com/photo-1608571421747-3d96e1f1ec66?auto=format&fit=crop&w=1200&q=80';

  return (
    <ImageBackground source={{ uri: featherImageUrl }} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.navigate('Marketplace')}>
            <MaterialIcons name="home" size={30} style={styles.icon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plant Market</Text>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: '100%',
    height: '100%',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
  },
  icon: {
    color: '#fff',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default Header;
