import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import IconEdit from 'react-native-vector-icons/Feather';
import IconPerson from 'react-native-vector-icons/FontAwesome';
import IconEmail from 'react-native-vector-icons/MaterialCommunityIcons';
import IconPhone from 'react-native-vector-icons/MaterialIcons';
import IconSell from 'react-native-vector-icons/FontAwesome5';

const ProfileSection = ({ params }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.head}>
      <View style={styles.row}>
        <Image source={{ uri: params.avatar }} style={styles.avatar} />
        <View style={styles.info}>
          <Text><IconPerson name="user" />  {params.name}</Text>
          <Text><IconEmail name="email-outline" />  {params.email}</Text>
          <Text><IconPhone name="phone" />  {params.phoneNumber}</Text>
          <Text><IconSell name="store" />  {params.totalSells} sells in total</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile', { id: params._id })}>
          <IconEdit name="edit" size={28} style={styles.editIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  head: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    marginBottom: 30
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    objectFit: 'cover'
  },
  info: {
    flex: 1,
    marginLeft: 20
  },
  editIcon: {
    color: '#444'
  }
});

export default ProfileSection;
