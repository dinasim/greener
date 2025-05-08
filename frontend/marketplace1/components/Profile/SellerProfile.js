import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Button,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome, MaterialIcons, Entypo } from '@expo/vector-icons';
import { createChatRoom } from '../../services/messagesData';
import ActiveSells from './Sells/ActiveSells';

const SellerProfile = ({ params }) => {
  const navigation = useNavigation();
  const [showMsg, setShowMsg] = useState(false);
  const [message, setMessage] = useState('');

  const handleMsgChange = text => setMessage(text);

  const onMsgSent = async () => {
    try {
      await createChatRoom(params._id, message);
      setShowMsg(false);
      navigation.navigate('Messages');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
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

        <View style={styles.contactButtonContainer}>
          <TouchableOpacity style={styles.contactButton} onPress={() => setShowMsg(true)}>
            <Entypo name="message" size={18} color="#fff" />
            <Text style={styles.contactButtonText}>Contact Seller</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ActiveSells params={params} />

      <Modal visible={showMsg} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Message</Text>
            <TextInput
              multiline
              style={styles.textarea}
              value={message}
              onChangeText={handleMsgChange}
              placeholder="Write your message..."
            />
            <View style={styles.modalButtons}>
              <Button title="Send" onPress={onMsgSent} />
              <Button title="Close" color="gray" onPress={() => setShowMsg(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default SellerProfile;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#ccc',
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
    flexShrink: 1,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 6,
  },
  contactButtonContainer: {
    marginTop: 10,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 6,
  },
  contactButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000000aa',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 10,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
  },
  textarea: {
    height: 100,
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
