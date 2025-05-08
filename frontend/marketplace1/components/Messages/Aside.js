import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Aside = ({ conversations, chatId }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.aside}>
      <Text style={styles.header}>Conversations</Text>
      <ScrollView>
        {conversations.map(x => (
          <TouchableOpacity
            key={x._id}
            style={styles.connection}
            onPress={() => navigation.navigate('Messages', { chatId: x._id })}
          >
            <Image source={{ uri: x.seller.avatar }} style={styles.avatar} />
            <Text style={styles.name}>{x.seller.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  aside: {
    borderRightWidth: 1,
    borderRightColor: '#8080804a',
    paddingHorizontal: 10
  },
  header: {
    fontFamily: 'serif',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderColor: '#8080804a',
    padding: 15,
    fontSize: 18
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#8080804a'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    objectFit: 'cover',
    marginRight: 10
  },
  name: {
    fontSize: 16
  }
});

export default Aside;
