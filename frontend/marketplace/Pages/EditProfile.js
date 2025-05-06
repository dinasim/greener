import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getUser, editUserProfile } from '../services/userData';
import ActiveSells from '../components/Profile/Sells/ActiveSells';

export default function EditProfileScreen() {
  const navigation = useNavigation();

  const [user, setUser] = useState({
    _id: '',
    name: '',
    email: '',
    phoneNumber: '',
    avatar: '',
  });

  const [newAvatarBase64, setNewAvatarBase64] = useState(null);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUser()
      .then(res => setUser(res.user))
      .catch(err => console.error('Fetch user error:', err));
  }, []);

  const handleChange = (key, value) => {
    setUser(prev => ({ ...prev, [key]: value }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.cancelled) {
      setNewAvatarBase64(result.base64);
      setLocalAvatarUri(result.uri);
    }
  };

  const handleSave = async () => {
    const { _id, name, email, phoneNumber } = user;
    if (!name || !email || !phoneNumber) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }

    const payload = { name, email, phoneNumber };
    if (newAvatarBase64) {
      payload.avatar = `data:image/jpeg;base64,${newAvatarBase64}`;
    }

    try {
      setLoading(true);
      const res = await editUserProfile(_id, payload);
      if (res.error) {
        Alert.alert('Error', res.error.toString());
      } else {
        navigation.navigate('UserProfile', { id: _id });
      }
    } catch (err) {
      console.error('Edit profile error:', err);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    navigation.navigate('UserProfile', { id: user._id });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Edit Profile</Text>

      <TouchableOpacity onPress={pickImage}>
        <Image
          source={{
            uri: localAvatarUri || user.avatar || 'https://via.placeholder.com/150',
          }}
          style={styles.avatar}
        />
        <Text style={styles.changeAvatarText}>Tap to change avatar</Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Name"
        style={styles.input}
        value={user.name}
        onChangeText={val => handleChange('name', val)}
      />

      <TextInput
        placeholder="Email"
        style={styles.input}
        keyboardType="email-address"
        value={user.email}
        onChangeText={val => handleChange('email', val)}
      />

      <TextInput
        placeholder="Phone Number"
        style={styles.input}
        keyboardType="phone-pad"
        value={user.phoneNumber}
        onChangeText={val => handleChange('phoneNumber', val)}
      />

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Button title="Save Changes" onPress={handleSave} />
          <View style={{ height: 10 }} />
          <Button title="Discard Changes" onPress={handleDiscard} color="gray" />
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Sells</Text>
        <ActiveSells params={user} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 10,
  },
  changeAvatarText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
});
