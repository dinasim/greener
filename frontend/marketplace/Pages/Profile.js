import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

import { getUserById } from '../services/userData';
import ProfileSection from '../components/Profile/ProfileSection';
import Wishlist from '../components/Profile/Wishlist/Wishlist';
import ActiveSells from '../components/Profile/Sells/ActiveSells';
import ArchivedSells from '../components/Profile/Sells/ArchivedSells';
import SellerProfile from '../components/Profile/SellerProfile';

export default function ProfileScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const userId = route.params?.id;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [active, setActive] = useState(true);
  const [archived, setArchived] = useState(false);
  const [wishlist, setWishlist] = useState(false);
  const [user, setUser] = useState({});

  useEffect(() => {
    getUserById(userId)
      .then(res => setUser(res.user))
      .catch(err => console.error(err));
  }, [userId]);

  const handleView = (type) => {
    setActive(type === 'active');
    setArchived(type === 'archived');
    setWishlist(type === 'wishlist');
  };

  if (!user._id) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {user.isMe ? (
        <>
          <ProfileSection params={user} />
          <View style={[styles.content, isWide && styles.row]}>
            <View style={isWide ? styles.sidebar : styles.sidebarMobile}>
              <TouchableOpacity
                style={[styles.button, active && styles.buttonActive]}
                onPress={() => handleView('active')}
              >
                <Text style={styles.buttonText}>Active Sells</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, archived && styles.buttonActive]}
                onPress={() => handleView('archived')}
              >
                <Text style={styles.buttonText}>Archived</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, wishlist && styles.buttonActive]}
                onPress={() => handleView('wishlist')}
              >
                <Text style={styles.buttonText}>Wishlist</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mainContent}>
              {active && <ActiveSells params={user} />}
              {archived && <ArchivedSells navigation={navigation} />}
              {wishlist && <Wishlist />}
            </View>
          </View>
        </>
      ) : (
        <SellerProfile params={user} navigation={navigation} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    marginTop: 10,
  },
  sidebar: {
    width: 140,
    marginRight: 16,
  },
  sidebarMobile: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
  },
  buttonActive: {
    backgroundColor: '#444',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
  },
});
