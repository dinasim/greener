import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome, MaterialIcons, Entypo } from '@expo/vector-icons';

const ProfileSection = ({ params }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.profileHead}>
      <View style={styles.profileRow}>
        <Image source={{ uri: params.avatar }} style={styles.avatar} />

        <View style={styles.info}>
          <View style={styles.infoRow}>
            <FontAwesome name="user" size={16} style={styles.icon} />
            <Text>{params.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={16} style={styles.icon} />
            <Text>{params.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="phone-android" size={16} style={styles.icon} />
            <Text>{params.phoneNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Entypo name="shop" size={16} style={styles.icon} />
            <Text>{params.totalSells} sells in total</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editIcon}
          onPress={() => navigation.navigate('EditProfile', { id: params._id })}
        >
          <Entypo name="edit" size={20} color="#444" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ProfileSection;

const styles = StyleSheet.create({
  profileHead: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 6,
  },
  editIcon: {
    padding: 8,
    marginLeft: 'auto',
  },
});
