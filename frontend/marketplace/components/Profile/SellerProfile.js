import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Modal, TextInput, Button, TouchableOpacity } from 'react-native';
import IconPerson from 'react-native-vector-icons/FontAwesome';
import IconEmail from 'react-native-vector-icons/MaterialCommunityIcons';
import IconPhone from 'react-native-vector-icons/MaterialIcons';
import IconSell from 'react-native-vector-icons/FontAwesome5';
import IconChat from 'react-native-vector-icons/MaterialCommunityIcons';

import ActiveSells from './Sells/ActiveSells';
import { createChatRoom } from '../../services/messagesData';
import { useNavigation } from '@react-navigation/native';

const SellerProfile = ({ params }) => {
  const navigation = useNavigation();
  const [showMsg, setShowMsg] = useState(false);
  const [message, setMessage] = useState('');

  const handleMsgSubmit = () => {
    createChatRoom(params._id, message)
      .then(() => {
        setShowMsg(false);
        navigation.navigate('Messages');
      })
      .catch(err => console.log(err));
  };

  return (
    <>
      <View style={styles.head}>
        <View style={styles.row}>
          <Image source={{ uri: params.avatar }} style={styles.avatar} />
          <View style={styles.info}>
            <Text><IconPerson name="user" />  {params.name}</Text>
            <Text><IconEmail name="email-outline" />  {params.email}</Text>
            <Text><IconPhone name="phone" />  {params.phoneNumber}</Text>
            <Text><IconSell name="store" />  {params.totalSells} sells in total</Text>
            <TouchableOpacity style={styles.btn} onPress={() => setShowMsg(true)}>
              <IconChat name="message-text" size={18} color="#fff" />
              <Text style={styles.btnText}>  Contact Seller</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ActiveSells params={params} />

      <Modal visible={showMsg} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Message</Text>
            <TextInput
              multiline
              placeholder="Type your message..."
              style={styles.textArea}
              value={message}
              onChangeText={setMessage}
            />
            <View style={styles.modalActions}>
              <Button title="Send" onPress={handleMsgSubmit} />
              <Button title="Close" color="grey" onPress={() => setShowMsg(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    alignItems: 'center'
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
  btn: {
    flexDirection: 'row',
    backgroundColor: '#343a40',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center'
  },
  btnText: {
    color: '#fff',
    fontSize: 16
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#00000088',
    padding: 20
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  textArea: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    minHeight: 100,
    padding: 10,
    marginBottom: 20,
    textAlignVertical: 'top'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  }
});

export default SellerProfile;
