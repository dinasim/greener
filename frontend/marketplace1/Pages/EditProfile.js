import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { getUser, editUserProfile } from '../services/userData';
import ActiveSells from '../components/Profile/Sells/ActiveSells';
import { AntDesign, FontAwesome5 } from '@expo/vector-icons';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState({ name: '', phoneNumber: '', email: '', avatar: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [alertShow, setAlertShow] = useState(false);

  useEffect(() => {
    getUser()
      .then(res => setUser(res.user))
      .catch(err => console.log(err));
  }, []);

  const handleDiscard = () => {
    navigation.navigate('Profile', { id: user._id });
  };

  const handleChanges = (key, value) => {
    setUser(prev => ({ ...prev, [key]: value }));
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ base64: true });

    if (!result.canceled) {
      handleChanges('avatar', result.assets[0].base64);
    }
  };

  const handleSave = async () => {
    const { _id, name, phoneNumber, email, avatar } = user;
    const obj = { name, phoneNumber, email };
    setLoading(true);

    try {
      if (avatar && typeof avatar === 'string' && !avatar.startsWith('data:')) {
        obj.avatar = `data:image/jpeg;base64,${avatar}`;
      }

      const res = await editUserProfile(_id, obj);
      if (!res.error) {
        navigation.navigate('Profile', { id: _id });
      } else {
        setLoading(false);
        setError(res.error);
        setAlertShow(true);
      }
    } catch (err) {
      console.error('edit profile err: ', err);
      Alert.alert('Error', 'Something went wrong.');
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.iconHeader}>
        <FontAwesome5 name="seedling" size={36} color="#4caf50" />
      </View>

      {alertShow && <Text style={styles.alert}>{error}</Text>}

      <View style={styles.profileContainer}>
        <TouchableOpacity onPress={pickImage}>
          {user.avatar?.startsWith('data:') ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <FontAwesome5 name="seedling" size={60} color="#4caf50" style={styles.avatarIcon} />
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Name"
          value={user.name}
          onChangeText={text => handleChanges('name', text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={user.email}
          onChangeText={text => handleChanges('email', text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={user.phoneNumber}
          onChangeText={text => handleChanges('phoneNumber', text)}
        />

        <View style={styles.buttonRow}>
          {loading ? (
            <ActivityIndicator size="large" color="#2e7d32" />
          ) : (
            <>
              <TouchableOpacity onPress={handleSave} style={styles.iconButton}>
                <AntDesign name="checkcircle" size={30} color="#2e7d32" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDiscard} style={styles.iconButton}>
                <AntDesign name="closecircle" size={30} color="#c62828" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.sellSection}>
        <Text style={styles.sectionHeading}>My Listings</Text>
        <Button title="Active Sells" disabled />
        <Button title="Archived" disabled />
        <Button title="Wishlist" disabled />
        <ActiveSells params={user} />
      </View>
    </ScrollView>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 20,
  },
  iconHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  alert: {
    color: '#b71c1c',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
    backgroundColor: '#ccc',
  },
  avatarIcon: {
    backgroundColor: '#e0f2f1',
    borderRadius: 60,
    padding: 30,
    marginBottom: 15,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 15,
  },
  iconButton: {
    padding: 10,
  },
  sellSection: {
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
});
